// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice Fully collateralized two-party ETH/USD observation markets on a test network.
/// The predicate is price > threshold, using the first valid source observation accepted
/// on chain inside the immutable observation window. This is not an exact-T historical
/// price or a claim about all observations during a period. There is no administrator.
contract FactMarket {
    address public constant AIRNODE = 0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0;
    bytes32 public constant REQUEST_HASH = 0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66;
    uint256 public constant MAX_ENVELOPE_AGE = 120;
    uint256 public constant MAX_SOURCE_AGE = 120;
    uint256 public constant FUTURE_TOLERANCE = 5;
    uint256 public constant MAX_STAKE = 1_000_000_000; // 1,000 FMCT, six decimals
    address public immutable collateral;
    uint256 public marketCount;
    uint256 public accountedReserve;
    uint256 private locked = 1;

    enum State {
        Open,
        SettledYes,
        SettledNo,
        Voided
    }

    struct Market {
        uint256 threshold;
        uint256 stake;
        uint64 closesAt;
        uint64 observationStart;
        uint64 observationEnd;
        address yesOwner;
        address noOwner;
        State state;
        uint256 reserve;
        uint256 observedPrice;
        uint64 sourceTimestamp;
        uint64 signedTimestamp;
        bytes32 evidenceHash;
        bytes32 policyHash;
        bool yesClaimed;
        bool noClaimed;
    }

    struct Mandate {
        uint256 perActionCap;
        uint256 totalCap;
        uint256 spent;
        uint32 maxActions;
        uint32 actions;
        uint64 expiry;
    }
    mapping(uint256 => Market) private markets;
    mapping(address => mapping(bytes32 => Mandate)) public mandates;
    mapping(address => mapping(bytes32 => bool)) public usedIntents;

    event MarketCreated(
        uint256 indexed marketId,
        bytes32 indexed policyHash,
        uint256 threshold,
        uint256 stake,
        uint64 closesAt,
        uint64 observationStart,
        uint64 observationEnd
    );
    event MandateAuthorized(
        address indexed payer,
        bytes32 indexed mandateId,
        uint256 perActionCap,
        uint256 totalCap,
        uint32 maxActions,
        uint64 expiry
    );
    event PositionFunded(
        uint256 indexed marketId,
        address indexed beneficiary,
        bool yes,
        uint256 amount,
        bytes32 indexed intentId,
        bytes32 mandateId
    );
    event MarketSettled(
        uint256 indexed marketId,
        bool yesWins,
        uint256 price,
        uint64 sourceTimestamp,
        uint64 signedTimestamp,
        bytes32 evidenceHash
    );
    event MarketVoided(uint256 indexed marketId);
    event Claimed(uint256 indexed marketId, address indexed beneficiary, uint256 amount);

    error InvalidPolicy();
    error UnknownMarket();
    error InvalidMandate();
    error MandateExists();
    error MandateExpired();
    error PerActionCapExceeded();
    error TotalCapExceeded();
    error ActionCapExceeded();
    error DuplicateIntent();
    error MarketClosed();
    error SideOccupied();
    error SameCounterparty();
    error NotOpen();
    error NotMatched();
    error ObservationNotStarted();
    error ObservationEnded();
    error ResponseTooOld();
    error SourceTooOld();
    error FutureTimestamp();
    error OutsideObservationWindow();
    error InvalidPrice();
    error CannotVoidYet();
    error NotClaimable();
    error TransferFailed();
    error ReentrantCall();

    modifier nonReentrant() {
        if (locked != 1) revert ReentrantCall();
        locked = 2;
        _;
        locked = 1;
    }

    constructor(address collateral_) {
        if (collateral_.code.length == 0) revert InvalidPolicy();
        collateral = collateral_;
    }

    function getMarket(uint256 marketId) external view returns (Market memory) {
        _exists(marketId);
        return markets[marketId];
    }

    function createMarket(
        uint256 threshold,
        uint256 stake,
        uint64 closesAt,
        uint64 observationStart,
        uint64 observationEnd
    ) external returns (uint256 marketId) {
        if (
            threshold == 0 || threshold > 1_000_000_000_000 ether || stake == 0 || stake > MAX_STAKE
                || closesAt < block.timestamp + 5 || observationStart < closesAt || observationEnd <= observationStart
                || observationEnd - observationStart > 3600 || observationStart > block.timestamp + 1 days
        ) revert InvalidPolicy();
        marketId = ++marketCount;
        Market storage m = markets[marketId];
        m.threshold = threshold;
        m.stake = stake;
        m.closesAt = closesAt;
        m.observationStart = observationStart;
        m.observationEnd = observationEnd;
        m.policyHash = keccak256(
            abi.encode(
                block.chainid,
                address(this),
                collateral,
                AIRNODE,
                REQUEST_HASH,
                threshold,
                stake,
                closesAt,
                observationStart,
                observationEnd,
                MAX_ENVELOPE_AGE,
                MAX_SOURCE_AGE,
                FUTURE_TOLERANCE
            )
        );
        emit MarketCreated(marketId, m.policyHash, threshold, stake, closesAt, observationStart, observationEnd);
    }

    /// @notice Establish a bounded allowance to this immutable factory and collateral.
    /// The caller is always payer and beneficiary. Gas/API limits are not governed here.
    function authorizeMandate(
        bytes32 mandateId,
        uint256 perActionCap,
        uint256 totalCap,
        uint32 maxActions,
        uint64 expiry
    ) external {
        if (mandates[msg.sender][mandateId].expiry != 0) revert MandateExists();
        if (
            mandateId == bytes32(0) || perActionCap == 0 || perActionCap > MAX_STAKE || totalCap < perActionCap
                || totalCap > MAX_STAKE * 20 || maxActions == 0 || maxActions > 20 || expiry <= block.timestamp
                || expiry > block.timestamp + 1 days
        ) revert InvalidMandate();
        mandates[msg.sender][mandateId] = Mandate(perActionCap, totalCap, 0, maxActions, 0, expiry);
        emit MandateAuthorized(msg.sender, mandateId, perActionCap, totalCap, maxActions, expiry);
    }

    function fund(uint256 marketId, bool yes, bytes32 mandateId, bytes32 intentId) external nonReentrant {
        _exists(marketId);
        if (intentId == bytes32(0) || usedIntents[msg.sender][intentId]) revert DuplicateIntent();
        Market storage m = markets[marketId];
        if (m.state != State.Open) revert NotOpen();
        if (block.timestamp >= m.closesAt) revert MarketClosed();
        if ((yes && m.yesOwner != address(0)) || (!yes && m.noOwner != address(0))) revert SideOccupied();
        if ((yes && m.noOwner == msg.sender) || (!yes && m.yesOwner == msg.sender)) revert SameCounterparty();
        Mandate storage mandate = mandates[msg.sender][mandateId];
        if (mandate.expiry == 0) revert InvalidMandate();
        if (block.timestamp >= mandate.expiry) revert MandateExpired();
        if (m.stake > mandate.perActionCap) revert PerActionCapExceeded();
        if (mandate.spent + m.stake > mandate.totalCap) revert TotalCapExceeded();
        if (mandate.actions >= mandate.maxActions) revert ActionCapExceeded();
        usedIntents[msg.sender][intentId] = true;
        mandate.spent += m.stake;
        mandate.actions += 1;
        if (yes) m.yesOwner = msg.sender;
        else m.noOwner = msg.sender;
        m.reserve += m.stake;
        accountedReserve += m.stake;
        _transferFrom(msg.sender, m.stake);
        emit PositionFunded(marketId, msg.sender, yes, m.stake, intentId, mandateId);
    }

    /// @notice Permissionless. Exact signed data bytes must be supplied unmodified.
    function settle(uint256 marketId, uint256 timestamp, bytes calldata data, bytes calldata signature) external {
        _exists(marketId);
        Market storage m = markets[marketId];
        if (m.state != State.Open) revert NotOpen();
        if (m.yesOwner == address(0) || m.noOwner == address(0)) revert NotMatched();
        if (block.timestamp < m.observationStart) revert ObservationNotStarted();
        if (block.timestamp > m.observationEnd) revert ObservationEnded();
        AirnodeV2Attestation.verify(AIRNODE, REQUEST_HASH, timestamp, data, signature);
        (uint256 price, uint256 sourceTimestamp) =
            _readObservation(timestamp, data, m.observationStart, m.observationEnd);
        m.state = price > m.threshold ? State.SettledYes : State.SettledNo;
        m.observedPrice = price;
        m.sourceTimestamp = uint64(sourceTimestamp);
        m.signedTimestamp = uint64(timestamp);
        m.evidenceHash = keccak256(abi.encode(timestamp, data, signature));
        emit MarketSettled(
            marketId, m.state == State.SettledYes, price, uint64(sourceTimestamp), uint64(timestamp), m.evidenceHash
        );
    }

    /// @notice Unmatched markets void once trading closes; matched markets after observation expires.
    function voidMarket(uint256 marketId) external {
        _exists(marketId);
        Market storage m = markets[marketId];
        if (m.state != State.Open) revert NotOpen();
        bool unmatched = m.yesOwner == address(0) || m.noOwner == address(0);
        if (!(unmatched ? block.timestamp >= m.closesAt : block.timestamp > m.observationEnd)) revert CannotVoidYet();
        m.state = State.Voided;
        emit MarketVoided(marketId);
    }

    /// @notice Anyone may initiate collection; tokens always go to the fixed funded beneficiary.
    function claim(uint256 marketId, address beneficiary) external nonReentrant returns (uint256 amount) {
        _exists(marketId);
        Market storage m = markets[marketId];
        bool yes = beneficiary == m.yesOwner && beneficiary != address(0);
        bool no = beneficiary == m.noOwner && beneficiary != address(0);
        if ((!yes && !no) || (yes && m.yesClaimed) || (no && m.noClaimed)) revert NotClaimable();
        if (m.state == State.Voided) amount = m.stake;
        else if ((yes && m.state == State.SettledYes) || (no && m.state == State.SettledNo)) amount = m.stake * 2;
        else revert NotClaimable();
        if (yes) m.yesClaimed = true;
        else m.noClaimed = true;
        m.reserve -= amount;
        accountedReserve -= amount;
        _transfer(beneficiary, amount);
        emit Claimed(marketId, beneficiary, amount);
    }

    /// @dev Called only after signature verification in settle. Separate internal function
    /// permits direct unit coverage of parser/time semantics without forging an Airnode key.
    function _readObservation(uint256 timestamp, bytes memory data, uint64 observationStart, uint64 observationEnd)
        internal
        view
        returns (uint256 price, uint256 sourceTimestamp)
    {
        if (timestamp > block.timestamp + FUTURE_TOLERANCE || timestamp > type(uint64).max) revert FutureTimestamp();
        if (timestamp + MAX_ENVELOPE_AGE < block.timestamp) revert ResponseTooOld();
        price = ProjectedJson.readUint(data, "price", 18);
        sourceTimestamp = ProjectedJson.readUint(data, "updatedAt", 0) / 1000;
        if (price == 0 || price > 1_000_000_000_000 ether) revert InvalidPrice();
        if (sourceTimestamp > block.timestamp + FUTURE_TOLERANCE || sourceTimestamp > timestamp + FUTURE_TOLERANCE) {
            revert FutureTimestamp();
        }
        if (sourceTimestamp + MAX_SOURCE_AGE < block.timestamp) revert SourceTooOld();
        if (timestamp < observationStart || sourceTimestamp < observationStart || sourceTimestamp > observationEnd) {
            revert OutsideObservationWindow();
        }
    }

    function _exists(uint256 marketId) private view {
        if (marketId == 0 || marketId > marketCount) revert UnknownMarket();
    }

    function _transferFrom(address from, uint256 amount) private {
        (bool ok, bytes memory result) = collateral.call(
            abi.encodeWithSignature("transferFrom(address,address,uint256)", from, address(this), amount)
        );
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
    }

    function _transfer(address to, uint256 amount) private {
        (bool ok, bytes memory result) =
            collateral.call(abi.encodeWithSignature("transfer(address,uint256)", to, amount));
        if (!ok || (result.length != 0 && !abi.decode(result, (bool)))) revert TransferFailed();
    }
}
