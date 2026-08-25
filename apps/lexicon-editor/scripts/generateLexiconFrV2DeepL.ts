import { execFileSync } from "node:child_process";
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

type StepEntry = {
  id: number;
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
};

type ProtectedToken = {
  kind: "ref" | "strong" | "greek" | "hebrew" | "siglum";
  token: string;
  value: string;
};

type ProtectedHtml = {
  html: string;
  tokens: ProtectedToken[];
};

type DeepLTranslation = {
  detected_source_language?: string;
  text: string;
  billed_characters?: number;
  model_type_used?: string;
};

type Validation = {
  issues: string[];
  sourceReferenceCount: number;
  translatedReferenceCount: number;
  missingReferences: string[];
  sourceStrongCount: number;
  translatedStrongCount: number;
  missingStrongCodes: string[];
  inventedStrongCodes: string[];
  sourceGreekTokenCount: number;
  missingGreekTokens: string[];
  sourceHebrewTokenCount: number;
  missingHebrewTokens: string[];
  sourceHtmlTagCount: number;
  translatedHtmlTagCount: number;
  sourceSectionMarkers: string[];
  translatedSectionMarkers: string[];
  missingSectionMarkers: string[];
};

type CandidateRecord = {
  stepEntryId: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed";
  source: {
    language: StepEntry["language"];
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
    gloss: string;
    meaningHash: string;
  };
  translation: {
    glossFr: string;
    meaningHtmlFr: string;
    notesFr: string;
    engine: "deepl";
    reviewEngine: null;
  };
  validation: Validation;
  usage: {
    sourceChars: number;
    protectedSourceChars: number;
    translatedChars: number;
    estimatedBilledCharacters: number;
    deeplBilledCharacters: number | null;
  };
  generatedAt: string;
};

type RunSummary = {
  generatedAt: string;
  mode: string;
  dryRun: boolean;
  inputCount: number;
  plannedCount: number;
  skippedExisting: number;
  accepted: number;
  reviewNeeded: number;
  outputJsonl: string;
  reviewNeededJson: string;
  reportPath: string;
  estimatedSourceChars: number;
  estimatedProtectedChars: number;
  deeplBilledCharacters: number | null;
  usageBefore: Record<string, unknown> | null;
  usageAfter: Record<string, unknown> | null;
  issueCounts: Record<string, number>;
};

type PlannedEntry = {
  entry: StepEntry;
  sourceChars: number;
  protectedSourceChars: number;
  sourceReferenceCount: number;
  sourceStrongCount: number;
  sourceGreekTokenCount: number;
  sourceHebrewTokenCount: number;
  sourceHtmlTagCount: number;
};

