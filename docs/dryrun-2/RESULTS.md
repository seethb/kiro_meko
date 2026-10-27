# Dry run 2: 26 Oct 2026

Kiro IDE 1.4.26, Meko power 1.2.0 (OAuth). Workspace `order-service-run2` (decision ids stripped from code comments),
datapack `kiro-dryrun-2` (`9857c238-…`), empty at the start, no rehearsal writes.

## What Kiro did

| Time (UTC) | Event |
|---|---|
| 05:00:36 | Prompt: "support agents need to see the full history of an order, including why it was refunded or cancelled." |
| 05:00:36 | Steering included: `AGENTS.md`, `.kiro/steering/meko-decisions.md` |
| 05:00:45 | Kiro: "let me check what's already been decided on this project…"; activates Meko (approval requested) |
| 05:01:04 | `conversation_create`: `kiro:order-service`, `datapack_id: 9857c238-…` |
| 05:01:40 | `memory_search` + `knowledgebase_search`, twice: empty, reported as "No recorded decisions cover this yet" |
| 05:02:33 | Reads the code; finds the feature mostly exists; reframes as a bugfix after questions |
| 05:36:05 | "Create the design for order-history-missing-reason" |
| 05:38:49 | Kiro, unprompted: "The design settles a real design decision with a rejected alternative, which is exactly the kind of thing the team convention says to record in Meko when it lands." |
| 05:38:53 | Searches both scopes for the last ADR number: none, so ADR-001 |
| 05:39:18 | `memory_add` approval requested; user chose **Always allow** |
| 05:39:26 | Fails: `metadata` sent as an object, Meko requires a JSON string |
| 05:39:40 | Retry succeeds: memory `6a8dd440-…`, DECISION format, one Chosen, two Rejected with reasons |
| 05:39:44 | Reads it back with `memory_get_by_id`, as the convention requires |

`npm run verify:kiro` with `MEKO_DATAPACK_NAME=kiro-dryrun-2`: all checks passed, including retrieval of ADR-001 by
`cursor:order-service`.

## Conclusions

- **Verified:** Kiro stores a decision without being asked, in the agreed format, in the right datapack, and verifies
  the write. Another tool's identity can retrieve it.
- **Fixed:** the steering file now says `metadata` must be a JSON string.
- **For the recording:** Kiro asks for tool approval the first time. Choose *Always allow* during the dry run so the
  recording isn't interrupted, or show the prompt deliberately.
- **Demo flaw:** the starter repo already contains the finished event-sourced service, so Kiro designed a bugfix
  instead of the event-sourcing decision. Scene 3 needs a "before" starter: a plain `orders` table with a `status`
  column and no history.
