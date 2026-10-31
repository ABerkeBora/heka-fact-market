// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;
import {AirnodeV2Attestation} from "./vendor/AirnodeV2Attestation.sol";
import {ProjectedJson} from "./vendor/ProjectedJson.sol";

/// @notice Original API3 verification and immutable BSV output approval.
/// @dev This is an EVM oracle sidecar. BSV enforcement still trusts an additional attestor.
contract BsvResolutionGuard {
 address public constant AIRNODE=0xE70f1e8b22a21e4Bb5188918a3033341b281E4c0;
 bytes32 public constant REQUEST_HASH=0x180eae9387bb66a72380e61ebe0a00d19f8414a716a37ebe1df124b66acfff66;
 struct Policy {address creator;uint256 threshold;uint64 start;uint64 end;bytes32 yesOutputs;bytes32 noOutputs;bytes32 voidOutputs;bytes32 unmatchedOutputs;bytes32 collateral;bytes32 approvedOutputs;bytes32 proofHash;uint8 outcome;bool matched;}
 mapping(bytes32=>Policy) public policies;
 error InvalidPolicy();error NotReady();error AlreadyResolved();error Stale();error OutsideWindow();error NotCreator();
 event Registered(bytes32 indexed policyHash,uint256 threshold,uint64 start,uint64 end);
 event ResolutionApproved(bytes32 indexed policyHash,uint8 outcome,bytes32 outputsHash,bytes32 proofHash,bytes32 collateral);
 function register(bytes32 id,uint256 threshold,uint64 start,uint64 end,bytes32 yesOutputs,bytes32 noOutputs,bytes32 voidOutputs,bytes32 unmatchedOutputs) external {
  if(id==0||policies[id].creator!=address(0)||threshold==0||start<=block.timestamp||end<=start||end>block.timestamp+1 days||yesOutputs==0||noOutputs==0||voidOutputs==0)revert InvalidPolicy();
  policies[id]=Policy(msg.sender,threshold,start,end,yesOutputs,noOutputs,voidOutputs,unmatchedOutputs,0,0,0,0,false);emit Registered(id,threshold,start,end);
 }
 function bindCollateral(bytes32 id,bytes32 collateral,bool matched) external {Policy storage p=policies[id];if(p.creator!=msg.sender)revert NotCreator();if(p.collateral!=0||collateral==0||p.outcome!=0||(!matched&&block.timestamp<=p.end))revert InvalidPolicy();p.collateral=collateral;p.matched=matched;}
 function approve(bytes32 id,uint256 timestamp,bytes calldata data,bytes calldata signature) external {
  Policy storage p=policies[id];if(p.outcome!=0)revert AlreadyResolved();if(p.collateral==0||!p.matched||block.timestamp<p.start||block.timestamp>p.end)revert NotReady();
  AirnodeV2Attestation.verify(AIRNODE,REQUEST_HASH,timestamp,data,signature);
  if(timestamp>block.timestamp+5||timestamp+120<block.timestamp)revert Stale();
  uint256 sourceAt=ProjectedJson.readUint(data,"updatedAt",0)/1000;
  if(sourceAt>block.timestamp+5||sourceAt>timestamp+5||sourceAt+120<block.timestamp)revert Stale();
  if(timestamp<p.start||sourceAt<p.start||sourceAt>p.end)revert OutsideWindow();
  uint256 price=ProjectedJson.readUint(data,"price",18);if(price==0)revert InvalidPolicy();
  p.outcome=price>p.threshold?1:2;p.approvedOutputs=p.outcome==1?p.yesOutputs:p.noOutputs;p.proofHash=keccak256(abi.encode(timestamp,data,signature));
  emit ResolutionApproved(id,p.outcome,p.approvedOutputs,p.proofHash,p.collateral);
 }
 function approveVoid(bytes32 id) external {Policy storage p=policies[id];if(p.creator==address(0)||p.collateral==0||block.timestamp<=p.end)revert NotReady();if(p.outcome!=0)revert AlreadyResolved();p.outcome=3;p.approvedOutputs=p.matched?p.voidOutputs:p.unmatchedOutputs;emit ResolutionApproved(id,3,p.approvedOutputs,0,p.collateral);}
}
