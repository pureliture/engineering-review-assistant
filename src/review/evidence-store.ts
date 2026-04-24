import type { ChangeSummary, ReviewContext, ReviewResult, PacketResult } from "../types.js";

export class EvidenceStore {
  private contexts = new Map<string, ReviewContext>();
  private summaries = new Map<string, ChangeSummary>();
  private reviews = new Map<string, ReviewResult>();
  private packets = new Map<string, PacketResult>();

  saveContext(context: ReviewContext): void {
    this.contexts.set(context.contextId, context);
  }

  getContext(contextId: string): ReviewContext | undefined {
    return this.contexts.get(contextId);
  }

  saveSummary(summary: ChangeSummary): void {
    this.summaries.set(summary.summaryId, summary);
  }

  getSummary(summaryId: string): ChangeSummary | undefined {
    return this.summaries.get(summaryId);
  }

  saveReview(review: ReviewResult): void {
    this.reviews.set(review.reviewId, review);
  }

  getReview(reviewId: string): ReviewResult | undefined {
    return this.reviews.get(reviewId);
  }

  getReviewsForSummary(summaryId: string): ReviewResult[] {
    return [...this.reviews.values()].filter((review) => review.summaryId === summaryId);
  }

  savePacket(packet: PacketResult): void {
    this.packets.set(packet.packetId, packet);
  }

  getPacket(packetId: string): PacketResult | undefined {
    return this.packets.get(packetId);
  }
}

export const evidenceStore = new EvidenceStore();
