import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type StepEntry = {
  id: number;
  language: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  gloss: string;
  meaning: string;
};

type DeepLTranslation = {
  detected_source_language?: string;
  text: string;
  billed_characters?: number;
  model_type_used?: string;
};

type ProtectedHtml = {
  html: string;
  references: Map<string, string>;
};

type PilotResult = {
  id: number;
  eStrong: string;
  glossEn: string;
  sourceChars: number;
  translatedChars: number;
  sourceReferences: string[];
  translatedReferences: string[];
  missingReferences: string[];
  sourceSectionMarkers: string[];
  translatedSectionMarkers: string[];
  missingSectionMarkers: string[];
  sourceHtmlTagCount: number;
  translatedHtmlTagCount: number;
  htmlLooksPreserved: boolean;
  detectedSourceLanguage?: string;
  modelTypeUsed?: string;
  translatedHtml: string;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_OUT_JSON = "outputs/lexicon-fr/deepl-strict-pilot.json";
const DEFAULT_REPORT = "reports/deepl-strict-fr-pilot.md";
const DEFAULT_STRONGS = ["G3056", "H7225", "G0026", "G5485", "H3068"];
const DEEPL_PRO_BASE = "https://api.deepl.com/v2";
const DEEPL_FREE_BASE = "https://api-free.deepl.com/v2";

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const apiKey = process.env.DEEPL_API_KEY;
  if (!apiKey) throw new Error("missing DEEPL_API_KEY in .env or environment");

  const apiBase = args.apiBase ?? inferDeepLBase(apiKey);
  const dbPath = args.db ?? DEFAULT_DB;
  const outJson = args.outJson ?? DEFAULT_OUT_JSON;
  const reportPath = args.report ?? DEFAULT_REPORT;
  const strongs = (args.strongs ?? DEFAULT_STRONGS.join(","))
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const protectReferences = args.protectReferences !== "false";

  const entries = readEntries(dbPath, strongs);
  const usageBefore = await readUsage(apiBase, apiKey);
  const results: PilotResult[] = [];

  for (const entry of entries) {
    const protectedHtml = protectReferences
      ? protectReferenceTokens(entry.meaning)
      : { html: entry.meaning, references: new Map<string, string>() };
    const sourceHtml = protectedHtml.html;
    const translation = await translateWithDeepL(apiBase, apiKey, sourceHtml);
    translation.text = restoreReferenceTokens(
      translation.text,
      protectedHtml.references
    );
    results.push(analyzeResult(entry, translation));
  }

  const usageAfter = await readUsage(apiBase, apiKey);
  const payload = {
    generatedAt: new Date().toISOString(),
    apiBase: redactDeepLBase(apiBase),
    strongs,
    usageBefore,
    usageAfter,
    protectReferences,
    results
  };

  writeJson(outJson, payload);
  writeText(reportPath, renderReport(payload));
  console.log(
    JSON.stringify(
      {
        entries: results.length,
        outJson,
        reportPath,
        usageBefore,
        usageAfter,
        summary: results.map((result) => ({
          strong: result.eStrong,
          sourceReferences: result.sourceReferences.length,
          translatedReferences: result.translatedReferences.length,
          missingReferences: result.missingReferences.length,
          sourceHtmlTagCount: result.sourceHtmlTagCount,
          translatedHtmlTagCount: result.translatedHtmlTagCount,
          htmlLooksPreserved: result.htmlLooksPreserved
        }))
      },
      null,
      2
    )
  );
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

function redactDeepLBase(apiBase: string): string {
  if (apiBase === DEEPL_FREE_BASE) return "api-free";
  if (apiBase === DEEPL_PRO_BASE) return "api-pro";
  return "custom";
}

function readEntries(dbPath: string, strongs: string[]): StepEntry[] {
  const quoted = strongs.map(sqlString).join(", ");
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `SELECT id, language, eStrong, dStrong, uStrong, original, transliteration, gloss, meaning
       FROM StepEntries
       WHERE eStrong IN (${quoted})
       ORDER BY CASE eStrong ${strongs
         .map((strong, index) => `WHEN ${sqlString(strong)} THEN ${index}`)
         .join(" ")} ELSE 999 END, id`
    ],
    { encoding: "utf8", maxBuffer: 1024 * 1024 * 80 }
  );
  return JSON.parse(raw) as StepEntry[];
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

