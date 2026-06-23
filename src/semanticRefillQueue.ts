import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { BOOK_IDS } from "./books.js";

export type SemanticRefillQueuePriority = "semantic-high" | "semantic-medium";

export type SemanticRefillQueueGroup = "chapter" | "book";

export interface SemanticRefillQueueOptions {
  bible?: string;
  sourcePath?: string;
  groupBy?: SemanticRefillQueueGroup;
  maxItemsPerTask?: number;
}

export interface SemanticRefillQueueManifest {
  version: 1;
  bible: string;
  sourcePath?: string;
  generatedAt: string;
  policy: {
    groupBy: SemanticRefillQueueGroup;
    priorityOrder: SemanticRefillQueuePriority[];
    excludedPriorities: string[];
    excludedTargets: string[];
    excludedWeakFunctionStrong: string[];
    maxItemsPerTask: number;
  };
  totals: {
    inputItems: number;
    eligibleItems: number;
    excludedItems: number;
    books: number;
    chapters: number;
    tasks: number;
  };
  books: SemanticRefillQueueBookSummary[];
  tasks: SemanticRefillQueueTask[];
  excludedSummary: Record<string, number>;
}

export interface SemanticRefillQueueBookSummary {
  book: string;
  itemCount: number;
  taskCount: number;
  chapters: string[];
  priority: SemanticRefillQueuePriority;
  topStrong: string[];
}

export interface SemanticRefillQueueTask {
  id: string;
  bible: string;
  scope: string;
  book: string;
  chapter?: number;
  part?: number;
  priority: SemanticRefillQueuePriority;
  itemCount: number;
  refCount: number;
  strongCount: number;
  refs: string[];
  topStrong: string[];
  items: SemanticRefillQueueItem[];
}

export interface SemanticRefillQueueItem {
  ref: string;
  book: string;
  chapter?: number;
  verse?: number;
  priority: SemanticRefillQueuePriority;
  strong: string[];
  score: number;
  target?: string;
  wordIndex?: number;
  normalized?: string;
  reason?: string;
  evidence?: string[];
}

export interface SemanticRefillQueueExcludedItem {
  ref?: string;
  strong: string[];
  reason: string;
}

interface PendingLikeItem {
  bible?: unknown;
  ref?: unknown;
  target?: unknown;
  wordIndex?: unknown;
  normalized?: unknown;
  strong?: unknown;
  confidence?: unknown;
  reason?: unknown;
  status?: unknown;
  score?: unknown;
  priority?: unknown;
  evidence?: unknown;
  candidates?: unknown;
  annotation?: unknown;
}

interface ParsedRef {
  book: string;
  chapter?: number;
  verse?: number;
}

const DEFAULT_INPUT =
  "outputs/semantic-refill/nbs/final-audit/semantic-refill-pending.json";
const DEFAULT_OUTPUT =
  "outputs/semantic-refill/nbs/final-audit/semantic-refill-llm-queue-manifest.json";
const DEFAULT_MAX_ITEMS_PER_TASK = 80;

const PRIORITY_ORDER: SemanticRefillQueuePriority[] = [
  "semantic-high",
  "semantic-medium"
];

const EXCLUDED_PRIORITIES = new Set([
  "function-low",
  "technical-skip",
  "reject"
]);

const EXCLUDED_TARGETS = new Set(["technical", "reject"]);

const TECHNICAL_STRONG = new Set([
  "H0853",
  "H0834",
  "H0996",
  "H5921",
  "H0413",
  "G3588",
  "G1722",
  "G1519"
]);

const WEAK_FUNCTION_STRONG = new Set([
  ...TECHNICAL_STRONG,
  "H3588",
  "H4480",
  "G1161",
  "G2532",
  "G3754"
]);

const WEAK_FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "car",
  "ce",
  "ces",
  "de",
  "des",
  "du",
  "elle",
  "en",
  "et",
  "il",
  "ils",
  "la",
  "le",
  "les",
  "leur",
  "lui",
  "ne",
  "pas",
  "pour",
  "que",
  "qui",
  "se",
  "sur",
  "un",
  "une",
  "y"
]);

const BOOK_ORDER = new Map<string, number>(
  BOOK_IDS.map((book, index) => [book, index])
);

