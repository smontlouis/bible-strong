import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { createGunzip } from "node:zlib";
import { createReadStream } from "node:fs";
import readline from "node:readline";

import { BOOK_IDS } from "./books.js";
import { readStrongDictionaryTranslationCandidates } from "./strongDictionaryLexicon.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";
import { type StrongTranslationCandidate } from "./translationLexicon.js";
import { type StrongLedger } from "./strongLedger.js";

interface CliOptions {
  bible: string;
  onlyRef?: string;
  inputDir: string;
  outputDir: string;
  ledgerPath?: string;
  kaikkiPath?: string;
  jdmCacheDir?: string;
  fetchJdm: boolean;
  fetchJdmLimit: number;
  openOfficePath?: string;
  wolfPath?: string;
  maxCandidatesPerEmpty: number;
}

interface SourceConfig {
  strongDictionary: boolean;
  kaikki?: string;
  rezoJdmCache?: string;
  rezoJdmFetch: boolean;
  openOffice?: string;
  wolf?: string;
}

export interface LexicalCandidateReport {
  bible: string;
  generatedAt: string;
  inputPath: string;
  scope: string;
  sources: SourceConfig;
  metrics: {
    verses: number;
    emptyAnnotations: number;
    emptyWithCandidates: number;
    candidateCount: number;
    highConfidenceCandidates: number;
  };
  items: LexicalCandidateItem[];
}

export interface LexicalCandidateItem {
  ref: string;
  text: string;
  strong: string;
  sourceStrong?: string;
  insertAfterWordIndex?: number;
  stepGlosses: string[];
  dictionaryTerms: string[];
  inferredTerms: string[];
  candidates: LexicalCandidate[];
}

export interface LexicalCandidate {
  wordIndex: number;
  text: string;
  normalized: string;
  lemma: string;
  score: number;
  confidence: "high" | "medium" | "low";
  occupied: boolean;
  evidence: CandidateEvidence[];
}

interface CandidateEvidence {
  source: string;
  detail: string;
  weight: number;
}

interface KaikkiIndex {
  formToLemma: Map<string, string>;
  lemmaGlossTokens: Map<string, Set<string>>;
  englishGlossToFrench: Map<string, Set<string>>;
}

interface KaikkiEntry {
  word?: unknown;
  lang_code?: unknown;
  forms?: Array<{ form?: unknown }>;
  senses?: KaikkiSense[];
}

interface KaikkiSense {
  glosses?: unknown;
  form_of?: Array<{ word?: unknown }>;
}

interface SynonymSource {
  name: string;
  synonymsByLemma: Map<string, Map<string, number>>;
}

interface BuildOptions extends CliOptions {
  dictionaryCandidates?: StrongTranslationCandidate[];
}

const FUNCTION_WORDS = new Set([
  "a",
  "au",
  "aux",
  "avec",
  "ce",
  "ces",
  "cet",
  "cette",
  "dans",
  "de",
  "des",
  "du",
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
  "ou",
  "par",
  "pas",
  "pour",
  "qu",
  "que",
  "qui",
  "sans",
  "se",
  "son",
  "sur",
  "un",
  "une"
]);

const HIGH_CONFIDENCE_THRESHOLD = 0.72;
const MEDIUM_CONFIDENCE_THRESHOLD = 0.48;

