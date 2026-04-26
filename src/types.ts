import { z } from "zod";

export const targetKindSchema = z.enum([
  "github_pr",
  "github_branch",
  "github_commit_range",
  "local_working_tree",
  "local_branch",
  "local_commit_range"
]);

export const sourceTypeSchema = z.enum(["local", "github"]);
export const severitySchema = z.enum(["critical", "important", "minor"]);
export const verdictSchema = z.enum(["low_risk", "needs_attention", "high_risk", "blocked"]);
export const findingCategorySchema = z.enum([
  "code_quality",
  "architecture",
  "tests",
  "security",
  "migration"
]);

export const safetyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  openWorldHint: false,
  idempotentHint: true
} as const;

const safeGitRef = /^[A-Za-z0-9][A-Za-z0-9._/@-]{0,255}$/;
const safePattern = /^[A-Za-z0-9][A-Za-z0-9._*?/@-]{0,159}$/;
const sha = /^[0-9a-f]{6,64}$/i;

const sourceIdSchema = z
  .string()
  .min(1)
  .max(128)
  .describe("Configured allowlisted sourceId from review.select_context. Do not pass file paths, repo URLs, or owner/repo strings.");

const contextIdSchema = z
  .string()
  .regex(/^ctx_[a-f0-9]{16}$/)
  .describe("Context id returned by review.select_context.");

const summaryIdSchema = z
  .string()
  .regex(/^sum_[a-f0-9]{16}$/)
  .describe("Summary id returned by review.summarize_changes.");

const reviewIdSchema = z
  .string()
  .regex(/^rev_(code|arch)_[a-f0-9]{16}$/)
  .describe("Review id returned by review.review_code or review.review_architecture.");

const gitRefSchema = z
  .string()
  .min(1)
  .max(256)
  .regex(safeGitRef)
  .refine((value) => !value.includes("..") && !value.endsWith(".lock") && !value.startsWith("-"), {
    message: "Git ref must be a simple branch, tag, or ref name without traversal-like syntax."
  })
  .describe("Git branch, tag, or ref name inside the configured repository.");

const shaSchema = z.string().regex(sha).describe("Git commit SHA, 6 to 64 hexadecimal characters.");

export const githubTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("github_pr"),
    pullNumber: z.number().int().positive().max(1_000_000).describe("GitHub pull request number in the configured repository.")
  }),
  z.object({
    kind: z.literal("github_branch"),
    baseRef: gitRefSchema.optional().describe("Optional base branch/ref. Defaults to the configured repository default branch."),
    headRef: gitRefSchema.describe("Head branch/ref to compare against the base ref.")
  }),
  z.object({
    kind: z.literal("github_commit_range"),
    baseSha: shaSchema.describe("Base Git commit SHA in the configured GitHub repository."),
    headSha: shaSchema.describe("Head Git commit SHA in the configured GitHub repository.")
  })
]).describe("GitHub PR, branch, or commit range target for an allowlisted GitHub source.");

export const localTargetSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("local_working_tree"),
    includeStaged: z.boolean().optional().describe("Whether to include staged local git changes. Defaults to true."),
    includeUnstaged: z.boolean().optional().describe("Whether to include unstaged local git changes. Defaults to true.")
  }),
  z.object({
    kind: z.literal("local_branch"),
    baseRef: gitRefSchema.optional().describe("Optional base branch/ref. Defaults to the configured repository default branch."),
    headRef: gitRefSchema.describe("Head branch/ref to compare against the base ref.")
  }),
  z.object({
    kind: z.literal("local_commit_range"),
    baseRef: gitRefSchema.describe("Base commit, branch, or ref in the configured local repository."),
    headRef: gitRefSchema.describe("Head commit, branch, or ref in the configured local repository.")
  })
]).describe("Local working tree, branch, or commit range target for an allowlisted local source.");

export const reviewTargetSchema = z
  .union([githubTargetSchema, localTargetSchema])
  .describe("Review target: GitHub PR, branch, commit range, or local working tree diff in the selected allowlisted source.");

export const selectContextInputSchema = z.object({
  sourceId: sourceIdSchema.optional(),
  target: reviewTargetSchema.optional().describe("PR, branch, commit range, or local working tree target to bind to the selected sourceId."),
  sourceType: z
    .enum(["local", "github", "all"])
    .optional()
    .describe("Filter configured sources by type when listing review sources. Defaults to all.")
});

