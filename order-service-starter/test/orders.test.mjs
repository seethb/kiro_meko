import { test } from "node:test";
import assert from "node:assert/strict";
import { memoryStore, orderService } from "../server/orders.mjs";

const placed = (orders) => orders.place({ customer: "c-1", items: [{ sku: "A", qty: 2, price: 10 }] });

test("an order moves through its statuses", async () => {
  const orders = orderService(memoryStore());
  const o = await placed(orders);
  await orders.act(o.id, "pay");
  const shipped = await orders.act(o.id, "ship", { carrier: "UPS" });
  assert.equal(shipped.status, "SHIPPED");
  assert.equal(shipped.carrier, "UPS");
});

test("invalid transitions are refused with 409", async () => {
  const orders = orderService(memoryStore());
  const o = await placed(orders);
  await assert.rejects(orders.act(o.id, "ship"), { status: 409 });
});

test("a refund overwrites the status and keeps nothing else", async () => {
  const orders = orderService(memoryStore());
  const o = await placed(orders);
  await orders.act(o.id, "pay");
  const refunded = await orders.act(o.id, "refund");
  assert.equal(refunded.status, "REFUNDED");
  assert.deepEqual(Object.keys(refunded).sort(), ["carrier", "createdAt", "customer", "id", "items", "status", "total", "updatedAt"]);
});
