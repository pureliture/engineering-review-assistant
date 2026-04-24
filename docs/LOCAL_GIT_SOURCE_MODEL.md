# Local Git Source Model

## 목적

Local git source는 사용자가 명시적으로 설정한 repository root만 리뷰 대상으로 허용한다.

## Source Policy Shape

```yaml
sources:
  - id: local-api
    type: local
    displayName: Local API
    root: /absolute/path/to/repo
    defaultBaseRef: main
    allowedTargets:
      - local_working_tree
      - local_branch
      - local_commit_range
```

## 허용되는 target

```ts
type LocalTarget =
  | { kind: "local_working_tree"; includeStaged?: boolean; includeUnstaged?: boolean }
  | { kind: "local_branch"; baseRef?: string; headRef: string }
  | { kind: "local_commit_range"; baseRef: string; headRef: string };
```

## Path Resolution

1. `sourceId`로 source policy를 찾는다.
2. configured `root`를 realpath로 해석한다.
3. `git rev-parse --show-toplevel`로 git root를 확인한다.
4. realpath root와 git root가 일치하거나 git root가 configured root로 허용된 경우만 진행한다.
5. 모든 file path는 repo-relative path로 변환한다.
6. symlink target이 repo root 밖이면 해당 파일은 읽지 않는다.

## 금지되는 동작

- user input으로 arbitrary path 받기
- parent directory scan
- home directory scan
- sibling repository discovery
- repo 밖 file read
- shell command passthrough
- file write
- `git add`
- `git commit`
- `git branch`
- `git checkout`
- `git push`

## 허용되는 read operation

Implementation은 arbitrary shell execution 없이 안전한 git library 또는 제한된 internal git adapter를 사용해야 한다.

허용:

- current branch read
- default base ref read
- working tree diff read
- staged diff read
- branch compare read
- commit range diff read
- commit metadata read
- file content read within repo root
- markdown docs read within repo root

## Output Rules

- absolute root path는 출력하지 않는다.
- repo-relative path만 출력한다.
- blocked symlink는 policy evidence로 기록한다.
- secret-like value는 redacted 한다.
- local username이 포함된 path는 노출하지 않는다.

## Error Cases

- `SOURCE_NOT_CONFIGURED`
- `LOCAL_REPO_NOT_FOUND`
- `LOCAL_REPO_NOT_A_GIT_REPOSITORY`
- `LOCAL_REPO_ROOT_MISMATCH`
- `LOCAL_TARGET_UNSUPPORTED`
- `SYMLINK_ESCAPE_BLOCKED`
- `LOCAL_DIFF_TOO_LARGE`
- `ARBITRARY_SHELL_EXECUTION_BLOCKED`
