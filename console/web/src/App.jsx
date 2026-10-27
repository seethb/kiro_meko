import { useCallback, useEffect, useRef, useState } from "react";
import { get, post, useWire } from "./api.js";
import Record from "./Record.jsx";

const AGENTS = [
  { id: "claude_code:order-service", label: "Claude Code" },
  { id: "cursor:order-service", label: "Cursor" },
  { id: "codex:order-service", label: "Codex" },
  { id: "kiro:order-service", label: "Kiro" },
];
const POLL_MS = 5000;

export default function App() {
  const [status, setStatus] = useState(null);
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState("records");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null);
  const [wire, clearWire] = useWire();
  const seen = useRef(null);

  const loadTrail = useCallback(async () => {
    const { entries } = await get("/api/trail");
    // Highlight what arrived since the last poll: that's the agent writing live.
    const before = seen.current;
    seen.current = new Set(entries.map((e) => e.id));
    setEntries(entries.map((e) => ({ ...e, fresh: before && !before.has(e.id) })));
  }, []);

  useEffect(() => {
    get("/api/status")
      .then((s) => {
        setStatus(s);
        if (s.configured) return loadTrail();
      })
      .catch((e) => setError(e.message));
  }, [loadTrail]);

  useEffect(() => {
    if (!status?.configured) return;
    const t = setInterval(() => loadTrail().catch(() => {}), POLL_MS);
    return () => clearInterval(t);
  }, [status, loadTrail]);

  const run = async (label, fn) => {
    setBusy(label);
    setError(null);
    try {
      await fn();
      await loadTrail();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(null);
    }
  };

  const promote = (entry) => run("promote", () => post("/api/promote", { agentId: entry.agentId, ids: [entry.id] }));

  const shown = entries.filter((e) => (filter === "records" ? e.record : true));
  const counts = {
    decisions: entries.filter((e) => e.record?.kind === "decision").length,
    lessons: entries.filter((e) => e.record?.kind === "lesson").length,
    tools: new Set(entries.filter((e) => e.record).map((e) => e.tool)).size,
  };

  if (status && !status.configured) return <Setup />;

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">
          <div className="mark">◆</div>
          <div>
            <h1>Decision Trail</h1>
            <p>What every agent decided in <span className="mono">order-service</span>, and why. Live from Meko.</p>
          </div>
        </div>
        <div className="stats">
          <Stat n={counts.decisions} l="decisions" />
          <Stat n={counts.lessons} l="lessons" />
          <Stat n={counts.tools} l="tools writing" />
          {status?.datapack && (
            <div className="dp">
              <span className="live" /> datapack <span className="mono">{status.datapack.name}</span>
            </div>
          )}
        </div>
      </header>

      {error && <div className="error" onClick={() => setError(null)}>{error}</div>}

      <main className="cols">
        <section className="col trail">
          <div className="col-head">
            <h2>The trail</h2>
            <div className="seg">
              <button className={filter === "records" ? "on" : ""} onClick={() => setFilter("records")}>Decisions &amp; lessons</button>
              <button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>All memories</button>
            </div>
          </div>
          <div className="scroll">
            {!status && <p className="dim pad">Connecting to Meko…</p>}
            {status && !shown.length && (
              <div className="empty">
                <p>No decisions yet.</p>
                <p className="dim">Make a design decision in Kiro: it appears here within {POLL_MS / 1000} seconds of the agent's <span className="mono">memory_add</span>.</p>
              </div>
            )}
            {shown.map((e) => <Record key={e.id} entry={e} onPromote={promote} busy={!!busy} />)}
          </div>
          <Rehearsal run={run} busy={busy} />
        </section>

        <Ask />

        <Wire items={wire} clear={clearWire} />
      </main>
    </div>
  );
}

function Stat({ n, l }) {
  return (
    <div className="stat">
      <div className="n">{n}</div>
      <div className="l">{l}</div>
    </div>
  );
}

