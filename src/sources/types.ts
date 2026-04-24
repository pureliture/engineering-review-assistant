import type { ChangeData, ConfiguredSource, ReviewContext } from "../types.js";

export interface ReviewSourceAdapter {
  supports(source: ConfiguredSource): boolean;
  getChange(context: ReviewContext, options?: { includeRepoDocs?: boolean; includeCi?: "auto" | "checks_only" | "none" }): Promise<ChangeData>;
}
