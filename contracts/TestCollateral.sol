// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Valueless test-only collateral. Each address may claim 1,000 FMCT once.
/// It is not aUSD, USDC, USD, or an asset redeemable for money.
contract TestCollateral {
    string public constant name = "Fact Market Test Collateral";
    string public constant symbol = "FMCT";
    uint8 public constant decimals = 6;
    uint256 public constant FAUCET_AMOUNT = 1_000_000_000;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    mapping(address => bool) public faucetClaimed;

    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    error AlreadyClaimed();
    error InsufficientBalance();
    error InsufficientAllowance();
    error ZeroAddress();

    function faucet() external {
        if (faucetClaimed[msg.sender]) revert AlreadyClaimed();
        faucetClaimed[msg.sender] = true;
        balanceOf[msg.sender] += FAUCET_AMOUNT;
        totalSupply += FAUCET_AMOUNT;
        emit Transfer(address(0), msg.sender, FAUCET_AMOUNT);
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        _transfer(msg.sender, to, amount);
        return true;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        uint256 approved = allowance[from][msg.sender];
        if (approved < amount) revert InsufficientAllowance();
        if (approved != type(uint256).max) {
            allowance[from][msg.sender] = approved - amount;
            emit Approval(from, msg.sender, approved - amount);
        }
        _transfer(from, to, amount);
        return true;
    }

    function _transfer(address from, address to, uint256 amount) internal {
        if (to == address(0)) revert ZeroAddress();
        if (balanceOf[from] < amount) revert InsufficientBalance();
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        emit Transfer(from, to, amount);
    }
}
