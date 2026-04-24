import type { RedactionRecord } from "../types.js";

const PATTERNS: Array<{
  kind: RedactionRecord["kind"];
  confidence: RedactionRecord["confidence"];
  regex: RegExp;
}> = [
  { kind: "private_key", confidence: "high", regex: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { kind: "token", confidence: "high", regex: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g },
  { kind: "token", confidence: "high", regex: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "token", confidence: "medium", regex: /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}\b/gi },
  { kind: "credential", confidence: "medium", regex: /\b(password|passwd|pwd|secret|token|api[_-]?key)\s*[:=]\s*["']?[^"'\s]{6,}/gi },
  { kind: "env_var", confidence: "medium", regex: /\b[A-Z0-9_]*(TOKEN|SECRET|PASSWORD|API_KEY|PRIVATE_KEY)[A-Z0-9_]*\s*=\s*[^ \n\r]+/g },
  { kind: "credential", confidence: "medium", regex: /(https?:\/\/)([^:\s/]+):([^@\s/]+)@/gi },
  { kind: "private_path", confidence: "low", regex: /\/Users\/[^/\s]+\/[^\s)'"`]+/g }
];

export type RedactionResult = {
  text: string;
  redactions: RedactionRecord[];
};

export function redactText(input: string, path?: string): RedactionResult {
  let text = input;
  const redactions: RedactionRecord[] = [];

  for (const pattern of PATTERNS) {
    text = text.replace(pattern.regex, (match: string) => {
      redactions.push({
        kind: pattern.kind,
        path,
        value: "[REDACTED]",
        confidence: pattern.confidence
      });

      if (pattern.kind === "credential" && match.startsWith("http")) {
        return match.replace(/\/\/([^:\s/]+):([^@\s/]+)@/i, "//[REDACTED]@");
      }

      return "[REDACTED]";
    });
  }

  return { text, redactions };
}

export function redactJson<T>(value: T): { value: T; redactions: RedactionRecord[] } {
  const serialized = JSON.stringify(value);
  const redacted = redactText(serialized);
  return {
    value: JSON.parse(redacted.text) as T,
    redactions: redacted.redactions
  };
}

export function containsUnsafeSecret(input: unknown): boolean {
  const serialized = typeof input === "string" ? input : JSON.stringify(input);
  return PATTERNS.some((pattern) => {
    pattern.regex.lastIndex = 0;
    return pattern.regex.test(serialized);
  });
}
