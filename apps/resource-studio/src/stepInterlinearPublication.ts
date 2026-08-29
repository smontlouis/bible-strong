import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";
import {
  normalizeClassicalStrong,
  STEP_TO_OSIS_BOOK
} from "./stepOriginals.js";

export const STEP_INTERLINEAR_SCHEMA_VERSION = 2;
export const STEP_INTERLINEAR_BUILDER_VERSION =
  "step-interlinear-publication@2";
export const DEFAULT_STEP_INTERLINEAR_RELEASE =
  "outputs/releases/bible-step-interlinear-ledger-v2";
export const DEFAULT_STEP_INTERLINEAR_LEXICON =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
export const DEFAULT_STEP_INTERLINEAR_SOURCES = [
  "data/external/stepbible/amalgamated/TAHOT Gen-Deu.txt",
  "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
  "data/external/stepbible/amalgamated/TAHOT Job-Sng.txt",
  "data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt",
  "data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt",
  "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"
] as const;

const OUTPUT_FILES = {
  text: "bible-step.json",
  fr: "bible-step-interlinear-fr.sqlite",
  en: "bible-step-interlinear-en.sqlite",
  catalog: "catalog.json"
} as const;

type Locale = "en" | "fr";
type StepSource = "TAHOT" | "TAGNT";

interface ParsedReference {
  mainRef: string;
  alternateRefs: string[];
  bookId: string;
  bookOrder: number;
  chapter: number;
  verse: number;
  rawTokenIndex: string;
  tokenIndex: number;
  tokenType: string;
}

interface RawStepToken extends ParsedReference {
  id: string;
  source: StepSource;
  sourceOrder: number;
  canonical: boolean;
  sourceSurface: string;
  surface: string;
  transliteration: string;
  englishGloss: string;
  morphology: string;
  editions: string;
  lemmaFallback: string;
  dStrongRaw: string;
  alternativeStrongRaw: string;
  meaningVariants: string;
  spellingVariants: string;
}

interface TokenSegment {
  ordinal: number;
  startOffset: number;
  length: number;
  surface: string;
  transliteration: string;
  englishGloss: string;
  morphology: string;
  stepCodes: string[];
}

interface LexiconIdentity {
  stepCode: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  glossEn: string;
  glossFr: string;
}

interface LexiconIndex {
  exact: Map<string, LexiconIdentity>;
  byBase: Map<string, LexiconIdentity[]>;
}

interface ResolvedLexicon {
  entry: LexiconIdentity;
  method: "exact" | "classical-context";
}

interface PositionedToken {
  token: RawStepToken;
  readingOrdinal: number | null;
  startOffset: number;
  length: number;
}

interface VerseModel {
  ref: string;
  bookId: string;
  bookOrder: number;
  chapter: number;
  verse: number;
  text: string;
  tokens: PositionedToken[];
}

export interface StepInterlinearPublicationOptions {
  outputDir: string;
  sourcePaths: string[];
  lexiconPath: string;
  only?: string;
}

export interface StepInterlinearPublicationSummary {
  outputDir: string;
  textPath: string;
  frenchPath: string;
  englishPath: string;
  catalogPath: string;
  textSha256: string;
  tokenFingerprint: string;
  verseCount: number;
  tokenCount: number;
  canonicalTokenCount: number;
  segmentCount: number;
  identityCount: number;
  frenchGlossCount: number;
  englishGlossCount: number;
  frenchLexiconGlossCount: number;
  frenchFallbackGlossCount: number;
  integrityCheck: "ok";
}

