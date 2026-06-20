import { createReadStream, existsSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import path from "node:path";
import { statSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { applyReviewDecisionPayload, type DecisionFile } from "./llmReview.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 4173;

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".tsv", "text/tab-separated-values; charset=utf-8"],
  [".csv", "text/csv; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"]
]);

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

    if (url.pathname === "/viewer/" && url.searchParams.has("review")) {
      response.writeHead(302, {
        Location: `/viewer/review.html?${url.searchParams.toString()}`
      });
      response.end();
      return;
    }

    if (request.method === "POST" && url.pathname === "/api/llm-review/apply") {
      await handleApplyReview(request, response);
      return;
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      sendJson(response, 405, { error: "method-not-allowed" });
      return;
    }

    serveStatic(url.pathname, response, request.method === "HEAD");
  } catch (error) {
    sendJson(response, 500, {
      error: error instanceof Error ? error.message : "unknown-error"
    });
  }
});

const port = Number.parseInt(process.env.PORT ?? String(DEFAULT_PORT), 10);
server.listen(port, () => {
  console.log(`Viewer listening on http://localhost:${port}/viewer/`);
});

async function handleApplyReview(
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> {
  const payload = (await readJsonBody(request)) as DecisionFile;
  if (!payload.bible) {
    sendJson(response, 400, { error: "missing-bible" });
    return;
  }

  const result = await applyReviewDecisionPayload({
    bible: payload.bible,
    decisions: payload
  });
  sendJson(response, 200, result);
}

function serveStatic(
  pathname: string,
  response: ServerResponse,
  headOnly: boolean
): void {
  const requestedPath =
    pathname === "/" ? "/viewer/index.html" : decodeURIComponent(pathname);
  let filePath = path.resolve(ROOT, `.${requestedPath}`);
  if (existsSync(filePath) && statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }

  if (!isAllowedStaticPath(filePath) || !existsSync(filePath)) {
    sendJson(response, 404, { error: "not-found" });
    return;
  }

  const extension = path.extname(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_TYPES.get(extension) ?? "application/octet-stream"
  });

  if (headOnly) {
    response.end();
    return;
  }

  const stream = createReadStream(filePath);
  stream.on("error", () => {
    if (!response.headersSent) {
      sendJson(response, 500, { error: "read-failed" });
    } else {
      response.destroy();
    }
  });
  stream.pipe(response);
}

function isAllowedStaticPath(filePath: string): boolean {
  const allowedRoots = ["viewer", "outputs", "data/strongs"].map((folder) =>
    path.resolve(ROOT, folder)
  );
  return allowedRoots.some(
    (allowedRoot) =>
      filePath === allowedRoot ||
      filePath.startsWith(`${allowedRoot}${path.sep}`)
  );
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(
  response: ServerResponse,
  statusCode: number,
  payload: Record<string, unknown>
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}
