import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";

import { BOOK_IDS } from "./books.js";
import { type ReviewFile } from "./llmReview.js";

interface BatchOptions {
  bible: string;
  books: string[];
  concurrency: number;
  llmLimit: number;
  outputRoot: string;
  model: string;
  skipExisting: boolean;
  autoAccept: boolean;
  autoAcceptThreshold: number;
}

interface BookReviewResult {
  book: string;
  status: "completed" | "skipped" | "failed";
  outputDir: string;
  reviewPath: string;
  reviewHref: string;
  diagnosticsPath: string;
  metricsPath: string;
  itemCount: number;
  autoAcceptedCount: number;
  pendingCount: number;
  llmAttemptedVerseCount: number;
  llmAcceptedAssignmentCount: number;
  llmRejectedAssignmentCount: number;
  llmTotalTokenCount: number;
  error?: string;
}

interface BatchManifest {
  generatedAt: string;
  bible: string;
  outputRoot: string;
  concurrency: number;
  llmLimit: number;
  model: string;
  reviewCount: number;
  itemCount: number;
  autoAcceptedCount: number;
  pendingCount: number;
  failedCount: number;
  reviews: BookReviewResult[];
}

async function runBatch(options: BatchOptions): Promise<BatchManifest> {
  const outputRoot = path.join(options.outputRoot, options.bible);
  await mkdir(outputRoot, { recursive: true });

  const results = await runConcurrent(
    options.books,
    options.concurrency,
    (book) => runBookReview(options, book)
  );

  const manifest: BatchManifest = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    outputRoot,
    concurrency: options.concurrency,
    llmLimit: options.llmLimit,
    model: options.model,
    reviewCount: results.filter((result) => result.status !== "failed").length,
    itemCount: sum(results, "itemCount"),
    autoAcceptedCount: sum(results, "autoAcceptedCount"),
    pendingCount: sum(results, "pendingCount"),
    failedCount: results.filter((result) => result.status === "failed").length,
    reviews: results
  };

  const manifestPath = path.join(
    outputRoot,
    `llm-review-${options.bible}-manifest.json`
  );
  await writeFile(
    manifestPath,
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );

  return manifest;
}

async function runBookReview(
  options: BatchOptions,
  book: string
): Promise<BookReviewResult> {
  const outputDir = path.join(options.outputRoot, options.bible, book);
  const diagnosticsPath = path.join(
    outputDir,
    `bible-${options.bible}-strong-hybrid.hard-verses.json`
  );
  const metricsPath = path.join(
    outputDir,
    `bible-${options.bible}-strong-hybrid.metrics.json`
  );
  const reviewPath = path.join(
    outputDir,
    `llm-review-${options.bible}-${book}.json`
  );
  const reviewHref = `/${reviewPath}`;

  try {
    if (!options.skipExisting || !existsSync(reviewPath)) {
      console.log(`[${book}] generate LLM review inputs`);
      await runCommand("npm", [
        "run",
        "generate:strong:hybrid",
        "--",
        "--bible",
        options.bible,
        "--only",
        book,
        "--llm",
        "--llm-limit",
        String(options.llmLimit),
        "--output-dir",
        outputDir,
        "--model",
        options.model
      ]);

      console.log(`[${book}] prepare review`);
      await runCommand("npm", [
        "run",
        "review:llm",
        "--",
        "--bible",
        options.bible,
        "--diagnostics",
        diagnosticsPath,
        "--review",
        reviewPath,
        "--only",
        book,
        "--auto-accept",
        String(options.autoAccept),
        "--auto-accept-threshold",
        String(options.autoAcceptThreshold)
      ]);

      const review = readJson<ReviewFile>(reviewPath);
      const metrics = readJson<{
        llmAttemptedVerseCount?: number;
        llmAcceptedAssignmentCount?: number;
        llmRejectedAssignmentCount?: number;
        llmTotalTokenCount?: number;
      }>(metricsPath);

      return summarizeResult({
        book,
        status: "completed",
        outputDir,
        reviewPath,
        reviewHref,
        diagnosticsPath,
        metricsPath,
        review,
        metrics: {
          llmAttemptedVerseCount: metrics.llmAttemptedVerseCount ?? 0,
          llmAcceptedAssignmentCount: metrics.llmAcceptedAssignmentCount ?? 0,
          llmRejectedAssignmentCount: metrics.llmRejectedAssignmentCount ?? 0,
          llmTotalTokenCount: metrics.llmTotalTokenCount ?? 0
        }
      });
    }

    return summarizeExistingResult({
      book,
      outputDir,
      reviewPath,
      reviewHref,
      diagnosticsPath,
      metricsPath
    });
  } catch (error) {
    return {
      book,
      status: "failed",
      outputDir,
      reviewPath,
      reviewHref,
      diagnosticsPath,
      metricsPath,
      itemCount: 0,
      autoAcceptedCount: 0,
      pendingCount: 0,
      llmAttemptedVerseCount: 0,
      llmAcceptedAssignmentCount: 0,
      llmRejectedAssignmentCount: 0,
      llmTotalTokenCount: 0,
      error: error instanceof Error ? error.message : "unknown-error"
    };
  }
}

