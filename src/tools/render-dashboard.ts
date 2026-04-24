import { buildDashboardPayload } from "../review/dashboard-builder.js";
import { evidenceStore } from "../review/evidence-store.js";
import { renderDashboardInputSchema } from "../types.js";
import { renderDashboardOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

export async function renderDashboardHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = renderDashboardInputSchema.parse(input);
    const summary = evidenceStore.getSummary(args.summaryId);
    if (!summary) return toolError("SUMMARY_NOT_FOUND", "Call review.summarize_changes before rendering the dashboard.");

    const reviews = args.reviewIds?.length
      ? args.reviewIds
          .map((id) => evidenceStore.getReview(id))
          .filter((review): review is NonNullable<typeof review> => Boolean(review))
      : evidenceStore.getReviewsForSummary(args.summaryId);
    if (reviews.length === 0) return toolError("REVIEW_NOT_FOUND", "Run review.review_code or review.review_architecture before rendering the dashboard.");

    const packet = args.packetId ? evidenceStore.getPacket(args.packetId) : undefined;
    if (args.packetId && !packet) {
      return toolError("PACKET_NOT_FOUND", "Call review.export_engineering_packet before rendering a packet preview.", {
        nextActions: ["Call review.export_engineering_packet with the same summaryId and reviewIds, then retry review.render_dashboard."]
      });
    }

    const dashboard = buildDashboardPayload(summary, reviews, packet, {
      includeDiffPreviews: args.includeDiffPreviews ?? true
    });
    const structuredContent = renderDashboardOutputSchema.parse(dashboard.structuredContent);

    return ok(structuredContent, dashboard.meta, "Repository review dashboard ready.");
  } catch (error) {
    return toolError("RENDER_DASHBOARD_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
