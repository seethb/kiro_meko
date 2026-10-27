import { useCallback, useEffect, useState } from "react";

const api = async (path, body) => {
  const res = await fetch(`/api${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};

const money = (n) => `$${n.toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });

export default function App() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => setOrders(await api("/orders")), []);
  useEffect(() => {
    api("/meta").then(setMeta);
    load();
  }, [load]);
  useEffect(() => {
    if (!selected && orders.length) setSelected(orders[0].id);
  }, [orders, selected]);

  const order = orders.find((o) => o.id === selected);
  const act = async (action) => {
    setError(null);
    try {
      await api(`/orders/${selected}/${action}`, action === "ship" ? { carrier: "UPS" } : {});
      await load();
    } catch (e) {
      setError(e.message);
    }
  };
  const s = order?.status;

  return (
    <div className="page">
      <header>
        <h1>Orders</h1>
        <p>Support console. {meta && <span className="pill">{meta.store} store</span>}</p>
      </header>
      <div className="cols">
        <nav>
          {orders.map((o) => (
            <button key={o.id} className={o.id === selected ? "on" : ""} onClick={() => setSelected(o.id)}>
              <span className="mono">{o.id.slice(0, 8)}</span>
              <span className={`status ${o.status}`}>{o.status}</span>
              <span className="sub">{o.customer} · {money(o.total)}</span>
            </button>
          ))}
        </nav>
        {order && (
          <main>
            <section className="card">
              <div className="row">
                <div>
                  <div className="mono sub">order {order.id}</div>
                  <h2>{order.items.map((i) => `${i.qty} × ${i.sku}`).join(", ")}</h2>
                  <div className="sub">customer {order.customer} · total {money(order.total)} · last changed {when(order.updatedAt)}</div>
                </div>
                <span className={`status big ${order.status}`}>{order.status}</span>
              </div>
            </section>
            <section className="card">
              <h3>What happened</h3>
              <p className="sub">
                Only the current status is stored. Who changed it, when each step happened, and why
                {["REFUNDED", "CANCELLED"].includes(s) && <> this order was {s.toLowerCase()}</>} isn't recorded.
              </p>
            </section>
            <section className="card actions">
              <h3>Act on this order</h3>
              <div className="row tight wrap">
                <button disabled={s !== "PLACED"} onClick={() => act("pay")}>Mark paid</button>
                <button disabled={s !== "PAID"} onClick={() => act("ship")}>Ship</button>
                <button disabled={!["PLACED", "PAID"].includes(s)} onClick={() => act("cancel")}>Cancel</button>
                <button disabled={!["PAID", "SHIPPED"].includes(s)} onClick={() => act("refund")}>Refund</button>
              </div>
            </section>
            {error && <div className="error">{error}</div>}
          </main>
        )}
      </div>
    </div>
  );
}
