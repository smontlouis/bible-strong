import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

export type FinalLexiconRecord = {
  stepEntryId: number;
  targetLanguage: string;
  status: string;
  source: {
    language: "greek" | "hebrew";
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
    gloss: string;
  };
  translation: {
    glossFr: string;
    meaningHtmlFr: string;
    notesFr: string;
    engine: string;
    reviewEngine: string | null;
  };
  validation: {
    issues: string[];
    sourceReferenceCount: number;
    translatedReferenceCount: number;
    missingReferences: string[];
    missingStrongCodes: string[];
    inventedStrongCodes: string[];
    missingSectionMarkers: string[];
  };
  usage: {
    sourceChars: number;
    translatedChars: number;
  };
};

export type StepEntrySource = {
  id: number;
  language: "greek" | "hebrew";
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  glossEn: string;
  meaningEn: string;
};

export type ProductReviewEntry = {
  id: number;
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  glossEn: string;
  glossFr: string;
  meaningEn: string;
  meaningHtmlFr: string;
  notesFr: string;
  status: string;
  score: number;
  flags: string[];
  sourceChars: number;
  translatedChars: number;
  sourceReferenceCount: number;
  translatedReferenceCount: number;
  lengthRatio: number;
  reviewEngine: string | null;
  previewFr: string;
  previewEn: string;
};

export type ProductReviewSummary = {
  generatedAt: string;
  finalJsonl: string;
  totalEntries: number;
  accepted: number;
  reviewNeeded: number;
  greek: number;
  hebrew: number;
  topRiskCount: number;
  manualFixCount: number;
  anomalyCount: number;
};

export type ProductReviewResult = {
  summary: ProductReviewSummary;
  entries: ProductReviewEntry[];
};

const KEY_STRONGS = new Set([
  "G0026",
  "G1343",
  "G1344",
  "G3056",
  "G4102",
  "G4151",
  "G5485",
  "H0430",
  "H3068",
  "H7225"
]);

const ENGLISH_RESIDUE_PATTERN =
  /\b(?:namely|hence|properly|figuratively|metaphorically|therefore|chiefly|usually|especially|only)\b/i;

const PROPER_NOUN_FALSE_FRIENDS = new Map<string, RegExp>([
  ["Beer", /\bbi[eè]re\b/i],
  ["Ham", /\bjambon\b/i],
  ["Job", /\b(?:emploi|travail)\b/i],
  ["Nod", /\bhochement\b/i],
  ["On", /\ble\b/i],
  ["Put", /\bmettre\b/i]
]);

export function buildProductReview(input: {
  dbPath: string;
  finalJsonlPath: string;
}): ProductReviewResult {
  const records = readFinalLexiconRecords(input.finalJsonlPath);
  const sources = new Map(
    readStepEntrySources(input.dbPath).map((entry) => [entry.id, entry])
  );

  const entries = records
    .map((record) =>
      buildProductReviewEntry(record, sources.get(record.stepEntryId))
    )
    .sort(
      (a, b) =>
        b.score - a.score || b.sourceChars - a.sourceChars || a.id - b.id
    );

  return {
    summary: {
      generatedAt: new Date().toISOString(),
      finalJsonl: input.finalJsonlPath,
      totalEntries: entries.length,
      accepted: entries.filter((entry) => entry.status === "accepted").length,
      reviewNeeded: entries.filter((entry) => entry.status === "review_needed")
        .length,
      greek: entries.filter((entry) => entry.language === "greek").length,
      hebrew: entries.filter((entry) => entry.language === "hebrew").length,
      topRiskCount: Math.min(200, entries.length),
      manualFixCount: entries.filter((entry) =>
        entry.flags.includes("manual-fix")
      ).length,
      anomalyCount: entries.filter((entry) =>
        entry.flags.some((flag) =>
          [
            "ratio-low",
            "ratio-high",
            "residual-english",
            "suspicious-name"
          ].includes(flag)
        )
      ).length
    },
    entries
  };
}

export function readFinalLexiconRecords(path: string): FinalLexiconRecord[] {
  const records: FinalLexiconRecord[] = [];
  let lineNumber = 0;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    lineNumber += 1;
    if (!line.trim()) continue;
    const record = JSON.parse(line) as FinalLexiconRecord;
    if (!Number.isInteger(record.stepEntryId)) {
      throw new Error(`Invalid stepEntryId at ${path}:${lineNumber}`);
    }
    records.push(record);
  }
  return records;
}