async function runCommand(command: string, args: string[]): Promise<void> {
  const result = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    output: string;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: process.env
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.stderr.on("data", (chunk: Buffer) => chunks.push(chunk));
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        output: Buffer.concat(chunks).toString("utf8")
      });
    });
  });

  if (result.code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${result.signal ?? result.code}: ${result.output.slice(-2000)}`
    );
  }
}

function summarizeResult(options: {
  book: string;
  status: "completed" | "skipped";
  outputDir: string;
  reviewPath: string;
  reviewHref: string;
  diagnosticsPath: string;
  metricsPath: string;
  review: ReviewFile;
  metrics: {
    llmAttemptedVerseCount: number;
    llmAcceptedAssignmentCount: number;
    llmRejectedAssignmentCount: number;
    llmTotalTokenCount: number;
  };
}): BookReviewResult {
  const autoAcceptedCount = options.review.items.filter(
    (item) => item.decision === "accept"
  ).length;
  const pendingCount = options.review.items.filter(
    (item) => item.decision === "pending"
  ).length;

  return {
    book: options.book,
    status: options.status,
    outputDir: options.outputDir,
    reviewPath: options.reviewPath,
    reviewHref: options.reviewHref,
    diagnosticsPath: options.diagnosticsPath,
    metricsPath: options.metricsPath,
    itemCount: options.review.items.length,
    autoAcceptedCount,
    pendingCount,
    llmAttemptedVerseCount: options.metrics.llmAttemptedVerseCount,
    llmAcceptedAssignmentCount: options.metrics.llmAcceptedAssignmentCount,
    llmRejectedAssignmentCount: options.metrics.llmRejectedAssignmentCount,
    llmTotalTokenCount: options.metrics.llmTotalTokenCount
  };
}

function summarizeExistingResult(options: {
  book: string;
  outputDir: string;
  reviewPath: string;
  reviewHref: string;
  diagnosticsPath: string;
  metricsPath: string;
}): BookReviewResult {
  const review = readJson<ReviewFile>(options.reviewPath);
  const metrics = readJson<{
    llmAttemptedVerseCount?: number;
    llmAcceptedAssignmentCount?: number;
    llmRejectedAssignmentCount?: number;
    llmTotalTokenCount?: number;
  }>(options.metricsPath);
  return summarizeResult({
    ...options,
    status: "skipped",
    review,
    metrics: {
      llmAttemptedVerseCount: metrics.llmAttemptedVerseCount ?? 0,
      llmAcceptedAssignmentCount: metrics.llmAcceptedAssignmentCount ?? 0,
      llmRejectedAssignmentCount: metrics.llmRejectedAssignmentCount ?? 0,
      llmTotalTokenCount: metrics.llmTotalTokenCount ?? 0
    }
  });
}

async function runConcurrent<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let nextIndex = 0;
  const workerCount = Math.min(Math.max(1, concurrency), items.length);

  await Promise.all(
    Array.from({ length: workerCount }, async () => {
      while (nextIndex < items.length) {
        const index = nextIndex;
        nextIndex += 1;
        const item = items[index];
        if (item === undefined) continue;
        results[index] = await worker(item);
      }
    })
  );

  return results;
}

function sum(items: BookReviewResult[], key: keyof BookReviewResult): number {
  return items.reduce((total, item) => total + Number(item[key] ?? 0), 0);
}

function parseCliOptions(argv: string[]): BatchOptions {
  const args = new Map<string, string>();
  const flags = new Set<string>();

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    if (!key) continue;
    if (inlineValue !== undefined) {
      args.set(key, inlineValue);
    } else if (argv[index + 1] && !argv[index + 1]?.startsWith("--")) {
      args.set(key, argv[index + 1] ?? "");
      index += 1;
    } else {
      flags.add(key);
    }
  }

  const bible = (args.get("bible") ?? "nbs").toLowerCase();
  return {
    bible,
    books: parseBooks(args.get("books") ?? "all"),
    concurrency: Number.parseInt(args.get("concurrency") ?? "2", 10),
    llmLimit: Number.parseInt(args.get("llm-limit") ?? "25", 10),
    outputRoot: args.get("output-root") ?? "outputs/llm-books",
    model:
      args.get("model") ??
      process.env.AI_GATEWAY_MODEL ??
      "anthropic/claude-sonnet-4.6",
    skipExisting:
      flags.has("skip-existing") || args.get("skip-existing") === "true",
    autoAccept: args.get("auto-accept") !== "false",
    autoAcceptThreshold: Number.parseFloat(
      args.get("auto-accept-threshold") ?? "0.84"
    )
  };
}

function parseBooks(value: string): string[] {
  if (value === "all") return [...BOOK_IDS];
  const books = value
    .split(",")
    .map((book) => book.trim())
    .filter(Boolean);
  const unknown = books.filter(
    (book) => !BOOK_IDS.includes(book as (typeof BOOK_IDS)[number])
  );
  if (unknown.length > 0) {
    throw new Error(`Unknown book id(s): ${unknown.join(", ")}`);
  }
  return books;
}

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const options = parseCliOptions(process.argv.slice(2));
  const manifest = await runBatch(options);
  const manifestPath = path.join(
    options.outputRoot,
    options.bible,
    `llm-review-${options.bible}-manifest.json`
  );

  console.log(`Prepared ${manifest.reviewCount} review file(s).`);
  console.log(
    `Items: ${manifest.itemCount}; auto-accepted: ${manifest.autoAcceptedCount}; pending: ${manifest.pendingCount}; failed: ${manifest.failedCount}`
  );
  console.log(`Manifest: ${manifestPath}`);
  console.log(
    `Viewer: http://localhost:4173/viewer/review.html?manifest=/${manifestPath}`
  );
}
