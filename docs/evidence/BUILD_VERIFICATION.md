# Build and publication verification

Verified 31 October2026, approximately04:00Europe/Berlin.

- Public repository https://github.com/ABerkeBora/heka-fact-market ; default branch codex/build.
- First implementation commit3cf060d09e3fc2cb1e35fde4e04f7dc2c58bc298 pushed successfully.
- GitHub API resolved both author.login and committer.login to ABerkeBora. Repository-local identity uses the account's correct23353551+ABerkeBora GitHub noreply address; global Git identity was not changed.
- Cloned the actual public remote into an ignored clean verification directory inside this project. With no private environment/deployment/wallet files copied: npm ci, npm run build, npm test(8PASS) and forge test(29PASS,256fuzz cases) all succeeded. Solc0.8.37 compiled38sourcefiles from the vendored tree.
- Production server started using npm start on127.0.0.1:3102. Page and API returned200; private state URL returned404.
- Production restart restored both complete jobs with exactly the recorded transaction hash sets; restart-reconciliation.json contains the comparison. No new economic action was created by restart.
- Publishable-tree secret-pattern inspection passed. .env, .local/state.json and .local/panda-intent.json are ignored. Existing signatures/transactions in public evidence are public chain artifacts; no private keys or x402 authorization header is included.
- Four required oracle tamper reasons and buyer DuplicateIntent were independently verified at their actual receipt blocks. The initial wrong-role duplicate test remains disclosed as a non-qualifying historical check.

This verifies the local product and source delivery. Video recording/upload and Devfolio submission remain team actions; no complete submission or BSV qualification is claimed.
