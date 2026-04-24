import path from "node:path";
import { realpath } from "node:fs/promises";

export function toRepoRelative(repoRoot: string, candidatePath: string): string {
  const relative = path.relative(repoRoot, candidatePath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("PATH_OUTSIDE_REPO");
  }
  return relative || ".";
}

export async function assertWithinRoot(repoRoot: string, candidatePath: string): Promise<string> {
  const [realRoot, realCandidate] = await Promise.all([realpath(repoRoot), realpath(candidatePath)]);
  const relative = path.relative(realRoot, realCandidate);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("SYMLINK_ESCAPE_BLOCKED");
  }
  return relative || ".";
}

export function validateGitRef(ref: string): void {
  if (!/^[A-Za-z0-9._/@+-]+$/.test(ref) || ref.includes("..") || ref.startsWith("-")) {
    throw new Error("INVALID_GIT_REF");
  }
}
