// Two refunded orders with very different stories. Nothing in the data says which is which.
export async function seed(orders) {
  const a = await orders.place({ customer: "c-1042", items: [{ sku: "KETTLE-01", qty: 1, price: 64 }] });
  await orders.act(a.id, "pay");
  await orders.act(a.id, "ship", { carrier: "DHL" });
  await orders.act(a.id, "refund"); // lid cracked in transit

  const b = await orders.place({ customer: "c-2210", items: [{ sku: "HEADSET-PRO", qty: 2, price: 129 }] });
  await orders.act(b.id, "pay");
  await orders.act(b.id, "refund"); // card reported stolen

  const c = await orders.place({ customer: "c-0387", items: [{ sku: "MUG-SET", qty: 4, price: 12 }] });
  await orders.act(c.id, "cancel");

  const d = await orders.place({ customer: "c-1120", items: [{ sku: "LAMP-ARC", qty: 1, price: 89 }] });
  await orders.act(d.id, "pay");
}