export async function buildLexicalCandidateReport(
  options: BuildOptions
): Promise<LexicalCandidateReport> {
  const inputPath =
    options.ledgerPath ??
    path.join(options.inputDir, `bible-${options.bible}-strong-ledger.json`);
  const ledger = await readStrongLedger(inputPath);
  const verses = ledger.verses.filter((verse) =>
    options.onlyRef ? verseMatchesScope(verse, options.onlyRef) : true
  );
  const dictionaryCandidates =
    options.dictionaryCandidates ?? readStrongDictionaryTranslationCandidates();
  const dictionaryByStrong = groupDictionaryTerms(dictionaryCandidates);
  const emptyAnnotations = verses.flatMap((verse) =>
    verse.annotations
      .filter(isCandidateEmptyAnnotation)
      .map((annotation) => ({ verse, annotation }))
  );
  const targetWords = new Set(
    verses.flatMap((verse) =>
      verse.tokens
        .filter((token) => isContentWord(token.normalized))
        .map((token) => token.normalized)
    )
  );
  const englishHints = new Set(
    emptyAnnotations.flatMap(({ annotation }) =>
      stepGlossTokens(annotation.step?.map((step) => step.gloss) ?? [])
    )
  );
  const kaikki = options.kaikkiPath
    ? await readKaikkiIndex(options.kaikkiPath, targetWords, englishHints)
    : emptyKaikkiIndex();
  const synonymSources = await readSynonymSources(options, {
    targetWords: new Set([...targetWords, ...kaikki.formToLemma.values()]),
    dictionaryTerms: new Set(
      [...dictionaryByStrong.values()].flatMap((terms) => [...terms.keys()])
    ),
    inferredTerms: new Set(
      [...kaikki.englishGlossToFrench.values()].flatMap((terms) => [...terms])
    )
  });

  const items = emptyAnnotations.map(({ verse, annotation }) =>
    buildCandidateItem({
      verse,
      annotation,
      dictionaryTerms: dictionaryByStrong.get(annotation.strong) ?? new Map(),
      kaikki,
      synonymSources,
      maxCandidates: options.maxCandidatesPerEmpty
    })
  );

  const candidateCount = items.reduce(
    (sum, item) => sum + item.candidates.length,
    0
  );
  const highConfidenceCandidates = items.reduce(
    (sum, item) =>
      sum +
      item.candidates.filter((candidate) => candidate.confidence === "high")
        .length,
    0
  );

  return {
    bible: options.bible,
    generatedAt: new Date().toISOString(),
    inputPath,
    scope: options.onlyRef ?? "all",
    sources: {
      strongDictionary: true,
      kaikki: options.kaikkiPath,
      rezoJdmCache: options.jdmCacheDir,
      rezoJdmFetch: options.fetchJdm,
      openOffice: options.openOfficePath,
      wolf: options.wolfPath
    },
    metrics: {
      verses: verses.length,
      emptyAnnotations: emptyAnnotations.length,
      emptyWithCandidates: items.filter((item) => item.candidates.length > 0)
        .length,
      candidateCount,
      highConfidenceCandidates
    },
    items
  };
}

export async function writeLexicalCandidateReport(
  report: LexicalCandidateReport,
  outputDir: string
): Promise<{ jsonPath: string; markdownPath: string }> {
  await mkdir(outputDir, { recursive: true });
  const scopeSlug = report.scope.replace(/[^\p{L}\p{N}.-]+/gu, "_");
  const jsonPath = path.join(
    outputDir,
    `bible-${report.bible}-lexical-candidates-${scopeSlug}.json`
  );
  const markdownPath = path.join(
    outputDir,
    `bible-${report.bible}-lexical-candidates-${scopeSlug}.md`
  );

  await Promise.all([
    writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(markdownPath, renderMarkdownReport(report), "utf8")
  ]);

  return { jsonPath, markdownPath };
}

function buildCandidateItem(options: {
  verse: StrongLedger["verses"][number];
  annotation: StrongLedger["verses"][number]["annotations"][number];
  dictionaryTerms: Map<string, number>;
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
  maxCandidates: number;
}): LexicalCandidateItem {
  const stepGlosses = options.annotation.step?.map((step) => step.gloss) ?? [];
  const englishHints = stepGlossTokens(stepGlosses);
  const inferredTerms = inferredFrenchTerms(englishHints, options.kaikki);
  const seedTerms = new Map<string, number>();

  for (const [term, score] of options.dictionaryTerms) {
    seedTerms.set(term, Math.max(seedTerms.get(term) ?? 0, score));
  }
  for (const term of inferredTerms) {
    seedTerms.set(term, Math.max(seedTerms.get(term) ?? 0, 0.42));
  }

  const candidates = options.verse.tokens
    .filter((token) => isContentWord(token.normalized))
    .map((token) =>
      scoreTargetToken({
        token,
        verse: options.verse,
        seedTerms,
        englishHints,
        annotation: options.annotation,
        kaikki: options.kaikki,
        synonymSources: options.synonymSources
      })
    )
    .filter((candidate): candidate is LexicalCandidate => Boolean(candidate))
    .sort(
      (left, right) =>
        right.score - left.score ||
        Number(left.occupied) - Number(right.occupied) ||
        left.wordIndex - right.wordIndex
    )
    .slice(0, options.maxCandidates);

  return {
    ref: options.verse.ref,
    text: options.verse.text,
    strong: options.annotation.strong,
    sourceStrong: options.annotation.sourceStrong,
    insertAfterWordIndex: options.annotation.insertAfterWordIndex,
    stepGlosses,
    dictionaryTerms: [...options.dictionaryTerms.keys()].slice(0, 20),
    inferredTerms: [...inferredTerms].slice(0, 30),
    candidates
  };
}

