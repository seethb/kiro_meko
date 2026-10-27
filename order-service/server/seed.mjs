// A few orders for the support console, so the in-memory store isn't empty.
// Two of them end REFUNDED for different reasons: the case a status column can't explain.
export async function seed(orders) {
  const a = await orders.place({ customer: "c-1042", items: [{ sku: "KETTLE-01", qty: 1, price: 64 }] });
  await orders.act(a.state.id, "pay", { actor: "payments" });
  await orders.act(a.state.id, "ship", { actor: "warehouse-3", carrier: "DHL" });
  await orders.act(a.state.id, "refund", {
    actor: "support:priya",
    reasonCode: "DAMAGED_IN_TRANSIT",
    note: "Lid cracked on arrival; photo on ticket 88213.",
  });

  const b = await orders.place({ customer: "c-2210", items: [{ sku: "HEADSET-PRO", qty: 2, price: 129 }] });
  await orders.act(b.state.id, "pay", { actor: "payments" });
  await orders.act(b.state.id, "refund", {
    actor: "risk-engine",
    reasonCode: "FRAUD_REVIEW",
    note: "Card reported stolen before shipment.",
  });

  const c = await orders.place({ customer: "c-0387", items: [{ sku: "MUG-SET", qty: 4, price: 12 }] });
  await orders.act(c.state.id, "cancel", { actor: "c-0387", reasonCode: "CUSTOMER_REQUEST", note: "Ordered the wrong colour." });

  const d = await orders.place({ customer: "c-1120", items: [{ sku: "LAMP-ARC", qty: 1, price: 89 }] });
  await orders.act(d.state.id, "pay", { actor: "payments" });
}
