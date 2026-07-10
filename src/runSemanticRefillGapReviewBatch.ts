import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

import { BOOK_IDS } from "./books.js";

type CandidateConfidence = "high" | "medium" | "low";

interface LexicalCandidate {
  target: "word" | "phrase";
  confidence: CandidateConfidence;
  occupied: boolean;
}

interface LexicalCandidateItem {
  ref: string;
  strong: string;
  auditKind: "empty" | "relocation";
  candidates: LexicalCandidate[];
}

interface LexicalCandidateReport {
  bible: string;
  metrics?: {
    autoSafeItems?: number;
    groupAutoSafeItems?: number;
    openHighItems?: number;
    reviewableCandidates?: number;
  };
  items: LexicalCandidateItem[];
}

interface AgentPacketFile {
  bible: string;
  scope: string;
  summary?: {
    selectedItems?: number;
    candidates?: number;
    verses?: number;
  };
  candidates: Array<{ id: string; ref: string; strong: string }>;
}

interface AgentReviewFile {
  decisions?: unknown[];
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

interface ValidationSummary {
  accepted: number;
  pending: number;
  rejected: number;
}

interface FilterReport {
  counts: {
    input: number;
    acceptedSafe: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
}

interface BatchTask {
  id: string;
  scope: string;
  book: string;
  chapters: string[];
  itemCount: number;
}

interface TaskResult {
  id: string;
  scope: string;
  status: "completed" | "skipped" | "failed";
  packetPath: string;
  candidateCount: number;
  consensusCount: number;
  acceptedSafe: number;
  needsWitnessReview: number;
  rejectedRisky: number;
  applied: number;
  error?: string;
}

interface BatchManifest {
  generatedAt: string;
  bible: string;
  lexicalReport: string;
  outputRoot: string;
  policy: {
    minConfidence: CandidateConfidence;
    maxItemsPerTask: number;
    taskBatchSize: number;
    llmAttempts: number;
    models: string[];
  };
  lexicalMetrics?: LexicalCandidateReport["metrics"];
  totals: {
    tasks: number;
    completed: number;
    skipped: number;
    failed: number;
    candidates: number;
    consensus: number;
    acceptedSafe: number;
    applied: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
  tasks: TaskResult[];
}

interface CliOptions {
  bible: string;
  lexicalReportPath: string;
  outputRoot: string;
  maxItemsPerTask: number;
  taskBatchSize: number;
  minConfidence: CandidateConfidence;
  leftModel: string;
  rightModel: string;
  timeoutMs: number;
  llmAttempts: number;
  skipExisting: boolean;
  dryRun: boolean;
  planOnly: boolean;
  allowResidualAutoSafe: boolean;
}

const DEFAULT_LEFT_MODEL = "openai/gpt-5.4-mini";
const DEFAULT_RIGHT_MODEL = "deepseek/deepseek-v4-flash";
const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((book, index) => [book, index])
);
let serializedCommandChain: Promise<void> = Promise.resolve();

async function runBatch(options: CliOptions): Promise<BatchManifest> {
  const report = await readJson<LexicalCandidateReport>(
    options.lexicalReportPath
  );
  const autoSafeItems =
    (report.metrics?.autoSafeItems ?? 0) +
    (report.metrics?.groupAutoSafeItems ?? 0);
  if (autoSafeItems > 0 && !options.allowResidualAutoSafe) {
    throw new Error(
      `residual-autosafe-items:${autoSafeItems}. Run strong:generate before LLM batch.`
    );
  }

  await mkdir(options.outputRoot, { recursive: true });
  const tasks = buildTasks(report, options);
  const previousResults = options.skipExisting
    ? (readExistingManifest(options.outputRoot)?.tasks ?? [])
    : [];
  const results: TaskResult[] = [];
  const tasksById = new Map(tasks.map((task) => [task.id, task]));
  const previousById = new Map(
    previousResults
      .filter((item) => {
        if (item.status !== "completed") return false;
        const task = tasksById.get(item.id);
        return task ? previousResultIsReusable(task, item, options) : false;
      })
      .map((item) => [item.id, item])
  );

  if (options.planOnly) {
    return writeManifest(options, report, tasks, []);
  }

  for (const taskBatch of chunk(tasks, options.taskBatchSize)) {
    const activeTasks = taskBatch.filter((task) => {
      const previous = previousById.get(task.id);
      if (!previous) return true;
      results.push(previous);
      return false;
    });
    if (activeTasks.length === 0) {
      await writeManifest(options, report, tasks, results);
      continue;
    }

    const prepared = await Promise.all(
      activeTasks.map((task) => prepareFilteredReview(task, options))
    );
    for (const item of prepared) {
      const result = item.ok
        ? await applyFilteredReview(item.task, item.artifacts, options)
        : item.result;
      results.push(result);
      await writeManifest(options, report, tasks, results);
    }
  }

  return writeManifest(options, report, tasks, results);
}

function buildTasks(
  report: LexicalCandidateReport,
  options: CliOptions
): BatchTask[] {
  const byChapter = new Map<string, LexicalCandidateItem[]>();
  for (const item of report.items) {
    if (!hasOpenCandidateAtConfidence(item, options.minConfidence)) continue;
    const parsed = parseRef(item.ref);
    if (!parsed) continue;
    const key = `${parsed.book}.${parsed.chapter}`;
    byChapter.set(key, [...(byChapter.get(key) ?? []), item]);
  }

  const chapters = [...byChapter.entries()].sort(([left], [right]) =>
    compareScope(left, right)
  );
  const byBook = new Map<string, Array<[string, LexicalCandidateItem[]]>>();
  for (const [scope, items] of chapters) {
    const parsed = parseScope(scope);
    if (!parsed) continue;
    byBook.set(parsed.book, [
      ...(byBook.get(parsed.book) ?? []),
      [scope, items]
    ]);
  }

  const tasks: BatchTask[] = [];
  for (const book of BOOK_IDS) {
    const bookChapters = byBook.get(book) ?? [];
    let current: Array<[string, LexicalCandidateItem[]]> = [];
    let count = 0;
    const flush = (): void => {
      if (current.length === 0) return;
      const scopes = current.map(([scope]) => scope);
      const itemCount = current.reduce(
        (sum, [, items]) => sum + items.length,
        0
      );
      const scope = scopes.join(",");
      tasks.push({
        id: `${book}-${tasks.length + 1}-${scopeHash(scope)}`,
        scope,
        book,
        chapters: scopes,
        itemCount
      });
      current = [];
      count = 0;
    };

    for (const chapter of bookChapters) {
      const chapterCount = chapter[1].length;
      if (
        current.length > 0 &&
        count + chapterCount > options.maxItemsPerTask
      ) {
        flush();
      }
      current.push(chapter);
      count += chapterCount;
    }
    flush();
  }

  return tasks;
}

function hasOpenCandidateAtConfidence(
  item: LexicalCandidateItem,
  minConfidence: CandidateConfidence
): boolean {
  return item.candidates.some(
    (candidate) =>
      confidenceRank(candidate.confidence) >= confidenceRank(minConfidence) &&
      !candidate.occupied
  );
}

async function prepareFilteredReview(
  task: BatchTask,
  options: CliOptions
): Promise<
  | {
      ok: true;
      task: BatchTask;
      artifacts: ReturnType<typeof artifactPaths>;
    }
  | { ok: false; result: TaskResult }
> {
  const artifacts = artifactPaths(task, options);
  try {
    await mkdir(path.dirname(artifacts.packet), { recursive: true });
    await mkdir(path.dirname(artifacts.leftReview), { recursive: true });
    await mkdir(path.dirname(artifacts.filterReportJson), { recursive: true });

    if (!options.skipExisting || !existsSync(artifacts.packet)) {
      await runSerialized(() =>
        runNpm(
          [
            "run",
            "strong:review:gaps:lexical-packet",
            "--",
            "--bible",
            options.bible,
            "--only",
            task.scope,
            "--lexical-report",
            options.lexicalReportPath,
            "--output",
            artifacts.packet,
            "--limit",
            String(options.maxItemsPerTask),
            "--min-confidence",
            options.minConfidence
          ],
          options
        )
      );
    }

    const packet = await readJson<AgentPacketFile>(artifacts.packet);
    if (packet.candidates.length === 0) {
      return {
        ok: false,
        result: emptyResult(task, artifacts.packet, "skipped", "empty-packet")
      };
    }

    await Promise.all([
      runLlmIfNeeded({
        input: artifacts.packet,
        output: artifacts.leftReview,
        model: options.leftModel,
        options
      }),
      runLlmIfNeeded({
        input: artifacts.packet,
        output: artifacts.rightReview,
        model: options.rightModel,
        options
      })
    ]);

    await validateIfNeeded({
      input: artifacts.leftReview,
      outputDir: artifacts.leftValidation,
      options,
      referenceStyle: true
    });
    await validateIfNeeded({
      input: artifacts.rightReview,
      outputDir: artifacts.rightValidation,
      options,
      referenceStyle: true
    });

    if (
      !options.skipExisting ||
      !fileIsFresh(artifacts.consensusReview, [
        artifacts.leftReview,
        artifacts.rightReview
      ])
    ) {
      await runNpm(
        [
          "run",
          "strong:review:gaps:consensus",
          "--",
          "--left-review",
          artifacts.leftReview,
          "--right-review",
          artifacts.rightReview,
          "--left-validation-dir",
          artifacts.leftValidation,
          "--right-validation-dir",
          artifacts.rightValidation,
          "--output",
          artifacts.consensusReview,
          "--min-confidence",
          "0.84"
        ],
        options
      );
    }

    if (
      !options.skipExisting ||
      !fileIsFresh(artifacts.filteredReview, [artifacts.consensusReview])
    ) {
      await runNpm(
        [
          "run",
          "strong:review:gaps:filter",
          "--",
          "--review",
          artifacts.consensusReview,
          "--output",
          artifacts.filteredReview,
          "--report-json",
          artifacts.filterReportJson,
          "--report-md",
          artifacts.filterReportMd
        ],
        options
      );
    }

    await validateIfNeeded({
      input: artifacts.filteredReview,
      outputDir: artifacts.filteredValidation,
      options,
      referenceStyle: false
    });

    return { ok: true, task, artifacts };
  } catch (error) {
    return {
      ok: false,
      result: emptyResult(
        task,
        artifacts.packet,
        "failed",
        error instanceof Error ? error.message : "unknown-error"
      )
    };
  }
}

async function applyFilteredReview(
  task: BatchTask,
  artifacts: ReturnType<typeof artifactPaths>,
  options: CliOptions
): Promise<TaskResult> {
  const packet = await readJson<AgentPacketFile>(artifacts.packet);
  const consensus = await readJson<AgentReviewFile>(artifacts.consensusReview);
  const filterReport = await readJson<FilterReport>(artifacts.filterReportJson);
  const validation = await validationSummary(artifacts.filteredValidation);

  if (options.dryRun || validation.accepted === 0) {
    return {
      id: task.id,
      scope: task.scope,
      status: "completed",
      packetPath: artifacts.packet,
      candidateCount: packet.candidates.length,
      consensusCount: consensus.decisions?.length ?? 0,
      acceptedSafe: filterReport.counts.acceptedSafe,
      needsWitnessReview: filterReport.counts.needsWitnessReview,
      rejectedRisky: filterReport.counts.rejectedRisky,
      applied: 0
    };
  }

  await mkdir(path.dirname(artifacts.beforeMetrics), { recursive: true });
  await copyFile(
    `outputs/strong/${options.bible}/bible-${options.bible}-strong-metrics.json`,
    artifacts.beforeMetrics
  );

  if (
    !options.skipExisting ||
    !validationOutputIsFresh(artifacts.filteredReview, artifacts.appliedDir)
  ) {
    await runNpm(
      [
        "run",
        "strong:review:gaps:apply",
        "--",
        "--bible",
        options.bible,
        "--input",
        artifacts.filteredReview,
        "--output-dir",
        artifacts.appliedDir,
        "--apply"
      ],
      options
    );
  }

  const applied = await validationSummary(artifacts.appliedDir);

  await runNpm(
    [
      "run",
      "strong:refresh",
      "--",
      "--bible",
      options.bible,
      "--only",
      task.scope
    ],
    options
  );

  await runNpm(
    [
      "run",
      "strong:review:gaps:report",
      "--",
      "--packet",
      artifacts.packet,
      "--review",
      artifacts.filteredReview,
      "--validation-dir",
      artifacts.filteredValidation,
      "--applied-dir",
      artifacts.appliedDir,
      "--before-metrics",
      artifacts.beforeMetrics,
      "--after-metrics",
      `outputs/strong/${options.bible}/bible-${options.bible}-strong-metrics.json`,
      "--metrics-scope",
      task.scope,
      "--output-json",
      artifacts.benchmarkJson,
      "--output-md",
      artifacts.benchmarkMd
    ],
    options
  );

  return {
    id: task.id,
    scope: task.scope,
    status: "completed",
    packetPath: artifacts.packet,
    candidateCount: packet.candidates.length,
    consensusCount: consensus.decisions?.length ?? 0,
    acceptedSafe: filterReport.counts.acceptedSafe,
    needsWitnessReview: filterReport.counts.needsWitnessReview,
    rejectedRisky: filterReport.counts.rejectedRisky,
    applied: applied.accepted
  };
}

async function runLlmIfNeeded(options: {
  input: string;
  output: string;
  model: string;
  options: CliOptions;
}): Promise<void> {
  if (options.options.skipExisting && reviewFileIsUsable(options.output))
    return;
  for (let attempt = 1; attempt <= options.options.llmAttempts; attempt += 1) {
    let runError: unknown;
    try {
      await runNpm(
        [
          "run",
          "strong:review:gaps:llm",
          "--",
          "--input",
          options.input,
          "--output",
          options.output,
          "--model",
          options.model
        ],
        options.options
      );
    } catch (error) {
      runError = error;
    }

    if (reviewFileIsUsable(options.output)) {
      return;
    }

    if (attempt >= options.options.llmAttempts) {
      if (runError) throw runError;
      throw new Error(
        `unusable-llm-output:${options.model}:${path.basename(options.output)}`
      );
    }

    const message =
      runError instanceof Error ? runError.message : String(runError);
    console.error(
      `LLM attempt ${attempt}/${options.options.llmAttempts} produced unusable output for ${options.model} on ${path.basename(options.input)}; retrying: ${message.slice(-500)}`
    );
    await sleep(5000);
  }
}

async function validateIfNeeded(options: {
  input: string;
  outputDir: string;
  options: CliOptions;
  referenceStyle: boolean;
}): Promise<void> {
  if (
    options.options.skipExisting &&
    validationOutputIsFresh(options.input, options.outputDir)
  ) {
    return;
  }
  const args = [
    "run",
    "strong:review:gaps:apply",
    "--",
    "--bible",
    options.options.bible,
    "--input",
    options.input,
    "--output-dir",
    options.outputDir
  ];
  if (options.referenceStyle) args.push("--finalize-reference-style");
  await runSerialized(() => runNpm(args, options.options));
}

function artifactPaths(task: BatchTask, options: CliOptions) {
  const slug = `${sanitize(task.scope).slice(0, 90)}-${scopeHash(task.scope)}`;
  const packet = path.join(
    options.outputRoot,
    "agent-packets",
    `agent-packet-${options.bible}-${slug}.json`
  );
  const reviewRoot = path.join(options.outputRoot, "agent-review");
  const reportRoot = path.join(options.outputRoot, "reports");
  const baselineRoot = path.join(options.outputRoot, "baseline");
  const base = `llm-review-${options.bible}-${slug}`;
  const left = `${base}-${modelSlug(options.leftModel)}`;
  const right = `${base}-${modelSlug(options.rightModel)}`;
  const consensus = `${base}-consensus-visible-high`;
  const filtered = `${consensus}-auto-filtered`;
  return {
    packet,
    leftReview: path.join(reviewRoot, `${left}.json`),
    rightReview: path.join(reviewRoot, `${right}.json`),
    leftValidation: path.join(reviewRoot, `${left}-validated`),
    rightValidation: path.join(reviewRoot, `${right}-validated`),
    consensusReview: path.join(reviewRoot, `${consensus}.json`),
    filteredReview: path.join(reviewRoot, `${filtered}.json`),
    filterReportJson: path.join(reportRoot, `${filtered}-filter.json`),
    filterReportMd: path.join(reportRoot, `${filtered}-filter.md`),
    filteredValidation: path.join(
      reviewRoot,
      `${filtered}-validated-visible-only`
    ),
    appliedDir: path.join(reviewRoot, `${filtered}-applied`),
    beforeMetrics: path.join(
      baselineRoot,
      `bible-${options.bible}-strong-metrics-before-${slug}.json`
    ),
    benchmarkJson: path.join(reportRoot, `${filtered}-applied.json`),
    benchmarkMd: path.join(reportRoot, `${filtered}-applied.md`)
  };
}

async function writeManifest(
  options: CliOptions,
  report: LexicalCandidateReport,
  tasks: BatchTask[],
  results: TaskResult[]
): Promise<BatchManifest> {
  const manifest: BatchManifest = {
    generatedAt: new Date().toISOString(),
    bible: options.bible,
    lexicalReport: options.lexicalReportPath,
    outputRoot: options.outputRoot,
    policy: {
      minConfidence: options.minConfidence,
      maxItemsPerTask: options.maxItemsPerTask,
      taskBatchSize: options.taskBatchSize,
      llmAttempts: options.llmAttempts,
      models: [options.leftModel, options.rightModel]
    },
    lexicalMetrics: report.metrics,
    totals: summarizeResults(tasks, results),
    tasks: results
  };
  await writeJson(path.join(options.outputRoot, "manifest.json"), manifest);
  return manifest;
}

function summarizeResults(
  tasks: BatchTask[],
  results: TaskResult[]
): BatchManifest["totals"] {
  return {
    tasks: tasks.length,
    completed: results.filter((item) => item.status === "completed").length,
    skipped: results.filter((item) => item.status === "skipped").length,
    failed: results.filter((item) => item.status === "failed").length,
    candidates: sum(results, "candidateCount"),
    consensus: sum(results, "consensusCount"),
    acceptedSafe: sum(results, "acceptedSafe"),
    applied: sum(results, "applied"),
    needsWitnessReview: sum(results, "needsWitnessReview"),
    rejectedRisky: sum(results, "rejectedRisky")
  };
}

function emptyResult(
  task: BatchTask,
  packetPath: string,
  status: TaskResult["status"],
  error?: string
): TaskResult {
  return {
    id: task.id,
    scope: task.scope,
    status,
    packetPath,
    candidateCount: 0,
    consensusCount: 0,
    acceptedSafe: 0,
    needsWitnessReview: 0,
    rejectedRisky: 0,
    applied: 0,
    error
  };
}

async function validationSummary(
  outputDir: string
): Promise<ValidationSummary> {
  const [accepted, pending, rejected] = await Promise.all([
    readJson<unknown[]>(path.join(outputDir, "accepted.json")),
    readJson<unknown[]>(path.join(outputDir, "pending.json")),
    readJson<unknown[]>(path.join(outputDir, "rejected.json"))
  ]);
  return {
    accepted: accepted.length,
    pending: pending.length,
    rejected: rejected.length
  };
}

async function runNpm(args: string[], options: CliOptions): Promise<string> {
  return runCommand("npm", args, {
    ...process.env,
    ...readDotEnv(".env"),
    AI_GATEWAY_TIMEOUT_MS: String(options.timeoutMs)
  });
}

async function runSerialized<T>(operation: () => Promise<T>): Promise<T> {
  const previous = serializedCommandChain;
  let release!: () => void;
  serializedCommandChain = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}

async function runCommand(
  command: string,
  args: string[],
  env: NodeJS.ProcessEnv
): Promise<string> {
  const output = await new Promise<{
    code: number | null;
    signal: NodeJS.Signals | null;
    text: string;
  }>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env
    });
    const chunks: Buffer[] = [];
    child.stdout.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stdout.write(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("close", (code, signal) => {
      resolve({
        code,
        signal,
        text: Buffer.concat(chunks).toString("utf8")
      });
    });
  });

  if (output.code !== 0) {
    throw new Error(
      `${command} ${args.join(" ")} failed with ${
        output.signal ?? output.code
      }: ${output.text.slice(-2000)}`
    );
  }
  return output.text;
}

