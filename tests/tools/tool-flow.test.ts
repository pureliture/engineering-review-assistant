import assert from "node:assert/strict";
import test from "node:test";
import { selectContextHandler } from "../../src/tools/context.js";
import { summarizeChangesHandler } from "../../src/tools/summarize.js";
import { reviewCodeHandler } from "../../src/tools/review-code.js";
import { reviewArchitectureHandler } from "../../src/tools/review-architecture.js";
import { exportEngineeringPacketHandler } from "../../src/tools/export-packet.js";
import { containsUnsafeSecret } from "../../src/policy/redaction.js";

test("review.select_context lists fixture sources when live config is empty", async () => {
  const result = await selectContextHandler({ sourceType: "all" });
  assert.equal(result.isError, undefined);
  const sources = result.structuredContent?.availableSources as Array<{ sourceId: string }>;
  assert.ok(sources.some((source) => source.sourceId === "fixture-local-api"));
  assert.ok(sources.some((source) => source.sourceId === "fixture-github-service"));
  assert.equal(containsUnsafeSecret(result), false);
});

test("review.select_context rejects unconfigured source", async () => {
  const result = await selectContextHandler({
    sourceId: "unknown",
    target: { kind: "local_working_tree" }
  });
  assert.equal(result.isError, true);
  assert.equal((result.structuredContent?.error as { code: string }).code, "SOURCE_NOT_CONFIGURED");
});

test("full fixture local review flow returns sanitized report and packet", async () => {
  const selected = await selectContextHandler({
    sourceId: "fixture-local-api",
    target: { kind: "local_working_tree", includeStaged: true, includeUnstaged: true }
  });
  assert.equal(selected.isError, undefined);
  const contextId = selected.structuredContent?.contextId as string;

  const summarized = await summarizeChangesHandler({ contextId, includeCi: "auto", includeRepoDocs: true });
  assert.equal(summarized.isError, undefined);
  const summaryId = summarized.structuredContent?.summaryId as string;
  assert.ok(summaryId);
  assert.equal(containsUnsafeSecret(summarized), false);
  assert.ok(Array.isArray(summarized._meta?.redactions));

  const codeReview = await reviewCodeHandler({ summaryId });
  assert.equal(codeReview.isError, undefined);
  const codeReviewId = codeReview.structuredContent?.reviewId as string;
  const findings = codeReview.structuredContent?.findings as unknown[];
  assert.ok(findings.length >= 1);
  assert.equal(containsUnsafeSecret(codeReview), false);

  const architectureReview = await reviewArchitectureHandler({ summaryId });
  assert.equal(architectureReview.isError, undefined);
  const architectureReviewId = architectureReview.structuredContent?.architectureReviewId as string;
  assert.ok(architectureReviewId);
  assert.equal(containsUnsafeSecret(architectureReview), false);

  const packet = await exportEngineeringPacketHandler({
    summaryId,
    reviewIds: [codeReviewId, architectureReviewId],
    maxEvidenceItems: 10
  });
  assert.equal(packet.isError, undefined);
  assert.equal(packet.structuredContent?.title, "GPT-5.5 Pro Engineering Review Packet");
  assert.equal((packet.structuredContent?.pasteSafety as { rawSecretsIncluded: boolean }).rawSecretsIncluded, false);
  assert.equal(containsUnsafeSecret(packet), false);
});

test("review.export_engineering_packet requires an existing review", async () => {
  const selected = await selectContextHandler({
    sourceId: "fixture-github-service",
    target: { kind: "github_pr", pullNumber: 123 }
  });
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string });
  const packet = await exportEngineeringPacketHandler({
    summaryId: summarized.structuredContent?.summaryId as string,
    reviewIds: ["rev_code_0000000000000000"]
  });
  assert.equal(packet.isError, true);
  assert.equal((packet.structuredContent?.error as { code: string }).code, "REVIEW_NOT_FOUND");
});
