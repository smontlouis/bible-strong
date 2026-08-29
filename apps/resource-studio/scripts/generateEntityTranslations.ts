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

type EntityRow = {
  id: number;
  uniqueName: string;
  uStrong: string;
  displayName: string;
  category: "person" | "group" | "place" | "other";
  type: string;
  description: string;
  summaryHtml: string;
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
};

type TranslationFields = {
  description: string;
  summaryHtml: string;
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
};

type CandidateRecord = {
  entityId: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed";
  source: {
    uniqueName: string;
    uStrong: string;
    displayName: string;
    category: EntityRow["category"];
    type: string;
    contentHash: string;
  };
  translation: TranslationFields & {
    displayName: string;
    engine: "gemini";
    model: string;
  };
  validation: Validation;
  usage: {
    sourceChars: number;
    translatedChars: number;
    inputTokens: number;
    outputTokens: number;
  };
  generatedAt: string;
};

type Validation = {
  issues: string[];
  missingStrongCodes: string[];
  inventedStrongCodes: string[];
  missingReferences: string[];
  suspiciousNameTranslations: string[];
  sourceHtmlTagCount: number;
  translatedHtmlTagCount: number;
};

type GatewayResult = {
  translations: Array<{ entityId: number } & Partial<TranslationFields>>;
  inputTokens: number;
  outputTokens: number;
};

const DEFAULT_DB = "data/entities/bible_entities.sqlite";
const DEFAULT_OUT_JSONL = "outputs/entity-fr/entity_fr.gemini.candidates.jsonl";
const DEFAULT_REVIEW_NEEDED = "outputs/entity-fr/entity_fr.review-needed.json";
const DEFAULT_REPORT = "reports/entity-fr-gemini-production.md";
const DEFAULT_DRY_RUN_REPORT = "reports/entity-fr-gemini-dry-run.md";
const DEFAULT_MODEL = "google/gemini-3.5-flash";
const TRANSLATABLE_FIELDS: Array<keyof TranslationFields> = [
  "description",
  "summaryHtml",
  "briefest",
  "brief",
  "shortDescription",
  "articleHtml"
];

async function main(): Promise<void> {
  loadDotEnv();
  const args = parseArgs(process.argv.slice(2));
  const dryRun = args.dryRun === "true";
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!dryRun && !apiKey) {
    throw new Error("missing AI_GATEWAY_KEY or AI_GATEWAY_API_KEY");
  }

  const dbPath = args.db ?? DEFAULT_DB;
  const outJsonl = args.outJsonl ?? DEFAULT_OUT_JSONL;
  const reviewNeededJson = args.reviewNeededJson ?? DEFAULT_REVIEW_NEEDED;
  const reportPath =
    args.report ?? (dryRun ? DEFAULT_DRY_RUN_REPORT : DEFAULT_REPORT);
  const model = args.model ?? DEFAULT_MODEL;
  const timeoutMs =
    parseBoundedInteger(
      args.timeoutMs ?? process.env.AI_GATEWAY_TIMEOUT_MS,
      1000,
      600000
    ) ?? 180000;
  const batchSize = parseBoundedInteger(args.batchSize, 1, 50) ?? 10;
  const maxBatchSourceChars =
    parseBoundedInteger(args.maxBatchSourceChars, 1000, 200000) ?? 24000;
  const quiet = args.quiet === "true";
  const logEvery = parseBoundedInteger(args.logEvery, 1, 1000000) ?? 5;

  mkdirSync(dirname(resolve(outJsonl)), { recursive: true });
  mkdirSync(dirname(resolve(reviewNeededJson)), { recursive: true });
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  if (!dryRun && args.resume !== "true") rmSync(outJsonl, { force: true });

  const entities = selectEntities(dbPath, args);
  const alreadyWritten =
    args.resume === "true"
      ? readExistingEntityIds(outJsonl)
      : new Set<number>();
  const toProcess = entities.filter((entity) => !alreadyWritten.has(entity.id));
  const batches = buildBatches(toProcess, batchSize, maxBatchSourceChars);

  if (dryRun) {
    const summary = buildSummary({
      dryRun,
      inputCount: entities.length,
      skippedExisting: entities.length - toProcess.length,
      batches,
      records: [],
      outJsonl,
      reviewNeededJson,
      reportPath
    });
    writeText(reportPath, renderReport(summary, [], batches));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!apiKey) throw new Error("missing API key");
  const records: CandidateRecord[] = [];
  for (const [batchIndex, batch] of batches.entries()) {
    const batchRecords = await translateBatchRecords({
      apiKey,
      model,
      timeoutMs,
      entities: batch
    });
    for (const record of batchRecords) {
      appendFileSync(outJsonl, `${JSON.stringify(record)}\n`);
      records.push(record);
    }
    const issueCount = batchRecords.filter(
      (record) => record.status === "review_needed"
    ).length;
    if (
      !quiet ||
      issueCount > 0 ||
      (batchIndex + 1) % logEvery === 0 ||
      batchIndex + 1 === batches.length
    ) {
      console.log(
        `batch=${batchIndex + 1}/${batches.length} records=${batchRecords.length} reviewNeeded=${issueCount}`
      );
    }
  }

  const allRecords = readJsonl(outJsonl);
  writeReviewNeeded(reviewNeededJson, allRecords);
  const summary = buildSummary({
    dryRun,
    inputCount: entities.length,
    skippedExisting: entities.length - toProcess.length,
    batches,
    records: allRecords,
    outJsonl,
    reviewNeededJson,
    reportPath
  });
  writeText(reportPath, renderReport(summary, allRecords, batches));
  console.log(JSON.stringify(summary, null, 2));
}

