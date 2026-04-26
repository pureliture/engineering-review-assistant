import type { Finding, Severity, Verdict } from "../types.js";

export function primaryArea(filePath: string): string {
  const parts = filePath.split("/");
  return parts.length > 1 ? parts[0] : ".";
}

export function isTestFile(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)(\/|$)|\.(test|spec)\.[jt]sx?$/.test(filePath);
}

export function isDocFile(filePath: string): boolean {
  return /\.mdx?$|(^|\/)docs\//i.test(filePath);
}

export function migrationSignal(filePath: string, patch = ""): boolean {
  return /migration|schema|database|db|config|compat|version/i.test(filePath) || /migrat|schema|backward|compat/i.test(patch);
}

export function securitySignal(filePath: string, patch = ""): boolean {
  return /auth|session|token|secret|password|crypto|permission|security/i.test(`${filePath}\n${patch}`);
}

export function severityCounts(findings: Finding[]): { critical: number; important: number; minor: number } {
  return {
    critical: findings.filter((finding) => finding.severity === "critical").length,
    important: findings.filter((finding) => finding.severity === "important").length,
    minor: findings.filter((finding) => finding.severity === "minor").length
  };
}

export function verdictForFindings(findings: Finding[]): Verdict {
  if (findings.some((finding) => finding.severity === "critical")) return "high_risk";
  if (findings.some((finding) => finding.severity === "important")) return "needs_attention";
  return "low_risk";
}

export function severityRank(severity: Severity): number {
  if (severity === "critical") return 0;
  if (severity === "important") return 1;
  return 2;
}
