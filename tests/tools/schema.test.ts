import assert from "node:assert/strict";
import test from "node:test";
import {
  exportPacketInputSchema,
  reviewArchitectureInputSchema,
  reviewCodeInputSchema,
  selectContextInputSchema,
  summarizeChangesInputSchema
} from "../../src/types.js";

test("tool input schemas accept expected inputs", () => {
  assert.doesNotThrow(() => selectContextInputSchema.parse({ sourceType: "all" }));
  assert.doesNotThrow(() => selectContextInputSchema.parse({ sourceId: "fixture-local-api", target: { kind: "local_working_tree" } }));
  assert.doesNotThrow(() => summarizeChangesInputSchema.parse({ contextId: "ctx_1234567890abcdef", includeCi: "auto" }));
  assert.doesNotThrow(() => reviewCodeInputSchema.parse({ summaryId: "sum_1234567890abcdef", focus: ["tests"] }));
  assert.doesNotThrow(() => reviewArchitectureInputSchema.parse({ summaryId: "sum_1234567890abcdef", focus: ["architecture"] }));
  assert.doesNotThrow(() => exportPacketInputSchema.parse({ summaryId: "sum_1234567890abcdef", packetFocus: "full" }));
});

test("tool input schemas reject malformed inputs", () => {
  assert.throws(() => selectContextInputSchema.parse({ target: { kind: "github_pr", pullNumber: -1 } }));
  assert.throws(() => summarizeChangesInputSchema.parse({ contextId: "" }));
  assert.throws(() => reviewCodeInputSchema.parse({ summaryId: "sum", maxFindings: 999 }));
  assert.throws(() => exportPacketInputSchema.parse({ summaryId: "sum_1234567890abcdef", reviewIds: ["rev_code_not_hex"] }));
});