function selectEntities(
  dbPath: string,
  args: Record<string, string>
): EntityRow[] {
  const where: string[] = [];
  const limit = parseBoundedInteger(args.limit, 1, 1000000);
  const offset = parseBoundedInteger(args.offset, 0, 1000000);
  if (args.ids) {
    const ids = args.ids
      .split(",")
      .map((value) => Number.parseInt(value.trim(), 10))
      .filter(Number.isInteger);
    if (ids.length > 0) where.push(`id IN (${ids.join(",")})`);
  }
  if (args.category) {
    where.push(`category = ${sqlString(args.category)}`);
  }
  if (
    args.untranslatedOnly !== "false" &&
    tableExists(dbPath, "EntityTranslations")
  ) {
    where.push(`NOT EXISTS (
      SELECT 1 FROM EntityTranslations et
      WHERE et.entityId = Entities.id AND et.language = 'fr'
    )`);
  }

  const sql = `
    SELECT id, uniqueName, uStrong, displayName, category, type, description,
      summaryHtml, briefest, brief, shortDescription, articleHtml
    FROM Entities
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY id
    ${limit !== null ? `LIMIT ${limit}` : ""}
    ${offset !== null ? `OFFSET ${offset}` : ""}
  `;
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 80
  });
  return JSON.parse(raw) as EntityRow[];
}

function buildBatches(
  entities: EntityRow[],
  batchSize: number,
  maxBatchSourceChars: number
): EntityRow[][] {
  const batches: EntityRow[][] = [];
  let current: EntityRow[] = [];
  let currentChars = 0;
  for (const entity of entities) {
    const sourceChars = entitySourceChars(entity);
    if (
      current.length > 0 &&
      (current.length >= batchSize ||
        currentChars + sourceChars > maxBatchSourceChars)
    ) {
      batches.push(current);
      current = [];
      currentChars = 0;
    }
    current.push(entity);
    currentChars += sourceChars;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function translateBatch(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  entities: EntityRow[];
}): Promise<GatewayResult> {
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
              "Tu es un traducteur biblique spécialisé en entités bibliques.",
              "Traduis en français sans résumer.",
              "Préserve les balises HTML existantes, les tags Strong de type <H1234>/<G1234>, les codes Strong, les références bibliques et les noms propres bibliques.",
              "Chaque référence biblique présente dans la source doit apparaître dans la traduction, avec le même chapitre, verset, plage et liste.",
              "N'ajoute jamais de lien, de balise HTML, de Markdown ou de formatage absent de la source.",
              "Ne traduis jamais un nom propre comme un mot commun: Ham reste Ham, Job reste Job, Lot reste Lot.",
              "Ne traduis pas les champs entityId.",
              "Réponds uniquement en JSON valide."
            ].join(" ")
          },
          {
            role: "user",
            content: [
              "Traduis les champs textuels suivants en français.",
              'Retourne exactement cette forme: {"translations":[{"entityId":1,"description":"...","summaryHtml":"...","briefest":"...","brief":"...","shortDescription":"...","articleHtml":"..."}]}',
              "",
              JSON.stringify({
                entities: options.entities.map((entity) => ({
                  entityId: entity.id,
                  uniqueName: entity.uniqueName,
                  displayName: entity.displayName,
                  category: entity.category,
                  type: entity.type,
                  fields: pickTranslationFields(entity)
                }))
              })
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
  const parsed = parseGatewayJson(rawText);
  return {
    translations: Array.isArray(parsed.translations) ? parsed.translations : [],
    inputTokens: json.usage?.prompt_tokens ?? json.usage?.promptTokens ?? 0,
    outputTokens:
      json.usage?.completion_tokens ?? json.usage?.completionTokens ?? 0
  };
}

async function translateBatchRecords(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  entities: EntityRow[];
}): Promise<CandidateRecord[]> {
  try {
    const result = await translateBatch(options);
    return buildRecords(options.entities, result, options.model);
  } catch (error: unknown) {
    if (options.entities.length <= 1 || !isRecoverableBatchError(error)) {
      throw error;
    }
    const midpoint = Math.ceil(options.entities.length / 2);
    const first = await translateBatchRecords({
      ...options,
      entities: options.entities.slice(0, midpoint)
    });
    const second = await translateBatchRecords({
      ...options,
      entities: options.entities.slice(midpoint)
    });
    return [...first, ...second];
  }
}

function isRecoverableBatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.startsWith("gateway-response-") ||
    error.message.includes("Unexpected end of JSON input")
  );
}

function buildRecords(
  entities: EntityRow[],
  result: GatewayResult,
  model: string
): CandidateRecord[] {
  const translationsById = new Map(
    result.translations.map((translation) => [
      translation.entityId,
      translation
    ])
  );
  const missingIds = entities
    .map((entity) => entity.id)
    .filter((entityId) => !translationsById.has(entityId));
  if (missingIds.length > 0) {
    throw new Error(
      `gateway-response-missing-entity-ids:${missingIds.join(",")}`
    );
  }
  const expectedIds = new Set(entities.map((entity) => entity.id));
  const unexpectedIds = result.translations
    .map((translation) => translation.entityId)
    .filter((entityId) => !expectedIds.has(entityId));
  if (unexpectedIds.length > 0) {
    throw new Error(
      `gateway-response-unexpected-entity-ids:${unexpectedIds.join(",")}`
    );
  }
  for (const entity of entities) {
    const translation = translationsById.get(entity.id);
    if (!translation) continue;
    const missingFields = TRANSLATABLE_FIELDS.filter(
      (field) => entity[field] && !translation[field]
    );
    if (missingFields.length > 0) {
      throw new Error(
        `gateway-response-incomplete-entity-fields:${entity.id}:${missingFields.join(",")}`
      );
    }
  }
  return entities.map((entity) => {
    const translated = normalizeFields(translationsById.get(entity.id));
    const validation = validateEntity(entity, translated);
    return {
      entityId: entity.id,
      targetLanguage: "fr",
      status: validation.issues.length === 0 ? "accepted" : "review_needed",
      source: {
        uniqueName: entity.uniqueName,
        uStrong: entity.uStrong,
        displayName: entity.displayName,
        category: entity.category,
        type: entity.type,
        contentHash: sha256(JSON.stringify(pickTranslationFields(entity)))
      },
      translation: {
        displayName: entity.displayName,
        ...translated,
        engine: "gemini",
        model
      },
      validation,
      usage: {
        sourceChars: entitySourceChars(entity),
        translatedChars: fieldsChars(translated),
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens
      },
      generatedAt: new Date().toISOString()
    };
  });
}

function validateEntity(
  source: EntityRow,
  translated: TranslationFields
): Validation {
  const sourceText = JSON.stringify(pickTranslationFields(source));
  const translatedText = JSON.stringify(translated);
  const sourceStrongCodes = extractStrongCodes(sourceText);
  const translatedStrongCodes = extractStrongCodes(translatedText);
  const sourceReferences = extractReferences(sourceText);
  const translatedReferences = extractReferences(translatedText);
  const missingStrongCodes = sourceStrongCodes.filter(
    (code) => !translatedStrongCodes.includes(code)
  );
  const inventedStrongCodes = translatedStrongCodes.filter(
    (code) => !sourceStrongCodes.includes(code)
  );
  const missingReferences = sourceReferences.filter(
    (reference) => !translatedReferences.includes(reference)
  );
  const sourceHtmlTagCount = countHtmlTags(sourceText);
  const translatedHtmlTagCount = countHtmlTags(translatedText);
  const suspiciousNameTranslations = findSuspiciousNameTranslations(
    sourceText,
    translatedText
  );
  const issues: string[] = [];
  if (
    TRANSLATABLE_FIELDS.some((field) => source[field] && !translated[field])
  ) {
    issues.push("missing-translated-field");
  }
  if (missingStrongCodes.length > 0) issues.push("missing-strong-codes");
  if (inventedStrongCodes.length > 0) issues.push("invented-strong-codes");
  if (missingReferences.length > 0) issues.push("missing-references");
  if (suspiciousNameTranslations.length > 0) {
    issues.push("suspicious-name-translation");
  }
  if (!htmlTagsAreSafe(translatedText)) issues.push("unsafe-html");
  if (sourceHtmlTagCount !== translatedHtmlTagCount) {
    issues.push("html-tag-count-mismatch");
  }
  if (
    sourceText.length > 200 &&
    translatedText.length < sourceText.length * 0.5
  ) {
    issues.push("suspicious-shortening");
  }
  return {
    issues,
    missingStrongCodes,
    inventedStrongCodes,
    missingReferences,
    suspiciousNameTranslations,
    sourceHtmlTagCount,
    translatedHtmlTagCount
  };
}

