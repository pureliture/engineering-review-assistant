import type {
  ChangeData,
  ChangeSummary,
  EvidenceItem,
  PromptInjectionEvent,
  RedactionRecord
} from "../types.js";
import { detectPromptInjection, neutralizeRepositoryInstructions } from "../policy/prompt-injection.js";
import { redactText } from "../policy/redaction.js";

function evidenceId(index: number): string {
  return `E-${String(index).padStart(4, "0")}`;
}

type EvidenceSourceKind = PromptInjectionEvent["sourceKind"];

type EvidenceBuildResult = Pick<
  ChangeSummary,
  "evidenceIndex" | "repoDocs" | "agentsGuidelines" | "redactions" | "promptInjectionEvents" | "rawDiffsByFile" | "ciEvidence"
>;

class EvidenceCollector {
  private nextEvidence = 1;
  readonly evidenceIndex: Record<string, EvidenceItem> = {};
  readonly redactions: RedactionRecord[] = [];
  readonly promptInjectionEvents: PromptInjectionEvent[] = [];

  addEvidence(input: {
    kind: EvidenceItem["kind"];
    text: string;
    path?: string;
    sourceKind?: EvidenceSourceKind;
  }): { ref: string; excerpt: string; redacted: boolean } {
    const ref = evidenceId(this.nextEvidence++);
    const redacted = this.redact(input.text, input.path);

    if (input.sourceKind) {
      this.promptInjectionEvents.push(...detectPromptInjection(input.text, input.sourceKind, input.path, ref));
    }

    this.evidenceIndex[ref] = {
      kind: input.kind,
      path: input.path,
      excerpt: redacted.text.slice(0, 900),
      redacted: redacted.redactions.length > 0
    };

    return { ref, excerpt: redacted.text.slice(0, 900), redacted: redacted.redactions.length > 0 };
  }

  addPromptInjectionOnly(text: string, sourceKind: EvidenceSourceKind): void {
    this.promptInjectionEvents.push(...detectPromptInjection(text, sourceKind));
  }

  redactText(text: string, path?: string): string {
    return this.redact(text, path, false).text;
  }

  private redact(text: string, path?: string, recordRedactions = true): { text: string; redactions: RedactionRecord[] } {
    const redacted = redactText(neutralizeRepositoryInstructions(text), path);
    if (recordRedactions) this.redactions.push(...redacted.redactions);
    return redacted;
  }
}

export function buildEvidence(change: ChangeData): EvidenceBuildResult {
  const collector = new EvidenceCollector();
  const repoDocs: ChangeSummary["repoDocs"] = [];

  for (const file of change.files) {
    collector.addEvidence({
      kind: "diff",
      text: file.patch ?? "",
      path: file.path,
      sourceKind: "file"
    });
  }

  for (const doc of change.repoDocs) {
    const evidence = collector.addEvidence({
      kind: "doc",
      text: doc.excerpt,
      path: doc.path,
      sourceKind: "doc"
    });
    repoDocs.push({ path: doc.path, excerpt: evidence.excerpt, evidenceRef: evidence.ref });
  }

  let agentsGuidelines: ChangeSummary["agentsGuidelines"];
  if (change.agentsGuidelines) {
    const evidence = collector.addEvidence({
      kind: "policy",
      text: change.agentsGuidelines.excerpt,
      path: change.agentsGuidelines.path
    });
    agentsGuidelines = {
      path: change.agentsGuidelines.path,
      excerpt: evidence.excerpt,
      evidenceRef: evidence.ref
    };
  }

  if (change.ciEvidence?.selectedLogExcerpts) {
    for (const log of change.ciEvidence.selectedLogExcerpts) {
      collector.addEvidence({ kind: "ci", text: log, sourceKind: "ci_log" });
    }
  }

  for (const message of change.gitMetadata.commitMessages ?? []) {
    collector.addPromptInjectionOnly(message, "commit_message");
  }

  return {
    evidenceIndex: collector.evidenceIndex,
    repoDocs,
    agentsGuidelines,
    redactions: collector.redactions,
    promptInjectionEvents: collector.promptInjectionEvents,
    rawDiffsByFile: Object.fromEntries(
      Object.entries(change.rawDiffsByFile).map(([filePath, patch]) => [
        filePath,
        collector.redactText(patch, filePath)
      ])
    ),
    ciEvidence: change.ciEvidence
      ? {
          checks: change.ciEvidence.checks,
          selectedLogExcerpts: change.ciEvidence.selectedLogExcerpts?.map((log) => collector.redactText(log))
        }
      : undefined
  };
}