async function translateWithDeepL(
  apiBase: string,
  apiKey: string,
  html: string
): Promise<DeepLTranslation> {
  const response = await fetch(`${apiBase}/translate`, {
    method: "POST",
    headers: {
      Authorization: `DeepL-Auth-Key ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      text: [html],
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
  const translation = payload.translations[0];
  if (!translation) throw new Error("deepl-empty-translation");
  return translation;
}

function analyzeResult(
  entry: StepEntry,
  translation: DeepLTranslation
): PilotResult {
  const sourceReferences = extractReferences(entry.meaning);
  const translatedReferences = extractReferences(translation.text);
  const sourceSectionMarkers = extractSectionMarkers(entry.meaning);
  const translatedSectionMarkers = extractSectionMarkers(translation.text);
  const sourceHtmlTagCount = countHtmlTags(entry.meaning);
  const translatedHtmlTagCount = countHtmlTags(translation.text);

  return {
    id: entry.id,
    eStrong: entry.eStrong,
    glossEn: entry.gloss,
    sourceChars: entry.meaning.length,
    translatedChars: translation.text.length,
    sourceReferences,
    translatedReferences,
    missingReferences: sourceReferences.filter(
      (reference) => !translatedReferences.includes(reference)
    ),
    sourceSectionMarkers,
    translatedSectionMarkers,
    missingSectionMarkers: sourceSectionMarkers.filter(
      (marker) => !translatedSectionMarkers.includes(marker)
    ),
    sourceHtmlTagCount,
    translatedHtmlTagCount,
    htmlLooksPreserved:
      sourceHtmlTagCount > 0 &&
      translatedHtmlTagCount >= Math.floor(sourceHtmlTagCount * 0.8),
    detectedSourceLanguage: translation.detected_source_language,
    modelTypeUsed: translation.model_type_used,
    translatedHtml: translation.text
  };
}

function extractReferences(value: string): string[] {
  const text = stripHtml(value);
  const book =
    "(?:Mat|Mrk|Mar|Luk|Luc|Jhn|Joh|Jean|Act|Rom|Co|Cor|Gal|Eph|Php|Phil|Col|Th|Thess|Ti|Tim|Tit|Phlm|Heb|Jas|Jac|Pe|Pet|Jn|Ju|Jude|Rev|Ap|Gen|Exo|Exod|Lev|Num|Deut|Josh|Jos|Judg|Jug|Ruth|Sam|Kgs|Rois|Chr|Ezra|Neh|Esth|Job|Ps|Psa|Prov|Eccl|Song|Cant|Isa|Es|Jer|Lam|Ezek|Ez|Dan|Hos|Joel|Amos|Obad|Abd|Jonah|Jon|Mic|Nah|Hab|Zeph|Soph|Hag|Agg|Zech|Zach|Mal)";
  const pattern = new RegExp(
    `\\b(?:[1-3]\\s*)?${book}\\.?\\s*\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?\\b`,
    "gi"
  );
  return [
    ...new Set(
      [...text.matchAll(pattern)].map((match) => normalizeReference(match[0]))
    )
  ];
}

function protectReferenceTokens(html: string): ProtectedHtml {
  const book =
    "(?:Mat|Mrk|Mar|Luk|Luc|Jhn|Joh|Jean|Act|Rom|Co|Cor|Gal|Eph|Php|Phil|Col|Th|Thess|Ti|Tim|Tit|Phlm|Heb|Jas|Jac|Pe|Pet|Jn|Ju|Jude|Rev|Ap|Gen|Exo|Exod|Lev|Num|Deut|Josh|Jos|Judg|Jug|Ruth|Sam|Kgs|Rois|Chr|Ezra|Neh|Esth|Job|Ps|Psa|Prov|Eccl|Song|Cant|Isa|Es|Jer|Lam|Ezek|Ez|Dan|Hos|Joel|Amos|Obad|Abd|Jonah|Jon|Mic|Nah|Hab|Zeph|Soph|Hag|Agg|Zech|Zach|Mal)";
  const referencePattern = new RegExp(
    `\\b(?:[1-3]\\s*)?${book}\\.?\\s*\\d{1,3}:\\d{1,3}(?:[-–]\\d{1,3})?(?:,\\s*\\d{1,3})?\\b`,
    "gi"
  );
  const references = new Map<string, string>();
  let index = 0;
  const protectedHtml = html.replace(referencePattern, (reference) => {
    const token = `__REF_${String(index).padStart(4, "0")}__`;
    references.set(token, reference);
    index += 1;
    return `<span translate="no" class="notranslate ref">${token}</span>`;
  });
  return { html: protectedHtml, references };
}

function restoreReferenceTokens(
  html: string,
  references: Map<string, string>
): string {
  let restored = html;
  for (const [token, reference] of references) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restored = restored
      .replace(
        new RegExp(`<span\\b[^>]*>\\s*${escaped}\\s*<\\/span>`, "g"),
        reference
      )
      .replace(new RegExp(escaped, "g"), reference);
  }
  return restored;
}

function normalizeReference(value: string): string {
  return value.replace(/\s+/g, "").replace(/\.$/, "");
}

function extractSectionMarkers(value: string): string[] {
  const markers = new Set<string>();
  const lines = value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .split(/\r?\n/);
  for (const line of lines) {
    const match =
      /^\s*(?:__)?(?:\(?([a-z])\)|([IVX]{1,5})|(\d{1,2}[a-z]?))[.)]/i.exec(
        line
      );
    const marker = match?.[1] ?? match?.[2] ?? match?.[3];
    if (marker) markers.add(marker);
  }
  return [...markers];
}

function countHtmlTags(value: string): number {
  return [...value.matchAll(/<\/?[a-z][^>]*>/gi)].length;
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function renderReport(payload: {
  generatedAt: string;
  apiBase: string;
  strongs: string[];
  usageBefore: Record<string, unknown> | null;
  usageAfter: Record<string, unknown> | null;
  protectReferences: boolean;
  results: PilotResult[];
}): string {
  const rows = payload.results
    .map((result) =>
      [
        result.eStrong,
        result.sourceReferences.length,
        result.translatedReferences.length,
        result.missingReferences.length,
        result.sourceSectionMarkers.length,
        result.translatedSectionMarkers.length,
        result.missingSectionMarkers.length,
        result.sourceHtmlTagCount,
        result.translatedHtmlTagCount,
        result.htmlLooksPreserved ? "yes" : "no"
      ].join(" | ")
    )
    .join("\n");

  const examples = payload.results
    .map((result) => {
      const preview = stripHtml(result.translatedHtml).slice(0, 1200);
      return `### ${result.eStrong}\n\nMissing references: ${
        result.missingReferences.length > 0
          ? result.missingReferences.slice(0, 30).join(", ")
          : "none"
      }\n\nTranslated preview:\n\n> ${preview.replace(/\n/g, " ")}\n`;
    })
    .join("\n");

  return `# DeepL Strict FR Pilot

Generated: ${payload.generatedAt}

API base: ${payload.apiBase}

Reference protection: ${payload.protectReferences ? "enabled" : "disabled"}

## Usage

- Before: ${JSON.stringify(payload.usageBefore)}
- After: ${JSON.stringify(payload.usageAfter)}

## Summary

Strong | Source refs | Translated refs | Missing refs | Source sections | Translated sections | Missing sections | Source tags | Translated tags | HTML preserved
--- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---
${rows}

## Examples

${examples}
`;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, value);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