export function buildSemanticRefillQueueManifest(
  rawItems: unknown[],
  options: SemanticRefillQueueOptions = {}
): SemanticRefillQueueManifest {
  const bible = options.bible ?? inferBible(rawItems) ?? "nbs";
  const groupBy = options.groupBy ?? "chapter";
  const maxItemsPerTask = Math.max(
    1,
    Math.floor(options.maxItemsPerTask ?? DEFAULT_MAX_ITEMS_PER_TASK)
  );
  const eligible: SemanticRefillQueueItem[] = [];
  const excluded: SemanticRefillQueueExcludedItem[] = [];

  for (const rawItem of rawItems) {
    const rawExclusionReason = getRawExclusionReason(rawItem);
    if (rawExclusionReason) {
      const item = rawItem as PendingLikeItem;
      excluded.push({
        ref: readString(item.ref),
        strong: readStrongList(item.strong),
        reason: rawExclusionReason
      });
      continue;
    }

    const normalized = normalizeQueueItem(rawItem);
    if (!normalized) {
      excluded.push({ strong: [], reason: "invalid-item" });
      continue;
    }

    const exclusionReason = getExclusionReason(normalized);
    if (exclusionReason) {
      excluded.push({
        ref: normalized.ref,
        strong: normalized.strong,
        reason: exclusionReason
      });
      continue;
    }

    eligible.push(normalized);
  }

  eligible.sort(compareQueueItems);
  const tasks = buildTasks({
    bible,
    items: eligible,
    groupBy,
    maxItemsPerTask
  });
  const books = buildBookSummaries(tasks);
  const chapters = new Set(
    tasks
      .filter((task) => task.chapter !== undefined)
      .map((task) => `${task.book}.${task.chapter}`)
  );

  return {
    version: 1,
    bible,
    sourcePath: options.sourcePath,
    generatedAt: new Date().toISOString(),
    policy: {
      groupBy,
      priorityOrder: PRIORITY_ORDER,
      excludedPriorities: [...EXCLUDED_PRIORITIES].sort(),
      excludedTargets: [...EXCLUDED_TARGETS].sort(),
      excludedWeakFunctionStrong: [...WEAK_FUNCTION_STRONG].sort(),
      maxItemsPerTask
    },
    totals: {
      inputItems: rawItems.length,
      eligibleItems: eligible.length,
      excludedItems: excluded.length,
      books: books.length,
      chapters: chapters.size,
      tasks: tasks.length
    },
    books,
    tasks,
    excludedSummary: summarizeExcluded(excluded)
  };
}

export async function readSemanticRefillQueueInput(
  inputPath: string
): Promise<unknown[]> {
  const raw = JSON.parse(await readFile(inputPath, "utf8")) as unknown;
  if (!Array.isArray(raw)) {
    throw new Error(`Expected ${inputPath} to contain a JSON array.`);
  }
  return raw;
}

export async function writeSemanticRefillQueueManifest(
  outputPath: string,
  manifest: SemanticRefillQueueManifest
): Promise<void> {
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function normalizeQueueItem(rawItem: unknown): SemanticRefillQueueItem | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as PendingLikeItem;
  const ref = readString(item.ref);
  if (!ref) return null;

  const parsedRef = parseRef(ref);
  if (!parsedRef) return null;

  const strong = readStrongList(item.strong);
  if (strong.length === 0) return null;

  const priority = classifyPriority(item);
  if (!priority) return null;

  const evidence = readStringArray(item.evidence);
  const normalized = readString(item.normalized);
  const reason = readString(item.reason);

  return {
    ref,
    book: parsedRef.book,
    chapter: parsedRef.chapter,
    verse: parsedRef.verse,
    priority,
    strong,
    score: readNumber(item.score) ?? readNumber(item.confidence) ?? 0,
    target: readString(item.target),
    wordIndex: readInteger(item.wordIndex),
    normalized,
    reason,
    evidence: evidence.length > 0 ? evidence : undefined
  };
}

function classifyPriority(
  item: PendingLikeItem
): SemanticRefillQueuePriority | null {
  const priority = readString(item.priority);
  if (priority === "semantic-high") return "semantic-high";
  if (priority === "semantic-medium") return "semantic-medium";
  if (priority === undefined && Array.isArray(item.candidates)) {
    return "semantic-medium";
  }
  return null;
}

function getExclusionReason(item: SemanticRefillQueueItem): string | null {
  if (item.target && EXCLUDED_TARGETS.has(item.target)) {
    return "excluded-target";
  }

  const priority = item.priority;
  if (EXCLUDED_PRIORITIES.has(priority)) {
    return "excluded-priority";
  }

  if (item.strong.some((strong) => TECHNICAL_STRONG.has(strong))) {
    return "technical-strong";
  }

  if (item.strong.some((strong) => WEAK_FUNCTION_STRONG.has(strong))) {
    return "weak-function-strong";
  }

  if (item.normalized && isWeakFunctionPhrase(item.normalized)) {
    return "weak-function-word";
  }

  const reasonText = [item.reason, ...(item.evidence ?? [])]
    .filter((value): value is string => Boolean(value))
    .join(" ")
    .toLowerCase();
  if (reasonText.includes("technical")) {
    return "technical-reason";
  }
  if (reasonText.includes("weak-function")) {
    return "weak-function-reason";
  }

  return null;
}

