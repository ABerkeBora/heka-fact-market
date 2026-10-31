import fs from "node:fs";
import path from "node:path";
import { BSV, Toolbox } from "./sdk.js";
export const BSV_LOCAL = path.resolve(".local/bsv");
fs.mkdirSync(BSV_LOCAL, { recursive: true, mode: 0o700 });
let otherPromise: Promise<any> | undefined;
export const userWallet = new BSV.WalletClient("auto", "localhost");
export async function testWallet(w: any) {
  const { network } = await w.getNetwork({});
  if (network !== "testnet")
    throw Error("BSV Testnet required. Mainnet actions are disabled.");
  return w;
}
export async function counterWallet() {
  if (!otherPromise)
    otherPromise = (async () => {
      const file = path.join(BSV_LOCAL, "counterparty-key.json");
      let key: string;
      if (fs.existsSync(file)) {
        if ((fs.statSync(file).mode & 0o077) !== 0)
          throw Error("Counterparty secret must have mode0600");
        const data = JSON.parse(fs.readFileSync(file, "utf8"));
        if (data.network !== "testnet")
          throw Error("Invalid counterparty network");
        key = data.rootKey;
      } else {
        key = BSV.PrivateKey.fromRandom().toHex();
        fs.writeFileSync(
          file,
          JSON.stringify({ network: "testnet", rootKey: key }),
          { mode: 0o600 },
        );
      }
      const identityKey = BSV.PrivateKey.fromHex(key).toPublicKey().toString();
      const setup = await Toolbox.Setup.createWalletSQLite({
        env: {
          chain: "test",
          identityKey,
          identityKey2: identityKey,
          taalApiKey: "",
          devKeys: {},
          mySQLConnection: "{}",
          filePath: path.join(BSV_LOCAL, "counterparty.sqlite"),
        },
        rootKeyHex: key,
        filePath: path.join(BSV_LOCAL, "counterparty.sqlite"),
        databaseName: "fact_market_bsv_counterparty",
      });
      return setup.wallet;
    })();
  return otherPromise;
}
export function attestorKey() {
  const file = path.join(BSV_LOCAL, "attestor-key.json");
  if (!fs.existsSync(file))
    fs.writeFileSync(
      file,
      JSON.stringify({
        network: "testnet",
        key: BSV.PrivateKey.fromRandom().toHex(),
      }),
      { mode: 0o600 },
    );
  if ((fs.statSync(file).mode & 0o077) !== 0)
    throw Error("Attestor secret must have mode0600");
  return BSV.PrivateKey.fromHex(JSON.parse(fs.readFileSync(file, "utf8")).key);
}
export async function derived(w: any, id: string, role: string) {
  await testWallet(w);
  return (
    await w.getPublicKey({
      protocolID: [1, "fact market bsv"],
      keyID: `${id}:${role}`,
      counterparty: "anyone",
      forSelf: true,
    })
  ).publicKey as string;
}
export async function walletHealth() {
  try {
    await testWallet(userWallet);
    const identity = (await userWallet.getPublicKey({ identityKey: true }))
      .publicKey;
    return {
      status: "ready",
      network: "testnet",
      identity,
      standardWallet: true,
    };
  } catch (e: any) {
    return {
      status: "blocked",
      network: "unverified",
      standardWallet: false,
      reason: e.message,
    };
  }
}
