import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  type StrongLedger,
  type StrongLedgerAnnotation
} from "./strongLedger.js";

type ReferenceName = "Sg1910" | "Darby" | "DarbyR";
type ConsensusBucket = "oneOfThree" | "twoOfThree" | "threeOfThree";
type ScopeMetrics = Record<ReferenceName, ReferenceCoverageMetrics>;
type ConsensusMetrics = Record<ConsensusBucket, CoverageMetrics>;

interface CliOptions {
  bible: string;
  inputDir: string;
  outputDir: string;
  onlyRef?: string;
  includeVerses: boolean;
  limitMissing: number;
}

interface ReferenceCoverageReport {
  bible: string;
  generatedAt: string;
  inputPath: string;
  scope: string;
  references: ReferenceName[];
  totals: {
    byReference: ScopeMetrics;
    consensus: ConsensusMetrics;
  };
  byBook: Record<
    string,
    {
      byReference: ScopeMetrics;
      consensus: ConsensusMetrics;
    }
  >;
  topMissing: MissingStrongSummary[];
  verses?: VerseCoverage[];
}

interface VerseCoverage {
  ref: string;
  bookId: string;
  chapter: number;
  verse: number;
  byReference: ScopeMetrics;
  consensus: ConsensusMetrics;
  missing: Record<ReferenceName, MissingStrong[]>;
}

interface CoverageMetrics {
  expected: number;
  readerPlaced: number;
  advancedPlaced: number;
  readerMissing: number;
  advancedMissing: number;
  readerCoverage: number;
  advancedCoverage: number;
}

interface ReferenceCoverageMetrics extends CoverageMetrics {
  readerExtras: number;
  advancedExtras: number;
}

interface MissingStrong {
  strong: string;
  expected: number;
  readerPlaced: number;
  advancedPlaced: number;
}

interface MissingStrongSummary extends MissingStrong {
  reference: ReferenceName;
  readerMissing: number;
  advancedMissing: number;
  refs: string[];
  verses: number;
}

const REFERENCES: ReferenceName[] = ["Sg1910", "Darby", "DarbyR"];

const EMPTY_REFERENCE_METRICS = (): ReferenceCoverageMetrics => ({
  expected: 0,
  readerPlaced: 0,
  advancedPlaced: 0,
  readerMissing: 0,
  advancedMissing: 0,
  readerCoverage: 0,
  advancedCoverage: 0,
  readerExtras: 0,
  advancedExtras: 0
});

const EMPTY_COVERAGE_METRICS = (): CoverageMetrics => ({
  expected: 0,
  readerPlaced: 0,
  advancedPlaced: 0,
  readerMissing: 0,
  advancedMissing: 0,
  readerCoverage: 0,
  advancedCoverage: 0
});

export async function buildReferenceCoverageReport(
  options: CliOptions
): Promise<ReferenceCoverageReport> {
  const ledgerPath = path.join(
    options.inputDir,
    `bible-${options.bible}-strong-ledger.json`
  );
  const ledger = await readStrongLedger(ledgerPath);
  const verses = ledger.verses.filter((verse) =>
    options.onlyRef ? refMatches(verse.ref, options.onlyRef) : true
  );
  const totals = emptyScope();
  const byBook: ReferenceCoverageReport["byBook"] = {};
  const verseReports: VerseCoverage[] = [];
  const missingSummaries = new Map<string, MissingStrongSummary>();

  for (const verse of verses) {
    const verseCoverage = calculateVerseCoverage(verse);
    addScope(totals, verseCoverage);
    const book = (byBook[verse.bookId] ??= emptyScope());
    addScope(book, verseCoverage);
    collectMissing(missingSummaries, verseCoverage);
    if (options.includeVerses) {
      verseReports.push(verseCoverage);
    }
  }

  finalizeScope(totals);
  for (const book of Object.values(byBook)) {
    finalizeScope(book);
  }

  return {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath: ledgerPath,
    scope: options.onlyRef ?? ledger.scope,
    references: REFERENCES,
    totals,
    byBook,
    topMissing: [...missingSummaries.values()]
      .sort(
        (left, right) =>
          right.advancedMissing - left.advancedMissing ||
          right.readerMissing - left.readerMissing ||
          right.expected - left.expected ||
          left.reference.localeCompare(right.reference) ||
          left.strong.localeCompare(right.strong)
      )
      .slice(0, options.limitMissing),
    verses: options.includeVerses ? verseReports : undefined
  };
}

export async function writeReferenceCoverageReport(
  report: ReferenceCoverageReport,
  outputDir: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const jsonPath = path.join(
    outputDir,
    `bible-${report.bible}-reference-coverage.json`
  );
  const markdownPath = path.join(
    outputDir,
    `bible-${report.bible}-reference-coverage.md`
  );

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdownReport(report), "utf8")
  ]);

  return { jsonPath, markdownPath };
}

