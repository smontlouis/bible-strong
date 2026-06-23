import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { tsvEscape } from "./render.js";
import { referenceKey } from "./strongCsv.js";
import {
  normalizeClassicalStrong,
  readStepOriginalIndex,
  type StepStrongCandidates,
  type StepOriginalIndex
} from "./stepOriginals.js";
import { escapeHtml, normalizeWord, stripTags } from "./tokenize.js";

interface EnrichOptions {
  bibleIds: string[];
  outputDir: string;
  stepDir: string;
  reportPath: string;
}

interface BibleInput {
  id: string;
  inputPath: string;
  outputPath: string;
}

interface EnrichmentMetrics {
  bible: string;
  inputPath: string;
  outputPath: string;
  verseCount: number;
  taggedTokenCount: number;
  resolvedTokenCount: number;
  partialTokenCount: number;
  ambiguousTokenCount: number;
  unresolvedTokenCount: number;
  missingVerseTokenCount: number;
  stepStrongOccurrenceCount: number;
  occurrenceResolvedTokenCount: number;
  lexiconResolvedTokenCount: number;
  ambiguousStrongCounts: Record<string, number>;
  unresolvedStrongCounts: Record<string, number>;
  resolvedRate: number;
  source: string;
}

interface StepSurfaceLexicon {
  entries: Map<string, StepSurfaceLexiconEntry>;
  acceptedEntryCount: number;
  evidenceEntryCount: number;
}

interface StepSurfaceLexiconEntry {
  baseStrong: string;
  normalized: string;
  stepStrong: string;
  count: number;
  total: number;
  dominance: number;
}

const DEFAULT_BIBLES = [
  "darby",
  "darbyr",
  "sg1910",
  "bds",
  "bfc",
  "fmar",
  "frc97",
  "nfc",
  "ost",
  "nvs78p"
];

const WEAK_SURFACE_WORDS = new Set([
  "a",
  "au",
  "aux",
  "ce",
  "ces",
  "cet",
  "cette",
  "de",
  "des",
  "du",
  "elle",
  "elles",
  "en",
  "et",
  "il",
  "ils",
  "je",
  "la",
  "le",
  "les",
  "leur",
  "leurs",
  "lui",
  "ne",
  "nous",
  "on",
  "ou",
  "par",
  "pas",
  "pour",
  "que",
  "qui",
  "sa",
  "se",
  "ses",
  "son",
  "sur",
  "tu",
  "un",
  "une",
  "vous",
  "y"
]);

