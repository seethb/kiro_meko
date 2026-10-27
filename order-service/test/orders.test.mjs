import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStore } from "../server/eventStore.mjs";
import { orderService } from "../server/orders.mjs";

const placed = async (orders) =>
  orders.place({ customer: "c-1", items: [{ sku: "A", qty: 2, price: 10 }] });

test("state is a fold over the events, and history keeps the reason", async () => {
  const orders = orderService(memoryStore());
  const { state } = await placed(orders);
  await orders.act(state.id, "pay", { actor: "payments" });
  await orders.act(state.id, "refund", { actor: "support:sam", reasonCode: "PRICE_ERROR", note: "Listed at 10, should be 8" });

  const now = await orders.get(state.id);
  assert.equal(now.status, "REFUNDED");
  assert.equal(now.refunded, 20);
  const history = await orders.history(state.id);
  assert.deepEqual(history.map((e) => e.type), ["OrderPlaced", "OrderPaid", "OrderRefunded"]);
  assert.equal(history[2].reasonCode, "PRICE_ERROR");
});

test("a refund needs a known reason code", async () => {
  const orders = orderService(memoryStore());
  const { state } = await placed(orders);
  await orders.act(state.id, "pay", { actor: "payments" });
  await assert.rejects(orders.act(state.id, "refund", { actor: "x", reasonCode: "BECAUSE" }), { status: 400 });
});

test("two concurrent refunds: one wins, the other is re-checked and refused with 409 (L-001)", async () => {
  const orders = orderService(memoryStore());
  const { state } = await placed(orders);
  await orders.act(state.id, "pay", { actor: "payments" });

  const results = await Promise.allSettled([
    orders.act(state.id, "refund", { actor: "support:a", reasonCode: "CUSTOMER_REQUEST" }),
    orders.act(state.id, "refund", { actor: "support:b", reasonCode: "CUSTOMER_REQUEST" }),
  ]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const failed = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1);
  assert.equal(failed.length, 1);
  assert.equal(failed[0].reason.status, 409);
  assert.equal((await orders.history(state.id)).length, 3);
});

test("a conflict with a change that keeps the command valid is retried, not surfaced (L-001)", async () => {
  const store = memoryStore();
  const orders = orderService(store);
  const { state } = await placed(orders);
  await orders.act(state.id, "pay", { actor: "payments" });

  // The warehouse ships the order between the refund's load and its append.
  const realLoad = store.load;
  store.load = async (id) => {
    const events = await realLoad(id);
    store.load = realLoad;
    await store.append(id, { type: "OrderShipped", actor: "wh", version: events.length + 1, payload: { carrier: "DHL" } });
    return events;
  };
  const result = await orders.act(state.id, "refund", { actor: "support:a", reasonCode: "DAMAGED_IN_TRANSIT" });
  assert.equal(result.attempts, 2);
  assert.deepEqual((await orders.history(state.id)).map((e) => e.type), ["OrderPlaced", "OrderPaid", "OrderShipped", "OrderRefunded"]);
});