function calculateVerseCoverage(
  verse: StrongLedger["verses"][number]
): VerseCoverage {
  const readerCounts = annotationCounts(
    verse.annotations.filter((annotation) => annotation.visibility === "reader")
  );
  const advancedCounts = annotationCounts(
    verse.annotations.filter((annotation) =>
      ["reader", "advanced"].includes(annotation.visibility)
    )
  );
  const byReference = emptyReferenceScope();
  const missing: Record<ReferenceName, MissingStrong[]> = {
    Sg1910: [],
    Darby: [],
    DarbyR: []
  };

  for (const reference of REFERENCES) {
    const expected = countStrongValues(verse.inventories.references[reference]);
    const metrics = calculateReferenceMetrics(
      expected,
      readerCounts,
      advancedCounts
    );
    byReference[reference] = metrics;
    missing[reference] = missingStrong(expected, readerCounts, advancedCounts);
  }

  return {
    ref: verse.ref,
    bookId: verse.bookId,
    chapter: verse.chapter,
    verse: verse.verse,
    byReference,
    consensus: calculateConsensusMetrics(
      verse.inventories.references,
      readerCounts,
      advancedCounts
    ),
    missing
  };
}

function calculateReferenceMetrics(
  expected: Map<string, number>,
  readerCounts: Map<string, number>,
  advancedCounts: Map<string, number>
): ReferenceCoverageMetrics {
  const expectedCount = sumCounts(expected);
  const readerPlaced = countRepresented(expected, readerCounts);
  const advancedPlaced = countRepresented(expected, advancedCounts);

  return {
    expected: expectedCount,
    readerPlaced,
    advancedPlaced,
    readerMissing: expectedCount - readerPlaced,
    advancedMissing: expectedCount - advancedPlaced,
    readerCoverage: 0,
    advancedCoverage: 0,
    readerExtras: countExtras(expected, readerCounts),
    advancedExtras: countExtras(expected, advancedCounts)
  };
}

function calculateConsensusMetrics(
  references: StrongLedger["verses"][number]["inventories"]["references"],
  readerCounts: Map<string, number>,
  advancedCounts: Map<string, number>
): ConsensusMetrics {
  const buckets: Record<ConsensusBucket, Map<string, number>> = {
    oneOfThree: new Map(),
    twoOfThree: new Map(),
    threeOfThree: new Map()
  };
  const countsByReference = REFERENCES.map((reference) =>
    countStrongValues(references[reference])
  );
  const strongSet = new Set(
    countsByReference.flatMap((counts) => [...counts.keys()])
  );

  for (const strong of strongSet) {
    const counts = countsByReference.map((countsByStrong) =>
      countsByStrong.get(strong)
    );
    const support = counts.filter((count) => (count ?? 0) > 0).length;
    const expected = Math.max(...counts.map((count) => count ?? 0));
    const bucket = consensusBucket(support);
    buckets[bucket].set(strong, expected);
  }

  return {
    oneOfThree: coverageFromExpected(
      buckets.oneOfThree,
      readerCounts,
      advancedCounts
    ),
    twoOfThree: coverageFromExpected(
      buckets.twoOfThree,
      readerCounts,
      advancedCounts
    ),
    threeOfThree: coverageFromExpected(
      buckets.threeOfThree,
      readerCounts,
      advancedCounts
    )
  };
}

function consensusBucket(support: number): ConsensusBucket {
  if (support >= 3) return "threeOfThree";
  if (support === 2) return "twoOfThree";
  return "oneOfThree";
}

function coverageFromExpected(
  expected: Map<string, number>,
  readerCounts: Map<string, number>,
  advancedCounts: Map<string, number>
): CoverageMetrics {
  const expectedCount = sumCounts(expected);
  const readerPlaced = countRepresented(expected, readerCounts);
  const advancedPlaced = countRepresented(expected, advancedCounts);

  return {
    expected: expectedCount,
    readerPlaced,
    advancedPlaced,
    readerMissing: expectedCount - readerPlaced,
    advancedMissing: expectedCount - advancedPlaced,
    readerCoverage: 0,
    advancedCoverage: 0
  };
}

function missingStrong(
  expected: Map<string, number>,
  readerCounts: Map<string, number>,
  advancedCounts: Map<string, number>
): MissingStrong[] {
  const missing: MissingStrong[] = [];

  for (const [strong, expectedCount] of expected) {
    const readerPlaced = Math.min(expectedCount, readerCounts.get(strong) ?? 0);
    const advancedPlaced = Math.min(
      expectedCount,
      advancedCounts.get(strong) ?? 0
    );
    if (readerPlaced < expectedCount || advancedPlaced < expectedCount) {
      missing.push({
        strong,
        expected: expectedCount,
        readerPlaced,
        advancedPlaced
      });
    }
  }

  return missing.sort(
    (left, right) =>
      right.expected - left.expected || left.strong.localeCompare(right.strong)
  );
}

