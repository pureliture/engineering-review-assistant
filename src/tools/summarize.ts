import { buildChangeSummary } from "../review/report-builder.js";
import { evidenceStore } from "../review/evidence-store.js";
import { loadChangeData } from "../sources/registry.js";
import { summarizeChangesInputSchema } from "../types.js";
import { summarizeChangesSuccessOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

export async function summarizeChangesHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = summarizeChangesInputSchema.parse(input);
    const context = evidenceStore.getContext(args.contextId);
    if (!context) return toolError("CONTEXT_NOT_FOUND", "Call review.select_context before summarizing changes.");

    const changeData = await loadChangeData(context, {
      includeRepoDocs: args.includeRepoDocs ?? true,
      includeCi: args.includeCi ?? "auto"
    });
    const summary = buildChangeSummary(changeData);
    evidenceStore.saveSummary(summary);

    const structuredContent = summarizeChangesSuccessOutputSchema.parse({
        summaryId: summary.summaryId,
        contextId: context.contextId,
        target: {
          sourceId: context.source.id,
          sourceType: context.source.type,
          targetKind: context.target.kind,
          displayRef: context.displayRef,
          baseRef: context.baseRef,
          headRef: context.headRef
        },
        changeSummary: summary.changeSummary,
        evidenceCount: Object.keys(summary.evidenceIndex).length,
        evidenceRefs: Object.keys(summary.evidenceIndex).slice(0, 20),
        warnings: summary.promptInjectionEvents.length > 0 ? ["Repository-originated instructions were neutralized."] : []
      });

    return ok(
      structuredContent,
      {
        evidenceIndex: summary.evidenceIndex,
        rawDiffsByFile: summary.rawDiffsByFile,
        fileMap: summary.fileMap,
        gitMetadata: summary.gitMetadata,
        ciEvidence: summary.ciEvidence,
        repoDocs: summary.repoDocs,
        agentsGuidelines: summary.agentsGuidelines,
        redactions: summary.redactions,
        promptInjectionEvents: summary.promptInjectionEvents
      },
      "Repository changes summarized."
    );
  } catch (error) {
    return toolError("SUMMARIZE_CHANGES_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
