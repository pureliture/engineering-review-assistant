import { findSource, loadSourceRegistry } from "../config.js";
import { stableId } from "../id.js";
import { evidenceStore } from "../review/evidence-store.js";
import { selectContextInputSchema, type ReviewContext, type ReviewTarget, type SourceType, type TargetKind } from "../types.js";
import { selectContextSuccessOutputSchema } from "./output-schemas.js";
import { ok, toolError, type AppToolResult } from "./result.js";

function sourceKindHint(sourceId: string | undefined, target: ReviewTarget | undefined): "local" | "github" | "generic" {
  if (target?.kind.startsWith("local")) return "local";
  if (target?.kind.startsWith("github")) return "github";
  if (!sourceId) return "generic";
  if (/^(~|\/|\.{1,2}\/|[A-Za-z]:\\)/.test(sourceId)) return "local";
  if (/^https?:\/\/github\.com\//i.test(sourceId) || /^[^/]+\/[^/]+$/.test(sourceId)) return "github";
  return "generic";
}

function sourceNotConfiguredMessage(kind: "local" | "github" | "generic"): string {
  if (kind === "local") {
    return "The requested source is not in the local repository allowlist. This app accepts configured sourceId values only, not filesystem paths.";
  }
  if (kind === "github") {
    return "The requested source is not in the GitHub repository allowlist. This app accepts configured sourceId values only, not GitHub URLs or owner/repo strings.";
  }
  return "The requested sourceId is not configured in the repository allowlist.";
}

function sourceHints(registry: Awaited<ReturnType<typeof loadSourceRegistry>>): Array<{ sourceId: string; sourceType: SourceType; supportedTargets: TargetKind[] }> {
  return registry.sources.map((source) => ({
    sourceId: source.id,
    sourceType: source.type,
    supportedTargets: source.allowedTargets
  }));
}

function displayRef(target: ReviewTarget): string {
  switch (target.kind) {
    case "github_pr":
      return `PR #${target.pullNumber}`;
    case "github_branch":
    case "local_branch":
      return `${target.baseRef ?? "default"}...${target.headRef}`;
    case "github_commit_range":
      return `${target.baseSha}...${target.headSha}`;
    case "local_commit_range":
      return `${target.baseRef}...${target.headRef}`;
    case "local_working_tree":
      return "working tree diff";
  }
}

function targetRefs(sourceDefault: string | undefined, target: ReviewTarget): { baseRef?: string; headRef?: string } {
  switch (target.kind) {
    case "github_branch":
    case "local_branch":
      return { baseRef: target.baseRef ?? sourceDefault, headRef: target.headRef };
    case "github_commit_range":
      return { baseRef: target.baseSha, headRef: target.headSha };
    case "local_commit_range":
      return { baseRef: target.baseRef, headRef: target.headRef };
    case "github_pr":
      return { baseRef: sourceDefault, headRef: `pull/${target.pullNumber}` };
    case "local_working_tree":
      return { baseRef: sourceDefault, headRef: "working-tree" };
  }
}

export async function selectContextHandler(input: unknown): Promise<AppToolResult> {
  try {
    const args = selectContextInputSchema.parse(input);
    const registry = await loadSourceRegistry();
    const filteredSources = registry.sources.filter((source) => {
      if (!args.sourceType || args.sourceType === "all") return true;
      return source.type === args.sourceType;
    });

    if (!args.sourceId || !args.target) {
      const structuredContent = selectContextSuccessOutputSchema.parse({
          availableSources: filteredSources.map((source) => ({
            sourceId: source.id,
            sourceType: source.type,
            displayName: source.displayName,
            supportedTargets: source.allowedTargets
          })),
          policySummary: {
            readOnly: true,
            arbitraryFilesystemScanning: false,
            writesAllowed: false
          }
        });

      return ok(
        structuredContent,
        {
          redactedPolicy: {
            localSources: filteredSources
              .filter((source) => source.type === "local")
              .map((source) => ({ sourceId: source.id, rootLabel: source.fixture ? "<fixture>" : "<configured>" })),
            githubSources: filteredSources
              .filter((source) => source.type === "github")
              .map((source) => ({ sourceId: source.id, owner: source.owner, repo: source.repo }))
          },
          fixturesEnabled: registry.fixturesEnabled
        },
        "Configured review sources are ready."
      );
    }

    const source = findSource(registry, args.sourceId);
    if (!source) {
      const kind = sourceKindHint(args.sourceId, args.target);
      return toolError("SOURCE_NOT_CONFIGURED", sourceNotConfiguredMessage(kind), {
        requestedSourceKind: kind,
        configuredSources: sourceHints(registry),
        nextActions: [
          "Call review.select_context without a target to list configured sourceId values.",
          "Use one of the returned sourceId values; do not pass paths, GitHub URLs, or owner/repo strings."
        ]
      });
    }
    if (!source.allowedTargets.includes(args.target.kind as TargetKind)) {
      return toolError("TARGET_KIND_UNSUPPORTED", "The target kind is not allowed for this source.", {
        sourceId: source.id,
        sourceType: source.type,
        targetKind: args.target.kind,
        supportedTargets: source.allowedTargets,
        nextActions: ["Choose one supported target kind for this sourceId, or select a different configured source."]
      });
    }
    if ((args.target.kind.startsWith("github") && source.type !== "github") || (args.target.kind.startsWith("local") && source.type !== "local")) {
      return toolError("SOURCE_TARGET_TYPE_MISMATCH", "The target kind does not match the configured source type.", {
        sourceId: source.id,
        sourceType: source.type,
        targetKind: args.target.kind,
        nextActions: ["Use local_* targets for local sources and github_* targets for GitHub sources."]
      });
    }

    const refs = targetRefs(source.defaultBaseRef, args.target);
    const context: ReviewContext = {
      contextId: stableId("ctx", { sourceId: source.id, target: args.target }),
      source,
      target: args.target,
      displayRef: displayRef(args.target),
      baseRef: refs.baseRef,
      headRef: refs.headRef
    };
    evidenceStore.saveContext(context);

    const structuredContent = selectContextSuccessOutputSchema.parse({
        contextId: context.contextId,
        selected: {
          sourceId: source.id,
          sourceType: source.type as SourceType,
          displayName: source.displayName,
          targetKind: args.target.kind,
          displayRef: context.displayRef,
          baseRef: context.baseRef,
          headRef: context.headRef
        },
        availableSources: filteredSources.map((candidate) => ({
          sourceId: candidate.id,
          sourceType: candidate.type,
          displayName: candidate.displayName,
          supportedTargets: candidate.allowedTargets
        })),
        policySummary: {
          readOnly: true,
          arbitraryFilesystemScanning: false,
          writesAllowed: false
        }
      });

    return ok(
      structuredContent,
      {
        resolvedTarget: {
          sourceId: source.id,
          canonicalSourceKey: source.type === "github" ? `${source.owner}/${source.repo}` : source.id,
          defaultBaseRef: source.defaultBaseRef
        }
      },
      "Review context selected."
    );
  } catch (error) {
    return toolError("SELECT_CONTEXT_FAILED", error instanceof Error ? error.message : "Unknown error");
  }
}
