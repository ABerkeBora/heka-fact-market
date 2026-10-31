// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FactMarket} from "../contracts/FactMarket.sol";
import {TestCollateral} from "../contracts/TestCollateral.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "../contracts/vendor/ProjectedJson.sol";

/// Only a unit-test harness: cannot change market state, and not deployed by the app.
contract ObservationHarness is FactMarket {
    constructor(address collateral_) FactMarket(collateral_) {}

    function inspectObservation(uint256 timestamp, bytes calldata data, uint64 start, uint64 end)
        external
        view
        returns (uint256, uint256)
    {
        return _readObservation(timestamp, data, start, end);
    }
}

contract FactMarketTest is Test {
    struct Response {
        uint256 timestamp;
        bytes data;
        bytes signature;
    }
    TestCollateral token;
    FactMarket market;
    ObservationHarness harness;
    Response eth;
    address buyer = makeAddr("buyer");
    address counterparty = makeAddr("counterparty");
    address outsider = makeAddr("permissionless keeper");
    bytes32 constant MANDATE = keccak256("initial mandate");
    bytes32 constant BUY_INTENT = keccak256("buyer market 1");
    bytes32 constant SELL_INTENT = keccak256("counterparty market 1");
    uint256 constant STAKE = 10_000_000;
    uint256 marketId;

    function setUp() public {
        eth = readFixture("nodary-eth-usd.json");
        vm.warp(eth.timestamp - 100);
        token = new TestCollateral();
        market = new FactMarket(address(token));
        harness = new ObservationHarness(address(token));
        prepare(buyer, 1_000_000_000, 20_000_000_000, 20, uint64(eth.timestamp + 3600));
        prepare(counterparty, 1_000_000_000, 20_000_000_000, 20, uint64(eth.timestamp + 3600));
        marketId = create(2400 ether, STAKE);
        fundPair(marketId, BUY_INTENT, SELL_INTENT);
        vm.warp(eth.timestamp + 10);
    }

    function test_RealAirnodeResponseSettlesAndPermissionlessClaimPaysOnlyWinner() public {
        uint256 buyerBefore = token.balanceOf(buyer);
        vm.prank(outsider);
        submit(marketId, eth);
        FactMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.state), uint256(FactMarket.State.SettledYes));
        assertEq(m.observedPrice, 2443.22 ether);
        assertEq(m.sourceTimestamp, 1792403485);
        assertEq(m.signedTimestamp, eth.timestamp);
        assertEq(m.reserve, STAKE * 2);
        vm.prank(outsider);
        market.claim(marketId, buyer);
        assertEq(token.balanceOf(buyer), buyerBefore + STAKE * 2);
        assertEq(token.balanceOf(outsider), 0);
        assertEq(market.getMarket(marketId).reserve, 0);
        assertEq(market.accountedReserve(), 0);
        assertEq(token.balanceOf(address(market)), 0);
    }

    // Official four-case tamper gate, against genuine unmodified Airnode fixtures.
    function test_RejectsEditedRealValueWithoutChangingReserves() public {
        Response memory edited = eth;
        edited.data = '{"price":1443.22,"updatedAt":1792403485279}';
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        submit(marketId, edited);
        assertProtected();
    }

    function test_RejectsAuthenticButTooOldResponseWithoutChangingReserves() public {
        vm.warp(eth.timestamp + market.MAX_ENVELOPE_AGE() + 1);
        vm.expectRevert(FactMarket.ResponseTooOld.selector);
        submit(marketId, eth);
        assertProtected();
    }

    function test_RejectsRealResponseToDifferentRequestWithoutChangingReserves() public {
        Response memory btc = readFixture("nodary-btc-usd.json");
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        submit(marketId, btc);
        assertProtected();
    }

    function test_RejectsWrongSignerWithoutChangingReserves() public {
        Response memory forged = eth;
        uint256 wrongKey = 0xBAD;
        bytes32 digest = keccak256(abi.encodePacked(market.REQUEST_HASH(), eth.timestamp, eth.data));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(wrongKey, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        forged.signature = abi.encodePacked(r, s, v);
        vm.expectRevert(abi.encodeWithSelector(AirnodeV2Attestation.NotSignedByAirnode.selector, vm.addr(wrongKey)));
        submit(marketId, forged);
        assertProtected();
    }

    function test_RejectsSettlementReplayAndDoubleClaim() public {
        submit(marketId, eth);
        vm.expectRevert(FactMarket.NotOpen.selector);
        submit(marketId, eth);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarket.NotClaimable.selector);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarket.NotClaimable.selector);
        market.claim(marketId, counterparty);
    }

    function test_RejectsClaimBeforeResolutionAndUnknownBeneficiary() public {
        vm.expectRevert(FactMarket.NotClaimable.selector);
        market.claim(marketId, buyer);
        submit(marketId, eth);
        vm.expectRevert(FactMarket.NotClaimable.selector);
        market.claim(marketId, outsider);
    }

    function test_DuplicateIntentCannotFundAnotherMarket() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(FactMarket.DuplicateIntent.selector);
        market.fund(other, true, MANDATE, BUY_INTENT);
        assertEq(token.balanceOf(buyer), before);
        assertEq(market.getMarket(other).reserve, 0);
    }

    function test_OnchainPerActionCapBlocksOverBudget() public {
        vm.warp(eth.timestamp - 90);
        address small = makeAddr("small capped payer");
        prepare(small, 1_000_000, 2_000_000, 2, uint64(eth.timestamp + 1000));
        uint256 other = create(2500 ether, STAKE);
        vm.prank(small);
        vm.expectRevert(FactMarket.PerActionCapExceeded.selector);
        market.fund(other, true, MANDATE, keccak256("over budget"));
        assertFalse(market.usedIntents(small, keccak256("over budget")));
        assertEq(market.getMarket(other).reserve, 0);
    }

    function test_OnchainTotalCapAndActionCountStopFurtherFunding() public {
        vm.warp(eth.timestamp - 90);
        address limited = makeAddr("limited payer");
        prepare(limited, STAKE, STAKE, 2, uint64(eth.timestamp + 1000));
        uint256 first = create(2500 ether, STAKE);
        uint256 second = create(2500 ether, STAKE);
        vm.startPrank(limited);
        market.fund(first, true, MANDATE, keccak256("limited 1"));
        vm.expectRevert(FactMarket.TotalCapExceeded.selector);
        market.fund(second, true, MANDATE, keccak256("limited 2"));
        vm.stopPrank();
        address oneAction = makeAddr("one action payer");
        prepare(oneAction, STAKE, 2 * STAKE, 1, uint64(eth.timestamp + 1000));
        vm.startPrank(oneAction);
        market.fund(second, true, MANDATE, keccak256("one action 1"));
        uint256 third = create(2500 ether, STAKE);
        vm.expectRevert(FactMarket.ActionCapExceeded.selector);
        market.fund(third, true, MANDATE, keccak256("one action 2"));
        vm.stopPrank();
    }

    function test_ExpiredMandateAndMandateReplacementRejected() public {
        vm.warp(eth.timestamp - 90);
        address short = makeAddr("short mandate payer");
        prepare(short, STAKE, STAKE, 1, uint64(block.timestamp + 1));
        vm.prank(short);
        vm.expectRevert(FactMarket.MandateExists.selector);
        market.authorizeMandate(MANDATE, STAKE, STAKE, 1, uint64(block.timestamp + 500));
        vm.warp(block.timestamp + 1);
        uint256 other = create(2500 ether, STAKE);
        vm.prank(short);
        vm.expectRevert(FactMarket.MandateExpired.selector);
        market.fund(other, true, MANDATE, keccak256("expired"));
    }

    function test_SamePayerCannotMatchItselfAndSideCannotBeOverwritten() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.startPrank(buyer);
        market.fund(other, true, MANDATE, keccak256("yes"));
        vm.expectRevert(FactMarket.SameCounterparty.selector);
        market.fund(other, false, MANDATE, keccak256("self no"));
        vm.stopPrank();
        vm.prank(counterparty);
        vm.expectRevert(FactMarket.SideOccupied.selector);
        market.fund(other, true, MANDATE, keccak256("overwrite"));
    }

    function test_ExactTradingCloseCannotTakeNewPositions() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.warp(eth.timestamp - 10);
        vm.prank(buyer);
        vm.expectRevert(FactMarket.MarketClosed.selector);
        market.fund(other, true, MANDATE, keccak256("late position"));
    }

    function test_ObservationMustStartAndEndWithinFixedWindow() public {
        vm.warp(eth.timestamp - 6);
        vm.expectRevert(FactMarket.ObservationNotStarted.selector);
        submit(marketId, eth);
        vm.warp(eth.timestamp + 601);
        vm.expectRevert(FactMarket.ObservationEnded.selector);
        submit(marketId, eth);
        assertProtected();
    }

    function test_VoidMatchedMarketAfterWindowRefundsEachAndCannotDoubleRefund() public {
        vm.expectRevert(FactMarket.CannotVoidYet.selector);
        market.voidMarket(marketId);
        vm.warp(eth.timestamp + 601);
        market.voidMarket(marketId);
        uint256 buyerBefore = token.balanceOf(buyer);
        uint256 counterBefore = token.balanceOf(counterparty);
        market.claim(marketId, buyer);
        market.claim(marketId, counterparty);
        assertEq(token.balanceOf(buyer), buyerBefore + STAKE);
        assertEq(token.balanceOf(counterparty), counterBefore + STAKE);
        assertEq(market.accountedReserve(), 0);
        vm.expectRevert(FactMarket.NotClaimable.selector);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarket.NotOpen.selector);
        submit(marketId, eth);
    }

    function test_UnmatchedMarketCanVoidAtCloseAndRefundItsOnlyFunder() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.prank(buyer);
        market.fund(other, true, MANDATE, keccak256("unmatched"));
        vm.warp(eth.timestamp - 10);
        market.voidMarket(other);
        market.claim(other, buyer);
        assertEq(market.getMarket(other).reserve, 0);
        assertEq(market.accountedReserve(), 2 * STAKE);
    }

    function test_UnmatchedMarketCannotSettle() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.prank(buyer);
        market.fund(other, true, MANDATE, keccak256("unmatched"));
        vm.warp(eth.timestamp + 10);
        vm.expectRevert(FactMarket.NotMatched.selector);
        submit(other, eth);
    }

    function test_EqualityIsNoAndReservesAreIsolatedAcrossMarkets() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2443.22 ether, STAKE);
        fundPair(other, keccak256("other buyer"), keccak256("other no"));
        vm.warp(eth.timestamp + 10);
        submit(other, eth);
        market.claim(other, counterparty);
        assertEq(uint256(market.getMarket(other).state), uint256(FactMarket.State.SettledNo));
        assertEq(market.getMarket(other).reserve, 0);
        assertEq(market.getMarket(marketId).reserve, 2 * STAKE);
        assertEq(market.accountedReserve(), 2 * STAKE);
        assertEq(token.balanceOf(address(market)), 2 * STAKE);
    }

    function test_PolicyCannotBeMutatedByFundingOrRejection() public {
        bytes32 before = market.getMarket(marketId).policyHash;
        vm.expectRevert(FactMarket.ObservationEnded.selector);
        vm.warp(eth.timestamp + 601);
        submit(marketId, eth);
        assertEq(market.getMarket(marketId).policyHash, before);
    }

    function test_FailedTransferRollsBackIntentMandateAndReserve() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.prank(buyer);
        token.approve(address(market), 0);
        vm.prank(buyer);
        vm.expectRevert(FactMarket.TransferFailed.selector);
        market.fund(other, true, MANDATE, keccak256("failed transfer"));
        assertFalse(market.usedIntents(buyer, keccak256("failed transfer")));
        assertEq(market.getMarket(other).reserve, 0);
        (,, uint256 spent,, uint32 actions,) = market.mandates(buyer, MANDATE);
        assertEq(spent, STAKE);
        assertEq(actions, 1);
    }

    function testFuzz_PayoutAndRemainingReservesAlwaysEqualFundedCollateral(uint128 rawStake) public {
        uint256 stake = bound(uint256(rawStake), 1, 400_000_000);
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2400 ether, stake);
        fundPair(other, keccak256("fuzz buyer"), keccak256("fuzz no"));
        vm.warp(eth.timestamp + 10);
        uint256 funded = 2 * STAKE + 2 * stake;
        submit(other, eth);
        uint256 paid = market.claim(other, buyer);
        assertEq(paid + market.accountedReserve(), funded);
        assertEq(market.accountedReserve(), token.balanceOf(address(market)));
        assertEq(market.getMarket(marketId).reserve, 2 * STAKE);
    }

    // Internal semantics tests deliberately bypass signature to cover malformed and
    // unavailable source fields. They cannot create settlement evidence or release funds.
    function test_UnitRejectsFreshEnvelopeWithOldSource() public {
        bytes memory data =
            bytes(string.concat('{"price":2443.22,"updatedAt":', vm.toString((block.timestamp - 121) * 1000), "}"));
        vm.expectRevert(FactMarket.SourceTooOld.selector);
        harness.inspectObservation(block.timestamp, data, uint64(block.timestamp - 200), uint64(block.timestamp + 600));
        assertProtected();
    }

    function test_UnitRejectsFutureEnvelopeAndSource() public {
        vm.expectRevert(FactMarket.FutureTimestamp.selector);
        harness.inspectObservation(
            block.timestamp + 6, eth.data, uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
        );
        bytes memory data =
            bytes(string.concat('{"price":2443.22,"updatedAt":', vm.toString((block.timestamp + 6) * 1000), "}"));
        vm.expectRevert(FactMarket.FutureTimestamp.selector);
        harness.inspectObservation(block.timestamp, data, uint64(eth.timestamp - 5), uint64(eth.timestamp + 600));
    }

    function test_UnitRejectsOutsideWindowOrPreWindowSource() public {
        vm.expectRevert(FactMarket.OutsideObservationWindow.selector);
        harness.inspectObservation(eth.timestamp, eth.data, uint64(eth.timestamp + 1), uint64(eth.timestamp + 600));
    }

    function test_UnitRejectsNullMissingNegativeAndZeroPrice() public {
        vm.expectRevert(abi.encodeWithSelector(ProjectedJson.UnexpectedValue.selector, "price"));
        harness.inspectObservation(
            block.timestamp,
            '{"price":null,"updatedAt":1792403485279}',
            uint64(eth.timestamp - 5),
            uint64(eth.timestamp + 600)
        );
        vm.expectRevert(abi.encodeWithSelector(ProjectedJson.FieldNotFound.selector, "updatedAt"));
        harness.inspectObservation(
            block.timestamp, '{"price":2443.22}', uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
        );
        vm.expectRevert(abi.encodeWithSelector(ProjectedJson.UnexpectedValue.selector, "price"));
        harness.inspectObservation(
            block.timestamp,
            '{"price":-1,"updatedAt":1792403485279}',
            uint64(eth.timestamp - 5),
            uint64(eth.timestamp + 600)
        );
        vm.expectRevert(FactMarket.InvalidPrice.selector);
        harness.inspectObservation(
            block.timestamp,
            '{"price":0,"updatedAt":1792403485279}',
            uint64(eth.timestamp - 5),
            uint64(eth.timestamp + 600)
        );
        assertProtected();
    }

    function test_UnknownMarketAndInvalidPolicyAreRejected() public {
        vm.expectRevert(FactMarket.UnknownMarket.selector);
        market.getMarket(0);
        vm.expectRevert(FactMarket.InvalidPolicy.selector);
        market.createMarket(
            0, STAKE, uint64(block.timestamp + 120), uint64(block.timestamp + 121), uint64(block.timestamp + 300)
        );
        vm.expectRevert(FactMarket.InvalidPolicy.selector);
        market.createMarket(
            2400 ether,
            STAKE,
            uint64(block.timestamp + 120),
            uint64(block.timestamp + 119),
            uint64(block.timestamp + 300)
        );
    }

    function test_FaucetOnlyOnceAndTokenBalancesAndAllowance() public {
        vm.prank(buyer);
        vm.expectRevert(TestCollateral.AlreadyClaimed.selector);
        token.faucet();
        vm.prank(outsider);
        vm.expectRevert(TestCollateral.InsufficientBalance.selector);
        token.transfer(buyer, 1);
        vm.prank(outsider);
        vm.expectRevert(TestCollateral.InsufficientAllowance.selector);
        token.transferFrom(buyer, outsider, 1);
    }

    function create(uint256 threshold, uint256 stake) private returns (uint256) {
        return market.createMarket(
            threshold, stake, uint64(eth.timestamp - 10), uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
        );
    }

    function prepare(address payer, uint256 perCap, uint256 totalCap, uint32 actions, uint64 expiry) private {
        vm.startPrank(payer);
        token.faucet();
        token.approve(address(market), type(uint256).max);
        market.authorizeMandate(MANDATE, perCap, totalCap, actions, expiry);
        vm.stopPrank();
    }

    function fundPair(uint256 id, bytes32 yesIntent, bytes32 noIntent) private {
        vm.prank(buyer);
        market.fund(id, true, MANDATE, yesIntent);
        vm.prank(counterparty);
        market.fund(id, false, MANDATE, noIntent);
    }

    function assertProtected() private view {
        FactMarket.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.state), uint256(FactMarket.State.Open));
        assertEq(m.reserve, STAKE * 2);
        assertEq(market.accountedReserve(), STAKE * 2);
        assertEq(token.balanceOf(address(market)), STAKE * 2);
    }

    function submit(uint256 id, Response memory response) private {
        market.settle(id, response.timestamp, response.data, response.signature);
    }

    function readFixture(string memory name) private view returns (Response memory) {
        string memory json = vm.readFile(string.concat("test/fixtures/", name));
        return Response(
            vm.parseJsonUint(json, ".timestamp"),
            bytes(vm.parseJsonString(json, ".data")),
            vm.parseJsonBytes(json, ".signature")
        );
    }
}
