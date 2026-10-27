import { randomUUID } from "node:crypto";
import { commands, fold } from "./order.mjs";

const MAX_ATTEMPTS = 3;

// Load, check, append; on a version conflict, reload and check again (L-001).
// A command that is no longer valid after the reload throws its RuleError (409).
export function orderService(store) {
  async function run(orderId, name, input) {
    for (let attempt = 1; ; attempt++) {
      const events = await store.load(orderId);
      const state = fold(events);
      const event = commands[name](state, input);
      try {
        const stored = await store.append(orderId, { ...event, version: state.version + 1 });
        return { state: fold([...events, stored]), event: stored, attempts: attempt };
      } catch (err) {
        if (!err.retryable || attempt >= MAX_ATTEMPTS) throw err;
      }
    }
  }

  return {
    place: (input) => run(randomUUID(), "place", input),
    act: (orderId, name, input) => run(orderId, name, input),
    async get(orderId) {
      const events = await store.load(orderId);
      return events.length ? fold(events) : null;
    },
    history: (orderId) => store.load(orderId),
    async list() {
      const ids = await store.list();
      return Promise.all(ids.map(async (id) => fold(await store.load(id))));
    },
  };
}