// What a second client's agent sees before it suggests anything.
function Ask() {
  const [agentId, setAgentId] = useState(AGENTS[0].id);
  const [question, setQuestion] = useState("");
  const [presets, setPresets] = useState([]);
  const [answer, setAnswer] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    get("/api/rehearsal").then((r) => setPresets(r.questions)).catch(() => {});
  }, []);

  const ask = async (q = question, a = agentId) => {
    if (!q.trim()) return;
    setQuestion(q);
    setAgentId(a);
    setBusy(true);
    setError(null);
    try {
      setAnswer(await post("/api/ask", { agentId: a, question: q }));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="col ask">
      <div className="col-head">
        <h2>Ask as another agent</h2>
      </div>
      <p className="dim small">
        The same two calls the steering file tells every agent to make before it designs anything:
        <span className="mono"> memory_search</span> (your memories, from any tool) and
        <span className="mono"> knowledgebase_search</span> (decisions promoted to the team).
      </p>
      <form className="askbox" onSubmit={(e) => { e.preventDefault(); ask(); }}>
        <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
          {AGENTS.map((a) => <option key={a.id} value={a.id}>as {a.label}</option>)}
        </select>
        <input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="How should I add order history?" />
        <button className="btn primary" disabled={busy}>{busy ? "Searching…" : "Ask"}</button>
      </form>
      <div className="presets">
        {presets.map((p) => (
          <button key={p.q} className="preset" onClick={() => ask(p.q, p.agentId)}>
            <span className="dim">scene {p.scene}</span> {p.q}
          </button>
        ))}
      </div>
      {error && <div className="error">{error}</div>}
      <div className="scroll">
        {answer && (
          <>
            <Bucket title="Your memories" hint="memory_search · any client you use" items={answer.memory} />
            <Bucket title="Team knowledge" hint="knowledgebase_search · promoted, visible to everyone on the datapack" items={answer.shared} />
          </>
        )}
      </div>
    </section>
  );
}

function Bucket({ title, hint, items }) {
  return (
    <div className="bucket">
      <div className="bucket-head">
        <strong>{title}</strong> <span className="dim small mono">{hint}</span>
      </div>
      {!items.length && <p className="dim small pad">Nothing relevant.</p>}
      {items.map((e) => <Record key={`${e.source}-${e.id}`} entry={e} compact />)}
    </div>
  );
}

function Rehearsal({ run, busy }) {
  const [open, setOpen] = useState(false);
  const [scenes, setScenes] = useState([]);
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    if (open && !scenes.length) get("/api/rehearsal").then((r) => { setScenes(r.scenes); setEnabled(r.enabled); });
  }, [open, scenes.length]);
  return (
    <div className={`rehearsal ${open ? "open" : ""}`}>
      <button className="btn ghost sm" onClick={() => setOpen(!open)}>{open ? "▾" : "▸"} Dry-run writes</button>
      {open && (
        <>
          <p className="small dim">
            Writes the records the demo expects, so you can rehearse the retrieval scenes. They are tagged
            <span className="chip warn">rehearsal</span> in their text. Never record these: in the video, Kiro and the second client must write their own.
          </p>
          {!enabled && <p className="small dim">Off. Start the console with <span className="mono">REHEARSAL=1</span> to enable them, and never in a datapack you're using to test capture.</p>}
          {enabled && scenes.map((s) => (
            <button key={s.record.ref} className="btn sm" disabled={!!busy} onClick={() => run(s.record.ref, () => post(`/api/rehearsal/${s.record.ref}`))}>
              Scene {s.scene}: {s.record.ref} as {s.agentId.split(":")[0]}
            </button>
          ))}
        </>
      )}
    </div>
  );
}

function Wire({ items, clear }) {
  return (
    <aside className="col wire">
      <div className="col-head">
        <h2>MCP wire</h2>
        <button className="btn ghost sm" onClick={clear}>Clear</button>
      </div>
      <p className="dim small">Every Meko tool call this console makes, as sent.</p>
      <div className="scroll">
        {items.map((i) => (
          <div key={i.id} className={`call ${i.error ? "bad" : ""} ${i.finished ? "" : "pending"}`}>
            <div className="row">
              <span className="mono t">{i.tool}</span>
              <span className="grow" />
              {i.ms != null && <span className="dim mono">{i.ms} ms</span>}
            </div>
            <div className="mono kv">→ {Object.entries(i.args).map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`).join("  ·  ")}</div>
            {(i.result || i.error) && <div className="mono kv res">← {i.error ?? i.result}</div>}
          </div>
        ))}
      </div>
    </aside>
  );
}

function Setup() {
  return (
    <div className="setup">
      <h1>Connect the console to Meko</h1>
      <ol>
        <li>Copy <span className="mono">.env.example</span> to <span className="mono">.env</span>.</li>
        <li>Set <span className="mono">MEKO_API_KEY</span> to a key for the same Meko account Kiro signs in with.</li>
        <li>Restart with <span className="mono">npm run demo</span>.</li>
      </ol>
    </div>
  );
}