function scoreTargetToken(options: {
  token: StrongLedger["verses"][number]["tokens"][number];
  verse: StrongLedger["verses"][number];
  seedTerms: Map<string, number>;
  englishHints: string[];
  annotation: StrongLedger["verses"][number]["annotations"][number];
  kaikki: KaikkiIndex;
  synonymSources: SynonymSource[];
}): LexicalCandidate | undefined {
  const lemma = lemmaForToken(options.token.normalized, options.kaikki);
  const evidence: CandidateEvidence[] = [];

  const exactSeedScore =
    Math.max(
      options.seedTerms.get(options.token.normalized) ?? 0,
      options.seedTerms.get(lemma) ?? 0
    ) || 0;
  if (exactSeedScore > 0) {
    evidence.push({
      source: "seed-term",
      detail: `${lemma} matches Strong lexical hint`,
      weight: Math.min(0.5, 0.26 + exactSeedScore * 0.4)
    });
  }

  const glossOverlap = overlapCount(
    options.kaikki.lemmaGlossTokens.get(lemma) ?? new Set(),
    new Set(options.englishHints)
  );
  if (glossOverlap > 0) {
    evidence.push({
      source: "kaikki-gloss",
      detail: `${lemma} gloss overlaps ${options.englishHints.join(", ")}`,
      weight: Math.min(0.32, 0.16 + glossOverlap * 0.08)
    });
  }

  for (const source of options.synonymSources) {
    const synonymEvidence = synonymSourceEvidence(
      source,
      lemma,
      options.seedTerms
    );
    if (synonymEvidence) evidence.push(synonymEvidence);
  }

  if (evidence.length === 0) return undefined;

  const occupied = isWordOccupied(options.verse, options.token.wordIndex);
  const position = positionScore(
    options.annotation.insertAfterWordIndex,
    options.token.wordIndex,
    options.verse.tokens.length
  );
  const sourceDiversity = new Set(evidence.map((item) => item.source)).size;
  const rawScore =
    evidence.reduce((sum, item) => sum + item.weight, 0) +
    position * 0.12 +
    Math.min(0.14, (sourceDiversity - 1) * 0.07) -
    (occupied ? 0.34 : 0);
  const score = roundRatio(Math.max(0, Math.min(1, rawScore)));

  return {
    wordIndex: options.token.wordIndex,
    text: options.token.text,
    normalized: options.token.normalized,
    lemma,
    score,
    confidence:
      score >= HIGH_CONFIDENCE_THRESHOLD
        ? "high"
        : score >= MEDIUM_CONFIDENCE_THRESHOLD
          ? "medium"
          : "low",
    occupied,
    evidence
  };
}

function synonymSourceEvidence(
  source: SynonymSource,
  lemma: string,
  seedTerms: Map<string, number>
): CandidateEvidence | undefined {
  const targetSynonyms = source.synonymsByLemma.get(lemma);
  const seedTermSet = new Set(seedTerms.keys());
  const matchingTargetSynonym = bestWeightedIntersection(
    targetSynonyms,
    seedTermSet
  );
  if (matchingTargetSynonym) {
    return {
      source: source.name,
      detail: `${lemma} links to seed ${matchingTargetSynonym.term}`,
      weight: weightedSynonymScore(matchingTargetSynonym.weight, source.name)
    };
  }

  for (const seed of seedTermSet) {
    const seedSynonyms = source.synonymsByLemma.get(seed);
    const weight = seedSynonyms?.get(lemma);
    if (weight && weight > 0) {
      return {
        source: source.name,
        detail: `${seed} links to target ${lemma}`,
        weight: weightedSynonymScore(weight, source.name)
      };
    }
  }

  return undefined;
}

