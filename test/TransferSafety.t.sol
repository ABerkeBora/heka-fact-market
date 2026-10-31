// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FactMarket} from "../contracts/FactMarket.sol";

/// Adversarial token used only to exercise transactional rollback and callback guards.
contract CallbackToken {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    FactMarket public target;
    uint256 public marketId;
    bytes32 public lastReentryError;
    bool public returnFalse;
    bool public callbacks;
    address public beneficiary;

    function setup(FactMarket target_, uint256 marketId_, address beneficiary_) external {
        target = target_;
        marketId = marketId_;
        beneficiary = beneficiary_;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
    }

    function approve(address to, uint256 amount) external returns (bool) {
        allowance[msg.sender][to] = amount;
        return true;
    }

    function setFalse(bool value) external {
        returnFalse = value;
    }

    function setCallbacks(bool value) external {
        callbacks = value;
    }

    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        if (returnFalse) return false;
        require(allowance[from][msg.sender] >= amount && balanceOf[from] >= amount);
        allowance[from][msg.sender] -= amount;
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        if (callbacks) {
            try target.fund(marketId, true, bytes32(uint256(1)), bytes32(uint256(100))) {
                revert("reentry unexpectedly succeeded");
            } catch (bytes memory err) {
                lastReentryError = bytes32(bytes4(err));
            }
        }
        return true;
    }

    function transfer(address to, uint256 amount) external returns (bool) {
        if (returnFalse) return false;
        require(balanceOf[msg.sender] >= amount);
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        if (callbacks) {
            try target.claim(marketId, beneficiary) {
                revert("reentry unexpectedly succeeded");
            } catch (bytes memory err) {
                lastReentryError = bytes32(bytes4(err));
            }
        }
        return true;
    }
}

contract TransferSafetyTest is Test {
    CallbackToken token;
    FactMarket market;
    address buyer = makeAddr("buyer");
    address counterparty = makeAddr("counterparty");
    bytes32 constant MANDATE = bytes32(uint256(1));
    uint256 id;
    uint256 timestamp;
    bytes data;
    bytes signature;

    function setUp() public {
        string memory json = vm.readFile("test/fixtures/nodary-eth-usd.json");
        timestamp = vm.parseJsonUint(json, ".timestamp");
        data = bytes(vm.parseJsonString(json, ".data"));
        signature = vm.parseJsonBytes(json, ".signature");
        vm.warp(timestamp - 100);
        token = new CallbackToken();
        market = new FactMarket(address(token));
        id = market.createMarket(
            2400 ether, 1_000_000, uint64(timestamp - 10), uint64(timestamp - 5), uint64(timestamp + 600)
        );
        token.setup(market, id, buyer);
        prepare(buyer);
        prepare(counterparty);
    }

    function prepare(address who) private {
        token.mint(who, 10_000_000);
        vm.startPrank(who);
        token.approve(address(market), 10_000_000);
        market.authorizeMandate(MANDATE, 1_000_000, 1_000_000, 1, uint64(timestamp + 300));
        vm.stopPrank();
    }

    function fund() private {
        vm.prank(buyer);
        market.fund(id, true, MANDATE, bytes32(uint256(2)));
        vm.prank(counterparty);
        market.fund(id, false, MANDATE, bytes32(uint256(3)));
    }

    function test_FundingAndClaimCallbacksCannotReenter() public {
        token.setCallbacks(true);
        fund();
        assertEq(token.lastReentryError(), bytes32(FactMarket.ReentrantCall.selector));
        assertEq(market.accountedReserve(), 2_000_000);
        vm.warp(timestamp + 10);
        market.settle(id, timestamp, data, signature);
        market.claim(id, buyer);
        assertEq(token.lastReentryError(), bytes32(FactMarket.ReentrantCall.selector));
        assertEq(market.accountedReserve(), 0);
        assertEq(token.balanceOf(address(market)), 0);
        assertEq(token.balanceOf(buyer), 11_000_000);
    }

    function test_FalseTransferDuringClaimCannotConsumeClaimOrReserve() public {
        fund();
        vm.warp(timestamp + 10);
        market.settle(id, timestamp, data, signature);
        token.setFalse(true);
        vm.expectRevert(FactMarket.TransferFailed.selector);
        market.claim(id, buyer);
        FactMarket.Market memory m = market.getMarket(id);
        assertFalse(m.yesClaimed);
        assertEq(m.reserve, 2_000_000);
        assertEq(market.accountedReserve(), 2_000_000);
        assertEq(token.balanceOf(address(market)), 2_000_000);
        token.setFalse(false);
        market.claim(id, buyer);
        assertEq(market.getMarket(id).reserve, 0);
    }
}
