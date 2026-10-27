# Dry run 1: 26 Oct 2026

Kiro IDE 1.4.26 with the Meko power 1.2.0, signed in with OAuth. Workspace `order-service-fresh`, datapack
`kiro-dryrun-1` (`5ed73c40-…`). Evidence: Kiro's session log (`~/.kiro/sessions/…/messages.jsonl`, kept local) and
the spec Kiro wrote (`kiro-spec/`).

## What Kiro did

| Time (UTC) | Event |
|---|---|
| 04:14:55 | Prompt 1: "Spec a feature: support agents need to see the full history of an order…" |
| 04:14:55 | Steering included: `AGENTS.md`, `.kiro/steering/meko-decisions.md` |
| 04:15:39 | `kiro_powers activate meko`, unprompted, then `readSkill meko-memory` |
| 04:16:37 | `conversation_create` with `agent_id: kiro:order-service`, `datapack_id: 5ed73c40-…` |
| 04:16:50 | `memory_search` + `knowledgebase_search` "order history storage": found L-001 (rehearsal) |
| 04:17:08 | Two more search pairs on event sourcing and reason codes |
| 04:22:17 | **A rehearsal ADR-001 was written by the console's dry-run button** |
| 04:23:35 | Requirements written; they cite ADR-001 and L-001 |
| 04:30:12 | Prompt 2: event sourcing, not CDC |
| 04:30:23 | Kiro: "This is a clear design decision… I'll record it. First let me confirm… nothing conflicts." |
| 04:30:27 | `memory_search` + `knowledgebase_search`: found ADR-001 (rehearsal) |
| 04:30:44 | Kiro: "This decision is already recorded… I won't re-open it or record a duplicate." No `memory_add`. |
| 04:38:43 | "Create the tasks" (prompt 3 was not sent) |

## Conclusions

- **Verified:** steering loads; the power activates without being asked; setup follows the steering file; Kiro
  searches both scopes before designing, cites decisions with their reasoning, and doesn't re-open them.
- **Not shown:** whether Kiro calls `memory_add` on its own. It said it would, but the rehearsal ADR-001 made that
  correctly unnecessary.
- **Test-design flaws, now fixed:** rehearsal writes are off unless the console runs with `REHEARSAL=1`; the fresh
  copy strips `ADR-`/`L-` citations from code comments (Kiro also read ADR-002 from `schema.sql`); Kiro treated the
  `console-rehearsal` tag as real, so rehearsal and capture tests need separate datapacks.

Dry run 2: workspace `order-service-run2`, datapack `kiro-dryrun-2`, no rehearsal writes, all three prompts.