type PlanLimits = {
  maxSourceChars: number | null;
  maxProtectedChars: number | null;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_OUT_JSONL =
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.deepl.candidates.jsonl";
const DEFAULT_REVIEW_NEEDED =
  "outputs/lexicon-fr-v2/strong_lexicon_fr_v2.review-needed.json";
const DEFAULT_REPORT = "reports/lexicon-fr-v2-deepl-production.md";
const DEFAULT_DRY_RUN_REPORT = "reports/lexicon-fr-v2-deepl-dry-run.md";
const DEFAULT_VALIDATION_REPORT = "reports/lexicon-fr-v2-validation.md";
const DEFAULT_STRONGS = ["G3056", "G0026", "G5485", "H3068", "H7225"];
const DEEPL_PRO_BASE = "https://api.deepl.com/v2";
const DEEPL_FREE_BASE = "https://api-free.deepl.com/v2";
const SAFE_TAGS = new Set([
  "a",
  "author",
  "b",
  "br",
  "corr",
  "date",
  "def",
  "em",
  "greek",
  "i",
  "lb",
  "note",
  "re",
  "ref",
  "span",
  "strong"
]);
const SIGLA_TO_PROTECT = [
  "LXX",
  "NT",
  "WH",
  "mg.",
  "Rec.",
  "DB",
  "DCG",
  "VGT",
  "MM",
  "LAE",
  "AS",
  "cl.",
  "al."
];

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun === "true";
  const revalidateOnly = args.revalidateOnly === "true";
  const quiet = args.quiet === "true";
  const logEvery = parseBoundedInteger(args.logEvery, 1, 1000000) ?? 100;
  const apiKey = process.env.DEEPL_API_KEY;
  if (!dryRun && !revalidateOnly && !apiKey) {
    throw new Error("missing DEEPL_API_KEY in .env or environment");
  }

  const dbPath = args.db ?? DEFAULT_DB;
  const apiBase = args.apiBase ?? inferDeepLBase(apiKey ?? "");
  const outJsonl = args.outJsonl ?? DEFAULT_OUT_JSONL;
  const reviewNeededJson = args.reviewNeededJson ?? DEFAULT_REVIEW_NEEDED;
  const reportPath =
    args.report ??
    (revalidateOnly
      ? DEFAULT_VALIDATION_REPORT
      : dryRun
        ? DEFAULT_DRY_RUN_REPORT
        : DEFAULT_REPORT);
  const entries = selectEntries(dbPath, args);
  const mode = revalidateOnly
    ? "revalidate"
    : args.all === "true"
      ? "all"
      : (args.pilot ?? "strongs");
  const maxEstimatedChars = parseBoundedInteger(
    args.maxEstimatedChars,
    1,
    1000000000
  );
  const maxSourceChars = parseBoundedInteger(
    args.maxSourceChars,
    1,
    1000000000
  );

  mkdirSync(dirname(resolve(outJsonl)), { recursive: true });
  mkdirSync(dirname(resolve(reviewNeededJson)), { recursive: true });
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  if (!dryRun && !revalidateOnly && args.resume !== "true") {
    rmSync(outJsonl, { force: true });
  }

  if (revalidateOnly) {
    const sourceEntries = new Map(
      readEntries(
        dbPath,
        `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
         FROM StepEntries`
      ).map((entry) => [entry.id, entry])
    );
    const revalidatedRecords = readJsonl(outJsonl).map((record) => {
      const entry = sourceEntries.get(record.stepEntryId);
      if (!entry) return record;
      const meaningHtmlFr = sanitizeTranslatedHtml(
        normalizeTranslatedHtml(record.translation.meaningHtmlFr)
      );
      const validation = validateStrictTranslation(
        entry,
        meaningHtmlFr,
        record.translation.glossFr
      );
      const status: CandidateRecord["status"] =
        validation.issues.length === 0 ? "accepted" : "review_needed";
      return {
        ...record,
        status,
        translation: {
          ...record.translation,
          meaningHtmlFr
        },
        validation
      };
    });
    writeJsonl(outJsonl, revalidatedRecords);
    writeReviewNeeded(reviewNeededJson, revalidatedRecords);
    const summary = buildSummary({
      mode,
      dryRun,
      inputCount: revalidatedRecords.length,
      plannedEntries: [],
      skippedExisting: 0,
      records: revalidatedRecords,
      outputJsonl: outJsonl,
      reviewNeededJson,
      reportPath,
      usageBefore: null,
      usageAfter: null
    });
    writeText(reportPath, renderReport(summary, revalidatedRecords, []));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const alreadyWritten =
    args.resume === "true" ? readExistingIds(outJsonl) : new Set<number>();
  const entriesToProcess = entries.filter(
    (entry) => !alreadyWritten.has(entry.id)
  );
  const plan = buildTranslationPlan(entriesToProcess, {
    maxSourceChars,
    maxProtectedChars: maxEstimatedChars
  });
  const usageBefore =
    !dryRun && apiKey ? await readUsage(apiBase, apiKey) : null;
  const records: CandidateRecord[] = [];

  if (dryRun) {
    const summary = buildSummary({
      mode,
      dryRun,
      inputCount: entries.length,
      plannedEntries: plan,
      skippedExisting: entries.length - entriesToProcess.length,
      records: [],
      outputJsonl: outJsonl,
      reviewNeededJson,
      reportPath,
      usageBefore,
      usageAfter: null
    });
    writeText(reportPath, renderReport(summary, [], plan));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!apiKey) throw new Error("missing DEEPL_API_KEY in .env or environment");

  for (const [index, plannedEntry] of plan.entries()) {
    const entry = plannedEntry.entry;
    const record = await translateEntry(apiBase, apiKey, entry);
    appendFileSync(outJsonl, `${JSON.stringify(record)}\n`);
    records.push(record);
    if (
      !quiet ||
      record.status === "review_needed" ||
      (index + 1) % logEvery === 0 ||
      index + 1 === plan.length
    ) {
      console.log(
        `${record.status} ${entry.id} ${entry.eStrong} progress=${index + 1}/${plan.length} issues=${record.validation.issues.join(",") || "none"}`
      );
    }
  }

  const allRecords = readJsonl(outJsonl);
  writeReviewNeeded(reviewNeededJson, allRecords);

  const usageAfter = await readUsage(apiBase, apiKey);
  const summary = buildSummary({
    mode,
    dryRun,
    inputCount: entries.length,
    plannedEntries: plan,
    skippedExisting: entries.length - entriesToProcess.length,
    records: allRecords,
    outputJsonl: outJsonl,
    reviewNeededJson,
    reportPath,
    usageBefore,
    usageAfter
  });
  writeText(reportPath, renderReport(summary, allRecords, plan));
  console.log(JSON.stringify(summary, null, 2));
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = rawKey.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[key] = nextValue;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
}

function inferDeepLBase(apiKey: string): string {
  return apiKey.endsWith(":fx") ? DEEPL_FREE_BASE : DEEPL_PRO_BASE;
}

function selectEntries(
  dbPath: string,
  args: Record<string, string>
): StepEntry[] {
  if (args.all === "true") {
    const whereClauses: string[] = [];
    const minId = parseBoundedInteger(args.minId, 1, 1000000);
    const maxId = parseBoundedInteger(args.maxId, 1, 1000000);
    const limit = parseBoundedInteger(args.limit, 1, 1000000);
    const offset = parseBoundedInteger(args.offset, 0, 1000000);
    if (minId !== null) whereClauses.push(`id >= ${minId}`);
    if (maxId !== null) whereClauses.push(`id <= ${maxId}`);
    return readEntries(
      dbPath,
      `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
       FROM StepEntries
       ${whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : ""}
       ORDER BY id
       ${limit !== null ? `LIMIT ${limit}` : ""}
       ${offset !== null ? `OFFSET ${offset}` : ""}`
    );
  }
  if (args.ids) {
    const ids = args.ids
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isInteger);
    return readEntries(
      dbPath,
      `SELECT * FROM StepEntries WHERE id IN (${ids.join(",")}) ORDER BY id`
    );
  }
  if (args.pilot === "difficult") {
    const limit = parseBoundedInteger(args.limit ?? "50", 1, 500) ?? 50;
    return readEntries(
      dbPath,
      `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
       FROM StepEntries
       ORDER BY
         (length(meaning) + ((length(meaning) - length(replace(meaning, ':', ''))) * 80)) DESC,
         id
       LIMIT ${limit}`
    );
  }
  const strongs = (args.strongs ?? DEFAULT_STRONGS.join(","))
    .split(",")
    .map((value) => normalizeStrong(value.trim()))
    .filter(Boolean);
  const quoted = strongs.map(sqlString).join(", ");
  return readEntries(
    dbPath,
    `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration, morph, gloss, meaning
     FROM StepEntries
     WHERE eStrong IN (${quoted})
     ORDER BY CASE eStrong ${strongs
       .map((strong, index) => `WHEN ${sqlString(strong)} THEN ${index}`)
       .join(" ")} ELSE 999 END, id`
  );
}

