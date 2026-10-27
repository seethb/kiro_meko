import { useCallback, useEffect, useState } from "react";

const api = async (path, body) => {
  const res = await fetch(`/api${path}`, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error);
  return data;
};

const money = (n) => `$${n.toFixed(2)}`;
const when = (iso) => new Date(iso).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
const LABEL = {
  OrderPlaced: "Placed",
  OrderPaid: "Paid",
  OrderShipped: "Shipped",
  OrderCancelled: "Cancelled",
  OrderRefunded: "Refunded",
};
const reason = (code) => code?.toLowerCase().replaceAll("_", " ");

export default function App() {
  const [orders, setOrders] = useState([]);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);

  const loadOrders = useCallback(async () => setOrders(await api("/orders")), []);
  useEffect(() => {
    api("/meta").then(setMeta);
    loadOrders();
  }, [loadOrders]);
  useEffect(() => {
    if (!selected && orders.length) setSelected(orders[0].id);
  }, [orders, selected]);
  useEffect(() => {
    if (selected) api(`/orders/${selected}/history`).then(setHistory);
  }, [selected, orders]);

  const order = orders.find((o) => o.id === selected);

  const act = async (action, body) => {
    setError(null);
    try {
      await api(`/orders/${selected}/${action}`, { actor: "support:you", ...body });
      await loadOrders();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="page">
      <header>
        <h1>Order history</h1>
        <p>Every change to an order, who made it, and why. {meta && <span className="pill">{meta.store} event store</span>}</p>
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
                  <div className="sub">customer {order.customer} · total {money(order.total)}{order.refunded > 0 && ` · refunded ${money(order.refunded)}`}</div>
                </div>
                <span className={`status big ${order.status}`}>{order.status}</span>
              </div>
            </section>
            <section className="card">
              <h3>What happened</h3>
              <ol className="timeline">
                {history.map((e) => (
                  <li key={e.version} className={e.type}>
                    <div className="dot" />
                    <div>
                      <div className="row tight">
                        <strong>{LABEL[e.type] ?? e.type}</strong>
                        <span className="sub">v{e.version} · {when(e.recordedAt)} · by <span className="mono">{e.actor}</span></span>
                      </div>
                      {e.reasonCode && <div className="why">Why: <strong>{reason(e.reasonCode)}</strong>{e.note && <> — {e.note}</>}</div>}
                      {e.payload?.carrier && <div className="sub">carrier {e.payload.carrier}</div>}
                      {e.payload?.amount != null && e.type === "OrderRefunded" && <div className="sub">amount {money(e.payload.amount)}</div>}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
            {meta && <Actions order={order} reasonCodes={meta.reasonCodes} act={act} />}
            {error && <div className="error">{error}</div>}
          </main>
        )}
      </div>
    </div>
  );
}

function Actions({ order, reasonCodes, act }) {
  const [reasonCode, setReasonCode] = useState(reasonCodes[0]);
  const [note, setNote] = useState("");
  const s = order.status;
  return (
    <section className="card actions">
      <h3>Act on this order</h3>
      <div className="row tight wrap">
        <button disabled={s !== "PLACED"} onClick={() => act("pay")}>Mark paid</button>
        <button disabled={s !== "PAID"} onClick={() => act("ship", { carrier: "UPS" })}>Ship</button>
        <select value={reasonCode} onChange={(e) => setReasonCode(e.target.value)}>
          {reasonCodes.map((r) => <option key={r} value={r}>{reason(r)}</option>)}
        </select>
        <input placeholder="Note for the record" value={note} onChange={(e) => setNote(e.target.value)} />
        <button disabled={!["PLACED", "PAID"].includes(s)} onClick={() => act("cancel", { reasonCode, note })}>Cancel</button>
        <button disabled={!["PAID", "SHIPPED"].includes(s)} onClick={() => act("refund", { reasonCode, note })}>Refund</button>
      </div>
    </section>
  );
}