function weightedSynonymScore(weight: number, source: string): number {
  const normalized = weight > 1 ? Math.min(1, weight / 500) : weight;
  const base = source === "rezojdm" ? 0.24 : 0.18;
  const scale = source === "rezojdm" ? 0.32 : 0.22;
  return base + normalized * scale;
}

function bestWeightedIntersection(
  values: Map<string, number> | undefined,
  expected: Set<string>
): { term: string; weight: number } | undefined {
  if (!values) return undefined;
  return [...values]
    .filter(([term]) => expected.has(term))
    .map(([term, weight]) => ({ term, weight }))
    .sort((left, right) => right.weight - left.weight)[0];
}

async function readSynonymSources(
  options: CliOptions,
  terms: {
    targetWords: Set<string>;
    dictionaryTerms: Set<string>;
    inferredTerms: Set<string>;
  }
): Promise<SynonymSource[]> {
  const sourceTerms = new Set([
    ...terms.targetWords,
    ...terms.dictionaryTerms,
    ...terms.inferredTerms
  ]);
  const sources: SynonymSource[] = [];

  if (options.jdmCacheDir) {
    sources.push({
      name: "rezojdm",
      synonymsByLemma: await readRezoJdmSynonyms({
        terms: sourceTerms,
        cacheDir: options.jdmCacheDir,
        fetchMissing: options.fetchJdm,
        fetchLimit: options.fetchJdmLimit
      })
    });
  }

  if (options.openOfficePath) {
    sources.push({
      name: "openoffice-synonyms",
      synonymsByLemma: readOpenOfficeSynonyms(
        options.openOfficePath,
        sourceTerms
      )
    });
  }

  if (options.wolfPath) {
    sources.push({
      name: "wolf",
      synonymsByLemma: readWolfSynonyms(options.wolfPath, sourceTerms)
    });
  }

  return sources;
}

async function readRezoJdmSynonyms(options: {
  terms: Set<string>;
  cacheDir: string;
  fetchMissing: boolean;
  fetchLimit: number;
}): Promise<Map<string, Map<string, number>>> {
  await mkdir(options.cacheDir, { recursive: true });
  const synonyms = new Map<string, Map<string, number>>();
  let fetched = 0;

  for (const term of options.terms) {
    const cachePath = rezoJdmCachePath(options.cacheDir, term);
    if (
      !existsSync(cachePath) &&
      options.fetchMissing &&
      fetched < options.fetchLimit
    ) {
      fetched += 1;
      await fetchRezoJdm(term, cachePath);
    }
    if (existsSync(cachePath)) {
      synonyms.set(term, parseRezoJdmFile(cachePath, term));
    }
  }

  return synonyms;
}

function rezoJdmCachePath(cacheDir: string, term: string): string {
  const safe = encodeURIComponent(term);
  const preferred = path.join(cacheDir, `jdm-${safe}.json`);
  if (existsSync(preferred)) return preferred;
  const legacy = path.join(cacheDir, `${safe}.json`);
  return existsSync(legacy) ? legacy : preferred;
}

async function fetchRezoJdm(term: string, cachePath: string): Promise<void> {
  try {
    const response = await fetch(
      `https://jdm-api.demo.lirmm.fr/v0/relations/from/${encodeURIComponent(
        term
      )}?types=5`
    );
    if (!response.ok) return;
    await writeFile(cachePath, await response.text(), "utf8");
  } catch {
    // Network lookup is opportunistic; the report remains useful from cache.
  }
}