function normalizeFields(
  value: Partial<TranslationFields> | undefined
): TranslationFields {
  return {
    description: normalizeText(value?.description ?? ""),
    summaryHtml: normalizeText(value?.summaryHtml ?? ""),
    briefest: normalizeText(value?.briefest ?? ""),
    brief: normalizeText(value?.brief ?? ""),
    shortDescription: normalizeText(value?.shortDescription ?? ""),
    articleHtml: normalizeText(value?.articleHtml ?? "")
  };
}

function pickTranslationFields(entity: EntityRow): TranslationFields {
  return {
    description: entity.description,
    summaryHtml: entity.summaryHtml,
    briefest: entity.briefest,
    brief: entity.brief,
    shortDescription: entity.shortDescription,
    articleHtml: entity.articleHtml
  };
}

function parseGatewayJson(text: string): {
  translations?: GatewayResult["translations"];
} {
  const jsonText = extractJson(text);
  return JSON.parse(jsonText) as {
    translations?: GatewayResult["translations"];
  };
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

function writeReviewNeeded(path: string, records: CandidateRecord[]): void {
  const reviewNeeded = records.filter(
    (record) => record.status === "review_needed"
  );
  writeJson(path, {
    generatedAt: new Date().toISOString(),
    count: reviewNeeded.length,
    entries: reviewNeeded.map((record) => ({
      entityId: record.entityId,
      uniqueName: record.source.uniqueName,
      displayName: record.source.displayName,
      category: record.source.category,
      issues: record.validation.issues,
      missingStrongCodes: record.validation.missingStrongCodes,
      inventedStrongCodes: record.validation.inventedStrongCodes,
      missingReferences: record.validation.missingReferences,
      suspiciousNameTranslations: record.validation.suspiciousNameTranslations
    }))
  });
}

function buildSummary(input: {
  dryRun: boolean;
  inputCount: number;
  skippedExisting: number;
  batches: EntityRow[][];
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
    batches: input.batches.length,
    estimatedSourceChars: input.batches
      .flat()
      .reduce((total, entity) => total + entitySourceChars(entity), 0),
    outputJsonl: input.outJsonl,
    reviewNeededJson: input.reviewNeededJson,
    reportPath: input.reportPath,
    records: input.records.length,
    accepted: input.records.filter((record) => record.status === "accepted")
      .length,
    reviewNeeded: input.records.filter(
      (record) => record.status === "review_needed"
    ).length,
    issueCounts
  };
}

function renderReport(
  summary: Record<string, unknown>,
  records: CandidateRecord[],
  batches: EntityRow[][]
): string {
  const issueRows =
    Object.entries((summary.issueCounts ?? {}) as Record<string, number>)
      .map(([issue, count]) => `| ${issue} | ${count} |`)
      .join("\n") || "| none | 0 |";
  const categoryRows =
    Object.entries(
      batches.flat().reduce<Record<string, number>>((counts, entity) => {
        counts[entity.category] = (counts[entity.category] ?? 0) + 1;
        return counts;
      }, {})
    )
      .map(([category, count]) => `| ${category} | ${count} |`)
      .join("\n") || "| none | 0 |";
  const sampleRows =
    records
      .slice(0, 20)
      .map(
        (record) =>
          `| ${record.entityId} | ${record.source.displayName} | ${record.source.category} | ${record.status} | ${record.validation.issues.join(", ") || "none"} | ${stripHtml(
            record.translation.brief || record.translation.shortDescription
          )
            .slice(0, 160)
            .replace(/\|/g, "\\|")} |`
      )
      .join("\n") || "| none | none | none | none | none | none |";
  return `# Entity FR Gemini Translation

Generated: ${summary.generatedAt}

Dry run: ${summary.dryRun ? "yes" : "no"}

## Summary

- Input entities: ${summary.inputCount}
- Skipped existing: ${summary.skippedExisting}
- Batches: ${summary.batches}
- Estimated source chars: ${summary.estimatedSourceChars}
- Records generated: ${summary.records}
- Accepted: ${summary.accepted}
- Review needed: ${summary.reviewNeeded}
- Output JSONL: \`${summary.outputJsonl}\`
- Review needed JSON: \`${summary.reviewNeededJson}\`

## Categories

| Category | Count |
| --- | ---: |
${categoryRows}

## Issue Counts

| Issue | Count |
| --- | ---: |
${issueRows}

## Samples

| Entity ID | Name | Category | Status | Issues | Preview |
| ---: | --- | --- | --- | --- | --- |
${sampleRows}
`;
}

function readExistingEntityIds(path: string): Set<number> {
  if (!existsSync(path)) return new Set();
  return new Set(readJsonl(path).map((record) => record.entityId));
}

function readJsonl(path: string): CandidateRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CandidateRecord);
}

