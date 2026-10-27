// Live MCP client for Meko over streamable HTTP. Every tools/call is a single
// JSON-RPC POST; the reply is one SSE `event: message` frame. Every call is
// also published on the wire so the console can show the real tool traffic.

import { randomUUID } from "node:crypto";
import { EventEmitter } from "node:events";
import "./env.mjs";

export const wire = new EventEmitter();

const URL = process.env.MEKO_MCP_URL || "https://mcp.mekodata.ai/mcp";
const KEY = process.env.MEKO_API_KEY;
const DATAPACK_NAME = process.env.MEKO_DATAPACK_NAME || "kiro-order-service";

let rpcId = 0;
let callId = 0;

function parseSse(text) {
  const frames = text
    .split("\n")
    .filter((l) => l.startsWith("data:"))
    .map((l) => l.slice(5).trim())
    .filter(Boolean);
  if (!frames.length) {
    // Some deployments answer plain JSON instead of SSE.
    return JSON.parse(text);
  }
  return JSON.parse(frames[frames.length - 1]);
}

// Meko wraps each payload twice: the MCP text frame holds JSON whose `result`
// is itself a JSON string. Unwrap both so callers see the real document.
function unwrap(rpc) {
  if (rpc.error) throw new Error(`Meko JSON-RPC error: ${JSON.stringify(rpc.error)}`);
  const text = rpc.result?.content?.[0]?.text;
  if (text === undefined) return rpc.result;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = text;
  }
  if (parsed && typeof parsed === "object" && typeof parsed.result === "string") {
    try {
      parsed = JSON.parse(parsed.result);
    } catch {
      parsed = parsed.result;
    }
  }
  if (rpc.result.isError || parsed?.error) {
    const msg = typeof parsed === "string" ? parsed : parsed.detail || parsed.error;
    throw new Error(`Meko ${msg}`);
  }
  return parsed;
}

export const configured = () => Boolean(KEY);

export async function call(tool, args = {}) {
  if (!KEY) throw new Error("MEKO_API_KEY is not set. Copy .env.example to .env and add your key.");
  const id = ++callId;
  const started = Date.now();
  wire.emit("call", { id, tool, args: summarize(args), at: new Date().toISOString() });
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${KEY}`,
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: ++rpcId, method: "tools/call", params: { name: tool, arguments: args } }),
    });
    const text = await res.text();
    if (!res.ok) throw new Error(`Meko HTTP ${res.status}: ${text.slice(0, 200)}`);
    const result = unwrap(parseSse(text));
    wire.emit("done", { id, ms: Date.now() - started, result: describe(result) });
    return result;
  } catch (err) {
    wire.emit("done", { id, ms: Date.now() - started, error: err.message });
    throw err;
  }
}

// Keep the wire readable: long strings are trimmed, ids are shortened.
function summarize(args) {
  const out = {};
  for (const [k, v] of Object.entries(args)) {
    if (v === undefined || k === "conversation_id") continue;
    if (k === "datapack_id") out[k] = `${String(v).slice(0, 8)}…`;
    else if (typeof v === "string" && v.length > 140) out[k] = `${v.slice(0, 140)}…`;
    else out[k] = v;
  }
  return out;
}

function describe(r) {
  if (!r || typeof r !== "object") return String(r).slice(0, 120);
  if (Array.isArray(r.results)) return `${r.results.length} result(s)`;
  if (Array.isArray(r.memories)) return `${r.memories.length} memories`;
  if (Array.isArray(r.promoted_memories)) return `${r.promoted_memories.length} promoted`;
  if (Array.isArray(r.inserted_ids)) return `promoted ${r.inserted_ids.length}`;
  if (r.datapack_id) return `datapack ${r.name ?? r.datapack_id.slice(0, 8)}`;
  if (r.id) return `id ${String(r.id).slice(0, 8)}…`;
  return Object.keys(r).slice(0, 4).join(", ");
}

// ---- datapack and conversations ------------------------------------------

let datapack; // { id, name }

// Find the datapack by name, creating it on first run. conversation_create
// needs a datapack id, so the lookup itself uses a throwaway trace id.
export async function ensureDatapack() {
  if (datapack) return datapack;
  const trace = randomUUID();
  const found = await call("datapack_search", { name: DATAPACK_NAME, conversation_id: trace });
  const id =
    found.datapacks?.[0]?.datapack_id ??
    (await call("datapack_create", { name: DATAPACK_NAME, conversation_id: trace })).datapack_id;
  datapack = { id, name: DATAPACK_NAME };
  return datapack;
}

// One conversation per agent identity. Cache the promise, not the id, so
// concurrent first calls for the same agent share one conversation.
const conversations = new Map();

export function conversationFor(agentId) {
  if (!conversations.has(agentId)) {
    const pending = ensureDatapack()
      .then((dp) => call("conversation_create", { agent_id: agentId, datapack_id: dp.id, title: `${agentId} · order-service` }))
      .then((c) => c.id)
      .catch((err) => {
        conversations.delete(agentId);
        throw err;
      });
    conversations.set(agentId, pending);
  }
  return conversations.get(agentId);
}

async function scoped(agentId) {
  const [dp, conversationId] = await Promise.all([ensureDatapack(), conversationFor(agentId)]);
  return { datapack_id: dp.id, conversation_id: conversationId, agent_id: agentId };
}

// ---- the five calls the demo is built on ----------------------------------

export async function addMemory(agentId, text, metadata) {
  return call("memory_add", { ...(await scoped(agentId)), text, metadata: JSON.stringify(metadata) });
}

export async function searchMemory(agentId, query, limit = 6) {
  return call("memory_search", { ...(await scoped(agentId)), query, limit });
}

export async function searchKnowledge(agentId, query, limit = 6) {
  return call("knowledgebase_search", { ...(await scoped(agentId)), query, limit });
}

export async function listMemories(promoted = false) {
  return call("memory_get_all", { ...(await scoped("console:order-service")), promoted });
}

export async function promote(agentId, memoryIds) {
  return call("memory_promote", { ...(await scoped(agentId)), memory_ids: memoryIds });
}

export async function describeDatapack() {
  const s = await scoped("console:order-service");
  return call("datapack_describe", { datapack_id: s.datapack_id, conversation_id: s.conversation_id, include_status: true });
}
