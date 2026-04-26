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

const toolErrorOutputSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    nextActions: z.array(z.string())
  }),
  redactions: z.object({
    count: z.number()
  })
});

function withToolError<T extends z.ZodObject<z.ZodRawShape>>(schema: T) {
  return schema.partial().extend({
    error: toolErrorOutputSchema.shape.error.optional(),
    redactions: toolErrorOutputSchema.shape.redactions.optional()
  });
}

export const selectContextSuccessOutputSchema = z.object({
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

export const summarizeChangesSuccessOutputSchema = z.object({
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

export const reviewCodeSuccessOutputSchema = z.object({
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

export const reviewArchitectureSuccessOutputSchema = z.object({
  architectureReviewId: z.string(),
  summaryId: z.string(),
  architectureRisk: z.enum(["low", "medium", "high", "unknown"]),
  migrationRisk: z.enum(["low", "medium", "high", "unknown"]),
  findings: z.array(finding),
  assumptions: z.array(z.string()),
  nextActions: z.array(z.string())
});

export const exportPacketSuccessOutputSchema = z.object({
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

export const createCodexTaskProposalSuccessOutputSchema = z.object({
  proposalId: z.string(),
  summaryId: z.string(),
  packetId: z.string().optional(),
  title: z.literal("Codex Task Proposal"),
  targetSummary: z.string(),
  recommendedExecutionMode: z.enum(["separate_worktree", "separate_branch"]),
  findingIds: z.array(z.string()),
  taskSliceCount: z.number(),
  validationCommandCount: z.number(),
  humanConfirmationCount: z.number(),
  requiredApprovalGates: z.array(z.string()),
  writeActionsIncluded: z.literal(false),
  pasteSafety: z.object({
    rawSecretsIncluded: z.literal(false),
    repositoryInstructionsNeutralized: z.literal(true)
  })
});

export const renderDashboardSuccessOutputSchema = z.object({
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

export const selectContextOutputSchema = withToolError(selectContextSuccessOutputSchema);
export const summarizeChangesOutputSchema = withToolError(summarizeChangesSuccessOutputSchema);
export const reviewCodeOutputSchema = withToolError(reviewCodeSuccessOutputSchema);
export const reviewArchitectureOutputSchema = withToolError(reviewArchitectureSuccessOutputSchema);
export const exportPacketOutputSchema = withToolError(exportPacketSuccessOutputSchema);
export const createCodexTaskProposalOutputSchema = withToolError(createCodexTaskProposalSuccessOutputSchema);
export const renderDashboardOutputSchema = withToolError(renderDashboardSuccessOutputSchema);
