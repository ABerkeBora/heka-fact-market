# Pinned Solidity dependencies

Vendored source, without Git metadata; no installation step or moving branch dependency.
Pins follow the official API3 starter at commit `52933ae1fb9371446a927338473466c3d320e19a`:

- OpenZeppelin Contracts v5.7.0: `cab19933c33c2ad1d4c7a84864a3601dddfd16f3`
- Solady v0.1.26: `acd959aa4bd04720d640bf4e6a5c71037510cc4b`
- Forge Standard Library v1.17.0: `f3dae6e6ee381f25eb6a246f7da9b85c91a68219`

Original licenses are preserved in the corresponding directories. `foundry.lock`
records the upstream pins. Files not reachable from our imports are removed to keep
this public repository small; add future dependency files only from these exact revisions.
