import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerReviewTools } from "./tools/register.js";
import { registerReviewDashboardResource } from "./widget/resource.js";

export function createServer(): McpServer {
  const server = new McpServer({
    name: "engineering-review-assistant",
    version: "0.1.0"
  });

  registerReviewDashboardResource(server);
  registerReviewTools(server);
  return server;
}
