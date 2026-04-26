import { evidenceStore } from "../review/evidence-store.js";
import { buildCodexTaskProposal } from "../review/codex-task-proposal.js";
import { createCodexTaskProposalInputSchema } from "../types.js";
import { createCodexTaskProposalSuccessOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

export async function createCodexTaskProposalHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = createCodexTaskProposalInputSchema.parse(input);
    const summary = evidenceStore.getSummary(args.summaryId);
    if (!summary) return toolError("SUMMARY_NOT_FOUND", "Call review.summarize_changes before creating a Codex task proposal.");

    const reviews = args.reviewIds?.length
      ? args.reviewIds
          .map((id) => evidenceStore.getReview(id))
          .filter((review): review is NonNullable<typeof review> => Boolean(review))
      : evidenceStore.getReviewsForSummary(args.summaryId);
    if (reviews.length === 0) return toolError("REVIEW_NOT_FOUND", "Run review.review_code or review.review_architecture before creating a Codex task proposal.");

    const packet = args.packetId ? evidenceStore.getPacket(args.packetId) : undefined;
    if (args.packetId && !packet) {
      return toolError("PACKET_NOT_FOUND", "Call review.export_engineering_packet before referencing a packet in a Codex task proposal.", {
        nextActions: ["Call review.export_engineering_packet with the same summaryId and reviewIds, then retry review.create_codex_task_proposal."]
      });
    }

    const proposal = buildCodexTaskProposal(summary, reviews, packet, {
      proposalFocus: args.proposalFocus,
      maxTaskSlices: args.maxTaskSlices
    });
    const structuredContent = createCodexTaskProposalSuccessOutputSchema.parse(proposal.structuredContent);

    return ok(structuredContent, proposal.meta, "Codex task proposal generated.");
  } catch (error) {
    return toolError("CREATE_CODEX_TASK_PROPOSAL_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
