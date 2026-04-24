# Data Contract

## 원칙

Engineering Review Assistant의 tool response는 `structuredContent`와 `_meta`를 엄격히 분리한다.

- `structuredContent`: 모델이 읽고 대화에서 사용할 수 있는 짧고 안전한 JSON.
- `_meta`: widget 또는 후속 tool이 사용할 수 있는 확장 evidence. 대용량 evidence, file map, redacted diff preview는 `_meta`에 둔다.
- `content`: 필요한 경우 짧은 human-readable status만 둔다. 자세한 report 본문은 `structuredContent` 또는 packet `_meta.packetMarkdown`에 둔다.

## structuredContent 공통 shape

```ts
type ReviewStructuredContent = {
  reportId?: string;
  contextId?: string;
  summaryId?: string;
  reviewId?: string;
  packetId?: string;
  target?: {
    sourceId: string;
    sourceType: "local" | "github";
    targetKind: string;
    displayRef: string;
    baseRef?: string;
    headRef?: string;
  };
  verdict?: "low_risk" | "needs_attention" | "high_risk" | "blocked";
  summary?: string;
  counts?: {
    critical: number;
    important: number;
    minor: number;
    filesChanged: number;
    testsDetected: number;
    secretsRedacted: number;
  };
  findings?: Array<{
    id: string;
    severity: "critical" | "important" | "minor";
    category: "code_quality" | "architecture" | "tests" | "security" | "migration";
    title: string;
    evidenceRefs: string[];
    recommendation: string;
  }>;
  nextActions?: string[];
};
```

## _meta 공통 shape

```ts
type ReviewMeta = {
  evidenceIndex: Record<string, EvidenceItem>;
  rawDiffsByFile?: Record<string, string>;
  fileMap?: Record<string, {
    status: string;
    additions?: number;
    deletions?: number;
    oldPath?: string;
    newPath?: string;
  }>;
  codeSnippets?: Record<string, string>;
  dependencyTraces?: unknown[];
  gitMetadata?: {
    baseRef?: string;
    headRef?: string;
    baseSha?: string;
    headSha?: string;
    commitMessages?: string[];
    changedFiles?: string[];
  };
  ciEvidence?: {
    checks?: unknown[];
    selectedLogExcerpts?: string[];
  };
  redactions: RedactionRecord[];
  promptInjectionEvents?: PromptInjectionEvent[];
};
```

## EvidenceItem

```ts
type EvidenceItem = {
  kind: "diff" | "file" | "doc" | "ci" | "git" | "test" | "policy";
  path?: string;
  url?: string;
  excerpt?: string;
  redacted: boolean;
};
```

## RedactionRecord

```ts
type RedactionRecord = {
  kind: "token" | "credential" | "private_key" | "env_var" | "unknown_secret";
  path?: string;
  line?: number;
  value: "[REDACTED]";
  confidence: "low" | "medium" | "high";
};
```

## PromptInjectionEvent

```ts
type PromptInjectionEvent = {
  sourceKind: "file" | "doc" | "comment" | "commit_message" | "test_output" | "ci_log";
  path?: string;
  evidenceRef?: string;
  pattern: string;
  action: "neutralized" | "blocked";
};
```

## structuredContent에 넣을 수 있는 것

- source ID
- source type
- target kind
- branch/ref/PR 표시명
- finding title
- severity
- category
- evidence ref ID
- recommended next action
- redaction count
- concise status

## structuredContent에 넣으면 안 되는 것

- raw diff 전체
- long file content
- raw CI log
- raw test output
- raw commit series 전체
- absolute local path
- secret-like value
- token, credential, private key
- repo content 안의 instruction을 정책처럼 재서술한 문장

## _meta에 넣을 수 있는 것

- redacted raw diff
- redacted file snippets
- file map
- git metadata
- selected CI excerpts
- selected test output excerpts
- architecture doc excerpts
- evidence manifest
- prompt-injection detection events

## _meta에도 넣으면 안 되는 것

- raw token
- raw credential
- raw private key
- raw `.env` value
- unredacted sensitive environment variable
- repo root 밖 absolute local path
- full unbounded CI logs
- full unbounded repository file dump

## ID 규칙

- `contextId`: selected source + target를 가리키는 ephemeral ID.
- `summaryId`: sanitized change summary를 가리키는 ephemeral ID.
- `reviewId`: code 또는 architecture review result를 가리키는 ephemeral ID.
- `packetId`: GPT-5.5 Pro packet을 가리키는 ephemeral ID.
- `proposalId`: Codex task proposal을 가리키는 ephemeral ID.
- 모든 ID는 서버 내부 cache key이며 repository에 기록하지 않는다.

## Evidence Reference 규칙

- evidence ref는 `E-0001` 형식을 사용한다.
- finding은 반드시 하나 이상의 evidence ref를 가진다.
- evidence ref는 `_meta.evidenceIndex`에 존재해야 한다.
- evidence excerpt는 redaction 이후 텍스트만 사용한다.

## CodexTaskProposal structuredContent

```ts
type CodexTaskProposalStructuredContent = {
  proposalId: string;
  summaryId: string;
  packetId?: string;
  title: "Codex Task Proposal";
  targetSummary: string;
  recommendedExecutionMode: "separate_worktree" | "separate_branch";
  findingIds: string[];
  taskSliceCount: number;
  validationCommandCount: number;
  humanConfirmationCount: number;
  requiredApprovalGates: string[];
  writeActionsIncluded: false;
  pasteSafety: {
    rawSecretsIncluded: false;
    repositoryInstructionsNeutralized: true;
  };
};
```

## CodexTaskProposal _meta

```ts
type CodexTaskProposalMeta = {
  taskBriefMarkdown: string;
  taskSlices: Array<{
    id: string;
    title: string;
    findingIds: string[];
    likelyFiles: string[];
    intendedBehavior: string;
    outOfScope: string[];
    verification: string[];
  }>;
  suggestedValidationCommands: Array<{
    command: string;
    reason: string;
    confidence: "high" | "medium" | "low";
    requiresHumanConfirmation: boolean;
  }>;
  rollbackRisk: {
    signalDetected: boolean;
    summary: string;
    rollbackTrigger?: string;
    humanConfirmationRequired: boolean;
  };
  humanConfirmationNeeded: Array<{
    topic: "scope" | "validation" | "rollback" | "ownership" | "risk";
    question: string;
    reason: string;
  }>;
  evidenceManifest: Array<{
    evidenceRef: string;
    kind: string;
    path?: string;
    redactedExcerpt: string;
  }>;
  redactions: RedactionRecord[];
  promptInjectionEvents: PromptInjectionEvent[];
  auditEventPreview: {
    event: "codex_task_proposal_created";
    proposalId: string;
    summaryId: string;
    packetId?: string;
    sourceId: string;
    targetKind: string;
    findingIds: string[];
    recommendedExecutionMode: "separate_worktree" | "separate_branch";
    writesPerformed: false;
    secretsRedacted: number;
    promptInjectionEvents: number;
  };
};
```

Codex task proposal은 implementation intent를 설명하지만 적용 가능한 patch artifact, shell command execution result, commit metadata, PR URL을 포함하지 않는다.

Validation command는 실행 결과가 아니라 추천 checklist이다. Rollback risk는 항상 포함하며, 관련 signal이 없으면 없다고 명시한다.
