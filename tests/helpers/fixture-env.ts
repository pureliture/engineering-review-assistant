import path from "node:path";

process.env.ERA_LOCAL_SOURCES = path.join(process.cwd(), ".test-empty-local-sources.json");
process.env.ERA_GITHUB_SOURCES = path.join(process.cwd(), ".test-empty-github-sources.json");
