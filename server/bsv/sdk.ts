// One CJS SDK build, shared with wallet-toolbox; avoids incompatible SDK class copies.
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
export const BSV = require("@bsv/sdk") as typeof import("@bsv/sdk");
export const Toolbox =
  require("@bsv/wallet-toolbox") as typeof import("@bsv/wallet-toolbox");
export const ArcadeProvider =
  require("@bsv/wallet-toolbox/out/src/services/providers/Arcade").Arcade;
