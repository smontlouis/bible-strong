import { createHash } from "node:crypto";
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

type ResourceRow = {
  id: number;
  stepEntryId: number;
  source: string;
  kind: string;
  contentHtml: string;
  entryLanguage: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  transliteration: string;
  gloss: string;
};

type ProtectedToken = {
  kind: "ref" | "strong" | "greek" | "hebrew" | "siglum";
  token: string;
  value: string;
};

type DeepLTranslation = {
  detected_source_language?: string;
  text: string;
  billed_characters?: number;
  model_type_used?: string;
};

type GatewayTranslation = {
  text: string;
  inputTokens: number;
  outputTokens: number;
  model: string;
  billedCharacters: number | null;
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
};

type CandidateRecord = {
  resourceId: number;
  stepEntryId: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed";
  source: {
    source: string;
    kind: string;
    entryLanguage: ResourceRow["entryLanguage"];
    eStrong: string;
    dStrong: string;
    transliteration: string;
    gloss: string;
    contentHash: string;
  };
  translation: {
    contentHtmlFr: string;
    contentTextFr: string;
    engine: "deepl" | "gemini";
  };
  validation: Validation;
  usage: {
    sourceChars: number;
    protectedSourceChars: number;
    translatedChars: number;
    deeplBilledCharacters: number | null;
    inputTokens?: number;
    outputTokens?: number;
  };
  generatedAt: string;
};

type PlannedResource = {
  resource: ResourceRow;
  sourceChars: number;
  protectedSourceChars: number;
  sourceReferenceCount: number;
  sourceStrongCount: number;
  sourceGreekTokenCount: number;
  sourceHebrewTokenCount: number;
  sourceHtmlTagCount: number;
};

const DEFAULT_DB = "data/dictionaries/strong_lexicon.sqlite";
const DEFAULT_OUT_JSONL =
  "outputs/lexicon-resource-fr/lexicon_resource_fr.deepl.candidates.jsonl";
const DEFAULT_REVIEW_NEEDED =
  "outputs/lexicon-resource-fr/lexicon_resource_fr.review-needed.json";
const DEFAULT_REPORT = "reports/lexicon-resource-fr-deepl-production.md";
const DEFAULT_DRY_RUN_REPORT = "reports/lexicon-resource-fr-deepl-dry-run.md";
const DEFAULT_GEMINI_MODEL = "google/gemini-3.1-pro-preview";
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
  "level1",
  "level2",
  "level3",
  "level4",
  "note",
  "re",
  "ref",
  "span",
  "strong",
  "sup",
  "u"
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
  "al.",
  "acc.",
  "gen.",
  "dat.",
  "nom.",
  "pl.",
  "sg.",
  "pass.",
  "act.",
  "mid."
];

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun === "true";
  const engine = args.engine === "gemini" ? "gemini" : "deepl";
  const apiKey =
    engine === "gemini"
      ? (process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY)
      : process.env.DEEPL_API_KEY;
  if (!dryRun && !apiKey) {
    throw new Error(
      engine === "gemini"
        ? "missing AI_GATEWAY_KEY or AI_GATEWAY_API_KEY in .env or environment"
        : "missing DEEPL_API_KEY in .env or environment"
    );
  }

  const dbPath = args.db ?? DEFAULT_DB;
  const source = args.source ?? "TFLSJ";
  const kind = args.kind ?? "classical_full";
  const outJsonl = args.outJsonl ?? DEFAULT_OUT_JSONL;
  const reviewNeededJson = args.reviewNeededJson ?? DEFAULT_REVIEW_NEEDED;
  const reportPath =
    args.report ?? (dryRun ? DEFAULT_DRY_RUN_REPORT : DEFAULT_REPORT);
  const apiBase = args.apiBase ?? inferDeepLBase(apiKey ?? "");
  const model = args.model ?? DEFAULT_GEMINI_MODEL;
  const timeoutMs =
    parseBoundedInteger(
      args.timeoutMs ?? process.env.AI_GATEWAY_TIMEOUT_MS,
      1000,
      600000
    ) ?? 180000;
  const quiet = args.quiet === "true";
  const logEvery = parseBoundedInteger(args.logEvery, 1, 1000000) ?? 50;

  mkdirSync(dirname(resolve(outJsonl)), { recursive: true });
  mkdirSync(dirname(resolve(reviewNeededJson)), { recursive: true });
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  if (!dryRun && args.resume !== "true") rmSync(outJsonl, { force: true });

  const resources = selectResources(dbPath, args, source, kind);
  const alreadyWritten =
    args.resume === "true"
      ? readExistingResourceIds(outJsonl)
      : new Set<number>();
  const resourcesToProcess = resources.filter(
    (resource) => !alreadyWritten.has(resource.id)
  );
  const plan = buildPlan(resourcesToProcess, {
    maxSourceChars: parseBoundedInteger(args.maxSourceChars, 1, 1000000000),
    maxProtectedChars: parseBoundedInteger(
      args.maxProtectedChars,
      1,
      1000000000
    )
  });

  if (dryRun) {
    const summary = buildSummary({
      dryRun,
      inputCount: resources.length,
      skippedExisting: resources.length - resourcesToProcess.length,
      plannedResources: plan,
      records: [],
      outJsonl,
      reviewNeededJson,
      reportPath
    });
    writeText(reportPath, renderReport(summary, [], plan));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!apiKey) throw new Error("missing API key");
  const records: CandidateRecord[] = [];
  for (const [index, planned] of plan.entries()) {
    const record = await translateResource({
      apiBase,
      apiKey,
      engine,
      model,
      timeoutMs,
      chunkSourceChars: parseBoundedInteger(
        args.chunkSourceChars,
        1000,
        1000000
      ),
      resource: planned.resource
    });
    appendFileSync(outJsonl, `${JSON.stringify(record)}\n`);
    records.push(record);
    if (
      !quiet ||
      record.status === "review_needed" ||
      (index + 1) % logEvery === 0 ||
      index + 1 === plan.length
    ) {
      console.log(
        `${record.status} resource=${record.resourceId} ${record.source.eStrong} progress=${index + 1}/${plan.length} issues=${record.validation.issues.join(",") || "none"}`
      );
    }
  }

  const allRecords = readJsonl(outJsonl);
  writeReviewNeeded(reviewNeededJson, allRecords);
  const summary = buildSummary({
    dryRun,
    inputCount: resources.length,
    skippedExisting: resources.length - resourcesToProcess.length,
    plannedResources: plan,
    records: allRecords,
    outJsonl,
    reviewNeededJson,
    reportPath
  });
  writeText(reportPath, renderReport(summary, allRecords, plan));
  console.log(JSON.stringify(summary, null, 2));
}

