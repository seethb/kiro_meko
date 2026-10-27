// Decision and lesson records. The text format is the contract between agents
// (see order-service/.kiro/steering/meko-decisions.md): it carries the whole
// reasoning, so any client reads it back without the original chat, and the
// console can parse it even where Meko returns no metadata.
//
//   DECISION ADR-1 · order-service · <title>
//   Chosen: ...
//   Rejected: <option> — <why>
//   Consequences: ...
//   Recorded by: kiro (spec: order-history)

const HEAD = /^(DECISION|LESSON)\s+([A-Z]+-\d+)\s*·\s*([^·]+?)\s*·\s*(.+)$/;
const FIELD = /^(Chosen|Rejected|Consequences|Finding|Do|Recorded by):\s*(.*)$/;

export function parseRecord(text) {
  const lines = String(text).split(/\n|(?=\s(?:Chosen|Rejected|Consequences|Finding|Do|Recorded by):)/).map((l) => l.trim()).filter(Boolean);
  const head = lines[0]?.match(HEAD);
  if (!head) return null;
  const rec = { kind: head[1].toLowerCase(), ref: head[2], repo: head[3], title: head[4], rejected: [] };
  for (const line of lines.slice(1)) {
    const m = line.match(FIELD);
    if (!m) continue;
    const [, key, value] = m;
    if (key === "Rejected") {
      const [option, ...why] = value.split(/\s+[—–-]\s+/);
      rec.rejected.push({ option: option.trim(), why: why.join(" — ").trim() });
    } else {
      rec[{ Chosen: "chosen", Consequences: "consequences", Finding: "finding", Do: "do", "Recorded by": "recordedBy" }[key]] = value;
    }
  }
  return rec;
}

export function formatRecord(r) {
  const head = `${r.kind === "lesson" ? "LESSON" : "DECISION"} ${r.ref} · ${r.repo} · ${r.title}`;
  const body =
    r.kind === "lesson"
      ? [`Finding: ${r.finding}`, `Do: ${r.do}`]
      : [`Chosen: ${r.chosen}`, ...r.rejected.map((x) => `Rejected: ${x.option} — ${x.why}`), `Consequences: ${r.consequences}`];
  return [head, ...body, `Recorded by: ${r.recordedBy}`].join("\n");
}

// "kiro:order-service" -> "kiro"; the client half of the agent id.
export const toolOf = (agentId = "") => agentId.split(":")[0] || "meko_agent";