function parseBoundedInteger(
  value: string | undefined,
  min: number,
  max: number
): number | null {
  if (value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;
  return Math.max(min, Math.min(max, parsed));
}

function readEntries(dbPath: string, query: string): StepEntry[] {
  const raw = execFileSync("sqlite3", ["-json", dbPath, query], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 120
  });
  return (JSON.parse(raw) as StepEntry[]).map((entry) => ({
    ...entry,
    language: entry.language === "greek" ? "greek" : "hebrew"
  }));
}

function readExistingIds(path: string): Set<number> {
  if (!existsSync(path)) return new Set();
  const ids = new Set<number>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    const record = JSON.parse(line) as CandidateRecord;
    ids.add(record.stepEntryId);
  }
  return ids;
}

function buildTranslationPlan(
  entries: StepEntry[],
  limits: PlanLimits
): PlannedEntry[] {
  const plan: PlannedEntry[] = [];
  let estimatedSourceChars = 0;
  let estimatedProtectedChars = 0;
  for (const entry of entries) {
    const protectedGloss = protectHtml(entry.gloss);
    const protectedMeaning = protectHtml(entry.meaning);
    const plannedEntry = {
      entry,
      sourceChars: entry.gloss.length + entry.meaning.length,
      protectedSourceChars:
        protectedGloss.html.length + protectedMeaning.html.length,
      sourceReferenceCount: extractReferences(entry.meaning).length,
      sourceStrongCount: extractStrongCodes(entry.meaning).length,
      sourceGreekTokenCount: extractGreekTokens(entry.meaning).length,
      sourceHebrewTokenCount: extractHebrewTokens(entry.meaning).length,
      sourceHtmlTagCount: countHtmlTags(entry.meaning)
    };
    if (
      limits.maxSourceChars !== null &&
      estimatedSourceChars + plannedEntry.sourceChars > limits.maxSourceChars
    ) {
      break;
    }
    if (
      limits.maxProtectedChars !== null &&
      estimatedProtectedChars + plannedEntry.protectedSourceChars >
        limits.maxProtectedChars
    ) {
      break;
    }
    estimatedSourceChars += plannedEntry.sourceChars;
    estimatedProtectedChars += plannedEntry.protectedSourceChars;
    plan.push(plannedEntry);
  }
  return plan;
}

