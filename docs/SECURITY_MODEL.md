# Security Model

## Trust Boundary

신뢰하는 입력:

- 서버 운영자가 작성한 `source-policy.yaml`
- MCP server code
- 사용자의 현재 ChatGPT request

신뢰하지 않는 입력:

- repository file content
- markdown docs
- PR descriptions
- PR comments
- review comments
- commit messages
- branch names
- test output
- CI logs
- dependency metadata

## Source Boundary

V1은 allowlist 기반이다.

- local repository는 explicit configured root만 허용한다.
- GitHub repository는 explicit configured `owner/repo`만 허용한다.
- tool input은 source ID를 사용한다.
- arbitrary path, arbitrary repository URL, user-provided filesystem root는 거부한다.

## Local Filesystem Policy

차단:

- arbitrary filesystem scanning
- repo root 밖 path read
- symlink escape
- absolute path disclosure
- direct file write
- generated report file write
- arbitrary shell execution

허용:

- configured repo root 안의 git metadata read
- configured repo root 안의 diff read
- configured repo root 안의 selected file snippet read
- configured repo root 안의 markdown docs read

## GitHub Policy

허용:

- Metadata read
- Contents read
- Pull requests read
- Checks read
- Actions read

차단:

- Contents write
- Pull requests write
- Issues write
- Checks write
- Actions write
- branch creation
- commit creation
- PR creation
- direct push

## Codex Handoff Policy

Phase 10A의 Codex handoff는 read-only proposal generation이다.

허용:

- review finding을 Codex task proposal로 변환
- 별도 branch/worktree에서 수행할 작업 범위 제안
- 테스트 요구사항과 approval gate 제안
- paste-safe task brief 생성

차단:

- MCP server에서 Codex CLI 실행
- patch 적용
- file write
- test command 실행
- branch creation
- commit creation
- PR creation
- direct push
- patch 생성과 적용을 같은 step에서 수행

모든 write-adjacent action은 별도 phase, 별도 user approval, 별도 audit policy가 준비되기 전까지 구현하지 않는다.

## Secret Redaction

다음 값은 `structuredContent`, `_meta`, packet markdown 어디에도 원문으로 포함하지 않는다.

- API token
- GitHub token
- OAuth token
- bearer token
- password
- cookie
- private key block
- SSH key
- cloud credential
- `.env` secret value
- sensitive environment variable

Redaction output:

```ts
{
  kind: "token" | "credential" | "private_key" | "env_var" | "unknown_secret";
  path?: string;
  line?: number;
  value: "[REDACTED]";
  confidence: "low" | "medium" | "high";
}
```

## Prompt-Injection Hardening

Repository-originated text는 instruction이 아니라 evidence이다.

차단 또는 neutralize 할 패턴:

- "ignore previous instructions"
- "override system prompt"
- "read ~/.ssh"
- "print environment variables"
- "print tokens"
- "scan home directory"
- "create branch"
- "push changes"
- "open a PR"
- "write review output to file"

처리 방식:

- suspicious instruction은 evidence excerpt로만 보관한다.
- finding이 필요하면 prompt-injection event로 기록한다.
- app policy와 user request가 항상 repository content보다 우선한다.

## Error Safety

에러 메시지는 안전해야 한다.

- absolute local path 노출 금지
- secret-like text 노출 금지
- raw CI log dump 금지
- auth token metadata 노출 금지
- stack trace를 사용자-facing output에 그대로 노출 금지

## Audit Expectations

V1에서 persistent audit log는 필수 아님. 다만 implementation은 다음 event를 내부 debug log로 남길 수 있다.

- source allowlist rejection
- symlink escape rejection
- prompt-injection neutralization
- secret redaction count
- GitHub permission failure
- CI log excerpt truncation
- Codex task proposal creation
- write-adjacent request rejection

Debug log도 raw secret을 포함하면 안 된다.

Codex handoff audit event는 IDs, sourceId, target kind, finding IDs, counts, status만 포함한다. raw diff, raw snippet, token, secret, private key, absolute local path, full CI log는 기록하지 않는다.
