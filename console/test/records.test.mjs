import { test } from "node:test";
import assert from "node:assert/strict";
import { formatRecord, parseRecord, toolOf } from "../server/records.mjs";
import { SCENES } from "../server/rehearsal.mjs";

test("every rehearsal record survives format -> parse", () => {
  for (const { record } of SCENES) {
    assert.deepEqual(parseRecord(formatRecord(record)), { rejected: [], ...record });
  }
});

test("a record flattened onto one line still parses", () => {
  const flat = formatRecord(SCENES[0].record).replaceAll("\n", " ");
  const r = parseRecord(flat);
  assert.equal(r.ref, "ADR-001");
  assert.equal(r.rejected.length, 2);
  assert.match(r.rejected[0].why, /no intent/);
});

test("free text is not a record", () => {
  assert.equal(parseRecord("We like event sourcing."), null);
});

test("tool comes from the agent id", () => {
  assert.equal(toolOf("kiro:order-service"), "kiro");
  assert.equal(toolOf(undefined), "meko_agent");
});
