# Kiro + Meko: decisions that survive the handoff

A decision made in Kiro's spec flow should reach a different tool, a later session and a teammate, with its reasoning
intact. This demo shows that it does, on live Meko.

- **Dry run and results:** [`docs/dry-run.md`](docs/dry-run.md), with the results of three runs in `docs/dryrun-*`
- **`order-service-starter/`** Where the recording starts: the shop *before* the feature. One row per order, `status`
  overwritten in place, no record of who changed it or why. Kiro designs the fix.
- **`order-service/`** Where it ends up: the reference event-sourced order service (Node + Express) with a React
  support console that shows why every order changed. Includes the Kiro spec, the Meko steering file (the single
  source for every run), and `AGENTS.md`/`CLAUDE.md` for the other tools.
- **`console/`** The Decision Trail (Node + React). A live view of the Meko datapack: every decision and lesson, which
  tool wrote it, ask-as-another-agent, and the raw MCP calls.

## Run it

Node 20.12 or later.

```bash
# The sample service (no keys needed; in-memory event store)
cd order-service
npm install
npm test                 # aggregate + concurrency tests (L-001)
npm run build && npm run api     # http://localhost:7841
# With YugabyteDB: psql -f db/schema.sql, then DATABASE_URL=postgresql://yugabyte@localhost:5433/yugabyte npm run api

# The Decision Trail console (live Meko)
cd ../console
cp .env.example .env     # set MEKO_API_KEY for the same Meko account Kiro signs in with
npm install
npm test                 # record format
npm run test:live        # live: a stand-in for Kiro stores ADR-001, Cursor retrieves it with the reasoning (own datapack)
npm run verify:kiro      # after a dry run: did the real Kiro write, in the right format, findable from another tool?
npm run demo             # http://localhost:7840
```

The console creates the datapack named in `MEKO_DATAPACK_NAME` if it doesn't exist. Use a fresh name for every
recording, so the trail starts empty.

### `console/.env`

Copy `console/.env.example` to `console/.env` and fill it in. `.env` is git-ignored: never commit it.

| Variable | Required | Default | What it is |
|---|---|---|---|
| `MEKO_API_KEY` | Yes | none | An API key from your Meko account (cloud.mekodata.ai), starting `mko_tkn_`. Use the **same account** Kiro signs in to, or the console won't see Kiro's records. |
| `MEKO_MCP_URL` | No | `https://mcp.mekodata.ai/mcp` | The Meko MCP endpoint. |
| `MEKO_DATAPACK_NAME` | No | `kiro-order-service` | The datapack to show. Created if it doesn't exist. Use the same one the workspace's steering file points at. |
| `PORT` | No | `7840` | The console's port. |
| `REHEARSAL` | No | off | Set to `1` to enable the console's dry-run writes (rehearsal records). Leave off when testing Kiro: a rehearsal record makes Kiro skip saving its own. |
| `MEKO_LIVE_DATAPACK` | No | `kiro-order-service-livetest` | The datapack `npm run test:live` writes to, kept apart from the demo's. |

Example:

```bash
MEKO_MCP_URL=https://mcp.mekodata.ai/mcp
MEKO_API_KEY=mko_tkn_...
MEKO_DATAPACK_NAME=kiro-dryrun-4
PORT=7840
```

Kiro itself needs no key: it signs in with OAuth through the Meko power. The order service needs no `.env` either;
set `DATABASE_URL` only to use YugabyteDB instead of the in-memory store.

## Recording the demo

Do the unrecorded dry run in [`docs/dry-run.md`](docs/dry-run.md) first. It's the only proof of the Kiro side.

1. `cd order-service && npm run demo:fresh -- <fresh-datapack> <folder>` builds `../<folder>` from the starter, adds
   the steering file, and points the agents at that datapack (created if needed). Run `npm install` there and open
   that folder as the workspace root in Kiro, with the Meko power installed and authenticated. Set the same datapack
   in `console/.env`.
2. Put the Decision Trail on a second screen.
3. In Kiro, run the prompts in sections B and C of [`docs/dry-run.md`](docs/dry-run.md), then `npm run verify:kiro`.

The console's **Dry-run writes** store the records the scenes expect, so you can rehearse retrieval. They are tagged
`console-rehearsal` in their text and badged *rehearsal* in the UI. Don't use them in the recording.

## What's live and what isn't

| Piece | Status |
|---|---|
| Meko memory, search, promotion, team knowledge | **Live** (`mcp.mekodata.ai`, API key in `console/.env`) |
| Kiro, Claude Code, Cursor, Codex | **Live**: your real clients, connected to the same Meko account |
| Order service event store | In-memory by default; YugabyteDB when `DATABASE_URL` is set |
| Rehearsal records | Written by the console, tagged, for dry runs only |

## Layout

```
order-service-starter/               before: orders table, status overwritten, no history (each run starts here)
order-service/
  scripts/fresh-copy.mjs             npm run demo:fresh -- <datapack> <folder>: starter + steering + datapack id
  .kiro/steering/meko-decisions.md   search before designing, store when decided, record format
  .kiro/specs/order-history/         requirements (EARS), design, tasks
  AGENTS.md, CLAUDE.md               the same convention for other tools
  db/schema.sql                      order_events, PRIMARY KEY (order_id HASH, version ASC)
  server/order.mjs                   aggregate: fold + command rules
  server/orders.mjs                  load → check → append, retry on conflict (L-001)
  server/eventStore.mjs              in-memory and YSQL stores, one contract
  web/                               support console: order history with reasons
console/
  server/meko.mjs                    MCP client over streamable HTTP; every call emitted to the wire
  server/records.mjs                 DECISION / LESSON text format: parse and format
  server/rehearsal.mjs               the records and questions each scene expects
  server/index.mjs                   /api/trail, /api/ask, /api/promote, /api/wire (SSE)
  web/                               Decision Trail UI
  test/live.mjs                      the core claim, against live Meko
docs/dry-run.md                      how to prove the Kiro side; results in docs/dryrun-*/RESULTS.md
```
