import { createHash } from "node:crypto";

export function stableId(prefix: string, value: unknown): string {
  const hash = createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);
  return `${prefix}_${hash}`;
}