function selectResources(
  dbPath: string,
  args: Record<string, string>,
  source: string,
  kind: string
): ResourceRow[] {
  const where = [
    `lr.source = ${sqlString(source)}`,
    `lr.kind = ${sqlString(kind)}`
  ];
  const limit = parseBoundedInteger(args.limit, 1, 1000000);
  const offset = parseBoundedInteger(args.offset, 0, 1000000);
  if (args.ids) {
    const ids = args.ids
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isInteger);
    if (ids.length > 0) where.push(`lr.id IN (${ids.join(",")})`);
  }
  if (args.untranslatedOnly !== "false") {
    where.push(`NOT EXISTS (
      SELECT 1 FROM LexiconResourceTranslations lrt
      WHERE lrt.resourceId = lr.id AND lrt.language = 'fr'
    )`);
  }

  const sql = `
    SELECT
      lr.id,
      lr.stepEntryId,
      lr.source,
      lr.kind,
      lr.contentHtml,
      se.language AS entryLanguage,
      se.eStrong,
      se.dStrong,
      se.transliteration,
      se.gloss
    FROM LexiconResources lr
    JOIN StepEntries se ON se.id = lr.stepEntryId
    WHERE ${where.join(" AND ")}
    ORDER BY lr.id
    ${limit !== null ? `LIMIT ${limit}` : ""}
    ${offset !== null ? `OFFSET ${offset}` : ""}
  `;
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 160
  });
  return (JSON.parse(raw) as ResourceRow[]).map((resource) => ({
    ...resource,
    entryLanguage: resource.entryLanguage === "hebrew" ? "hebrew" : "greek"
  }));
}