function parseRezoJdmFile(filePath: string, term: string): Map<string, number> {
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
      nodes?: Array<{ id: number; name: string }>;
      relations?: Array<{
        node1: number;
        node2: number;
        type: number;
        w: number;
      }>;
      request?: { node1?: string };
    };
    const requestedTerm = normalizeWord(parsed.request?.node1 ?? term);
    const nodes = parsed.nodes ?? [];
    const nodeById = new Map(nodes.map((node) => [node.id, node.name]));
    const sourceNode = nodes.find(
      (node) => normalizeWord(node.name) === requestedTerm
    );
    if (!sourceNode) return new Map();

    const synonyms = new Map<string, number>();
    for (const relation of parsed.relations ?? []) {
      if (
        relation.node1 !== sourceNode.id ||
        relation.type !== 5 ||
        relation.w <= 0
      ) {
        continue;
      }
      const rawName = nodeById.get(relation.node2);
      if (!rawName || isTechnicalLexicalNode(rawName)) continue;
      const normalized = normalizeWord(rawName);
      if (isContentWord(normalized)) {
        synonyms.set(
          normalized,
          Math.max(synonyms.get(normalized) ?? 0, relation.w)
        );
      }
    }
    return synonyms;
  } catch {
    return new Map();
  }
}

function readOpenOfficeSynonyms(
  filePath: string,
  terms: Set<string>
): Map<string, Map<string, number>> {
  const text = readFileSync(filePath, "utf8");
  const body = text.includes("return []byte(`")
    ? text.slice(text.indexOf("`") + 1, text.lastIndexOf("`"))
    : text;
  const lines = body.split(/\r?\n/u);
  const synonyms = new Map<string, Map<string, number>>();

  for (let index = 1; index < lines.length; ) {
    const [word, countRaw] = (lines[index++] ?? "").split("|");
    const normalizedWord = normalizeWord(word ?? "");
    const count = Number(countRaw ?? 0);
    const forms = new Map<string, number>();

    for (let offset = 0; offset < count; offset += 1, index += 1) {
      const parts = (lines[index] ?? "").split("|").slice(1);
      for (const synonym of parts) {
        const normalized = normalizeWord(synonym);
        if (isContentWord(normalized)) forms.set(normalized, 1);
      }
    }

    if (terms.has(normalizedWord) && forms.size > 0) {
      synonyms.set(normalizedWord, forms);
    }
  }

  return synonyms;
}

function readWolfSynonyms(
  filePath: string,
  terms: Set<string>
): Map<string, Map<string, number>> {
  const text = readTextPossiblyCompressed(filePath);
  const synonyms = new Map<string, Map<string, number>>();
  const synsets = text.match(/<SYNSET>.*?<\/SYNSET>/gsu) ?? [];

  for (const synset of synsets) {
    const literals = [
      ...synset.matchAll(/<LITERAL(?: [^>]*)?>(.*?)<\/LITERAL>/gsu)
    ]
      .map((match) => normalizeWord(stripXml(match[1] ?? "")))
      .filter(isContentWord);
    const relevant = literals.filter((literal) => terms.has(literal));
    if (relevant.length === 0) continue;

    for (const literal of relevant) {
      const forms = synonyms.get(literal) ?? new Map();
      for (const other of literals) {
        if (other !== literal) forms.set(other, 1);
      }
      synonyms.set(literal, forms);
    }
  }

  return synonyms;
}

function readTextPossiblyCompressed(filePath: string): string {
  if (filePath.endsWith(".bz2")) {
    try {
      return execFileSync("bzcat", [filePath], {
        encoding: "utf8",
        maxBuffer: 256 * 1024 * 1024
      });
    } catch {
      return "";
    }
  }

  return readFileSync(filePath, "utf8");
}

