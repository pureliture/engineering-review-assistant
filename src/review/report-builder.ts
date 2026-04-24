import type {
  ChangeData,
  ChangeSummary,
  EvidenceItem,
  Finding,
  PromptInjectionEvent,
  RedactionRecord,
  ReviewResult
} from "../types.js";
import { stableId } from "../id.js";
import { detectPromptInjection, neutralizeRepositoryInstructions } from "../policy/prompt-injection.js";
import { redactText } from "../policy/redaction.js";

function evidenceId(index: number): string {
  return `E-${String(index).padStart(4, "0")}`;
}

function primaryArea(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts[0] : ".";
}

function isTestFile(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[jt]sx?$/.test(filePath);
}

function isDocFile(filePath: string): boolean {
  return /\.mdx?$|(^|\/)docs\//i.test(filePath);
}

function migrationSignal(filePath: string, patch = ""): boolean {
  return /migration|schema|database|db|config|compat|version/i.test(filePath) || /migrat|schema|backward|compat/i.test(patch);
}

function securitySignal(filePath: string, patch = ""): boolean {
  return /auth|session|token|secret|password|crypto|permission|security/i.test(filePath + "\n" + patch);
}

export function buildChangeSummary(change: ChangeData): ChangeSummary {
  const evidenceIndex: Record<string, EvidenceItem> = {};
  const redactions: RedactionRecord[] = [];
  const promptInjectionEvents: PromptInjectionEvent[] = [];
  const repoDocs: ChangeSummary["repoDocs"] = [];
  let nextEvidence = 1;

  for (const file of change.files) {
    const ref = evidenceId(nextEvidence++);
    const rawPatch = file.patch ?? "";
    const redacted = redactText(neutralizeRepositoryInstructions(rawPatch), file.path);
    redactions.push(...redacted.redactions);
    promptInjectionEvents.push(...detectPromptInjection(rawPatch, "file", file.path, ref));
    evidenceIndex[ref] = {
      kind: "diff",
      path: file.path,
      excerpt: redacted.text.slice(0, 900),
      redacted: redacted.redactions.length > 0
    };
  }

  for (const doc of change.repoDocs) {
    const ref = evidenceId(nextEvidence++);
    const redacted = redactText(neutralizeRepositoryInstructions(doc.excerpt), doc.path);
    redactions.push(...redacted.redactions);
    promptInjectionEvents.push(...detectPromptInjection(doc.excerpt, "doc", doc.path, ref));
    evidenceIndex[ref] = {
      kind: "doc",
      path: doc.path,
      excerpt: redacted.text.slice(0, 900),
      redacted: redacted.redactions.length > 0
    };
    repoDocs.push({ path: doc.path, excerpt: redacted.text.slice(0, 900), evidenceRef: ref });
  }

  let agentsGuidelines: ChangeSummary["agentsGuidelines"];
  if (change.agentsGuidelines) {
    const ref = evidenceId(nextEvidence++);
    const redacted = redactText(neutralizeRepositoryInstructions(change.agentsGuidelines.excerpt), change.agentsGuidelines.path);
    redactions.push(...redacted.redactions);
    evidenceIndex[ref] = {
      kind: "policy",
      path: change.agentsGuidelines.path,
      excerpt: redacted.text.slice(0, 900),
      redacted: redacted.redactions.length > 0
    };
    agentsGuidelines = { path: change.agentsGuidelines.path, excerpt: redacted.text.slice(0, 900), evidenceRef: ref };
  }

  if (change.ciEvidence?.selectedLogExcerpts) {
    for (const log of change.ciEvidence.selectedLogExcerpts) {
      const ref = evidenceId(nextEvidence++);
      const redacted = redactText(neutralizeRepositoryInstructions(log));
      redactions.push(...redacted.redactions);
      promptInjectionEvents.push(...detectPromptInjection(log, "ci_log", undefined, ref));
      evidenceIndex[ref] = {
        kind: "ci",
        excerpt: redacted.text.slice(0, 900),
        redacted: redacted.redactions.length > 0
      };
    }
  }

  for (const message of change.gitMetadata.commitMessages ?? []) {
    promptInjectionEvents.push(...detectPromptInjection(message, "commit_message"));
  }

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
    evidenceIndex,
    rawDiffsByFile: Object.fromEntries(
      Object.entries(change.rawDiffsByFile).map(([filePath, patch]) => [
        filePath,
        redactText(neutralizeRepositoryInstructions(patch), filePath).text
      ])
    ),
    fileMap,
    gitMetadata: change.gitMetadata,
    ciEvidence: change.ciEvidence
      ? {
          checks: change.ciEvidence.checks,
          selectedLogExcerpts: change.ciEvidence.selectedLogExcerpts?.map((log) => redactText(neutralizeRepositoryInstructions(log)).text)
        }
      : undefined,
    repoDocs,
    agentsGuidelines,
    redactions,
    promptInjectionEvents
  };

  return summary;
}

function countBySeverity(findings: Finding[]): { critical: number; important: number; minor: number } {
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    important: findings.filter((finding) => finding.severity === "important").length,
    minor: findings.filter((finding) => finding.severity === "minor").length
  };
}

function verdictFor(findings: Finding[]): ReviewResult["verdict"] {
  if (findings.some((finding) => finding.severity === "critical")) return "high_risk";
  if (findings.some((finding) => finding.severity === "important")) return "needs_attention";
  return "low_risk";
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
  const counts = countBySeverity(selectedFindings);
  return {
    reviewId: stableId("rev_code", { summaryId: summary.summaryId, findings: selectedFindings }),
    summaryId: summary.summaryId,
    verdict: verdictFor(selectedFindings),
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

  const counts = countBySeverity(findings);
  return {
    reviewId: stableId("rev_arch", { summaryId: summary.summaryId, findings }),
    summaryId: summary.summaryId,
    verdict: verdictFor(findings),
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