function buildPlan(
  resources: ResourceRow[],
  limits: { maxSourceChars: number | null; maxProtectedChars: number | null }
): PlannedResource[] {
  const planned: PlannedResource[] = [];
  let sourceTotal = 0;
  let protectedTotal = 0;
  for (const resource of resources) {
    const protectedHtml = protectHtml(resource.contentHtml);
    const item = {
      resource,
      sourceChars: resource.contentHtml.length,
      protectedSourceChars: protectedHtml.html.length,
      sourceReferenceCount: extractReferences(resource.contentHtml).length,
      sourceStrongCount: extractStrongCodes(resource.contentHtml).length,
      sourceGreekTokenCount: extractGreekTokens(resource.contentHtml).length,
      sourceHebrewTokenCount: extractHebrewTokens(resource.contentHtml).length,
      sourceHtmlTagCount: countHtmlTags(resource.contentHtml)
    };
    if (
      limits.maxSourceChars !== null &&
      sourceTotal + item.sourceChars > limits.maxSourceChars
    ) {
      break;
    }
    if (
      limits.maxProtectedChars !== null &&
      protectedTotal + item.protectedSourceChars > limits.maxProtectedChars
    ) {
      break;
    }
    sourceTotal += item.sourceChars;
    protectedTotal += item.protectedSourceChars;
    planned.push(item);
  }
  return planned;
}

async function translateResource(options: {
  apiBase: string;
  apiKey: string;
  engine: "deepl" | "gemini";
  model: string;
  timeoutMs: number;
  chunkSourceChars: number | null;
  resource: ResourceRow;
}): Promise<CandidateRecord> {
  const { resource } = options;
  let protectedSourceChars = 0;
  let translation: GatewayTranslation;
  let contentHtmlFr: string;
  if (
    options.engine === "gemini" &&
    options.chunkSourceChars !== null &&
    resource.contentHtml.length > options.chunkSourceChars
  ) {
    const translated = await translateWithGatewayChunked({
      apiKey: options.apiKey,
      model: options.model,
      timeoutMs: options.timeoutMs,
      resource,
      chunkSourceChars: options.chunkSourceChars
    });
    protectedSourceChars = translated.protectedSourceChars;
    translation = translated.translation;
    contentHtmlFr = translated.contentHtmlFr;
  } else {
    const protectedHtml = protectHtml(resource.contentHtml);
    protectedSourceChars = protectedHtml.html.length;
    translation =
      options.engine === "gemini"
        ? await translateWithGateway({
            apiKey: options.apiKey,
            model: options.model,
            timeoutMs: options.timeoutMs,
            resource,
            protectedHtml: protectedHtml.html
          })
        : await translateWithDeepL(options.apiBase, options.apiKey, [
            protectedHtml.html
          ]).then(
            (translations): GatewayTranslation => ({
              text: translations[0]?.text ?? "",
              inputTokens: 0,
              outputTokens: 0,
              model: "deepl",
              billedCharacters: translations[0]?.billed_characters ?? null
            })
          );
    contentHtmlFr = normalizeTranslatedHtml(
      sanitizeTranslatedHtml(
        restoreTokens(translation.text, protectedHtml.tokens)
      )
    );
  }
  const validation = validateResource(resource.contentHtml, contentHtmlFr);
  return {
    resourceId: resource.id,
    stepEntryId: resource.stepEntryId,
    targetLanguage: "fr",
    status: validation.issues.length === 0 ? "accepted" : "review_needed",
    source: {
      source: resource.source,
      kind: resource.kind,
      entryLanguage: resource.entryLanguage,
      eStrong: resource.eStrong,
      dStrong: resource.dStrong,
      transliteration: resource.transliteration,
      gloss: resource.gloss,
      contentHash: sha256(resource.contentHtml)
    },
    translation: {
      contentHtmlFr,
      contentTextFr: stripHtml(contentHtmlFr),
      engine: options.engine
    },
    validation,
    usage: {
      sourceChars: resource.contentHtml.length,
      protectedSourceChars,
      translatedChars: contentHtmlFr.length,
      deeplBilledCharacters: translation.billedCharacters,
      inputTokens: translation.inputTokens || undefined,
      outputTokens: translation.outputTokens || undefined
    },
    generatedAt: new Date().toISOString()
  };
}

