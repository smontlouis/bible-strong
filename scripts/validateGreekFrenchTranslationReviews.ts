import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const DEFAULT_REVIEW_ROOT = "outputs/lexicon-greek-french-translation/reviews";

interface ReviewInput {
  kind: "meaning" | "abbott_smith";
  parentHash: string;
  englishHtml: string;
  frenchHtml: string;
  translationHash: string;
  translator: string;
}

interface ReviewDecision {
  schema: string;
  parentHash: string;
  translationHash: string;
  status: "approved" | "corrected";
  correctedFrenchHtml: string;
  reviewer: string;
  notes: string;
}

interface ReviewBatch {
  reviewId: string;
  reviewer: string;
  input: string;
  records: number;
}

interface ReviewManifest {
  schema: string;
  batches: ReviewBatch[];
}

interface ReviewIssue {
  reviewId: string;
  output: string | null;
  line: number | null;
  parentHash: string | null;
  code: string;
  detail?: string;
}

async function main(): Promise<void> {
  const reviewRoot = path.resolve(
    readArg(process.argv.slice(2), "review-root") ?? DEFAULT_REVIEW_ROOT
  );
  const manifest = JSON.parse(
    await readFile(path.join(reviewRoot, "manifest.json"), "utf8")
  ) as ReviewManifest;
  if (manifest.schema !== "greek-french-translation-review-batches@1")
    throw new Error(`invalid-review-manifest-schema:${manifest.schema}`);
  const decisionDirectory = path.join(reviewRoot, "decisions");
  const outputNames = existsSync(decisionDirectory)
    ? await readdir(decisionDirectory)
    : [];
  const issues: ReviewIssue[] = [];
  const missing: string[] = [];
  const validated: Array<{
    reviewId: string;
    output: string;
    inputSha256: string;
    outputSha256: string;
    records: number;
    approved: number;
    corrected: number;
    reviewer: string;
  }> = [];

  for (const batch of manifest.batches) {
    const candidates = outputNames.filter((name) =>
      name.startsWith(`${batch.reviewId}.decisions.`)
    );
    if (candidates.length === 0) {
      missing.push(batch.reviewId);
      continue;
    }
    if (candidates.length > 1) {
      issues.push({
        reviewId: batch.reviewId,
        output: null,
        line: null,
        parentHash: null,
        code: "multiple-decision-files",
        detail: candidates.join(",")
      });
      continue;
    }

    const outputName = candidates[0]!;
    const outputPath = path.join(decisionDirectory, outputName);
    const inputs = await readJsonl<ReviewInput>(batch.input);
    let decisions: ReviewDecision[];
    try {
      decisions = await readJsonl<ReviewDecision>(outputPath);
    } catch (error) {
      issues.push({
        reviewId: batch.reviewId,
        output: outputName,
        line: null,
        parentHash: null,
        code: "invalid-jsonl",
        detail: error instanceof Error ? error.message : String(error)
      });
      continue;
    }

    if (decisions.length !== inputs.length) {
      issues.push({
        reviewId: batch.reviewId,
        output: outputName,
        line: null,
        parentHash: null,
        code: "record-count-mismatch",
        detail: `expected=${inputs.length};actual=${decisions.length}`
      });
    }
    for (
      let index = 0;
      index < Math.max(inputs.length, decisions.length);
      index += 1
    ) {
      const input = inputs[index];
      const decision = decisions[index];
      if (!input || !decision) continue;
      validateDecision({
        batch,
        outputName,
        line: index + 1,
        input,
        decision,
        issues
      });
    }

    if (!issues.some((issue) => issue.reviewId === batch.reviewId)) {
      validated.push({
        reviewId: batch.reviewId,
        output: path.resolve(outputPath),
        inputSha256: await sha256File(batch.input),
        outputSha256: await sha256File(outputPath),
        records: decisions.length,
        approved: decisions.filter((item) => item.status === "approved").length,
        corrected: decisions.filter((item) => item.status === "corrected")
          .length,
        reviewer: batch.reviewer
      });
    }
  }

  const report = {
    schema: "greek-french-translation-review-validation@1",
    reviewManifest: path.resolve(path.join(reviewRoot, "manifest.json")),
    totals: {
      batches: manifest.batches.length,
      validatedBatches: validated.length,
      missingBatches: missing.length,
      invalidBatches: new Set(issues.map((issue) => issue.reviewId)).size,
      validatedRecords: validated.reduce(
        (total, batch) => total + batch.records,
        0
      ),
      approved: validated.reduce((total, batch) => total + batch.approved, 0),
      corrected: validated.reduce((total, batch) => total + batch.corrected, 0),
      issues: issues.length
    },
    validated,
    missing,
    issues
  };
  await writeFile(
    path.join(reviewRoot, "validation-report.json"),
    `${JSON.stringify(report, null, 2)}\n`
  );
  console.log(JSON.stringify(report.totals, null, 2));
  if (issues.length > 0) process.exitCode = 1;
}

function validateDecision(input: {
  batch: ReviewBatch;
  outputName: string;
  line: number;
  input: ReviewInput;
  decision: ReviewDecision;
  issues: ReviewIssue[];
}): void {
  const { batch, outputName, line, decision, issues } = input;
  const reviewInput = input.input;
  const add = (code: string, detail?: string): void => {
    issues.push({
      reviewId: batch.reviewId,
      output: outputName,
      line,
      parentHash: reviewInput.parentHash,
      code,
      detail
    });
  };
  if (decision.schema !== "greek-french-translation-review@1")
    add("invalid-schema");
  if (decision.parentHash !== reviewInput.parentHash)
    add("parent-hash-mismatch");
  if (decision.translationHash !== reviewInput.translationHash)
    add("translation-hash-mismatch");
  if (decision.reviewer !== batch.reviewer) add("reviewer-mismatch");
  if (decision.reviewer === reviewInput.translator)
    add("reviewer-is-translator");
  if (!["approved", "corrected"].includes(decision.status))
    add("invalid-status");

  if (decision.status === "approved") {
    if (decision.correctedFrenchHtml !== "") add("approved-has-corrected-html");
    return;
  }
  if (!decision.correctedFrenchHtml?.trim()) {
    add("corrected-html-empty");
    return;
  }
  compareSequence(
    htmlTags(reviewInput.englishHtml),
    htmlTags(decision.correctedFrenchHtml),
    "corrected-html-tags-changed",
    add
  );
  compareSequence(
    protectedNumbers(reviewInput.englishHtml),
    protectedNumbers(decision.correctedFrenchHtml),
    "corrected-numbers-changed",
    add
  );
  compareSequence(
    protectedScripts(reviewInput.englishHtml),
    protectedScripts(decision.correctedFrenchHtml),
    "corrected-greek-or-hebrew-changed",
    add
  );
  compareSequence(
    strongCodes(reviewInput.englishHtml),
    strongCodes(decision.correctedFrenchHtml),
    "corrected-strong-codes-changed",
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