async function translateEntry(
  apiBase: string,
  apiKey: string,
  entry: StepEntry
): Promise<CandidateRecord> {
  const protectedMeaning = protectHtml(entry.meaning);
  const protectedGloss = protectHtml(entry.gloss);
  const translations = await translateWithDeepL(apiBase, apiKey, [
    protectedGloss.html,
    protectedMeaning.html
  ]);
  const glossFr = restoreTokens(
    translations[0]?.text ?? "",
    protectedGloss.tokens
  )
    .replace(/\s+/g, " ")
    .trim();
  const meaningHtmlFr = normalizeTranslatedHtml(
    sanitizeTranslatedHtml(
      restoreTokens(translations[1]?.text ?? "", protectedMeaning.tokens)
    )
  );
  const validation = validateStrictTranslation(entry, meaningHtmlFr, glossFr);
  return {
    stepEntryId: entry.id,
    targetLanguage: "fr",
    status: validation.issues.length === 0 ? "accepted" : "review_needed",
    source: {
      language: entry.language,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      gloss: entry.gloss,
      meaningHash: sha256(entry.meaning)
    },
    translation: {
      glossFr,
      meaningHtmlFr,
      notesFr: "",
      engine: "deepl",
      reviewEngine: null
    },
    validation,
    usage: {
      sourceChars: entry.gloss.length + entry.meaning.length,
      protectedSourceChars:
        protectedGloss.html.length + protectedMeaning.html.length,
      translatedChars: glossFr.length + meaningHtmlFr.length,
      estimatedBilledCharacters:
        protectedGloss.html.length + protectedMeaning.html.length,
      deeplBilledCharacters: sumBilledCharacters(translations)
    },
    generatedAt: new Date().toISOString()
  };
}

async function translateWithDeepL(
  apiBase: string,
  apiKey: string,
  texts: string[]
): Promise<DeepLTranslation[]> {
  const response = await fetch(`${apiBase}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: texts,
      source_lang: "EN",
      target_lang: "FR",
      tag_handling: "html",
      split_sentences: "nonewlines",
      preserve_formatting: true,
      model_type: "quality_optimized"
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`deepl-http-${response.status}:${body.slice(0, 500)}`);
  }

  const payload = (await response.json()) as {
    translations: DeepLTranslation[];
  };
  return payload.translations;
}

function sumBilledCharacters(translations: DeepLTranslation[]): number | null {
  const billedValues = translations
    .map((translation) => translation.billed_characters)
    .filter((value): value is number => typeof value === "number");
  if (billedValues.length === 0) return null;
  return billedValues.reduce((total, value) => total + value, 0);
}

function protectHtml(html: string): ProtectedHtml {
  let protectedHtml = html;
  const tokens: ProtectedToken[] = [];
  const protect = (
    kind: ProtectedToken["kind"],
    pattern: RegExp,
    valueFilter: (value: string) => boolean = () => true
  ): void => {
    protectedHtml = protectedHtml.replace(pattern, (value: string) => {
      if (!valueFilter(value)) return value;
      const token = `__${kind.toUpperCase()}_${String(tokens.length).padStart(5, "0")}__`;
      tokens.push({ kind, token, value });
      return `<span translate="no" class="notranslate ${kind}">${token}</span>`;
    });
  };

  protect("ref", referencePattern());
  protect("strong", /\b[GH]\d{3,5}[A-Za-z]?\b/g);
  protect(
    "greek",
    /[\u0370-\u03FF\u1F00-\u1FFF][\u0370-\u03FF\u1F00-\u1FFF\s.,;:()[\]'"’`-]*/g,
    hasLetter
  );
  protect(
    "hebrew",
    /[\u0590-\u05FF][\u0590-\u05FF\s.,;:()[\]'"’`-]*/g,
    hasLetter
  );
  for (const siglum of SIGLA_TO_PROTECT) {
    const escaped = siglum.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    protect("siglum", new RegExp(`\\b${escaped}\\b`, "g"));
  }

  return { html: protectedHtml, tokens };
}

