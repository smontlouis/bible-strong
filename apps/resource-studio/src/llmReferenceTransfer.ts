import { readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { readBibleJson, type BibleVerse } from "./bibleJson.js";
import { readOriginalSourceTsv } from "./originalSource.js";
import {
  buildStrongVerseMap,
  parseStrongOccurrences,
  readStrongCsv,
  referenceKey,
  type StrongVerse,
  type StrongVerseMap
} from "./strongCsv.js";
import { stripTags, tokenizeText } from "./tokenize.js";

interface TransferOptions {
  source: string;
  target?: string;
  gold?: string;
  onlyRef?: string;
  limit: number;
  model: string;
  outputDir: string;
}

interface TransferAssignment {
  wordIndex: number;
  strong: string[];
  confidence: number;
  reason: string;
}

interface TransferResult {
  ref: string;
  source: string;
  target: string;
  sourceStrongCount: number;
  targetWordCount: number;
  assignments: TransferAssignment[];
  rejectedAssignments: number;
  goldStrongCount?: number;
  truePositive?: number;
  falsePositive?: number;
  falseNegative?: number;
  precision?: number;
  recall?: number;
  f1?: number;
  error?: string;
}

interface TransferReport {
  generatedAt: string;
  mode: "target" | "gold-eval";
  source: string;
  target?: string;
  gold?: string;
  model: string;
  limit: number;
  results: TransferResult[];
  totals?: {
    evaluatedVerseCount: number;
    truePositive: number;
    falsePositive: number;
    falseNegative: number;
    precision: number;
    recall: number;
    f1: number;
  };
}

const ORIGINAL_SOURCES = [
  "data/external/Alignments/data/sources/WLC.tsv",
  "data/external/Alignments/data/sources/SBLGNT.tsv"
];

async function runReferenceTransfer(
  options: TransferOptions
): Promise<TransferReport> {
  loadDotEnv();

  const sourceRows = await readStrongCsv(`data/strongs/${options.source}.csv`);
  const sourceMap = buildStrongVerseMap(sourceRows);
  const goldMap = options.gold
    ? buildStrongVerseMap(
        await readStrongCsv(`data/strongs/${options.gold}.csv`)
      )
    : undefined;
  const targetVerses = options.target
    ? await readBibleJson(`data/bibles/bible-${options.target}.json`)
    : [];
  const targetByRef = new Map(
    targetVerses.map((verse) => [formatRefKey(verse), verse])
  );
  const originalByRef = await loadOriginalSources();
  const refs = selectRefs(sourceMap, goldMap, targetByRef, options);
  const results: TransferResult[] = [];

  for (const ref of refs.slice(0, options.limit)) {
    const source = sourceMap.get(ref);
    const gold = goldMap?.get(ref);
    const targetText = gold
      ? stripTags(gold.row.text)
      : targetByRef.get(ref)?.text;

    if (!source || !targetText) continue;

    const result = await transferVerse({
      ref,
      sourceName: options.source,
      source,
      targetName: options.gold ?? options.target ?? "target",
      targetText,
      allowedStrong: buildAllowedStrong(source, originalByRef.get(ref)),
      gold,
      model: options.model
    });
    results.push(result);
  }

  const report: TransferReport = {
    generatedAt: new Date().toISOString(),
    mode: options.gold ? "gold-eval" : "target",
    source: options.source,
    target: options.target,
    gold: options.gold,
    model: options.model,
    limit: options.limit,
    results,
    totals: goldMap ? summarizeGoldResults(results) : undefined
  };
  const outputPath = path.join(
    options.outputDir,
    options.gold
      ? `llm-transfer-${options.gold}-from-${options.source}.eval.json`
      : `llm-transfer-${options.target}-from-${options.source}.json`
  );
  await mkdir(options.outputDir, { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");

  return report;
}

async function transferVerse(options: {
  ref: string;
  sourceName: string;
  source: StrongVerse;
  targetName: string;
  targetText: string;
  allowedStrong: Map<string, number>;
  gold?: StrongVerse;
  model: string;
}): Promise<TransferResult> {
  try {
    const response = await callGateway({
      ref: options.ref,
      sourceName: options.sourceName,
      source: options.source,
      targetName: options.targetName,
      targetText: options.targetText,
      model: options.model
    });
    const validated = validateAssignments(
      response.assignments ?? [],
      options.targetText,
      options.allowedStrong
    );
    const result: TransferResult = {
      ref: options.ref,
      source: options.sourceName,
      target: options.targetName,
      sourceStrongCount: parseStrongOccurrences(options.source.row.text).length,
      targetWordCount: countWords(options.targetText),
      assignments: validated.accepted,
      rejectedAssignments: validated.rejected
    };

    if (options.gold) {
      return {
        ...result,
        ...scoreAgainstGold(validated.accepted, options.gold)
      };
    }

    return result;
  } catch (error) {
    return {
      ref: options.ref,
      source: options.sourceName,
      target: options.targetName,
      sourceStrongCount: parseStrongOccurrences(options.source.row.text).length,
      targetWordCount: countWords(options.targetText),
      assignments: [],
      rejectedAssignments: 0,
      error: error instanceof Error ? error.message : "unknown-error"
    };
  }
}

async function callGateway(options: {
  ref: string;
  sourceName: string;
  source: StrongVerse;
  targetName: string;
  targetText: string;
  model: string;
}): Promise<{ assignments?: TransferAssignment[] }> {
  const apiKey = process.env.AI_GATEWAY_KEY ?? process.env.AI_GATEWAY_API_KEY;
  if (!apiKey) throw new Error("missing-ai-gateway-key");

  const payload = {
    task: 'Transfère les numéros Strong du verset source vers les mots du verset cible. Utilise uniquement les Strong présents dans le verset source. Réponds en JSON {"assignments":[{"wordIndex":0,"strong":["H0000"],"confidence":0.8,"reason":"..."}]}',
    ref: options.ref,
    source: {
      name: options.sourceName,
      tokens: options.source.tokens.map((token, index) => ({
        index,
        text: token.text,
        normalized: token.normalized,
        strong: token.strong
      }))
    },
    target: {
      name: options.targetName,
      words: tokenizeText(options.targetText)
        .filter((segment) => segment.kind === "word")
        .map((segment, wordIndex) => ({
          wordIndex,
          text: segment.text,
          normalized: segment.normalized
        }))
    }
  };
  const response = await fetch(
    "https://ai-gateway.vercel.sh/v1/chat/completions",
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: options.model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              "Tu es un aligneur biblique. Tu dois transférer des Strong existants d'une traduction française taggée vers une autre traduction française non taggée. Réponds uniquement en JSON valide."
          },
          { role: "user", content: JSON.stringify(payload) }
        ]
      })
    }
  );

  if (!response.ok) {
    throw new Error(
      `ai-gateway-http-${response.status}:${(await response.text()).slice(0, 240)}`
    );
  }

  const json = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return JSON.parse(
    extractJson(json.choices?.[0]?.message?.content ?? "{}")
  ) as {
    assignments?: TransferAssignment[];
  };
}

