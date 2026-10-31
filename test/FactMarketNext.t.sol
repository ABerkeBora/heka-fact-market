// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {FactMarketNext} from "../contracts/FactMarketNext.sol";
import {TestCollateral} from "../contracts/TestCollateral.sol";
import {AirnodeV2Attestation} from "../contracts/vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "../contracts/vendor/ProjectedJson.sol";

/// Only a unit-test harness: cannot change market state, and not deployed by the app.
contract ObservationHarnessNext is FactMarketNext {
    constructor(address collateral_) FactMarketNext(collateral_) {}

    function inspectObservation(uint256 timestamp, bytes calldata data, uint64 start, uint64 end)
        external
        view
        returns (uint256, uint256)
    {
        return _readObservation(timestamp, data, start, end);
    }
}

contract FactMarketNextTest is Test {
    struct Response {
        uint256 timestamp;
        bytes data;
        bytes signature;
    }
    TestCollateral token;
    FactMarketNext market;
    ObservationHarnessNext harness;
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
        market = new FactMarketNext(address(token));
        harness = new ObservationHarnessNext(address(token));
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
        FactMarketNext.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.state), uint256(FactMarketNext.State.SettledYes));
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
        vm.expectRevert(FactMarketNext.ResponseTooOld.selector);
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
        bytes32 digest = keccak256(abi.encodePacked(market.requestHashForFeed(0), eth.timestamp, eth.data));
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(wrongKey, keccak256(abi.encodePacked("\x19Ethereum Signed Message:\n32", digest)));
        forged.signature = abi.encodePacked(r, s, v);
        vm.expectRevert(abi.encodeWithSelector(AirnodeV2Attestation.NotSignedByAirnode.selector, vm.addr(wrongKey)));
        submit(marketId, forged);
        assertProtected();
    }

    function test_RejectsSettlementReplayAndDoubleClaim() public {
        submit(marketId, eth);
        vm.expectRevert(FactMarketNext.NotOpen.selector);
        submit(marketId, eth);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarketNext.NotClaimable.selector);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarketNext.NotClaimable.selector);
        market.claim(marketId, counterparty);
    }

    function test_RejectsClaimBeforeResolutionAndUnknownBeneficiary() public {
        vm.expectRevert(FactMarketNext.NotClaimable.selector);
        market.claim(marketId, buyer);
        submit(marketId, eth);
        vm.expectRevert(FactMarketNext.NotClaimable.selector);
        market.claim(marketId, outsider);
    }

    function test_DuplicateIntentCannotFundAnotherMarket() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        uint256 before = token.balanceOf(buyer);
        vm.prank(buyer);
        vm.expectRevert(FactMarketNext.DuplicateIntent.selector);
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
        vm.expectRevert(FactMarketNext.PerActionCapExceeded.selector);
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
        vm.expectRevert(FactMarketNext.TotalCapExceeded.selector);
        market.fund(second, true, MANDATE, keccak256("limited 2"));
        vm.stopPrank();
        address oneAction = makeAddr("one action payer");
        prepare(oneAction, STAKE, 2 * STAKE, 1, uint64(eth.timestamp + 1000));
        vm.startPrank(oneAction);
        market.fund(second, true, MANDATE, keccak256("one action 1"));
        uint256 third = create(2500 ether, STAKE);
        vm.expectRevert(FactMarketNext.ActionCapExceeded.selector);
        market.fund(third, true, MANDATE, keccak256("one action 2"));
        vm.stopPrank();
    }

    function test_ExpiredMandateAndMandateReplacementRejected() public {
        vm.warp(eth.timestamp - 90);
        address short = makeAddr("short mandate payer");
        prepare(short, STAKE, STAKE, 1, uint64(block.timestamp + 1));
        vm.prank(short);
        vm.expectRevert(FactMarketNext.MandateExists.selector);
        market.authorizeMandate(MANDATE, STAKE, STAKE, 1, uint64(block.timestamp + 500));
        vm.warp(block.timestamp + 1);
        uint256 other = create(2500 ether, STAKE);
        vm.prank(short);
        vm.expectRevert(FactMarketNext.MandateExpired.selector);
        market.fund(other, true, MANDATE, keccak256("expired"));
    }

    function test_SamePayerCannotMatchItselfAndSideCannotBeOverwritten() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.startPrank(buyer);
        market.fund(other, true, MANDATE, keccak256("yes"));
        vm.expectRevert(FactMarketNext.SameCounterparty.selector);
        market.fund(other, false, MANDATE, keccak256("self no"));
        vm.stopPrank();
        vm.prank(counterparty);
        vm.expectRevert(FactMarketNext.SideOccupied.selector);
        market.fund(other, true, MANDATE, keccak256("overwrite"));
    }

    function test_ExactTradingCloseCannotTakeNewPositions() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2500 ether, STAKE);
        vm.warp(eth.timestamp - 10);
        vm.prank(buyer);
        vm.expectRevert(FactMarketNext.MarketClosed.selector);
        market.fund(other, true, MANDATE, keccak256("late position"));
    }

    function test_ObservationMustStartAndEndWithinFixedWindow() public {
        vm.warp(eth.timestamp - 6);
        vm.expectRevert(FactMarketNext.ObservationNotStarted.selector);
        submit(marketId, eth);
        vm.warp(eth.timestamp + 601);
        vm.expectRevert(FactMarketNext.ObservationEnded.selector);
        submit(marketId, eth);
        assertProtected();
    }

    function test_VoidMatchedMarketAfterWindowRefundsEachAndCannotDoubleRefund() public {
        vm.expectRevert(FactMarketNext.CannotVoidYet.selector);
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
        vm.expectRevert(FactMarketNext.NotClaimable.selector);
        market.claim(marketId, buyer);
        vm.expectRevert(FactMarketNext.NotOpen.selector);
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
        vm.expectRevert(FactMarketNext.NotMatched.selector);
        submit(other, eth);
    }

    function test_EqualityIsNoAndReservesAreIsolatedAcrossMarkets() public {
        vm.warp(eth.timestamp - 90);
        uint256 other = create(2443.22 ether, STAKE);
        fundPair(other, keccak256("other buyer"), keccak256("other no"));
        vm.warp(eth.timestamp + 10);
        submit(other, eth);
        market.claim(other, counterparty);
        assertEq(uint256(market.getMarket(other).state), uint256(FactMarketNext.State.SettledNo));
        assertEq(market.getMarket(other).reserve, 0);
        assertEq(market.getMarket(marketId).reserve, 2 * STAKE);
        assertEq(market.accountedReserve(), 2 * STAKE);
        assertEq(token.balanceOf(address(market)), 2 * STAKE);
    }

    function test_PolicyCannotBeMutatedByFundingOrRejection() public {
        bytes32 before = market.getMarket(marketId).policyHash;
        vm.expectRevert(FactMarketNext.ObservationEnded.selector);
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
        vm.expectRevert(FactMarketNext.TransferFailed.selector);
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
        vm.expectRevert(FactMarketNext.SourceTooOld.selector);
        harness.inspectObservation(block.timestamp, data, uint64(block.timestamp - 200), uint64(block.timestamp + 600));
        assertProtected();
    }

    function test_UnitRejectsFutureEnvelopeAndSource() public {
        vm.expectRevert(FactMarketNext.FutureTimestamp.selector);
        harness.inspectObservation(
            block.timestamp + 6, eth.data, uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
        );
        bytes memory data =
            bytes(string.concat('{"price":2443.22,"updatedAt":', vm.toString((block.timestamp + 6) * 1000), "}"));
        vm.expectRevert(FactMarketNext.FutureTimestamp.selector);
        harness.inspectObservation(block.timestamp, data, uint64(eth.timestamp - 5), uint64(eth.timestamp + 600));
    }

    function test_UnitRejectsOutsideWindowOrPreWindowSource() public {
        vm.expectRevert(FactMarketNext.OutsideObservationWindow.selector);
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
        vm.expectRevert(FactMarketNext.InvalidPrice.selector);
        harness.inspectObservation(
            block.timestamp,
            '{"price":0,"updatedAt":1792403485279}',
            uint64(eth.timestamp - 5),
            uint64(eth.timestamp + 600)
        );
        assertProtected();
    }

    function test_UnknownMarketAndInvalidPolicyAreRejected() public {
        vm.expectRevert(FactMarketNext.UnknownMarket.selector);
        market.getMarket(0);
        vm.expectRevert(FactMarketNext.InvalidPolicy.selector);
        market.createMarket(
            0, 0, STAKE, uint64(block.timestamp + 120), uint64(block.timestamp + 121), uint64(block.timestamp + 300)
        );
        vm.expectRevert(FactMarketNext.InvalidPolicy.selector);
        market.createMarket(
            0,
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

    function test_CanonicalHashesMatchBothAuthenticRequests() public view {
        assertEq(market.requestHashForFeed(0), 0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66);
        assertEq(market.requestHashForFeed(1), 0x78094ba4768ebdadb2012f2de22e779ce0992ecc290ebab208233addaaef106a);
        // Independent viem ABI encoding in the live provider registry proof agrees with Solidity.
        assertEq(market.recipeHashForFeed(0), 0xb5c7078fd74dfe81d42c362088dee2f71bbffb6f406dd0693946e22c3d550840);
        assertEq(market.recipeHashForFeed(1), 0x5329d4927aaa5c9bff0c9e6859e2b313f5cfbc8f9087a85d288e5ca5904d2fd2);
        assertNotEq(market.recipeHashForFeed(0), market.recipeHashForFeed(1));
        FactMarketNext.Recipe memory recipe = market.getRecipe(1);
        assertEq(recipe.feedId, 1);
        assertEq(recipe.source, "Nodary");
        assertEq(recipe.endpoint, "https://airnode-nodary.fly.dev/");
        assertEq(recipe.method, "POST");
        assertEq(recipe.operation, "latestFeeds");
        assertEq(recipe.feed, "BTC/USD");
        assertEq(recipe.parameters, '{"name":"BTC/USD"}');
        assertEq(recipe.projection, '{"price":"/BTC~1USD/value","updatedAt":"/BTC~1USD/timestamp"}');
        assertEq(recipe.unit, "USD");
        assertEq(recipe.decimals, 18);
        assertEq(recipe.comparator, "GT");
        assertEq(recipe.observationPolicy, "FIRST_ACCEPTED_FRESH_SOURCE_IN_WINDOW_ELSE_VOID");
        assertEq(recipe.signer, market.AIRNODE());
        assertEq(recipe.requestHash, market.requestHashForFeed(1));
        assertEq(recipe.recipeHash, market.recipeHashForFeed(1));
    }

    function test_BothFeedsBindConcreteRecipeAndPolicyBeforeFunding() public {
        vm.warp(eth.timestamp - 90);
        uint256 btcId = createBtc(2400 ether, STAKE);
        FactMarketNext.Market memory first = market.getMarket(marketId);
        FactMarketNext.Market memory second = market.getMarket(btcId);
        assertEq(first.feedId, 0);
        assertEq(second.feedId, 1);
        assertEq(first.requestHash, market.requestHashForFeed(0));
        assertEq(second.requestHash, market.requestHashForFeed(1));
        assertNotEq(first.policyHash, second.policyHash);
        assertEq(second.recipeHash, market.recipeHashForFeed(1));
        assertEq(second.reserve, 0);
        fundPair(btcId, keccak256("BTC yes"), keccak256("BTC no"));
        assertEq(market.getMarket(btcId).recipeHash, second.recipeHash);
        assertEq(market.getMarket(btcId).policyHash, second.policyHash);
    }

    function test_ValidBtcObservationSettlesOnlyBtcAndCannotSpendEthReserve() public {
        vm.warp(eth.timestamp - 90);
        uint256 btcId = createBtc(82_000 ether, STAKE);
        fundPair(btcId, keccak256("BTC yes"), keccak256("BTC no"));
        bytes32 pinned = market.getMarket(btcId).recipeHash;
        bytes32 policy = market.getMarket(btcId).policyHash;
        vm.warp(eth.timestamp + 10);
        Response memory btc = readFixture("nodary-btc-usd.json");
        submit(btcId, btc);
        FactMarketNext.Market memory settled = market.getMarket(btcId);
        assertEq(uint256(settled.state), uint256(FactMarketNext.State.SettledYes));
        assertEq(settled.observedPrice, 82_967.68 ether);
        assertEq(settled.recipeHash, pinned);
        assertEq(settled.policyHash, policy);
        uint256 paid = market.claim(btcId, buyer);
        assertEq(paid, 2 * STAKE);
        assertEq(market.getMarket(marketId).reserve, 2 * STAKE);
        assertEq(market.accountedReserve(), 2 * STAKE);
        assertEq(token.balanceOf(address(market)), 2 * STAKE);
    }

    function test_AuthenticEthResponseCannotSettleBtcMarket() public {
        vm.warp(eth.timestamp - 90);
        uint256 btcId = createBtc(82_000 ether, STAKE);
        fundPair(btcId, keccak256("BTC yes"), keccak256("BTC no"));
        bytes32 before = market.getMarket(btcId).policyHash;
        vm.warp(eth.timestamp + 10);
        vm.expectPartialRevert(AirnodeV2Attestation.NotSignedByAirnode.selector);
        submit(btcId, eth);
        assertEq(uint256(market.getMarket(btcId).state), uint256(FactMarketNext.State.Open));
        assertEq(market.getMarket(btcId).reserve, 2 * STAKE);
        assertEq(market.getMarket(btcId).policyHash, before);
        assertEq(market.accountedReserve(), 4 * STAKE);
    }

    function test_UnsupportedFeedCannotCreatePolicyOrTakeCollateral() public {
        uint256 count = market.marketCount();
        vm.expectRevert(abi.encodeWithSelector(FactMarketNext.UnsupportedFeed.selector, uint8(2)));
        market.createMarket(
            2,
            2400 ether,
            STAKE,
            uint64(block.timestamp + 120),
            uint64(block.timestamp + 121),
            uint64(block.timestamp + 300)
        );
        vm.expectRevert(abi.encodeWithSelector(FactMarketNext.UnsupportedFeed.selector, uint8(255)));
        market.getRecipe(255);
        assertEq(market.marketCount(), count);
        assertProtected();
    }

    function test_IntentSpentOnEthCannotFundBtcTwice() public {
        vm.warp(eth.timestamp - 90);
        uint256 btcId = createBtc(82_000 ether, STAKE);
        vm.prank(buyer);
        vm.expectRevert(FactMarketNext.DuplicateIntent.selector);
        market.fund(btcId, true, MANDATE, BUY_INTENT);
        assertEq(market.getMarket(btcId).reserve, 0);
        assertEq(market.accountedReserve(), 2 * STAKE);
    }

    function createBtc(uint256 threshold, uint256 stake) private returns (uint256) {
        return market.createMarket(
            1, threshold, stake, uint64(eth.timestamp - 10), uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
        );
    }

    function create(uint256 threshold, uint256 stake) private returns (uint256) {
        return market.createMarket(
            0, threshold, stake, uint64(eth.timestamp - 10), uint64(eth.timestamp - 5), uint64(eth.timestamp + 600)
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
        FactMarketNext.Market memory m = market.getMarket(marketId);
        assertEq(uint256(m.state), uint256(FactMarketNext.State.Open));
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

/// Adversarial token used only to exercise transactional rollback and callback guards.
contract CallbackTokenNext {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    FactMarketNext public target;
    uint256 public marketId;
    bytes32 public lastReentryError;
    bool public returnFalse;
    bool public callbacks;
    address public beneficiary;

    function setup(FactMarketNext target_, uint256 marketId_, address beneficiary_) external {
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

contract TransferSafetyNextTest is Test {
    CallbackTokenNext token;
    FactMarketNext market;
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
        token = new CallbackTokenNext();
        market = new FactMarketNext(address(token));
        id = market.createMarket(
            0, 2400 ether, 1_000_000, uint64(timestamp - 10), uint64(timestamp - 5), uint64(timestamp + 600)
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
        assertEq(token.lastReentryError(), bytes32(FactMarketNext.ReentrantCall.selector));
        assertEq(market.accountedReserve(), 2_000_000);
        vm.warp(timestamp + 10);
        market.settle(id, timestamp, data, signature);
        market.claim(id, buyer);
        assertEq(token.lastReentryError(), bytes32(FactMarketNext.ReentrantCall.selector));
        assertEq(market.accountedReserve(), 0);
        assertEq(token.balanceOf(address(market)), 0);
        assertEq(token.balanceOf(buyer), 11_000_000);
    }

    function test_FalseTransferDuringClaimCannotConsumeClaimOrReserve() public {
        fund();
        vm.warp(timestamp + 10);
        market.settle(id, timestamp, data, signature);
        token.setFalse(true);
        vm.expectRevert(FactMarketNext.TransferFailed.selector);
        market.claim(id, buyer);
        FactMarketNext.Market memory m = market.getMarket(id);
        assertFalse(m.yesClaimed);
        assertEq(m.reserve, 2_000_000);
        assertEq(market.accountedReserve(), 2_000_000);
        assertEq(token.balanceOf(address(market)), 2_000_000);
        token.setFalse(false);
        market.claim(id, buyer);
        assertEq(market.getMarket(id).reserve, 0);
    }
}
