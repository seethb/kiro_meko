// The order aggregate: state is a fold over events (ADR-001), and each command
// checks its rule against that state before producing the next event.

export const REASON_CODES = [
  "CUSTOMER_REQUEST",
  "DAMAGED_IN_TRANSIT",
  "FRAUD_REVIEW",
  "OUT_OF_STOCK",
  "DUPLICATE_ORDER",
  "PRICE_ERROR",
];

export class RuleError extends Error {
  constructor(message) {
    super(message);
    this.status = 409;
  }
}

export class InputError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
  }
}

const EMPTY = { status: "NEW", version: 0, total: 0, refunded: 0 };

export function fold(events) {
  return events.reduce(apply, EMPTY);
}

function apply(s, e) {
  const next = { ...s, version: e.version, updatedAt: e.recordedAt };
  switch (e.type) {
    case "OrderPlaced":
      return {
        ...next,
        id: e.orderId,
        status: "PLACED",
        customer: e.payload.customer,
        items: e.payload.items,
        total: e.payload.items.reduce((sum, i) => sum + i.qty * i.price, 0),
        placedAt: e.recordedAt,
      };
    case "OrderPaid":
      return { ...next, status: "PAID" };
    case "OrderShipped":
      return { ...next, status: "SHIPPED", carrier: e.payload.carrier };
    case "OrderCancelled":
      return { ...next, status: "CANCELLED" };
    case "OrderRefunded":
      return { ...next, status: "REFUNDED", refunded: s.refunded + e.payload.amount };
    default:
      return next;
  }
}

function requireReason(reasonCode) {
  if (!REASON_CODES.includes(reasonCode)) {
    throw new InputError(`reasonCode must be one of ${REASON_CODES.join(", ")}`);
  }
}

function requireStatus(state, allowed, action) {
  if (!allowed.includes(state.status)) {
    throw new RuleError(`cannot ${action} an order that is ${state.status}`);
  }
}

// Each command returns the event to append, or throws. It never touches storage.
export const commands = {
  place(state, { customer, items, actor }) {
    if (state.status !== "NEW") throw new RuleError("order already exists");
    if (!customer || !Array.isArray(items) || items.length === 0) {
      throw new InputError("customer and at least one item are required");
    }
    for (const i of items) {
      if (!i.sku || !(i.qty > 0) || !(i.price >= 0)) throw new InputError("each item needs sku, qty > 0, price >= 0");
    }
    return { type: "OrderPlaced", actor: actor || customer, payload: { customer, items } };
  },
  pay(state, { actor }) {
    requireStatus(state, ["PLACED"], "pay");
    return { type: "OrderPaid", actor, payload: { amount: state.total } };
  },
  ship(state, { actor, carrier }) {
    requireStatus(state, ["PAID"], "ship");
    return { type: "OrderShipped", actor, payload: { carrier: carrier || "UNSPECIFIED" } };
  },
  cancel(state, { actor, reasonCode, note }) {
    requireStatus(state, ["PLACED", "PAID"], "cancel");
    requireReason(reasonCode);
    return { type: "OrderCancelled", actor, reasonCode, note, payload: {} };
  },
  refund(state, { actor, reasonCode, note, amount }) {
    requireStatus(state, ["PAID", "SHIPPED"], "refund");
    requireReason(reasonCode);
    const value = amount ?? state.total - state.refunded;
    if (!(value > 0) || value > state.total - state.refunded) throw new InputError("refund amount out of range");
    return { type: "OrderRefunded", actor, reasonCode, note, payload: { amount: value } };
  },
};
