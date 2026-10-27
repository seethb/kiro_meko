import express from "express";
import * as meko from "./meko.mjs";
import { formatRecord, parseRecord, toolOf } from "./records.mjs";
import { QUESTIONS, SCENES } from "./rehearsal.mjs";

const PORT = Number(process.env.PORT || 7840);
const app = express();
app.use(express.json());

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: err.message });
  }
};

// ---- the wire: every Meko call, streamed to the browser --------------------

app.get("/api/wire", (req, res) => {
  res.set({ "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" });
  res.flushHeaders();
  const send = (type) => (data) => res.write(`event: ${type}\ndata: ${JSON.stringify(data)}\n\n`);
  const onCall = send("call");
  const onDone = send("done");
  meko.wire.on("call", onCall);
  meko.wire.on("done", onDone);
  const ping = setInterval(() => res.write(": ping\n\n"), 20000);
  req.on("close", () => {
    clearInterval(ping);
    meko.wire.off("call", onCall);
    meko.wire.off("done", onDone);
  });
});

// ---- status ---------------------------------------------------------------

app.get(
  "/api/status",
  handle(async () => {
    if (!meko.configured()) return { configured: false };
    const dp = await meko.ensureDatapack();
    const d = await meko.describeDatapack();
    return {
      configured: true,
      datapack: dp,
      memoryCount: d.memory_count ?? null,
      collectiveCount: d.collective_memory_count ?? null,
    };
  }),
);

// ---- the trail: every decision and lesson in the datapack -----------------
//
// Private memories are scoped to the signed-in Meko user (any client they
// use). Promoted memories are the datapack's shared knowledge, visible to the
// whole team. Both are listed; anything not in the DECISION/LESSON format is
// shown as a plain note.

const toEntry = (m, promoted) => {
  const text = m.data ?? m.memory ?? "";
  return {
    id: m.id,
    text,
    record: parseRecord(text),
    agentId: m.agent_id,
    tool: toolOf(m.agent_id),
    author: promoted ? m.promoted_by_name : m.user_name,
    createdAt: m.created_at,
    promotedAt: m.promoted_to_kb_at ?? null,
    shared: promoted,
    mine: promoted ? undefined : m.is_mine,
    rehearsal: text.includes("console-rehearsal"),
  };
};

app.get(
  "/api/trail",
  handle(async () => {
    const [mine, shared] = await Promise.all([meko.listMemories(false), meko.listMemories(true)]);
    const entries = [
      ...(mine.memories ?? []).map((m) => toEntry(m, false)),
      ...(shared.promoted_memories ?? []).map((m) => toEntry(m, true)),
    ];
    entries.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return { entries };
  }),
);

// ---- ask as another agent ---------------------------------------------------
//
// What a second client's agent does before it suggests anything: search the
// signed-in user's memories and the team's promoted knowledge, in parallel.

app.post(
  "/api/ask",
  handle(async (req) => {
    const { agentId, question } = req.body;
    if (!agentId || !question) throw new Error("agentId and question are required");
    const [mem, kb] = await Promise.all([
      meko.searchMemory(agentId, question, 5),
      meko.searchKnowledge(agentId, question, 5),
    ]);
    const memory = (mem.results ?? []).map((r) => ({
      id: r.id,
      text: r.memory,
      record: parseRecord(r.memory),
      tool: toolOf(r.agent_id),
      agentId: r.agent_id,
      score: r.score,
      createdAt: r.created_at,
      rehearsal: String(r.memory).includes("console-rehearsal"),
      source: "memory",
    }));
    const shared = (kb.results ?? [])
      .filter((r) => r.metadata_filters?.source === "memory")
      .map((r) => ({
        id: r.metadata_filters.memory_id ?? r.id,
        text: r.chunk_text,
        record: parseRecord(r.chunk_text),
        tool: toolOf(r.metadata_filters.agent_id),
        agentId: r.metadata_filters.agent_id,
        score: r.rerank_score,
        source: "shared",
      }));
    return { agentId, question, memory, shared };
  }),
);

// ---- writes ----------------------------------------------------------------

app.post(
  "/api/promote",
  handle(async (req) => meko.promote(req.body.agentId, req.body.ids)),
);

// Dry-run writes are off unless REHEARSAL=1: in a capture test, a rehearsal
// ADR-001 already in the datapack makes the agent (rightly) skip saving its own.
const REHEARSAL = process.env.REHEARSAL === "1";

app.get("/api/rehearsal", (_req, res) =>
  res.json({ enabled: REHEARSAL, scenes: SCENES.map((s) => ({ ...s, text: formatRecord(s.record) })), questions: QUESTIONS }),
);

app.post(
  "/api/rehearsal/:ref",
  handle(async (req) => {
    if (!REHEARSAL) throw new Error("Dry-run writes are off. Start the console with REHEARSAL=1 to enable them.");
    const s = SCENES.find((x) => x.record.ref === req.params.ref);
    if (!s) throw new Error(`no rehearsal record ${req.params.ref}`);
    const { record } = s;
    return meko.addMemory(s.agentId, formatRecord(record), {
      kind: record.kind,
      ref: record.ref,
      repo: record.repo,
      tool: s.agentId.split(":")[0],
      source: "console-rehearsal",
    });
  }),
);

app.use(express.static(new URL("../dist", import.meta.url).pathname));

app.listen(PORT, () => console.log(`Decision Trail console on http://localhost:${PORT}${meko.configured() ? "" : " (MEKO_API_KEY not set)"}`));