export const summarizeChangesInputSchema = z.object({
  contextId: contextIdSchema,
  includeRepoDocs: z.boolean().optional().describe("Whether to include repository markdown docs and AGENTS.md guidance. Defaults to true."),
  includeCi: z
    .enum(["auto", "checks_only", "none"])
    .optional()
    .describe("CI evidence mode. auto prefers Checks summaries and minimal redacted failed excerpts; checks_only excludes Actions logs; none skips CI."),
  maxFiles: z.number().int().positive().max(500).optional().describe("Maximum changed files to inspect. Upper bound is 500."),
  maxDiffBytes: z.number().int().positive().max(1_000_000).optional().describe("Maximum raw diff bytes to load before redaction. Upper bound is 1 MB.")
});

export const reviewCodeInputSchema = z.object({
  summaryId: summaryIdSchema,
  focus: z.array(z.enum(["code_quality", "tests", "security", "migration"])).max(4).optional().describe("Optional focus areas for code review findings."),
  severityThreshold: severitySchema.optional().describe("Minimum severity to emphasize in the returned findings."),
  maxFindings: z.number().int().positive().max(20).optional().describe("Maximum findings to return in structuredContent. Upper bound is 20.")
});

export const reviewArchitectureInputSchema = z.object({
  summaryId: summaryIdSchema,
  includeDocPatterns: z
    .array(z.string().min(1).max(160).regex(safePattern))
    .max(10)
    .optional()
    .describe("Optional repo-relative markdown glob-like patterns for architecture docs. Absolute paths are not allowed."),
  focus: z.array(z.enum(["architecture", "migration", "tests", "operability"])).max(4).optional().describe("Optional focus areas for architecture review."),
  maxDocs: z.number().int().positive().max(25).optional().describe("Maximum repository markdown docs to include. Upper bound is 25.")
});

export const exportPacketInputSchema = z.object({
  summaryId: summaryIdSchema,
  reviewIds: z.array(reviewIdSchema).max(10).optional().describe("Optional review ids from review.review_code or review.review_architecture. Defaults to all reviews for summaryId."),
  packetFocus: z
    .enum(["full", "critical_only", "architecture", "tests", "migration", "security"])
    .optional()
    .describe("Packet focus for GPT-5.5 Pro handoff."),
  maxEvidenceItems: z.number().int().positive().max(100).optional().describe("Maximum redacted evidence items in _meta.packetMarkdown. Upper bound is 100.")
});

export const renderDashboardInputSchema = z.object({
  summaryId: summaryIdSchema,
  reviewIds: z.array(reviewIdSchema).max(10).optional().describe("Optional review ids to render. Defaults to all reviews for summaryId."),
  packetId: z.string().regex(/^packet_[a-f0-9]{16}$/).optional().describe("Optional packet id returned by review.export_engineering_packet."),
  includeDiffPreviews: z.boolean().optional().describe("Whether to include redacted diff previews in widget-only _meta. Defaults to true.")
});

export const createCodexTaskProposalInputSchema = z.object({
  summaryId: summaryIdSchema,
  reviewIds: z.array(reviewIdSchema).max(10).optional().describe("Optional review ids from review.review_code or review.review_architecture. Defaults to all reviews for summaryId."),
  packetId: z.string().regex(/^packet_[a-f0-9]{16}$/).optional().describe("Optional packet id returned by review.export_engineering_packet."),
  proposalFocus: z
    .enum(["full", "critical_only", "tests", "security", "migration", "architecture"])
    .optional()
    .describe("Focus for the Codex task proposal."),
  maxTaskSlices: z.number().int().positive().max(20).optional().describe("Maximum task slices to include. Upper bound is 20.")
});

export type SelectContextInput = z.infer<typeof selectContextInputSchema>;
export type SummarizeChangesInput = z.infer<typeof summarizeChangesInputSchema>;
export type ReviewCodeInput = z.infer<typeof reviewCodeInputSchema>;
export type ReviewArchitectureInput = z.infer<typeof reviewArchitectureInputSchema>;
export type ExportPacketInput = z.infer<typeof exportPacketInputSchema>;
export type RenderDashboardInput = z.infer<typeof renderDashboardInputSchema>;
export type CreateCodexTaskProposalInput = z.infer<typeof createCodexTaskProposalInputSchema>;
export type ReviewTarget = z.infer<typeof reviewTargetSchema>;
export type SourceType = z.infer<typeof sourceTypeSchema>;
export type TargetKind = z.infer<typeof targetKindSchema>;
export type Severity = z.infer<typeof severitySchema>;
export type Verdict = z.infer<typeof verdictSchema>;
export type FindingCategory = z.infer<typeof findingCategorySchema>;

