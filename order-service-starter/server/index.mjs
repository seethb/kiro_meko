import express from "express";
import { memoryStore, orderService, ysqlStore } from "./orders.mjs";
import { seed } from "./seed.mjs";

const PORT = Number(process.env.PORT || 7841);
const store = process.env.DATABASE_URL ? await ysqlStore(process.env.DATABASE_URL) : memoryStore();
const orders = orderService(store);
if (store.kind === "memory") await seed(orders);

const app = express();
app.use(express.json());

const handle = (fn) => async (req, res) => {
  try {
    res.json(await fn(req));
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
};

app.get("/api/meta", (_req, res) => res.json({ store: store.kind }));
app.get("/api/orders", handle(() => orders.list()));
app.post("/api/orders", handle((req) => orders.place(req.body)));
app.get("/api/orders/:id", handle((req) => orders.get(req.params.id)));
for (const action of ["pay", "ship", "cancel", "refund"]) {
  app.post(`/api/orders/:id/${action}`, handle((req) => orders.act(req.params.id, action, req.body)));
}

app.use(express.static(new URL("../dist", import.meta.url).pathname));

app.listen(PORT, () => console.log(`order-service API on http://localhost:${PORT} (${store.kind} store)`));
