import assert from "node:assert/strict";
import test from "node:test";
import { createServer } from "../../src/server.js";

type RegisteredTool = {
  title?: string;
  description?: string;
  inputSchema?: {
    _def?: { shape?: () => Record<string, { description?: string }> };
  };
  outputSchema?: unknown;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

function registeredTools(): Record<string, RegisteredTool> {
  return (createServer() as unknown as { _registeredTools: Record<string, RegisteredTool> })._registeredTools;
}

test("tool descriptors are optimized for Developer Mode discovery", () => {
  const tools = registeredTools();
  const expectedNames = [
    "review.select_context",
    "review.summarize_changes",
    "review.review_code",
    "review.review_architecture",
    "review.export_engineering_packet",
    "review.render_dashboard"
  ];

  for (const name of expectedNames) {
    const tool = tools[name];
    assert.ok(tool, `${name} should be registered`);
    assert.ok(tool.title, `${name} should have a user-facing title`);
    assert.match(tool.description ?? "", /^Use this when /, `${name} description should start with Use this when`);
    assert.match(tool.description ?? "", /Do not use this when /, `${name} description should include Do not use this when guidance`);
    assert.equal(tool.annotations?.readOnlyHint, true, `${name} should advertise readOnlyHint`);
    assert.equal(tool.annotations?.destructiveHint, false, `${name} should advertise non-destructive behavior`);
    assert.equal(tool.annotations?.openWorldHint, false, `${name} should advertise closed-world behavior`);
    assert.equal(tool.annotations?.idempotentHint, true, `${name} should advertise idempotency`);
    assert.ok(tool.inputSchema, `${name} should expose an input schema`);
    assert.ok(tool.outputSchema, `${name} should expose an output schema`);
    assert.ok(tool._meta?.["openai/toolInvocation/invoking"], `${name} should expose invoking status text`);
    assert.ok(tool._meta?.["openai/toolInvocation/invoked"], `${name} should expose invoked status text`);
  }
});

test("tool input schemas include parameter descriptions for ambiguous fields", () => {
  const tools = registeredTools();

  const selectShape = tools["review.select_context"].inputSchema?._def?.shape?.() ?? {};
  assert.match(selectShape.sourceId?.description ?? "", /allowlisted sourceId/);
  assert.match(selectShape.target?.description ?? "", /PR, branch, commit range, or local working tree/);

  const summarizeShape = tools["review.summarize_changes"].inputSchema?._def?.shape?.() ?? {};
  assert.match(summarizeShape.contextId?.description ?? "", /review.select_context/);
  assert.match(summarizeShape.includeCi?.description ?? "", /Checks/);

  const packetShape = tools["review.export_engineering_packet"].inputSchema?._def?.shape?.() ?? {};
  assert.match(packetShape.summaryId?.description ?? "", /review.summarize_changes/);
  assert.match(packetShape.reviewIds?.description ?? "", /review.review_code/);
});