function collectMissing(
  summaries: Map<string, MissingStrongSummary>,
  verse: VerseCoverage
): void {
  for (const reference of REFERENCES) {
    for (const missing of verse.missing[reference]) {
      const key = `${reference}:${missing.strong}`;
      const summary =
        summaries.get(key) ??
        ({
          reference,
          strong: missing.strong,
          expected: 0,
          readerPlaced: 0,
          advancedPlaced: 0,
          readerMissing: 0,
          advancedMissing: 0,
          refs: [],
          verses: 0
        } satisfies MissingStrongSummary);
      summary.expected += missing.expected;
      summary.readerPlaced += missing.readerPlaced;
      summary.advancedPlaced += missing.advancedPlaced;
      summary.readerMissing += missing.expected - missing.readerPlaced;
      summary.advancedMissing += missing.expected - missing.advancedPlaced;
      summary.refs.push(verse.ref);
      summary.verses += 1;
      summaries.set(key, summary);
    }
  }
}

function emptyScope(): ReferenceCoverageReport["totals"] {
  return {
    byReference: emptyReferenceScope(),
    consensus: emptyConsensusScope()
  };
}

function emptyReferenceScope(): ScopeMetrics {
  return {
    Sg1910: EMPTY_REFERENCE_METRICS(),
    Darby: EMPTY_REFERENCE_METRICS(),
    DarbyR: EMPTY_REFERENCE_METRICS()
  };
}

function emptyConsensusScope(): ConsensusMetrics {
  return {
    oneOfThree: EMPTY_COVERAGE_METRICS(),
    twoOfThree: EMPTY_COVERAGE_METRICS(),
    threeOfThree: EMPTY_COVERAGE_METRICS()
  };
}

function addScope(
  target: ReferenceCoverageReport["totals"],
  source: VerseCoverage
): void {
  for (const reference of REFERENCES) {
    addReferenceMetrics(
      target.byReference[reference],
      source.byReference[reference]
    );
  }
  for (const bucket of Object.keys(target.consensus) as ConsensusBucket[]) {
    addCoverageMetrics(target.consensus[bucket], source.consensus[bucket]);
  }
}

function addReferenceMetrics(
  target: ReferenceCoverageMetrics,
  source: ReferenceCoverageMetrics
): void {
  addCoverageMetrics(target, source);
  target.readerExtras += source.readerExtras;
  target.advancedExtras += source.advancedExtras;
}

function addCoverageMetrics(
  target: CoverageMetrics,
  source: CoverageMetrics
): void {
  target.expected += source.expected;
  target.readerPlaced += source.readerPlaced;
  target.advancedPlaced += source.advancedPlaced;
  target.readerMissing += source.readerMissing;
  target.advancedMissing += source.advancedMissing;
}

function finalizeScope(scope: ReferenceCoverageReport["totals"]): void {
  for (const reference of REFERENCES) {
    finalizeCoverage(scope.byReference[reference]);
  }
  for (const bucket of Object.keys(scope.consensus) as ConsensusBucket[]) {
    finalizeCoverage(scope.consensus[bucket]);
  }
}

function finalizeCoverage(metrics: CoverageMetrics): void {
  metrics.readerCoverage = roundRatio(
    metrics.readerPlaced / Math.max(1, metrics.expected)
  );
  metrics.advancedCoverage = roundRatio(
    metrics.advancedPlaced / Math.max(1, metrics.expected)
  );
}

function annotationCounts(
  annotations: StrongLedgerAnnotation[]
): Map<string, number> {
  return countStrongValues(annotations.map((annotation) => annotation.strong));
}

function countStrongValues(strongValues: string[] = []): Map<string, number> {
  const counts = new Map<string, number>();
  for (const strong of strongValues) {
    counts.set(strong, (counts.get(strong) ?? 0) + 1);
  }
  return counts;
}

function countRepresented(
  expected: Map<string, number>,
  actual: Map<string, number>
): number {
  let represented = 0;
  for (const [strong, count] of expected) {
    represented += Math.min(count, actual.get(strong) ?? 0);
  }
  return represented;
}

function countExtras(
  expected: Map<string, number>,
  actual: Map<string, number>
): number {
  let extras = 0;
  for (const [strong, count] of actual) {
    extras += Math.max(0, count - (expected.get(strong) ?? 0));
  }
  return extras;
}

