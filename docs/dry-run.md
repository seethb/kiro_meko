# Dry run: proving the Kiro side

Two things are unproven until this run: the Meko power installs and signs in as described, and Kiro's agent follows
the steering file and calls `memory_add` when a decision lands. Run it once, unrecorded, and note what actually
happened.

## Prepare (5 min)

```bash
cd order-service && npm run demo:fresh -- kiro-dryrun-N order-service-runN   # starter + steering, new datapack
cd ../order-service-runN && npm install
# set MEKO_DATAPACK_NAME=kiro-dryrun-N in console/.env, then:
cd ../console && npm run demo
```

Open `order-service-runN` in Kiro as the workspace root (the title bar shows its name). Keep the Decision Trail
(http://localhost:7840) visible, and don't use its dry-run writes: a rehearsal record makes Kiro skip saving its own.
Results of earlier runs: [`dryrun-1`](dryrun-1/RESULTS.md), [`dryrun-2`](dryrun-2/RESULTS.md), [`dryrun-3`](dryrun-3/RESULTS.md).

## A. Install and sign-in

1. Open kiro.dev/powers, find Meko, click **Add to Kiro**. This installs the power but doesn't sign you in.
2. In Kiro's **MCP Servers** view, find `meko` (shown as *Unauthenticated*) and choose **Authenticate**. Sign in
   in the browser with the **same Meko account** as the console's API key. `~/.kiro/logs/*/mcp.log` should stop
   showing `Unauthorized`.

| Capture | Claim it settles |
|---|---|
| Screenshot of the power's listing, including the "verified" mark | "verified power" |
| What the sign-in looked like: browser OAuth, or something else? Any key pasted? | "OAuth instead of API keys" |
| The MCP server URL the power configured | "connects to mcp.mekodata.ai" |
| Whether Meko tools appear only after the conversation turns to memory, or always | "loads only when needed" |

## B. Does the agent store decisions on its own?

Start a new spec and use these prompts **without mentioning Meko**:

1. *"Spec a feature: support agents need to see the full history of an order, including why it was refunded or cancelled."*
2. When the design comes up: *"Let's use event sourcing. Not CDC on the orders table: a CDC stream can't tell a customer refund from a fraud reversal, both are just status=REFUNDED."*
3. *"Key the events table on (order_id HASH, version ASC), not a global sequence. A sequence would hotspot one tablet."*

| Watch for | Record |
|---|---|
| Did Kiro call `datapack_search` and `conversation_create` first? | yes / no |
| Did it call `memory_add` after prompt 2 **without being asked**? | yes / after prompt N / only when asked |
| Did the `memory_add` include `datapack_id`? | yes / no (then writes went to the default datapack) |
| Did the text follow the DECISION format with Rejected and a reason? | yes / partly / no |
| Did ADR-001 appear in the Decision Trail? | yes, after N s / no |

If it didn't store anything, ask *"remember that decision"*. Capture is then on request, not automatic.

## C. Does it search before designing?

In a **new** Kiro session: *"How should I add order history? Can we use CDC?"*

| Watch for | Record |
|---|---|
| Did it call `memory_search` and `knowledgebase_search` before answering? | |
| Did it cite ADR-001 and the CDC reason? | |

## Check the result

```bash
cd console && npm run verify:kiro
```

It lists every real (non-rehearsal) record, checks the format, confirms Kiro wrote at least one itself, and checks that
`cursor:order-service` can find it.

Then check retrieval from a second client (Claude Code or Cursor) and, if you can, from a teammate's account.