function findSuspiciousNameTranslations(
  sourceText: string,
  translatedText: string
): string[] {
  const suspicious: string[] = [];
  const checks: Array<[RegExp, RegExp, string]> = [
    [/\bHam\b/, /\bjambon\b/i, "Ham=>jambon"],
    [/\bJob\b/, /\b(emploi|travail|boulot)\b/i, "Job=>emploi/travail"],
    [/\bLot\b/, /\blot\b/, "Lot=>lot"],
    [/\bGad\b/, /\bgadget\b/i, "Gad=>gadget"]
  ];
  for (const [sourcePattern, translatedPattern, label] of checks) {
    if (
      sourcePattern.test(sourceText) &&
      translatedPattern.test(translatedText)
    ) {
      suspicious.push(label);
    }
  }
  return suspicious;
}

function htmlTagsAreSafe(value: string): boolean {
  for (const match of value.matchAll(htmlTagPattern())) {
    const raw = match[0].toLowerCase();
    const tag = match[1].toLowerCase();
    if (["script", "style", "iframe", "object", "embed"].includes(tag)) {
      return false;
    }
    if (/\son[a-z]+\s*=/.test(raw) || /javascript:/.test(raw)) return false;
  }
  return true;
}

function extractStrongCodes(value: string): string[] {
  return [
    ...new Set(
      value.match(/\b[GH]\d{3,5}[A-Za-z]?\b|<\/?[GH]\d{3,5}[A-Za-z]?>/g) ?? []
    )
  ];
}

function extractReferences(value: string): string[] {
  return [
    ...new Set(
      (stripHtml(value).match(referencePattern()) ?? []).map((reference) =>
        canonicalReference(reference)
      )
    )
  ];
}

function countHtmlTags(value: string): number {
  return [...value.matchAll(htmlTagPattern())].length;
}

function htmlTagPattern(): RegExp {
  return /<\/?\s*([a-z][a-z0-9-]*)(?:\s[^>]*|=[^>]*)?>/gi;
}

function referencePattern(): RegExp {
  const book =
    "(?:Ac|Act|Acts|Actes|Am|Amo|Amos|Bar|Bel|Ch|Chr|Chroniques|Co|Col|Cor|Da|Dan|De|Deu|Deutéronome|Deuteronome|Dt|Ec|Ecc|Eccl|Eph|Ep|Es|Est|Ex|Exo|Exode|Ez|Eze|Ésaïe|Esaïe|Esaie|Gal|Ga|Gen|Genèse|Genese|Gn|Hab|Hag|He|Heb|Ho|Hos|Os|Osée|Osee|Is|Isa|Jas|Jb|Jdg|Jdth|Jer|Jhn|Jn|Jo|Job|Joel|John|Jol|Jon|Jos|Josh|Joshua|Ju|Judg|Juges|Ki|Kings|Rois|La|Lam|Le|Lev|Lévitique|Levitique|Lv|Lk|Lu|Luk|Luc|Ma|Mac|Macc|Mal|Mat|Matt|Matthieu|Mic|Mk|Mrk|Mt|Nam|Ne|Neh|Néh|Nu|Num|Nombres|Nb|Pe|Pet|Pi|Phi|Phil|Phlm|Php|Pr|Pro|Prov|Proverbes|Ps|Psa|Psaume|Psaumes|Rev|Rév|Ap|Apoc|Rom|Ro|Rut|Ruth|Sa|Sam|Samuel|Sir|Sng|Sol|Su|Sus|Th|Thess|Ti|Tim|Tit|Tob|Wis|Za|Zac|Zec|Zep|Soph)";
  return new RegExp(
    `\\b(?:[1-4]\\s*)?${book}\\.?\\s*\\d{1,3}[:.]\\d{1,3}(?:[-–]\\d{1,3})?(?:,\\s*(?![1-4]?\\s*[A-Za-zÀ-ÿ]+\\.?\\s*\\d)\\d{1,3})?\\b`,
    "gi"
  );
}

