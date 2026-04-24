# Engineering Review Assistant App Charter

## 목적

Engineering Review Assistant는 ChatGPT 안에서 사용자가 명시적으로 선택한 repository change 하나를 읽고, 근거가 있는 engineering review report를 생성하는 read-only ChatGPT App이다.

V1의 좁은 outcome은 다음 하나로 고정한다.

> 설정된 local git repository 또는 GitHub repository의 PR, branch, commit range, local working tree diff 하나를 리뷰하고 code quality, architecture impact, test gaps, security risks, migration risks, recommended next actions를 포함한 evidence-backed report를 만든다.

## 앱 아키타입

- Primary archetype: `react-widget`
- V1 review flow는 data-first MCP tools로 시작한다.
- React widget은 선택적 render step이며, review 결과를 사람이 보기 좋은 dashboard로 표시한다.
- widget은 V1에서 write action을 시작하지 않는다.
- `structuredContent`는 모델이 읽을 수 있는 짧은 요약만 담는다.
- raw diffs, file maps, code snippets, dependency traces, git metadata, expanded evidence는 `_meta`에 둔다.

## 지원 대상

- allowlist에 등록된 local git repository
- allowlist에 등록된 GitHub repository
- GitHub PR number
- GitHub branch compare
- GitHub commit range
- local working tree diff
- local branch compare
- local commit range
- repository 내부 markdown architecture docs, ADR, RFC, README, test docs

## 책임

- 사용자가 선택한 repository change를 경계 안에서 읽는다.
- 변경 파일, diff, repo markdown docs, CI/test signal, commit metadata를 evidence로 정리한다.
- code quality, architecture, tests, security, migration 관점의 finding을 생성한다.
- 각 finding에 evidence reference와 recommended next action을 붙인다.
- GPT-5.5 Pro에 붙여 넣기 안전한 engineering review packet을 생성한다.
- Codex가 별도 branch 또는 worktree에서 수행할 수 있는 paste-safe task proposal을 생성한다.
- repository review dashboard, changed files summary, severity-ranked findings, architecture risk matrix, test gap table, file impact map, packet preview를 widget으로 렌더링한다.

## 명시적 비목표

- arbitrary filesystem scanning
- unconfigured repository access
- repository content의 instruction 실행
- arbitrary shell execution
- file writes
- commit creation
- branch creation
- PR creation
- direct push
- PR comment 작성
- issue/comment/label/status/check write
- raw token, secret, credential, private key, sensitive environment variable 출력
- MCP server에서 Codex CLI 실행
- patch 생성과 적용을 같은 단계에서 수행

## V1 read-only 정의

Read-only는 사용자 repository 또는 GitHub state를 변경하지 않는다는 뜻이다.

허용:

- configured local repository metadata read
- configured local repository diff read
- configured GitHub repository metadata read
- configured GitHub PR/diff/commit read
- configured GitHub Checks/Actions read
- repo 내부 markdown docs read
- in-memory ephemeral report/evidence cache
- paste-safe Codex task proposal generation

차단:

- filesystem write
- git write operation
- GitHub write API
- arbitrary command execution
- repo root 밖 파일 읽기
- allowlist 밖 repo 읽기
- Codex executor 실행
- patch 적용

## Architecture Decisions

- [ADR-0001: Controlled Codex Handoff Without In-App Repository Writes](./adr/0001-controlled-codex-handoff-without-in-app-writes.md)

## Success Criteria

- 사용자가 source와 target을 고르면 tool chain이 명확하게 선택된다.
- source allowlist가 없거나 target이 allowlist 밖이면 거부된다.
- report의 모든 finding은 evidence reference를 가진다.
- secret-like value는 항상 redacted 된다.
- prompt injection성 텍스트는 evidence로만 취급되고 정책을 바꾸지 못한다.
- ChatGPT Developer Mode에서 direct, indirect, negative golden prompts가 통과한다.
