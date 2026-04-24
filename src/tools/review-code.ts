import { evidenceStore } from "../review/evidence-store.js";
import { buildCodeReview } from "../review/report-builder.js";
import { reviewCodeInputSchema } from "../types.js";
import { reviewCodeOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

export async function reviewCodeHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = reviewCodeInputSchema.parse(input);
    const summary = evidenceStore.getSummary(args.summaryId);
    if (!summary) return toolError("SUMMARY_NOT_FOUND", "Call review.summarize_changes before code review.");

    const review = buildCodeReview(summary, { maxFindings: args.maxFindings });
    evidenceStore.saveReview(review);

    const structuredContent = reviewCodeOutputSchema.parse({
        reviewId: review.reviewId,
        summaryId: review.summaryId,
        verdict: review.verdict,
        counts: review.counts,
        findings: review.findings,
        nextActions: review.nextActions
      });

    return ok(
      structuredContent,
      review.meta,
      "Code review completed."
    );
  } catch (error) {
    return toolError("REVIEW_CODE_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
