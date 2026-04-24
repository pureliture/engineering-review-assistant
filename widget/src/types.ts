export type Severity = "critical" | "important" | "minor";
export type Risk = "low" | "medium" | "high" | "unknown";

export type Finding = {
  id: string;
  severity: Severity;
  category: "code_quality" | "architecture" | "tests" | "security" | "migration";
  title: string;
  evidenceRefs: string[];
  recommendation: string;
};

export type DashboardOutput = {
  dashboardId: string;
  summaryId: string;
  target: {
    sourceId: string;
    sourceType: "local" | "github";
    targetKind: string;
    displayRef: string;
    baseRef?: string;
    headRef?: string;
  };
  verdict: "low_risk" | "needs_attention" | "high_risk" | "blocked";
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
  counts: {
    critical: number;
    important: number;
    minor: number;
    filesChanged: number;
    testsDetected: number;
    secretsRedacted: number;
  };
  findings: Finding[];
  architecture: {
    architectureRisk: Risk;
    migrationRisk: Risk;
    riskMatrix: Array<{ area: string; risk: Risk; evidenceRefs: string[] }>;
  };
  tests: {
    testsDetected: number;
    testFilesChanged: number;
    gaps: Array<{ area: string; severity: Severity; evidenceRefs: string[]; recommendation: string }>;
  };
  fileImpact: {
    totalFiles: number;
    primaryAreas: string[];
    topFiles: Array<{ path: string; status: string; additions?: number; deletions?: number; impact: "low" | "medium" | "high" }>;
  };
  packetPreview: {
    available: boolean;
    title?: string;
    verdict?: string;
    evidenceCount?: number;
    redactionsCount?: number;
  };
  warnings: string[];
};

export type DashboardMeta = {
  evidenceIndex?: Record<string, { kind: string; path?: string; excerpt?: string; redacted?: boolean }>;
  fileMap?: Record<string, { status: string; additions?: number; deletions?: number }>;
  diffPreviews?: Record<string, string>;
  packetMarkdownPreview?: string;
};

export type WidgetPayload = {
  structuredContent: DashboardOutput;
  meta: DashboardMeta;
};
