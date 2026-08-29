import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_BATCH_ROOT = "outputs/lexicon-greek-french-translation/batches";
const DEFAULT_REVIEW_ROOT = "outputs/lexicon-greek-french-translation/reviews";
const DEFAULT_TARGET_CHARACTERS = 12_000;

interface TranslationParent {
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishHtml: string;
}

interface Translation {
  schema: string;
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishHtml: string;
  frenchHtml: string;
  translator: string;
  reviewStatus: string;
}

interface BatchDescriptor {
  batchId: string;
  input: string;
}

interface BatchManifest {
  batches: BatchDescriptor[];
}

interface ValidationReport {
  totals: {
    batches: number;
    validatedBatches: number;
    missingBatches: number;
    invalidBatches: number;
  };
  validated: Array<{
    batchId: string;
    output: string;
  }>;
}

interface ReviewInput {
  schema: "greek-french-translation-review-input@1";
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishHtml: string;
  frenchHtml: string;
  translationHash: string;
  translator: string;
  sourceBatchId: string;
}

async function main(): Promise<void> {
  const rawArgs = process.argv.slice(2);
  const batchRoot = path.resolve(
    readArg(rawArgs, "batch-root") ?? DEFAULT_BATCH_ROOT
  );
  const reviewRoot = path.resolve(
    readArg(rawArgs, "review-root") ?? DEFAULT_REVIEW_ROOT
  );
  const targetCharacters = Number(
    readArg(rawArgs, "target-characters") ?? DEFAULT_TARGET_CHARACTERS
  );
  const force = rawArgs.includes("--force");

  if (existsSync(reviewRoot)) {
    if (!force) throw new Error(`output-exists:${reviewRoot}`);
    await rm(reviewRoot, { recursive: true, force: true });
  }

  const batchManifest = JSON.parse(
    await readFile(path.join(batchRoot, "manifest.json"), "utf8")
  ) as BatchManifest;
  const validation = JSON.parse(
    await readFile(path.join(batchRoot, "validation-report.json"), "utf8")
  ) as ValidationReport;
  if (
    validation.totals.validatedBatches !== validation.totals.batches ||
    validation.totals.missingBatches !== 0 ||
    validation.totals.invalidBatches !== 0
  ) {
    throw new Error("translations-not-complete-and-valid");
  }

  const batchById = new Map(
    batchManifest.batches.map((batch) => [batch.batchId, batch])
  );
  const reviewInputs: ReviewInput[] = [];
  for (const validated of validation.validated) {
    const batch = batchById.get(validated.batchId);
    if (!batch) throw new Error(`missing-batch:${validated.batchId}`);
    const [parents, translations] = await Promise.all([
      readJsonl<TranslationParent>(batch.input),
      readJsonl<Translation>(validated.output)
    ]);
    if (parents.length !== translations.length)
      throw new Error(`record-count-mismatch:${validated.batchId}`);
    for (let index = 0; index < parents.length; index += 1) {
      const parent = parents[index]!;
      const translation = translations[index]!;
      if (
        parent.parentHash !== translation.parentHash ||
        parent.englishHtml !== translation.englishHtml
      ) {
        throw new Error(
          `translation-parent-mismatch:${validated.batchId}:${index + 1}`
        );
      }
      reviewInputs.push({
        schema: "greek-french-translation-review-input@1",
        kind: parent.kind,
        parentHash: parent.parentHash,
        englishHtml: parent.englishHtml,
        frenchHtml: translation.frenchHtml,
        translationHash: sha256(translation.frenchHtml),
        translator: translation.translator,
        sourceBatchId: validated.batchId
      });
    }
  }

  const inputDirectory = path.join(reviewRoot, "input");
  const decisionsDirectory = path.join(reviewRoot, "decisions");
  await Promise.all([
    mkdir(inputDirectory, { recursive: true }),
    mkdir(decisionsDirectory, { recursive: true })
  ]);

  const descriptors: unknown[] = [];
  const byReviewer = new Map<string, ReviewInput[]>();
  for (const record of reviewInputs) {
    const reviewer = reviewerFor(record.translator);
    const records = byReviewer.get(reviewer);
    if (records) records.push(record);
    else byReviewer.set(reviewer, [record]);
  }
  for (const [reviewer, records] of [...byReviewer.entries()].sort()) {
    const batches = partitionByCharacters(records, targetCharacters);
    for (let index = 0; index < batches.length; index += 1) {
      const items = batches[index]!;
      const reviewId = `review-${reviewer}-${String(index + 1).padStart(3, "0")}`;
      const filePath = path.join(inputDirectory, `${reviewId}.jsonl`);
      await writeJsonl(filePath, items);
      descriptors.push({
        reviewId,
        reviewer,
        input: path.resolve(filePath),
        records: items.length,
        characters: items.reduce(
          (total, item) =>
            total + item.englishHtml.length + item.frenchHtml.length,
          0
        ),
        sourceTranslators: [...new Set(items.map((item) => item.translator))]
      });
    }
  }

  const manifest = {
    schema: "greek-french-translation-review-batches@1",
    status: "awaiting-reviews",
    batchManifest: path.resolve(path.join(batchRoot, "manifest.json")),
    translationValidation: path.resolve(
      path.join(batchRoot, "validation-report.json")
    ),
    records: reviewInputs.length,
    targetCharactersPerBatch: targetCharacters,
    decisionsDirectory: path.resolve(decisionsDirectory),
    batches: descriptors
  };
  await writeFile(
    path.join(reviewRoot, "manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`
  );
  console.log(
    JSON.stringify(
      {
        reviewRoot,
        records: reviewInputs.length,
        batches: descriptors.length
      },
      null,
      2
    )
  );
}

function reviewerFor(translator: string): string {
  const reviewers: Record<string, string> = {
    "agent-1": "agent-2",
    "agent-2": "agent-3",
    "agent-3": "agent-1"
  };
  const reviewer = reviewers[translator];
  if (!reviewer) throw new Error(`unknown-translator:${translator}`);
  return reviewer;
}

function partitionByCharacters(
  records: ReviewInput[],
  targetCharacters: number
): ReviewInput[][] {
  const batches: ReviewInput[][] = [];
  let current: ReviewInput[] = [];
  let characters = 0;
  for (const record of records) {
    const size = record.englishHtml.length + record.frenchHtml.length;
    if (current.length > 0 && characters + size > targetCharacters) {
      batches.push(current);
      current = [];
      characters = 0;
    }
    current.push(record);
    characters += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

async function readJsonl<T>(filePath: string): Promise<T[]> {
  return (await readFile(filePath, "utf8"))
    .split(/\r?\n/u)
    .filter(Boolean)
    .map((line) => JSON.parse(line) as T);
}

async function writeJsonl(filePath: string, records: unknown[]): Promise<void> {
  await writeFile(
    filePath,
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
