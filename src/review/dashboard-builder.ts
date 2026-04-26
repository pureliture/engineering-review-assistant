import { stableId } from "../id.js";
import { redactText } from "../policy/redaction.js";
import type { ChangeSummary, Finding, PacketResult, ReviewResult } from "../types.js";
import { severityRank, verdictForFindings } from "./change-signals.js";

function mergeCounts(summary: ChangeSummary, reviews: ReviewResult[]): ReviewResult["counts"] {
  const findings = reviews.flatMap((review) => review.findings);
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    important: findings.filter((finding) => finding.severity === "important").length,
    minor: findings.filter((finding) => finding.severity === "minor").length,
    filesChanged: summary.changeSummary.filesChanged,
    testsDetected: summary.changeSummary.testFilesChanged,
    secretsRedacted: summary.redactions.length
  };
}

function impactFor(additions = 0, deletions = 0): "low" | "medium" | "high" {
  const total = additions + deletions;
  if (total >= 80) return "high";
  if (total >= 20) return "medium";
  return "low";
}

function architectureRisk(summary: ChangeSummary, reviews: ReviewResult[]): "low" | "medium" | "high" | "unknown" {
  const architectureFindings = reviews.flatMap((review) => review.findings).filter((finding) => finding.category === "architecture");
  if (architectureFindings.some((finding) => finding.severity === "critical")) return "high";
  if (architectureFindings.some((finding) => finding.severity === "important")) return "medium";
  if (summary.repoDocs.length === 0 && summary.changeSummary.docsChanged === 0) return "unknown";
  return "low";
}

function migrationRisk(summary: ChangeSummary, reviews: ReviewResult[]): "low" | "medium" | "high" | "unknown" {
  const migrationFindings = reviews.flatMap((review) => review.findings).filter((finding) => finding.category === "migration");
  if (migrationFindings.some((finding) => finding.severity === "critical")) return "high";
  if (migrationFindings.some((finding) => finding.severity === "important")) return "medium";
  return summary.changeSummary.migrationSignals.length > 0 ? "medium" : "low";
}

function testGaps(summary: ChangeSummary, findings: Finding[]) {
  const testFindings = findings.filter((finding) => finding.category === "tests");
  if (testFindings.length > 0) {
    return testFindings.slice(0, 8).map((finding) => ({
      area: finding.title,
      severity: finding.severity,
      evidenceRefs: finding.evidenceRefs.slice(0, 5),
      recommendation: finding.recommendation
    }));
  }
  if (summary.changeSummary.testFilesChanged > 0) {
    return [
      {
        area: "Changed tests present",
        severity: "minor" as const,
        evidenceRefs: Object.keys(summary.evidenceIndex).slice(0, 3),
        recommendation: "Confirm tests cover the highest-risk changed behavior."
      }
    ];
  }
  return [
    {
      area: "No changed tests detected",
      severity: "important" as const,
      evidenceRefs: Object.keys(summary.evidenceIndex).slice(0, 3),
      recommendation: "Add focused tests for changed production behavior."
    }
  ];
}

export function buildDashboardPayload(
  summary: ChangeSummary,
  reviews: ReviewResult[],
  packet: PacketResult | undefined,
  options?: { includeDiffPreviews?: boolean }
): { structuredContent: Record<string, unknown>; meta: Record<string, unknown> } {
  const findings = reviews
    .flatMap((review) => review.findings)
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .slice(0, 12);
  const counts = mergeCounts(summary, reviews);
  const architecture = architectureRisk(summary, reviews);
  const migration = migrationRisk(summary, reviews);
  const topFiles = Object.entries(summary.fileMap).slice(0, 12).map(([filePath, stats]) => ({
    path: filePath,
    status: stats.status,
    additions: stats.additions,
    deletions: stats.deletions,
    impact: impactFor(stats.additions, stats.deletions)
  }));
  const diffPreviews = options?.includeDiffPreviews === false
    ? undefined
    : Object.fromEntries(
        Object.entries(summary.rawDiffsByFile).map(([filePath, diff]) => [
          filePath,
          redactText(diff, filePath).text.slice(0, 2_000)
        ])
      );

  return {
    structuredContent: {
      dashboardId: stableId("dash", {
        summaryId: summary.summaryId,
        reviewIds: reviews.map((review) => review.reviewId),
        packetId: packet?.packetId
      }),
      summaryId: summary.summaryId,
      target: {
        sourceId: summary.context.source.id,
        sourceType: summary.context.source.type,
        targetKind: summary.context.target.kind,
        displayRef: summary.context.displayRef,
        baseRef: summary.context.baseRef,
        headRef: summary.context.headRef
      },
      verdict: verdictForFindings(findings),
      changeSummary: summary.changeSummary,
      counts,
      findings,
      architecture: {
        architectureRisk: architecture,
        migrationRisk: migration,
        riskMatrix: [
          {
            area: "Architecture",
            risk: architecture,
            evidenceRefs: summary.repoDocs.map((doc) => doc.evidenceRef).slice(0, 5)
          },
          {
            area: "Migration",
            risk: migration,
            evidenceRefs: summary.changeSummary.migrationSignals.length > 0 ? Object.keys(summary.evidenceIndex).slice(0, 5) : []
          },
          {
            area: "Security",
            risk: counts.critical > 0 || summary.changeSummary.securitySignals.length > 0 ? "high" : "low",
            evidenceRefs: findings.filter((finding) => finding.category === "security").flatMap((finding) => finding.evidenceRefs).slice(0, 5)
          }
        ]
      },
      tests: {
        testsDetected: counts.testsDetected,
        testFilesChanged: summary.changeSummary.testFilesChanged,
        gaps: testGaps(summary, findings)
      },
      fileImpact: {
        totalFiles: summary.changeSummary.filesChanged,
        primaryAreas: summary.changeSummary.primaryAreas,
        topFiles
      },
      packetPreview: packet
        ? {
            available: true,
            title: packet.title,
            verdict: packet.verdict,
            evidenceCount: packet.evidenceCount,
            redactionsCount: packet.redactionsCount
          }
        : { available: false },
      warnings: summary.promptInjectionEvents.length > 0 ? ["Repository-originated instructions were neutralized."] : []
    },
    meta: {
      evidenceIndex: summary.evidenceIndex,
      fileMap: summary.fileMap,
      diffPreviews,
      ciEvidence: summary.ciEvidence,
      repoDocs: summary.repoDocs,
      redactions: summary.redactions,
      promptInjectionEvents: summary.promptInjectionEvents,
      packetMarkdownPreview: packet ? redactText(packet.packetMarkdown).text.slice(0, 6_000) : undefined
    }
  };
}
