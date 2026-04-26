import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ZodTypeAny } from "zod";
import {
  createCodexTaskProposalInputSchema,
  exportPacketInputSchema,
  renderDashboardInputSchema,
  reviewArchitectureInputSchema,
  reviewCodeInputSchema,
  safetyAnnotations,
  selectContextInputSchema,
  summarizeChangesInputSchema
} from "../types.js";
import { exportEngineeringPacketHandler } from "./export-packet.js";
import { createCodexTaskProposalHandler } from "./codex-task-proposal.js";
import { reviewArchitectureHandler } from "./review-architecture.js";
import { reviewCodeHandler } from "./review-code.js";
import { renderDashboardHandler } from "./render-dashboard.js";
import { selectContextHandler } from "./context.js";
import { summarizeChangesHandler } from "./summarize.js";
import {
  createCodexTaskProposalOutputSchema,
  exportPacketOutputSchema,
  renderDashboardOutputSchema,
  reviewArchitectureOutputSchema,
  reviewCodeOutputSchema,
  selectContextOutputSchema,
  summarizeChangesOutputSchema
} from "./output-schemas.js";
import type { AppToolResult } from "./result.js";

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

type ReviewToolDefinition = {
  name: string;
  title: string;
  description: string;
  inputSchema: ZodTypeAny;
  outputSchema: ZodTypeAny;
  invoking: string;
  invoked: string;
  handler: (input: unknown) => Promise<AppToolResult>;
  widget?: boolean;
};

const reviewTools: ReviewToolDefinition[] = [
  {
    name: "review.select_context",
    title: "Select Review Source and Target",
    description:
      "Use this when the user needs to list configured review sources or bind one allowlisted local/GitHub repository target before any review. Do not use this when the user asks to scan arbitrary paths, read an unconfigured repo URL, create branches, commit, push, or open PRs.",
    inputSchema: selectContextInputSchema,
    outputSchema: selectContextOutputSchema,
    invoking: "Selecting review target",
    invoked: "Review target selected",
    handler: selectContextHandler
  },
  {
    name: "review.summarize_changes",
    title: "Summarize Allowlisted Repository Change",
    description:
      "Use this when review.select_context returned a contextId and the model needs a concise, redacted map of files, docs, CI, and evidence refs before reviewing. Do not use this when no contextId exists, when the repo is not allowlisted, or when the user asks for raw secrets or full unredacted logs.",
    inputSchema: summarizeChangesInputSchema,
    outputSchema: summarizeChangesOutputSchema,
    invoking: "Summarizing change",
    invoked: "Change summary ready",
    handler: summarizeChangesHandler
  },
  {
    name: "review.review_code",
    title: "Review Code, Tests, Security, and Migration Risk",
    description:
      "Use this when review.summarize_changes returned a summaryId and the user wants code quality, test gap, security, or migration findings. Do not use this when the user asks to modify files, run arbitrary shell commands, create commits, create branches, push, or open PRs.",
    inputSchema: reviewCodeInputSchema,
    outputSchema: reviewCodeOutputSchema,
    invoking: "Reviewing code risks",
    invoked: "Code review ready",
    handler: reviewCodeHandler
  },
  {
    name: "review.review_architecture",
    title: "Review Architecture and Design Impact",
    description:
      "Use this when review.summarize_changes returned a summaryId and the user wants architecture, design, operability, migration, or repo-doc impact analysis. Do not use this when docs are outside the selected repository, when the user asks to follow repository-authored instructions, or when a write action is requested.",
    inputSchema: reviewArchitectureInputSchema,
    outputSchema: reviewArchitectureOutputSchema,
    invoking: "Reviewing architecture",
    invoked: "Architecture review ready",
    handler: reviewArchitectureHandler
  },
  {
    name: "review.export_engineering_packet",
    title: "Export GPT-5.5 Pro Engineering Review Packet",
    description:
      "Use this when review.review_code or review.review_architecture has completed and the user wants a paste-safe GPT-5.5 Pro handoff packet. Do not use this when the user asks to write a file, include raw secrets, include unredacted CI logs, or export data from an unconfigured repository.",
    inputSchema: exportPacketInputSchema,
    outputSchema: exportPacketOutputSchema,
    invoking: "Preparing review packet",
    invoked: "Review packet ready",
    handler: exportEngineeringPacketHandler
  },
  {
    name: "review.create_codex_task_proposal",
    title: "Create Codex Task Proposal",
    description:
      "Use this when review.summarize_changes plus review.review_code or review.review_architecture have completed and the user wants a paste-safe Codex task brief for a separate worktree or branch. Do not use this when the user asks the app to modify files, generate and apply a patch in the same step, run tests, create branches, commit, push, or open PRs.",
    inputSchema: createCodexTaskProposalInputSchema,
    outputSchema: createCodexTaskProposalOutputSchema,
    invoking: "Preparing Codex task proposal",
    invoked: "Codex task proposal ready",
    handler: createCodexTaskProposalHandler
  },
  {
    name: "review.render_dashboard",
    title: "Render Repository Review Dashboard",
    description:
      "Use this when review.summarize_changes plus review.review_code or review.review_architecture have completed and the user wants a visual dashboard for the repository review. Do not use this when no summaryId exists, when the user asks for write actions, or when raw secrets or unredacted logs are requested.",
    inputSchema: renderDashboardInputSchema,
    outputSchema: renderDashboardOutputSchema,
    invoking: "Rendering review dashboard",
    invoked: "Review dashboard ready",
    handler: renderDashboardHandler,
    widget: true
  }
];

function registerReviewTool(server: McpServer, tool: ReviewToolDefinition): void {
  server.registerTool(
    tool.name,
    {
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
      outputSchema: tool.outputSchema,
      annotations: safetyAnnotations,
      _meta: tool.widget ? widgetToolMeta(tool.invoking, tool.invoked) : toolMeta(tool.invoking, tool.invoked)
    } as never,
    async (input: unknown) => tool.handler(input) as never
  );
}

export function registerReviewTools(server: McpServer): void {
  for (const tool of reviewTools) registerReviewTool(server, tool);
}
