// Two event stores with one contract:
//   load(orderId)            -> events, oldest first
//   append(orderId, event)   -> stored event; throws ConflictError if
//                               event.version is already taken
// Optimistic concurrency comes from the (order_id, version) primary key.

export class ConflictError extends Error {
  constructor(orderId, version) {
    super(`order ${orderId} already has version ${version}`);
    this.retryable = true;
  }
}

export function memoryStore() {
  const streams = new Map();
  return {
    kind: "memory",
    async load(orderId) {
      return [...(streams.get(orderId) ?? [])];
    },
    async append(orderId, event) {
      const stream = streams.get(orderId) ?? [];
      if (stream.length + 1 !== event.version) throw new ConflictError(orderId, event.version);
      const stored = { ...event, orderId, recordedAt: new Date().toISOString() };
      streams.set(orderId, [...stream, stored]);
      return stored;
    },
    async list() {
      return [...streams.keys()];
    },
  };
}

const RETRYABLE_SQLSTATE = new Set(["23505", "40001"]);

export async function ysqlStore(connectionString) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString, max: 8 });
  const row = (r) => ({
    orderId: r.order_id,
    version: r.version,
    type: r.type,
    actor: r.actor,
    reasonCode: r.reason_code ?? undefined,
    note: r.note ?? undefined,
    payload: r.payload,
    recordedAt: r.recorded_at.toISOString(),
  });
  return {
    kind: "ysql",
    async load(orderId) {
      const { rows } = await pool.query("SELECT * FROM order_events WHERE order_id = $1 ORDER BY version", [orderId]);
      return rows.map(row);
    },
    async append(orderId, e) {
      try {
        const { rows } = await pool.query(
          `INSERT INTO order_events (order_id, version, type, actor, reason_code, note, payload)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [orderId, e.version, e.type, e.actor, e.reasonCode ?? null, e.note ?? null, e.payload],
        );
        return row(rows[0]);
      } catch (err) {
        // L-001: a lost race on the primary key (23505) or a serialization
        // failure under contention (40001) means "reload and try again".
        if (RETRYABLE_SQLSTATE.has(err.code)) throw new ConflictError(orderId, e.version);
        throw err;
      }
    },
    async list() {
      const { rows } = await pool.query(
        "SELECT order_id FROM order_events WHERE version = 1 ORDER BY recorded_at DESC LIMIT 100",
      );
      return rows.map((r) => r.order_id);
    },
  };
}