export type ConfiguredSource = {
  id: string;
  type: SourceType;
  displayName: string;
  defaultBaseRef?: string;
  allowedTargets: TargetKind[];
  fixture?: boolean;
  root?: string;
  owner?: string;
  repo?: string;
};

export type EvidenceKind = "diff" | "file" | "doc" | "ci" | "git" | "test" | "policy";

export type EvidenceItem = {
  kind: EvidenceKind;
  path?: string;
  url?: string;
  excerpt?: string;
  redacted: boolean;
};

export type RedactionRecord = {
  kind: "token" | "credential" | "private_key" | "env_var" | "unknown_secret" | "private_path";
  path?: string;
  line?: number;
  value: "[REDACTED]";
  confidence: "low" | "medium" | "high";
};

export type PromptInjectionEvent = {
  sourceKind: "file" | "doc" | "comment" | "commit_message" | "test_output" | "ci_log";
  path?: string;
  evidenceRef?: string;
  pattern: string;
  action: "neutralized" | "blocked";
};

export type Finding = {
  id: string;
  severity: Severity;
  category: FindingCategory;
  title: string;
  evidenceRefs: string[];
  recommendation: string;
};

export type ReviewContext = {
  contextId: string;
  source: ConfiguredSource;
  target: ReviewTarget;
  displayRef: string;
  baseRef?: string;
  headRef?: string;
};

export type FileChange = {
  path: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch?: string;
};

export type ChangeData = {
  context: ReviewContext;
  files: FileChange[];
  rawDiffsByFile: Record<string, string>;
  gitMetadata: {
    baseRef?: string;
    headRef?: string;
    baseSha?: string;
    headSha?: string;
    commitMessages?: string[];
    changedFiles?: string[];
  };
  repoDocs: Array<{ path: string; excerpt: string }>;
  agentsGuidelines?: { path: string; excerpt: string };
  ciEvidence?: {
    checks?: unknown[];
    selectedLogExcerpts?: string[];
  };
};

export type ChangeSummary = {
  summaryId: string;
  context: ReviewContext;
  changeSummary: {
    filesChanged: number;
    additions?: number;
    deletions?: number;
    primaryAreas: string[];
    testFilesChanged: number;
    docsChanged: number;
    migrationSignals: string[];
    securitySignals: string[];
  };
  evidenceIndex: Record<string, EvidenceItem>;
  rawDiffsByFile: Record<string, string>;
  fileMap: Record<string, { status: string; additions?: number; deletions?: number }>;
  gitMetadata: ChangeData["gitMetadata"];
  ciEvidence?: ChangeData["ciEvidence"];
  repoDocs: Array<{ path: string; excerpt: string; evidenceRef: string }>;
  agentsGuidelines?: { path: string; excerpt: string; evidenceRef: string };
  redactions: RedactionRecord[];
  promptInjectionEvents: PromptInjectionEvent[];
};

export type ReviewResult = {
  reviewId: string;
  summaryId: string;
  verdict: Verdict;
  counts: {
    critical: number;
    important: number;
    minor: number;
    filesChanged: number;
    testsDetected: number;
    secretsRedacted: number;
  };
  findings: Finding[];
  nextActions: string[];
  meta: {
    evidenceIndex: Record<string, EvidenceItem>;
    codeSnippets?: Record<string, string>;
    dependencyTraces?: unknown[];
    ciEvidence?: ChangeData["ciEvidence"];
    redactions: RedactionRecord[];
    promptInjectionEvents: PromptInjectionEvent[];
    repoDocs?: Array<{ path: string; heading?: string; excerpt: string; evidenceRef: string }>;
  };
};

export type PacketResult = {
  packetId: string;
  summaryId: string;
  title: "GPT-5.5 Pro Engineering Review Packet";
  targetSummary: string;
  verdict: Verdict;
  findingCounts: { critical: number; important: number; minor: number };
  evidenceCount: number;
  redactionsCount: number;
  pasteSafety: {
    rawSecretsIncluded: false;
    repositoryInstructionsNeutralized: true;
  };
  packetMarkdown: string;
  evidenceManifest: Array<{
    evidenceRef: string;
    kind: string;
    path?: string;
    url?: string;
    excerpt: string;
  }>;
  redactions: RedactionRecord[];
  omittedEvidence: Array<{ reason: string; evidenceRef?: string }>;
};
