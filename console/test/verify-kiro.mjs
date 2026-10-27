// After a dry run: did Kiro (or another real client) write to the datapack, in
// the agreed format, and can a different client find it?
//
//   MEKO_DATAPACK_NAME=kiro-dryrun-1 npm run verify:kiro
import * as meko from "../server/meko.mjs";
import { parseRecord, toolOf } from "../server/records.mjs";

const dp = await meko.ensureDatapack();
const [mine, shared] = await Promise.all([meko.listMemories(false), meko.listMemories(true)]);
const all = [
  ...(mine.memories ?? []).map((m) => ({ ...m, scope: "private" })),
  ...(shared.promoted_memories ?? []).map((m) => ({ ...m, scope: "team" })),
];

console.log(`Datapack ${dp.name} (${dp.id}): ${all.length} memories\n`);

const real = all.filter((m) => !String(m.data).includes("console-rehearsal"));
const rehearsal = all.length - real.length;
let failures = 0;
const check = (ok, msg) => {
  console.log(`  ${ok ? "✓" : "✗"} ${msg}`);
  if (!ok) failures++;
};

for (const m of real) {
  const r = parseRecord(m.data);
  console.log(`${m.scope.padEnd(7)} ${toolOf(m.agent_id).padEnd(12)} ${r ? `${r.ref} ${r.title}` : `(free text) ${String(m.data).slice(0, 70)}`}`);
  console.log(`        agent_id ${m.agent_id} · ${m.created_at}`);
  if (r) {
    if (r.kind === "decision") {
      check(Boolean(r.chosen), "has Chosen");
      check(r.rejected.length > 0 && r.rejected.every((x) => x.why), "has Rejected with a reason");
    } else {
      check(Boolean(r.finding && r.do), "has Finding and Do");
    }
  } else {
    check(false, "not in the DECISION/LESSON format from the steering file");
  }
}

const kiro = real.filter((m) => toolOf(m.agent_id) === "kiro" && parseRecord(m.data));
console.log("");
check(kiro.length > 0, `Kiro wrote ${kiro.length} record(s) itself (rehearsal records ignored: ${rehearsal})`);

if (!real.length) {
  console.log(`
Nothing real here. If Kiro said it saved a decision, it probably wrote to your default
datapack: the agent didn't pass datapack_id. Check Kiro's tool call for memory_add.`);
}

// Cross-tool retrieval of the first Kiro decision, from a different identity.
const first = kiro.find((m) => m.scope === "private");
if (first) {
  const r = parseRecord(first.data);
  const res = await meko.searchMemory("cursor:order-service", r.title, 5);
  check((res.results ?? []).some((x) => x.id === first.id), `cursor:order-service finds ${r.ref} by its title`);
}

console.log(failures ? `\n${failures} check(s) failed` : "\nall checks passed");
process.exit(failures ? 1 : 0);