function readDotEnv(filePath: string): NodeJS.ProcessEnv {
  if (!existsSync(filePath)) return {};
  const env: NodeJS.ProcessEnv = {};
  const text = readFileSyncUtf8(filePath);
  for (const line of text.split(/\r?\n/u)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index <= 0) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed
      .slice(index + 1)
      .trim()
      .replace(/^["']|["']$/gu, "");
    env[key] = value;
  }
  return env;
}

function readExistingManifest(outputRoot: string): BatchManifest | undefined {
  const manifestPath = path.join(outputRoot, "manifest.json");
  if (!existsSync(manifestPath)) return undefined;
  return JSON.parse(readFileSync(manifestPath, "utf8")) as BatchManifest;
}

function previousResultIsReusable(
  task: BatchTask,
  result: TaskResult,
  options: CliOptions
): boolean {
  const artifacts = artifactPaths(task, options);
  if (!reviewFileIsUsable(artifacts.leftReview)) return false;
  if (!reviewFileIsUsable(artifacts.rightReview)) return false;
  if (
    !fileIsFresh(artifacts.consensusReview, [
      artifacts.leftReview,
      artifacts.rightReview
    ])
  ) {
    return false;
  }
  if (!fileIsFresh(artifacts.filteredReview, [artifacts.consensusReview])) {
    return false;
  }
  if (
    !validationOutputIsFresh(
      artifacts.filteredReview,
      artifacts.filteredValidation
    )
  ) {
    return false;
  }
  if (result.acceptedSafe > 0) {
    if (
      !validationOutputIsFresh(artifacts.filteredReview, artifacts.appliedDir)
    ) {
      return false;
    }
    if (!existsSync(artifacts.benchmarkJson)) return false;
  }
  return true;
}

function reviewFileIsUsable(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const review = JSON.parse(
      readFileSync(filePath, "utf8")
    ) as AgentReviewFile & {
      parseError?: unknown;
    };
    return Array.isArray(review.decisions) && !review.parseError;
  } catch {
    return false;
  }
}

