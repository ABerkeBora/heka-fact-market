# Oracle verification libraries

Copied unmodified from the official MIT-licensed API3 AirnodeHub hackathon starter:
https://github.com/api3dao/airnodehub-hackathon-starter/tree/52933ae1fb9371446a927338473466c3d320e19a/contracts

Pinned starter commit: `52933ae1fb9371446a927338473466c3d320e19a`.
The complete original MIT license is preserved in this directory.
`AirnodeV2Attestation` verifies the EIP-191 signature of the fixed request hash,
timestamp and exact data bytes. `ProjectedJson` extracts price/time only after
verification. `IsoTimestamp` is a transitive import, not used by this price template.