async function main(): Promise<void> {
  const options = parseCliOptions(process.argv.slice(2));
  await mkdir(options.outputDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const stepFiles = findStepOriginalFiles(options.stepDir);
  if (stepFiles.length === 0) {
    throw new Error(
      `No TAHOT/TAGNT files found in ${options.stepDir}. Download STEP amalgamated originals first.`
    );
  }

  const stepIndex = await readStepOriginalIndex(stepFiles);
  const inputs = options.bibleIds.map((id) =>
    resolveBibleInput(id, options.outputDir)
  );
  const existingInputs = inputs.filter((input) => existsSync(input.inputPath));
  const stepSurfaceLexicon = buildStepSurfaceLexicon({
    inputs: existingInputs,
    stepIndex
  });
  const metrics: EnrichmentMetrics[] = [];

  for (const input of existingInputs) {
    const result = await enrichBible({ input, stepIndex, stepSurfaceLexicon });
    metrics.push(result);
    console.log(
      `[${input.id}] ${result.resolvedTokenCount}/${result.taggedTokenCount} tags resolved -> ${input.outputPath}`
    );
  }
  for (const input of inputs) {
    if (!existsSync(input.inputPath)) {
      console.log(`[${input.id}] skip missing ${input.inputPath}`);
    }
  }

  await writeFile(
    options.reportPath,
    renderReport(metrics, stepFiles, stepSurfaceLexicon),
    "utf8"
  );
  console.log(`Report: ${options.reportPath}`);
}

async function enrichBible(options: {
  input: BibleInput;
  stepIndex: StepOriginalIndex;
  stepSurfaceLexicon: StepSurfaceLexicon;
}): Promise<EnrichmentMetrics> {
  const content = readFileSync(options.input.inputPath, "utf8");
  const lines = content.split(/\r?\n/u).filter((line) => line.length > 0);
  const header = lines.shift();
  if (header !== "book_id\tnum_chapter\tnum_verse\ttext") {
    throw new Error(`Unexpected TSV header in ${options.input.inputPath}`);
  }

  const outputLines = ["book_id\tnum_chapter\tnum_verse\ttext"];
  const counters = {
    verseCount: 0,
    taggedTokenCount: 0,
    resolvedTokenCount: 0,
    partialTokenCount: 0,
    ambiguousTokenCount: 0,
    unresolvedTokenCount: 0,
    missingVerseTokenCount: 0,
    stepStrongOccurrenceCount: 0,
    occurrenceResolvedTokenCount: 0,
    lexiconResolvedTokenCount: 0,
    ambiguousStrongCounts: {} as Record<string, number>,
    unresolvedStrongCounts: {} as Record<string, number>
  };

  for (const line of lines) {
    const [bookId, chapter, verse, ...textParts] = line.split("\t");
    const text = textParts.join("\t");
    if (!bookId || !chapter || !verse) continue;

    counters.verseCount += 1;
    const ref = referenceKey(bookId, chapter, verse);
    const verseIndex = options.stepIndex.get(ref);
    const strongText = enrichTaggedText({
      text,
      verseIndex,
      stepSurfaceLexicon: options.stepSurfaceLexicon,
      counters
    });
    outputLines.push(
      [bookId, chapter, verse, tsvEscape(strongText)].join("\t")
    );
  }

  await writeFile(options.input.outputPath, `${outputLines.join("\n")}\n`);

  return {
    bible: options.input.id,
    inputPath: options.input.inputPath,
    outputPath: options.input.outputPath,
    ...counters,
    resolvedRate: roundRatio(
      counters.resolvedTokenCount / Math.max(1, counters.taggedTokenCount)
    ),
    source:
      "TAHOT/TAGNT verse-level unique + occurrence-order + surface-lexicon Strong enrichment"
  };
}

function enrichTaggedText(options: {
  text: string;
  verseIndex: Map<string, StepStrongCandidates> | undefined;
  stepSurfaceLexicon: StepSurfaceLexicon;
  counters: Omit<
    EnrichmentMetrics,
    | "bible"
    | "inputPath"
    | "outputPath"
    | "resolvedRate"
    | "source"
    | "verseCount"
  >;
}): string {
  const targetCounts = countTargetStrongOccurrences(options.text);
  const seen = new Map<string, number>();

  return options.text.replace(
    /<w\b([^>]*)>([\s\S]*?)<\/w>/giu,
    (match, attrs, body) => {
      const strongValue = parseAttribute(String(attrs), "strong");
      if (!strongValue) return match;
      const tokenNormalized = normalizeTokenBody(String(body));

      options.counters.taggedTokenCount += 1;
      const analysis = analyzeStrongValue({
        strongValue,
        verseIndex: options.verseIndex,
        targetCounts,
        seen,
        tokenNormalized,
        stepSurfaceLexicon: options.stepSurfaceLexicon
      });
      options.counters.stepStrongOccurrenceCount += analysis.stepStrong.length;
      if (analysis.status === "resolved")
        options.counters.resolvedTokenCount += 1;
      if (analysis.status === "partial")
        options.counters.partialTokenCount += 1;
      if (analysis.status === "ambiguous") {
        options.counters.ambiguousTokenCount += 1;
      }
      if (analysis.status === "unresolved") {
        options.counters.unresolvedTokenCount += 1;
      }
      if (analysis.status === "missing-verse") {
        options.counters.missingVerseTokenCount += 1;
      }
      if (analysis.method === "step-verse-strong-occurrence-order") {
        options.counters.occurrenceResolvedTokenCount += 1;
      }
      if (analysis.method === "step-strong-surface-lexicon") {
        options.counters.lexiconResolvedTokenCount += 1;
      }
      for (const ambiguousStrong of analysis.ambiguousStrong) {
        const [baseStrong] = ambiguousStrong.split(":", 1);
        incrementCount(options.counters.ambiguousStrongCounts, baseStrong);
      }
      for (const unresolvedStrong of analysis.unresolvedStrong) {
        incrementCount(
          options.counters.unresolvedStrongCounts,
          unresolvedStrong
        );
      }

      const nextAttrs = stripStepAttributes(String(attrs));
      const stepAttributes = [
        analysis.stepStrong.length > 0
          ? `data-step-strong="${escapeHtml(analysis.stepStrong.join(" "))}"`
          : undefined,
        `data-step-status="${analysis.status}"`,
        `data-step-method="${analysis.method}"`,
        analysis.ambiguousStrong.length > 0
          ? `data-step-ambiguous="${escapeHtml(analysis.ambiguousStrong.join(" "))}"`
          : undefined
      ].filter(Boolean);

      return `<w${nextAttrs}${nextAttrs.trim() ? " " : ""}${stepAttributes.join(
        " "
      )}>${body}</w>`;
    }
  );
}

function analyzeStrongValue(options: {
  strongValue: string;
  verseIndex: Map<string, StepStrongCandidates> | undefined;
  targetCounts: Map<string, number>;
  seen: Map<string, number>;
  tokenNormalized: string;
  stepSurfaceLexicon?: StepSurfaceLexicon;
}): {
  status: "resolved" | "partial" | "ambiguous" | "unresolved" | "missing-verse";
  stepStrong: string[];
  ambiguousStrong: string[];
  unresolvedStrong: string[];
  method: string;
} {
  if (!options.verseIndex) {
    return {
      status: "missing-verse",
      stepStrong: [],
      ambiguousStrong: [],
      unresolvedStrong: [],
      method: "step-verse-missing"
    };
  }

  const resolved: string[] = [];
  const ambiguous: string[] = [];
  const unresolvedStrong: string[] = [];
  let unresolved = 0;
  let usedOccurrenceOrder = false;
  let usedSurfaceLexicon = false;

  for (const rawStrong of options.strongValue.split(/\s+/u).filter(Boolean)) {
    const baseStrong = normalizeClassicalStrong(rawStrong);
    if (!baseStrong) {
      unresolved += 1;
      unresolvedStrong.push(rawStrong);
      continue;
    }
    const candidate = options.verseIndex.get(baseStrong);
    const candidates = [...(candidate?.unique ?? [])].sort();
    if (!candidate || candidates.length === 0) {
      unresolved += 1;
      unresolvedStrong.push(baseStrong);
      continue;
    }

    const currentSeen = options.seen.get(baseStrong) ?? 0;
    options.seen.set(baseStrong, currentSeen + 1);

    if (candidates.length === 1) {
      resolved.push(candidates[0] ?? "");
    } else if (
      candidate.occurrences.length === options.targetCounts.get(baseStrong)
    ) {
      const occurrenceStrong = candidate.occurrences[currentSeen];
      if (occurrenceStrong) {
        resolved.push(occurrenceStrong);
        usedOccurrenceOrder = true;
      } else {
        ambiguous.push(`${baseStrong}:${candidates.join("|")}`);
      }
    } else if (candidates.length > 1) {
      const lexiconCandidate = resolveSurfaceLexiconCandidate({
        baseStrong,
        normalized: options.tokenNormalized,
        candidates,
        stepSurfaceLexicon: options.stepSurfaceLexicon
      });
      if (lexiconCandidate) {
        resolved.push(lexiconCandidate);
        usedSurfaceLexicon = true;
      } else {
        ambiguous.push(`${baseStrong}:${candidates.join("|")}`);
      }
    } else {
      unresolved += 1;
    }
  }

  if (ambiguous.length > 0) {
    return {
      status: "ambiguous",
      stepStrong: unique(resolved),
      ambiguousStrong: ambiguous,
      unresolvedStrong,
      method: "step-verse-strong-ambiguous"
    };
  }
  if (resolved.length > 0 && unresolved === 0) {
    return {
      status: "resolved",
      stepStrong: unique(resolved),
      ambiguousStrong: [],
      unresolvedStrong: [],
      method: usedSurfaceLexicon
        ? "step-strong-surface-lexicon"
        : usedOccurrenceOrder
          ? "step-verse-strong-occurrence-order"
          : "step-verse-strong-unique"
    };
  }
  if (resolved.length > 0) {
    return {
      status: "partial",
      stepStrong: unique(resolved),
      ambiguousStrong: [],
      unresolvedStrong,
      method: "step-verse-strong-partial"
    };
  }
  return {
    status: "unresolved",
    stepStrong: [],
    ambiguousStrong: [],
    unresolvedStrong,
    method: "step-verse-strong-unresolved"
  };
}

function buildStepSurfaceLexicon(options: {
  inputs: BibleInput[];
  stepIndex: StepOriginalIndex;
}): StepSurfaceLexicon {
  const evidence = new Map<string, Map<string, number>>();

  for (const input of options.inputs) {
    const content = readFileSync(input.inputPath, "utf8");
    const lines = content.split(/\r?\n/u).filter((line) => line.length > 0);
    lines.shift();

    for (const line of lines) {
      const [bookId, chapter, verse, ...textParts] = line.split("\t");
      const text = textParts.join("\t");
      if (!bookId || !chapter || !verse) continue;

      const verseIndex = options.stepIndex.get(
        referenceKey(bookId, chapter, verse)
      );
      if (!verseIndex) continue;

      const targetCounts = countTargetStrongOccurrences(text);
      const seen = new Map<string, number>();

      for (const match of text.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
        const attrs = match[1] ?? "";
        const strongValue = parseAttribute(attrs, "strong");
        if (!strongValue || parseAttribute(attrs, "data-empty") === "true")
          continue;

        const tokenNormalized = normalizeTokenBody(match[2] ?? "");
        if (!isSurfaceLexiconEligible(tokenNormalized)) continue;

        const baseStrongValues = unique(
          strongValue
            .split(/\s+/u)
            .map((strong) => normalizeClassicalStrong(strong))
            .filter((strong): strong is string => Boolean(strong))
        );
        if (baseStrongValues.length !== 1) continue;

        const analysis = analyzeStrongValue({
          strongValue,
          verseIndex,
          targetCounts,
          seen,
          tokenNormalized
        });
        if (
          analysis.status !== "resolved" ||
          analysis.stepStrong.length !== 1 ||
          analysis.method === "step-strong-surface-lexicon"
        ) {
          continue;
        }

        const key = surfaceLexiconKey(
          baseStrongValues[0] ?? "",
          tokenNormalized
        );
        const counts = getOrInsert(
          evidence,
          key,
          () => new Map<string, number>()
        );
        incrementMapCount(counts, analysis.stepStrong[0] ?? "");
      }
    }
  }

  const entries = new Map<string, StepSurfaceLexiconEntry>();
  for (const [key, counts] of evidence) {
    const ranked = [...counts.entries()].sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    );
    const [stepStrong, count] = ranked[0] ?? [];
    if (!stepStrong || !count) continue;

    const total = ranked.reduce((sum, [, value]) => sum + value, 0);
    const dominance = count / Math.max(1, total);
    const [baseStrong = "", normalized = ""] = key.split("\t", 2);
    const minimumCount = WEAK_SURFACE_WORDS.has(normalized) ? 25 : 5;
    const minimumDominance = WEAK_SURFACE_WORDS.has(normalized) ? 0.995 : 0.985;

    if (count < minimumCount || dominance < minimumDominance) continue;

    entries.set(key, {
      baseStrong,
      normalized,
      stepStrong,
      count,
      total,
      dominance
    });
  }

  return {
    entries,
    acceptedEntryCount: entries.size,
    evidenceEntryCount: evidence.size
  };
}

