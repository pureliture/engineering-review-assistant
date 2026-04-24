import { evidenceStore } from "../review/evidence-store.js";
import { buildEngineeringPacket } from "../review/packet-builder.js";
import { exportPacketInputSchema } from "../types.js";
import { exportPacketOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

export async function exportEngineeringPacketHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = exportPacketInputSchema.parse(input);
    const summary = evidenceStore.getSummary(args.summaryId);
    if (!summary) return toolError("SUMMARY_NOT_FOUND", "Call review.summarize_changes before exporting a packet.");

    const reviews = args.reviewIds?.length
      ? args.reviewIds
          .map((id) => evidenceStore.getReview(id))
          .filter((review): review is NonNullable<typeof review> => Boolean(review))
      : evidenceStore.getReviewsForSummary(args.summaryId);
    if (reviews.length === 0) return toolError("REVIEW_NOT_FOUND", "Run review.review_code or review.review_architecture before exporting.");

    const packet = buildEngineeringPacket(summary, reviews, args.maxEvidenceItems);
    evidenceStore.savePacket(packet);

    const structuredContent = exportPacketOutputSchema.parse({
        packetId: packet.packetId,
        summaryId: packet.summaryId,
        title: packet.title,
        targetSummary: packet.targetSummary,
        verdict: packet.verdict,
        findingCounts: packet.findingCounts,
        evidenceCount: packet.evidenceCount,
        redactionsCount: packet.redactionsCount,
        pasteSafety: packet.pasteSafety
      });

    return ok(
      structuredContent,
      {
        packetMarkdown: packet.packetMarkdown,
        evidenceManifest: packet.evidenceManifest,
        redactions: packet.redactions,
        omittedEvidence: packet.omittedEvidence
      },
      "GPT-5.5 Pro engineering review packet generated."
    );
  } catch (error) {
    return toolError("EXPORT_PACKET_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