function restoreTokens(html: string, tokens: ProtectedToken[]): string {
  let restored = html;
  for (const { token, value } of tokens) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restored = restored
      .replace(
        new RegExp(`<span\\b[^>]*>\\s*${escaped}\\s*<\\/span>`, "g"),
        value
      )
      .replace(new RegExp(escaped, "g"), value);
  }
  return restored;
}

function validateStrictTranslation(
  entry: StepEntry,
  meaningHtmlFr: string,
  glossFr: string
): Validation {
  const issues: string[] = [];
  const sourceReferences = extractReferences(entry.meaning);
  const translatedReferences = extractReferences(meaningHtmlFr);
  const sourceStrongCodes = extractStrongCodes(entry.meaning);
  const translatedStrongCodes = extractStrongCodes(meaningHtmlFr);
  const sourceGreekTokens = extractGreekTokens(entry.meaning);
  const translatedGreekTokens = extractGreekTokens(meaningHtmlFr);
  const sourceHebrewTokens = extractHebrewTokens(entry.meaning);
  const translatedHebrewTokens = extractHebrewTokens(meaningHtmlFr);
  const sourceHtmlTagCount = countHtmlTags(entry.meaning);
  const translatedHtmlTagCount = countHtmlTags(meaningHtmlFr);
  const sourceSectionMarkers = extractSectionMarkers(entry.meaning);
  const translatedSectionMarkers = extractSectionMarkers(meaningHtmlFr);
  const missingReferences = sourceReferences.filter(
    (reference) => !translatedReferences.includes(reference)
  );
  const missingStrongCodes = sourceStrongCodes.filter(
    (code) => !translatedStrongCodes.includes(code)
  );
  const inventedStrongCodes = translatedStrongCodes.filter(
    (code) =>
      !sourceStrongCodes.includes(code) &&
      !sourceStrongCodes.includes(baseStrong(code))
  );
  const missingGreekTokens = sourceGreekTokens.filter(
    (token) => !translatedGreekTokens.includes(token)
  );
  const missingHebrewTokens = sourceHebrewTokens.filter(
    (token) => !translatedHebrewTokens.includes(token)
  );
  const missingSectionMarkers = sourceSectionMarkers.filter(
    (marker) => !translatedSectionMarkers.includes(marker)
  );

  if (entry.gloss.trim() && !glossFr.trim()) issues.push("missing-gloss-fr");
  if (!meaningHtmlFr.trim()) issues.push("missing-meaning-html-fr");
  if (missingReferences.length > 0) issues.push("missing-references");
  if (missingStrongCodes.length > 0) issues.push("missing-strong-codes");
  if (inventedStrongCodes.length > 0) issues.push("invented-strong-codes");
  if (missingGreekTokens.length > 0) issues.push("missing-greek-tokens");
  if (missingHebrewTokens.length > 0) issues.push("missing-hebrew-tokens");
  if (missingSectionMarkers.length > 0) issues.push("missing-section-markers");
  if (!htmlTagsAreSafe(meaningHtmlFr)) issues.push("unsafe-html");
  if (htmlLooksBalanced(entry.meaning) && !htmlLooksBalanced(meaningHtmlFr)) {
    issues.push("unbalanced-html");
  }
  if (/__(?:REF|STRONG|GREEK|HEBREW|SIGLUM)_\d+__/.test(meaningHtmlFr)) {
    issues.push("unrestored-placeholder");
  }
  if (hasReferenceSuffixArtifact(meaningHtmlFr)) {
    issues.push("reference-suffix-artifact");
  }
  if (
    entry.meaning.length > 500 &&
    meaningHtmlFr.length < entry.meaning.length * 0.55
  ) {
    issues.push("suspicious-shortening");
  }
  if (
    sourceHtmlTagCount > 0 &&
    translatedHtmlTagCount < Math.floor(sourceHtmlTagCount * 0.75)
  ) {
    issues.push("html-tag-count-drop");
  }

  return {
    issues,
    sourceReferenceCount: sourceReferences.length,
    translatedReferenceCount: translatedReferences.length,
    missingReferences,
    sourceStrongCount: sourceStrongCodes.length,
    translatedStrongCount: translatedStrongCodes.length,
    missingStrongCodes,
    inventedStrongCodes,
    sourceGreekTokenCount: sourceGreekTokens.length,
    missingGreekTokens,
    sourceHebrewTokenCount: sourceHebrewTokens.length,
    missingHebrewTokens,
    sourceHtmlTagCount,
    translatedHtmlTagCount,
    sourceSectionMarkers,
    translatedSectionMarkers,
    missingSectionMarkers
  };
}