export function stripHtml(value: string): string {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function readStepEntrySources(dbPath: string): StepEntrySource[] {
  return runSqlJson<StepEntrySource>(
    dbPath,
    `
      SELECT
        id,
        language,
        baseCode,
        eStrong,
        dStrong,
        uStrong,
        original,
        transliteration,
        morph,
        gloss AS glossEn,
        meaning AS meaningEn
      FROM StepEntries
      ORDER BY id
    `
  );
}

function buildProductReviewEntry(
  record: FinalLexiconRecord,
  source: StepEntrySource | undefined
): ProductReviewEntry {
  if (!source) {
    throw new Error(`Missing StepEntries source for id ${record.stepEntryId}`);
  }

  const sourceText = `${source.glossEn} ${stripHtml(source.meaningEn)}`.trim();
  const translatedText =
    `${record.translation.glossFr} ${stripHtml(record.translation.meaningHtmlFr)}`.trim();
  const sourceChars = sourceText.length;
  const translatedChars = translatedText.length;
  const lengthRatio = sourceChars > 0 ? translatedChars / sourceChars : 1;
  const flags = buildFlags(
    record,
    source,
    sourceChars,
    lengthRatio,
    translatedText
  );

  return {
    id: record.stepEntryId,
    language: source.language,
    eStrong: source.eStrong,
    dStrong: source.dStrong,
    uStrong: source.uStrong,
    original: source.original,
    transliteration: source.transliteration,
    morph: source.morph,
    glossEn: source.glossEn,
    glossFr: record.translation.glossFr,
    meaningEn: source.meaningEn,
    meaningHtmlFr: record.translation.meaningHtmlFr,
    notesFr: record.translation.notesFr,
    status: record.status,
    score: scoreEntry(record, sourceChars, lengthRatio, flags),
    flags,
    sourceChars,
    translatedChars,
    sourceReferenceCount: record.validation.sourceReferenceCount,
    translatedReferenceCount: record.validation.translatedReferenceCount,
    lengthRatio,
    reviewEngine: record.translation.reviewEngine,
    previewFr: translatedText.slice(0, 260),
    previewEn: sourceText.slice(0, 260)
  };
}

function buildFlags(
  record: FinalLexiconRecord,
  source: StepEntrySource,
  sourceChars: number,
  lengthRatio: number,
  translatedText: string
): string[] {
  const flags: string[] = [];
  if (KEY_STRONGS.has(source.eStrong)) flags.push("critical-strong");
  if (record.translation.reviewEngine) flags.push("manual-fix");
  if (sourceChars >= 2500) flags.push("long-entry");
  if (record.validation.sourceReferenceCount >= 20)
    flags.push("many-references");
  if (sourceChars >= 500 && lengthRatio < 0.72) flags.push("ratio-low");
  if (sourceChars >= 500 && lengthRatio > 1.65) flags.push("ratio-high");
  if (ENGLISH_RESIDUE_PATTERN.test(translatedText))
    flags.push("residual-english");
  const falseFriendPattern = PROPER_NOUN_FALSE_FRIENDS.get(source.glossEn);
  if (falseFriendPattern?.test(record.translation.glossFr)) {
    flags.push("suspicious-name");
  }
  if (record.validation.issues.length > 0) flags.push("validator-issue");
  return flags;
}

function scoreEntry(
  record: FinalLexiconRecord,
  sourceChars: number,
  lengthRatio: number,
  flags: string[]
): number {
  let score = Math.min(45, Math.round(sourceChars / 180));
  score += Math.min(45, record.validation.sourceReferenceCount);

  const weights = new Map([
    ["critical-strong", 100],
    ["validator-issue", 95],
    ["manual-fix", 80],
    ["long-entry", 50],
    ["many-references", 40],
    ["ratio-low", 35],
    ["ratio-high", 30],
    ["suspicious-name", 25],
    ["residual-english", 15]
  ]);

  for (const flag of flags) {
    score += weights.get(flag) ?? 0;
  }

  if (sourceChars >= 180) {
    score += Math.round(Math.abs(1 - lengthRatio) * 12);
  }

  return score;
}

function runSqlJson<T>(dbPath: string, sql: string): T[] {
  const result = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 120
  });
  return JSON.parse(result || "[]") as T[];
}
