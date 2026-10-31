/** Read-only metadata/402 inspection by default; --pay performs at most two bounded test-aUSD calls. */
import 'dotenv/config';
import { chmodSync, existsSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { createPublicClient, decodeEventLog, encodePacked, erc20Abi, http, isAddressEqual, keccak256, recoverMessageAddress, toHex, type Hex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { ExactEvmScheme } from '@x402/evm';
import { decodePaymentResponseHeader, x402Client, x402HTTPClient, type PaymentRequired } from '@x402/fetch';

const ENDPOINT = 'https://airnode-pandascore.fly.dev/';
const SIGNER = '0xd9D29FEDc3737aD5198611457fE04aB08a739C7b';
const ASSET = '0xbeA34973e5f67F18F656A2C6070C64326C791808';
const PAYEE = '0x1505FD562AC2Fb4307B85BC6c672FfeafB4d57A7';
const INTENT_FILE = '.local/panda-intent.json';
const MAX_TOTAL = 30000n;
const MAX_CALL = 10000n;
const maxCalls = 3;
const canonicalize = (v: unknown): unknown => Array.isArray(v) ? v.map(canonicalize) : v && typeof v === 'object' ? Object.entries(v).sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([k, x]) => [k, canonicalize(x)]) : v;
const requestHash = (r: RequestBody) => keccak256(toHex(JSON.stringify([r.operation, canonicalize(r.parameters), ...(r.responseProjection ? [canonicalize(r.responseProjection)] : [])])));
type RequestBody = { operation: string; parameters: Record<string, unknown>; responseProjection?: Record<string, string> };
type Envelope = { airnode: string; requestHash: Hex; timestamp: string; data: string; signature: Hex };
type Intent = { id: string; request: RequestBody; requestHash: Hex; status: string; amount: string; createdAt: string; paymentHeader?: string; authorizationNonce?: string; validBefore?: string; submittedAt?: string; result?: Record<string, unknown>; error?: string };
type Journal = { mandate: Record<string, unknown>; intents: Intent[] };
const save = (journal: Journal) => {
  writeFileSync(`${INTENT_FILE}.tmp`, JSON.stringify(journal, null, 2), { mode: 0o600 });
  chmodSync(`${INTENT_FILE}.tmp`, 0o600); renameSync(`${INTENT_FILE}.tmp`, INTENT_FILE); chmodSync(INTENT_FILE, 0o600);
};
const summarizeChallenge = (p: PaymentRequired) => ({ x402Version: p.x402Version, resource: p.resource, accepts: p.accepts });
const validateChallenge = (p: PaymentRequired) => {
  if (p.x402Version !== 2 || p.resource?.url !== ENDPOINT) throw new Error('Unexpected x402 resource/version');
  const accepted = p.accepts.filter(r => r.scheme === 'exact' && r.network === 'eip155:84532' && r.asset.toLowerCase() === ASSET.toLowerCase() && r.payTo.toLowerCase() === PAYEE.toLowerCase() && BigInt(r.amount) > 0n && BigInt(r.amount) <= MAX_CALL && r.maxTimeoutSeconds <= 300);
  if (accepted.length !== 1) throw new Error('Challenge outside fixed payee/asset/network/fee mandate');
  return { ...p, accepts: accepted };
};
const main = async () => {
  const metadata = await (await fetch(ENDPOINT, { signal: AbortSignal.timeout(20000) })).json();
  if (!isAddressEqual(metadata['x-airnode']?.address, SIGNER)) throw new Error('Metadata signer changed');
  const operations = metadata.paths['/'].post.requestBody.content['application/json'].schema.oneOf;
  const summary = { checkedAt: new Date().toISOString(), signer: SIGNER, operations: operations.filter((o: any) => ['matchesUpcoming', 'getMatch'].includes(o.properties.operation.const)).map((o: any) => ({ name: o.properties.operation.const, price: o.properties.operation['x-airnode-price'], parameters: o.properties.parameters, returns: o.properties.operation['x-airnode-returns'] })) };
  const discovery: RequestBody = { operation: 'matchesUpcoming', parameters: { per_page: 1 }, responseProjection: { matchId: '/0/id', name: '/0/name', status: '/0/status', scheduledAt: '/0/scheduled_at' } };
  const raw = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(discovery), signal: AbortSignal.timeout(20000) });
  if (raw.status !== 402) throw new Error(`Expected paid discovery 402; received ${raw.status}`);
  const challenge = JSON.parse(Buffer.from(raw.headers.get('PAYMENT-REQUIRED')!, 'base64').toString()) as PaymentRequired;
  validateChallenge(challenge);
  if (!process.argv.includes('--pay')) { console.log(JSON.stringify({ ...summary, request: discovery, requestHash: requestHash(discovery), challenge: summarizeChallenge(challenge), paid: false }, null, 2)); return; }
  const walletFile = process.env.FACT_MARKET_WALLETS || process.env.WALLET_FILE || '.local/test-wallets.json';
  if ((statSync(walletFile).mode & 0o077) !== 0) throw new Error('Wallet file must have private mode 0600');
  const wallet = JSON.parse(readFileSync(walletFile, 'utf8'));
  if (wallet.testOnly !== true || Number(wallet.chainId) !== 84532 || !wallet.roles?.deployer?.privateKey) throw new Error('Wrong wallet scope');
  const account = privateKeyToAccount(wallet.roles.deployer.privateKey);
  if (!wallet.roles.deployer.address || !isAddressEqual(account.address, wallet.roles.deployer.address)) throw new Error('Deployer key/address mismatch');
  const chain = createPublicClient({ chain: baseSepolia, transport: http(process.env.RPC_URL || 'https://sepolia.base.org') });
  if (await chain.getChainId() !== 84532) throw new Error('Wrong RPC network');
  const journal: Journal = existsSync(INTENT_FILE) ? JSON.parse(readFileSync(INTENT_FILE, 'utf8')) : { mandate: { id: 'pandascore-smoke-v1', payer: account.address, network: 'eip155:84532', asset: ASSET, recipient: PAYEE, maxPerAction: MAX_CALL.toString(), maxTotal: MAX_TOTAL.toString(), maxActions: maxCalls, gasCap: '0', beneficiary: account.address, result: 'signed upcoming match metadata only; no market lifecycle claim', expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() }, intents: [] };
  save(journal);
  const client = x402Client.fromConfig({ schemes: [{ network: 'eip155:84532', client: new ExactEvmScheme(account) }], spendControls: { maxAmountPerPayment: '$0.01', allowedAssets: [{ network: 'eip155:84532', asset: ASSET, maxAmountPerPayment: MAX_CALL.toString() }] }, policies: [(_version, requirements) => requirements.filter(r => r.network === 'eip155:84532' && r.asset.toLowerCase() === ASSET.toLowerCase() && r.payTo.toLowerCase() === PAYEE.toLowerCase() && BigInt(r.amount) <= MAX_CALL)] });
  const httpClient = new x402HTTPClient(client);
  const paymentTransfer = async (hash: Hex) => {
    const receipt = await chain.waitForTransactionReceipt({ hash, timeout: 60000 });
    if (receipt.status !== 'success') throw new Error('Payment transaction reverted');
    let found = false;
    for (const log of receipt.logs) {
      if (log.address.toLowerCase() !== ASSET.toLowerCase()) continue;
      try {
        const event = decodeEventLog({ abi: erc20Abi, eventName: 'Transfer', data: log.data, topics: log.topics });
        if (isAddressEqual(event.args.from, account.address) && isAddressEqual(event.args.to, PAYEE) && event.args.value === MAX_CALL) found = true;
      } catch { /* unrelated token event */ }
    }
    if (!found) throw new Error('Receipt lacks the exact mandated aUSD transfer');
    return { transactionHash: receipt.transactionHash, blockNumber: receipt.blockNumber.toString(), status: receipt.status, token: ASSET, from: account.address, to: PAYEE, amount: MAX_CALL.toString() };
  };
  const payOnce = async (id: string, request: RequestBody): Promise<Record<string, unknown>> => {
    const existing = journal.intents.find(i => i.id === id);
    if (existing) { if (existing.status === 'delivered' && existing.result) { existing.result.receipt = await paymentTransfer((existing.result.settlement as { transaction: Hex }).transaction); save(journal); return existing.result; } throw new Error(`Intent ${id} already ${existing.status}; reconcile persisted nonce/receipt before retry, no fresh payment created`); }
    if (Date.parse(String(journal.mandate.expiresAt)) <= Date.now()) throw new Error('Mandate expired');
    const spentOrReserved = journal.intents.reduce((n, i) => n + BigInt(i.amount), 0n);
    if (journal.intents.length >= maxCalls || spentOrReserved + MAX_CALL > MAX_TOTAL) throw new Error('Total API budget exhausted');
    const intent: Intent = { id, request, requestHash: requestHash(request), status: 'reserved', amount: MAX_CALL.toString(), createdAt: new Date().toISOString() };
    journal.intents.push(intent); save(journal);
    try {
      const response402 = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(request), signal: AbortSignal.timeout(20000) });
      if (response402.status !== 402) throw new Error(`Expected 402 before signing; received ${response402.status}`);
      const paymentRequired = validateChallenge(JSON.parse(Buffer.from(response402.headers.get('PAYMENT-REQUIRED')!, 'base64').toString()));
      const payload = await client.createPaymentPayload(paymentRequired);
      const headers = httpClient.encodePaymentSignatureHeader(payload);
      const header = headers['PAYMENT-SIGNATURE'] || headers['payment-signature'];
      if (!header) throw new Error('SDK returned no payment authorization header');
      const decoded = JSON.parse(Buffer.from(header, 'base64').toString());
      intent.paymentHeader = header; intent.authorizationNonce = decoded.payload?.authorization?.nonce; intent.validBefore = decoded.payload?.authorization?.validBefore; intent.status = 'signed'; save(journal);
      // Persist the exact EIP-3009 authorization and a submitted marker BEFORE the single network send.
      intent.status = 'submitted'; intent.submittedAt = new Date().toISOString(); save(journal);
      const paidResponse = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(request), signal: AbortSignal.timeout(45000) });
      const settlementHeader = paidResponse.headers.get('PAYMENT-RESPONSE');
      const settlement = settlementHeader ? decodePaymentResponseHeader(settlementHeader) : undefined;
      const text = await paidResponse.text();
      intent.status = settlement?.success ? 'payment-confirmed' : 'response-received';
      intent.result = { status: paidResponse.status, settlement: settlement || null, receivedAt: new Date().toISOString(), responseBody: text }; save(journal);
      if (!paidResponse.ok) throw new Error(`Paid response ${paidResponse.status}; inspect journal before any retry`);
      if (!settlement?.success || !settlement.transaction) throw new Error('No successful x402 payment settlement receipt');
      const envelope = JSON.parse(text) as Envelope;
      if (envelope.requestHash !== intent.requestHash) throw new Error('Signed request hash mismatch');
      const recovered = await recoverMessageAddress({ message: { raw: keccak256(encodePacked(['bytes32', 'uint256', 'bytes'], [intent.requestHash, BigInt(envelope.timestamp), toHex(envelope.data)])) }, signature: envelope.signature });
      if (!isAddressEqual(recovered, SIGNER)) throw new Error('Wrong response signer');
      const signedAt = Number(envelope.timestamp);
      const now = Math.floor(Date.now() / 1000);
      if (!Number.isSafeInteger(signedAt) || signedAt > now + 10 || signedAt + 120 < now) throw new Error('Envelope outside smoke freshness window');
      const receipt = await paymentTransfer(settlement.transaction as Hex);
      intent.result = { request, requestHash: intent.requestHash, settlement, receipt, envelope, signer: recovered, data: JSON.parse(envelope.data), receivedAt: new Date().toISOString() };
      intent.status = 'delivered'; save(journal);
      return intent.result;
    } catch (error) { intent.error = error instanceof Error ? error.message : 'Provider call failed'; save(journal); throw error; }
  };
  const discovered = await payOnce('upcoming-1', discovery);
  const record = discovered.data as Record<string, unknown>;
  if (!Number.isSafeInteger(record.matchId) || record.status !== 'not_started' || typeof record.scheduledAt !== 'string' || Date.parse(record.scheduledAt) <= Date.parse(String(discovered.receivedAt))) throw new Error('No supported future match returned; stop without another paid call');
  const getMatch: RequestBody = { operation: 'getMatch', parameters: { match_id_or_slug: String(record.matchId) }, responseProjection: { matchId: '/id', name: '/name', status: '/status', winnerId: '/winner_id', modifiedAt: '/modified_at', scheduledAt: '/scheduled_at', endedAt: '/end_at', draw: '/draw', forfeit: '/forfeit', opponents: '/opponents' } };
  const match = await payOnce(`match-${record.matchId}`, getMatch);
  // Output contains signed data and settled transaction evidence only; never the payment authorization or keys.
  console.log(JSON.stringify({ ...summary, mandate: journal.mandate, discovery: discovered, match, paid: true }, null, 2));
};
main().catch(error => { console.error(error instanceof Error ? error.message : 'Provider smoke failed'); process.exitCode = 1; });