function normalizeTranslatedHtml(value: string): string {
  return value
    .replace(/\s+([,.;:])/g, "$1")
    .replace(/([([{])\s+/g, "$1")
    .replace(/\s+([)\]}])/g, "$1")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function sanitizeTranslatedHtml(value: string): string {
  return value
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s(?:href|src)\s*=\s*"javascript:[^"]*"/gi, "")
    .replace(/\s(?:href|src)\s*=\s*'javascript:[^']*'/gi, "")
    .replace(/\s(?:href|src)\s*=\s*javascript:[^\s>]+/gi, "");
}

function extractReferences(value: string): string[] {
  const references = new Set<string>();
  for (const reference of stripHtml(value).match(referencePattern()) ?? []) {
    const normalized = normalizeReference(reference);
    references.add(normalized);
    references.add(normalized.replace(/,\d+$/, ""));
  }
  return [...references];
}

function extractStrongCodes(value: string): string[] {
  return [
    ...new Set(stripHtml(value).match(/\b[GH]\d{3,5}[A-Za-z]?\b/g) ?? [])
  ];
}

function extractGreekTokens(value: string): string[] {
  return [
    ...new Set(
      stripHtml(value).match(/[\u0370-\u03FF\u1F00-\u1FFF]{2,}/g) ?? []
    )
  ];
}

function extractHebrewTokens(value: string): string[] {
  return [...new Set(stripHtml(value).match(/[\u0590-\u05FF]{2,}/g) ?? [])];
}

function extractSectionMarkers(value: string): string[] {
  const markers = new Set<string>();
  const lines = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/);
  for (const line of lines) {
    const match =
      /^\s*(?:__)?(?:\(?([a-z])\)|([IVX]{1,5})|(\d{1,2}[a-z]?))\s*[.)]/i.exec(
        line
      );
    const marker = match?.[1] ?? match?.[2] ?? match?.[3];
    if (marker) markers.add(marker);
  }
  return [...markers];
}

function htmlTagsAreSafe(value: string): boolean {
  for (const match of value.matchAll(htmlTagPattern())) {
    if (!SAFE_TAGS.has(match[1].toLowerCase())) return false;
    const raw = match[0].toLowerCase();
    if (/\son[a-z]+\s*=/.test(raw) || /javascript:/.test(raw)) return false;
  }
  return true;
}

function htmlLooksBalanced(value: string): boolean {
  const stack: string[] = [];
  for (const match of value.matchAll(htmlTagPattern())) {
    const raw = match[0];
    const tag = match[1].toLowerCase();
    if (tag === "br" || raw.endsWith("/>")) continue;
    if (raw.startsWith("</")) {
      if (stack.pop() !== tag) return false;
    } else {
      stack.push(tag);
    }
  }
  return stack.length === 0;
}

function countHtmlTags(value: string): number {
  return [...value.matchAll(htmlTagPattern())].length;
}