function resolveSurfaceLexiconCandidate(options: {
  baseStrong: string;
  normalized: string;
  candidates: string[];
  stepSurfaceLexicon: StepSurfaceLexicon | undefined;
}): string | undefined {
  if (
    !options.stepSurfaceLexicon ||
    !isSurfaceLexiconEligible(options.normalized)
  ) {
    return undefined;
  }

  const entry = options.stepSurfaceLexicon.entries.get(
    surfaceLexiconKey(options.baseStrong, options.normalized)
  );
  if (!entry || !options.candidates.includes(entry.stepStrong))
    return undefined;
  return entry.stepStrong;
}

function normalizeTokenBody(body: string): string {
  return normalizeWord(stripTags(body));
}

function countTargetStrongOccurrences(text: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const match of text.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
    const strongValue = parseAttribute(match[1] ?? "", "strong");
    if (!strongValue) continue;
    for (const rawStrong of strongValue.split(/\s+/u).filter(Boolean)) {
      const baseStrong = normalizeClassicalStrong(rawStrong);
      if (!baseStrong) continue;
      counts.set(baseStrong, (counts.get(baseStrong) ?? 0) + 1);
    }
  }
  return counts;
}

function resolveBibleInput(id: string, outputDir: string): BibleInput {
  const referencePath = path.join(
    outputDir,
    `bible-${id}-strong-reference.tsv`
  );
  const diagnosticPath = path.join(
    outputDir,
    `bible-${id}-strong-diagnostic.tsv`
  );
  const inputPath = existsSync(referencePath) ? referencePath : diagnosticPath;
  return {
    id,
    inputPath,
    outputPath: path.join(outputDir, `bible-${id}-strong-step.tsv`)
  };
}