function canonicalReference(value: string): string {
  const compact = removeAccents(value)
    .replace(/\s+/g, "")
    .replace(/\.$/, "")
    .replace(/\./g, ":");
  const numericPrefix = /^([1-4])/.exec(compact)?.[1] ?? "";
  let bookAndRef = numericPrefix
    ? compact.slice(numericPrefix.length)
    : compact;
  const aliases: Array<[RegExp, string]> = [
    [/^Joshua/i, "Joshua"],
    [/^Josue/i, "Joshua"],
    [/^Josh(?:ua)?/i, "Joshua"],
    [/^Jos/i, "Joshua"],
    [/^Juges/i, "Jdg"],
    [/^Judg(?:es)?/i, "Jdg"],
    [/^Rois/i, "Ki"],
    [/^Kings/i, "Ki"],
    [/^Sam(?:uel)?/i, "Sa"],
    [/^Nombres/i, "Num"],
    [/^Chroniques/i, "Ch"],
    [/^Numbers/i, "Num"],
    [/^Nb/i, "Num"],
    [/^Genese/i, "Gen"],
    [/^Gen(?:esis)?/i, "Gen"],
    [/^Gn/i, "Gen"],
    [/^Ex(?:ode|odus|o)?/i, "Exo"],
    [/^Lev(?:itique|iticus)?/i, "Lev"],
    [/^Lv/i, "Lev"],
    [/^Dt/i, "Deu"],
    [/^Deut(?:eronome|eronomy)?/i, "Deu"],
    [/^Psaumes?/i, "Psa"],
    [/^Psalms?/i, "Psa"],
    [/^Esaie/i, "Isa"],
    [/^Isa/i, "Isa"],
    [/^Prov(?:erbes|erbs)?/i, "Pro"],
    [/^Matthieu/i, "Mat"],
    [/^Matt(?:hew)?/i, "Mat"],
    [/^Marc/i, "Mrk"],
    [/^Mark/i, "Mrk"],
    [/^Luc/i, "Luk"],
    [/^Luke/i, "Luk"],
    [/^Jean/i, "John"],
    [/^Jn/i, "John"],
    [/^Actes/i, "Acts"],
    [/^Romains/i, "Rom"],
    [/^Apoc(?:alypse)?/i, "Rev"],
    [/^Osee/i, "Hos"],
    [/^Os/i, "Hos"],
    [/^Chr/i, "Ch"],
    [/^Neh/i, "Neh"],
    [/^Soph/i, "Zep"]
  ];
  for (const [pattern, canonical] of aliases) {
    bookAndRef = bookAndRef.replace(pattern, canonical);
  }
  return `${numericPrefix}${bookAndRef}`;
}

function removeAccents(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function normalizeText(value: string): string {
  return value.replace(/[ \t]{2,}/g, " ").trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function entitySourceChars(entity: EntityRow): number {
  return fieldsChars(pickTranslationFields(entity));
}

function fieldsChars(fields: TranslationFields): number {
  return TRANSLATABLE_FIELDS.reduce(
    (total, field) => total + fields[field].length,
    0
  );
}

function tableExists(dbPath: string, tableName: string): boolean {
  const raw = execFileSync(
    "sqlite3",
    [
      "-json",
      dbPath,
      `SELECT name FROM sqlite_master WHERE type='table' AND name=${sqlString(tableName)}`
    ],
    { encoding: "utf8" }
  );
  if (!raw.trim()) return false;
  return (JSON.parse(raw) as Array<{ name: string }>).length > 0;
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
    if (!process.env[key]) {
      process.env[key] = rawValue.replace(/^['"]|['"]$/g, "");
    }
  }
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