function htmlTagPattern(): RegExp {
  return /<\/?\s*([a-z][a-z0-9-]*)(?:\s[^>]*|=[^>]*)?>/gi;
}

function hasReferenceSuffixArtifact(value: string): boolean {
  const text = stripHtml(value);
  const artifactPattern = new RegExp(
    `${referencePattern().source}\\s+(?:ement|ment|tion|ant|able|ible)\\b`,
    "i"
  );
  return artifactPattern.test(text);
}

function referencePattern(): RegExp {
  const book =
    "(?:Ac|Act|Acts|Am|Amo|Amos|Bar|Bel|Ch|Co|Col|Cor|Da|Dan|De|Deu|Ec|Ecc|Eph|Es|Est|Exo|Ez|Eze|Gal|Gen|Hab|Hag|He|Heb|Ho|Hos|Is|Isa|Jas|Jb|Jdg|Jdth|Jer|Jhn|Jn|Jo|Job|Joel|John|Jol|Jon|Jos|Joshua|Ju|Ki|La|Le|Lev|Lk|Lu|Luk|Ma|Mac|Macc|Mal|Mat|Mic|Mk|Mrk|Mt|Nam|Ne|Neh|Nu|Num|Pe|Pet|Phi|Phil|Phlm|Php|Pr|Pro|Ps|Psa|Rev|Rom|Rut|Ruth|Sa|Sir|Sng|Sol|Su|Sus|Th|Thess|Ti|Tim|Tit|Tob|Wis|Za|Zec|Zep)";
  return new RegExp(
    `\\b(?:[1-4]\\s*)?${book}\\.?\\s*\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?(?:,\\s*(?![1-4]?\\s*[A-Za-z]+\\.?\\s*\\d)\\d{1,3})?\\b`,
    "gi"
  );
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeReference(value: string): string {
  return value.replace(/\s+/g, "").replace(/\.$/, "");
}

function baseStrong(value: string): string {
  const match = /^([GH])(\d{3,5})/i.exec(value);
  if (!match) return value;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}`;
}

function normalizeStrong(value: string): string {
  const match = /^([GH])0*(\d{1,5})([A-Za-z]?)$/i.exec(value);
  if (!match) return value;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}${match[3]}`;
}

function hasLetter(value: string): boolean {
  return /\p{Letter}/u.test(value);
}

