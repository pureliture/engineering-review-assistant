import assert from "node:assert/strict";
import test from "node:test";
import "../helpers/fixture-env.js";
import { containsUnsafeSecret } from "../../src/policy/redaction.js";
import { exportEngineeringPacketHandler } from "../../src/tools/export-packet.js";
import { reviewArchitectureHandler } from "../../src/tools/review-architecture.js";
import { reviewCodeHandler } from "../../src/tools/review-code.js";
import { selectContextHandler } from "../../src/tools/context.js";
import { summarizeChangesHandler } from "../../src/tools/summarize.js";

async function summarizeFixture(target: unknown) {
  const selected = await selectContextHandler({ sourceId: "fixture-local-api", target });
  assert.equal(selected.isError, undefined);
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string, includeCi: "auto" });
  assert.equal(summarized.isError, undefined);
  assert.equal(containsUnsafeSecret(summarized), false);
  return summarized;
}

test("golden direct prompts map to local working tree, branch, commit range, and packet flows", async () => {
  const workingTree = await summarizeFixture({ kind: "local_working_tree", includeStaged: true, includeUnstaged: true });
  assert.equal(workingTree.structuredContent?.target && (workingTree.structuredContent.target as { targetKind: string }).targetKind, "local_working_tree");

  const branch = await summarizeFixture({ kind: "local_branch", baseRef: "main", headRef: "feat/cache" });
  assert.equal(branch.structuredContent?.target && (branch.structuredContent.target as { targetKind: string }).targetKind, "local_branch");

  const commitRange = await summarizeFixture({ kind: "local_commit_range", baseRef: "main", headRef: "HEAD" });
  assert.equal(commitRange.structuredContent?.target && (commitRange.structuredContent.target as { targetKind: string }).targetKind, "local_commit_range");

  const codeReview = await reviewCodeHandler({ summaryId: workingTree.structuredContent?.summaryId as string });
  const architectureReview = await reviewArchitectureHandler({ summaryId: workingTree.structuredContent?.summaryId as string });
  const packet = await exportEngineeringPacketHandler({
    summaryId: workingTree.structuredContent?.summaryId as string,
    reviewIds: [
      codeReview.structuredContent?.reviewId as string,
      architectureReview.structuredContent?.architectureReviewId as string
    ],
    packetFocus: "full"
  });

  assert.equal(packet.isError, undefined);
  assert.equal((packet.structuredContent?.pasteSafety as { rawSecretsIncluded: boolean }).rawSecretsIncluded, false);
  assert.equal(containsUnsafeSecret(packet), false);
});

test("golden GitHub PR fixture flow succeeds without live GitHub access", async () => {
  const selected = await selectContextHandler({
    sourceId: "fixture-github-service",
    target: { kind: "github_pr", pullNumber: 123 }
  });
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string });
  const review = await reviewCodeHandler({ summaryId: summarized.structuredContent?.summaryId as string });

  assert.equal(review.isError, undefined);
  assert.equal(review.structuredContent?.verdict, "high_risk");
  assert.equal(containsUnsafeSecret(review), false);
});

test("golden negative prompts are blocked at tool boundary", async () => {
  const unknown = await selectContextHandler({
    sourceId: "not-configured",
    target: { kind: "local_working_tree" }
  });
  assert.equal(unknown.isError, true);
  assert.equal((unknown.structuredContent?.error as { code: string }).code, "SOURCE_NOT_CONFIGURED");

  const mismatch = await selectContextHandler({
    sourceId: "fixture-local-api",
    target: { kind: "github_pr", pullNumber: 123 }
  });
  assert.equal(mismatch.isError, true);
  assert.equal((mismatch.structuredContent?.error as { code: string }).code, "TARGET_KIND_UNSUPPORTED");
});
