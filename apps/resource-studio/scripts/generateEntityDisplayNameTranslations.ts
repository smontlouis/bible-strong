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

type NameRow = {
  displayName: string;
  category: "person" | "group" | "place" | "other";
  entityCount: number;
};

type NameTranslation = {
  displayName: string;
  category: NameRow["category"];
  displayNameFr: string;
  confidence?: "high" | "medium" | "low";
  note?: string;
};

type CandidateRecord = {
  displayName: string;
  category: NameRow["category"];
  entityCount: number;
  targetLanguage: "fr";
  status: "accepted" | "review_needed";
  translation: {
    displayNameFr: string;
    confidence: "high" | "medium" | "low";
    note: string;
    engine: "gemini";
    model: string;
  };
  validation: {
    issues: string[];
  };
  generatedAt: string;
};

const DEFAULT_DB = "data/entities/bible_entities.sqlite";
const DEFAULT_OUT_JSONL =
  "outputs/entity-fr/entity_display_names_fr.gemini.candidates.jsonl";
const DEFAULT_REVIEW_NEEDED =
  "outputs/entity-fr/entity_display_names_fr.review-needed.json";
const DEFAULT_REPORT = "reports/entity-display-names-fr-gemini.md";
const DEFAULT_MODEL = "google/gemini-3.5-flash";
const KNOWN_OVERRIDES: Record<string, string> = {
  Christ: "Christ",
  Elijah: "Élie",
  Elisha: "Élisée",
  Ezekiel: "Ézéchiel",
  Greece: "Grèce",
  Isaiah: "Ésaïe",
  James: "Jacques",
  Jeremiah: "Jérémie",
  Jesus: "Jésus",
  Job: "Job",
  John: "Jean",
  Jordan: "Jourdain",
  Joshua: "Josué",
  Jerusalem: "Jérusalem",
  Lot: "Lot",
  Luke: "Luc",
  Mark: "Marc",
  Mary: "Marie",
  Matthew: "Matthieu",
  Moses: "Moïse",
  Noah: "Noé",
  Peter: "Pierre",
  Solomon: "Salomon",
  Stephen: "Étienne",
  Zechariah: "Zacharie"
};
const CATEGORY_OVERRIDES: Record<string, string> = {
  "person\tEgypt": "Mitsraïm",
  "place\tEgypt": "Égypte",
  "person\tHam": "Cham",
  "place\tHam": "Ham"
};

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
  const reportPath = args.report ?? DEFAULT_REPORT;
  const model = args.model ?? DEFAULT_MODEL;
  const batchSize = parseBoundedInteger(args.batchSize, 1, 700) ?? 500;
  const timeoutMs =
    parseBoundedInteger(
      args.timeoutMs ?? process.env.AI_GATEWAY_TIMEOUT_MS,
      1000,
      600000
    ) ?? 180000;
  const quiet = args.quiet === "true";

  mkdirSync(dirname(resolve(outJsonl)), { recursive: true });
  mkdirSync(dirname(resolve(reviewNeededJson)), { recursive: true });
  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  if (!dryRun && args.resume !== "true") rmSync(outJsonl, { force: true });

  const names = selectNames(dbPath, args);
  const alreadyWritten =
    args.resume === "true" ? readExistingKeys(outJsonl) : new Set<string>();
  const toProcess = names.filter((name) => !alreadyWritten.has(nameKey(name)));
  const batches = chunk(toProcess, batchSize);

  if (dryRun) {
    const summary = buildSummary({
      names,
      skippedExisting: names.length - toProcess.length,
      records: [],
      batches: batches.length,
      outJsonl,
      reviewNeededJson,
      reportPath,
      dryRun
    });
    writeText(reportPath, renderReport(summary, []));
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  if (!apiKey) throw new Error("missing API key");
  const records: CandidateRecord[] = [];
  for (const [index, batch] of batches.entries()) {
    const batchRecords = await translateBatchRecords({
      apiKey,
      model,
      timeoutMs,
      names: batch
    });
    for (const record of batchRecords) {
      appendFileSync(outJsonl, `${JSON.stringify(record)}\n`);
      records.push(record);
    }
    const reviewNeeded = batchRecords.filter(
      (record) => record.status === "review_needed"
    ).length;
    if (!quiet || reviewNeeded > 0 || index + 1 === batches.length) {
      console.log(
        `batch=${index + 1}/${batches.length} records=${batchRecords.length} reviewNeeded=${reviewNeeded}`
      );
    }
  }

  const allRecords = readJsonl(outJsonl);
  writeReviewNeeded(reviewNeededJson, allRecords);
  const summary = buildSummary({
    names,
    skippedExisting: names.length - toProcess.length,
    records: allRecords,
    batches: batches.length,
    outJsonl,
    reviewNeededJson,
    reportPath,
    dryRun
  });
  writeText(reportPath, renderReport(summary, allRecords));
  console.log(JSON.stringify(summary, null, 2));
}

