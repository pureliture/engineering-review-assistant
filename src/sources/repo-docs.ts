import { readFile } from "node:fs/promises";
import path from "node:path";
import { assertWithinRoot } from "../policy/path-boundary.js";
import { redactText } from "../policy/redaction.js";

const DOC_CANDIDATES = [
  "AGENTS.md",
  "README.md",
  "ARCHITECTURE.md",
  "ADR.md",
  "RFC.md",
  "TESTING.md",
  path.join("docs", "architecture.md"),
  path.join("docs", "ARCHITECTURE.md"),
  path.join("docs", "adr.md"),
  path.join("docs", "ADR.md"),
  path.join("docs", "testing.md"),
  path.join("docs", "TESTING.md")
];

export async function loadRepoDocs(repoRoot: string, maxDocs = 8): Promise<Array<{ path: string; excerpt: string }>> {
  const docs: Array<{ path: string; excerpt: string }> = [];

  for (const candidate of DOC_CANDIDATES) {
    if (docs.length >= maxDocs) break;
    const fullPath = path.join(repoRoot, candidate);
    try {
      const relative = await assertWithinRoot(repoRoot, fullPath);
      const raw = await readFile(fullPath, "utf8");
      const redacted = redactText(raw.slice(0, 4000), relative);
      docs.push({ path: relative, excerpt: redacted.text.slice(0, 1200) });
    } catch {
      // Fixed candidate docs are optional; missing or blocked docs are simply skipped.
    }
  }

  return docs.filter((doc) => doc.path !== "AGENTS.md");
}

export async function loadAgentsGuidelines(repoRoot: string): Promise<{ path: string; excerpt: string } | undefined> {
  const fullPath = path.join(repoRoot, "AGENTS.md");
  try {
    const relative = await assertWithinRoot(repoRoot, fullPath);
    const raw = await readFile(fullPath, "utf8");
    const redacted = redactText(raw.slice(0, 8000), relative);
    return { path: relative, excerpt: redacted.text.slice(0, 1600) };
  } catch {
    return undefined;
  }
}
