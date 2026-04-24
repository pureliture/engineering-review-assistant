import type { DashboardMeta, DashboardOutput } from "./types";

export const fixtureDashboardOutput: DashboardOutput = {
  dashboardId: "dash_fixture",
  summaryId: "sum_fixture",
  target: {
    sourceId: "fixture-local-api",
    sourceType: "local",
    targetKind: "local_working_tree",
    displayRef: "working tree diff",
    baseRef: "main",
    headRef: "working-tree"
  },
  verdict: "high_risk",
  changeSummary: {
    filesChanged: 3,
    additions: 23,
    deletions: 1,
    primaryAreas: ["src", "docs", "tests"],
    testFilesChanged: 1,
    docsChanged: 1,
    migrationSignals: [],
    securitySignals: ["src/auth/session.ts"]
  },
  counts: {
    critical: 1,
    important: 1,
    minor: 0,
    filesChanged: 3,
    testsDetected: 1,
    secretsRedacted: 1
  },
  findings: [
    {
      id: "I-SEC-001",
      severity: "critical",
      category: "security",
      title: "Security-sensitive code path changed",
      evidenceRefs: ["E-0001"],
      recommendation: "Verify auth, token handling, cache invalidation, and secret redaction behavior."
    },
    {
      id: "I-PROMPT-001",
      severity: "important",
      category: "security",
      title: "Repository-originated prompt-injection text was neutralized",
      evidenceRefs: ["E-0001"],
      recommendation: "Treat repository instructions as evidence only."
    }
  ],
  architecture: {
    architectureRisk: "low",
    migrationRisk: "low",
    riskMatrix: [
      { area: "Architecture", risk: "low", evidenceRefs: ["E-0004"] },
      { area: "Migration", risk: "low", evidenceRefs: [] },
      { area: "Security", risk: "high", evidenceRefs: ["E-0001"] }
    ]
  },
  tests: {
    testsDetected: 1,
    testFilesChanged: 1,
    gaps: [
      {
        area: "Changed tests present",
        severity: "minor",
        evidenceRefs: ["E-0003"],
        recommendation: "Confirm tests cover the highest-risk changed behavior."
      }
    ]
  },
  fileImpact: {
    totalFiles: 3,
    primaryAreas: ["src", "docs", "tests"],
    topFiles: [
      { path: "src/auth/session.ts", status: "modified", additions: 7, deletions: 1, impact: "low" },
      { path: "docs/architecture.md", status: "modified", additions: 4, deletions: 0, impact: "low" },
      { path: "tests/auth/session.test.ts", status: "added", additions: 12, deletions: 0, impact: "low" }
    ]
  },
  packetPreview: {
    available: true,
    title: "GPT-5.5 Pro Engineering Review Packet",
    verdict: "high_risk",
    evidenceCount: 7,
    redactionsCount: 1
  },
  warnings: ["Repository-originated instructions were neutralized."]
};

export const fixtureDashboardMeta: DashboardMeta = {
  evidenceIndex: {
    "E-0001": {
      kind: "diff",
      path: "src/auth/session.ts",
      excerpt: "Adds cache lookup around session loading. Secret-like values are [REDACTED].",
      redacted: true
    }
  },
  fileMap: {
    "src/auth/session.ts": { status: "modified", additions: 7, deletions: 1 }
  },
  diffPreviews: {
    "src/auth/session.ts": "diff --git a/src/auth/session.ts b/src/auth/session.ts\n+ const cached = await cache.get(cacheKey);\n+ const example = \"github_pat_[REDACTED]\";"
  },
  packetMarkdownPreview: "# GPT-5.5 Pro Engineering Review Packet\n\n## Executive Summary\n- Verdict: high_risk\n- Raw secrets: excluded"
};