async function translateWithGateway(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  resource: ResourceRow;
  protectedHtml: string;
}): Promise<GatewayTranslation> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);
  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content: [
              "Tu es un traducteur lexicographique biblique.",
              "Traduis en français un contenu HTML de ressource étendue.",
              "Conserve les balises HTML existantes et ne crée pas de balises dangereuses.",
              "Ne traduis jamais le grec, l'hébreu, les codes Strong, les références bibliques, ni les placeholders __...__.",
              "Ne résume pas, mais une reformulation française naturelle est acceptable.",
              'Réponds uniquement en JSON valide avec la forme: {"contentHtmlFr":"..."}.'
            ].join(" ")
          },
          {
            role: "user",
            content: [
              `Strong: ${options.resource.eStrong}`,
              `Translittération: ${options.resource.transliteration}`,
              `Gloss anglais: ${options.resource.gloss}`,
              "",
              "Traduis ce HTML en français. Préserve les placeholders et le HTML.",
              "",
              options.protectedHtml
            ].join("\n")
          }
        ]
      })
    }
  ).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    throw new Error(
      `ai-gateway-http-${response.status}:${(await response.text()).slice(0, 500)}`
    );
  }
  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      promptTokens?: number;
      completionTokens?: number;
    };
  };
  const rawText = json.choices?.[0]?.message?.content ?? "";
  const parsed = parseGatewayTranslation(rawText);
  return {
    text: parsed.contentHtmlFr ?? "",
    inputTokens: json.usage?.prompt_tokens ?? json.usage?.promptTokens ?? 0,
    outputTokens:
      json.usage?.completion_tokens ?? json.usage?.completionTokens ?? 0,
    model: options.model,
    billedCharacters: null
  };
}

async function translateWithGatewayChunked(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  resource: ResourceRow;
  chunkSourceChars: number;
}): Promise<{
  contentHtmlFr: string;
  protectedSourceChars: number;
  translation: GatewayTranslation;
}> {
  const chunks = splitHtmlForTranslation(
    options.resource.contentHtml,
    options.chunkSourceChars
  );
  const translatedChunks: string[] = [];
  let protectedSourceChars = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  for (const chunk of chunks) {
    const protectedHtml = protectHtml(chunk);
    protectedSourceChars += protectedHtml.html.length;
    const translation = await translateWithGateway({
      apiKey: options.apiKey,
      model: options.model,
      timeoutMs: options.timeoutMs,
      resource: options.resource,
      protectedHtml: protectedHtml.html
    });
    inputTokens += translation.inputTokens;
    outputTokens += translation.outputTokens;
    translatedChunks.push(
      normalizeTranslatedHtml(
        sanitizeTranslatedHtml(
          restoreTokens(translation.text, protectedHtml.tokens)
        )
      )
    );
  }
  const contentHtmlFr = normalizeTranslatedHtml(translatedChunks.join(""));
  return {
    contentHtmlFr,
    protectedSourceChars,
    translation: {
      text: contentHtmlFr,
      inputTokens,
      outputTokens,
      model: options.model,
      billedCharacters: null
    }
  };
}

function splitHtmlForTranslation(
  html: string,
  maxSourceChars: number
): string[] {
  const units = html.split(/(?=<br\s*\/?>)/gi).filter(Boolean);
  const chunks: string[] = [];
  let current = "";
  for (const unit of units) {
    if (current && current.length + unit.length > maxSourceChars) {
      chunks.push(current);
      current = unit;
    } else {
      current += unit;
    }
  }
  if (current) chunks.push(current);
  return chunks.length > 0 ? chunks : [html];
}

function extractJson(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return trimmed;
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced) return fenced[1].trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return trimmed.slice(start, end + 1);
  return trimmed;
}

function parseGatewayTranslation(text: string): { contentHtmlFr?: string } {
  try {
    const parsed = JSON.parse(extractJson(text)) as { contentHtmlFr?: unknown };
    return { contentHtmlFr: normalizeGatewayHtmlValue(parsed.contentHtmlFr) };
  } catch {
    const match = /"contentHtmlFr"\s*:\s*"([\s\S]*)"\s*}?$/m.exec(text.trim());
    if (match) {
      return {
        contentHtmlFr: normalizeGatewayHtmlValue(unescapeJsonString(match[1]))
      };
    }
    return { contentHtmlFr: stripCodeFence(text) };
  }
}

function normalizeGatewayHtmlValue(value: unknown): string {
  if (typeof value !== "string") return "";
  let current = stripCodeFence(value);
  for (let index = 0; index < 3; index += 1) {
    const trimmed = current.trim();
    if (!trimmed.startsWith("{")) return current;
    try {
      const nested = JSON.parse(extractJson(trimmed)) as {
        contentHtmlFr?: unknown;
      };
      if (typeof nested.contentHtmlFr !== "string") return current;
      current = stripCodeFence(nested.contentHtmlFr);
    } catch {
      return current;
    }
  }
  return current;
}