async function readUsage(
  apiBase: string,
  apiKey: string
): Promise<Record<string, unknown> | null> {
  const response = await fetch(`${apiBase}/usage`, {
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`
    }
  });
  if (!response.ok) return null;
  return (await response.json()) as Record<string, unknown>;
}

function buildSummary(input: {
  mode: string;
  dryRun: boolean;
  inputCount: number;
  plannedEntries: PlannedEntry[];
  skippedExisting: number;
  records: CandidateRecord[];
  outputJsonl: string;
  reviewNeededJson: string;
  reportPath: string;
  usageBefore: Record<string, unknown> | null;
  usageAfter: Record<string, unknown> | null;
}): RunSummary {
  const issueCounts: Record<string, number> = {};
  for (const record of input.records) {
    for (const issue of record.validation.issues) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    mode: input.mode,
    dryRun: input.dryRun,
    inputCount: input.inputCount,
    plannedCount: input.plannedEntries.length,
    skippedExisting: input.skippedExisting,
    accepted: input.records.filter((record) => record.status === "accepted")
      .length,
    reviewNeeded: input.records.filter(
      (record) => record.status === "review_needed"
    ).length,
    outputJsonl: input.outputJsonl,
    reviewNeededJson: input.reviewNeededJson,
    reportPath: input.reportPath,
    estimatedSourceChars: sumPlanned(input.plannedEntries, "sourceChars"),
    estimatedProtectedChars: sumPlanned(
      input.plannedEntries,
      "protectedSourceChars"
    ),
    deeplBilledCharacters: sumRecordBilledCharacters(input.records),
    usageBefore: input.usageBefore,
    usageAfter: input.usageAfter,
    issueCounts
  };
}

function renderReport(
  summary: RunSummary,
  records: CandidateRecord[],
  plannedEntries: PlannedEntry[]
): string {
  const issueRows =
    Object.entries(summary.issueCounts)
      .sort(([, left], [, right]) => right - left)
      .map(([issue, count]) => `| ${issue} | ${count} |`)
      .join("\n") || "| none | 0 |";
  const plannedRows =
    plannedEntries
      .slice(0, 20)
      .map((plannedEntry) => {
        const { entry } = plannedEntry;
        return `| ${entry.id} | ${entry.eStrong} | ${plannedEntry.sourceChars} | ${plannedEntry.protectedSourceChars} | ${plannedEntry.sourceReferenceCount} | ${plannedEntry.sourceHtmlTagCount} |`;
      })
      .join("\n") || "| none | none | 0 | 0 | 0 | 0 |";
  const sampleRows = records
    .slice(0, 20)
    .map((record) => {
      const preview = stripHtml(record.translation.meaningHtmlFr).slice(0, 220);
      return `| ${record.stepEntryId} | ${record.source.eStrong} | ${record.status} | ${record.validation.issues.join(", ") || "none"} | ${preview.replace(/\|/g, "\\|")} |`;
    })
    .join("\n");
  return `# Lexicon FR V2 DeepL Production

Generated: ${summary.generatedAt}

Mode: ${summary.mode}

Dry run: ${summary.dryRun ? "yes" : "no"}

## Summary

- Selected entries: ${summary.inputCount}
- Skipped existing entries: ${summary.skippedExisting}
- Planned entries this run: ${summary.plannedCount}
- Estimated source chars: ${summary.estimatedSourceChars}
- Estimated protected chars sent to DeepL: ${summary.estimatedProtectedChars}
- DeepL billed chars from records: ${summary.deeplBilledCharacters ?? "not reported"}
- JSONL records: ${records.length}
- Accepted: ${summary.accepted}
- Review needed: ${summary.reviewNeeded}
- Output JSONL: \`${summary.outputJsonl}\`
- Review needed JSON: \`${summary.reviewNeededJson}\`

## Usage

- Before: ${JSON.stringify(summary.usageBefore)}
- After: ${JSON.stringify(summary.usageAfter)}

## Issue Counts

| Issue | Count |
| --- | ---: |
${issueRows}

## Planned Entries

| ID | Strong | Source Chars | Protected Chars | Source Refs | HTML Tags |
| ---: | --- | ---: | ---: | ---: | ---: |
${plannedRows}

## Samples

| ID | Strong | Status | Issues | Preview |
| ---: | --- | --- | --- | --- |
${sampleRows}
`;
}

function sumPlanned(
  plannedEntries: PlannedEntry[],
  key: "sourceChars" | "protectedSourceChars"
): number {
  return plannedEntries.reduce(
    (total, plannedEntry) => total + plannedEntry[key],
    0
  );
}

function sumRecordBilledCharacters(records: CandidateRecord[]): number | null {
  const billedValues = records
    .map((record) => record.usage.deeplBilledCharacters)
    .filter((value): value is number => typeof value === "number");
  if (billedValues.length === 0) return null;
  return billedValues.reduce((total, value) => total + value, 0);
}

function readJsonl(path: string): CandidateRecord[] {
  if (!existsSync(path)) return [];
  const records: CandidateRecord[] = [];
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    records.push(JSON.parse(line) as CandidateRecord);
  }
  return records;
}

function writeJsonl(path: string, records: CandidateRecord[]): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(
    path,
    records.map((record) => JSON.stringify(record)).join("\n") + "\n"
  );
}

function writeReviewNeeded(path: string, records: CandidateRecord[]): void {
  const reviewNeeded = records.filter(
    (record) => record.status === "review_needed"
  );
  writeJson(path, {
    generatedAt: new Date().toISOString(),
    count: reviewNeeded.length,
    entries: reviewNeeded.map((record) => ({
      stepEntryId: record.stepEntryId,
      eStrong: record.source.eStrong,
      glossFr: record.translation.glossFr,
      issues: record.validation.issues,
      missingReferences: record.validation.missingReferences,
      missingStrongCodes: record.validation.missingStrongCodes,
      inventedStrongCodes: record.validation.inventedStrongCodes,
      missingSectionMarkers: record.validation.missingSectionMarkers
    }))
  });
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, value);
}

function sha256(value: string): string {
  return execFileSync("shasum", ["-a", "256"], {
    input: value,
    encoding: "utf8"
  }).split(/\s+/)[0];
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
