// End-to-end against live Meko, in its own datapack so the demo one stays clean:
// Kiro writes a decision; a different client finds it, with the rejected option
// and the reason, attributed to Kiro.
//
//   MEKO_API_KEY=... npm run test:live
import assert from "node:assert/strict";

process.env.MEKO_DATAPACK_NAME = process.env.MEKO_LIVE_DATAPACK || "kiro-order-service-livetest";
const meko = await import("../server/meko.mjs");
const { formatRecord, parseRecord } = await import("../server/records.mjs");
const { SCENES } = await import("../server/rehearsal.mjs");

meko.wire.on("done", (d) => d.error && console.error("  ✗", d.error));
const step = (s) => console.log(`• ${s}`);

const dp = await meko.ensureDatapack();
step(`datapack ${dp.name} (${dp.id})`);

const { agentId, record } = SCENES[0];
const added = await meko.addMemory(agentId, formatRecord(record), { kind: record.kind, ref: record.ref, source: "console-rehearsal" });
const stored = added.results?.[0];
assert.ok(stored?.id, "memory_add returned an id");
step(`${agentId} stored ${record.ref} as ${stored.id} (event ${stored.event})`);

const asker = "cursor:order-service";
const found = await meko.searchMemory(asker, "How should I add order history? Can we use CDC on the orders table?", 5);
const hit = (found.results ?? []).find((r) => parseRecord(r.memory)?.ref === record.ref);
assert.ok(hit, `${asker} found ${record.ref}`);
const r = parseRecord(hit.memory);
assert.equal(hit.agent_id, agentId, "attributed to the writer");
assert.match(r.rejected[0].option, /CDC/, "rejected option came back");
assert.match(r.rejected[0].why, /intent/, "the reason came back");
step(`${asker} retrieved ${r.ref} written by ${hit.agent_id}, score ${hit.score.toFixed(2)}`);
step(`  rejected: ${r.rejected[0].option} — ${r.rejected[0].why.slice(0, 80)}…`);

console.log("\nlive test passed");
