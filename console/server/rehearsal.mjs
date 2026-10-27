// The records the demo expects the agents to write, scene by scene. The
// console can write them itself for a dry run of the retrieval scenes, but
// a recording must use the real Kiro and second-client sessions: these are
// tagged "console-rehearsal" in their text and metadata, so they can never
// pass as agent output, even after promotion strips the metadata.

export const SCENES = [
  {
    scene: 3,
    agentId: "kiro:order-service",
    record: {
      kind: "decision",
      ref: "ADR-001",
      repo: "order-service",
      title: "Order state is event-sourced",
      chosen:
        "An append-only order_events table is the source of truth; current state and the support history are derived from it.",
      rejected: [
        {
          option: "CDC on the orders table",
          why: "row changes carry no intent: a customer refund and a fraud reversal both arrive as status=REFUNDED, and changes to orders and order_items come as separate per-table streams that consumers must re-stitch into one business change.",
        },
        {
          option: "Audit columns on orders (updated_by, updated_reason)",
          why: "they keep only the last change, so the history support needs is overwritten.",
        },
      ],
      consequences:
        "Every write goes through the event store with a per-order version; read models must be rebuildable from events; events are never updated or deleted.",
      recordedBy: "console-rehearsal (as kiro, spec: order-history)",
    },
  },
  {
    scene: 3,
    agentId: "kiro:order-service",
    record: {
      kind: "decision",
      ref: "ADR-002",
      repo: "order-service",
      title: "order_events key is (order_id HASH, version ASC)",
      chosen:
        "Primary key (order_id HASH, version ASC) on YugabyteDB: orders spread across tablets, one order's events stay together in version order.",
      rejected: [
        {
          option: "A global bigserial event_id as the key",
          why: "every insert would land on the tablet holding the newest ids, a write hotspot, and loading one order would need a secondary index.",
        },
      ],
      consequences:
        "Loading an order is a single-tablet range scan; the (order_id, version) uniqueness is also the optimistic-concurrency check.",
      recordedBy: "console-rehearsal (as kiro, spec: order-history)",
    },
  },
  {
    scene: 5,
    agentId: "claude_code:order-service",
    record: {
      kind: "lesson",
      ref: "L-001",
      repo: "order-service",
      title: "Concurrent refunds: retry on version conflict, never 500",
      finding:
        "Two support agents refunding the same order both read version 4 and both append version 5; the second insert fails with unique_violation (23505). Under contention YugabyteDB can also return serialization_failure (40001).",
      do: "Treat 23505 on order_events and 40001 as retryable: reload the stream, re-check the command, append again, at most 3 attempts. If the command is no longer valid after reload, return 409.",
      recordedBy: "console-rehearsal (as claude_code, task: refund endpoint)",
    },
  },
];

export const QUESTIONS = [
  { scene: 4, agentId: "claude_code:order-service", q: "How should I add order history? Can we use CDC on the orders table?" },
  { scene: 5, agentId: "kiro:order-service", q: "What happens when two people refund the same order at the same time?" },
  { scene: 6, agentId: "cursor:order-service", q: "Why does the order service use event sourcing?" },
];
