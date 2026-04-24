import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import {
  exportPacketInputSchema,
  renderDashboardInputSchema,
  reviewArchitectureInputSchema,
  reviewCodeInputSchema,
  safetyAnnotations,
  selectContextInputSchema,
  summarizeChangesInputSchema
} from "../types.js";
import { exportEngineeringPacketHandler } from "./export-packet.js";
import { reviewArchitectureHandler } from "./review-architecture.js";
import { reviewCodeHandler } from "./review-code.js";
import { renderDashboardHandler } from "./render-dashboard.js";
import { selectContextHandler } from "./context.js";
import { summarizeChangesHandler } from "./summarize.js";
import {
  exportPacketOutputSchema,
  renderDashboardOutputSchema,
  reviewArchitectureOutputSchema,
  reviewCodeOutputSchema,
  selectContextOutputSchema,
  summarizeChangesOutputSchema
} from "./output-schemas.js";

function register(server: McpServer, name: string, config: Record<string, unknown>, handler: (input: unknown) => Promise<unknown>): void {
  server.registerTool(name, config as never, async (input: unknown) => handler(input) as never);
}

function toolMeta(invoking: string, invoked: string): Record<string, unknown> {
  return {
    ui: { visibility: ["model"] },
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked
  };
}

function widgetToolMeta(invoking: string, invoked: string): Record<string, unknown> {
  return {
    ui: {
      resourceUri: "ui://widget/review-dashboard-v1.html",
      visibility: ["model"]
    },
    "openai/outputTemplate": "ui://widget/review-dashboard-v1.html",
    "openai/toolInvocation/invoking": invoking,
    "openai/toolInvocation/invoked": invoked
  };
}

export function registerReviewTools(server: McpServer): void {
  register(
    server,
    "review.select_context",
    {
      title: "Select Review Source and Target",
      description:
        "Use this when the user needs to list configured review sources or bind one allowlisted local/GitHub repository target before any review. Do not use this when the user asks to scan arbitrary paths, read an unconfigured repo URL, create branches, commit, push, or open PRs.",
      inputSchema: selectContextInputSchema,
      outputSchema: selectContextOutputSchema,
      annotations: safetyAnnotations,
      _meta: toolMeta("Selecting review target", "Review target selected")
    },
    selectContextHandler
  );

  register(
    server,
    "review.summarize_changes",
    {
      title: "Summarize Allowlisted Repository Change",
      description:
        "Use this when review.select_context returned a contextId and the model needs a concise, redacted map of files, docs, CI, and evidence refs before reviewing. Do not use this when no contextId exists, when the repo is not allowlisted, or when the user asks for raw secrets or full unredacted logs.",
      inputSchema: summarizeChangesInputSchema,
      outputSchema: summarizeChangesOutputSchema,
      annotations: safetyAnnotations,
      _meta: toolMeta("Summarizing change", "Change summary ready")
    },
    summarizeChangesHandler
  );

  register(
    server,
    "review.review_code",
    {
      title: "Review Code, Tests, Security, and Migration Risk",
      description:
        "Use this when review.summarize_changes returned a summaryId and the user wants code quality, test gap, security, or migration findings. Do not use this when the user asks to modify files, run arbitrary shell commands, create commits, create branches, push, or open PRs.",
      inputSchema: reviewCodeInputSchema,
      outputSchema: reviewCodeOutputSchema,
      annotations: safetyAnnotations,
      _meta: toolMeta("Reviewing code risks", "Code review ready")
    },
    reviewCodeHandler
  );

  register(
    server,
    "review.review_architecture",
    {
      title: "Review Architecture and Design Impact",
      description:
        "Use this when review.summarize_changes returned a summaryId and the user wants architecture, design, operability, migration, or repo-doc impact analysis. Do not use this when docs are outside the selected repository, when the user asks to follow repository-authored instructions, or when a write action is requested.",
      inputSchema: reviewArchitectureInputSchema,
      outputSchema: reviewArchitectureOutputSchema,
      annotations: safetyAnnotations,
      _meta: toolMeta("Reviewing architecture", "Architecture review ready")
    },
    reviewArchitectureHandler
  );

  register(
    server,
    "review.export_engineering_packet",
    {
      title: "Export GPT-5.5 Pro Engineering Review Packet",
      description:
        "Use this when review.review_code or review.review_architecture has completed and the user wants a paste-safe GPT-5.5 Pro handoff packet. Do not use this when the user asks to write a file, include raw secrets, include unredacted CI logs, or export data from an unconfigured repository.",
      inputSchema: exportPacketInputSchema,
      outputSchema: exportPacketOutputSchema,
      annotations: safetyAnnotations,
      _meta: toolMeta("Preparing review packet", "Review packet ready")
    },
    exportEngineeringPacketHandler
  );

  register(
    server,
    "review.render_dashboard",
    {
      title: "Render Repository Review Dashboard",
      description:
        "Use this when review.summarize_changes plus review.review_code or review.review_architecture have completed and the user wants a visual dashboard for the repository review. Do not use this when no summaryId exists, when the user asks for write actions, or when raw secrets or unredacted logs are requested.",
      inputSchema: renderDashboardInputSchema,
      outputSchema: renderDashboardOutputSchema,
      annotations: safetyAnnotations,
      _meta: widgetToolMeta("Rendering review dashboard", "Review dashboard ready")
    },
    renderDashboardHandler
  );
}