async function readKaikkiIndex(
  filePath: string,
  targetWords: Set<string>,
  englishHints: Set<string>
): Promise<KaikkiIndex> {
  const index = emptyKaikkiIndex();
  const input = filePath.endsWith(".gz")
    ? createReadStream(filePath).pipe(createGunzip())
    : createReadStream(filePath);
  const lines = readline.createInterface({ input });

  for await (const line of lines) {
    const entry = safeJsonParse(line);
    if (!entry || entry.lang_code !== "fr" || typeof entry.word !== "string") {
      continue;
    }

    const normalizedWord = normalizeWord(entry.word);
    const glossTokens = new Set(entryGlossTokens(entry));

    for (const token of glossTokens) {
      if (englishHints.has(token)) {
        const terms =
          index.englishGlossToFrench.get(token) ?? new Set<string>();
        terms.add(normalizedWord);
        index.englishGlossToFrench.set(token, terms);
      }
    }

    if (targetWords.has(normalizedWord)) {
      const lemma = formOfLemma(entry) ?? normalizedWord;
      index.formToLemma.set(normalizedWord, lemma);
      index.lemmaGlossTokens.set(lemma, glossTokens);
    }

    for (const form of entry.forms ?? []) {
      if (typeof form?.form !== "string") continue;
      const normalizedForm = normalizeWord(form.form);
      if (targetWords.has(normalizedForm)) {
        index.formToLemma.set(normalizedForm, normalizedWord);
        index.lemmaGlossTokens.set(normalizedWord, glossTokens);
      }
    }
  }

  return index;
}

function safeJsonParse(line: string): KaikkiEntry | undefined {
  try {
    return JSON.parse(line) as KaikkiEntry;
  } catch {
    return undefined;
  }
}

function entryGlossTokens(entry: KaikkiEntry): string[] {
  const tokens = (entry.senses ?? [])
    .flatMap((sense) => (Array.isArray(sense.glosses) ? sense.glosses : []))
    .filter((gloss): gloss is string => typeof gloss === "string")
    .flatMap((gloss) => englishTokens(gloss));
  return [...new Set<string>(tokens)];
}

function formOfLemma(entry: KaikkiEntry): string | undefined {
  for (const sense of entry.senses ?? []) {
    const lemma = sense.form_of?.[0]?.word;
    if (typeof lemma === "string") return normalizeWord(lemma);
  }
  return undefined;
}

function emptyKaikkiIndex(): KaikkiIndex {
  return {
    formToLemma: new Map(),
    lemmaGlossTokens: new Map(),
    englishGlossToFrench: new Map()
  };
}

function lemmaForToken(normalized: string, kaikki: KaikkiIndex): string {
  return kaikki.formToLemma.get(normalized) ?? normalized;
}

function inferredFrenchTerms(
  englishHints: string[],
  kaikki: KaikkiIndex
): Set<string> {
  const terms = new Set<string>();
  for (const hint of englishHints) {
    for (const term of kaikki.englishGlossToFrench.get(hint) ?? []) {
      if (isContentWord(term)) terms.add(term);
    }
  }
  return terms;
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

function groupDictionaryTerms(
  candidates: StrongTranslationCandidate[]
): Map<string, Map<string, number>> {
  const grouped = new Map<string, Map<string, number>>();

  for (const candidate of candidates) {
    if (!isContentWord(candidate.normalized)) continue;
    const terms = grouped.get(candidate.strong) ?? new Map();
    terms.set(
      candidate.normalized,
      Math.max(terms.get(candidate.normalized) ?? 0, candidate.score)
    );
    grouped.set(candidate.strong, terms);
  }

  return grouped;
}

function isCandidateEmptyAnnotation(
  annotation: StrongLedger["verses"][number]["annotations"][number]
): boolean {
  return (
    annotation.visibility === "advanced" &&
    annotation.placement === "empty" &&
    annotation.lexiconLookup !== false
  );
}

function isWordOccupied(
  verse: StrongLedger["verses"][number],
  wordIndex: number
): boolean {
  return verse.annotations.some(
    (annotation) =>
      annotation.visibility === "reader" &&
      annotation.placement === "word" &&
      annotation.wordIndex === wordIndex
  );
}

function stepGlossTokens(glosses: string[]): string[] {
  return [...new Set(glosses.flatMap(englishTokens))];
}

function englishTokens(text: string): string[] {
  return tokenizeText(text)
    .filter((segment) => segment.kind === "word")
    .map((segment) => englishStem(segment.normalized))
    .filter((token) => token.length >= 3 && !ENGLISH_STOP_WORDS.has(token));
}

function englishStem(word: string): string {
  if (word.endsWith("ing") && word.length > 5) return word.slice(0, -3);
  if (word.endsWith("ed") && word.length > 4) return word.slice(0, -2);
  if (word.endsWith("s") && word.length > 4) return word.slice(0, -1);
  return word;
}

const ENGLISH_STOP_WORDS = new Set([
  "and",
  "are",
  "for",
  "her",
  "him",
  "his",
  "let",
  "not",
  "she",
  "the",
  "them",
  "they",
  "this",
  "that",
  "with",
  "you"
]);

function isContentWord(word: string): boolean {
  return word.length >= 3 && !FUNCTION_WORDS.has(word) && !/^\d+$/u.test(word);
}

function isTechnicalLexicalNode(name: string): boolean {
  return (
    name.startsWith("_") ||
    name.includes(":") ||
    name.includes(">") ||
    name.includes("=")
  );
}

function overlapCount(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const value of left) {
    if (right.has(value)) count += 1;
  }
  return count;
}

