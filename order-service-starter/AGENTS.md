# Agent instructions: order-service

This repo's design decisions are recorded in the Meko datapack `kiro-order-service` (the Meko MCP server).
The full convention is in [`.kiro/steering/meko-decisions.md`](.kiro/steering/meko-decisions.md). Follow it from any tool.

Short version:

0. Once per session: `conversation_create` with `datapack_id: "8133232a-2125-4192-8144-fb1865b6ff57"`
   (datapack `kiro-order-service`). Pass both ids on every Meko call; never rely on a default datapack.
1. Before suggesting a design, run `memory_search` and `knowledgebase_search` in the `kiro-order-service` datapack
   with the question you are about to answer. If a decision (`ADR-n`) or lesson (`L-n`) covers it, follow it and cite it.
2. When you settle a design choice or learn something the hard way, store it with `memory_add` in the same
   `DECISION` or `LESSON` text format, with `agent_id` set to `<your client>:order-service`
   (for example `claude_code:order-service`, `cursor:order-service`, `codex:order-service`), `"tool"` in the metadata
   set to your client, and `metadata` passed as a JSON string.
3. Never store secrets, credentials, customer data, or order contents.

## The code

- `server/` Express API over an `orders` table: one row per order, `status` updated in place. `npm run api` on :7841.
- `web/` React support console. `npm run dev`.
- `db/schema.sql` the YugabyteDB (YSQL) schema. Without `DATABASE_URL` the API uses an in-memory store.
- `npm test` runs the status-transition tests.
