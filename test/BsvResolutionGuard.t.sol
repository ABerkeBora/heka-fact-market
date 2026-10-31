// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {Test} from "forge-std/Test.sol";
import {BsvResolutionGuard} from "../contracts/BsvResolutionGuard.sol";
contract GuardHarness is BsvResolutionGuard {function inspect(bytes32 id)external view returns(uint8,bytes32,bytes32){Policy storage p=policies[id];return(p.outcome,p.approvedOutputs,p.collateral);}}
contract BsvResolutionGuardTest is Test {
 GuardHarness g;uint256 timestamp;bytes data;bytes signature;bytes32 constant ID=keccak256("policy");bytes32 constant YES=keccak256("fixed-yes-outputs");bytes32 constant NO=keccak256("fixed-no-outputs");bytes32 constant VOID=keccak256("fixed-split-refund");bytes32 constant UNMATCHED=keccak256("single-stake-refund");
 function setUp()public{string memory raw=vm.readFile("test/fixtures/nodary-eth-usd.json");timestamp=vm.parseJsonUint(raw,".timestamp");data=bytes(vm.parseJsonString(raw,".data"));signature=vm.parseJsonBytes(raw,".signature");vm.warp(timestamp-100);g=new GuardHarness();g.register(ID,2400 ether,uint64(timestamp-10),uint64(timestamp+600),YES,NO,VOID,UNMATCHED);g.bindCollateral(ID,keccak256("two-bsv-outpoints"),true);vm.warp(timestamp+10);}
 function testAuthenticOriginalEnvelopeApprovesOnlyFixedWinnerOutputs()public{g.approve(ID,timestamp,data,signature);(uint8 outcome,bytes32 output,)=g.inspect(ID);assertEq(outcome,1);assertEq(output,YES);}
 function testEditedOriginalDataCannotApproveOutputs()public{vm.expectRevert();g.approve(ID,timestamp,bytes('{"price":9999,"updatedAt":1792403485279}'),signature);(uint8 outcome,bytes32 output,)=g.inspect(ID);assertEq(outcome,0);assertEq(output,0);}
 function testAuthenticStaleResponseCannotApproveOutputs()public{vm.warp(timestamp+121);vm.expectRevert(BsvResolutionGuard.Stale.selector);g.approve(ID,timestamp,data,signature);}
 function testWrongSignerCannotApproveOutputs()public{bytes memory bad=bytes.concat(signature);bad[2]=bytes1(uint8(bad[2])^1);vm.expectRevert();g.approve(ID,timestamp,data,bad);}
 function testAuthenticOtherRequestCannotApproveOutputs()public{string memory raw=vm.readFile("test/fixtures/nodary-ankreth-eth-exchange-rate.json");vm.expectRevert();g.approve(ID,vm.parseJsonUint(raw,".timestamp"),bytes(vm.parseJsonString(raw,".data")),vm.parseJsonBytes(raw,".signature"));}
 function testReplayCannotReplaceApprovedOutput()public{g.approve(ID,timestamp,data,signature);vm.expectRevert(BsvResolutionGuard.AlreadyResolved.selector);g.approve(ID,timestamp,data,signature);}
 function testOnlyOriginalRegistrarCanBindBsvCollateral()public{vm.prank(address(123));vm.expectRevert(BsvResolutionGuard.NotCreator.selector);g.bindCollateral(ID,keccak256("foreign"),true);}
 function testVoidCannotApproveBeforePinnedDeadline()public{vm.expectRevert(BsvResolutionGuard.NotReady.selector);g.approveVoid(ID);vm.warp(timestamp+601);g.approveVoid(ID);(uint8 outcome,bytes32 output,)=g.inspect(ID);assertEq(outcome,3);assertEq(output,VOID);}
 function testUnmatchedRefundIsASeparateCommittedOutput()public{vm.warp(timestamp-100);bytes32 id=keccak256("unmatched");g.register(id,2400 ether,uint64(timestamp-10),uint64(timestamp+600),YES,NO,VOID,UNMATCHED);vm.expectRevert(BsvResolutionGuard.InvalidPolicy.selector);g.bindCollateral(id,keccak256("one"),false);vm.warp(timestamp+601);g.bindCollateral(id,keccak256("one"),false);g.approveVoid(id);(uint8 outcome,bytes32 output,)=g.inspect(id);assertEq(outcome,3);assertEq(output,UNMATCHED);}
}
