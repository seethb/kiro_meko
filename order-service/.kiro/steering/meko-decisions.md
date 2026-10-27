---
inclusion: always
---

# Decisions live in Meko

This repo keeps its design reasoning in the Meko datapack `kiro-order-service`, not in chat history.
Other people work on it from Claude Code, Cursor and Codex, and they read the same datapack.

This file is specific to this repo. Where it differs from the Meko power's general instructions, follow this file.

## Connect once per session

- Datapack: `kiro-order-service`, `datapack_id: "8133232a-2125-4192-8144-fb1865b6ff57"`
- `agent_id`: `kiro:order-service`, whatever the folder or repository is called

Call `conversation_create` with that `agent_id` and `datapack_id`, and a short title. Pass the same `datapack_id` and
the returned `conversation_id` on every Meko call below. Don't use a default datapack: writes there are invisible to
the rest of the team.

## Before you propose a design

Look up what has already been decided. Run both searches; promoted team decisions only come back from the second one.

1. `memory_search` with the question you are about to answer (for example "order history storage").
2. `knowledgebase_search` with the same question.

Use these two, not `context_search`: in testing, `context_search` missed a promoted decision that
`knowledgebase_search` returned first.

If a recorded decision covers the question, follow it and cite its id (for example "per ADR-001").
If you think it is wrong, say so and ask before you change course. Do not quietly re-open it.

## When a decision lands

When the developer settles a design choice in a spec (storage, keys, APIs, consistency, failure handling), store it with `memory_add`.
Store a decision when it is made, not at the end of the session. Do not ask first. Read it back with
`memory_get_by_id`, then tell the developer you saved it and show the ADR id.

A decision is one memory holding the choice *and* its reasoning, not one fact per call: without the rejected
options and why they lost, the next agent will propose them again.

- `text`: use exactly this shape, so any agent can read the reasoning back without the original chat:

```
DECISION ADR-<next number, three digits: ADR-001, ADR-002> · order-service · <one-line title>
Chosen: <what we will do>
Rejected: <alternative> — <why it lost>
Rejected: <alternative> — <why it lost>
Consequences: <what this commits us to>
Recorded by: kiro (spec: <spec name>)
```

- `metadata`: a JSON **string**, not an object (Meko rejects an object):
  `"{\"kind\":\"decision\",\"ref\":\"ADR-<nnn>\",\"repo\":\"order-service\",\"tool\":\"kiro\",\"spec\":\"<spec name>\"}"`

For something learned the hard way (a library bug, a database error, a performance limit), use `LESSON L-<nnn>` with
`Finding:` and `Do:` lines instead of `Chosen:` and `Rejected:`, and `"kind":"lesson"`.

Never store secrets, credentials, customer data, or order contents in Meko.
