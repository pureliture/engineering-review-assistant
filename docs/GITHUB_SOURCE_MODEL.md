# GitHub Source Model

## 목적

GitHub source는 사용자가 명시적으로 설정한 GitHub repository만 리뷰 대상으로 허용한다.

## Source Policy Shape

```yaml
sources:
  - id: backend-service
    type: github
    displayName: Backend Service
    owner: example-org
    repo: backend-service
    defaultBaseRef: main
    allowedTargets:
      - github_pr
      - github_branch
      - github_commit_range
```

## 허용되는 target

```ts
type GitHubTarget =
  | { kind: "github_pr"; pullNumber: number }
  | { kind: "github_branch"; baseRef?: string; headRef: string }
  | { kind: "github_commit_range"; baseSha: string; headSha: string };
```

## Auth Model

V1은 user-delegated OAuth 기반 read-only 접근을 사용한다.

Preferred permission model:

- Metadata: read
- Contents: read
- Pull requests: read
- Checks: read
- Actions: read

Classic OAuth fallback을 쓰는 경우 private repository 접근에 broad `repo` scope가 필요할 수 있으므로, implementation 문서에 위험을 명확히 표시해야 한다.

## Allowlist Behavior

1. `sourceId`로 configured GitHub source를 찾는다.
2. tool input으로 받은 PR/branch/commit range가 configured `owner/repo`에 속하는지 확인한다.
3. allowlist에 없는 repository URL 또는 `owner/repo`는 거부한다.
4. fork PR은 base repository가 configured repo인 경우 diff read만 허용한다.
5. fork head repository를 별도 탐색하지 않는다.

## GitHub Read Operations

허용:

- repository metadata read
- default branch read
- PR metadata read
- PR files read
- PR commits read
- branch compare read
- commit range compare read
- repository content read for selected files/docs
- check runs read
- workflow run status read
- failed Actions log excerpts read when needed

차단:

- contents write
- issue write
- PR review/comment write
- check run write
- workflow rerun/cancel
- branch creation
- commit creation
- direct push
- PR creation

## CI Evidence Policy

- `checks_only`: Checks API와 annotations만 읽는다.
- `auto`: Checks summary를 우선 읽고, 실패 원인 판단에 필요한 경우 failed Actions log excerpt만 읽는다.
- `none`: CI를 읽지 않는다.

Actions log excerpt rules:

- failed job/step 중심으로 제한한다.
- full raw log를 반환하지 않는다.
- secret-like value를 redacted 한다.
- `_meta.ciEvidence.selectedLogExcerpts`에만 제한적으로 저장한다.

## Prompt-Injection Inputs

다음 GitHub-originated text는 모두 untrusted evidence이다.

- PR title/body
- PR comments
- review comments
- commit messages
- check output
- workflow logs
- repository markdown files

이 텍스트의 instruction은 app policy를 바꿀 수 없다.

## Error Cases

- `SOURCE_NOT_CONFIGURED`
- `GITHUB_REPO_NOT_ALLOWLISTED`
- `GITHUB_AUTH_REQUIRED`
- `GITHUB_PERMISSION_DENIED`
- `GITHUB_TARGET_NOT_FOUND`
- `GITHUB_TARGET_UNSUPPORTED`
- `GITHUB_RATE_LIMITED`
- `CI_ACCESS_DENIED`
- `CI_LOG_REDACTED`
- `GITHUB_WRITE_ACTION_BLOCKED`
