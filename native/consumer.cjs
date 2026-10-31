// Native original-Airnode consumer. No wallet, signing key or broadcaster here.
const fs = require("node:fs"),
  path = require("node:path"),
  zlib = require("node:zlib"),
  crypto = require("node:crypto");
const {
  buildContractClass,
  Bytes,
  Int,
  SigHashPreimage,
  Ripemd160,
} = require("scryptlib");
const { publicKeyToAddress } = require("viem/accounts");
const artifactBytes = zlib.gunzipSync(
  fs.readFileSync(path.join(__dirname, "nodary-outcome.json.gz")),
);
const Consumer = buildContractClass(JSON.parse(artifactBytes));
const strip = (v) => String(v).replace(/^0x/, "");
const number = (v) => Int(BigInt(v));
const bytes = (v) => Bytes(strip(v));
const sha = (hex) =>
  crypto.createHash("sha256").update(Buffer.from(hex, "hex")).digest("hex");
function createNodaryOutcome(policy) {
  const key = strip(policy.airnodePublicKey);
  if (!/^04[0-9a-fA-F]{128}$/.test(key))
    throw Error("Original uncompressed Airnode key required");
  const mapped = publicKeyToAddress("0x" + key);
  if (mapped.toLowerCase() !== policy.expectedAirnodeAddress.toLowerCase())
    throw Error("Original key does not map to pinned Airnode address");
  if (!/^[0-9a-fA-F]{64}$/.test(strip(policy.requestHash)))
    throw Error("Exact request hash required");
  if (
    BigInt(policy.buyerStakeSatoshis) <= 0n ||
    BigInt(policy.buyerStakeSatoshis) >= BigInt(policy.collateralSatoshis)
  )
    throw Error("Two nonzero fixed refund shares required");
  const c = new Consumer(
    bytes(policy.requestHash),
    {
      x: number("0x" + key.slice(2, 66)),
      y: number("0x" + key.slice(66, 130)),
    },
    number(policy.validFrom),
    number(policy.validTo),
    number(policy.threshold18),
    number(policy.collateralSatoshis),
    bytes(policy.yesRecipientScript),
    bytes(policy.noRecipientScript),
    number(policy.refundAfter),
    bytes(policy.refundBuyerScript),
    bytes(policy.refundCounterpartyScript),
    number(policy.buyerStakeSatoshis),
  );
  const lockingHex = c.lockingScript.toHex(),
    postSeparatorScriptHex = c.lockingScript.subScript(0).toHex();
  return {
    lockingHex,
    postSeparatorScriptHex,
    info: {
      originalSigner: mapped,
      lockingScriptBytes: lockingHex.length / 2,
      lockingScriptSha256: sha(lockingHex),
      postSeparatorScriptBytes: postSeparatorScriptHex.length / 2,
      artifactSha256: crypto
        .createHash("sha256")
        .update(artifactBytes)
        .digest("hex"),
    },
    unlock({
      refund = false,
      envelope,
      preimageHex,
      changeAmount = 0n,
      changePublicKeyHash = "00".repeat(20),
    }) {
      let t = 0n,
        data = "",
        r = 0n,
        s = 0n;
      if (!refund) {
        if (
          !envelope ||
          envelope.requestHash.toLowerCase() !==
            policy.requestHash.toLowerCase()
        )
          throw Error("Envelope request mismatch");
        t = BigInt(envelope.timestamp);
        data = Buffer.from(envelope.data, "utf8").toString("hex");
        const sig = strip(envelope.signature);
        if (!/^[0-9a-fA-F]{130}$/.test(sig))
          throw Error("Original EIP191 signature required");
        r = BigInt("0x" + sig.slice(0, 64));
        s = BigInt("0x" + sig.slice(64, 128));
      }
      return c
        .spend(
          !!refund,
          number(t),
          Bytes(data),
          { r: number(r), s: number(s) },
          SigHashPreimage(strip(preimageHex)),
          number(changeAmount),
          Ripemd160(strip(changePublicKeyHash)),
        )
        .toScript()
        .toHex();
    },
    _delegate: c,
  };
}
module.exports = { createNodaryOutcome };
