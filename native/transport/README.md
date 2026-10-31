# Bounded public BSV testnet P2P transport

Runtime dependency: sponsor-pinned `@bsv/sdk@3.2.1`. `testnet-p2p.cjs` is a transport adapter, not a wallet, signer or transaction builder. It never reads files, keys or environment credentials. It opens only an outbound socket to the fixed official testnet US peer advertised by Arcade health: `bsva-ovh-seed-testnet-us-1.bsvb.tech:18333`.

The application must obtain `rawHex`, `expectedTxid` and optional ancestor bytes from **its own already-signed frozen public journal**, under its existing validated payment intent. These arguments must not become arbitrary LLM tool parameters. The adapter validates exact standard-raw serialization/hash, testnet-only network selection, BSV wire magic `f4e5f3f4`, BSV peer user agent, handshake and the peer's advertised receive capacity. It sends no `mempool` command, authentication workaround or private RPC call. Incoming frames are capped at16MiB, total receive at64MiB, events at1000 and attempts at45seconds maximum. No automatic retry, top-up, fee modification or transaction replacement.

```js
const {transportCanonical, rawParentsFromBeef} = require('./testnet-p2p.cjs')
// journal is the application's frozen signed public record, loaded by a fixed server-side path.
const common = {
  network: 'testnet', expectedTxid: journal.txid, rawHex: journal.raw,
  parentRawHexes: rawParentsFromBeef(journal.beef, journal.txid),
}
const sent = await transportCanonical({...common, mode: 'broadcast'})
// Persist this attempt under the SAME intent and canonical hash. A send alone is not acceptance.
const seen = await transportCanonical({...common, mode: 'query'})
```

`broadcast` uses standard `inv → getdata → tx`, honoring peer receive limits for the canonical transaction **and every supplied ancestor**. Only requested unchanged public bytes are sent. `query` creates a fresh connection and sends only `getdata`; it never sends a transaction or inventory. Optional `onEvent` receives sanitized event metadata without raw bytes.

Results distinguish `SENT_UNCONFIRMED`, `RELAY_RETURNED_UNCONFIRMED` (fresh peer returns exact canonical bytes), `PEER_REJECTED` with exact code/reason/txid, `PEER_NOT_FOUND`, `PEER_LIMIT_BLOCKED`, transport/protocol failure and timeout. Neither relay retrieval nor socket write is mining proof. Preserve an independently verified block receipt before claiming mined status. The original Arcade database row can remain `RECEIVED` despite independent propagation; do not manufacture a changed Arcade state.

Observed real query test: `query-funding-result.json` returned the exact previously-signed 5,012,239-byte Fact Market funding transaction from this peer. `validation-results.json` covers mainnet/wrong-hash/raw-format rejection and public-BEEF dependency extraction. The module itself has not re-broadcast a transaction during this final query test; earlier bounded scratch transport carried the same original funding and claim, as documented in the parent directory.

Live **claim is blocked by public-node execution policy**: same frozen native claim `bd6f64e8583e49ce22b663520049059c3aa34414ad042c395d6da45b718ac2ff` was rejected by US/EU/Gorilla HTTP as `Operation limit exceeded` and US P2P as `too-long-validation-time`. Transport success must never be presented as actual native outcome payout. An adapter cannot fix this by repeated sends.

Official sources: [network/port](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/chainparams.cpp#L1374), [message-size policy](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/protocol.h#L29), [protoconf](https://github.com/bsv-blockchain/go-wire/blob/master/msg_proto_conf.go), [relay-cache GETDATA semantics](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/net/net_processing.cpp#L1392), [public mempool-query restrictions](https://github.com/bitcoin-sv/bitcoin-sv/blob/master/src/net/net_processing.cpp#L4158). See parent `README.md`/`RESULT.json` for source snapshots and observations. This is narrow experimental transport code, not an audited general networking library.
