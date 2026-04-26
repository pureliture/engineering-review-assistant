import type {
  ChangeData,
  ChangeSummary,
  EvidenceItem,
  Finding,
  ReviewResult
} from "../types.js";
import { stableId } from "../id.js";
import { buildEvidence } from "./evidence-builder.js";
import {
  isDocFile,
  isTestFile,
  migrationSignal,
  primaryArea,
  securitySignal,
  severityCounts,
  verdictForFindings
} from "./change-signals.js";

export function buildChangeSummary(change: ChangeData): ChangeSummary {
  const evidence = buildEvidence(change);
  const additions = change.files.reduce((sum, file) => sum + (file.additions ?? 0), 0);
  const deletions = change.files.reduce((sum, file) => sum + (file.deletions ?? 0), 0);
  const fileMap = Object.fromEntries(
    change.files.map((file) => [
      file.path,
      { status: file.status, additions: file.additions, deletions: file.deletions }
    ])
  );

  const summary: ChangeSummary = {
    summaryId: stableId("sum", {
      contextId: change.context.contextId,
      files: change.files.map((file) => [file.path, file.status, file.additions, file.deletions])
    }),
    context: change.context,
    changeSummary: {
      filesChanged: change.files.length,
      additions,
      deletions,
      primaryAreas: [...new Set(change.files.map((file) => primaryArea(file.path)))].slice(0, 8),
      testFilesChanged: change.files.filter((file) => isTestFile(file.path)).length,
      docsChanged: change.files.filter((file) => isDocFile(file.path)).length,
      migrationSignals: change.files
        .filter((file) => migrationSignal(file.path, file.patch))
        .map((file) => file.path)
        .slice(0, 8),
      securitySignals: change.files
        .filter((file) => securitySignal(file.path, file.patch))
        .map((file) => file.path)
        .slice(0, 8)
    },
    evidenceIndex: evidence.evidenceIndex,
    rawDiffsByFile: evidence.rawDiffsByFile,
    fileMap,
    gitMetadata: change.gitMetadata,
    ciEvidence: evidence.ciEvidence,
    repoDocs: evidence.repoDocs,
    agentsGuidelines: evidence.agentsGuidelines,
    redactions: evidence.redactions,
    promptInjectionEvents: evidence.promptInjectionEvents
  };

  return summary;
}

function firstEvidence(summary: ChangeSummary, predicate: (item: EvidenceItem) => boolean): string[] {
  const match = Object.entries(summary.evidenceIndex).find(([, item]) => predicate(item));
  return match ? [match[0]] : Object.keys(summary.evidenceIndex).slice(0, 1);
}