function positionScore(
  sourceWordIndex: number | undefined,
  targetWordIndex: number,
  wordCount: number
): number {
  if (sourceWordIndex === undefined || wordCount <= 1) return 0.5;
  const distance = Math.abs(targetWordIndex - sourceWordIndex);
  return Math.max(0, 1 - distance / Math.max(1, wordCount - 1));
}

function verseMatchesScope(
  verse: StrongLedger["verses"][number],
  scope: string
): boolean {
  if (scope.includes("-")) {
    const range = parseScopeRange(scope);
    if (!range) return false;
    return (
      compareVerseRef(verse, range.start) >= 0 &&
      compareVerseRef(verse, range.end) <= 0
    );
  }
  return verse.ref === scope || verse.ref.startsWith(`${scope}.`);
}

function parseScopeRange(scope: string):
  | {
      start: { bookId: string; chapter: number; verse: number };
      end: { bookId: string; chapter: number; verse: number };
    }
  | undefined {
  const [rawStart, rawEnd] = scope.split("-");
  if (!rawStart || !rawEnd) return undefined;

  const start = parseScopeBound(rawStart);
  const end = parseScopeBound(rawEnd, start?.bookId);
  if (!start || !end) return undefined;

  return {
    start: {
      bookId: start.bookId,
      chapter: start.chapter ?? 1,
      verse: start.verse ?? 1
    },
    end: {
      bookId: end.bookId,
      chapter: end.chapter ?? Number.MAX_SAFE_INTEGER,
      verse: end.verse ?? Number.MAX_SAFE_INTEGER
    }
  };
}

function parseScopeBound(
  value: string,
  defaultBookId?: string
): { bookId: string; chapter?: number; verse?: number } | undefined {
  const parts = value.split(".");
  const bookId = parts[0]?.match(/^\d+$/u) ? defaultBookId : parts.shift();
  if (!bookId) return undefined;

  const [chapter, verse] = parts;
  return {
    bookId,
    chapter: chapter ? Number.parseInt(chapter, 10) : undefined,
    verse: verse ? Number.parseInt(verse, 10) : undefined
  };
}

function compareVerseRef(
  verse: { bookId: string; chapter: number; verse: number },
  ref: { bookId: string; chapter: number; verse: number }
): number {
  const verseBookIndex = bookOrderIndex(verse.bookId);
  const refBookIndex = bookOrderIndex(ref.bookId);
  return (
    verseBookIndex - refBookIndex ||
    verse.chapter - ref.chapter ||
    verse.verse - ref.verse
  );
}

