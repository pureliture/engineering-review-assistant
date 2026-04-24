# Local Development and ChatGPT Developer Mode

## Build and Start

```bash
npm install
npm run build
npm start
```

The MCP endpoint is:

```text
http://127.0.0.1:2091/mcp
```

## MCP Inspector

```bash
npm run inspect
```

Inspector target:

```text
http://127.0.0.1:2091/mcp
```

## HTTPS Tunnel

Using ngrok:

```bash
ngrok http 2091
```

Using Cloudflare Tunnel:

```bash
cloudflared tunnel --url http://127.0.0.1:2091
```

Use the public HTTPS URL with `/mcp` appended.

```text
https://<tunnel-host>/mcp
```

## ChatGPT Developer Mode

1. Open ChatGPT web.
2. Go to Settings -> Apps/Connectors -> Advanced settings.
3. Enable Developer Mode.
4. Create an app from the remote MCP server URL.
5. Paste `https://<tunnel-host>/mcp`.
6. Confirm that the six `review.*` tools are listed:
   - `review.select_context`
   - `review.summarize_changes`
   - `review.review_code`
   - `review.review_architecture`
   - `review.export_engineering_packet`
   - `review.render_dashboard`
7. Run the prompts in `docs/GOLDEN_PROMPTS.md`.
8. Run a dashboard prompt after a review exists:
   ```text
   Use Engineering Review Assistant to render a dashboard for the last review.
   ```
9. Confirm the dashboard widget appears and shows changed files, findings, architecture risk, test gaps, file impact, and packet preview.
10. Refresh the app metadata after changing tool names, descriptions, schemas, or widget resource URIs.