function validationOutputIsComplete(outputDir: string): boolean {
  return (
    existsSync(path.join(outputDir, "accepted.json")) &&
    existsSync(path.join(outputDir, "pending.json")) &&
    existsSync(path.join(outputDir, "rejected.json"))
  );
}

function validationOutputIsFresh(
  inputPath: string,
  outputDir: string
): boolean {
  if (!validationOutputIsComplete(outputDir)) return false;
  return ["accepted.json", "pending.json", "rejected.json"].every((fileName) =>
    fileIsFresh(path.join(outputDir, fileName), [inputPath])
  );
}

function fileIsFresh(outputPath: string, inputPaths: string[]): boolean {
  if (!existsSync(outputPath)) return false;
  try {
    const outputMtime = statSync(outputPath).mtimeMs;
    return inputPaths.every(
      (inputPath) =>
        existsSync(inputPath) && statSync(inputPath).mtimeMs <= outputMtime
    );
  } catch {
    return false;
  }
}

function readFileSyncUtf8(filePath: string): string {
  return existsSync(filePath) ? readFileSync(filePath, "utf8") : "";
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function parseRef(ref: string): { book: string; chapter: number } | null {
  const match = /^(?<book>[1-3]?[A-Za-z]+)\.(?<chapter>\d+)\./u.exec(ref);
  if (!match?.groups) return null;
  return {
    book: match.groups.book,
    chapter: Number.parseInt(match.groups.chapter, 10)
  };
}

function parseScope(scope: string): { book: string; chapter: number } | null {
  const [book, rawChapter] = scope.split(".");
  if (!book || !rawChapter) return null;
  return { book, chapter: Number.parseInt(rawChapter, 10) };
}

function compareScope(left: string, right: string): number {
  const parsedLeft = parseScope(left);
  const parsedRight = parseScope(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  return (
    compareBook(parsedLeft.book, parsedRight.book) ||
    parsedLeft.chapter - parsedRight.chapter
  );
}

function compareBook(left: string, right: string): number {
  return (
    (BOOK_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER) -
      (BOOK_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER) ||
    left.localeCompare(right)
  );
}

function confidenceRank(confidence: CandidateConfidence): number {
  switch (confidence) {
    case "high":
      return 3;
    case "medium":
      return 2;
    case "low":
      return 1;
  }
}

function modelSlug(model: string): string {
  return model.replace(/[^0-9A-Za-z]+/gu, "-").replace(/^-|-$/gu, "");
}

function sanitize(value: string): string {
  return value.replace(/[^0-9A-Za-z]+/gu, "-").replace(/^-|-$/gu, "");
}

function scopeHash(scope: string): string {
  return createHash("sha1").update(scope).digest("hex").slice(0, 8);
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function sum(items: TaskResult[], key: keyof TaskResult): number {
  return items.reduce((total, item) => {
    const value = item[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function parseArgs(argv: string[]): Map<string, string | boolean> {
  const args = new Map<string, string | boolean>();
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (!item.startsWith("--")) continue;
    const key = item.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args.set(key, true);
      continue;
    }
    args.set(key, next);
    index += 1;
  }
  return args;
}

function readStringArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: string
): string {
  const value = args.get(name);
  return typeof value === "string" ? value : fallback;
}

function readNumberArg(
  args: Map<string, string | boolean>,
  name: string,
  fallback: number
): number {
  const value = args.get(name);
  if (typeof value !== "string") return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readConfidenceArg(
  args: Map<string, string | boolean>
): CandidateConfidence {
  const value = args.get("min-confidence");
  if (value === "medium" || value === "low" || value === "high") return value;
  return "high";
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const bible = readStringArg(args, "bible", "nbs").toLowerCase();
  const outputRoot = readStringArg(
    args,
    "output-root",
    path.join("outputs", "gap-review", bible, "full-bible-llm-current")
  );
  const options: CliOptions = {
    bible,
    lexicalReportPath: readStringArg(
      args,
      "lexical-report",
      path.join(
        "outputs",
        "lexical-candidates",
        bible,
        `bible-${bible}-lexical-candidates-all.json`
      )
    ),
    outputRoot,
    maxItemsPerTask: readNumberArg(args, "max-items-per-task", 30),
    taskBatchSize: readNumberArg(args, "task-batch-size", 1),
    minConfidence: readConfidenceArg(args),
    leftModel: readStringArg(args, "left-model", DEFAULT_LEFT_MODEL),
    rightModel: readStringArg(args, "right-model", DEFAULT_RIGHT_MODEL),
    timeoutMs: readNumberArg(args, "timeout-ms", 120000),
    llmAttempts: readNumberArg(args, "llm-attempts", 2),
    skipExisting:
      args.get("skip-existing") === true ||
      args.get("skip-existing") === "true",
    dryRun: args.get("dry-run") === true,
    planOnly: args.get("plan-only") === true,
    allowResidualAutoSafe: args.get("allow-residual-autosafe") === true
  };

  const manifest = await runBatch(options);
  console.log(JSON.stringify(manifest.totals, null, 2));
  console.log(`Manifest: ${path.join(options.outputRoot, "manifest.json")}`);
}

if (process.argv[1]?.endsWith("runSemanticRefillGapReviewBatch.ts")) {
  await main();
}
