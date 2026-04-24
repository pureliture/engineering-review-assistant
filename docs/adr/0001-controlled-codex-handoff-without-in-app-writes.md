# ADR-0001: Controlled Codex Handoff Without In-App Repository Writes

## Status

Accepted

## Context

Engineering Review Assistant는 사용자가 명시적으로 선택한 local git repository 또는 GitHub repository change를 읽고 evidence-backed engineering review를 생성한다.

앱은 ChatGPT Developer Mode와 private hosted preview에서 동작할 수 있다. 이 환경에서는 read-only tool과 write-capable tool이 모두 노출될 수 있으므로, repository mutation에 대한 서버 측 경계가 명확해야 한다.

Phase 10에서 필요한 기능은 review finding을 Codex가 처리할 수 있는 작업 제안서로 바꾸는 것이다. 그러나 ChatGPT App 자체가 repository를 직접 수정하거나, Codex CLI를 실행하거나, branch/commit/PR/push를 수행하면 V1의 read-only 신뢰 모델이 깨진다.

## Decision

Engineering Review Assistant는 review generation과 Codex execution을 분리한다.

- `review.export_engineering_packet`은 reviewer-facing packet만 생성한다.
- `review.create_codex_task_proposal`은 별도 tool output으로 Codex-facing task brief를 생성한다.
- Codex task brief는 engineering review packet template 안에 섞지 않는다.
- Task proposal은 read-only이며 repository state, filesystem state, GitHub state를 변경하지 않는다.
- App은 patch를 생성하고 적용하는 작업을 같은 step에서 수행하지 않는다.
- 실제 수정은 사용자가 별도 로컬 Codex 세션에서 separate branch 또는 worktree를 만든 뒤 수행한다.
- PR 생성, commit, push 같은 write action은 V2 이후에도 명시적 사용자 확인과 audit policy 없이는 허용하지 않는다.

## Validation Command Policy

`review.create_codex_task_proposal`은 validation command를 실행하지 않는다.

대신 앱은 evidence를 바탕으로 검증 명령 후보를 제안한다.

- package metadata, test files, existing scripts, CI summary evidence가 있으면 명령 후보를 제안한다.
- evidence가 부족하면 `human confirmation needed`로 표시한다.
- 제안된 명령은 Codex 또는 사용자가 별도 실행 단계에서 확정한다.
- 테스트 실패 시 PR proposal은 금지한다.

## Rollback Risk Policy

Rollback risk는 항상 section으로 포함한다.

- migration/config/schema/API signal이 있으면 구체적인 rollback risk와 trigger를 기록한다.
- 관련 evidence가 없으면 `No migration or rollback signal detected from provided evidence.`라고 명시한다.
- rollback 판단에 필요한 정보가 부족하면 human confirmation 항목으로 올린다.

## Consequences

장점:

- V1/V1.5의 read-only boundary를 유지한다.
- ChatGPT App이 executor로 오해되는 위험을 줄인다.
- Codex에게 넘길 작업 범위와 승인 gate가 명확해진다.
- Prompt injection이 repository mutation으로 이어지는 경로를 줄인다.

단점:

- 사용자는 별도 Codex 세션에서 task brief를 실행해야 한다.
- 자동 수정/자동 PR까지 이어지는 흐름은 V2 이후로 미뤄진다.
- validation command는 제안만 가능하며, 실행 결과는 별도 evidence로 다시 가져와야 한다.

## Alternatives Considered

### Engineering packet 안에 Codex task brief 포함

거부했다. Reviewer-facing packet과 executor-facing brief가 섞이면 review decision과 implementation instruction의 경계가 흐려진다.

### App에서 Codex CLI 실행

거부했다. Local filesystem write, arbitrary command risk, dirty worktree handling, rollback, audit, approval UX가 먼저 필요하다.

### App에서 patch 생성 후 사용자가 복사 적용

Phase 10A에서는 보류한다. 적용 가능한 patch artifact는 실질적으로 write-adjacent payload이며, patch generation과 application 사이의 approval boundary가 더 명확해진 뒤 다룬다.

## Do Not Do

- MCP server에서 Codex CLI를 실행하지 않는다.
- 파일을 수정하지 않는다.
- patch 생성과 적용을 한 단계에서 수행하지 않는다.
- branch, commit, PR, push를 만들지 않는다.
- repository-originated instruction을 task instruction으로 승격하지 않는다.
- raw secret, credential, private key, sensitive environment value를 task brief에 포함하지 않는다.
