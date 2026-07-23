import { createReadStream, existsSync } from "node:fs";
import {
  createServer,
  type IncomingMessage,
  type ServerResponse
} from "node:http";
import path from "node:path";
import { statSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { applyReviewDecisionPayload, type DecisionFile } from "./llmReview.js";
import {
  getJsonlBibleCatalog,
  getJsonlBibleChapter,
  getJsonlBibleConcordance,
  getJsonlBibleLemmaStats,
  JsonlBibleViewerError,
  parseJsonlBibleIds
} from "./jsonlBibleViewer.js";
import {
  buildProductReview,
  type ProductReviewEntry,
  type ProductReviewResult
} from "./lexiconProductReview.js";
import {
  getStrongReviewItems,
  getStrongReviewSummary,
  getStrongViewerMetadata,
  getStrongViewerVerses,
  isStrongReviewBucket,
  parseStrictInteger,
  StrongViewerApiError,
  validateBibleId,
  validateBookId
} from "./strongViewerApi.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_PORT = 4173;
const DEFAULT_LEXICON_DB =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const LEXICON_DB = path.resolve(
  ROOT,
  process.env.LEXICON_DB ?? DEFAULT_LEXICON_DB
);
const LEGACY_LEXICON_DB = path.resolve(
  ROOT,
  process.env.LEGACY_LEXICON_DB ?? "data/dictionaries/strong.legacy.sqlite"
);
const LEXICON_FR_V2_FINAL = path.resolve(
  ROOT,
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.final.jsonl"
);
const DEFAULT_ENTITIES_DB = "data/entities/bible_entities.production.sqlite";
const ENTITIES_DB = path.resolve(
  ROOT,
  process.env.ENTITIES_DB ?? DEFAULT_ENTITIES_DB
);
const DEFAULT_OCCURRENCES_DB =
  "data/dictionaries/strong_lexicon.occurrences.production.sqlite";
const OCCURRENCES_DB = path.resolve(
  ROOT,
  process.env.OCCURRENCES_DB ?? DEFAULT_OCCURRENCES_DB
);
// Kept for a possible future concordance view. The production viewer does not
// touch the large occurrences database while this flag is disabled.
const LEXICON_OCCURRENCES_ENABLED = false;

let lexiconProductReviewCache: {
  mtimeMs: number;
  result: ProductReviewResult;
} | null = null;
const readonlyDatabases = new Map<
  string,
  { database: DatabaseSync; mtimeMs: number }
>();

const MIME_TYPES = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".jsonl", "application/x-ndjson; charset=utf-8"],
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
      if (url.pathname === "/viewer/workflow.html") {
        url.searchParams.set("view", "workflow");
      }
      if (url.pathname === "/viewer/jsonl.html") {
        url.searchParams.set("view", "jsonl");
      }
      serveStatic(
        "/viewer/app/index.html",
        response,
        request.method === "HEAD"
      );
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

    if (request.method === "GET" && url.pathname === "/api/lexicon/metadata") {
      handleLexiconMetadata(response);
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

    if (request.method === "GET" && url.pathname === "/api/strong/metadata") {
      const bible = validateBibleId(url.searchParams.get("bible"));
      sendJson(response, 200, getStrongViewerMetadata({ bible }));
      return;
    }

    if (request.method === "GET" && url.pathname === "/api/strong/verses") {
      const bible = validateBibleId(url.searchParams.get("bible"));
      const book = validateBookId(url.searchParams.get("book"));
      const chapter = parseStrictInteger(url.searchParams.get("chapter"), {
        name: "chapter",
        min: 1,
        max: 999
      });
      sendJson(response, 200, getStrongViewerVerses({ bible, book, chapter }));
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/jsonl-bibles/catalog"
    ) {
      sendJson(response, 200, await getJsonlBibleCatalog({ root: ROOT }));
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/jsonl-bibles/chapter"
    ) {
      const bookId = validateBookId(url.searchParams.get("book"));
      const chapter = parseStrictInteger(url.searchParams.get("chapter"), {
        name: "chapter",
        min: 1,
        max: 999
      });
      sendJson(
        response,
        200,
        await getJsonlBibleChapter({
          root: ROOT,
          versions: parseJsonlBibleIds(url.searchParams.get("versions")),
          bookId,
          chapter
        })
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/jsonl-bibles/concordance"
    ) {
      const versions = parseJsonlBibleIds(url.searchParams.get("version"));
      if (versions.length !== 1) {
        throw new JsonlBibleViewerError(
          400,
          "concordance-requires-one-version"
        );
      }
      const code = url.searchParams.get("code");
      if (!code) {
        throw new JsonlBibleViewerError(400, "missing-concordance-code");
      }
      const requestedBook = url.searchParams.get("book");
      const lemma = url.searchParams.get("lemma");
      const partOfSpeech = url.searchParams.get("pos");
      if (partOfSpeech !== null && lemma === null) {
        throw new JsonlBibleViewerError(
          400,
          "concordance-pos-filter-requires-lemma"
        );
      }
      if (
        (lemma !== null && (lemma.length === 0 || lemma.length > 200)) ||
        (partOfSpeech !== null &&
          (partOfSpeech.length === 0 || partOfSpeech.length > 32))
      ) {
        throw new JsonlBibleViewerError(
          400,
          "invalid-concordance-lemma-filter"
        );
      }
      sendJson(
        response,
        200,
        getJsonlBibleConcordance({
          root: ROOT,
          version: versions[0]!,
          code,
          bookId: requestedBook ? validateBookId(requestedBook) : undefined,
          lemma: lemma ?? undefined,
          partOfSpeech: partOfSpeech ?? undefined,
          limit: parseStrictInteger(url.searchParams.get("limit"), {
            name: "limit",
            min: 1,
            max: 100,
            fallback: 20
          }),
          offset: parseStrictInteger(url.searchParams.get("offset"), {
            name: "offset",
            min: 0,
            max: 1_000_000,
            fallback: 0
          })
        })
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/jsonl-bibles/lemma-stats"
    ) {
      const versions = parseJsonlBibleIds(url.searchParams.get("version"));
      if (versions.length !== 1) {
        throw new JsonlBibleViewerError(
          400,
          "lemma-stats-requires-one-version"
        );
      }
      const code = url.searchParams.get("code");
      if (!code) {
        throw new JsonlBibleViewerError(400, "missing-lemma-code");
      }
      sendJson(
        response,
        200,
        getJsonlBibleLemmaStats({
          root: ROOT,
          version: versions[0]!,
          code
        })
      );
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/strong/review/summary"
    ) {
      const bible = validateBibleId(url.searchParams.get("bible"));
      sendJson(response, 200, await getStrongReviewSummary({ bible }));
      return;
    }

    if (
      request.method === "GET" &&
      url.pathname === "/api/strong/review/items"
    ) {
      const bible = validateBibleId(url.searchParams.get("bible"));
      const bucket = url.searchParams.get("bucket");
      if (!isStrongReviewBucket(bucket)) {
        throw new StrongViewerApiError(400, "invalid-bucket");
      }
      const limit = parseStrictInteger(url.searchParams.get("limit"), {
        name: "limit",
        min: 1,
        max: 200,
        fallback: 50
      });
      const offset = parseStrictInteger(url.searchParams.get("offset"), {
        name: "offset",
        min: 0,
        max: 1_000_000,
        fallback: 0
      });
      sendJson(
        response,
        200,
        await getStrongReviewItems({
          bible,
          bucket,
          q: url.searchParams.get("q") ?? "",
          limit,
          offset
        })
      );
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
    if (error instanceof JsonlBibleViewerError) {
      sendJson(response, error.statusCode, { error: error.code });
      return;
    }
    if (error instanceof StrongViewerApiError) {
      sendJson(response, error.statusCode, { error: error.code });
      return;
    }
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
  const normalizedStrong = normalizeStrongQuery(query);
  const classicalStrong = normalizedStrong
    ? classicalStrongFromStepCode(normalizedStrong)
    : null;
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
    const strongLike = normalizedStrong
      ? sqlString(`%${normalizedStrong}%`)
      : like;
    where.push(`(
      se.eStrong LIKE ${strongLike}
      OR se.dStrong LIKE ${strongLike}
      OR se.uStrong LIKE ${strongLike}
      OR si.stepCode LIKE ${strongLike}
      ${classicalStrong && classicalStrong !== normalizedStrong ? `OR se.eStrong = ${sqlString(classicalStrong)}` : ""}
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
      LEFT JOIN StepEntryIdentities si
        ON si.stepEntryId = se.id
      ${whereSql}
      ORDER BY
        CASE
          WHEN ${query ? "si.stepCode = " + sqlString(normalizedStrong ?? query) : "0"} THEN 0
          WHEN ${query ? "se.eStrong = " + sqlString(normalizedStrong ?? query) : "0"} THEN 1
          WHEN ${classicalStrong && classicalStrong !== normalizedStrong ? "se.eStrong = " + sqlString(classicalStrong) : "0"} THEN 2
          WHEN ${query ? "si.stepCode LIKE " + sqlString(`${normalizedStrong ?? query}%`) : "0"} THEN 3
          WHEN ${query ? "se.eStrong LIKE " + sqlString(`${normalizedStrong ?? query}%`) : "0"} THEN 4
          ELSE 5
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

function handleLexiconMetadata(response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }

  const metadata = Object.fromEntries(
    runSqlJson<{ key: string; value: string }>(
      `SELECT key, value FROM DictionaryMeta WHERE key IN (
        'generatedAt',
        'lexiconEnrichedAt',
        'lexiconFrenchQualityReleaseKey',
        'lexiconV3Profile',
        'lexiconV3ReleaseKey',
        'lexiconViewerProfile',
        'lexiconViewerEnrichedAt',
        'productionProfile'
      ) ORDER BY key`
    ).map((row) => [row.key, row.value])
  );
  const counts = runSqlJson<{
    entries: number;
    translationsFr: number;
  }>(`
    SELECT
      (SELECT count(*) FROM StepEntries) AS entries,
      (SELECT count(*) FROM LexiconTranslations WHERE language='fr')
        AS translationsFr
  `)[0];
  const legacyEntries = existsSync(LEGACY_LEXICON_DB)
    ? (runSqlJsonFromDb<{ count: number }>(
        LEGACY_LEXICON_DB,
        `SELECT
           (SELECT count(*) FROM Grec WHERE Code > 0) +
           (SELECT count(*) FROM Hebreu WHERE Code > 0) AS count`
      )[0]?.count ?? 0)
    : 0;
  const resourceEntries = lexiconTableExists("LexiconResources")
    ? (runSqlJson<{ count: number }>(
        "SELECT count(*) AS count FROM LexiconResources"
      )[0]?.count ?? 0)
    : 0;
  const tipnrEntities = existsSync(ENTITIES_DB)
    ? (runSqlJsonFromDb<{ count: number }>(
        ENTITIES_DB,
        "SELECT count(*) AS count FROM Entities"
      )[0]?.count ?? 0)
    : 0;
  const relationEntries = lexiconTableExists("LexiconRelations")
    ? (runSqlJson<{ count: number }>(
        "SELECT count(*) AS count FROM LexiconRelations"
      )[0]?.count ?? 0)
    : 0;
  const morphologyTranslations = lexiconTableExists(
    "MorphologyCodeTranslations"
  )
    ? (runSqlJson<{ count: number }>(
        `SELECT count(*) AS count FROM MorphologyCodeTranslations
         WHERE language='fr'`
      )[0]?.count ?? 0)
    : 0;
  const occurrenceCount =
    LEXICON_OCCURRENCES_ENABLED && existsSync(OCCURRENCES_DB)
      ? (runSqlJsonFromDb<{ count: number }>(
          OCCURRENCES_DB,
          "SELECT count(*) AS count FROM Occurrences"
        )[0]?.count ?? 0)
      : 0;
  const tipnrPlaces = existsSync(ENTITIES_DB)
    ? (runSqlJsonFromDb<{ count: number }>(
        ENTITIES_DB,
        "SELECT count(*) AS count FROM EntityPlaces"
      )[0]?.count ?? 0)
    : 0;

  sendJson(response, 200, {
    database: path.relative(ROOT, LEXICON_DB),
    legacyDatabase: existsSync(LEGACY_LEXICON_DB)
      ? path.relative(ROOT, LEGACY_LEXICON_DB)
      : null,
    releaseKey:
      metadata.lexiconFrenchQualityReleaseKey ??
      metadata.lexiconV3ReleaseKey ??
      null,
    profile:
      metadata.lexiconViewerProfile ??
      metadata.lexiconV3Profile ??
      metadata.productionProfile ??
      "unknown",
    generatedAt:
      metadata.lexiconViewerEnrichedAt ??
      metadata.lexiconEnrichedAt ??
      metadata.generatedAt ??
      null,
    entries: counts?.entries ?? 0,
    translationsFr: counts?.translationsFr ?? 0,
    legacyEntries,
    resourcesIncluded: resourceEntries > 0,
    resourceEntries,
    relationEntries,
    morphologyTranslations,
    occurrenceDatabase:
      LEXICON_OCCURRENCES_ENABLED && existsSync(OCCURRENCES_DB)
        ? path.relative(ROOT, OCCURRENCES_DB)
        : null,
    occurrenceCount,
    tipnrDatabase: existsSync(ENTITIES_DB)
      ? path.relative(ROOT, ENTITIES_DB)
      : null,
    tipnrEntities,
    tipnrPlaces
  });
}

function handleLexiconEntry(url: URL, response: ServerResponse): void {
  if (!existsSync(LEXICON_DB)) {
    sendJson(response, 500, { error: "lexicon-db-not-found" });
    return;
  }

  let id = Number.parseInt(url.searchParams.get("id") ?? "", 10);
  if (!Number.isInteger(id) || id <= 0) {
    const requestedStrong = normalizeStrongQuery(
      url.searchParams.get("strong") ?? ""
    );
    if (requestedStrong) {
      id =
        runSqlJson<{ id: number }>(
          `SELECT se.id
           FROM StepEntries se
           LEFT JOIN StepEntryIdentities si ON si.stepEntryId=se.id
           WHERE si.stepCode=${sqlString(requestedStrong)}
              OR se.uStrong=${sqlString(requestedStrong)}
              OR se.eStrong=${sqlString(requestedStrong)}
           ORDER BY
             CASE
               WHEN si.stepCode=${sqlString(requestedStrong)} THEN 0
               WHEN se.uStrong=${sqlString(requestedStrong)} THEN 1
               ELSE 2
             END,
             se.id
           LIMIT 1`
        )[0]?.id ?? Number.NaN;
    }
  }
  if (!Number.isInteger(id) || id <= 0) {
    sendJson(response, 400, { error: "invalid-id" });
    return;
  }

  const rows = runSqlJson<{
    id: number;
    language: "greek" | "hebrew";
    baseCode: number;
    uStrong: string;
    [key: string]: unknown;
  }>(
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

  const include = url.searchParams.get("include") ?? "all";
  const extended = include === "all" || include === "extended";
  const identity = readStepEntryIdentity(id);
  const legacy = extended ? readLegacyLexiconEntry(rows[0]) : null;
  const resources = extended ? readLexiconResources(id) : [];
  const tipnrEntities = extended ? readTipnrEntities(rows[0]) : [];
  const relations = extended ? readLexiconRelations(id) : [];
  const morphology = extended ? readLexiconMorphology(rows[0].morph) : [];
  const occurrences =
    extended && LEXICON_OCCURRENCES_ENABLED
      ? readLexiconOccurrences(
          typeof identity?.stepCode === "string" ? identity.stepCode : "",
          typeof rows[0].eStrong === "string" ? rows[0].eStrong : ""
        )
      : null;

  sendJson(response, 200, {
    entry: rows[0],
    identity,
    legacy,
    resources,
    tipnrEntities,
    relations,
    morphology,
    occurrences
  });
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

  const resources = readLexiconResources(id);

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
  return [
    "/viewer/",
    "/viewer/index.html",
    "/viewer/review.html",
    "/viewer/lexicon.html",
    "/viewer/workflow.html",
    "/viewer/jsonl.html"
  ].includes(pathname);
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

function readLexiconResources(stepEntryId: number): Record<string, unknown>[] {
  if (!lexiconTableExists("LexiconResources")) return [];

  const hasTranslations = lexiconTableExists("LexiconResourceTranslations");
  return runSqlJson(`
    SELECT
      lr.source,
      lr.kind,
      lr.contentHtml,
      ${hasTranslations ? "lrt.contentHtml" : "NULL"} AS contentHtmlFr,
      ${hasTranslations ? "lrt.contentText" : "NULL"} AS contentTextFr
    FROM LexiconResources lr
    ${
      hasTranslations
        ? `LEFT JOIN LexiconResourceTranslations lrt
             ON lrt.resourceId = lr.id
            AND lrt.language = 'fr'`
        : ""
    }
    WHERE lr.stepEntryId = ${stepEntryId}
    ORDER BY lr.source, lr.kind
  `);
}

function readStepEntryIdentity(
  stepEntryId: number
): Record<string, unknown> | null {
  if (!lexiconTableExists("StepEntryIdentities")) return null;
  return (
    runSqlJson<Record<string, unknown>>(`
      SELECT
        stepCode,
        rawDStrong,
        relationKind,
        relatedStepCode,
        relationLabelEn,
        relationLabelFr
      FROM StepEntryIdentities
      WHERE stepEntryId = ${stepEntryId}
      LIMIT 1
    `)[0] ?? null
  );
}

function readLexiconRelations(stepEntryId: number): Record<string, unknown>[] {
  if (!lexiconTableExists("LexiconRelations")) return [];
  return runSqlJson(`
    SELECT
      r.id,
      r.toStepEntryId,
      r.toStepCode,
      r.groupKind,
      r.relationKind,
      r.labelEn,
      r.labelFr,
      r.source,
      target.language,
      target.eStrong,
      target.uStrong,
      target.original,
      target.transliteration,
      target.gloss AS glossEn,
      translated.gloss AS glossFr
    FROM LexiconRelations r
    LEFT JOIN StepEntries target ON target.id=r.toStepEntryId
    LEFT JOIN LexiconTranslations translated
      ON translated.stepEntryId=target.id AND translated.language='fr'
    WHERE r.fromStepEntryId=${stepEntryId}
    ORDER BY r.groupKind, r.sortOrder, r.toStepCode, r.id
  `);
}

function readLexiconMorphology(value: unknown): Record<string, unknown>[] {
  if (typeof value !== "string" || !value.trim()) return [];
  if (!lexiconTableExists("MorphologyCodes")) return [];
  const normalized = value.replaceAll(" ", "");
  return runSqlJson(`
    SELECT
      mc.code,
      mc.normalizedCode,
      mc.language,
      mc.scope,
      mc.meaning AS meaningEn,
      mc.description AS descriptionEn,
      mct.meaning AS meaningFr,
      mct.description AS descriptionFr
    FROM MorphologyCodes mc
    LEFT JOIN MorphologyCodeTranslations mct
      ON mct.morphologyCodeId=mc.id AND mct.language='fr'
    WHERE mc.scope='lexical_brief'
      AND (mc.code=${sqlString(value)} OR mc.normalizedCode=${sqlString(normalized)})
    ORDER BY CASE WHEN mc.code=${sqlString(value)} THEN 0 ELSE 1 END, mc.id
    LIMIT 4
  `);
}

function readLexiconOccurrences(
  stepCode: string,
  eStrong: string
): Record<string, unknown> | null {
  if (!existsSync(OCCURRENCES_DB) || (!stepCode && !eStrong)) return null;
  const exactStats = stepCode
    ? (runSqlJsonFromDb<Record<string, unknown>>(
        OCCURRENCES_DB,
        `SELECT * FROM OccurrenceStats
         WHERE identityKind='step' AND strongCode=${sqlString(stepCode)}
         LIMIT 1`
      )[0] ?? null)
    : null;
  const classicalStats = eStrong
    ? (runSqlJsonFromDb<Record<string, unknown>>(
        OCCURRENCES_DB,
        `SELECT * FROM OccurrenceStats
         WHERE identityKind='classical' AND strongCode=${sqlString(eStrong)}
         LIMIT 1`
      )[0] ?? null)
    : null;
  const useExact = Boolean(exactStats && stepCode);
  const predicate = useExact
    ? `o.stepCode=${sqlString(stepCode)}`
    : `o.baseStrong=${sqlString(eStrong)}`;
  const samples = runSqlJsonFromDb<Record<string, unknown>>(
    OCCURRENCES_DB,
    `SELECT
       o.mainRef AS ref,
       o.source,
       o.surface,
       o.transliteration,
       o.gloss,
       o.morphology,
       o.editions,
       o.stepCode,
       o.baseStrong
     FROM Occurrences o
     WHERE ${predicate}
     GROUP BY o.mainRef, o.surface, o.morphology, o.stepCode
     ORDER BY o.bookOrder, o.chapter, o.verse, o.tokenIndex
     LIMIT 24`
  );
  const forms = runSqlJsonFromDb<{
    code: string;
    count: number;
    exampleSurface: string;
  }>(
    OCCURRENCES_DB,
    `SELECT
       om.code,
       count(*) AS count,
       (SELECT o2.surface
        FROM OccurrenceMorphology om2
        JOIN Occurrences o2 ON o2.id=om2.occurrenceId
        WHERE om2.code=om.code AND ${predicate.replaceAll("o.", "o2.")}
        ORDER BY o2.bookOrder, o2.chapter, o2.verse, o2.tokenIndex
        LIMIT 1) AS exampleSurface
     FROM OccurrenceMorphology om
     JOIN Occurrences o ON o.id=om.occurrenceId
     WHERE ${predicate}
     GROUP BY om.code
     ORDER BY count(*) DESC, om.code
     LIMIT 24`
  );
  const descriptions = readMorphologyDescriptions(
    forms.map((form) => form.code)
  );
  return {
    scope: useExact ? "step" : "classical-fallback",
    exactStats,
    classicalStats,
    samples,
    forms: forms.map((form) => ({
      ...form,
      ...(descriptions.get(form.code) ?? {})
    }))
  };
}

function readMorphologyDescriptions(
  codes: string[]
): Map<string, Record<string, unknown>> {
  const uniqueCodes = [...new Set(codes.filter(Boolean))];
  if (uniqueCodes.length === 0 || !lexiconTableExists("MorphologyCodes")) {
    return new Map();
  }
  const rows = runSqlJson<Record<string, unknown> & { code: string }>(`
    SELECT
      mc.code,
      mc.meaning AS meaningEn,
      mc.description AS descriptionEn,
      mct.meaning AS meaningFr,
      mct.description AS descriptionFr
    FROM MorphologyCodes mc
    LEFT JOIN MorphologyCodeTranslations mct
      ON mct.morphologyCodeId=mc.id AND mct.language='fr'
    WHERE mc.scope='tagged_full'
      AND mc.code IN (${uniqueCodes.map(sqlString).join(",")})
    ORDER BY mc.id
  `);
  return new Map(rows.map((row) => [row.code, row]));
}

function readLegacyLexiconEntry(entry: {
  language: "greek" | "hebrew";
  baseCode: number;
}): Record<string, unknown> | null {
  if (!existsSync(LEGACY_LEXICON_DB)) return null;

  const greek = entry.language === "greek";
  const table = greek ? "Grec" : "Hebreu";
  const originalColumn = greek ? "Grec" : "Hebreu";
  const prefix = greek ? "G" : "H";
  const rows = runSqlJsonFromDb<Record<string, unknown>>(
    LEGACY_LEXICON_DB,
    `SELECT
       Code AS code,
       Mot AS word,
       Phonetique AS phonetic,
       ${originalColumn} AS original,
       Origine AS originHtml,
       Type AS type,
       LSG AS lsg,
       Definition AS definitionHtml
     FROM ${table}
     WHERE Code=${entry.baseCode}
     LIMIT 1`
  );
  if (rows.length === 0) return null;

  return {
    strong: `${prefix}${String(entry.baseCode).padStart(4, "0")}`,
    scope: "classical-strong",
    ...rows[0]
  };
}

function readTipnrEntities(entry: {
  uStrong?: unknown;
  eStrong?: unknown;
  glossEn?: unknown;
}): Record<string, unknown>[] {
  if (!existsSync(ENTITIES_DB)) return [];

  const uStrong = typeof entry.uStrong === "string" ? entry.uStrong.trim() : "";
  if (!uStrong) return [];

  const exactRows = readTipnrEntityRows({
    where: `e.uStrong = ${sqlString(uStrong)}`,
    matchKind: "uStrong-exact",
    matchedStrong: uStrong
  });
  if (exactRows.length > 0) return exactRows;

  const eStrong = typeof entry.eStrong === "string" ? entry.eStrong.trim() : "";
  if (!eStrong) return [];
  const glossEn = typeof entry.glossEn === "string" ? entry.glossEn.trim() : "";
  const sameBaseAndGloss = glossEn
    ? `(substr(e.uStrong, 1, ${eStrong.length}) = ${sqlString(eStrong)}
       AND length(e.uStrong) > ${eStrong.length}
       AND lower(trim(e.displayName)) = lower(${sqlString(glossEn)}))`
    : "0";

  return readTipnrEntityRows({
    where: `(e.uStrong = ${sqlString(eStrong)} OR ${sameBaseAndGloss})`,
    matchKind: "classical-strong-fallback",
    matchedStrong: eStrong
  });
}

function readTipnrEntityRows(input: {
  where: string;
  matchKind: "uStrong-exact" | "classical-strong-fallback";
  matchedStrong: string;
}): Record<string, unknown>[] {
  const rows = runSqlJsonFromDb<Record<string, unknown> & { id: number }>(
    ENTITIES_DB,
    `SELECT
       e.id,
       e.uniqueName,
       e.uStrong,
       e.category,
       e.type,
       e.displayName AS displayNameEn,
       et.displayName AS displayNameFr,
       e.description AS descriptionEn,
       et.description AS descriptionFr,
       e.summaryHtml AS summaryHtmlEn,
       et.summaryHtml AS summaryHtmlFr,
       e.briefest AS briefestEn,
       et.briefest AS briefestFr,
       e.brief AS briefEn,
       et.brief AS briefFr,
       e.shortDescription AS shortDescriptionEn,
       et.shortDescription AS shortDescriptionFr,
       e.articleHtml AS articleHtmlEn,
       et.articleHtml AS articleHtmlFr,
       p.openBibleName,
       p.googleMapUrl,
       p.palopenmapsUrl,
       p.latitude,
       p.longitude,
       p.area,
       (SELECT count(*) FROM EntityRefs refs WHERE refs.entityId=e.id)
         AS referenceCount,
       (SELECT count(*) FROM EntityRelations relations
        WHERE relations.fromEntityId=e.id) AS relationCount,
       ${sqlString(input.matchKind)} AS matchKind,
       ${sqlString(input.matchedStrong)} AS matchedStrong
     FROM Entities e
     LEFT JOIN EntityTranslations et
       ON et.entityId = e.id
      AND et.language = 'fr'
     LEFT JOIN EntityPlaces p ON p.entityId=e.id
     WHERE ${input.where}
     ORDER BY e.category, e.displayName, e.id`
  );
  return rows.map((row) => ({
    ...row,
    references: readTipnrReferences(row.id),
    relations: readTipnrRelations(row.id)
  }));
}

function readTipnrReferences(entityId: number): Record<string, unknown>[] {
  return runSqlJsonFromDb(
    ENTITIES_DB,
    `SELECT book, chapter, verse, suffix, refText
     FROM EntityRefs
     WHERE entityId=${entityId}
     ORDER BY book, chapter, verse, suffix
     LIMIT 40`
  );
}

function readTipnrRelations(entityId: number): Record<string, unknown>[] {
  return runSqlJsonFromDb(
    ENTITIES_DB,
    `SELECT
       relation.relation,
       relation.certainty,
       relation.toEntityId,
       relation.toUniqueName,
       target.uStrong,
       target.displayName AS displayNameEn,
       translated.displayName AS displayNameFr,
       target.category
     FROM EntityRelations relation
     LEFT JOIN Entities target ON target.id=relation.toEntityId
     LEFT JOIN EntityTranslations translated
       ON translated.entityId=target.id AND translated.language='fr'
     WHERE relation.fromEntityId=${entityId}
     ORDER BY relation.relation, target.displayName, relation.toUniqueName
     LIMIT 80`
  );
}

function lexiconTableExists(table: string): boolean {
  return (
    runSqlJson<{ count: number }>(
      `SELECT count(*) AS count FROM sqlite_master
       WHERE type='table' AND name=${sqlString(table)}`
    )[0]?.count === 1
  );
}

function runSqlJsonFromDb<T = Record<string, unknown>>(
  dbPath: string,
  sql: string
): T[] {
  const mtimeMs = statSync(dbPath).mtimeMs;
  let cached = readonlyDatabases.get(dbPath);
  if (!cached || cached.mtimeMs !== mtimeMs) {
    cached?.database.close();
    cached = {
      database: new DatabaseSync(dbPath, { readOnly: true }),
      mtimeMs
    };
    readonlyDatabases.set(dbPath, cached);
  }
  try {
    return cached.database.prepare(sql).all() as T[];
  } catch (error) {
    throw new Error(
      `sqlite3 failed for ${path.basename(dbPath)}: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function normalizeStrongQuery(query: string): string | null {
  const match = /^([gh])0*(\d{1,5})([a-z]?)$/i.exec(query.trim());
  if (!match) return null;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}${match[3].toUpperCase()}`;
}

function classicalStrongFromStepCode(strong: string): string {
  return /^([GH]\d{4,5})[A-Za-z]$/.exec(strong)?.[1] ?? strong;
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
