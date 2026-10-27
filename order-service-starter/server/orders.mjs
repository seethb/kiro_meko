import { randomUUID } from "node:crypto";

// Which status each action may start from, and the status it sets.
const TRANSITIONS = {
  pay: { from: ["PLACED"], to: "PAID" },
  ship: { from: ["PAID"], to: "SHIPPED" },
  cancel: { from: ["PLACED", "PAID"], to: "CANCELLED" },
  refund: { from: ["PAID", "SHIPPED"], to: "REFUNDED" },
};

export class RuleError extends Error {
  constructor(message, status = 409) {
    super(message);
    this.status = status;
  }
}

export function memoryStore() {
  const rows = new Map();
  return {
    kind: "memory",
    async insert(order) {
      rows.set(order.id, order);
      return order;
    },
    async get(id) {
      return rows.get(id) ?? null;
    },
    async update(id, fields) {
      const next = { ...rows.get(id), ...fields, updatedAt: new Date().toISOString() };
      rows.set(id, next);
      return next;
    },
    async list() {
      return [...rows.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },
  };
}

export async function ysqlStore(connectionString) {
  const { default: pg } = await import("pg");
  const pool = new pg.Pool({ connectionString, max: 8 });
  const row = (r) => r && {
    id: r.id,
    customer: r.customer,
    items: r.items,
    total: Number(r.total),
    status: r.status,
    carrier: r.carrier ?? undefined,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
  return {
    kind: "ysql",
    async insert(o) {
      const { rows } = await pool.query(
        "INSERT INTO orders (id, customer, items, total, status) VALUES ($1, $2, $3, $4, $5) RETURNING *",
        [o.id, o.customer, JSON.stringify(o.items), o.total, o.status],
      );
      return row(rows[0]);
    },
    async get(id) {
      const { rows } = await pool.query("SELECT * FROM orders WHERE id = $1", [id]);
      return row(rows[0]);
    },
    async update(id, fields) {
      const { rows } = await pool.query(
        "UPDATE orders SET status = $2, carrier = COALESCE($3, carrier), updated_at = now() WHERE id = $1 RETURNING *",
        [id, fields.status, fields.carrier ?? null],
      );
      return row(rows[0]);
    },
    async list() {
      const { rows } = await pool.query("SELECT * FROM orders ORDER BY created_at DESC LIMIT 100");
      return rows.map(row);
    },
  };
}

export function orderService(store) {
  return {
    async place({ customer, items }) {
      if (!customer || !Array.isArray(items) || !items.length) {
        throw new RuleError("customer and at least one item are required", 400);
      }
      const now = new Date().toISOString();
      return store.insert({
        id: randomUUID(),
        customer,
        items,
        total: items.reduce((sum, i) => sum + i.qty * i.price, 0),
        status: "PLACED",
        createdAt: now,
        updatedAt: now,
      });
    },
    // Overwrites the status. Who did it, and why, is not kept anywhere.
    async act(id, action, { carrier } = {}) {
      const order = await store.get(id);
      if (!order) throw new RuleError("order not found", 404);
      const t = TRANSITIONS[action];
      if (!t.from.includes(order.status)) throw new RuleError(`cannot ${action} an order that is ${order.status}`);
      return store.update(id, { status: t.to, carrier });
    },
    get: (id) => store.get(id),
    list: () => store.list(),
  };
}