function stripCodeFence(text: string): string {
  return text
    .trim()
    .replace(/^```(?:html|json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function unescapeJsonString(value: string): string {
  try {
    return JSON.parse(`"${value.replace(/"$/, "")}"`) as string;
  } catch {
    return value
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\t/g, "\t")
      .replace(/\\\\/g, "\\");
  }
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

function protectHtml(html: string): { html: string; tokens: ProtectedToken[] } {
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

function validateResource(
  sourceHtml: string,
  translatedHtml: string
): Validation {
  const sourceReferences = extractReferences(sourceHtml);
  const translatedReferences = extractReferences(translatedHtml);
  const sourceStrongCodes = extractStrongCodes(sourceHtml);
  const translatedStrongCodes = extractStrongCodes(translatedHtml);
  const sourceGreekTokens = extractGreekTokens(sourceHtml);
  const translatedGreekTokens = extractGreekTokens(translatedHtml);
  const sourceHebrewTokens = extractHebrewTokens(sourceHtml);
  const translatedHebrewTokens = extractHebrewTokens(translatedHtml);
  const sourceHtmlTagCount = countHtmlTags(sourceHtml);
  const translatedHtmlTagCount = countHtmlTags(translatedHtml);
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
  const issues: string[] = [];
  if (!translatedHtml.trim()) issues.push("missing-content-html-fr");
  if (missingReferences.length > 0) issues.push("missing-references");
  if (missingStrongCodes.length > 0) issues.push("missing-strong-codes");
  if (inventedStrongCodes.length > 0) issues.push("invented-strong-codes");
  if (missingGreekTokens.length > 0) issues.push("missing-greek-tokens");
  if (missingHebrewTokens.length > 0) issues.push("missing-hebrew-tokens");
  if (!htmlTagsAreSafe(translatedHtml)) issues.push("unsafe-html");
  if (htmlLooksBalanced(sourceHtml) && !htmlLooksBalanced(translatedHtml)) {
    issues.push("unbalanced-html");
  }
  if (/__(?:REF|STRONG|GREEK|HEBREW|SIGLUM)_\d+__/.test(translatedHtml)) {
    issues.push("unrestored-placeholder");
  }
  if (
    sourceHtml.length > 500 &&
    translatedHtml.length < sourceHtml.length * 0.45
  ) {
    issues.push("suspicious-shortening");
  }
  if (
    sourceHtmlTagCount > 0 &&
    translatedHtmlTagCount < Math.floor(sourceHtmlTagCount * 0.65)
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
    translatedHtmlTagCount
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
    references.add(reference.replace(/\s+/g, "").replace(/\.$/, ""));
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

function countHtmlTags(value: string): number {
  return [...value.matchAll(htmlTagPattern())].length;
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

function htmlTagPattern(): RegExp {
  return /<\/?\s*([a-z][a-z0-9-]*)(?:\s[^>]*|=[^>]*)?>/gi;
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

function baseStrong(value: string): string {
  const match = /^([GH])(\d{3,5})/i.exec(value);
  if (!match) return value;
  return `${match[1].toUpperCase()}${match[2].padStart(4, "0")}`;
}

function buildSummary(input: {
  dryRun: boolean;
  inputCount: number;
  skippedExisting: number;
  plannedResources: PlannedResource[];
  records: CandidateRecord[];
  outJsonl: string;
  reviewNeededJson: string;
  reportPath: string;
}): Record<string, unknown> {
  const issueCounts: Record<string, number> = {};
  for (const record of input.records) {
    for (const issue of record.validation.issues) {
      issueCounts[issue] = (issueCounts[issue] ?? 0) + 1;
    }
  }
  return {
    generatedAt: new Date().toISOString(),
    dryRun: input.dryRun,
    inputCount: input.inputCount,
    skippedExisting: input.skippedExisting,
    plannedCount: input.plannedResources.length,
    estimatedSourceChars: sumPlanned(input.plannedResources, "sourceChars"),
    estimatedProtectedChars: sumPlanned(
      input.plannedResources,
      "protectedSourceChars"
    ),
    outputJsonl: input.outJsonl,
    reviewNeededJson: input.reviewNeededJson,
    reportPath: input.reportPath,
    records: input.records.length,
    accepted: input.records.filter((record) => record.status === "accepted")
      .length,
    reviewNeeded: input.records.filter(
      (record) => record.status === "review_needed"
    ).length,
    deeplBilledCharacters: sumRecordBilledCharacters(input.records),
    issueCounts
  };
}

function renderReport(
  summary: Record<string, unknown>,
  records: CandidateRecord[],
  plannedResources: PlannedResource[]
): string {
  const plannedRows =
    plannedResources
      .slice(0, 20)
      .map(
        (planned) =>
          `| ${planned.resource.id} | ${planned.resource.eStrong} | ${planned.sourceChars} | ${planned.protectedSourceChars} | ${planned.sourceReferenceCount} | ${planned.sourceGreekTokenCount} | ${planned.sourceHtmlTagCount} |`
      )
      .join("\n") || "| none | none | 0 | 0 | 0 | 0 | 0 |";
  const issueRows =
    Object.entries((summary.issueCounts ?? {}) as Record<string, number>)
      .map(([issue, count]) => `| ${issue} | ${count} |`)
      .join("\n") || "| none | 0 |";
  const sampleRows = records
    .slice(0, 20)
    .map(
      (record) =>
        `| ${record.resourceId} | ${record.source.eStrong} | ${record.status} | ${record.validation.issues.join(", ") || "none"} | ${record.translation.contentTextFr.slice(0, 180).replace(/\|/g, "\\|")} |`
    )
    .join("\n");
  return `# Lexicon Resource FR DeepL

Generated: ${summary.generatedAt}

Dry run: ${summary.dryRun ? "yes" : "no"}

## Summary

- Input resources: ${summary.inputCount}
- Skipped existing: ${summary.skippedExisting}
- Planned resources: ${summary.plannedCount}
- Estimated source chars: ${summary.estimatedSourceChars}
- Estimated protected chars: ${summary.estimatedProtectedChars}
- Records generated: ${summary.records}
- Accepted: ${summary.accepted}
- Review needed: ${summary.reviewNeeded}
- DeepL billed chars: ${summary.deeplBilledCharacters ?? "not reported"}
- Output JSONL: \`${summary.outputJsonl}\`
- Review needed JSON: \`${summary.reviewNeededJson}\`

## Issue Counts

| Issue | Count |
| --- | ---: |
${issueRows}

## Planned Samples

| Resource ID | Strong | Source Chars | Protected Chars | Refs | Greek Tokens | HTML Tags |
| ---: | --- | ---: | ---: | ---: | ---: | ---: |
${plannedRows}

## Translation Samples

| Resource ID | Strong | Status | Issues | Preview |
| ---: | --- | --- | --- | --- |
${sampleRows}
`;
}

function readExistingResourceIds(path: string): Set<number> {
  if (!existsSync(path)) return new Set();
  const ids = new Set<number>();
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    if (!line.trim()) continue;
    ids.add((JSON.parse(line) as CandidateRecord).resourceId);
  }
  return ids;
}

function readJsonl(path: string): CandidateRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CandidateRecord);
}

function writeReviewNeeded(path: string, records: CandidateRecord[]): void {
  const reviewNeeded = records.filter(
    (record) => record.status === "review_needed"
  );
  writeJson(path, {
    generatedAt: new Date().toISOString(),
    count: reviewNeeded.length,
    entries: reviewNeeded.map((record) => ({
      resourceId: record.resourceId,
      stepEntryId: record.stepEntryId,
      eStrong: record.source.eStrong,
      issues: record.validation.issues,
      missingReferences: record.validation.missingReferences,
      missingStrongCodes: record.validation.missingStrongCodes,
      inventedStrongCodes: record.validation.inventedStrongCodes,
      missingGreekTokens: record.validation.missingGreekTokens,
      missingHebrewTokens: record.validation.missingHebrewTokens
    }))
  });
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

function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line.trim());
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!process.env[key])
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
  }
}

function inferDeepLBase(apiKey: string): string {
  return apiKey.endsWith(":fx") ? DEEPL_FREE_BASE : DEEPL_PRO_BASE;
}

function sumPlanned(
  planned: PlannedResource[],
  key: "sourceChars" | "protectedSourceChars"
): number {
  return planned.reduce((total, item) => total + item[key], 0);
}

function sumRecordBilledCharacters(records: CandidateRecord[]): number | null {
  const billed = records
    .map((record) => record.usage.deeplBilledCharacters)
    .filter((value): value is number => typeof value === "number");
  if (billed.length === 0) return null;
  return billed.reduce((total, value) => total + value, 0);
}

function hasLetter(value: string): boolean {
  return /\p{Letter}/u.test(value);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeText(path: string, value: string): void {
  mkdirSync(dirname(resolve(path)), { recursive: true });
  writeFileSync(path, value);
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
