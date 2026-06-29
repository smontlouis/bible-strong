import { spawnSync } from "node:child_process";
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
import {
  buildProductReview,
  type ProductReviewEntry,
  type ProductReviewResult
} from "./lexiconProductReview.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 4173;
const LEXICON_DB = path.resolve(
  ROOT,
  "data/dictionaries/strong_lexicon.sqlite"
);
const LEXICON_FR_V2_FINAL = path.resolve(
  ROOT,
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl"
);
const ENTITIES_DB = path.resolve(ROOT, "data/entities/bible_entities.sqlite");

let lexiconProductReviewCache: {
  mtimeMs: number;
  result: ProductReviewResult;
} | null = null;

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

    if (url.pathname === "/favicon.ico") {
      response.writeHead(204);
      response.end();
      return;
    }

    if (isReactViewerRoute(url.pathname) && reactViewerEntryExists()) {
      if (url.pathname === "/viewer/review.html") {
        url.searchParams.set("view", "review");
      }
      if (url.pathname === "/viewer/lexicon.html") {
        url.searchParams.set("view", "lexicon");
      }
      serveStatic("/viewer/app/index.html", response, request.method === "HEAD");
      return;
    }

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

    if (request.method === "GET" && url.pathname === "/api/lexicon/search") {
      handleLexiconSearch(url, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/lexicon/entry") {
      handleLexiconEntry(url, response);
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/entities/tree") {
      handleEntityTree(response);
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/lexicon-v2/review-list"
    ) {
      handleLexiconV2ReviewList(url, response);
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/lexicon-v2/review-entry"
    ) {
      handleLexiconV2ReviewEntry(url, response);
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

function handleLexiconSearch(url: URL, response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }

  const query = (url.searchParams.get("q") ?? "").trim();
  const language = url.searchParams.get("language") ?? "all";
  const letter = (url.searchParams.get("letter") ?? "").trim().toLowerCase();
  const limit = clampNumber(url.searchParams.get("limit"), 1, 500, 40);
  const offset = clampNumber(url.searchParams.get("offset"), 0, 100000, 0);
  const where: string[] = [];

  if (language === "greek" || language === "hebrew") {
    where.push(`se.language = ${sqlString(language)}`);
  }

  if (query) {
    const like = sqlString(`%${query}%`);
    const normalizedStrong = normalizeStrongQuery(query);
    const strongLike = normalizedStrong
      ? sqlString(`%${normalizedStrong}%`)
      : like;
    where.push(`(
      se.eStrong LIKE ${strongLike}
      OR se.dStrong LIKE ${strongLike}
      OR se.uStrong LIKE ${strongLike}
      OR se.original LIKE ${like}
      OR se.transliteration LIKE ${like}
      OR se.classicTransliteration LIKE ${like}
      OR se.pronunciation LIKE ${like}
      OR se.gloss LIKE ${like}
      OR se.meaning LIKE ${like}
      OR lt.gloss LIKE ${like}
      OR lt.meaning LIKE ${like}
      OR lt.meaningHtml LIKE ${like}
    )`);
  }

  if (/^[a-z]$/.test(letter)) {
    where.push(
      `LOWER(COALESCE(NULLIF(se.classicTransliteration, ''), se.transliteration)) LIKE ${sqlString(`${letter}%`)}`
    );
  }

  const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
  const rows = runSqlJson(
    `
      SELECT
        se.id,
        se.language,
        se.eStrong,
        se.dStrong,
        se.uStrong,
        se.original,
        se.transliteration,
        se.classicTransliteration,
        se.pronunciation,
        se.morph,
        se.gloss AS glossEn,
        se.meaning AS meaningEn,
        lt.gloss AS glossFr,
        lt.meaning AS meaningSimpleFr,
        lt.meaningHtml AS meaningHtmlFr
      FROM StepEntries se
      LEFT JOIN LexiconTranslations lt
        ON lt.stepEntryId = se.id
       AND lt.language = 'fr'
      ${whereSql}
      ORDER BY
        CASE
          WHEN ${query ? "se.eStrong = " + sqlString(normalizeStrongQuery(query) ?? query) : "0"} THEN 0
          WHEN ${query ? "se.eStrong LIKE " + sqlString(`${normalizeStrongQuery(query) ?? query}%`) : "0"} THEN 1
          ELSE 2
        END,
        se.language,
        se.baseCode,
        se.id
      LIMIT ${limit}
      OFFSET ${offset}
    `
  );
  sendJson(response, 200, {
    query,
    language,
    letter,
    limit,
    offset,
    count: rows.length,
    rows
  });
}

function handleLexiconEntry(url: URL, response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }

  const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    sendJson(response, 400, { error: "invalid-id" });
    return;
  }

  const rows = runSqlJson(
    `
      SELECT
        se.id,
        se.language,
        se.baseCode,
        se.eStrong,
        se.dStrong,
        se.uStrong,
        se.original,
        se.transliteration,
        se.classicTransliteration,
        se.pronunciation,
        se.morph,
        se.gloss AS glossEn,
        se.meaning AS meaningEn,
        lt.gloss AS glossFr,
        lt.meaning AS meaningSimpleFr,
        lt.meaningHtml AS meaningHtmlFr
      FROM StepEntries se
      LEFT JOIN LexiconTranslations lt
        ON lt.stepEntryId = se.id
       AND lt.language = 'fr'
      WHERE se.id = ${id}
      LIMIT 1
    `
  );

  if (rows.length === 0) {
    sendJson(response, 404, { error: "entry-not-found" });
    return;
  }

  const resources = runSqlJson(
    `
      SELECT
        lr.source,
        lr.kind,
        lr.contentHtml,
        lrt.contentHtml AS contentHtmlFr,
        lrt.contentText AS contentTextFr
      FROM LexiconResources lr
      LEFT JOIN LexiconResourceTranslations lrt
        ON lrt.resourceId = lr.id
       AND lrt.language = 'fr'
      WHERE lr.stepEntryId = ${id}
      ORDER BY lr.source, lr.kind
    `
  );

  sendJson(response, 200, { entry: rows[0], resources });
}