function bookOrderIndex(bookId: string): number {
  const index = BOOK_IDS.indexOf(bookId as (typeof BOOK_IDS)[number]);
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function stripXml(text: string): string {
  return text.replace(/<[^>]+>/gu, "");
}

function roundRatio(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function renderMarkdownReport(report: LexicalCandidateReport): string {
  const lines = [
    `# Lexical Candidate Report`,
    "",
    `Bible: \`${report.bible}\``,
    `Scope: \`${report.scope}\``,
    `Generated: \`${report.generatedAt}\``,
    "",
    "## Metrics",
    "",
    `- Verses: ${report.metrics.verses}`,
    `- Advanced empty annotations: ${report.metrics.emptyAnnotations}`,
    `- Empty annotations with candidates: ${report.metrics.emptyWithCandidates}`,
    `- Candidate count: ${report.metrics.candidateCount}`,
    `- High-confidence candidates: ${report.metrics.highConfidenceCandidates}`,
    "",
    "## Sources",
    "",
    `- Strong dictionary: ${report.sources.strongDictionary ? "yes" : "no"}`,
    `- Kaikki: ${report.sources.kaikki ?? "not used"}`,
    `- RezoJDM cache: ${report.sources.rezoJdmCache ?? "not used"}`,
    `- RezoJDM fetch: ${report.sources.rezoJdmFetch ? "yes" : "no"}`,
    `- OpenOffice synonyms: ${report.sources.openOffice ?? "not used"}`,
    `- WOLF: ${report.sources.wolf ?? "not used"}`,
    "",
    "## Candidates",
    ""
  ];

  for (const item of report.items.filter((row) => row.candidates.length > 0)) {
    lines.push(`### ${item.ref} ${item.strong}`, "");
    if (item.sourceStrong)
      lines.push(`Source Strong: \`${item.sourceStrong}\``);
    if (item.stepGlosses.length > 0) {
      lines.push(
        `STEP gloss: ${item.stepGlosses.map((gloss) => `\`${gloss}\``).join(", ")}`
      );
    }
    if (item.dictionaryTerms.length > 0) {
      lines.push(
        `Dictionary terms: ${item.dictionaryTerms
          .slice(0, 12)
          .map((term) => `\`${term}\``)
          .join(", ")}`
      );
    }
    if (item.inferredTerms.length > 0) {
      lines.push(
        `Inferred terms: ${item.inferredTerms
          .slice(0, 12)
          .map((term) => `\`${term}\``)
          .join(", ")}`
      );
    }
    lines.push(
      "",
      "| Word | Score | Confidence | Evidence |",
      "| --- | ---: | --- | --- |"
    );
    for (const candidate of item.candidates) {
      lines.push(
        `| ${candidate.wordIndex}: ${candidate.text} | ${candidate.score.toFixed(
          2
        )} | ${candidate.confidence}${candidate.occupied ? " / occupied" : ""} | ${candidate.evidence
          .map((evidence) => `${evidence.source}: ${evidence.detail}`)
          .join("<br>")} |`
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

function parseCliOptions(argv: string[]): CliOptions {
  const bible = readOption(argv, "--bible") ?? "nbs";
  const inputDir =
    readOption(argv, "--input-dir") ?? path.join("outputs", "strong", bible);
  const outputDir =
    readOption(argv, "--output-dir") ??
    path.join("outputs", "lexical-candidates", bible);
  return {
    bible,
    onlyRef: readOption(argv, "--only"),
    inputDir,
    outputDir,
    ledgerPath: readOption(argv, "--ledger"),
    kaikkiPath: readOption(argv, "--kaikki"),
    jdmCacheDir: readOption(argv, "--jdm-cache"),
    fetchJdm: readBooleanOption(argv, "--fetch-jdm", false),
    fetchJdmLimit: Number(readOption(argv, "--fetch-jdm-limit") ?? 80),
    openOfficePath: readOption(argv, "--openoffice"),
    wolfPath: readOption(argv, "--wolf"),
    maxCandidatesPerEmpty: Number(readOption(argv, "--max-candidates") ?? 8)
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
  const report = await buildLexicalCandidateReport(options);
  const paths = await writeLexicalCandidateReport(report, options.outputDir);

  console.log(`Lexical candidates JSON: ${paths.jsonPath}`);
  console.log(`Lexical candidates report: ${paths.markdownPath}`);
  console.log(
    `Candidates: ${report.metrics.emptyWithCandidates}/${report.metrics.emptyAnnotations} empty annotations have candidates (${report.metrics.highConfidenceCandidates} high confidence)`
  );
}

if (
  process.argv[1]
    ?.replaceAll("\\", "/")
    .endsWith("src/lexicalCandidateReport.ts")
) {
  main().catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  });
}