export async function buildStepInterlinearPublication(
  options: StepInterlinearPublicationOptions
): Promise<StepInterlinearPublicationSummary> {
  const outputDir = path.resolve(options.outputDir);
  if (existsSync(outputDir)) {
    throw new Error(`step-interlinear-release-already-exists:${outputDir}`);
  }
  const sourcePaths = options.sourcePaths.map((sourcePath) =>
    path.resolve(sourcePath)
  );
  for (const sourcePath of sourcePaths) {
    if (!existsSync(sourcePath)) {
      throw new Error(`step-interlinear-source-missing:${sourcePath}`);
    }
  }
  const lexiconPath = path.resolve(options.lexiconPath);
  if (!existsSync(lexiconPath)) {
    throw new Error(`step-interlinear-lexicon-missing:${lexiconPath}`);
  }

  const temporaryDir = `${outputDir}.tmp-${randomUUID()}`;
  await mkdir(temporaryDir, { recursive: true });
  try {
    const sourceDigests: Record<string, string> = {};
    const tokens: RawStepToken[] = [];
    let sourceOrder = 0;
    for (const sourcePath of sourcePaths) {
      const content = await readFile(sourcePath, "utf8");
      sourceDigests[path.basename(sourcePath)] = sha256(content);
      const source: StepSource = sourcePath.includes("TAGNT")
        ? "TAGNT"
        : "TAHOT";
      for (const line of content.split(/\r?\n/u)) {
        const token = parseStepLine(line, source, sourceOrder);
        sourceOrder += 1;
        if (!token || !matchesScope(token, options.only)) continue;
        tokens.push(token);
      }
    }
    if (tokens.length === 0) {
      throw new Error("step-interlinear-no-source-tokens");
    }
    tokens.sort(compareTokens);

    const lexicon = readLexiconIdentities(lexiconPath);
    const verses = buildVerses(tokens);
    const flatBible = buildFlatBible(verses);
    const textContent = `${JSON.stringify(flatBible)}\n`;
    const textSha256 = sha256(textContent);
    const tokenFingerprint = fingerprintTokens(tokens);
    const lexiconSha256 = await sha256File(lexiconPath);

    const textPath = path.join(temporaryDir, OUTPUT_FILES.text);
    const frenchPath = path.join(temporaryDir, OUTPUT_FILES.fr);
    const englishPath = path.join(temporaryDir, OUTPUT_FILES.en);
    await writeFile(textPath, textContent, "utf8");

    const englishSummary = writeInterlinearDatabase({
      outputPath: englishPath,
      locale: "en",
      verses,
      lexicon,
      textSha256,
      tokenFingerprint,
      sourceDigests,
      lexiconSha256
    });
    const frenchSummary = writeInterlinearDatabase({
      outputPath: frenchPath,
      locale: "fr",
      verses,
      lexicon,
      textSha256,
      tokenFingerprint,
      sourceDigests,
      lexiconSha256
    });

    const verification = await verifyStepInterlinearPublication({
      textPath,
      frenchPath,
      englishPath
    });
    const artifacts = await Promise.all(
      [OUTPUT_FILES.text, OUTPUT_FILES.fr, OUTPUT_FILES.en].map(
        async (file) => {
          const artifactPath = path.join(temporaryDir, file);
          return {
            file,
            sha256: await sha256File(artifactPath),
            sizeBytes: (await stat(artifactPath)).size
          };
        }
      )
    );
    const catalogPath = path.join(temporaryDir, OUTPUT_FILES.catalog);
    await writeFile(
      catalogPath,
      `${JSON.stringify(
        {
          schemaVersion: STEP_INTERLINEAR_SCHEMA_VERSION,
          format: "bible-step-interlinear-release",
          generatedAt: new Date().toISOString(),
          datasetId: "STEP",
          sourceVersion: "TAHOT/TAGNT",
          readingPolicy: {
            TAHOT: "translator-reading-source-order-including-Q-R-X",
            TAGNT: "NA28"
          },
          textPolicy: "flat-original-text-without-strong-or-interlinear-data",
          strongPolicy:
            "Strong mode is a collapsed projection of exact STEP token and segment identities",
          textSha256,
          tokenFingerprint,
          sourceDigests,
          lexiconSha256,
          counts: {
            verses: verses.length,
            tokens: tokens.length,
            canonicalTokens: verification.canonicalTokenCount,
            segments: englishSummary.segmentCount,
            identities: englishSummary.identityCount,
            englishGlosses: englishSummary.glossCount,
            frenchGlosses: frenchSummary.glossCount,
            frenchLexiconGlosses: frenchSummary.lexiconGlossCount,
            frenchFallbackGlosses: frenchSummary.fallbackGlossCount
          },
          artifacts
        },
        null,
        2
      )}\n`,
      "utf8"
    );

    await mkdir(path.dirname(outputDir), { recursive: true });
    await rename(temporaryDir, outputDir);
    return {
      outputDir,
      textPath: path.join(outputDir, OUTPUT_FILES.text),
      frenchPath: path.join(outputDir, OUTPUT_FILES.fr),
      englishPath: path.join(outputDir, OUTPUT_FILES.en),
      catalogPath: path.join(outputDir, OUTPUT_FILES.catalog),
      textSha256,
      tokenFingerprint,
      verseCount: verses.length,
      tokenCount: tokens.length,
      canonicalTokenCount: verification.canonicalTokenCount,
      segmentCount: englishSummary.segmentCount,
      identityCount: englishSummary.identityCount,
      frenchGlossCount: frenchSummary.glossCount,
      englishGlossCount: englishSummary.glossCount,
      frenchLexiconGlossCount: frenchSummary.lexiconGlossCount,
      frenchFallbackGlossCount: frenchSummary.fallbackGlossCount,
      integrityCheck: "ok"
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

export async function verifyStepInterlinearPublication(options: {
  textPath: string;
  frenchPath: string;
  englishPath: string;
}): Promise<{
  verseCount: number;
  tokenCount: number;
  canonicalTokenCount: number;
  segmentCount: number;
  identityCount: number;
  integrityCheck: "ok";
}> {
  const textContent = await readFile(options.textPath, "utf8");
  const textSha256 = sha256(textContent);
  const flatBible = JSON.parse(textContent) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const expectedVerseCount = countFlatVerses(flatBible);
  const databases = [options.englishPath, options.frenchPath].map(
    (sqlitePath) => new DatabaseSync(sqlitePath, { readOnly: true })
  );
  try {
    const metadataRows = databases.map((database) =>
      Object.fromEntries(
        (
          database
            .prepare("SELECT key, value FROM ResourceMetadata")
            .all() as Array<{ key: string; value: string }>
        ).map(({ key, value }) => [key, value])
      )
    );
    for (const [index, database] of databases.entries()) {
      const integrity = String(
        (
          database.prepare("PRAGMA integrity_check").get() as
            | { integrity_check?: string }
            | undefined
        )?.integrity_check ?? "unknown"
      );
      if (integrity !== "ok") {
        throw new Error(`step-interlinear-integrity:${index}:${integrity}`);
      }
      if (metadataRows[index]?.textSha256 !== textSha256) {
        throw new Error(`step-interlinear-text-hash-mismatch:${index}`);
      }
    }
    const structuralKeys = [
      "schemaVersion",
      "builderVersion",
      "datasetId",
      "sourceVersion",
      "textSha256",
      "tokenFingerprint",
      "verseCount",
      "tokenCount",
      "canonicalTokenCount",
      "segmentCount",
      "identityCount"
    ];
    for (const key of structuralKeys) {
      if (metadataRows[0]?.[key] !== metadataRows[1]?.[key]) {
        throw new Error(`step-interlinear-structure-mismatch:${key}`);
      }
    }
    const verseCount = Number(metadataRows[0]?.verseCount ?? 0);
    const tokenCount = Number(metadataRows[0]?.tokenCount ?? 0);
    const canonicalTokenCount = Number(
      metadataRows[0]?.canonicalTokenCount ?? 0
    );
    const segmentCount = Number(metadataRows[0]?.segmentCount ?? 0);
    const identityCount = Number(metadataRows[0]?.identityCount ?? 0);
    if (verseCount !== expectedVerseCount) {
      throw new Error(
        `step-interlinear-verse-count-mismatch:${verseCount}:${expectedVerseCount}`
      );
    }

    const english = databases[0]!;
    const invalidRanges = (
      english
        .prepare(
          `SELECT v.bookOrder, v.chapter, v.verse, t.id,
                  t.startOffset, t.length, t.surface
             FROM Tokens t JOIN Verses v ON v.id=t.verseId
            WHERE t.isCanonical=1`
        )
        .all() as Array<{
        bookOrder: number;
        chapter: number;
        verse: number;
        id: string;
        startOffset: number;
        length: number;
        surface: string;
      }>
    ).filter((row) => {
      const verse =
        flatBible[String(row.bookOrder)]?.[String(row.chapter)]?.[
          String(row.verse)
        ];
      return (
        typeof verse !== "string" ||
        verse.slice(row.startOffset, row.startOffset + row.length) !==
          row.surface
      );
    });
    if (invalidRanges.length > 0) {
      throw new Error(
        `step-interlinear-invalid-token-ranges:${invalidRanges[0]?.id}:${invalidRanges.length}`
      );
    }

    const structuralFingerprintSql = `
      SELECT group_concat(
        id || '|' || verseId || '|' || ifnull(readingOrdinal,'') || '|' ||
        sourceOrdinal || '|' || startOffset || '|' || length || '|' ||
        surface || '|' || transliteration || '|' || morphology,
        char(10)
      ) AS payload
      FROM (SELECT * FROM Tokens ORDER BY id)
    `;
    const structuralPayloads = databases.map(
      (database) =>
        (
          database.prepare(structuralFingerprintSql).get() as
            | { payload?: string }
            | undefined
        )?.payload ?? ""
    );
    if (sha256(structuralPayloads[0]!) !== sha256(structuralPayloads[1]!)) {
      throw new Error("step-interlinear-token-table-mismatch");
    }
    return {
      verseCount,
      tokenCount,
      canonicalTokenCount,
      segmentCount,
      identityCount,
      integrityCheck: "ok"
    };
  } finally {
    databases.forEach((database) => database.close());
  }
}

function parseStepLine(
  line: string,
  source: StepSource,
  sourceOrder: number
): RawStepToken | undefined {
  const parts = line.split("\t");
  const reference = parseReference(parts[0] ?? "");
  if (!reference) return undefined;
  if (source === "TAHOT") {
    return {
      ...reference,
      id: tokenId(source, reference),
      source,
      sourceOrder,
      canonical: true,
      sourceSurface: parts[1] ?? "",
      surface: cleanTahotSurface(parts[1] ?? ""),
      transliteration: parts[2] ?? "",
      englishGloss: parts[3] ?? "",
      dStrongRaw: parts[4] ?? "",
      morphology: parts[5] ?? "",
      meaningVariants: parts[6] ?? "",
      spellingVariants: parts[7] ?? "",
      lemmaFallback: "",
      editions: "",
      alternativeStrongRaw: parts[9] ?? ""
    };
  }
  const surfaceAndTransliteration = parseTagntSurface(parts[1] ?? "");
  const analyses = parseTagntAnalyses(parts[3] ?? "");
  const dStrongRaw = analyses.map(({ strong }) => strong).join("/");
  const morphology = analyses.map(({ morphology }) => morphology).join("/");
  const dictionary = parts[4] ?? "";
  return {
    ...reference,
    id: tokenId(source, reference),
    source,
    sourceOrder,
    canonical: tagntIncludesNa28(parts[5] ?? "", reference.tokenType),
    sourceSurface: surfaceAndTransliteration.surface,
    surface: surfaceAndTransliteration.surface,
    transliteration: surfaceAndTransliteration.transliteration,
    englishGloss: parts[2] ?? "",
    dStrongRaw,
    morphology,
    lemmaFallback: dictionary.split("=", 1)[0]?.trim() ?? "",
    editions: parts[5] ?? "",
    meaningVariants: parts[6] ?? "",
    spellingVariants: parts[7] ?? "",
    alternativeStrongRaw: parts[12] ?? ""
  };
}

function parseTagntAnalyses(
  value: string
): Array<{ strong: string; morphology: string }> {
  const analyses = value
    .split(/\s+\+\s+(?=[HG]\d)/u)
    .map((part) => {
      const separator = part.indexOf("=");
      return separator < 0
        ? { strong: part.trim(), morphology: "" }
        : {
            strong: part.slice(0, separator).trim(),
            morphology: part.slice(separator + 1).trim()
          };
    })
    .filter(({ strong }) => strong);
  return analyses.length > 0 ? analyses : [{ strong: "", morphology: "" }];
}

function parseReference(input: string): ParsedReference | undefined {
  const match = input
    .replace(/^\uFEFF/u, "")
    .match(
      /^([1-3]?[A-Za-z]{2,3})\.(\d+)\.(\d+)(?:\((\d+)\.(\d+)\))?#(\d+)=([^\t]+)$/u
    );
  if (!match) return undefined;
  const bookId = STEP_TO_OSIS_BOOK.get(match[1] ?? "");
  if (!bookId) return undefined;
  const bookOrder = BOOK_IDS.indexOf(bookId as (typeof BOOK_IDS)[number]) + 1;
  if (bookOrder <= 0) return undefined;
  const chapter = Number.parseInt(match[2] ?? "0", 10);
  const verse = Number.parseInt(match[3] ?? "0", 10);
  const mainRef = `${bookId}.${chapter}.${verse}`;
  const alternateRefs =
    match[4] && match[5]
      ? [`${bookId}.${Number(match[4])}.${Number(match[5])}`]
      : [];
  return {
    mainRef,
    alternateRefs,
    bookId,
    bookOrder,
    chapter,
    verse,
    rawTokenIndex: match[6] ?? "",
    tokenIndex: Number.parseInt(match[6] ?? "0", 10),
    tokenType: match[7] ?? ""
  };
}

function tokenId(source: StepSource, ref: ParsedReference): string {
  const base = [
    source,
    ref.mainRef,
    ref.rawTokenIndex,
    ref.tokenType.replaceAll(/\s+/gu, "_")
  ].join(".");
  return ref.alternateRefs.length > 0
    ? `${base}@${ref.alternateRefs.join("+")}`
    : base;
}

function cleanTahotSurface(surface: string): string {
  return surface.replaceAll("/", "").replaceAll("\\", "");
}

function parseTagntSurface(value: string): {
  surface: string;
  transliteration: string;
} {
  const match = /^(.*)\s+\(([^()]*)\)$/u.exec(value.trim());
  return match
    ? {
        surface: match[1]?.trim() ?? "",
        transliteration: match[2]?.trim() ?? ""
      }
    : { surface: value.trim(), transliteration: "" };
}

function tagntIncludesNa28(editions: string, tokenType: string): boolean {
  const editionSet = new Set(
    editions
      .split("+")
      .map((edition) => edition.trim())
      .filter(Boolean)
  );
  return (
    editionSet.has("NA28") || (editionSet.size === 0 && /N/u.test(tokenType))
  );
}

function matchesScope(token: RawStepToken, scope: string | undefined): boolean {
  if (!scope) return true;
  const normalized = scope.trim();
  if (!normalized) return true;
  if (normalized === token.bookId) return true;
  if (normalized === `${token.bookId}.${token.chapter}`) return true;
  return normalized === token.mainRef;
}

function compareTokens(left: RawStepToken, right: RawStepToken): number {
  return (
    left.bookOrder - right.bookOrder ||
    left.chapter - right.chapter ||
    left.verse - right.verse ||
    left.sourceOrder - right.sourceOrder
  );
}

function buildVerses(tokens: RawStepToken[]): VerseModel[] {
  const grouped = new Map<string, RawStepToken[]>();
  for (const token of tokens) {
    const verse = grouped.get(token.mainRef) ?? [];
    verse.push(token);
    grouped.set(token.mainRef, verse);
  }
  return [...grouped.values()].map((verseTokens) => {
    const first = verseTokens[0]!;
    let text = "";
    let readingOrdinal = 0;
    const positioned: PositionedToken[] = [];
    for (const token of verseTokens) {
      if (!token.canonical) {
        positioned.push({
          token,
          readingOrdinal: null,
          startOffset: -1,
          length: 0
        });
        continue;
      }
      const separator =
        text.length === 0 || (token.source === "TAHOT" && text.endsWith("־"))
          ? ""
          : " ";
      text += separator;
      const startOffset = text.length;
      text += token.surface;
      positioned.push({
        token,
        readingOrdinal,
        startOffset,
        length: token.surface.length
      });
      readingOrdinal += 1;
    }
    return {
      ref: first.mainRef,
      bookId: first.bookId,
      bookOrder: first.bookOrder,
      chapter: first.chapter,
      verse: first.verse,
      text,
      tokens: positioned
    };
  });
}

function buildFlatBible(
  verses: VerseModel[]
): Record<string, Record<string, Record<string, string>>> {
  const result: Record<string, Record<string, Record<string, string>>> = {};
  for (const verse of verses) {
    const bookKey = String(verse.bookOrder);
    const chapterKey = String(verse.chapter);
    const verseKey = String(verse.verse);
    result[bookKey] ??= {};
    result[bookKey]![chapterKey] ??= {};
    result[bookKey]![chapterKey]![verseKey] = verse.text;
  }
  return result;
}

function readLexiconIdentities(lexiconPath: string): LexiconIndex {
  const database = new DatabaseSync(lexiconPath, { readOnly: true });
  try {
    const rows = database
      .prepare(
        `SELECT i.stepCode, e.eStrong, e.dStrong, e.uStrong,
                e.original, e.transliteration, e.gloss AS glossEn,
                coalesce(t.gloss, '') AS glossFr
           FROM StepEntryIdentities i
           JOIN StepEntries e ON e.id=i.stepEntryId
           LEFT JOIN LexiconTranslations t
             ON t.stepEntryId=e.id AND t.language='fr'`
      )
      .all() as unknown as LexiconIdentity[];
    const exact = new Map(rows.map((row) => [row.stepCode, row]));
    const byBase = new Map<string, LexiconIdentity[]>();
    for (const row of rows) {
      const base = normalizeClassicalStrong(row.stepCode);
      if (!base) continue;
      const entries = byBase.get(base) ?? [];
      entries.push(row);
      byBase.set(base, entries);
    }
    return { exact, byBase };
  } finally {
    database.close();
  }
}

function writeInterlinearDatabase(input: {
  outputPath: string;
  locale: Locale;
  verses: VerseModel[];
  lexicon: LexiconIndex;
  textSha256: string;
  tokenFingerprint: string;
  sourceDigests: Record<string, string>;
  lexiconSha256: string;
}): {
  segmentCount: number;
  identityCount: number;
  glossCount: number;
  lexiconGlossCount: number;
  fallbackGlossCount: number;
} {
  const database = new DatabaseSync(input.outputPath);
  let segmentCount = 0;
  let identityCount = 0;
  let glossCount = 0;
  let lexiconGlossCount = 0;
  let fallbackGlossCount = 0;
  try {
    createInterlinearSchema(database);
    const insertVerse = database.prepare(
      `INSERT INTO Verses(
         id, bookOrder, bookId, chapter, verse, ref
       ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertToken = database.prepare(
      `INSERT INTO Tokens(
         id, verseId, sourceOrdinal, readingOrdinal, source, sourceRef,
         alternateRefs, sourceToken, tokenIndex, tokenType, isCanonical,
         startOffset, length, surface, transliteration, morphology, editions,
         meaningVariants, spellingVariants
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertSegment = database.prepare(
      `INSERT INTO TokenSegments(
         tokenId, ordinal, startOffset, length, surface, transliteration,
         originalLemma, morphology, gloss, glossSource, confidence
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const insertCode = database.prepare(
      "INSERT OR IGNORE INTO StrongCodes(kind, code) VALUES (?, ?)"
    );
    const selectCode = database.prepare(
      "SELECT id FROM StrongCodes WHERE kind=? AND code=?"
    );
    const insertSegmentCode = database.prepare(
      `INSERT INTO SegmentStrongCodes(
         tokenId, segmentOrdinal, identityOrder, codeId, role
       ) VALUES (?, ?, ?, ?, ?)`
    );
    const codeIds = new Map<string, number>();

    database.exec("BEGIN IMMEDIATE");
    try {
      for (const [verseIndex, verse] of input.verses.entries()) {
        const verseId = verseIndex + 1;
        insertVerse.run(
          verseId,
          verse.bookOrder,
          verse.bookId,
          verse.chapter,
          verse.verse,
          verse.ref
        );
        for (const positioned of verse.tokens) {
          const token = positioned.token;
          insertToken.run(
            token.id,
            verseId,
            token.sourceOrder,
            positioned.readingOrdinal,
            token.source,
            token.mainRef,
            JSON.stringify(token.alternateRefs),
            token.rawTokenIndex,
            token.tokenIndex,
            token.tokenType,
            token.canonical ? 1 : 0,
            positioned.startOffset,
            positioned.length,
            token.surface,
            token.transliteration,
            token.morphology,
            token.editions,
            token.meaningVariants,
            token.spellingVariants
          );
          const segments = segmentToken(token);
          for (const segment of segments) {
            const segmentLexicons = segment.stepCodes
              .map((stepCode) =>
                resolveLexiconIdentity(
                  stepCode,
                  segment.englishGloss,
                  input.lexicon
                )
              )
              .filter((entry): entry is ResolvedLexicon => Boolean(entry));
            const primaryLexicon = segmentLexicons[0]?.entry;
            const glossResult =
              input.locale === "en"
                ? {
                    gloss:
                      segment.englishGloss || primaryLexicon?.glossEn || "",
                    source: segment.englishGloss
                      ? "STEP-contextual"
                      : "STEP-lexical-component",
                    confidence: segment.englishGloss ? 1 : 0.9
                  }
                : frenchGloss(segment, segmentLexicons);
            const originalLemma =
              primaryLexicon?.original || token.lemmaFallback;
            const transliteration =
              segment.transliteration ||
              primaryLexicon?.transliteration ||
              token.transliteration;
            insertSegment.run(
              token.id,
              segment.ordinal,
              segment.startOffset,
              segment.length,
              segment.surface,
              transliteration,
              originalLemma,
              segment.morphology,
              glossResult.gloss,
              glossResult.source,
              glossResult.confidence
            );
            segmentCount += 1;
            if (glossResult.gloss) glossCount += 1;
            if (glossResult.source.startsWith("lexicon-v3-fr")) {
              lexiconGlossCount += 1;
            }
            if (glossResult.source === "STEP-en-fallback") {
              fallbackGlossCount += 1;
            }
            const identities = identitiesForSegment(segment, segmentLexicons);
            for (const [identityOrder, identity] of identities.entries()) {
              const cacheKey = `${identity.kind}:${identity.code}`;
              let codeId = codeIds.get(cacheKey);
              if (!codeId) {
                insertCode.run(identity.kind, identity.code);
                codeId = Number(
                  (
                    selectCode.get(identity.kind, identity.code) as {
                      id: number;
                    }
                  ).id
                );
                codeIds.set(cacheKey, codeId);
              }
              insertSegmentCode.run(
                token.id,
                segment.ordinal,
                identityOrder,
                codeId,
                identity.role
              );
              identityCount += 1;
            }
          }
        }
      }
      writeInterlinearMetadata(database, {
        locale: input.locale,
        textSha256: input.textSha256,
        tokenFingerprint: input.tokenFingerprint,
        sourceDigests: input.sourceDigests,
        lexiconSha256: input.lexiconSha256,
        verseCount: input.verses.length,
        tokenCount: input.verses.reduce(
          (sum, verse) => sum + verse.tokens.length,
          0
        ),
        canonicalTokenCount: input.verses.reduce(
          (sum, verse) =>
            sum + verse.tokens.filter(({ token }) => token.canonical).length,
          0
        ),
        segmentCount,
        identityCount,
        glossCount,
        lexiconGlossCount,
        fallbackGlossCount
      });
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("VACUUM; ANALYZE;");
    return {
      segmentCount,
      identityCount,
      glossCount,
      lexiconGlossCount,
      fallbackGlossCount
    };
  } finally {
    database.close();
  }
}

function segmentToken(token: RawStepToken): TokenSegment[] {
  if (token.source === "TAGNT") {
    const strongParts = token.dStrongRaw.split("/");
    const morphologyParts = token.morphology.split("/");
    const count = Math.max(strongParts.length, morphologyParts.length);
    return Array.from({ length: count }, (_, ordinal) => ({
      ordinal,
      startOffset: ordinal === 0 ? 0 : token.surface.length,
      length: ordinal === 0 ? token.surface.length : 0,
      surface: ordinal === 0 ? token.surface : "",
      transliteration: ordinal === 0 ? token.transliteration : "",
      englishGloss: ordinal === 0 ? token.englishGloss : "",
      morphology: morphologyParts[ordinal]?.trim() ?? "",
      stepCodes: extractStrongCodes(strongParts[ordinal] ?? "")
    }));
  }
  const rawSurfaces = token.sourceSurface.includes("/")
    ? token.sourceSurface.split("/")
    : splitOriginalTahotSurface(token);
  const surfaces = rawSurfaces.map((surface) =>
    surface.replaceAll("\\", "").replaceAll("/", "")
  );
  const transliterations = token.transliteration.split("/");
  const glosses = token.englishGloss.split("/");
  const morphologies = token.morphology.split("/");
  const strongParts = token.dStrongRaw.split("/");
  const count = Math.max(
    surfaces.length,
    transliterations.length,
    glosses.length,
    morphologies.length,
    strongParts.length
  );
  const segments: TokenSegment[] = [];
  let startOffset = 0;
  for (let ordinal = 0; ordinal < count; ordinal += 1) {
    const surface = surfaces[ordinal] ?? "";
    const strongPart = (strongParts[ordinal] ?? "").split("\\", 1)[0] ?? "";
    segments.push({
      ordinal,
      startOffset,
      length: surface.length,
      surface,
      transliteration: transliterations[ordinal]?.trim() ?? "",
      englishGloss:
        glosses[ordinal]?.trim() ??
        (count === 1 ? token.englishGloss.trim() : ""),
      morphology: morphologies[ordinal]?.trim() ?? "",
      stepCodes: extractStrongCodes(strongPart)
    });
    startOffset += surface.length;
  }
  return segments;
}

function splitOriginalTahotSurface(token: RawStepToken): string[] {
  const raw = token.sourceSurface;
  const expectedSegments = Math.max(
    token.transliteration.split("/").length,
    token.englishGloss.split("/").length,
    token.morphology.split("/").length,
    token.dStrongRaw.split("/").length
  );
  return expectedSegments <= 1
    ? [raw]
    : [raw, ...Array(expectedSegments - 1).fill("")];
}

function extractStrongCodes(input: string): string[] {
  return [
    ...new Set(
      [...input.matchAll(/[HG]\d{4,5}[A-Za-z]?/gu)].map((match) => match[0]!)
    )
  ];
}

function frenchGloss(
  segment: TokenSegment,
  lexicons: ResolvedLexicon[]
): { gloss: string; source: string; confidence: number } {
  if (
    segment.stepCodes.length === 0 &&
    (segment.englishGloss.trim() === "" ||
      segment.englishGloss.trim() === "[ ]")
  ) {
    return {
      gloss: segment.englishGloss,
      source: "STEP-structural-empty",
      confidence: 1
    };
  }
  const candidates = lexicons
    .map(({ entry }) =>
      chooseParallelGloss(segment.englishGloss, entry.glossEn, entry.glossFr)
    )
    .filter(Boolean);
  if (candidates.length > 0) {
    const exact = lexicons.every(({ method }) => method === "exact");
    return {
      gloss: [...new Set(candidates)].join(" · "),
      source: exact ? "lexicon-v3-fr" : "lexicon-v3-fr-classical-context",
      confidence: exact
        ? candidates.length === 1
          ? 0.82
          : 0.72
        : candidates.length === 1
          ? 0.68
          : 0.58
    };
  }
  return {
    gloss: segment.englishGloss,
    source: "STEP-en-fallback",
    confidence: 0
  };
}

function chooseParallelGloss(
  contextualEnglish: string,
  lexiconEnglish: string,
  lexiconFrench: string
): string {
  if (!lexiconFrench.trim()) return "";
  for (const separator of [":", "/"]) {
    const englishParts = lexiconEnglish.split(separator);
    const frenchParts = lexiconFrench.split(separator);
    if (
      englishParts.length !== frenchParts.length ||
      englishParts.length <= 1
    ) {
      continue;
    }
    const normalizedContext = normalizeGloss(contextualEnglish);
    const index = englishParts.findIndex((part) => {
      const normalizedPart = normalizeGloss(part);
      return (
        normalizedContext === normalizedPart ||
        normalizedContext.includes(normalizedPart) ||
        normalizedPart.includes(normalizedContext)
      );
    });
    if (index >= 0) return frenchParts[index]?.trim() ?? lexiconFrench.trim();
    if (separator === ":")
      return frenchParts[0]?.trim() ?? lexiconFrench.trim();
  }
  return lexiconFrench.trim();
}

function normalizeGloss(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("en");
}

function identitiesForSegment(
  segment: TokenSegment,
  lexicons: ResolvedLexicon[]
): Array<{ kind: number; code: string; role: number }> {
  const result: Array<{ kind: number; code: string; role: number }> = [];
  const seen = new Set<string>();
  const representedCodes = new Set<string>();
  const add = (kind: number, code: string, role = 0): void => {
    const normalized = code.replace(/\s*=.*$/u, "").trim();
    if (!normalized) return;
    if (representedCodes.has(normalized)) return;
    const key = `${kind}:${normalized}`;
    if (seen.has(key)) return;
    seen.add(key);
    representedCodes.add(normalized);
    result.push({ kind, code: normalized, role });
  };
  for (const stepCode of segment.stepCodes) {
    const base = normalizeClassicalStrong(stepCode);
    if (base) add(0, base);
    const lexicon =
      lexicons.find(({ entry }) => entry.stepCode === stepCode)?.entry ??
      (segment.stepCodes.length === 1 ? lexicons[0]?.entry : undefined);
    if (lexicon) {
      add(1, lexicon.eStrong);
      add(2, lexicon.stepCode);
      add(3, lexicon.uStrong);
    } else {
      add(2, stepCode);
    }
  }
  return result;
}

function resolveLexiconIdentity(
  stepCode: string,
  contextualEnglish: string,
  lexicon: LexiconIndex
): ResolvedLexicon | undefined {
  const exact = lexicon.exact.get(stepCode);
  if (exact) return { entry: exact, method: "exact" };
  const base = normalizeClassicalStrong(stepCode);
  if (!base) return undefined;
  const candidates = lexicon.byBase.get(base) ?? [];
  if (candidates.length === 0) return undefined;
  if (candidates.length === 1) {
    return { entry: candidates[0]!, method: "classical-context" };
  }
  const scored = candidates
    .map((entry) => ({
      entry,
      score: glossSimilarity(contextualEnglish, entry.glossEn)
    }))
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.entry.stepCode.localeCompare(right.entry.stepCode)
    );
  if ((scored[0]?.score ?? 0) > 0) {
    return {
      entry: scored[0]!.entry,
      method: "classical-context"
    };
  }
  const distinctFrench = new Set(
    candidates.map(({ glossFr }) => normalizeGloss(glossFr)).filter(Boolean)
  );
  return distinctFrench.size === 1
    ? { entry: candidates[0]!, method: "classical-context" }
    : undefined;
}

function glossSimilarity(contextual: string, lexical: string): number {
  const contextTokens = significantGlossTokens(contextual);
  const lexicalTokens = significantGlossTokens(lexical);
  let score = 0;
  for (const context of contextTokens) {
    for (const lexeme of lexicalTokens) {
      if (context === lexeme) {
        score += 3;
      } else if (
        context.length >= 4 &&
        lexeme.length >= 4 &&
        (context.startsWith(lexeme.slice(0, 4)) ||
          lexeme.startsWith(context.slice(0, 4)))
      ) {
        score += 1;
      }
    }
  }
  return score;
}

function significantGlossTokens(value: string): string[] {
  const ignored = new Set([
    "a",
    "an",
    "and",
    "are",
    "be",
    "been",
    "do",
    "had",
    "has",
    "have",
    "he",
    "her",
    "him",
    "i",
    "is",
    "it",
    "of",
    "she",
    "that",
    "the",
    "they",
    "to",
    "was",
    "we",
    "were",
    "will",
    "you"
  ]);
  return normalizeGloss(value)
    .split(" ")
    .map((token) => {
      const irregular: Record<string, string> = {
        beheld: "see",
        behold: "see",
        beholding: "see",
        jewess: "jew",
        jewish: "jew",
        seen: "see",
        sees: "see",
        watch: "see",
        watching: "see"
      };
      return irregular[token] ?? token.replace(/(?:ing|ed|es|s)$/u, "").trim();
    })
    .filter((token) => token.length >= 2 && !ignored.has(token));
}

function createInterlinearSchema(database: DatabaseSync): void {
  database.exec(`
    PRAGMA foreign_keys=ON;
    PRAGMA journal_mode=OFF;
    PRAGMA synchronous=OFF;
    PRAGMA temp_store=MEMORY;

    CREATE TABLE ResourceMetadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;

    CREATE TABLE Verses (
      id INTEGER PRIMARY KEY,
      bookOrder INTEGER NOT NULL,
      bookId TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      ref TEXT NOT NULL UNIQUE,
      UNIQUE(bookOrder, chapter, verse)
    );

    CREATE TABLE Tokens (
      id TEXT PRIMARY KEY,
      verseId INTEGER NOT NULL REFERENCES Verses(id) ON DELETE CASCADE,
      sourceOrdinal INTEGER NOT NULL,
      readingOrdinal INTEGER,
      source TEXT NOT NULL CHECK(source IN ('TAHOT','TAGNT')),
      sourceRef TEXT NOT NULL,
      alternateRefs TEXT NOT NULL,
      sourceToken TEXT NOT NULL,
      tokenIndex INTEGER NOT NULL,
      tokenType TEXT NOT NULL,
      isCanonical INTEGER NOT NULL CHECK(isCanonical IN (0,1)),
      startOffset INTEGER NOT NULL,
      length INTEGER NOT NULL CHECK(length >= 0),
      surface TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      morphology TEXT NOT NULL,
      editions TEXT NOT NULL,
      meaningVariants TEXT NOT NULL,
      spellingVariants TEXT NOT NULL,
      UNIQUE(verseId, sourceOrdinal)
    );
    CREATE INDEX idx_Tokens_verse_reading
      ON Tokens(verseId, isCanonical, readingOrdinal);
    CREATE INDEX idx_Tokens_source
      ON Tokens(source, sourceRef, tokenIndex, tokenType);

    CREATE TABLE TokenSegments (
      tokenId TEXT NOT NULL REFERENCES Tokens(id) ON DELETE CASCADE,
      ordinal INTEGER NOT NULL,
      startOffset INTEGER NOT NULL CHECK(startOffset >= 0),
      length INTEGER NOT NULL CHECK(length >= 0),
      surface TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      originalLemma TEXT NOT NULL,
      morphology TEXT NOT NULL,
      gloss TEXT NOT NULL,
      glossSource TEXT NOT NULL,
      confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
      PRIMARY KEY(tokenId, ordinal)
    ) WITHOUT ROWID;

    CREATE TABLE StrongCodes (
      id INTEGER PRIMARY KEY,
      kind INTEGER NOT NULL CHECK(kind BETWEEN 0 AND 3),
      code TEXT NOT NULL,
      UNIQUE(kind, code)
    );

    CREATE TABLE SegmentStrongCodes (
      tokenId TEXT NOT NULL,
      segmentOrdinal INTEGER NOT NULL,
      identityOrder INTEGER NOT NULL,
      codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
      role INTEGER NOT NULL CHECK(role IN (0,1)),
      PRIMARY KEY(tokenId, segmentOrdinal, identityOrder),
      FOREIGN KEY(tokenId, segmentOrdinal)
        REFERENCES TokenSegments(tokenId, ordinal) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX idx_SegmentStrongCodes_lookup
      ON SegmentStrongCodes(codeId, tokenId, segmentOrdinal);
  `);
}

function writeInterlinearMetadata(
  database: DatabaseSync,
  values: {
    locale: Locale;
    textSha256: string;
    tokenFingerprint: string;
    sourceDigests: Record<string, string>;
    lexiconSha256: string;
    verseCount: number;
    tokenCount: number;
    canonicalTokenCount: number;
    segmentCount: number;
    identityCount: number;
    glossCount: number;
    lexiconGlossCount: number;
    fallbackGlossCount: number;
  }
): void {
  const insert = database.prepare(
    "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)"
  );
  const metadata = {
    schemaVersion: STEP_INTERLINEAR_SCHEMA_VERSION,
    builderVersion: STEP_INTERLINEAR_BUILDER_VERSION,
    datasetId: "STEP",
    sourceVersion: "TAHOT/TAGNT",
    locale: values.locale,
    textSha256: values.textSha256,
    tokenFingerprint: values.tokenFingerprint,
    sourceDigests: JSON.stringify(values.sourceDigests),
    lexiconSha256: values.lexiconSha256,
    verseCount: values.verseCount,
    tokenCount: values.tokenCount,
    canonicalTokenCount: values.canonicalTokenCount,
    segmentCount: values.segmentCount,
    identityCount: values.identityCount,
    glossCount: values.glossCount,
    lexiconGlossCount: values.lexiconGlossCount,
    fallbackGlossCount: values.fallbackGlossCount,
    offsetUnit: "UTF-16-code-unit",
    readingPolicyTahot: "translator-reading-source-order-including-Q-R-X",
    readingPolicyTagnt: "NA28"
  };
  for (const [key, value] of Object.entries(metadata)) {
    insert.run(key, String(value));
  }
}

function fingerprintTokens(tokens: RawStepToken[]): string {
  const hash = createHash("sha256");
  for (const token of tokens) {
    hash.update(
      `${JSON.stringify([
        token.id,
        token.canonical,
        token.sourceSurface,
        token.surface,
        token.transliteration,
        token.englishGloss,
        token.morphology,
        token.dStrongRaw,
        token.editions
      ])}\n`
    );
  }
  return hash.digest("hex");
}

function countFlatVerses(
  bible: Record<string, Record<string, Record<string, string>>>
): number {
  return Object.values(bible).reduce(
    (bookTotal, chapters) =>
      bookTotal +
      Object.values(chapters).reduce(
        (chapterTotal, verses) => chapterTotal + Object.keys(verses).length,
        0
      ),
    0
  );
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

function parseCliOptions(argv: readonly string[]): {
  outputDir: string;
  lexiconPath: string;
  sourcePaths: string[];
  only?: string;
} {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (!argument?.startsWith("--")) {
      throw new Error(`step-interlinear-unexpected-argument:${argument}`);
    }
    const key = argument.slice(2);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`step-interlinear-missing-value:${key}`);
    }
    args.set(key, value);
    index += 1;
  }
  const allowed = new Set(["output-dir", "lexicon", "sources", "only"]);
  for (const key of args.keys()) {
    if (!allowed.has(key)) {
      throw new Error(`step-interlinear-unknown-option:${key}`);
    }
  }
  return {
    outputDir: args.get("output-dir") ?? DEFAULT_STEP_INTERLINEAR_RELEASE,
    lexiconPath: args.get("lexicon") ?? DEFAULT_STEP_INTERLINEAR_LEXICON,
    sourcePaths: (
      args.get("sources") ?? DEFAULT_STEP_INTERLINEAR_SOURCES.join(",")
    )
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    ...(args.get("only") ? { only: args.get("only") } : {})
  };
}

async function main(): Promise<void> {
  const summary = await buildStepInterlinearPublication(
    parseCliOptions(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

const isCli =
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isCli) {
  main().catch((error: unknown) => {
    process.stderr.write(
      `${error instanceof Error ? error.message : String(error)}\n`
    );
    process.exitCode = 1;
  });
}