function getRawExclusionReason(rawItem: unknown): string | null {
  if (!rawItem || typeof rawItem !== "object") return null;
  const item = rawItem as PendingLikeItem;
  const status = readString(item.status);
  if (status === "accept" || status === "reject") return "resolved-status";

  const priority = readString(item.priority);
  if (priority && EXCLUDED_PRIORITIES.has(priority)) {
    return "excluded-priority";
  }

  const target = readString(item.target);
  if (target && EXCLUDED_TARGETS.has(target)) {
    return "excluded-target";
  }

  return null;
}

function buildTasks(options: {
  bible: string;
  items: SemanticRefillQueueItem[];
  groupBy: SemanticRefillQueueGroup;
  maxItemsPerTask: number;
}): SemanticRefillQueueTask[] {
  const groups = new Map<string, SemanticRefillQueueItem[]>();

  for (const item of options.items) {
    const key =
      options.groupBy === "book" || item.chapter === undefined
        ? item.book
        : `${item.book}.${item.chapter}`;
    const current = groups.get(key) ?? [];
    current.push(item);
    groups.set(key, current);
  }

  const tasks: SemanticRefillQueueTask[] = [];
  for (const [key, items] of groups) {
    const first = items[0];
    if (!first) continue;
    const chunks = chunkItems(items, options.maxItemsPerTask);
    chunks.forEach((chunk, index) => {
      const split = key.split(".");
      const chapter = split[1] ? Number.parseInt(split[1], 10) : undefined;
      const part = chunks.length > 1 ? index + 1 : undefined;
      tasks.push(
        buildTask({
          bible: options.bible,
          key,
          book: first.book,
          chapter,
          part,
          items: chunk
        })
      );
    });
  }

  return tasks.sort(compareTasks);
}

function buildTask(options: {
  bible: string;
  key: string;
  book: string;
  chapter?: number;
  part?: number;
  items: SemanticRefillQueueItem[];
}): SemanticRefillQueueTask {
  const refs = sortedUnique(
    options.items.map((item) => item.ref),
    compareRefs
  );
  const strongCounts = countValues(
    options.items.flatMap((item) => item.strong)
  );
  const topStrong = topKeys(strongCounts, 10);
  const priority = bestPriority(options.items.map((item) => item.priority));
  const scope =
    options.chapter === undefined
      ? options.book
      : `${options.book}.${options.chapter}`;
  const id = [
    options.bible,
    options.key,
    options.part ? `part-${options.part}` : undefined
  ]
    .filter((value): value is string => Boolean(value))
    .join(":");

  return {
    id,
    bible: options.bible,
    scope,
    book: options.book,
    chapter: options.chapter,
    part: options.part,
    priority,
    itemCount: options.items.length,
    refCount: refs.length,
    strongCount: Object.keys(strongCounts).length,
    refs,
    topStrong,
    items: options.items
  };
}

function buildBookSummaries(
  tasks: SemanticRefillQueueTask[]
): SemanticRefillQueueBookSummary[] {
  const byBook = new Map<string, SemanticRefillQueueTask[]>();
  for (const task of tasks) {
    const current = byBook.get(task.book) ?? [];
    current.push(task);
    byBook.set(task.book, current);
  }

  return [...byBook.entries()]
    .map(([book, bookTasks]) => {
      const allItems = bookTasks.flatMap((task) => task.items);
      const strongCounts = countValues(allItems.flatMap((item) => item.strong));
      return {
        book,
        itemCount: allItems.length,
        taskCount: bookTasks.length,
        chapters: sortedUnique(
          bookTasks
            .filter((task) => task.chapter !== undefined)
            .map((task) => `${task.book}.${task.chapter}`),
          compareScopes
        ),
        priority: bestPriority(allItems.map((item) => item.priority)),
        topStrong: topKeys(strongCounts, 10)
      };
    })
    .sort((left, right) => compareBooks(left.book, right.book));
}

function summarizeExcluded(
  excluded: SemanticRefillQueueExcludedItem[]
): Record<string, number> {
  return excluded.reduce<Record<string, number>>((summary, item) => {
    summary[item.reason] = (summary[item.reason] ?? 0) + 1;
    return summary;
  }, {});
}

function inferBible(rawItems: unknown[]): string | null {
  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const bible = readString((rawItem as PendingLikeItem).bible);
    if (bible) return bible;
  }
  return null;
}

function parseRef(ref: string): ParsedRef | null {
  const match =
    /^(?<book>[1-3]?[A-Za-z]+)\.(?<chapter>\d+)(?:\.(?<verse>\d+))?$/u.exec(
      ref
    );
  if (!match?.groups) return null;
  return {
    book: match.groups.book,
    chapter: Number.parseInt(match.groups.chapter, 10),
    verse: match.groups.verse
      ? Number.parseInt(match.groups.verse, 10)
      : undefined
  };
}

