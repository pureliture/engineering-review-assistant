import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { realpath } from "node:fs/promises";
import type { ChangeData, ConfiguredSource, FileChange, ReviewContext } from "../types.js";
import { assertWithinRoot, validateGitRef } from "../policy/path-boundary.js";
import { redactText } from "../policy/redaction.js";
import { loadAgentsGuidelines, loadRepoDocs } from "./repo-docs.js";
import type { ReviewSourceAdapter } from "./types.js";

const execFileAsync = promisify(execFile);

async function git(repoRoot: string, args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", repoRoot, ...args], {
    timeout: 10_000,
    maxBuffer: 1_000_000
  });
  return stdout;
}

function parseNumstat(stdout: string): Record<string, { additions?: number; deletions?: number }> {
  const result: Record<string, { additions?: number; deletions?: number }> = {};
  for (const line of stdout.split("\n")) {
    const [additions, deletions, filePath] = line.split("\t");
    if (!filePath) continue;
    result[filePath] = {
      additions: additions === "-" ? undefined : Number(additions),
      deletions: deletions === "-" ? undefined : Number(deletions)
    };
  }
  return result;
}

function splitDiffByFile(diff: string): Record<string, string> {
  const files: Record<string, string> = {};
  const chunks = diff.split(/^diff --git /m).filter(Boolean);
  for (const chunk of chunks) {
    const text = `diff --git ${chunk}`;
    const match = text.match(/^diff --git a\/(.+?) b\/(.+)$/m);
    const filePath = match?.[2] ?? match?.[1];
    if (filePath) files[filePath] = text;
  }
  return files;
}

export class LocalGitAdapter implements ReviewSourceAdapter {
  supports(source: ConfiguredSource): boolean {
    return source.type === "local" && !source.fixture;
  }

  async getChange(context: ReviewContext, options?: { includeRepoDocs?: boolean }): Promise<ChangeData> {
    if (!context.source.root) throw new Error("LOCAL_REPO_NOT_FOUND");
    const repoRoot = await realpath(context.source.root);
    const topLevel = (await git(repoRoot, ["rev-parse", "--show-toplevel"])).trim();
    const realTopLevel = await realpath(topLevel);
    if (realTopLevel !== repoRoot) throw new Error("LOCAL_REPO_ROOT_MISMATCH");

    const diffArgs = this.diffArgs(context);
    const [diffRaw, numstatRaw] = await Promise.all([
      git(repoRoot, diffArgs),
      git(repoRoot, [...diffArgs.slice(0, diffArgs[0] === "diff" ? 1 : 0), "--numstat", ...diffArgs.slice(1)])
        .catch(() => "")
    ]);

    const redactedDiff = redactText(diffRaw);
    const rawDiffsByFile = splitDiffByFile(redactedDiff.text);
    const stats = parseNumstat(numstatRaw);
    const files: FileChange[] = Object.entries(rawDiffsByFile).map(([filePath, patch]) => ({
      path: filePath,
      status: "modified",
      additions: stats[filePath]?.additions,
      deletions: stats[filePath]?.deletions,
      patch
    }));

    for (const file of files) {
      await assertWithinRoot(repoRoot, path.join(repoRoot, file.path));
    }

    const repoDocs = options?.includeRepoDocs === false ? [] : await loadRepoDocs(repoRoot);
    const agentsGuidelines = await loadAgentsGuidelines(repoRoot);

    return {
      context,
      files,
      rawDiffsByFile,
      gitMetadata: {
        baseRef: context.baseRef,
        headRef: context.headRef,
        changedFiles: files.map((file) => file.path),
        commitMessages: await this.commitMessages(repoRoot, context).catch(() => [])
      },
      repoDocs,
      agentsGuidelines,
      ciEvidence: undefined
    };
  }

  private diffArgs(context: ReviewContext): string[] {
    switch (context.target.kind) {
      case "local_working_tree": {
        const includeStaged = context.target.includeStaged ?? true;
        const includeUnstaged = context.target.includeUnstaged ?? true;
        if (includeStaged && !includeUnstaged) return ["diff", "--cached"];
        return ["diff"];
      }
      case "local_branch":
        validateGitRef(context.target.headRef);
        if (context.target.baseRef) validateGitRef(context.target.baseRef);
        return ["diff", `${context.target.baseRef ?? context.source.defaultBaseRef ?? "main"}...${context.target.headRef}`];
      case "local_commit_range":
        validateGitRef(context.target.baseRef);
        validateGitRef(context.target.headRef);
        return ["diff", `${context.target.baseRef}...${context.target.headRef}`];
      default:
        throw new Error("LOCAL_TARGET_UNSUPPORTED");
    }
  }

  private async commitMessages(repoRoot: string, context: ReviewContext): Promise<string[]> {
    if (context.target.kind === "local_working_tree") return [];
    const base = context.baseRef ?? context.source.defaultBaseRef ?? "main";
    const head = context.headRef ?? base;
    validateGitRef(base);
    validateGitRef(head);
    const log = await git(repoRoot, ["log", "--format=%s", `${base}..${head}`]);
    return log.split("\n").filter(Boolean).slice(0, 20).map((line) => redactText(line).text);
  }
}
