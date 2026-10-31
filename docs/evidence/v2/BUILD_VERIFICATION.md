# V2 publication and clean install

- Public code commit8c14e8f34bb13c323c0daaab04ba6e66cf083ba7 on codex/next pushed successfully. GitHub API resolves both author and committer to ABerkeBora.
- v1-baseline remains e8fb85c79eb8104f6530c77ecc50b6509672f59c; remote tag and clean-clone tag verified, never moved.
- Fresh clone of the actual public codex/next branch, no private environment/wallet/deployment files copied: npm ci, productionbuild,15TypeScript tests and64Soliditytests all PASS. Solc0.8.37 compiled40files; both core reserve fuzz tests ran256cases.
- Production server remains on loopback3102. Root route returns original V1 factory/ETH-only3markets; next route returns separate V2 factory/ETH+BTC2markets. All5jobscomplete; no cross-namespace job IDs. Private V2 state and wallet URLs returned404.
- Exact comparison of all6V1/V2role private keys against every publishable file passed; generic secret/header/raw-transaction inspection passed. No key or x402 authorization header was published.
- Read-only workspace and public historical audits passed; public mode explicitly skips private-journal-only checks. Public RPC429 was handled by bounded backoff, not by relaxing verification.

This is engineering/test-network evidence. External customer pilot, video recording and Devfolio submission are not claimed.
