import assert from "node:assert/strict";
import test from "node:test";
import "../helpers/fixture-env.js";
import { containsUnsafeSecret } from "../../src/policy/redaction.js";
import { selectContextHandler } from "../../src/tools/context.js";
import { reviewCodeHandler } from "../../src/tools/review-code.js";
import { summarizeChangesHandler } from "../../src/tools/summarize.js";

test("summarize_changes keeps raw evidence out of structuredContent", async () => {
  const selected = await selectContextHandler({
    sourceId: "fixture-local-api",
    target: { kind: "local_working_tree", includeStaged: true, includeUnstaged: true }
  });
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string });

  assert.equal(summarized.isError, undefined);
  assert.equal(containsUnsafeSecret(summarized), false);
  assert.equal("rawDiffsByFile" in (summarized.structuredContent ?? {}), false);
  assert.equal("fileMap" in (summarized.structuredContent ?? {}), false);
  assert.ok(summarized._meta?.rawDiffsByFile);
  assert.ok(summarized._meta?.fileMap);
  assert.ok(JSON.stringify(summarized.structuredContent).length < 2500);
});

test("allowlist errors explain recovery without exposing local paths", async () => {
  const localResult = await selectContextHandler({
    sourceId: "/Users/example/Projects/private-repo",
    target: { kind: "local_working_tree" }
  });

  assert.equal(localResult.isError, true);
  assert.equal(containsUnsafeSecret(localResult), false);
  assert.equal((localResult.structuredContent?.error as { code: string }).code, "SOURCE_NOT_CONFIGURED");
  assert.match((localResult.structuredContent?.error as { message: string }).message, /local repository allowlist/);
  assert.match(JSON.stringify(localResult.structuredContent), /review.select_context/);
  assert.doesNotMatch(JSON.stringify(localResult), /\/Users\/example/);

  const githubResult = await selectContextHandler({
    sourceId: "https://github.com/example/private-repo",
    target: { kind: "github_pr", pullNumber: 123 }
  });

  assert.equal(githubResult.isError, true);
  assert.equal(containsUnsafeSecret(githubResult), false);
  assert.equal((githubResult.structuredContent?.error as { code: string }).code, "SOURCE_NOT_CONFIGURED");
  assert.match((githubResult.structuredContent?.error as { message: string }).message, /GitHub repository allowlist/);
  assert.match(JSON.stringify(githubResult.structuredContent), /sourceId/);
});

test("tool errors include actionable next steps for missing dependencies", async () => {
  const result = await reviewCodeHandler({ summaryId: "sum_0000000000000000" });

  assert.equal(result.isError, true);
  assert.equal(containsUnsafeSecret(result), false);
  assert.equal((result.structuredContent?.error as { code: string }).code, "SUMMARY_NOT_FOUND");
  assert.match(JSON.stringify(result.structuredContent), /review.summarize_changes/);
});

test("review findings do not repeat evidence refs in structuredContent", async () => {
  const selected = await selectContextHandler({
    sourceId: "fixture-local-api",
    target: { kind: "local_working_tree", includeStaged: true, includeUnstaged: true }
  });
  const summarized = await summarizeChangesHandler({ contextId: selected.structuredContent?.contextId as string });
  const review = await reviewCodeHandler({ summaryId: summarized.structuredContent?.summaryId as string });
  const findings = review.structuredContent?.findings as Array<{ evidenceRefs: string[] }>;

  for (const finding of findings) {
    assert.deepEqual(finding.evidenceRefs, [...new Set(finding.evidenceRefs)]);
  }
});
