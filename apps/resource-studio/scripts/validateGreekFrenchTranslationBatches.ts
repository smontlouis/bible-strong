import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BATCH_ROOT = "outputs/lexicon-greek-french-translation/batches";

interface TranslationParent {
  schema: "greek-french-translation-parent@1";
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishText: string;
  englishHtml: string;
}

interface Translation {
  schema: string;
  kind: string;
  parentHash: string;
  englishHtml: string;
  frenchHtml: string;
  translator: string;
  reviewStatus: string;
}

interface BatchDescriptor {
  batchId: string;
  kind: "meaning" | "abbott_smith";
  input: string;
  records: number;
}

interface BatchManifest {
  schema: string;
  batches: BatchDescriptor[];
}

interface ValidationIssue {
  batchId: string;
  output: string | null;
  line: number | null;
  parentHash: string | null;
  code: string;
  detail?: string;
}

async function main(): Promise<void> {
  const batchRoot = path.resolve(
    readArg(process.argv.slice(2), "batch-root") ?? DEFAULT_BATCH_ROOT
  );
  const manifest = JSON.parse(
    await readFile(path.join(batchRoot, "manifest.json"), "utf8")
  ) as BatchManifest;
  if (manifest.schema !== "greek-french-translation-batches@1")
    throw new Error(`invalid-batch-manifest-schema:${manifest.schema}`);
  const translationDirectory = path.join(batchRoot, "translations");
  const outputNames = existsSync(translationDirectory)
    ? await readdir(translationDirectory)
    : [];
  const issues: ValidationIssue[] = [];
  const validated: Array<{
    batchId: string;
    output: string;
    inputSha256: string;
    outputSha256: string;
    records: number;
    translator: string;
  }> = [];
  const missing: string[] = [];

  for (const batch of manifest.batches) {
    const candidates = outputNames.filter((name) =>
      name.startsWith(`${batch.batchId}.fr.`)
    );
    if (candidates.length === 0) {
      missing.push(batch.batchId);
      continue;
    }
    if (candidates.length > 1) {
      issues.push({
        batchId: batch.batchId,
        output: null,
        line: null,
        parentHash: null,
        code: "multiple-translation-files",
        detail: candidates.join(",")
      });
      continue;
    }

    const outputName = candidates[0]!;
    const outputPath = path.join(translationDirectory, outputName);
    const parents = await readJsonl<TranslationParent>(batch.input);
    let translations: Translation[];
    try {
      translations = await readJsonl<Translation>(outputPath);
    } catch (error) {
      issues.push({
        batchId: batch.batchId,
        output: outputName,
        line: null,
        parentHash: null,
        code: "invalid-jsonl",
        detail: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    if (translations.length !== parents.length) {
      issues.push({
        batchId: batch.batchId,
        output: outputName,
        line: null,
        parentHash: null,
        code: "record-count-mismatch",
        detail: `expected=${parents.length};actual=${translations.length}`
      });
    }

    const length = Math.max(parents.length, translations.length);
    for (let index = 0; index < length; index += 1) {
      const parent = parents[index];
      const translation = translations[index];
      if (!parent || !translation) continue;
      validateRecord({
        batch,
        outputName,
        line: index + 1,
        parent,
        translation,
        issues
      });
    }

    if (!issues.some((issue) => issue.batchId === batch.batchId)) {
      validated.push({
        batchId: batch.batchId,
        output: path.resolve(outputPath),
        inputSha256: await sha256File(batch.input),
        outputSha256: await sha256File(outputPath),
        records: translations.length,
        translator: translations[0]?.translator ?? ""
      });
    }
  }

  const report = {
    schema: "greek-french-translation-validation@1",
    batchManifest: path.resolve(path.join(batchRoot, "manifest.json")),
    totals: {
      batches: manifest.batches.length,
      validatedBatches: validated.length,
      missingBatches: missing.length,
      invalidBatches: new Set(issues.map((issue) => issue.batchId)).size,
      validatedRecords: validated.reduce(
        (total, batch) => total + batch.records,
        0
      ),
      issues: issues.length
    },
    validated,
    missing,
    issues
  };
  const reportPath = path.join(batchRoot, "validation-report.json");
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report.totals, null, 2));
  if (issues.length > 0) process.exitCode = 1;
}

function validateRecord(input: {
  batch: BatchDescriptor;
  outputName: string;
  line: number;
  parent: TranslationParent;
  translation: Translation;
  issues: ValidationIssue[];
}): void {
  const { batch, outputName, line, parent, translation, issues } = input;
  const add = (code: string, detail?: string): void => {
    issues.push({
      batchId: batch.batchId,
      output: outputName,
      line,
      parentHash: parent.parentHash,
      code,
      detail
    });
  };

  if (translation.schema !== "greek-french-translation@1")
    add("invalid-schema");
  if (translation.kind !== parent.kind) add("kind-mismatch");
  if (translation.parentHash !== parent.parentHash) add("parent-hash-mismatch");
  if (translation.englishHtml !== parent.englishHtml)
    add("english-parent-mismatch");
  if (!translation.frenchHtml?.trim()) add("empty-french-html");
  if (!translation.translator?.trim()) add("missing-translator");
  if (translation.reviewStatus !== "translated") add("invalid-review-status");

  compareSequence(
    htmlTags(parent.englishHtml),
    htmlTags(translation.frenchHtml ?? ""),
    "html-tags-changed",
    add
  );
  compareSequence(
    protectedNumbers(parent.englishHtml),
    protectedNumbers(translation.frenchHtml ?? ""),
    "numbers-changed",
    add
  );
  compareSequence(
    protectedScripts(parent.englishHtml),
    protectedScripts(translation.frenchHtml ?? ""),
    "greek-or-hebrew-changed",
    add
  );
  compareSequence(
    strongCodes(parent.englishHtml),
    strongCodes(translation.frenchHtml ?? ""),
    "strong-codes-changed",
    add
  );
}

function compareSequence(
  expected: string[],
  actual: string[],
  code: string,
  add: (code: string, detail?: string) => void
): void {
  if (
    expected.length !== actual.length ||
    expected.some((value, index) => value !== actual[index])
  ) {
    add(
      code,
      `expected=${JSON.stringify(expected)};actual=${JSON.stringify(actual)}`
    );
  }
}

function htmlTags(value: string): string[] {
  return value.match(/<[^>]+>/gu) ?? [];
}

function protectedNumbers(value: string): string[] {
  return stripTags(value).match(/\d+(?:[.:,-]\d+)*/gu) ?? [];
}

function protectedScripts(value: string): string[] {
  return (
    stripTags(value).match(
      /(?:\p{Script=Greek}|\p{Script=Hebrew})[\p{Script=Greek}\p{Script=Hebrew}\p{M}\u2019\u02BC'-]*/gu
    ) ?? []
  );
}

function strongCodes(value: string): string[] {
  return stripTags(value).match(/\b[GH]\d{4,5}[A-Za-z]?\b/gu) ?? [];
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/gu, " ");
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  const lines = (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean);
  return lines.map((line, index) => {
    try {
      return JSON.parse(line) as T;
    } catch (error) {
      throw new Error(
        `${path.basename(filePath)}:${index + 1}:${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  });
}

async function sha256File(filePath: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(filePath))
    .digest("hex");
}

function readArg(rawArgs: string[], key: string): string | undefined {
  for (let index = 0; index < rawArgs.length; index += 1) {
    const argument = rawArgs[index]!;
    if (argument === `--${key}`) return rawArgs[index + 1];
    if (argument.startsWith(`--${key}=`)) return argument.slice(key.length + 3);
  }
  return undefined;
}

main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? (error.stack ?? error.message) : error
  );
  process.exitCode = 1;
});
