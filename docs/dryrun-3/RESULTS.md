# Dry run 3: 26 Oct 2026

Kiro IDE 1.4.26, Meko power 1.2.0 (OAuth, tools on *Always allow*). Workspace `order-service-run3`, built from
`order-service-starter` (status overwritten in place, no history, no spec, no decision ids). Datapack `kiro-dryrun-3`
(`6b2b1581-…`), empty at the start.

## What Kiro did

| Time (UTC) | Event |
|---|---|
| 06:13:57 | Prompt: "Not CDC on the orders table: a CDC stream can't tell a customer refund from a fraud reversal…" |
| 06:13:57 | Steering included: `AGENTS.md`, `.kiro/steering/meko-decisions.md` |
| 06:14:19 | `conversation_create` (`kiro:order-service`, `6b2b1581-…`) |
| 06:14:27 | Two `memory_search` + `knowledgebase_search` pairs: empty. "No existing decision covers this." |
| 06:15:09 | Reads the code: "The comment on `act()` even spells it out: 'Overwrites the status. Who did it, and why, is not kept anywhere.'" |
| 06:15:29 | Unprompted: "let me record this design decision in the datapack first… the team reads this from other tools and could otherwise re-propose CDC." |
| 06:15:37 | `memory_add` ADR-001, succeeds first time; read back with `memory_get_by_id` |
| 06:33:46 | During refinement, unprompted: "introduced a new design choice worth recording" |
| 06:35:43 | `memory_add` ADR-002 (Reason/Actor optional, defaults, 200-character cap), read back |

No failed tool calls. The prompt about `(order_id HASH, version ASC)` was not sent.

## What Kiro stored

```text
DECISION ADR-001 · order-service · Capture status-change intent in an append-only event log, not via CDC on the orders table
Chosen: Record each order status change as an explicit domain event (append-only order_events log) carrying the action, reason, and actor at write time, alongside the in-place status update on the orders row.
Rejected: CDC on the orders table — a row-level change stream only sees the new state, so it cannot distinguish a customer refund from a fraud reversal (both are just status=REFUNDED). The intent is lost at the source, not in transit, so no downstream consumer can recover it.
Rejected: Keeping only the current status column (status quo) — orders.act() overwrites status in place and records neither who did it nor why, so order history and the reason for a transition are unrecoverable.
Consequences: Writers must emit a transition event with reason/actor on every status change; downstream consumers read intent from the event log rather than inferring it from state. Commits us to maintaining an append-only event store and keeping it consistent with the orders row.
Recorded by: kiro (spec: order-status-event-log)
```

ADR-002 rejects three alternatives (mandatory fields, no length bound, silent truncation), each with a reason.

`npm run verify:kiro`: all checks passed, including retrieval as `cursor:order-service`.

## Conclusions

- **Verified, on the demo's own decision:** Kiro captures the event-sourcing-vs-CDC decision unprompted, in the agreed
  format, first time, and verifies the write.
- **Better than scripted:** Kiro also recorded a decision the developer never stated (ADR-002).
- **For a recording:** Kiro saved the decision *before* writing the spec ("record this design decision… first"), so
  the save shows up early. Send prompt 3 too if ADR-002 should be the HASH-key decision.
