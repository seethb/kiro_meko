import { useEffect, useState } from "react";

export async function get(path) {
  const res = await fetch(path);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

export async function post(path, body) {
  const res = await fetch(path, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
}

// The live MCP wire: one entry per Meko tool call, filled in when it returns.
export function useWire() {
  const [items, setItems] = useState([]);
  useEffect(() => {
    const es = new EventSource("/api/wire");
    es.addEventListener("call", (e) => {
      const c = JSON.parse(e.data);
      setItems((xs) => [c, ...xs].slice(0, 80));
    });
    es.addEventListener("done", (e) => {
      const d = JSON.parse(e.data);
      setItems((xs) => xs.map((x) => (x.id === d.id ? { ...x, ...d, finished: true } : x)));
    });
    return () => es.close();
  }, []);
  return [items, () => setItems([])];
}

export const TOOLS = {
  kiro: { label: "Kiro", cls: "kiro" },
  claude_code: { label: "Claude Code", cls: "claude" },
  cursor: { label: "Cursor", cls: "cursor" },
  codex: { label: "Codex", cls: "codex" },
  console: { label: "Console", cls: "muted" },
};
export const toolLabel = (t) => TOOLS[t] ?? { label: t, cls: "muted" };

export const ago = (iso) => {
  if (!iso) return "";
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString([], { day: "numeric", month: "short" });
};
