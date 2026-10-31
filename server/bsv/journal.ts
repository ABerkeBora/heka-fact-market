import fs from "node:fs";
import path from "node:path";
import { BSV_LOCAL } from "./wallets.js";
export function read<T = any>(name: string, fallback: T = null as T): T {
  const p = path.join(BSV_LOCAL, name + ".json");
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : fallback;
}
export function write(name: string, value: any) {
  const p = path.join(BSV_LOCAL, name + ".json");
  fs.mkdirSync(path.dirname(p), { recursive: true, mode: 0o700 });
  fs.writeFileSync(
    p + ".tmp",
    JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
    { mode: 0o600 },
  );
  fs.renameSync(p + ".tmp", p);
}
export function evidence(name: string, value: any) {
  const p = path.resolve("docs/evidence/bsv", name + ".json");
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(
    p,
    JSON.stringify(
      value,
      (_, v) => (typeof v === "bigint" ? v.toString() : v),
      2,
    ),
  );
}
let busy = false;
export async function exclusive<T>(run: () => Promise<T>) {
  if (busy) throw Error("BSV executor busy. Resume the existing intent.");
  busy = true;
  try {
    return await run();
  } finally {
    busy = false;
  }
}
export const isBusy = () => busy;