function validateAssignments(
  assignments: TransferAssignment[],
  targetText: string,
  allowedStrong: Map<string, number>
): { accepted: TransferAssignment[]; rejected: number } {
  const wordCount = countWords(targetText);
  const accepted: TransferAssignment[] = [];
  const acceptedCounts = new Map<string, number>();
  let rejected = 0;

  for (const assignment of assignments) {
    if (
      !Number.isInteger(assignment.wordIndex) ||
      assignment.wordIndex < 0 ||
      assignment.wordIndex >= wordCount ||
      assignment.confidence < 0.55
    ) {
      rejected += 1;
      continue;
    }

    const strong = assignment.strong
      .map((code) => code.toUpperCase())
      .filter((code) => {
        const limit = allowedStrong.get(code) ?? 0;
        if (limit <= 0) return false;
        return (acceptedCounts.get(code) ?? 0) < limit;
      });
    if (strong.length === 0) {
      rejected += 1;
      continue;
    }

    for (const code of strong) {
      acceptedCounts.set(code, (acceptedCounts.get(code) ?? 0) + 1);
    }
    accepted.push({
      wordIndex: assignment.wordIndex,
      strong: [...new Set(strong)],
      confidence: Math.min(0.9, assignment.confidence),
      reason: assignment.reason
    });
  }

  return { accepted, rejected };
}

function scoreAgainstGold(
  assignments: TransferAssignment[],
  gold: StrongVerse
): Pick<
  TransferResult,
  | "goldStrongCount"
  | "truePositive"
  | "falsePositive"
  | "falseNegative"
  | "precision"
  | "recall"
  | "f1"
> {
  const predicted = assignments.flatMap((assignment) => assignment.strong);
  const expected = parseStrongOccurrences(gold.row.text);
  const truePositive = multisetIntersectionCount(predicted, expected);
  const falsePositive = Math.max(0, predicted.length - truePositive);
  const falseNegative = Math.max(0, expected.length - truePositive);
  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    goldStrongCount: expected.length,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1)
  };
}

