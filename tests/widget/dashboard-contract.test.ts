import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { containsUnsafeSecret } from "../../src/policy/redaction.js";
import { createServer } from "../../src/server.js";
import { exportEngineeringPacketHandler } from "../../src/tools/export-packet.js";
import { renderDashboardHandler } from "../../src/tools/render-dashboard.js";
import { reviewArchitectureHandler } from "../../src/tools/review-architecture.js";
import { reviewCodeHandler } from "../../src/tools/review-code.js";
import { selectContextHandler } from "../../src/tools/context.js";
import { summarizeChangesHandler } from "../../src/tools/summarize.js";

type RegisteredTool = {
  title?: string;
  description?: string;
  annotations?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
};

type RegisteredResource = {
  metadata?: Record<string, unknown>;
  readCallback: (uri: URL, extra: unknown) => Promise<{ contents: Array<{ uri: string; mimeType?: string; text?: string; _meta?: Record<string, unknown> }> }>;
};

async function fixtureReviewFlow() {
  const selected = await selectContextHandler({
    sourceId: "fixture-local-api",
    target: { kind: "local_working_tree", includeStaged: true, includeUnstaged: true }
  });
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string, includeCi: "auto" });
  const codeReview = await reviewCodeHandler({ summaryId: summarized.structuredContent?.summaryId as string });
  const architectureReview = await reviewArchitectureHandler({ summaryId: summarized.structuredContent?.summaryId as string });
  const packet = await exportEngineeringPacketHandler({
    summaryId: summarized.structuredContent?.summaryId as string,
    reviewIds: [
      codeReview.structuredContent?.reviewId as string,
      architectureReview.structuredContent?.architectureReviewId as string
    ]
  });

  return {
    summaryId: summarized.structuredContent?.summaryId as string,
    reviewIds: [
      codeReview.structuredContent?.reviewId as string,
      architectureReview.structuredContent?.architectureReviewId as string
    ],
    packetId: packet.structuredContent?.packetId as string
  };
}

test("server exposes a read-only dashboard render tool linked to the widget resource", async () => {
  const server = createServer() as unknown as {
    _registeredTools: Record<string, RegisteredTool>;
    _registeredResources: Record<string, RegisteredResource>;
  };
  const tool = server._registeredTools["review.render_dashboard"];

  assert.ok(tool, "review.render_dashboard should be registered");
  assert.match(tool.description ?? "", /^Use this when /);
  assert.match(tool.description ?? "", /Do not use this when /);
  assert.equal(tool.annotations?.readOnlyHint, true);
  assert.equal(tool.annotations?.destructiveHint, false);
  assert.equal((tool._meta?.ui as { resourceUri?: string })?.resourceUri, "ui://widget/review-dashboard-v1.html");
  assert.equal(tool._meta?.["openai/outputTemplate"], "ui://widget/review-dashboard-v1.html");

  const resource = server._registeredResources["ui://widget/review-dashboard-v1.html"];
  assert.ok(resource, "dashboard widget resource should be registered");
  const response = await resource.readCallback(new URL("ui://widget/review-dashboard-v1.html"), {});
  const content = response.contents[0];
  assert.equal(content.mimeType, "text/html;profile=mcp-app");
  assert.match(content.text ?? "", /engineering-review-widget-root/);
  assert.deepEqual((content._meta?.ui as { csp?: { connectDomains?: string[]; resourceDomains?: string[]; frameDomains?: string[] } })?.csp?.connectDomains, []);
  assert.equal((content._meta?.ui as { csp?: { frameDomains?: string[] } })?.csp?.frameDomains, undefined);
});

test("dashboard render payload keeps model-visible content compact and evidence in _meta", async () => {
  const flow = await fixtureReviewFlow();
  const dashboard = await renderDashboardHandler({
    summaryId: flow.summaryId,
    reviewIds: flow.reviewIds,
    packetId: flow.packetId
  });

  assert.equal(dashboard.isError, undefined);
  assert.equal(containsUnsafeSecret(dashboard), false);
  assert.ok(JSON.stringify(dashboard.structuredContent).length < 7000);
  assert.equal("rawDiffsByFile" in (dashboard.structuredContent ?? {}), false);
  assert.ok(Array.isArray((dashboard.structuredContent?.findings as unknown[] | undefined) ?? []));
  assert.ok((dashboard.structuredContent?.architecture as { riskMatrix?: unknown[] }).riskMatrix);
  assert.ok((dashboard.structuredContent?.tests as { gaps?: unknown[] }).gaps);
  assert.ok((dashboard.structuredContent?.packetPreview as { available?: boolean }).available);
  assert.ok(dashboard._meta?.fileMap);
  assert.ok(dashboard._meta?.diffPreviews);
  assert.ok(dashboard._meta?.packetMarkdownPreview);
});

test("widget source is read-only and does not initiate tool calls or writes", async () => {
  const source = await readFile("widget/src/App.tsx", "utf8");

  assert.doesNotMatch(source, /callTool\s*\(/);
  assert.doesNotMatch(source, /tools\/call/);
  assert.doesNotMatch(source, /fetch\s*\(/);
  assert.doesNotMatch(source, /sendFollowUpMessage/);
  assert.doesNotMatch(source, /write|commit|push|pull request/i);
});
