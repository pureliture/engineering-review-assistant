import { z } from "zod";

const sourceType = z.enum(["local", "github"]);
const severity = z.enum(["critical", "important", "minor"]);
const verdict = z.enum(["low_risk", "needs_attention", "high_risk", "blocked"]);
const category = z.enum(["code_quality", "architecture", "tests", "security", "migration"]);

const finding = z.object({
  id: z.string(),
  severity,
  category,
  title: z.string(),
  evidenceRefs: z.array(z.string()).max(20),
  recommendation: z.string()
});

const selectedTarget = z.object({
  sourceId: z.string(),
  sourceType,
  displayName: z.string(),
  targetKind: z.string(),
  displayRef: z.string(),
  baseRef: z.string().optional(),
  headRef: z.string().optional()
});

const target = z.object({
  sourceId: z.string(),
  sourceType,
  targetKind: z.string(),
  displayRef: z.string(),
  baseRef: z.string().optional(),
  headRef: z.string().optional()
});

export const selectContextOutputSchema = z.object({
  contextId: z.string().optional(),
  selected: selectedTarget.optional(),
  availableSources: z.array(
    z.object({
      sourceId: z.string(),
      sourceType,
      displayName: z.string(),
      supportedTargets: z.array(z.string())
    })
  ),
  policySummary: z.object({
    readOnly: z.literal(true),
    arbitraryFilesystemScanning: z.literal(false),
    writesAllowed: z.literal(false)
  })
});

export const summarizeChangesOutputSchema = z.object({
  summaryId: z.string(),
  contextId: z.string(),
  target,
  changeSummary: z.object({
    filesChanged: z.number(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    primaryAreas: z.array(z.string()),
    testFilesChanged: z.number(),
    docsChanged: z.number(),
    migrationSignals: z.array(z.string()),
    securitySignals: z.array(z.string())
  }),
  evidenceCount: z.number(),
  evidenceRefs: z.array(z.string()).max(20),
  warnings: z.array(z.string())
});

export const reviewCodeOutputSchema = z.object({
  reviewId: z.string(),
  summaryId: z.string(),
  verdict,
  counts: z.object({
    critical: z.number(),
    important: z.number(),
    minor: z.number(),
    filesChanged: z.number(),
    testsDetected: z.number(),
    secretsRedacted: z.number()
  }),
  findings: z.array(finding),
  nextActions: z.array(z.string())
});

export const reviewArchitectureOutputSchema = z.object({
  architectureReviewId: z.string(),
  summaryId: z.string(),
  architectureRisk: z.enum(["low", "medium", "high", "unknown"]),
  migrationRisk: z.enum(["low", "medium", "high", "unknown"]),
  findings: z.array(finding),
  assumptions: z.array(z.string()),
  nextActions: z.array(z.string())
});

export const exportPacketOutputSchema = z.object({
  packetId: z.string(),
  summaryId: z.string(),
  title: z.literal("GPT-5.5 Pro Engineering Review Packet"),
  targetSummary: z.string(),
  verdict,
  findingCounts: z.object({
    critical: z.number(),
    important: z.number(),
    minor: z.number()
  }),
  evidenceCount: z.number(),
  redactionsCount: z.number(),
  pasteSafety: z.object({
    rawSecretsIncluded: z.literal(false),
    repositoryInstructionsNeutralized: z.literal(true)
  })
});

export const renderDashboardOutputSchema = z.object({
  dashboardId: z.string(),
  summaryId: z.string(),
  target,
  verdict,
  changeSummary: z.object({
    filesChanged: z.number(),
    additions: z.number().optional(),
    deletions: z.number().optional(),
    primaryAreas: z.array(z.string()),
    testFilesChanged: z.number(),
    docsChanged: z.number(),
    migrationSignals: z.array(z.string()),
    securitySignals: z.array(z.string())
  }),
  counts: z.object({
    critical: z.number(),
    important: z.number(),
    minor: z.number(),
    filesChanged: z.number(),
    testsDetected: z.number(),
    secretsRedacted: z.number()
  }),
  findings: z.array(finding).max(12),
  architecture: z.object({
    architectureRisk: z.enum(["low", "medium", "high", "unknown"]),
    migrationRisk: z.enum(["low", "medium", "high", "unknown"]),
    riskMatrix: z.array(
      z.object({
        area: z.string(),
        risk: z.enum(["low", "medium", "high", "unknown"]),
        evidenceRefs: z.array(z.string()).max(5)
      })
    )
  }),
  tests: z.object({
    testsDetected: z.number(),
    testFilesChanged: z.number(),
    gaps: z.array(
      z.object({
        area: z.string(),
        severity,
        evidenceRefs: z.array(z.string()).max(5),
        recommendation: z.string()
      })
    ).max(8)
  }),
  fileImpact: z.object({
    totalFiles: z.number(),
    primaryAreas: z.array(z.string()),
    topFiles: z.array(
      z.object({
        path: z.string(),
        status: z.string(),
        additions: z.number().optional(),
        deletions: z.number().optional(),
        impact: z.enum(["low", "medium", "high"])
      })
    ).max(12)
  }),
  packetPreview: z.object({
    available: z.boolean(),
    title: z.string().optional(),
    verdict: verdict.optional(),
    evidenceCount: z.number().optional(),
    redactionsCount: z.number().optional()
  }),
  warnings: z.array(z.string()).max(8)
});