function sumCounts(counts: Map<string, number>): number {
  return [...counts.values()].reduce((sum, count) => sum + count, 0);
}

function renderMarkdownReport(report: ReferenceCoverageReport): string {
  const lines = [
    `# Reference Strong Coverage - ${report.bible}`,
    "",
    `Generated: ${report.generatedAt}`,
    `Scope: ${report.scope}`,
    `Input: \`${report.inputPath}\``,
    "",
    "## By Reference",
    "",
    "| Reference | Expected | Reader placed | Reader coverage | Advanced placed | Advanced coverage | Reader extras | Advanced extras |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const reference of REFERENCES) {
    const metrics = report.totals.byReference[reference];
    lines.push(
      `| ${reference} | ${metrics.expected} | ${metrics.readerPlaced} | ${formatPercent(metrics.readerCoverage)} | ${metrics.advancedPlaced} | ${formatPercent(metrics.advancedCoverage)} | ${metrics.readerExtras} | ${metrics.advancedExtras} |`
    );
  }

  lines.push(
    "",
    "## Consensus",
    "",
    "| Support | Expected | Reader placed | Reader coverage | Advanced placed | Advanced coverage |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  );

  for (const [label, bucket] of [
    ["1/3", "oneOfThree"],
    ["2/3", "twoOfThree"],
    ["3/3", "threeOfThree"]
  ] as Array<[string, ConsensusBucket]>) {
    const metrics = report.totals.consensus[bucket];
    lines.push(
      `| ${label} | ${metrics.expected} | ${metrics.readerPlaced} | ${formatPercent(metrics.readerCoverage)} | ${metrics.advancedPlaced} | ${formatPercent(metrics.advancedCoverage)} |`
    );
  }

  lines.push("", "## Top Missing Reference Strong", "");

  if (report.topMissing.length === 0) {
    lines.push("No advanced missing Strong occurrences against references.");
  } else {
    lines.push(
      "| Reference | Strong | Expected | Reader missing | Advanced missing | Verses | Examples |",
      "| --- | --- | ---: | ---: | ---: | ---: | --- |"
    );
    for (const item of report.topMissing) {
      lines.push(
        `| ${item.reference} | ${item.strong} | ${item.expected} | ${item.readerMissing} | ${item.advancedMissing} | ${item.verses} | ${item.refs.slice(0, 8).join(", ")} |`
      );
    }
  }

  return `${lines.join("\n")}\n`;
}

async function readStrongLedger(ledgerPath: string): Promise<StrongLedger> {
  const ledger = JSON.parse(await readFile(ledgerPath, "utf8")) as StrongLedger;
  if (!ledger.split) return ledger;

  const verses = (
    await Promise.all(
      (ledger.verseFiles ?? []).map(async (file) => {
        return JSON.parse(
          await readFile(file.path, "utf8")
        ) as StrongLedger["verses"];
      })
    )
  ).flat();

  return { ...ledger, verses };
}

function refMatches(ref: string, scope: string): boolean {
  return ref === scope || ref.startsWith(`${scope}.`);
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function parseCliOptions(argv: string[]): CliOptions {
  const bible = readOption(argv, "--bible") ?? "nbs";
  const inputDir =
    readOption(argv, "--input-dir") ?? path.join("outputs", "strong", bible);
  const outputDir = readOption(argv, "--output-dir") ?? inputDir;
  return {
    bible,
    inputDir,
    outputDir,
    onlyRef: readOption(argv, "--only"),
    includeVerses: readBooleanOption(argv, "--include-verses", false),
    limitMissing: Number(readOption(argv, "--limit-missing") ?? 50)
  };
}

function readOption(argv: string[], name: string): string | undefined {
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === name) return argv[index + 1];
    if (arg?.startsWith(`${name}=`)) return arg.slice(name.length + 1);
  }
  return undefined;
}

function readBooleanOption(
  argv: string[],
  name: string,
  fallback: boolean
): boolean {
  const value = readOption(argv, name);
  if (value === undefined) return argv.includes(name) ? true : fallback;
  return value !== "false";
}

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  const report = await buildReferenceCoverageReport(options);
  const paths = await writeReferenceCoverageReport(report, options.outputDir);

  console.log(`Reference coverage JSON: ${paths.jsonPath}`);
  console.log(`Reference coverage report: ${paths.markdownPath}`);
  for (const reference of REFERENCES) {
    const metrics = report.totals.byReference[reference];
    console.log(
      `${reference}: reader ${metrics.readerPlaced}/${metrics.expected} (${formatPercent(metrics.readerCoverage)}); advanced ${metrics.advancedPlaced}/${metrics.expected} (${formatPercent(metrics.advancedCoverage)})`
    );
  }
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("src/referenceCoverageReport.ts")
) {
  await main();
}
