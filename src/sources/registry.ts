import type { ChangeData, ReviewContext } from "../types.js";
import { FixtureAdapter } from "./fixtures.js";
import { GitHubAdapter } from "./github.js";
import { LocalGitAdapter } from "./local-git.js";
import type { ReviewSourceAdapter } from "./types.js";

const adapters: ReviewSourceAdapter[] = [new LocalGitAdapter(), new GitHubAdapter(), new FixtureAdapter()];

export async function loadChangeData(
  context: ReviewContext,
  options?: { includeRepoDocs?: boolean; includeCi?: "auto" | "checks_only" | "none" }
): Promise<ChangeData> {
  const adapter = adapters.find((candidate) => candidate.supports(context.source));
  if (!adapter) throw new Error("SOURCE_ADAPTER_NOT_FOUND");
  return adapter.getChange(context, options);
}