function summarizeGoldResults(
  results: TransferResult[]
): NonNullable<TransferReport["totals"]> {
  const truePositive = sum(results, "truePositive");
  const falsePositive = sum(results, "falsePositive");
  const falseNegative = sum(results, "falseNegative");
  const precision = truePositive / Math.max(1, truePositive + falsePositive);
  const recall = truePositive / Math.max(1, truePositive + falseNegative);
  const f1 =
    precision + recall === 0
      ? 0
      : (2 * precision * recall) / (precision + recall);

  return {
    evaluatedVerseCount: results.filter((result) => !result.error).length,
    truePositive,
    falsePositive,
    falseNegative,
    precision: roundRatio(precision),
    recall: roundRatio(recall),
    f1: roundRatio(f1)
  };
}

async function loadOriginalSources(): Promise<Map<string, Set<string>>> {
  const maps = await Promise.all(
    ORIGINAL_SOURCES.map((source) => readOriginalSourceTsv(source))
  );
  const merged = new Map<string, Set<string>>();

  for (const map of maps) {
    for (const [key, verse] of map) {
      const strongSet = merged.get(key) ?? new Set<string>();
      for (const strong of verse.strongSet) strongSet.add(strong);
      merged.set(key, strongSet);
    }
  }

  return merged;
}

function buildAllowedStrong(
  source: StrongVerse,
  original: Set<string> | undefined
): Map<string, number> {
  const counts = new Map<string, number>();

  for (const strong of parseStrongOccurrences(source.row.text)) {
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }

  for (const strong of original ?? []) {
    if (!counts.has(strong)) counts.set(strong, 1);
  }

  return counts;
}

function selectRefs(
  sourceMap: StrongVerseMap,
  goldMap: StrongVerseMap | undefined,
  targetByRef: Map<string, BibleVerse>,
  options: TransferOptions
): string[] {
  const onlyRef = options.onlyRef;
  if (onlyRef) {
    return [...sourceMap.keys()].filter((ref) => refMatches(ref, onlyRef));
  }

  return [...sourceMap.keys()].filter((ref) =>
    goldMap ? goldMap.has(ref) : targetByRef.has(ref)
  );
}

function refMatches(ref: string, pattern: string): boolean {
  const [book, chapter, verse] = pattern.split(".");
  const [refBook, refChapter, refVerse] = ref.split(".");
  return (
    refBook === book &&
    (!chapter || refChapter === chapter) &&
    (!verse || refVerse === verse)
  );
}

function formatRefKey(verse: BibleVerse): string {
  return referenceKey(verse.bookId, verse.chapter, verse.verse);
}

function countWords(text: string): number {
  return tokenizeText(text).filter((segment) => segment.kind === "word").length;
}

function multisetIntersectionCount(left: string[], right: string[]): number {
  const remaining = [...right];
  let count = 0;

  for (const value of left) {
    const index = remaining.indexOf(value);
    if (index === -1) continue;
    remaining.splice(index, 1);
    count += 1;
  }

  return count;
}

function sum(results: TransferResult[], key: keyof TransferResult): number {
  return results.reduce((total, result) => {
    const value = result[key];
    return total + (typeof value === "number" ? value : 0);
  }, 0);
}

function parseCliOptions(argv: string[]): TransferOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  return {
    source: args.get("source") ?? "Darby",
    target: args.get("target"),
    gold: args.get("gold"),
    onlyRef: args.get("only"),
    limit: Number.parseInt(args.get("limit") ?? "5", 10),
    model:
      args.get("model") ??
      process.env.AI_GATEWAY_MODEL ??
      "anthropic/claude-sonnet-4.6",
    outputDir: args.get("output-dir") ?? "outputs"
  };
}

function loadDotEnv(): void {
  try {
    const content = readFileSync(".env", "utf8");
    for (const line of content.split(/\r?\n/u)) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/u);
      if (!match?.[1] || process.env[match[1]]) continue;
      process.env[match[1]] = (match[2] ?? "").replace(/^["']|["']$/gu, "");
    }
  } catch {
    // Optional.
  }
}

function extractJson(content: string): string {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/u)?.[1];
  if (fenced) return fenced.trim();
  const first = content.indexOf("{");
  const last = content.lastIndexOf("}");
  if (first !== -1 && last !== -1 && last > first) {
    return content.slice(first, last + 1);
  }
  return content;
}

function roundRatio(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 10_000) / 10_000;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const report = await runReferenceTransfer(
    parseCliOptions(process.argv.slice(2))
  );
  console.log(
    report.totals
      ? `Evaluated ${report.totals.evaluatedVerseCount} verses; precision ${report.totals.precision}; recall ${report.totals.recall}; f1 ${report.totals.f1}`
      : `Generated ${report.results.length} transfer suggestion verses`
  );
}
