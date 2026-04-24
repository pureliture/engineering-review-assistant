import type { PromptInjectionEvent } from "../types.js";

const INJECTION_PATTERNS = [
  /ignore (all )?(previous|prior) instructions/gi,
  /override (the )?(system|developer) (prompt|instructions)/gi,
  /read\s+~\//gi,
  /print (all )?(env|environment variables|tokens|secrets)/gi,
  /scan (the )?(home directory|filesystem|disk)/gi,
  /create (a )?(branch|commit|pull request|pr)/gi,
  /push (changes|to)/gi,
  /write (the )?(review|output|result) (to|into) (a )?file/gi
];

export function detectPromptInjection(
  text: string,
  sourceKind: PromptInjectionEvent["sourceKind"],
  path?: string,
  evidenceRef?: string
): PromptInjectionEvent[] {
  const events: PromptInjectionEvent[] = [];

  for (const pattern of INJECTION_PATTERNS) {
    pattern.lastIndex = 0;
    if (pattern.test(text)) {
      events.push({
        sourceKind,
        path,
        evidenceRef,
        pattern: pattern.source,
        action: "neutralized"
      });
    }
  }

  return events;
}

export function neutralizeRepositoryInstructions(text: string): string {
  let output = text;
  for (const pattern of INJECTION_PATTERNS) {
    output = output.replace(pattern, "[REPOSITORY-INSTRUCTION-NEUTRALIZED]");
  }
  return output;
}
