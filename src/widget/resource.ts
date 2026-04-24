import { readFile } from "node:fs/promises";
import path from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const WIDGET_URI = "ui://widget/review-dashboard-v1.html";
const WIDGET_MIME_TYPE = "text/html;profile=mcp-app";

async function readOptional(filePath: string): Promise<string> {
  try {
    return await readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export function registerReviewDashboardResource(server: McpServer): void {
  server.registerResource(
    "review-dashboard-widget",
    WIDGET_URI,
    {
      title: "Repository Review Dashboard",
      description: "Read-only dashboard for Engineering Review Assistant results.",
      mimeType: WIDGET_MIME_TYPE
    },
    async () => {
      const distRoot = path.join(process.cwd(), "dist", "widget");
      const [script, style] = await Promise.all([
        readOptional(path.join(distRoot, "review-dashboard.js")),
        readOptional(path.join(distRoot, "review-dashboard.css"))
      ]);

      return {
        contents: [
          {
            uri: WIDGET_URI,
            mimeType: WIDGET_MIME_TYPE,
            text: `
<div id="engineering-review-widget-root"></div>
<style>${style}</style>
<script>${script}</script>
            `.trim(),
            _meta: {
              ui: {
                prefersBorder: true,
                csp: {
                  connectDomains: [],
                  resourceDomains: []
                }
              },
              "openai/widgetDescription": "Shows a read-only engineering review dashboard with redacted evidence."
            }
          }
        ]
      };
    }
  );
}
