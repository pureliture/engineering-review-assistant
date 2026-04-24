import type { ChangeData, ConfiguredSource, FileChange, ReviewContext } from "../types.js";
import { redactText } from "../policy/redaction.js";
import type { ReviewSourceAdapter } from "./types.js";

type GitHubFile = {
  filename: string;
  status: string;
  additions?: number;
  deletions?: number;
  patch?: string;
};

export class GitHubAdapter implements ReviewSourceAdapter {
  supports(source: ConfiguredSource): boolean {
    return source.type === "github" && !source.fixture;
  }

  async getChange(context: ReviewContext, options?: { includeCi?: "auto" | "checks_only" | "none" }): Promise<ChangeData> {
    const token = process.env.GITHUB_TOKEN;
    if (!token) throw new Error("GITHUB_AUTH_REQUIRED");
    if (!context.source.owner || !context.source.repo) throw new Error("GITHUB_REPO_NOT_ALLOWLISTED");

    const files = await this.fetchFiles(context, token);
    const rawDiffsByFile: Record<string, string> = {};
    const fileChanges: FileChange[] = files.map((file) => {
      const redactedPatch = redactText(file.patch ?? "", file.filename).text;
      rawDiffsByFile[file.filename] = redactedPatch;
      return {
        path: file.filename,
        status: file.status,
        additions: file.additions,
        deletions: file.deletions,
        patch: redactedPatch
      };
    });

    return {
      context,
      files: fileChanges,
      rawDiffsByFile,
      gitMetadata: {
        baseRef: context.baseRef,
        headRef: context.headRef,
        changedFiles: fileChanges.map((file) => file.path)
      },
      repoDocs: [],
      agentsGuidelines: undefined,
      ciEvidence: options?.includeCi === "none" ? undefined : { checks: [], selectedLogExcerpts: [] }
    };
  }

  private async fetchFiles(context: ReviewContext, token: string): Promise<GitHubFile[]> {
    const { owner, repo } = context.source;
    const headers = {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28"
    };

    if (context.target.kind === "github_pr") {
      const url = `https://api.github.com/repos/${owner}/${repo}/pulls/${context.target.pullNumber}/files?per_page=100`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`GITHUB_TARGET_NOT_FOUND:${res.status}`);
      return (await res.json()) as GitHubFile[];
    }

    if (context.target.kind !== "github_branch" && context.target.kind !== "github_commit_range") {
      throw new Error("GITHUB_TARGET_UNSUPPORTED");
    }

    const base =
      context.target.kind === "github_branch"
        ? context.target.baseRef ?? context.source.defaultBaseRef ?? "main"
        : context.target.baseSha;
    const head = context.target.kind === "github_branch" ? context.target.headRef : context.target.headSha;
    const url = `https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(base)}...${encodeURIComponent(head)}`;
    const res = await fetch(url, { headers });
    if (!res.ok) throw new Error(`GITHUB_TARGET_NOT_FOUND:${res.status}`);
    const json = (await res.json()) as { files?: GitHubFile[] };
    return json.files ?? [];
  }
}