async function translateBatchRecords(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  names: NameRow[];
}): Promise<CandidateRecord[]> {
  try {
    const translations = await translateBatch(options);
    return buildRecords(options.names, translations, options.model);
  } catch (error: unknown) {
    if (options.names.length <= 1 || !isRecoverableBatchError(error)) {
      throw error;
    }
    const midpoint = Math.ceil(options.names.length / 2);
    const first = await translateBatchRecords({
      ...options,
      names: options.names.slice(0, midpoint)
    });
    const second = await translateBatchRecords({
      ...options,
      names: options.names.slice(midpoint)
    });
    return [...first, ...second];
  }
}

function isRecoverableBatchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  return (
    error.message.includes("JSON") || error.message.includes("Unexpected end")
  );
}

function selectNames(dbPath: string, args: Record<string, string>): NameRow[] {
  const where: string[] = [];
  const limit = parseBoundedInteger(args.limit, 1, 1000000);
  if (args.category) where.push(`category = ${sqlString(args.category)}`);
  const sql = `
    SELECT displayName, category, count(*) AS entityCount
    FROM Entities
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY displayName, category
    ORDER BY displayName, category
    ${limit !== null ? `LIMIT ${limit}` : ""}
  `;
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20
  });
  return JSON.parse(raw) as NameRow[];
}

async function translateBatch(options: {
  apiKey: string;
  model: string;
  timeoutMs: number;
  names: NameRow[];
}): Promise<NameTranslation[]> {
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
              "Tu es un spécialiste des noms bibliques en français.",
              "Tu traduis des displayName d'entités bibliques: personnes, lieux, groupes, autres.",
              "Utilise la forme biblique française courante quand elle est certaine: John=>Jean, James=>Jacques, Stephen=>Étienne, Isaiah=>Ésaïe, Hosea=>Osée, Joshua=>Josué, Zechariah=>Zacharie, Ham=>Cham.",
              "Ne traduis jamais un nom propre comme un mot commun: Ham n'est jamais jambon, Job n'est jamais travail, Lot reste Lot.",
              "Si la forme française n'est pas certaine, garde le nom source ou fais une translittération minimale.",
              "Traduis les qualifiants structuraux: _Valley=>vallée de, _Mount=>mont, _Sea=>mer, _River=>fleuve/rivière si clair.",
              "Réponds uniquement en JSON valide."
            ].join(" ")
          },
          {
            role: "user",
            content: [
              'Retourne exactement: {"translations":[{"displayName":"...","category":"person|place|group|other","displayNameFr":"...","confidence":"high|medium|low","note":"..."}]}',
              "Voici les noms:",
              JSON.stringify({ names: options.names })
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
  };
  const rawText = json.choices?.[0]?.message?.content ?? "";
  const parsed = JSON.parse(extractJson(rawText)) as {
    translations?: NameTranslation[];
  };
  if (!Array.isArray(parsed.translations)) return [];
  return parsed.translations;
}

function buildRecords(
  names: NameRow[],
  translations: NameTranslation[],
  model: string
): CandidateRecord[] {
  const byKey = new Map(
    translations.map((translation) => [nameKey(translation), translation])
  );
  return names.map((name) => {
    const translation = byKey.get(nameKey(name));
    const override =
      CATEGORY_OVERRIDES[nameKey(name)] ?? KNOWN_OVERRIDES[name.displayName];
    const displayNameFr = normalizeName(
      override ?? translation?.displayNameFr ?? ""
    );
    const confidence = override ? "high" : (translation?.confidence ?? "low");
    const issues = validateName(name.displayName, displayNameFr);
    return {
      displayName: name.displayName,
      category: name.category,
      entityCount: name.entityCount,
      targetLanguage: "fr",
      status: issues.length === 0 ? "accepted" : "review_needed",
      translation: {
        displayNameFr,
        confidence,
        note: override ? "known-override" : (translation?.note ?? ""),
        engine: "gemini",
        model
      },
      validation: { issues },
      generatedAt: new Date().toISOString()
    };
  });
}

