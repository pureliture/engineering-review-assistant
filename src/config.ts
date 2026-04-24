import { readFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import type { ConfiguredSource, TargetKind } from "./types.js";

const targetKindValues: [TargetKind, ...TargetKind[]] = [
  "github_pr",
  "github_branch",
  "github_commit_range",
  "local_working_tree",
  "local_branch",
  "local_commit_range"
];

const localSourceSchema = z.object({
  id: z.string().min(1),
  type: z.literal("local"),
  displayName: z.string().min(1),
  root: z.string().min(1),
  defaultBaseRef: z.string().optional(),
  allowedTargets: z.array(z.enum(targetKindValues))
});

const githubSourceSchema = z.object({
  id: z.string().min(1),
  type: z.literal("github"),
  displayName: z.string().min(1),
  owner: z.string().min(1),
  repo: z.string().min(1),
  defaultBaseRef: z.string().optional(),
  allowedTargets: z.array(z.enum(targetKindValues))
});

const localConfigSchema = z.object({ sources: z.array(localSourceSchema) });
const githubConfigSchema = z.object({ sources: z.array(githubSourceSchema) });

export type SourceRegistry = {
  sources: ConfiguredSource[];
  fixturesEnabled: boolean;
};

const fixtureSources: ConfiguredSource[] = [
  {
    id: "fixture-local-api",
    type: "local",
    displayName: "Fixture Local API",
    defaultBaseRef: "main",
    allowedTargets: ["local_working_tree", "local_branch", "local_commit_range"],
    fixture: true,
    root: "<fixture>"
  },
  {
    id: "fixture-github-service",
    type: "github",
    displayName: "Fixture GitHub Service",
    defaultBaseRef: "main",
    allowedTargets: ["github_pr", "github_branch", "github_commit_range"],
    fixture: true,
    owner: "fixture-org",
    repo: "fixture-service"
  }
];

async function readJsonFile(filePath: string): Promise<unknown | undefined> {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return undefined;
    }
    throw error;
  }
}

export async function loadSourceRegistry(rootDir = process.cwd()): Promise<SourceRegistry> {
  const localPath = process.env.ERA_LOCAL_SOURCES ?? path.join(rootDir, "config", "local-sources.json");
  const githubPath = process.env.ERA_GITHUB_SOURCES ?? path.join(rootDir, "config", "github-sources.json");

  const [localRaw, githubRaw] = await Promise.all([readJsonFile(localPath), readJsonFile(githubPath)]);
  const localSources = localRaw ? localConfigSchema.parse(localRaw).sources : [];
  const githubSources = githubRaw ? githubConfigSchema.parse(githubRaw).sources : [];

  const sources: ConfiguredSource[] = [...localSources, ...githubSources];
  const hasLocal = sources.some((source) => source.type === "local");
  const hasGitHub = sources.some((source) => source.type === "github");
  const fallbackFixtures = fixtureSources.filter(
    (source) => (source.type === "local" && !hasLocal) || (source.type === "github" && !hasGitHub)
  );

  return {
    sources: [...sources, ...fallbackFixtures],
    fixturesEnabled: fallbackFixtures.length > 0
  };
}

export function findSource(registry: SourceRegistry, sourceId: string): ConfiguredSource | undefined {
  return registry.sources.find((source) => source.id === sourceId);
}