function isWeakFunctionPhrase(normalized: string): boolean {
  const tokens = normalized
    .split(/\s+/u)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);
  return (
    tokens.length > 0 && tokens.every((token) => WEAK_FUNCTION_WORDS.has(token))
  );
}

function compareQueueItems(
  left: SemanticRefillQueueItem,
  right: SemanticRefillQueueItem
): number {
  return (
    comparePriorities(left.priority, right.priority) ||
    compareRefs(left.ref, right.ref) ||
    right.score - left.score ||
    left.strong.join(",").localeCompare(right.strong.join(","))
  );
}

function compareTasks(
  left: SemanticRefillQueueTask,
  right: SemanticRefillQueueTask
): number {
  return (
    comparePriorities(left.priority, right.priority) ||
    right.itemCount - left.itemCount ||
    compareBooks(left.book, right.book) ||
    (left.chapter ?? 0) - (right.chapter ?? 0) ||
    (left.part ?? 0) - (right.part ?? 0)
  );
}

function comparePriorities(
  left: SemanticRefillQueuePriority,
  right: SemanticRefillQueuePriority
): number {
  return PRIORITY_ORDER.indexOf(left) - PRIORITY_ORDER.indexOf(right);
}

function compareRefs(left: string, right: string): number {
  const parsedLeft = parseRef(left);
  const parsedRight = parseRef(right);
  if (!parsedLeft || !parsedRight) return left.localeCompare(right);
  return (
    compareBooks(parsedLeft.book, parsedRight.book) ||
    (parsedLeft.chapter ?? 0) - (parsedRight.chapter ?? 0) ||
    (parsedLeft.verse ?? 0) - (parsedRight.verse ?? 0) ||
    left.localeCompare(right)
  );
}

function compareScopes(left: string, right: string): number {
  return compareRefs(`${left}.0`, `${right}.0`);
}

function compareBooks(left: string, right: string): number {
  const leftOrder = BOOK_ORDER.get(left) ?? Number.MAX_SAFE_INTEGER;
  const rightOrder = BOOK_ORDER.get(right) ?? Number.MAX_SAFE_INTEGER;
  return leftOrder - rightOrder || left.localeCompare(right);
}

function bestPriority(
  priorities: SemanticRefillQueuePriority[]
): SemanticRefillQueuePriority {
  return priorities.reduce<SemanticRefillQueuePriority>(
    (best, priority) =>
      comparePriorities(priority, best) < 0 ? priority : best,
    "semantic-medium"
  );
}

function chunkItems<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
}

function countValues(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] ?? 0) + 1;
    return counts;
  }, {});
}

function topKeys(counts: Record<string, number>, limit: number): string[] {
  return Object.entries(counts)
    .sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey)
    )
    .slice(0, limit)
    .map(([key]) => key);
}

function sortedUnique(
  values: string[],
  compare: (left: string, right: string) => number
): string[] {
  return [...new Set(values)].sort(compare);
}

function readString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function readStrongList(value: unknown): string[] {
  if (typeof value === "string") return [value.toUpperCase()];
  if (!Array.isArray(value)) return [];
  return sortedUnique(
    value
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.toUpperCase()),
    (left, right) => left.localeCompare(right)
  );
}

function readNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : undefined;
}

function readInteger(value: unknown): number | undefined {
  return Number.isInteger(value) ? (value as number) : undefined;
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

function readGroupArg(
  args: Map<string, string | boolean>
): SemanticRefillQueueGroup {
  const value = args.get("group-by");
  return value === "book" ? "book" : "chapter";
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

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  const inputPath = readStringArg(args, "input", DEFAULT_INPUT);
  const outputPath = readStringArg(args, "output", DEFAULT_OUTPUT);
  const rawItems = await readSemanticRefillQueueInput(inputPath);
  const manifest = buildSemanticRefillQueueManifest(rawItems, {
    bible: readStringArg(args, "bible", "nbs"),
    sourcePath: inputPath,
    groupBy: readGroupArg(args),
    maxItemsPerTask: readNumberArg(
      args,
      "max-items-per-task",
      DEFAULT_MAX_ITEMS_PER_TASK
    )
  });

  await writeSemanticRefillQueueManifest(outputPath, manifest);
  console.log(
    JSON.stringify(
      {
        output: outputPath,
        totals: manifest.totals
      },
      null,
      2
    )
  );
}

const entryPoint = process.argv[1] ? path.resolve(process.argv[1]) : undefined;
const modulePath = fileURLToPath(import.meta.url);

if (entryPoint === modulePath) {
  void main();
}