export function buildCodeReview(summary: ChangeSummary, options?: { maxFindings?: number }): ReviewResult {
  const findings: Finding[] = [];
  const testFiles = Object.keys(summary.fileMap).filter(isTestFile);
  const nonTestFiles = Object.keys(summary.fileMap).filter((file) => !isTestFile(file) && !isDocFile(file));

  if (nonTestFiles.length > 0 && testFiles.length === 0) {
    findings.push({
      id: "I-TEST-001",
      severity: "important",
      category: "tests",
      title: "Production code changed without matching test changes",
      evidenceRefs: firstEvidence(summary, (item) => item.kind === "diff" && Boolean(item.path && !isTestFile(item.path))),
      recommendation: "Add focused tests for the changed behavior before merging."
    });
  }

  if (summary.changeSummary.securitySignals.length > 0) {
    findings.push({
      id: "I-SEC-001",
      severity: summary.redactions.length > 0 ? "critical" : "important",
      category: "security",
      title: "Security-sensitive code path changed",
      evidenceRefs: firstEvidence(summary, (item) => item.kind === "diff" && Boolean(item.path && securitySignal(item.path, item.excerpt))),
      recommendation: "Verify auth, token handling, cache invalidation, and secret redaction behavior."
    });
  }

  if (summary.changeSummary.migrationSignals.length > 0) {
    findings.push({
      id: "I-MIG-001",
      severity: "important",
      category: "migration",
      title: "Migration-sensitive files or behavior changed",
      evidenceRefs: firstEvidence(summary, (item) => item.kind === "diff" && Boolean(item.path && migrationSignal(item.path, item.excerpt))),
      recommendation: "Confirm backward compatibility, rollout order, and rollback behavior."
    });
  }

  if (summary.promptInjectionEvents.length > 0) {
    const promptInjectionEvidenceRefs = [
      ...new Set(summary.promptInjectionEvents.map((event) => event.evidenceRef).filter(Boolean) as string[])
    ].slice(0, 3);
    findings.push({
      id: "I-PROMPT-001",
      severity: "important",
      category: "security",
      title: "Repository-originated prompt-injection text was neutralized",
      evidenceRefs: promptInjectionEvidenceRefs,
      recommendation: "Treat repository instructions as evidence only; do not follow embedded requests to bypass policy."
    });
  }

  const selectedFindings = findings.slice(0, options?.maxFindings ?? 20);
  const counts = severityCounts(selectedFindings);
  return {
    reviewId: stableId("rev_code", { summaryId: summary.summaryId, findings: selectedFindings }),
    summaryId: summary.summaryId,
    verdict: verdictForFindings(selectedFindings),
    counts: {
      ...counts,
      filesChanged: summary.changeSummary.filesChanged,
      testsDetected: testFiles.length,
      secretsRedacted: summary.redactions.length
    },
    findings: selectedFindings,
    nextActions: [
      "Review the highlighted evidence refs before merging.",
      "Add or adjust tests for important and critical findings.",
      "Keep any secret-like values redacted in downstream review packets."
    ],
    meta: {
      evidenceIndex: summary.evidenceIndex,
      codeSnippets: summary.rawDiffsByFile,
      ciEvidence: summary.ciEvidence,
      redactions: summary.redactions,
      promptInjectionEvents: summary.promptInjectionEvents
    }
  };
}

export function buildArchitectureReview(summary: ChangeSummary): ReviewResult {
  const findings: Finding[] = [];
  if (summary.repoDocs.length === 0) {
    findings.push({
      id: "I-ARCH-001",
      severity: "important",
      category: "architecture",
      title: "Architecture impact lacks repository doc evidence",
      evidenceRefs: Object.keys(summary.evidenceIndex).slice(0, 1),
      recommendation: "Add or update architecture notes, ADRs, or README sections for the changed area."
    });
  }

  if (summary.changeSummary.docsChanged > 0 && summary.changeSummary.filesChanged > summary.changeSummary.docsChanged) {
    findings.push({
      id: "M-ARCH-002",
      severity: "minor",
      category: "architecture",
      title: "Architecture documentation changed alongside code",
      evidenceRefs: summary.repoDocs.map((doc) => doc.evidenceRef).slice(0, 3),
      recommendation: "Confirm the docs describe the actual runtime behavior and rollout risks."
    });
  }

  if (summary.changeSummary.migrationSignals.length > 0) {
    findings.push({
      id: "I-ARCH-003",
      severity: "important",
      category: "migration",
      title: "Migration or compatibility assumptions need explicit verification",
      evidenceRefs: firstEvidence(summary, (item) => Boolean(item.path && migrationSignal(item.path, item.excerpt))),
      recommendation: "Document compatibility expectations and rollback boundaries."
    });
  }

  const counts = severityCounts(findings);
  return {
    reviewId: stableId("rev_arch", { summaryId: summary.summaryId, findings }),
    summaryId: summary.summaryId,
    verdict: verdictForFindings(findings),
    counts: {
      ...counts,
      filesChanged: summary.changeSummary.filesChanged,
      testsDetected: summary.changeSummary.testFilesChanged,
      secretsRedacted: summary.redactions.length
    },
    findings,
    nextActions: [
      "Validate changed behavior against repository architecture docs.",
      "Record unresolved design assumptions before merge.",
      "Add rollback or migration notes when compatibility is uncertain."
    ],
    meta: {
      evidenceIndex: summary.evidenceIndex,
      repoDocs: summary.repoDocs,
      redactions: summary.redactions,
      promptInjectionEvents: summary.promptInjectionEvents
    }
  };
}