function handleEntityTree(response: ServerResponse): void {
  if (!existsSync(ENTITIES_DB)) {
    sendJson(response, 500, { error: "entities-db-not-found" });
    return;
  }

  const nodes = runSqlJsonFromDb(
    ENTITIES_DB,
    `
      SELECT
        e.id,
        e.uniqueName,
        e.displayName AS englishName,
        COALESCE(NULLIF(et.displayName, ''), e.displayName) AS displayName,
        e.type AS gender,
        COALESCE(NULLIF(et.briefest, ''), e.briefest) AS briefest,
        COALESCE(NULLIF(et.brief, ''), e.brief) AS brief,
        COALESCE(NULLIF(et.shortDescription, ''), e.shortDescription) AS shortDescription
      FROM Entities e
      LEFT JOIN EntityTranslations et
        ON et.entityId = e.id
       AND et.language = 'fr'
      WHERE e.category = 'person'
      ORDER BY e.displayName, e.id
    `
  );
  const links = runSqlJsonFromDb(
    ENTITIES_DB,
    `
      SELECT DISTINCT
        er.fromEntityId,
        er.toEntityId,
        er.relation,
        er.certainty
      FROM EntityRelations er
      JOIN Entities source ON source.id = er.fromEntityId
      JOIN Entities target ON target.id = er.toEntityId
      WHERE source.category = 'person'
        AND target.category = 'person'
        AND er.relation IN ('father', 'mother', 'offspring', 'partner', 'sibling')
      ORDER BY er.relation, er.fromEntityId, er.toEntityId
    `
  );

  sendJson(response, 200, {
    generatedAt: new Date().toISOString(),
    nodes,
    links
  });
}

function handleLexiconV2ReviewList(url: URL, response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }
  if (!existsSync(LEXICON_FR_V2_FINAL)) {
    sendJson(response, 500, { error: "lexicon-fr-v2-final-not-found" });
    return;
  }

  const query = (url.searchParams.get("q") ?? "").trim().toLowerCase();
  const language = url.searchParams.get("language") ?? "all";
  const bucket = url.searchParams.get("bucket") ?? "top";
  const limit = clampNumber(url.searchParams.get("limit"), 1, 500, 200);
  const review = readLexiconProductReview();

  const rows = review.entries
    .filter((entry) => matchesReviewBucket(entry, bucket))
    .filter((entry) => language === "all" || entry.language === language)
    .filter((entry) => matchesReviewQuery(entry, query))
    .slice(0, limit)
    .map(toReviewListRow);

  sendJson(response, 200, {
    query,
    language,
    bucket,
    limit,
    count: rows.length,
    summary: review.summary,
    rows
  });
}

