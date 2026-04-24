import type { RedactionRecord } from "../types.js";
import { redactText } from "../policy/redaction.js";

export type AppToolResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
  _meta?: Record<string, unknown>;
  isError?: boolean;
};

export function ok(structuredContent: Record<string, unknown>, meta?: Record<string, unknown>, text = "Engineering Review Assistant result ready."): AppToolResult {
  return {
    content: [{ type: "text", text }],
    structuredContent,
    _meta: meta
  };
}

function sanitizeString(value: string): { text: string; redactions: RedactionRecord[] } {
  return redactText(value);
}

function sanitizeValue(value: unknown, redactions: RedactionRecord[]): unknown {
  if (typeof value === "string") {
    const sanitized = sanitizeString(value);
    redactions.push(...sanitized.redactions);
    return sanitized.text;
  }
  if (Array.isArray(value)) return value.map((item) => sanitizeValue(item, redactions));
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, sanitizeValue(entry, redactions)])
    );
  }
  return value;
}

function defaultNextActions(code: string): string[] {
  switch (code) {
    case "SOURCE_NOT_CONFIGURED":
      return ["Call review.select_context without a target to list configured sourceId values."];
    case "TARGET_KIND_UNSUPPORTED":
    case "SOURCE_TARGET_TYPE_MISMATCH":
      return ["Choose a target kind supported by the configured sourceId."];
    case "CONTEXT_NOT_FOUND":
      return ["Call review.select_context before summarizing changes."];
    case "SUMMARY_NOT_FOUND":
      return ["Call review.summarize_changes before running review or export tools."];
    case "REVIEW_NOT_FOUND":
      return ["Call review.review_code or review.review_architecture before exporting a packet."];
    default:
      return ["Review the tool input schema and retry with allowlisted repository data only."];
  }
}

export function toolError(code: string, message: string, details?: Record<string, unknown>, redactions: RedactionRecord[] = []): AppToolResult {
  const errorRedactions = [...redactions];
  const sanitizedMessage = sanitizeString(message);
  errorRedactions.push(...sanitizedMessage.redactions);
  const sanitizedDetails = sanitizeValue(details ?? {}, errorRedactions) as Record<string, unknown>;
  const nextActions = Array.isArray(sanitizedDetails.nextActions)
    ? sanitizedDetails.nextActions.filter((item): item is string => typeof item === "string")
    : defaultNextActions(code);

  return {
    isError: true,
    content: [{ type: "text", text: `${code}: ${sanitizedMessage.text}` }],
    structuredContent: {
      error: { code, message: sanitizedMessage.text, nextActions },
      redactions: { count: errorRedactions.length }
    },
    _meta: {
      error: { code, message: sanitizedMessage.text, details: sanitizedDetails },
      redactions: errorRedactions
    }
  };
}
