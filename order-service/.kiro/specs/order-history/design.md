# Design: order history for support

Decisions referenced here are stored in Meko (datapack `kiro-order-service`). Search for the id to get the full
reasoning and the options that were rejected.

## Overview

Order state is event-sourced (**ADR-001**). The `order_events` table is the source of truth; the current state of an
order is a fold over its events. The support history view reads the events directly, so the "why" a support agent sees
is the same record the system acts on.

## Data model

```sql
CREATE TABLE order_events (
  order_id    uuid        NOT NULL,
  version     int         NOT NULL,
  type        text        NOT NULL,
  actor       text        NOT NULL,
  reason_code text,
  note        text,
  payload     jsonb       NOT NULL DEFAULT '{}',
  recorded_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id HASH, version ASC)
);
```

The key is `(order_id HASH, version ASC)` (**ADR-002**): orders spread across tablets, and one order's events sit
together in version order, so loading an order is a single-tablet range scan.

## Events

| Event | Allowed from | Reason required |
|---|---|---|
| `OrderPlaced` | (new) | no |
| `OrderPaid` | PLACED | no |
| `OrderShipped` | PAID | no |
| `OrderCancelled` | PLACED, PAID | yes |
| `OrderRefunded` | PAID, SHIPPED | yes |

Reason codes: `CUSTOMER_REQUEST`, `DAMAGED_IN_TRANSIT`, `FRAUD_REVIEW`, `OUT_OF_STOCK`, `DUPLICATE_ORDER`, `PRICE_ERROR`.

## Writes and concurrency

A command loads the order's events, checks its rule against the folded state, and appends version `n + 1`. Two
writers that both read version `n` collide on the primary key; the loser gets `unique_violation` (23505). Under
contention YugabyteDB can also return `serialization_failure` (40001). Both are retried: reload, re-check, append,
up to three attempts (**L-001**). A command that is no longer valid after the reload (refund an already-refunded
order) fails with 409, never 500.

## API

| Method | Path | Body |
|---|---|---|
| POST | `/orders` | `{ customer, items: [{ sku, qty, price }] }` |
| POST | `/orders/:id/pay` | `{ actor }` |
| POST | `/orders/:id/ship` | `{ actor, carrier }` |
| POST | `/orders/:id/cancel` | `{ actor, reasonCode, note? }` |
| POST | `/orders/:id/refund` | `{ actor, reasonCode, note?, amount? }` |
| GET | `/orders/:id` | current state |
| GET | `/orders/:id/history` | events, oldest first |
