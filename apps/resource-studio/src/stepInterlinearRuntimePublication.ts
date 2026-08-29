import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import {
  copyFile,
  mkdir,
  readFile,
  rename,
  rm,
  stat,
  utimes,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";

import { normalizeClassicalStrong } from "./stepOriginals.js";
import { readStrongCsv, referenceKey, type StrongRow } from "./strongCsv.js";
import { verifyStepInterlinearPublication } from "./stepInterlinearPublication.js";
import { stripTags } from "./tokenize.js";

export const STEP_INTERLINEAR_RUNTIME_SCHEMA_VERSION = 5;
export const STEP_INTERLINEAR_RUNTIME_BUILDER_VERSION =
  "step-interlinear-runtime@5";
export const STEP_INTERLINEAR_ATTRIBUTION =
  "Data created by STEPBible.org based on work at Tyndale House Cambridge (CC BY 4.0)";
export const DEFAULT_STEP_INTERLINEAR_LEDGER =
  "outputs/releases/bible-step-interlinear-ledger-v2";
export const DEFAULT_STEP_INTERLINEAR_MORPHOLOGY_LEXICON =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
export const DEFAULT_STEP_INTERLINEAR_RUNTIME_RELEASE =
  "outputs/releases/bible-step-interlinear-runtime-v5";
export const DEFAULT_STEP_INTERLINEAR_REFERENCES = {
  Sg1910: "data/strongs/Sg1910.csv",
  Darby: "data/strongs/Darby.csv",
  DarbyR: "data/strongs/DarbyR.csv"
} as const;

const OUTPUT_FILES = {
  text: "bible-step.json",
  fr: "bible-step-interlinear-fr.sqlite",
  en: "bible-step-interlinear-en.sqlite",
  catalog: "catalog.json"
} as const;
const execFileAsync = promisify(execFile);
const REPRODUCIBLE_ZIP_TIME = new Date("1980-01-01T00:00:00.000Z");

type Locale = "en" | "fr";
type ReferenceName = keyof typeof DEFAULT_STEP_INTERLINEAR_REFERENCES;

interface LedgerSegmentRow {
  verseId: number;
  bookOrder: number;
  bookId: string;
  chapter: number;
  verse: number;
  ref: string;
  tokenKey: string;
  readingOrdinal: number;
  tokenStartOffset: number;
  tokenLength: number;
  source: "TAHOT" | "TAGNT";
  tokenMorphology: string;
  segmentOrdinal: number;
  segmentStartOffset: number;
  segmentLength: number;
  transliteration: string;
  originalLemma: string;
  morphology: string;
  lexicalGlossFr: string;
  lexicalGlossSource: string;
  lexicalConfidence: number;
}

interface LedgerVerseRow {
  id: number;
  bookOrder: number;
  bookId: string;
  chapter: number;
  verse: number;
  ref: string;
}

interface RuntimeCode {
  kind: number;
  code: string;
}

interface RuntimeSegment extends LedgerSegmentRow {
  englishGloss: string;
  codes: RuntimeCode[];
  frenchGloss: LocalizedGloss;
}

interface LocalizedGloss {
  text: string;
  source: string;
  confidence: number;
}

type ReferenceCarrierIndex = Map<string, Map<string, string[]>>;

interface ReferenceIndexes {
  Sg1910: ReferenceCarrierIndex;
  Darby: ReferenceCarrierIndex;
  DarbyR: ReferenceCarrierIndex;
}

export interface StepInterlinearRuntimeOptions {
  ledgerDir: string;
  outputDir: string;
  lexiconPath?: string;
  referencePaths?: Partial<Record<ReferenceName, string>>;
}

export interface StepInterlinearRuntimeSummary {
  outputDir: string;
  textPath: string;
  frenchPath: string;
  englishPath: string;
  catalogPath: string;
  textSha256: string;
  textRevision: string;
  verseCount: number;
  tokenCount: number;
  segmentCount: number;
  identityCount: number;
  strongVerseCount: number;
  frenchContextualGlossCount: number;
  frenchLexicalFallbackCount: number;
  sourceSizeBytes: number;
  runtimeSizeBytes: number;
  reductionRatio: number;
  integrityCheck: "ok";
}

export async function buildStepInterlinearRuntimePublication(
  options: StepInterlinearRuntimeOptions
): Promise<StepInterlinearRuntimeSummary> {
  const ledgerDir = path.resolve(options.ledgerDir);
  const outputDir = path.resolve(options.outputDir);
  const lexiconPath = path.resolve(
    options.lexiconPath ?? DEFAULT_STEP_INTERLINEAR_MORPHOLOGY_LEXICON
  );
  if (existsSync(outputDir)) {
    throw new Error(`step-interlinear-runtime-already-exists:${outputDir}`);
  }
  const ledgerPaths = {
    text: path.join(ledgerDir, OUTPUT_FILES.text),
    fr: path.join(ledgerDir, OUTPUT_FILES.fr),
    en: path.join(ledgerDir, OUTPUT_FILES.en)
  };
  for (const ledgerPath of Object.values(ledgerPaths)) {
    if (!existsSync(ledgerPath)) {
      throw new Error(`step-interlinear-runtime-ledger-missing:${ledgerPath}`);
    }
  }
  if (!existsSync(lexiconPath)) {
    throw new Error(`step-interlinear-runtime-lexicon-missing:${lexiconPath}`);
  }
  await verifyStepInterlinearPublication({
    textPath: ledgerPaths.text,
    frenchPath: ledgerPaths.fr,
    englishPath: ledgerPaths.en
  });

  const referencePaths = {
    ...DEFAULT_STEP_INTERLINEAR_REFERENCES,
    ...options.referencePaths
  };
  for (const referencePath of Object.values(referencePaths)) {
    if (!existsSync(referencePath)) {
      throw new Error(
        `step-interlinear-runtime-reference-missing:${referencePath}`
      );
    }
  }

  const temporaryDir = `${outputDir}.tmp-${randomUUID()}`;
  await mkdir(temporaryDir, { recursive: true });
  try {
    const [textContent, references] = await Promise.all([
      readFile(ledgerPaths.text, "utf8"),
      readReferenceIndexes(referencePaths)
    ]);
    const runtime = readRuntimeData(ledgerPaths, references);
    assertMorphologyCoverage(runtime.segments, lexiconPath);
    const textSha256 = sha256(textContent);
    const textRevision = `bhg-${textSha256.slice(0, 20)}`;
    const ledgerHashes = {
      text: await sha256File(ledgerPaths.text),
      fr: await sha256File(ledgerPaths.fr),
      en: await sha256File(ledgerPaths.en)
    };
    const referenceHashes = Object.fromEntries(
      await Promise.all(
        Object.entries(referencePaths).map(async ([name, referencePath]) => [
          name,
          await sha256File(referencePath)
        ])
      )
    );
    const morphologyLexiconSha256 = await sha256File(lexiconPath);

    const textPath = path.join(temporaryDir, OUTPUT_FILES.text);
    const frenchPath = path.join(temporaryDir, OUTPUT_FILES.fr);
    const englishPath = path.join(temporaryDir, OUTPUT_FILES.en);
    await writeFile(textPath, textContent, "utf8");
    const common = {
      ...runtime,
      textSha256,
      textRevision,
      ledgerHashes,
      referenceHashes,
      morphologyLexiconSha256
    };
    const englishSummary = writeRuntimeDatabase({
      ...common,
      outputPath: englishPath,
      locale: "en"
    });
    const frenchSummary = writeRuntimeDatabase({
      ...common,
      outputPath: frenchPath,
      locale: "fr"
    });
    const verification = await verifyStepInterlinearRuntimePublication({
      textPath,
      frenchPath,
      englishPath
    });
    const archives = await Promise.all(
      [OUTPUT_FILES.text, OUTPUT_FILES.fr, OUTPUT_FILES.en].map(
        async (entry) => {
          const sourcePath = path.join(temporaryDir, entry);
          const archiveFile = `${entry}.zip`;
          const archivePath = path.join(temporaryDir, archiveFile);
          await createDeterministicZip({
            inputPath: sourcePath,
            entryName: entry,
            archivePath,
            stagingRoot: path.join(temporaryDir, ".zip", entry)
          });
          return {
            file: archiveFile,
            entry,
            archiveSha256: await sha256File(archivePath),
            archiveBytes: (await stat(archivePath)).size,
            contentSha256: await sha256File(sourcePath),
            contentBytes: (await stat(sourcePath)).size
          };
        }
      )
    );
    await rm(path.join(temporaryDir, ".zip"), {
      recursive: true,
      force: true
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
    const sourceSizeBytes =
      (await stat(ledgerPaths.fr)).size + (await stat(ledgerPaths.en)).size;
    const runtimeSizeBytes =
      (await stat(frenchPath)).size + (await stat(englishPath)).size;
    const reductionRatio = roundRatio(
      1 - runtimeSizeBytes / Math.max(1, sourceSizeBytes)
    );
    const catalogPath = path.join(temporaryDir, OUTPUT_FILES.catalog);
    await writeFile(
      catalogPath,
      `${JSON.stringify(
        {
          schemaVersion: STEP_INTERLINEAR_RUNTIME_SCHEMA_VERSION,
          format: "bible-step-interlinear-runtime-release",
          generatedAt: new Date().toISOString(),
          sourceLedger: ledgerDir,
          textSha256,
          textRevision,
          ledgerHashes,
          referenceHashes,
          morphologyLexiconSha256,
          frenchGlossPolicy: {
            authority: "STEP-TAHOT-TAGNT",
            lexicalSense: "translated-dStrong-production-lexicon",
            contextualWitnesses: ["Sg1910", "DarbyR", "Darby"],
            fallback: "translated-dStrong-lexical-gloss"
          },
          rights: {
            license: "CC BY 4.0",
            attribution: STEP_INTERLINEAR_ATTRIBUTION,
            sourceUrl: "https://github.com/STEPBible/STEPBible-Data"
          },
          counts: {
            verses: verification.verseCount,
            tokens: verification.tokenCount,
            segments: verification.segmentCount,
            identities: verification.identityCount,
            strongVerseEntries: verification.strongVerseCount,
            englishGlosses: englishSummary.glossCount,
            frenchGlosses: frenchSummary.glossCount,
            frenchContextualGlosses: frenchSummary.contextualGlossCount,
            frenchLexicalFallbacks: frenchSummary.lexicalFallbackCount
          },
          sizes: {
            sourceSqliteBytes: sourceSizeBytes,
            runtimeSqliteBytes: runtimeSizeBytes,
            reductionRatio
          },
          artifacts,
          archives
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
      textRevision,
      verseCount: verification.verseCount,
      tokenCount: verification.tokenCount,
      segmentCount: verification.segmentCount,
      identityCount: verification.identityCount,
      strongVerseCount: verification.strongVerseCount,
      frenchContextualGlossCount: frenchSummary.contextualGlossCount,
      frenchLexicalFallbackCount: frenchSummary.lexicalFallbackCount,
      sourceSizeBytes,
      runtimeSizeBytes,
      reductionRatio,
      integrityCheck: "ok"
    };
  } catch (error) {
    await rm(temporaryDir, { recursive: true, force: true });
    throw error;
  }
}

async function createDeterministicZip(options: {
  inputPath: string;
  entryName: string;
  archivePath: string;
  stagingRoot: string;
}): Promise<void> {
  await mkdir(options.stagingRoot, { recursive: true });
  const stagedPath = path.join(options.stagingRoot, options.entryName);
  await copyFile(options.inputPath, stagedPath);
  await utimes(stagedPath, REPRODUCIBLE_ZIP_TIME, REPRODUCIBLE_ZIP_TIME);
  await execFileAsync(
    "zip",
    ["-X", "-9", "-q", options.archivePath, options.entryName],
    {
      cwd: options.stagingRoot,
      env: { ...process.env, TZ: "UTC" }
    }
  );
}

function readRuntimeData(
  ledgerPaths: { fr: string; en: string },
  references: ReferenceIndexes
): { verses: LedgerVerseRow[]; segments: RuntimeSegment[] } {
  const french = new DatabaseSync(ledgerPaths.fr, { readOnly: true });
  const english = new DatabaseSync(ledgerPaths.en, { readOnly: true });
  try {
    const verses = french
      .prepare(
        `SELECT id, bookOrder, bookId, chapter, verse, ref
           FROM Verses
          ORDER BY bookOrder, chapter, verse`
      )
      .all() as unknown as LedgerVerseRow[];
    const rows = french
      .prepare(
        `SELECT v.id AS verseId, v.bookOrder, v.bookId, v.chapter, v.verse,
                v.ref, t.id AS tokenKey, t.readingOrdinal,
                t.startOffset AS tokenStartOffset, t.length AS tokenLength,
                t.source, t.morphology AS tokenMorphology,
                s.ordinal AS segmentOrdinal,
                s.startOffset AS segmentStartOffset,
                s.length AS segmentLength, s.transliteration,
                s.originalLemma, s.morphology,
                s.gloss AS lexicalGlossFr,
                s.glossSource AS lexicalGlossSource,
                s.confidence AS lexicalConfidence
           FROM Tokens t
           JOIN Verses v ON v.id=t.verseId
           JOIN TokenSegments s ON s.tokenId=t.id
          WHERE t.isCanonical=1
          ORDER BY v.bookOrder, v.chapter, v.verse,
                   t.readingOrdinal, s.ordinal`
      )
      .all() as unknown as LedgerSegmentRow[];
    const englishGlosses = new Map(
      (
        english
          .prepare(
            `SELECT s.tokenId, s.ordinal, s.gloss
               FROM TokenSegments s
               JOIN Tokens t ON t.id=s.tokenId
              WHERE t.isCanonical=1`
          )
          .all() as Array<{
          tokenId: string;
          ordinal: number;
          gloss: string;
        }>
      ).map((row) => [segmentKey(row.tokenId, row.ordinal), row.gloss])
    );
    const codes = new Map<string, RuntimeCode[]>();
    for (const row of french
      .prepare(
        `SELECT sc.tokenId, sc.segmentOrdinal, sc.identityOrder,
                c.kind, c.code
           FROM SegmentStrongCodes sc
           JOIN StrongCodes c ON c.id=sc.codeId
           JOIN Tokens t ON t.id=sc.tokenId
          WHERE t.isCanonical=1
          ORDER BY sc.tokenId, sc.segmentOrdinal, sc.identityOrder`
      )
      .all() as unknown as Array<{
      tokenId: string;
      segmentOrdinal: number;
      kind: number;
      code: string;
    }>) {
      const key = segmentKey(row.tokenId, row.segmentOrdinal);
      const values = codes.get(key) ?? [];
      values.push({ kind: row.kind, code: row.code });
      codes.set(key, values);
    }

    const byVerse = new Map<string, RuntimeSegment[]>();
    for (const row of rows) {
      const key = segmentKey(row.tokenKey, row.segmentOrdinal);
      const segment: RuntimeSegment = {
        ...row,
        morphology: normalizeOccurrenceMorphology(row),
        englishGloss: englishGlosses.get(key) ?? "",
        codes: codes.get(key) ?? [],
        frenchGloss: {
          text: row.lexicalGlossFr,
          source: row.lexicalGlossSource,
          confidence: row.lexicalConfidence
        }
      };
      const verse = byVerse.get(row.ref) ?? [];
      verse.push(segment);
      byVerse.set(row.ref, verse);
    }
    const result: RuntimeSegment[] = [];
    for (const verseSegments of byVerse.values()) {
      contextualizeFrenchVerse(verseSegments, references);
      result.push(...verseSegments);
    }
    return { verses, segments: result };
  } finally {
    french.close();
    english.close();
  }
}

function normalizeOccurrenceMorphology(row: LedgerSegmentRow): string {
  const code = row.morphology.trim();
  if (row.source !== "TAHOT" || !code || row.segmentOrdinal === 0) {
    return code;
  }
  const language = row.tokenMorphology.trim().match(/^[HA]/u)?.[0];
  return language ? `${language}${code}` : code;
}

function assertMorphologyCoverage(
  segments: RuntimeSegment[],
  lexiconPath: string
): void {
  const database = new DatabaseSync(lexiconPath, { readOnly: true });
  try {
    const available = new Set(
      (
        database
          .prepare("SELECT code, normalizedCode FROM MorphologyCodes")
          .all() as Array<{ code: string; normalizedCode: string }>
      ).flatMap(({ code, normalizedCode }) => [code, normalizedCode])
    );
    const missing = [
      ...new Set(
        segments
          .map(({ morphology }) => morphology)
          .filter((code) => code && !available.has(code))
      )
    ].sort();
    if (missing.length > 0) {
      throw new Error(
        `step-interlinear-runtime-morphology-unresolved:${missing.slice(0, 10).join(",")}:${missing.length}`
      );
    }
  } finally {
    database.close();
  }
}

function contextualizeFrenchVerse(
  segments: RuntimeSegment[],
  references: ReferenceIndexes
): void {
  const counts = new Map<string, number>();
  for (const segment of segments) {
    for (const code of classicalCodes(segment)) {
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
  }
  const occurrence = new Map<string, number>();
  for (const segment of segments) {
    const candidates = classicalCodes(segment)
      .map((code) => {
        const index = occurrence.get(code) ?? 0;
        occurrence.set(code, index + 1);
        return contextualWitnessGloss({
          ref: segment.ref,
          code,
          occurrenceIndex: index,
          expectedCount: counts.get(code) ?? 0,
          references
        });
      })
      .filter((value): value is LocalizedGloss => Boolean(value))
      .sort(
        (left, right) =>
          right.confidence - left.confidence ||
          left.text.localeCompare(right.text, "fr")
      );
    if (candidates[0]) segment.frenchGloss = candidates[0];
  }
}

function classicalCodes(segment: RuntimeSegment): string[] {
  return [
    ...new Set(
      segment.codes
        .filter(({ kind }) => kind === 0)
        .map(({ code }) => normalizeClassicalStrong(code))
        .filter((code): code is string => Boolean(code))
    )
  ];
}

function contextualWitnessGloss(input: {
  ref: string;
  code: string;
  occurrenceIndex: number;
  expectedCount: number;
  references: ReferenceIndexes;
}): LocalizedGloss | undefined {
  const carriers = (Object.keys(input.references) as ReferenceName[]).flatMap(
    (name) => {
      const values =
        input.references[name].get(input.ref)?.get(input.code) ?? [];
      if (values.length !== input.expectedCount) return [];
      const text = values[input.occurrenceIndex]?.trim() ?? "";
      return text ? [{ name, text }] : [];
    }
  );
  if (carriers.length === 0) return undefined;
  const sg = carriers.find(({ name }) => name === "Sg1910");
  const darbyR = carriers.find(({ name }) => name === "DarbyR");
  const darby = carriers.find(({ name }) => name === "Darby");
  const chosen = sg ?? darbyR ?? darby;
  if (!chosen) return undefined;
  const agreement = carriers.some(
    (candidate) =>
      candidate.name !== chosen.name &&
      normalizeFrenchCarrier(candidate.text) ===
        normalizeFrenchCarrier(chosen.text)
  );
  return {
    text: chosen.text,
    source: agreement
      ? "reference-context-consensus"
      : `${chosen.name}-contextual`,
    confidence: agreement ? 0.99 : chosen.name === "Sg1910" ? 0.94 : 0.9
  };
}

async function readReferenceIndexes(
  paths: Record<ReferenceName, string>
): Promise<ReferenceIndexes> {
  const entries = await Promise.all(
    (Object.keys(paths) as ReferenceName[]).map(async (name) => [
      name,
      buildReferenceCarrierIndex(await readStrongCsv(paths[name]))
    ])
  );
  return Object.fromEntries(entries) as unknown as ReferenceIndexes;
}

function buildReferenceCarrierIndex(rows: StrongRow[]): ReferenceCarrierIndex {
  const index: ReferenceCarrierIndex = new Map();
  for (const row of rows) {
    const byStrong = new Map<string, string[]>();
    for (const match of row.text.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
      const attribute =
        /\bstrong=(["'])(.*?)\1/iu.exec(match[1] ?? "")?.[2] ?? "";
      const carrier = stripTags(match[2] ?? "")
        .replaceAll(/\s+/gu, " ")
        .trim();
      for (const rawCode of attribute.split(/\s+/u).filter(Boolean)) {
        const code = normalizeClassicalStrong(rawCode);
        if (!code) continue;
        const values = byStrong.get(code) ?? [];
        values.push(carrier);
        byStrong.set(code, values);
      }
    }
    index.set(referenceKey(row.bookId, row.chapter, row.verse), byStrong);
  }
  return index;
}

function writeRuntimeDatabase(input: {
  outputPath: string;
  locale: Locale;
  verses: LedgerVerseRow[];
  segments: RuntimeSegment[];
  textSha256: string;
  textRevision: string;
  ledgerHashes: Record<string, string>;
  referenceHashes: Record<string, string>;
  morphologyLexiconSha256: string;
}): {
  glossCount: number;
  contextualGlossCount: number;
  lexicalFallbackCount: number;
  strongVerseCount: number;
} {
  const database = new DatabaseSync(input.outputPath);
  try {
    createRuntimeSchema(database);
    const intern = createInterners(database);
    const insertVerse = database.prepare(
      `INSERT INTO Verses(
         id, bookOrder, bookId, chapter, verse, ref
       ) VALUES (?, ?, ?, ?, ?, ?)`
    );
    const insertToken = database.prepare(
      `INSERT INTO Tokens(
         id, verseId, readingOrdinal, startOffset, length
       ) VALUES (?, ?, ?, ?, ?)`
    );
    const insertSegment = database.prepare(
      `INSERT INTO Segments(
         id, tokenId, ordinal, startOffset, length,
         transliterationId, lemmaId, morphologyId, glossId,
         strongCodeId, eStrongCodeId, dStrongCodeId, uStrongCodeId
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const verseIds = new Map<string, number>();
    const tokenIds = new Map<string, number>();
    let nextTokenId = 1;
    let nextSegmentId = 1;
    let identityCount = 0;
    let glossCount = 0;
    let contextualGlossCount = 0;
    let lexicalFallbackCount = 0;

    database.exec("BEGIN IMMEDIATE");
    try {
      for (const verse of input.verses) {
        verseIds.set(verse.ref, verse.id);
        insertVerse.run(
          verse.id,
          verse.bookOrder,
          verse.bookId,
          verse.chapter,
          verse.verse,
          verse.ref
        );
      }
      for (const segment of input.segments) {
        const verseId = verseIds.get(segment.ref);
        if (!verseId) {
          throw new Error(
            `step-interlinear-runtime-verse-missing:${segment.ref}`
          );
        }
        let tokenId = tokenIds.get(segment.tokenKey);
        if (!tokenId) {
          tokenId = nextTokenId;
          nextTokenId += 1;
          tokenIds.set(segment.tokenKey, tokenId);
          insertToken.run(
            tokenId,
            verseId,
            segment.readingOrdinal,
            segment.tokenStartOffset,
            segment.tokenLength
          );
        }
        const gloss =
          input.locale === "en"
            ? {
                text: segment.englishGloss,
                source: "STEP-contextual",
                confidence: 1
              }
            : segment.frenchGloss;
        const segmentId = nextSegmentId;
        nextSegmentId += 1;
        const codeByKind = new Map(
          segment.codes.map((code) => [code.kind, code.code])
        );
        insertSegment.run(
          segmentId,
          tokenId,
          segment.segmentOrdinal,
          segment.segmentStartOffset,
          segment.segmentLength,
          intern.transliteration(segment.transliteration),
          intern.lemma(segment.originalLemma),
          intern.morphology(segment.morphology),
          intern.gloss(gloss),
          intern.optionalStrongCode(codeByKind.get(0)),
          intern.optionalStrongCode(codeByKind.get(1)),
          intern.optionalStrongCode(codeByKind.get(2)),
          intern.optionalStrongCode(codeByKind.get(3))
        );
        if (gloss.text) glossCount += 1;
        if (
          input.locale === "fr" &&
          (gloss.source === "reference-context-consensus" ||
            gloss.source.endsWith("-contextual"))
        ) {
          contextualGlossCount += 1;
        } else if (input.locale === "fr") {
          lexicalFallbackCount += 1;
        }
        identityCount += segment.codes.length;
      }
      database.exec(`
        INSERT INTO StrongVerseIndex(codeId, verseId, kindMask)
        SELECT codeId, verseId, sum(kindBit)
          FROM (
            SELECT s.strongCodeId AS codeId, t.verseId, 1 AS kindBit
              FROM Segments s
              JOIN Tokens t ON t.id=s.tokenId
             WHERE s.strongCodeId IS NOT NULL
            UNION
            SELECT s.eStrongCodeId, t.verseId, 2
              FROM Segments s
              JOIN Tokens t ON t.id=s.tokenId
             WHERE s.eStrongCodeId IS NOT NULL
            UNION
            SELECT s.dStrongCodeId, t.verseId, 4
              FROM Segments s
              JOIN Tokens t ON t.id=s.tokenId
             WHERE s.dStrongCodeId IS NOT NULL
            UNION
            SELECT s.uStrongCodeId, t.verseId, 8
              FROM Segments s
              JOIN Tokens t ON t.id=s.tokenId
             WHERE s.uStrongCodeId IS NOT NULL
          )
         GROUP BY codeId, verseId
      `);
      const strongVerseCount = Number(
        (
          database
            .prepare("SELECT count(*) AS count FROM StrongVerseIndex")
            .get() as { count?: number } | undefined
        )?.count ?? 0
      );
      writeRuntimeMetadata(database, {
        locale: input.locale,
        textSha256: input.textSha256,
        textRevision: input.textRevision,
        ledgerHashes: input.ledgerHashes,
        referenceHashes: input.referenceHashes,
        morphologyLexiconSha256: input.morphologyLexiconSha256,
        verseCount: verseIds.size,
        tokenCount: tokenIds.size,
        segmentCount: input.segments.length,
        identityCount,
        strongVerseCount,
        glossCount,
        contextualGlossCount,
        lexicalFallbackCount
      });
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("VACUUM; ANALYZE;");
    const strongVerseCount = Number(
      (
        database
          .prepare("SELECT count(*) AS count FROM StrongVerseIndex")
          .get() as { count?: number } | undefined
      )?.count ?? 0
    );
    return {
      glossCount,
      contextualGlossCount,
      lexicalFallbackCount,
      strongVerseCount
    };
  } finally {
    database.close();
  }
}

function createInterners(database: DatabaseSync): {
  transliteration(value: string): number;
  lemma(value: string): number;
  morphology(value: string): number;
  gloss(value: LocalizedGloss): number;
  optionalStrongCode(value: string | undefined): number | null;
} {
  const textInterner = (
    table: "Transliterations" | "Lemmas" | "Morphologies",
    column: "value" | "code"
  ): ((value: string) => number) => {
    const insert = database.prepare(
      `INSERT INTO ${table}(id, ${column}) VALUES (?, ?)`
    );
    const cache = new Map<string, number>();
    let nextId = 1;
    return (value: string): number => {
      const cached = cache.get(value);
      if (cached) return cached;
      const id = nextId;
      nextId += 1;
      insert.run(id, value);
      cache.set(value, id);
      return id;
    };
  };
  const glossInsert = database.prepare(
    `INSERT INTO Glosses(id, text, source, confidence)
     VALUES (?, ?, ?, ?)`
  );
  const glossCache = new Map<string, number>();
  const codeInsert = database.prepare(
    "INSERT INTO StrongCodes(id, code) VALUES (?, ?)"
  );
  const codeCache = new Map<string, number>();
  let nextGlossId = 1;
  let nextCodeId = 1;
  return {
    transliteration: textInterner("Transliterations", "value"),
    lemma: textInterner("Lemmas", "value"),
    morphology: textInterner("Morphologies", "code"),
    gloss(value): number {
      const key = JSON.stringify(value);
      const cached = glossCache.get(key);
      if (cached) return cached;
      const id = nextGlossId;
      nextGlossId += 1;
      glossInsert.run(id, value.text, value.source, value.confidence);
      glossCache.set(key, id);
      return id;
    },
    optionalStrongCode(value): number | null {
      if (!value) return null;
      const cached = codeCache.get(value);
      if (cached) return cached;
      const id = nextCodeId;
      nextCodeId += 1;
      codeInsert.run(id, value);
      codeCache.set(value, id);
      return id;
    }
  };
}

function createRuntimeSchema(database: DatabaseSync): void {
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
      ref TEXT NOT NULL UNIQUE
    );

    CREATE TABLE Tokens (
      id INTEGER PRIMARY KEY,
      verseId INTEGER NOT NULL REFERENCES Verses(id),
      readingOrdinal INTEGER NOT NULL,
      startOffset INTEGER NOT NULL CHECK(startOffset >= 0),
      length INTEGER NOT NULL CHECK(length >= 0)
    );

    CREATE TABLE Transliterations (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE Lemmas (
      id INTEGER PRIMARY KEY,
      value TEXT NOT NULL
    );
    CREATE TABLE Morphologies (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL
    );
    CREATE TABLE Glosses (
      id INTEGER PRIMARY KEY,
      text TEXT NOT NULL,
      source TEXT NOT NULL,
      confidence REAL NOT NULL
    );

    CREATE TABLE StrongCodes (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL
    );

    CREATE TABLE Segments (
      id INTEGER PRIMARY KEY,
      tokenId INTEGER NOT NULL REFERENCES Tokens(id),
      ordinal INTEGER NOT NULL,
      startOffset INTEGER NOT NULL CHECK(startOffset >= 0),
      length INTEGER NOT NULL CHECK(length >= 0),
      transliterationId INTEGER NOT NULL REFERENCES Transliterations(id),
      lemmaId INTEGER NOT NULL REFERENCES Lemmas(id),
      morphologyId INTEGER NOT NULL REFERENCES Morphologies(id),
      glossId INTEGER NOT NULL REFERENCES Glosses(id),
      strongCodeId INTEGER REFERENCES StrongCodes(id),
      eStrongCodeId INTEGER REFERENCES StrongCodes(id),
      dStrongCodeId INTEGER REFERENCES StrongCodes(id),
      uStrongCodeId INTEGER REFERENCES StrongCodes(id)
    );

    CREATE TABLE StrongVerseIndex (
      codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
      verseId INTEGER NOT NULL REFERENCES Verses(id),
      kindMask INTEGER NOT NULL CHECK(kindMask BETWEEN 1 AND 15),
      PRIMARY KEY(codeId, verseId)
    ) WITHOUT ROWID;

    CREATE INDEX idx_runtime_verses_location
      ON Verses(bookOrder, chapter, verse);
    CREATE INDEX idx_runtime_tokens_verse_ordinal
      ON Tokens(verseId, readingOrdinal);
    CREATE INDEX idx_runtime_segments_token_ordinal
      ON Segments(tokenId, ordinal);
    CREATE UNIQUE INDEX idx_runtime_strong_codes_code
      ON StrongCodes(code);
  `);
}

function writeRuntimeMetadata(
  database: DatabaseSync,
  values: {
    locale: Locale;
    textSha256: string;
    textRevision: string;
    ledgerHashes: Record<string, string>;
    referenceHashes: Record<string, string>;
    morphologyLexiconSha256: string;
    verseCount: number;
    tokenCount: number;
    segmentCount: number;
    identityCount: number;
    strongVerseCount: number;
    glossCount: number;
    contextualGlossCount: number;
    lexicalFallbackCount: number;
  }
): void {
  const insert = database.prepare(
    "INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)"
  );
  const metadata = {
    schemaVersion: STEP_INTERLINEAR_RUNTIME_SCHEMA_VERSION,
    builderVersion: STEP_INTERLINEAR_RUNTIME_BUILDER_VERSION,
    datasetId: "STEP",
    sourceVersion: "TAHOT/TAGNT",
    locale: values.locale,
    textSha256: values.textSha256,
    textRevision: values.textRevision,
    ledgerHashes: JSON.stringify(values.ledgerHashes),
    referenceHashes: JSON.stringify(values.referenceHashes),
    morphologyLexiconSha256: values.morphologyLexiconSha256,
    verseCount: values.verseCount,
    tokenCount: values.tokenCount,
    segmentCount: values.segmentCount,
    identityCount: values.identityCount,
    strongVerseCount: values.strongVerseCount,
    glossCount: values.glossCount,
    contextualGlossCount: values.contextualGlossCount,
    lexicalFallbackCount: values.lexicalFallbackCount,
    offsetUnit: "UTF-16-code-unit",
    morphologyPolicy:
      "compact STEP occurrence code; localized explanation resolved by lexicon",
    lemmaPolicy: "interned STEP exact lexicon lemma",
    strongPolicy: "classical plus distinct STEP identities",
    concordancePolicy:
      "deduplicated code-to-verse index; exact token and segment associations remain in Segments",
    attribution: STEP_INTERLINEAR_ATTRIBUTION,
    license: "CC BY 4.0",
    sourceUrl: "https://github.com/STEPBible/STEPBible-Data"
  };
  for (const [key, value] of Object.entries(metadata)) {
    insert.run(key, String(value));
  }
}

export async function verifyStepInterlinearRuntimePublication(options: {
  textPath: string;
  frenchPath: string;
  englishPath: string;
}): Promise<{
  verseCount: number;
  tokenCount: number;
  segmentCount: number;
  identityCount: number;
  strongVerseCount: number;
  integrityCheck: "ok";
}> {
  const textContent = await readFile(options.textPath, "utf8");
  const textSha256 = sha256(textContent);
  const bible = JSON.parse(textContent) as Record<
    string,
    Record<string, Record<string, string>>
  >;
  const databases = [options.englishPath, options.frenchPath].map(
    (file) => new DatabaseSync(file, { readOnly: true })
  );
  try {
    const metadata = databases.map((database) =>
      Object.fromEntries(
        (
          database
            .prepare("SELECT key, value FROM ResourceMetadata")
            .all() as Array<{ key: string; value: string }>
        ).map(({ key, value }) => [key, value])
      )
    );
    const structuralKeys = [
      "schemaVersion",
      "builderVersion",
      "datasetId",
      "sourceVersion",
      "textSha256",
      "textRevision",
      "ledgerHashes",
      "morphologyLexiconSha256",
      "verseCount",
      "tokenCount",
      "segmentCount",
      "identityCount",
      "strongVerseCount",
      "offsetUnit"
    ];
    for (const [index, database] of databases.entries()) {
      const integrity = String(
        (
          database.prepare("PRAGMA integrity_check").get() as
            | { integrity_check?: string }
            | undefined
        )?.integrity_check ?? ""
      );
      if (integrity !== "ok") {
        throw new Error(
          `step-interlinear-runtime-integrity:${index}:${integrity}`
        );
      }
      if (metadata[index]?.textSha256 !== textSha256) {
        throw new Error(`step-interlinear-runtime-text-hash-mismatch:${index}`);
      }
      assertStrongVerseIndex(database, index);
    }
    for (const key of structuralKeys) {
      if (metadata[0]?.[key] !== metadata[1]?.[key]) {
        throw new Error(`step-interlinear-runtime-structure-mismatch:${key}`);
      }
    }
    const expectedVerseCount = Object.values(bible).reduce(
      (bookTotal, chapters) =>
        bookTotal +
        Object.values(chapters).reduce(
          (chapterTotal, verses) => chapterTotal + Object.keys(verses).length,
          0
        ),
      0
    );
    if (Number(metadata[0]?.verseCount ?? 0) !== expectedVerseCount) {
      throw new Error(
        `step-interlinear-runtime-verse-count-mismatch:${metadata[0]?.verseCount}:${expectedVerseCount}`
      );
    }
    const invalidTokens = databases[0]!
      .prepare(
        `SELECT v.bookOrder, v.chapter, v.verse,
                t.id, t.startOffset, t.length
           FROM Tokens t JOIN Verses v ON v.id=t.verseId`
      )
      .all() as Array<{
      bookOrder: number;
      chapter: number;
      verse: number;
      id: number;
      startOffset: number;
      length: number;
    }>;
    for (const token of invalidTokens) {
      const text =
        bible[String(token.bookOrder)]?.[String(token.chapter)]?.[
          String(token.verse)
        ];
      if (
        typeof text !== "string" ||
        token.startOffset + token.length > text.length
      ) {
        throw new Error(
          `step-interlinear-runtime-invalid-token-range:${token.id}`
        );
      }
    }
    const structureSql = `
      SELECT group_concat(payload, char(10)) AS payload FROM (
        SELECT t.id || '|' || t.verseId || '|' || t.readingOrdinal || '|' ||
               t.startOffset || '|' || t.length || '|' ||
               s.id || '|' || s.ordinal || '|' || s.startOffset || '|' ||
               s.length || '|' || tr.value || '|' || l.value || '|' ||
               m.code || '|' || ifnull(c0.code,'') || '|' ||
               ifnull(c1.code,'') || '|' || ifnull(c2.code,'') || '|' ||
               ifnull(c3.code,'') AS payload
          FROM Tokens t
          JOIN Segments s ON s.tokenId=t.id
          JOIN Transliterations tr ON tr.id=s.transliterationId
          JOIN Lemmas l ON l.id=s.lemmaId
          JOIN Morphologies m ON m.id=s.morphologyId
          LEFT JOIN StrongCodes c0 ON c0.id=s.strongCodeId
          LEFT JOIN StrongCodes c1 ON c1.id=s.eStrongCodeId
          LEFT JOIN StrongCodes c2 ON c2.id=s.dStrongCodeId
          LEFT JOIN StrongCodes c3 ON c3.id=s.uStrongCodeId
         ORDER BY t.id, s.ordinal
      )`;
    const structures = databases.map(
      (database) =>
        (
          database.prepare(structureSql).get() as
            | { payload?: string }
            | undefined
        )?.payload ?? ""
    );
    if (sha256(structures[0]!) !== sha256(structures[1]!)) {
      throw new Error("step-interlinear-runtime-token-structure-mismatch");
    }
    return {
      verseCount: Number(metadata[0]?.verseCount ?? 0),
      tokenCount: Number(metadata[0]?.tokenCount ?? 0),
      segmentCount: Number(metadata[0]?.segmentCount ?? 0),
      identityCount: Number(metadata[0]?.identityCount ?? 0),
      strongVerseCount: Number(metadata[0]?.strongVerseCount ?? 0),
      integrityCheck: "ok"
    };
  } finally {
    databases.forEach((database) => database.close());
  }
}

function assertStrongVerseIndex(database: DatabaseSync, index: number): void {
  const nonCanonicalVerseIds = Number(
    (
      database
        .prepare(
          `SELECT count(*) AS count
             FROM (
               SELECT id, bookOrder, chapter, verse,
                      lag(bookOrder) OVER (ORDER BY id) AS previousBook,
                      lag(chapter) OVER (ORDER BY id) AS previousChapter,
                      lag(verse) OVER (ORDER BY id) AS previousVerse
                 FROM Verses
             )
            WHERE previousBook IS NOT NULL
              AND (
                bookOrder < previousBook OR
                (bookOrder=previousBook AND chapter < previousChapter) OR
                (bookOrder=previousBook AND chapter=previousChapter AND
                 verse < previousVerse)
              )`
        )
        .get() as { count?: number } | undefined
    )?.count ?? 0
  );
  if (nonCanonicalVerseIds !== 0) {
    throw new Error(
      `step-interlinear-runtime-noncanonical-verse-ids:${index}:${nonCanonicalVerseIds}`
    );
  }
  const mismatch = database
    .prepare(
      `WITH expected(codeId, verseId, kindMask) AS (
         SELECT codeId, verseId, sum(kindBit)
           FROM (
             SELECT s.strongCodeId AS codeId, t.verseId, 1 AS kindBit
               FROM Segments s JOIN Tokens t ON t.id=s.tokenId
              WHERE s.strongCodeId IS NOT NULL
             UNION
             SELECT s.eStrongCodeId, t.verseId, 2
               FROM Segments s JOIN Tokens t ON t.id=s.tokenId
              WHERE s.eStrongCodeId IS NOT NULL
             UNION
             SELECT s.dStrongCodeId, t.verseId, 4
               FROM Segments s JOIN Tokens t ON t.id=s.tokenId
              WHERE s.dStrongCodeId IS NOT NULL
             UNION
             SELECT s.uStrongCodeId, t.verseId, 8
               FROM Segments s JOIN Tokens t ON t.id=s.tokenId
              WHERE s.uStrongCodeId IS NOT NULL
           )
          GROUP BY codeId, verseId
       ),
       missing AS (
         SELECT codeId, verseId, kindMask FROM expected
         EXCEPT
         SELECT codeId, verseId, kindMask FROM StrongVerseIndex
       ),
       extra AS (
         SELECT codeId, verseId, kindMask FROM StrongVerseIndex
         EXCEPT
         SELECT codeId, verseId, kindMask FROM expected
       )
       SELECT (SELECT count(*) FROM missing) +
              (SELECT count(*) FROM extra) AS count`
    )
    .get() as { count: number };
  if (mismatch.count !== 0) {
    throw new Error(
      `step-interlinear-runtime-strong-index-mismatch:${index}:${mismatch.count}`
    );
  }
  const plan = database
    .prepare(
      "EXPLAIN QUERY PLAN SELECT verseId FROM StrongVerseIndex WHERE codeId=? ORDER BY verseId LIMIT 60"
    )
    .all(1) as unknown as Array<{ detail: string }>;
  if (
    plan.some(({ detail }) =>
      /\bSCAN\s+(?:TABLE\s+)?Segments\b/iu.test(detail)
    ) ||
    !plan.some(({ detail }) => /StrongVerseIndex/iu.test(detail))
  ) {
    throw new Error(
      `step-interlinear-runtime-strong-index-plan:${index}:${plan
        .map(({ detail }) => detail)
        .join("|")}`
    );
  }
}

function segmentKey(tokenId: string, ordinal: number): string {
  return `${tokenId}\u0000${ordinal}`;
}

function normalizeFrenchCarrier(value: string): string {
  return value
    .normalize("NFKD")
    .replaceAll(/\p{M}/gu, "")
    .replaceAll(/[^\p{L}\p{N}]+/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase("fr");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

async function sha256File(filePath: string): Promise<string> {
  return sha256(await readFile(filePath));
}

function roundRatio(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}

function parseCliOptions(
  argv: readonly string[]
): StepInterlinearRuntimeOptions {
  const args = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index]?.replace(/^--/u, "");
    const value = argv[index + 1];
    if (!key || !value || value.startsWith("--")) {
      throw new Error(`step-interlinear-runtime-invalid-option:${key}`);
    }
    args.set(key, value);
    index += 1;
  }
  const allowed = new Set([
    "ledger-dir",
    "output-dir",
    "lexicon",
    "sg1910",
    "darby",
    "darbyr"
  ]);
  for (const key of args.keys()) {
    if (!allowed.has(key)) {
      throw new Error(`step-interlinear-runtime-unknown-option:${key}`);
    }
  }
  return {
    ledgerDir: args.get("ledger-dir") ?? DEFAULT_STEP_INTERLINEAR_LEDGER,
    outputDir:
      args.get("output-dir") ?? DEFAULT_STEP_INTERLINEAR_RUNTIME_RELEASE,
    lexiconPath:
      args.get("lexicon") ?? DEFAULT_STEP_INTERLINEAR_MORPHOLOGY_LEXICON,
    referencePaths: {
      Sg1910: args.get("sg1910") ?? DEFAULT_STEP_INTERLINEAR_REFERENCES.Sg1910,
      Darby: args.get("darby") ?? DEFAULT_STEP_INTERLINEAR_REFERENCES.Darby,
      DarbyR: args.get("darbyr") ?? DEFAULT_STEP_INTERLINEAR_REFERENCES.DarbyR
    }
  };
}

async function main(): Promise<void> {
  const result = await buildStepInterlinearRuntimePublication(
    parseCliOptions(process.argv.slice(2))
  );
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
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
