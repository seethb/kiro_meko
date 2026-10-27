// Make a workspace for a demo run: the order service *before* the order-history
// feature (../order-service-starter), plus this repo's Meko steering file, with
// the agents pointed at one datapack. No spec, no decisions: Kiro makes them.
//
//   npm run demo:fresh -- kiro-dryrun-3                      # -> ../order-service-fresh
//   npm run demo:fresh -- kiro-dryrun-3 order-service-run3   # -> ../order-service-run3
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_DATAPACK = "kiro-order-service";
const DEFAULT_DATAPACK_ID = "8133232a-2125-4192-8144-fb1865b6ff57";
const datapack = process.argv[2] || DEFAULT_DATAPACK;

// Agents need the datapack's id, not just its name: an account without a
// default datapack can't look one up before it has a conversation. Resolve
// (or create) it with the console's Meko client, using MEKO_API_KEY.
let datapackId = DEFAULT_DATAPACK_ID;
if (datapack !== DEFAULT_DATAPACK) {
  process.env.MEKO_DATAPACK_NAME = datapack;
  const meko = await import("../../console/server/meko.mjs");
  if (!meko.configured()) throw new Error("Set MEKO_API_KEY (or console/.env) to resolve the datapack id");
  datapackId = (await meko.ensureDatapack()).id;
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const starter = resolve(root, "..", "order-service-starter");
const target = resolve(root, "..", process.argv[3] || "order-service-fresh");
if (existsSync(target)) rmSync(target, { recursive: true });
cpSync(starter, target, {
  recursive: true,
  filter: (src) => !/node_modules|[\\/]dist$/.test(src),
});
mkdirSync(join(target, ".kiro", "steering"), { recursive: true });
cpSync(join(root, ".kiro", "steering", "meko-decisions.md"), join(target, ".kiro", "steering", "meko-decisions.md"));

for (const file of [".kiro/steering/meko-decisions.md", "AGENTS.md"]) {
  const path = join(target, file);
  writeFileSync(path, readFileSync(path, "utf8").replaceAll(DEFAULT_DATAPACK_ID, datapackId).replaceAll(DEFAULT_DATAPACK, datapack));
}

console.log(`Workspace at ${target}: the starter order service, agents pointed at datapack "${datapack}" (${datapackId}).
Next:
  1. Set MEKO_DATAPACK_NAME=${datapack} in console/.env and restart the console.
  2. Run \`npm install\` in ${target}, then open it in Kiro.
  3. After the run: npm run verify:kiro (from ${target})`);