function validateName(source: string, translated: string): string[] {
  const issues: string[] = [];
  if (!translated) issues.push("missing-display-name-fr");
  if (/jambon/i.test(translated)) issues.push("ham-translated-as-jambon");
  if (/^(travail|emploi|boulot)$/i.test(translated)) {
    issues.push("job-translated-as-work");
  }
  if (source.includes("_") && translated.includes("_")) {
    issues.push("untranslated-structural-underscore");
  }
  if (translated.length > Math.max(80, source.length * 4)) {
    issues.push("suspicious-long-name");
  }
  return issues;
}

function writeReviewNeeded(path: string, records: CandidateRecord[]): void {
  const reviewNeeded = records.filter(
    (record) => record.status === "review_needed"
  );
  writeJson(path, {
    generatedAt: new Date().toISOString(),
    count: reviewNeeded.length,
    entries: reviewNeeded.map((record) => ({
      displayName: record.displayName,
      category: record.category,
      displayNameFr: record.translation.displayNameFr,
      issues: record.validation.issues,
      entityCount: record.entityCount
    }))
  });
}

function buildSummary(input: {
  names: NameRow[];
  skippedExisting: number;
  batches: number;
  records: CandidateRecord[];
  outJsonl: string;
  reviewNeededJson: string;
  reportPath: string;
  dryRun: boolean;
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
    inputNames: input.names.length,
    skippedExisting: input.skippedExisting,
    batches: input.batches,
    records: input.records.length,
    accepted: input.records.filter((record) => record.status === "accepted")
      .length,
    reviewNeeded: input.records.filter(
      (record) => record.status === "review_needed"
    ).length,
    outputJsonl: input.outJsonl,
    reviewNeededJson: input.reviewNeededJson,
    reportPath: input.reportPath,
    issueCounts
  };
}

function renderReport(
  summary: Record<string, unknown>,
  records: CandidateRecord[]
): string {
  const issueRows =
    Object.entries((summary.issueCounts ?? {}) as Record<string, number>)
      .map(([issue, count]) => `| ${issue} | ${count} |`)
      .join("\n") || "| none | 0 |";
  const sampleRows =
    records
      .slice(0, 40)
      .map(
        (record) =>
          `| ${record.displayName} | ${record.category} | ${record.translation.displayNameFr} | ${record.translation.confidence} | ${record.status} | ${record.validation.issues.join(", ") || "none"} |`
      )
      .join("\n") || "| none | none | none | none | none | none |";
  return `# Entity Display Name FR Translation

Generated: ${summary.generatedAt}

Dry run: ${summary.dryRun ? "yes" : "no"}

## Summary

- Input names: ${summary.inputNames}
- Skipped existing: ${summary.skippedExisting}
- Batches: ${summary.batches}
- Records: ${summary.records}
- Accepted: ${summary.accepted}
- Review needed: ${summary.reviewNeeded}
- Output JSONL: \`${summary.outputJsonl}\`
- Review needed JSON: \`${summary.reviewNeededJson}\`

## Issue Counts

| Issue | Count |
| --- | ---: |
${issueRows}

## Samples

| Source | Category | FR | Confidence | Status | Issues |
| --- | --- | --- | --- | --- | --- |
${sampleRows}
`;
}

function readExistingKeys(path: string): Set<string> {
  if (!existsSync(path)) return new Set();
  return new Set(readJsonl(path).map((record) => nameKey(record)));
}

function readJsonl(path: string): CandidateRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as CandidateRecord);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function nameKey(input: { displayName: string; category: string }): string {
  return `${input.category}\t${input.displayName}`;
}

function normalizeName(value: string): string {
  return value.replace(/\s+/g, " ").trim();
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
