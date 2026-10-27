import { ago, toolLabel } from "./api.js";

// One decision or lesson, with the reasoning laid out the way it was stored.
export default function Record({ entry, compact, onPromote, busy }) {
  const r = entry.record;
  const tool = toolLabel(entry.tool);
  return (
    <article className={`rec ${r?.kind ?? "note"} ${entry.fresh ? "fresh" : ""}`}>
      <header>
        {r ? <span className={`ref ${r.kind}`}>{r.ref}</span> : <span className="ref note">note</span>}
        <span className={`tool ${tool.cls}`}>{tool.label}</span>
        {entry.rehearsal && <span className="chip warn" title="Written by the console for a dry run, not by an agent">rehearsal</span>}
        {entry.source === "shared" || entry.shared ? <span className="chip ok">team</span> : <span className="chip">private</span>}
        <span className="grow" />
        {entry.score != null && <span className="dim mono">{entry.score.toFixed(2)}</span>}
        {entry.createdAt && <span className="dim">{ago(entry.createdAt)}</span>}
      </header>
      <h3>{r?.title ?? entry.text}</h3>
      {r && !compact && (
        <dl>
          {r.chosen && (<><dt>Chosen</dt><dd>{r.chosen}</dd></>)}
          {r.finding && (<><dt>Finding</dt><dd>{r.finding}</dd></>)}
          {r.do && (<><dt>Do</dt><dd>{r.do}</dd></>)}
          {r.rejected.map((x, i) => (
            <div key={i} className="rejected">
              <dt>Rejected</dt>
              <dd><strong>{x.option}</strong>{x.why && <> — {x.why}</>}</dd>
            </div>
          ))}
          {r.consequences && (<><dt>Consequences</dt><dd>{r.consequences}</dd></>)}
        </dl>
      )}
      {r && compact && r.rejected[0] && (
        <p className="why">Rejected <strong>{r.rejected[0].option}</strong>: {r.rejected[0].why}</p>
      )}
      {r && compact && r.do && <p className="why">{r.do}</p>}
      <footer>
        <span className="dim mono">{entry.agentId}</span>
        {entry.author && <span className="dim"> · {entry.author}</span>}
        {onPromote && !entry.shared && (
          <button className="btn sm" disabled={busy} onClick={() => onPromote(entry)} title="memory_promote: move into the datapack's shared knowledge, readable by the whole team. One-way.">
            Share with team
          </button>
        )}
      </footer>
    </article>
  );
}