function findStepOriginalFiles(stepDir: string): string[] {
  const candidates = [
    "TAHOT Gen-Deu.txt",
    "TAHOT Jos-Est.txt",
    "TAHOT Job-Sng.txt",
    "TAHOT Isa-Mal.txt",
    "TAGNT Mat-Jhn.txt",
    "TAGNT Act-Rev.txt"
  ].map((fileName) => path.join(stepDir, fileName));
  return candidates.filter((candidate) => existsSync(candidate));
}

function renderReport(
  metrics: EnrichmentMetrics[],
  stepFiles: string[],
  stepSurfaceLexicon: StepSurfaceLexicon
): string {
  const lines = [
    "# STEP Strong TSV Enrichment Report",
    "",
    `Generated: ${new Date().toISOString()}`,
    "",
    "## Sources",
    "",
    "- Repository: https://github.com/STEPBible/STEPBible-Data",
    "- License: CC BY 4.0, as stated in the downloaded TAHOT/TAGNT files.",
    ...stepFiles.map((filePath) => `- ${filePath}`),
    "",
    "## Summary",
    "",
    "| Bible | Tagged tokens | Resolved | Occurrence-order | Surface lexicon | Partial | Ambiguous | Unresolved | Missing verse | STEP occurrences | Resolved rate |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |"
  ];

  for (const metric of metrics) {
    lines.push(
      [
        metric.bible,
        metric.taggedTokenCount,
        metric.resolvedTokenCount,
        metric.occurrenceResolvedTokenCount,
        metric.lexiconResolvedTokenCount,
        metric.partialTokenCount,
        metric.ambiguousTokenCount,
        metric.unresolvedTokenCount,
        metric.missingVerseTokenCount,
        metric.stepStrongOccurrenceCount,
        `${(metric.resolvedRate * 100).toFixed(2)}%`
      ].join(" | ")
    );
  }

  lines.push(
    "",
    "## Occurrence-Order Resolution",
    "",
    "This pass resolves repeated classical Strong codes when the target TSV and STEP original have the same number of occurrences in a verse. This is useful for STEP subcodes such as `H0776G`/`H0776H` where the verse has multiple `H0776` tokens and the order is the safest deterministic signal.",
    "",
    "| Bible | Occurrence-order tokens | Share of resolved |",
    "| --- | ---: | ---: |"
  );

  for (const metric of metrics) {
    lines.push(
      [
        metric.bible,
        metric.occurrenceResolvedTokenCount,
        `${(
          metric.occurrenceResolvedTokenCount /
          Math.max(1, metric.resolvedTokenCount)
        ).toLocaleString("en-US", {
          maximumFractionDigits: 4,
          style: "percent"
        })}`
      ].join(" | ")
    );
  }

  lines.push(
    "",
    "## Surface-Lexicon Resolution",
    "",
    `Accepted entries: ${stepSurfaceLexicon.acceptedEntryCount} / ${stepSurfaceLexicon.evidenceEntryCount} evidence entries.`,
    "",
    "This pass learns from already safe STEP resolutions. It applies only when a `(classical Strong + normalized French surface)` pair strongly dominates one STEP dStrong and that dStrong is one of the verse candidates.",
    "",
    "| Bible | Surface-lexicon tokens | Share of resolved |",
    "| --- | ---: | ---: |"
  );

  for (const metric of metrics) {
    lines.push(
      [
        metric.bible,
        metric.lexiconResolvedTokenCount,
        `${(
          metric.lexiconResolvedTokenCount /
          Math.max(1, metric.resolvedTokenCount)
        ).toLocaleString("en-US", {
          maximumFractionDigits: 4,
          style: "percent"
        })}`
      ].join(" | ")
    );
  }

  const topSurfaceEntries = [...stepSurfaceLexicon.entries.values()]
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.stepStrong.localeCompare(right.stepStrong)
    )
    .slice(0, 30);
  if (topSurfaceEntries.length > 0) {
    lines.push(
      "",
      "### Top Accepted Surface Entries",
      "",
      "| Strong | Surface | STEP dStrong | Count | Dominance |",
      "| --- | --- | --- | ---: | ---: |",
      ...topSurfaceEntries.map((entry) =>
        [
          entry.baseStrong,
          entry.normalized,
          entry.stepStrong,
          entry.count,
          `${(entry.dominance * 100).toFixed(2)}%`
        ].join(" | ")
      )
    );
  }

  const topAmbiguous = topCounts(metrics, "ambiguousStrongCounts", 30);
  if (topAmbiguous.length > 0) {
    lines.push(
      "",
      "## Top Remaining Ambiguous Classical Strong Codes",
      "",
      "| Strong | Token count |",
      "| --- | ---: |",
      ...topAmbiguous.map(([strong, count]) => `${strong} | ${count}`)
    );
  }

  const topUnresolved = topCounts(metrics, "unresolvedStrongCounts", 30);
  if (topUnresolved.length > 0) {
    lines.push(
      "",
      "## Top Unresolved Classical Strong Codes",
      "",
      "| Strong | Token count |",
      "| --- | ---: |",
      ...topUnresolved.map(([strong, count]) => `${strong} | ${count}`)
    );
  }

  lines.push(
    "",
    "## Method",
    "",
    "- The classical `strong` attribute is preserved for compatibility.",
    "- `data-step-strong` is added when the verse contains a unique STEP candidate for the same classical Strong code.",
    "- Repeated or semantically split candidates are resolved by occurrence order only when the target verse and STEP original have the same occurrence count for that classical Strong.",
    "- Remaining ambiguous candidates can be resolved by the strict surface lexicon when safe prior evidence strongly maps the same French form and classical Strong to a STEP dStrong.",
    '- Repeated or semantically split candidates with mismatched counts are marked `data-step-status="ambiguous"`.',
    '- Missing candidates are marked `data-step-status="unresolved"`; no Strong code is removed.',
    ""
  );

  return `${lines.join("\n")}`;
}

