# Engineering Review Assistant

Engineering Review Assistant는 ChatGPT에서 사용자가 명시적으로 선택한 allowlisted repository change를 read-only로 검토하고, 선택적으로 React dashboard widget으로 결과를 보여주는 MCP app입니다.

## V1 기능

- `review.select_context`
- `review.summarize_changes`
- `review.review_code`
- `review.review_architecture`
- `review.export_engineering_packet`
- `review.render_dashboard`

## 로컬 실행

```bash
npm install
npm run build
npm start
```

기본 서버 주소는 `http://127.0.0.1:2091/mcp`입니다.

## 테스트

```bash
npm test
node --test "dist/tests/golden/**/*.test.js"
```

## Widget Preview

React/Vite widget만 브라우저에서 확인하려면 다음을 실행합니다.

```bash
npm run widget:dev
```

ChatGPT 안에서는 `review.render_dashboard`가 `ui://widget/review-dashboard-v1.html` resource를 렌더링합니다.

## MCP Inspector

```bash
npm run inspect
```

## ChatGPT Developer Mode

1. 서버를 실행합니다.
2. ngrok 또는 Cloudflare Tunnel로 로컬 서버를 HTTPS로 노출합니다.
   ```bash
   ngrok http 2091
   ```
3. ChatGPT Settings -> Apps/Connectors -> Advanced settings에서 Developer Mode를 켭니다.
4. Create app에서 `https://<tunnel-host>/mcp`를 등록합니다.
5. tool metadata 변경 후에는 ChatGPT app 설정에서 refresh 합니다.

## Fixture-first 동작

`config/local-sources.json` 또는 `config/github-sources.json`에 live source가 없으면 fixture source가 자동으로 노출됩니다.
