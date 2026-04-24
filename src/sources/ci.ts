export type CiMode = "auto" | "checks_only" | "none";

export function shouldReadCi(mode: CiMode | undefined): boolean {
  return (mode ?? "auto") !== "none";
}