function parseAttribute(attributes: string, name: string): string | undefined {
  const match = attributes.match(
    new RegExp(`\\b${name}=(["'])([\\s\\S]*?)\\1`, "iu")
  );
  return match?.[2];
}

function stripStepAttributes(attributes: string): string {
  return attributes
    .replace(/\sdata-step-[a-z-]+=(["'])([\s\S]*?)\1/giu, "")
    .trimEnd();
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

function incrementCount(
  counts: Record<string, number>,
  key: string | undefined
): void {
  if (!key) return;
  counts[key] = (counts[key] ?? 0) + 1;
}

function incrementMapCount(
  counts: Map<string, number>,
  key: string | undefined
): void {
  if (!key) return;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function getOrInsert<K, V>(map: Map<K, V>, key: K, factory: () => V): V {
  const existing = map.get(key);
  if (existing) return existing;
  const next = factory();
  map.set(key, next);
  return next;
}

function surfaceLexiconKey(baseStrong: string, normalized: string): string {
  return `${baseStrong}\t${normalized}`;
}

function isSurfaceLexiconEligible(normalized: string): boolean {
  return normalized.length >= 2 && /[\p{L}\p{N}]/u.test(normalized);
}

function topCounts(
  metrics: EnrichmentMetrics[],
  key: "ambiguousStrongCounts" | "unresolvedStrongCounts",
  limit: number
): [string, number][] {
  const counts: Record<string, number> = {};
  for (const metric of metrics) {
    for (const [strong, count] of Object.entries(metric[key])) {
      counts[strong] = (counts[strong] ?? 0) + count;
    }
  }
  return Object.entries(counts)
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0])
    )
    .slice(0, limit);
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function parseCliOptions(argv: string[]): EnrichOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg?.startsWith("--")) continue;
    const [key, inlineValue] = arg.slice(2).split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!inlineValue) index += 1;
    if (key && value) args.set(key, value);
  }

  const bibleArg = args.get("bible") ?? "all";
  const bibleIds =
    bibleArg === "all"
      ? DEFAULT_BIBLES
      : bibleArg
          .split(",")
          .map((id) => id.trim().toLowerCase())
          .filter(Boolean);

  return {
    bibleIds,
    outputDir: args.get("output-dir") ?? "outputs",
    stepDir: args.get("step-dir") ?? "data/external/stepbible/amalgamated",
    reportPath: args.get("report") ?? "reports/step-strong-enrichment-report.md"
  };
}

await main();