function handleLexiconV2ReviewEntry(url: URL, response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }
  if (!existsSync(LEXICON_FR_V2_FINAL)) {
    sendJson(response, 500, { error: "lexicon-fr-v2-final-not-found" });
    return;
  }

  const id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    sendJson(response, 400, { error: "invalid-id" });
    return;
  }

  const review = readLexiconProductReview();
  const entry = review.entries.find((candidate) => candidate.id === id);
  if (!entry) {
    sendJson(response, 404, { error: "entry-not-found" });
    return;
  }

  const resources = runSqlJson(
    `
      SELECT
        lr.source,
        lr.kind,
        lr.contentHtml,
        lrt.contentHtml AS contentHtmlFr,
        lrt.contentText AS contentTextFr
      FROM LexiconResources lr
      LEFT JOIN LexiconResourceTranslations lrt
        ON lrt.resourceId = lr.id
       AND lrt.language = 'fr'
      WHERE lr.stepEntryId = ${id}
      ORDER BY lr.source, lr.kind
    `
  );

  sendJson(response, 200, { entry, resources });
}

function readLexiconProductReview(): ProductReviewResult {
  const mtimeMs = statSync(LEXICON_FR_V2_FINAL).mtimeMs;
  if (lexiconProductReviewCache?.mtimeMs === mtimeMs) {
    return lexiconProductReviewCache.result;
  }

  const result = buildProductReview({
    dbPath: LEXICON_DB,
    finalJsonlPath: LEXICON_FR_V2_FINAL
  });
  lexiconProductReviewCache = { mtimeMs, result };
  return result;
}

function matchesReviewBucket(
  entry: ProductReviewEntry,
  bucket: string
): boolean {
  if (bucket === "all") return true;
  if (bucket === "manual") return entry.flags.includes("manual-fix");
  if (bucket === "critical") return entry.flags.includes("critical-strong");
  if (bucket === "long") return entry.flags.includes("long-entry");
  if (bucket === "refs") return entry.flags.includes("many-references");
  if (bucket === "anomaly") {
    return entry.flags.some((flag) =>
      [
        "ratio-low",
        "ratio-high",
        "residual-english",
        "suspicious-name"
      ].includes(flag)
    );
  }
  return true;
}

function matchesReviewQuery(entry: ProductReviewEntry, query: string): boolean {
  if (!query) return true;
  const normalizedStrong = normalizeStrongQuery(query);
  const haystack = [
    entry.eStrong,
    entry.dStrong,
    entry.uStrong,
    entry.original,
    entry.transliteration,
    entry.glossEn,
    entry.glossFr,
    entry.previewEn,
    entry.previewFr,
    ...entry.flags
  ]
    .join(" ")
    .toLowerCase();
  return (
    haystack.includes(query) ||
    (normalizedStrong !== null &&
      haystack.includes(normalizedStrong.toLowerCase()))
  );
}

function toReviewListRow(entry: ProductReviewEntry): Record<string, unknown> {
  return {
    id: entry.id,
    language: entry.language,
    eStrong: entry.eStrong,
    dStrong: entry.dStrong,
    uStrong: entry.uStrong,
    original: entry.original,
    transliteration: entry.transliteration,
    glossEn: entry.glossEn,
    glossFr: entry.glossFr,
    status: entry.status,
    score: entry.score,
    flags: entry.flags,
    sourceChars: entry.sourceChars,
    translatedChars: entry.translatedChars,
    sourceReferenceCount: entry.sourceReferenceCount,
    translatedReferenceCount: entry.translatedReferenceCount,
    lengthRatio: entry.lengthRatio,
    previewFr: entry.previewFr,
    previewEn: entry.previewEn
  };
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

function isReactViewerRoute(pathname: string): boolean {
  return ["/viewer/", "/viewer/index.html", "/viewer/review.html", "/viewer/lexicon.html"].includes(
    pathname
  );
}

function reactViewerEntryExists(): boolean {
  return existsSync(path.resolve(ROOT, "viewer/app/index.html"));
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
  payload: unknown
): void {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8"
  });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function runSqlJson<T = Record<string, unknown>>(sql: string): T[] {
  return runSqlJsonFromDb(LEXICON_DB, sql);
}

function runSqlJsonFromDb<T = Record<string, unknown>>(
  dbPath: string,
  sql: string
): T[] {
  const result = spawnSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 30
  });
  if (result.status !== 0) {
    throw new Error(`sqlite3 failed: ${result.stderr}`);
  }
  return JSON.parse(result.stdout || "[]") as T[];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeStrongQuery(query: string): string | null {
  const match = /^([gh])0*(\d{1,5})([a-z]?)$/i.exec(query.trim());
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}${match[3].toUpperCase()}`;
}

function clampNumber(
  value: string | null,
  min: number,
  max: number,
  fallback: number
): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}
