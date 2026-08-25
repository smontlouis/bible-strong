import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import { BOOK_IDS } from "./books.js";

const execFileAsync = promisify(execFile);

export const ENGLISH_STRONG_LEXEME_SAMPLE_AUDIT_POLICY =
  "english-strong-lexeme-sample-audit@9";
export const DEFAULT_ENGLISH_STRONG_LEXEME_AUDIT_SEED =
  "english-lexeme-pos-kjv-asv-2026-07-30";
export const DEFAULT_ENGLISH_STRONG_LEXEME_BEFORE_RELEASE =
  "outputs/releases/bible-strong-reverse-interlinear-v10-lexeme-refined-candidate";
export const DEFAULT_ENGLISH_STRONG_LEXEME_AFTER_RELEASE =
  "outputs/releases/bible-strong-reverse-interlinear-v18-wordnet-context-candidate";
export const DEFAULT_ENGLISH_STRONG_LEXEME_AUDIT_OUTPUT =
  "outputs/audits/english-lexeme-pos-kjv-asv-v18-same-sample-100-v9";

type IdentityKind = 0 | 1 | 2;
type SelectionStratum =
  | "canary"
  | "correction-heavy"
  | "high-frequency"
  | "deterministic-hebrew"
  | "deterministic-greek"
  | "deterministic-fill";

export interface IdentityCandidate {
  key: string;
  kind: IdentityKind;
  code: string;
  occurrencesByBible: Record<string, number>;
  correctionCount: number;
}

export interface SelectedIdentity extends IdentityCandidate {
  selectionStratum: SelectionStratum;
}

interface CatalogBible {
  applicationVersionId: string;
  canonical: {
    file: string;
    entry: string;
    contentSha256: string;
  };
  strong: {
    file: string;
    entry: string;
    contentSha256: string;
    strongRevision: string;
    lexemeRefinement?: {
      policy?: string;
      decisionDigest?: string;
      remainingCanaries?: Record<string, number>;
    };
  };
}

interface ReleaseCatalog {
  generatedAt: string;
  bibles: CatalogBible[];
  englishLexemeRefinement?: {
    index?: { file?: string };
  };
}

interface CanonicalBible {
  verses: Record<string, Record<string, Record<string, { text: string }>>>;
}

interface CorrectionRecord {
  applicationVersionId: string;
  bookOrder: number;
  chapter: number;
  verse: number;
  ordinal: number;
  lemma: string;
  previousPartOfSpeech: string;
  partOfSpeech: string;
  method: string;
  identityKind: number;
  identityCode: string;
}

interface RawOccurrence {
  bibleId: string;
  bookOrder: number;
  chapter: number;
  verse: number;
  ordinal: number;
  startOffset: number;
  length: number;
  stepTokenId: number | null;
  lemma: string;
  afterPartOfSpeech: string;
  identityKeys: string[];
  surface: string;
  context: string;
  beforeLemma: string;
  beforePartOfSpeech: string;
  sourcePartOfSpeech?: string;
  correction?: CorrectionRecord;
}

interface AuditExample {
  ref: string;
  ordinal: number;
  surface: string;
  context: string;
  lemma: string;
  transition: string;
  sourcePartOfSpeech?: string;
  correctionMethod?: string;
}

interface IdentityBibleAudit {
  occurrences: number;
  changedOccurrences: number;
  beforePartsOfSpeech: Record<string, number>;
  afterPartsOfSpeech: Record<string, number>;
  dominantBeforePartOfSpeech: string;
  dominantAfterPartOfSpeech: string;
  sourceComparableOccurrences: number;
  beforeSourceAgreements: number;
  afterSourceAgreements: number;
  examples: AuditExample[];
}

interface IdentityAudit {
  key: string;
  kind: IdentityKind;
  kindLabel: string;
  code: string;
  testament: "Hebrew" | "Greek";
  selectionStratum: SelectionStratum;
  correctionCountInRelease: number;
  bibles: Record<string, IdentityBibleAudit>;
}

interface ReviewCandidate extends AuditExample {
  bibleId: string;
  identityKeys: string[];
  reason:
    | "lowercase-name"
    | "source-regression"
    | "residual-cross-bible-disagreement"
    | "new-cross-bible-disagreement";
}

interface EnglishStrongLexemeSampleAudit {
  format: "english-strong-lexeme-sample-audit";
  schemaVersion: 9;
  policy: typeof ENGLISH_STRONG_LEXEME_SAMPLE_AUDIT_POLICY;
  seed: string;
  generatedAt: string;
  inputs: {
    beforeRelease: string;
    beforeCatalogSha256: string;
    afterRelease: string;
    afterCatalogSha256: string;
    decisionIndexSha256: string;
    decisionDigest: string;
  };
  selection: {
    requestedSampleSize: number;
    selectedSampleSize: number;
    minimumOccurrencesPerBible: number;
    sharedEligibleIdentityCount: number;
    strata: Record<string, number>;
  };
  bibles: Array<{
    applicationVersionId: string;
    beforeStrongRevision: string;
    afterStrongRevision: string;
    canonicalSha256: string;
    releaseCanaries: Record<string, number>;
  }>;
  summary: {
    sampledIdentityCount: number;
    sampledIdentityOccurrences: number;
    sampledUniqueSpans: number;
    changedUniqueSpans: number;
    changedUniqueSpansByBible: Record<string, number>;
    correctionsByMethod: Record<string, number>;
    correctionsByTransition: Record<string, number>;
    lowercaseNameCorrections: number;
    lowercaseNameCorrectionsByMethod: Record<string, number>;
    lowercaseNameCorrectionsByLemma: Record<string, number>;
    lowercaseNameFinalOccurrences: number;
    lowercaseNameFinalOccurrencesByLemma: Record<string, number>;
    indeterminateSampledPos: number;
    missingBeforeCoordinates: number;
    sourceComparableUniqueSpans: number;
    beforeSourceAgreements: number;
    afterSourceAgreements: number;
    sourceAgreementImprovements: number;
    sourceAgreementRegressions: number;
    sharedIdentityLemmaPairs: number;
    beforeCrossBibleDisagreements: number;
    afterCrossBibleDisagreements: number;
    resolvedCrossBibleDisagreements: number;
    newCrossBibleDisagreements: number;
    mechanicalStatus: "pass" | "fail";
    semanticStatus: "pass" | "remediation-required";
  };
  identities: IdentityAudit[];
  reviewCandidates: ReviewCandidate[];
}

interface ExtractedBible {
  bibleId: string;
  beforeDatabasePath: string;
  afterDatabasePath: string;
  canonical: CanonicalBible;
  beforeCatalogBible: CatalogBible;
  afterCatalogBible: CatalogBible;
}

interface SelectedOccurrence extends RawOccurrence {
  selectedIdentityKeys: string[];
}

const KIND_LABELS: Record<IdentityKind, string> = {
  0: "classical",
  1: "eStrong",
  2: "dStrong"
};
const INDETERMINATE_POS = new Set([
  "",
  "unknown",
  "undetermined",
  "unresolved",
  "indeterminate"
]);
const CANARY_IDENTITIES: Array<[IdentityKind, string]> = [
  [2, "H430G"],
  [0, "H3068"],
  [0, "H1732"],
  [0, "H4872"],
  [0, "G5547"]
];

export async function auditEnglishStrongLexemeSample(
  options: {
    root?: string;
    beforeRelease?: string;
    afterRelease?: string;
    outputDir?: string;
    bibleIds?: string[];
    sampleSize?: number;
    minimumOccurrencesPerBible?: number;
    seed?: string;
    generatedAt?: string;
    stepRuntimePath?: string;
    sampleFrom?: string;
  } = {}
): Promise<{
  outputDir: string;
  reportPath: string;
  auditPath: string;
  audit: EnglishStrongLexemeSampleAudit;
}> {
  const root = path.resolve(options.root ?? process.cwd());
  const beforeRelease = path.resolve(
    root,
    options.beforeRelease ?? DEFAULT_ENGLISH_STRONG_LEXEME_BEFORE_RELEASE
  );
  const afterRelease = path.resolve(
    root,
    options.afterRelease ?? DEFAULT_ENGLISH_STRONG_LEXEME_AFTER_RELEASE
  );
  const outputDir = path.resolve(
    root,
    options.outputDir ?? DEFAULT_ENGLISH_STRONG_LEXEME_AUDIT_OUTPUT
  );
  const bibleIds = options.bibleIds ?? ["KJV", "ASV"];
  const sampleSize = options.sampleSize ?? 100;
  const minimumOccurrencesPerBible = options.minimumOccurrencesPerBible ?? 10;
  const seed = options.seed ?? DEFAULT_ENGLISH_STRONG_LEXEME_AUDIT_SEED;
  if (bibleIds.length !== 2 || new Set(bibleIds).size !== 2) {
    throw new Error("english-strong-lexeme-audit-requires-two-bibles");
  }
  if (sampleSize < 10) {
    throw new Error(
      `english-strong-lexeme-audit-sample-too-small:${sampleSize}`
    );
  }
  if (existsSync(outputDir)) {
    throw new Error(`english-strong-lexeme-audit-output-exists:${outputDir}`);
  }
  const workingDir = `${outputDir}.work-${process.pid}-${randomUUID()}`;
  const temporaryDir = await mkdtemp(
    path.join(tmpdir(), "english-strong-lexeme-audit-")
  );

  try {
    const beforeCatalogPath = path.join(beforeRelease, "catalog.json");
    const afterCatalogPath = path.join(afterRelease, "catalog.json");
    const [beforeCatalog, afterCatalog] = await Promise.all([
      readJson<ReleaseCatalog>(beforeCatalogPath),
      readJson<ReleaseCatalog>(afterCatalogPath)
    ]);
    const extractedBibles: ExtractedBible[] = [];
    for (const bibleId of bibleIds) {
      const beforeCatalogBible = requiredCatalogBible(
        beforeCatalog,
        bibleId,
        "before"
      );
      const afterCatalogBible = requiredCatalogBible(
        afterCatalog,
        bibleId,
        "after"
      );
      const bibleBuildDir = path.join(temporaryDir, bibleId.toLowerCase());
      const beforeBuildDir = path.join(bibleBuildDir, "before");
      const afterBuildDir = path.join(bibleBuildDir, "after");
      await Promise.all([
        mkdir(beforeBuildDir, { recursive: true }),
        mkdir(afterBuildDir, { recursive: true })
      ]);
      await Promise.all([
        execFileAsync("unzip", [
          "-q",
          path.join(beforeRelease, beforeCatalogBible.strong.file),
          "-d",
          beforeBuildDir
        ]),
        execFileAsync("unzip", [
          "-q",
          path.join(afterRelease, afterCatalogBible.strong.file),
          "-d",
          afterBuildDir
        ])
      ]);
      const canonical = await readZipJson<CanonicalBible>(
        path.join(afterRelease, afterCatalogBible.canonical.file),
        afterCatalogBible.canonical.entry
      );
      extractedBibles.push({
        bibleId,
        beforeDatabasePath: path.join(
          beforeBuildDir,
          beforeCatalogBible.strong.entry
        ),
        afterDatabasePath: path.join(
          afterBuildDir,
          afterCatalogBible.strong.entry
        ),
        canonical,
        beforeCatalogBible,
        afterCatalogBible
      });
    }

    const decisionIndexPath = path.join(
      afterRelease,
      afterCatalog.englishLexemeRefinement?.index?.file ??
        "lexemes/english-lexeme-decisions.sqlite"
    );
    if (!existsSync(decisionIndexPath)) {
      throw new Error(
        `english-strong-lexeme-audit-decision-index-missing:${decisionIndexPath}`
      );
    }
    const corrections = readCorrections(decisionIndexPath, bibleIds);
    const correctionsByCoordinate = new Map(
      corrections.map((correction) => [
        coordinateKey(correction.applicationVersionId, correction),
        correction
      ])
    );
    const correctionCountByIdentity = countCorrectionsByIdentity(corrections);
    const statsByBible = new Map(
      extractedBibles.map((bible) => [
        bible.bibleId,
        readIdentityStats(bible.afterDatabasePath)
      ])
    );
    const candidates = sharedIdentityCandidates({
      bibleIds,
      statsByBible,
      correctionCountByIdentity,
      minimumOccurrencesPerBible
    });
    const selected = options.sampleFrom
      ? await selectIdentitySampleFromAudit(
          candidates,
          path.resolve(root, options.sampleFrom),
          sampleSize
        )
      : selectIdentitySample(candidates, sampleSize, seed);
    const selectedKeys = new Set(selected.map(({ key }) => key));
    const selectedByKey = new Map(selected.map((item) => [item.key, item]));

    const afterOccurrences: SelectedOccurrence[] = [];
    for (const bible of extractedBibles) {
      afterOccurrences.push(
        ...readSelectedAfterOccurrences({
          bible,
          selectedKeys,
          correctionsByCoordinate
        })
      );
    }
    const selectedCoordinatesByBible = new Map<string, Set<string>>();
    for (const occurrence of afterOccurrences) {
      const values =
        selectedCoordinatesByBible.get(occurrence.bibleId) ?? new Set<string>();
      values.add(coordinateKey("", occurrence));
      selectedCoordinatesByBible.set(occurrence.bibleId, values);
    }
    const beforeLexemes = new Map<
      string,
      { lemma: string; partOfSpeech: string }
    >();
    for (const bible of extractedBibles) {
      for (const [coordinate, lexeme] of readBeforeLexemes(
        bible.beforeDatabasePath,
        selectedCoordinatesByBible.get(bible.bibleId) ?? new Set<string>()
      )) {
        beforeLexemes.set(`${bible.bibleId}\u0000${coordinate}`, lexeme);
      }
    }
    const neededStepTokenIds = new Set(
      afterOccurrences
        .map(({ stepTokenId }) => stepTokenId)
        .filter((value): value is number => value !== null)
    );
    const sourceMorphology = readStepMorphology(
      path.resolve(
        root,
        options.stepRuntimePath ??
          "outputs/releases/bible-step-interlinear-runtime-v4/bible-step-interlinear-en.sqlite"
      ),
      neededStepTokenIds
    );
    let missingBeforeCoordinates = 0;
    for (const occurrence of afterOccurrences) {
      const before = beforeLexemes.get(
        `${occurrence.bibleId}\u0000${coordinateKey("", occurrence)}`
      );
      if (!before) {
        missingBeforeCoordinates += 1;
        occurrence.beforeLemma = "";
        occurrence.beforePartOfSpeech = "";
      } else {
        occurrence.beforeLemma = before.lemma;
        occurrence.beforePartOfSpeech = before.partOfSpeech;
      }
      if (occurrence.stepTokenId !== null) {
        occurrence.sourcePartOfSpeech = sourceMorphology.get(
          occurrence.stepTokenId
        );
      }
    }

    const identities = buildIdentityAudits({
      bibleIds,
      selected,
      occurrences: afterOccurrences
    });
    const summaryAndReview = summarizeAudit({
      bibleIds,
      occurrences: afterOccurrences,
      missingBeforeCoordinates
    });
    const decisionDigest = readDecisionDigest(decisionIndexPath);
    const releaseCanariesAreZero = extractedBibles.every((bible) =>
      Object.values(
        bible.afterCatalogBible.strong.lexemeRefinement?.remainingCanaries ?? {}
      ).every((count) => count === 0)
    );
    const mechanicalStatus =
      summaryAndReview.summary.indeterminateSampledPos === 0 &&
      missingBeforeCoordinates === 0 &&
      releaseCanariesAreZero
        ? "pass"
        : "fail";
    const audit: EnglishStrongLexemeSampleAudit = {
      format: "english-strong-lexeme-sample-audit",
      schemaVersion: 9,
      policy: ENGLISH_STRONG_LEXEME_SAMPLE_AUDIT_POLICY,
      seed,
      generatedAt: options.generatedAt ?? afterCatalog.generatedAt ?? "unknown",
      inputs: {
        beforeRelease: path.relative(root, beforeRelease),
        beforeCatalogSha256: await sha256File(beforeCatalogPath),
        afterRelease: path.relative(root, afterRelease),
        afterCatalogSha256: await sha256File(afterCatalogPath),
        decisionIndexSha256: await sha256File(decisionIndexPath),
        decisionDigest
      },
      selection: {
        requestedSampleSize: sampleSize,
        selectedSampleSize: selected.length,
        minimumOccurrencesPerBible,
        sharedEligibleIdentityCount: candidates.length,
        strata: countBy(selected, ({ selectionStratum }) => selectionStratum)
      },
      bibles: extractedBibles.map((bible) => ({
        applicationVersionId: bible.bibleId,
        beforeStrongRevision: bible.beforeCatalogBible.strong.strongRevision,
        afterStrongRevision: bible.afterCatalogBible.strong.strongRevision,
        canonicalSha256: bible.afterCatalogBible.canonical.contentSha256,
        releaseCanaries:
          bible.afterCatalogBible.strong.lexemeRefinement?.remainingCanaries ??
          {}
      })),
      summary: {
        sampledIdentityCount: selected.length,
        ...summaryAndReview.summary,
        mechanicalStatus,
        semanticStatus:
          summaryAndReview.summary.lowercaseNameFinalOccurrences === 0
            ? "pass"
            : "remediation-required"
      },
      identities,
      reviewCandidates: summaryAndReview.reviewCandidates
    };
    if (selected.length !== sampleSize) {
      throw new Error(
        `english-strong-lexeme-audit-selection-size:${selected.length}:${sampleSize}`
      );
    }
    if (mechanicalStatus !== "pass") {
      throw new Error(
        `english-strong-lexeme-audit-mechanical-failure:${JSON.stringify(audit.summary)}`
      );
    }

    await mkdir(workingDir, { recursive: true });
    const auditPath = path.join(workingDir, "audit.json");
    const reportPath = path.join(workingDir, "report.md");
    await Promise.all([
      writeFile(auditPath, `${JSON.stringify(audit, null, 2)}\n`),
      writeFile(reportPath, renderMarkdown(audit))
    ]);
    await rename(workingDir, outputDir);
    return {
      outputDir,
      auditPath: path.join(outputDir, "audit.json"),
      reportPath: path.join(outputDir, "report.md"),
      audit
    };
  } catch (error) {
    await rm(workingDir, { recursive: true, force: true });
    throw error;
  } finally {
    await rm(temporaryDir, { recursive: true, force: true });
  }
}

export function selectIdentitySample(
  candidates: IdentityCandidate[],
  sampleSize: number,
  seed: string
): SelectedIdentity[] {
  if (candidates.length < sampleSize) {
    throw new Error(
      `english-strong-lexeme-audit-insufficient-candidates:${candidates.length}:${sampleSize}`
    );
  }
  const byKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate])
  );
  const selected = new Map<string, SelectedIdentity>();
  const add = (
    candidatesToAdd: IdentityCandidate[],
    count: number,
    selectionStratum: SelectionStratum
  ): void => {
    let added = 0;
    for (const candidate of candidatesToAdd) {
      if (selected.has(candidate.key)) continue;
      selected.set(candidate.key, { ...candidate, selectionStratum });
      added += 1;
      if (added === count || selected.size === sampleSize) break;
    }
  };

  const canaries = CANARY_IDENTITIES.map(([kind, code]) =>
    byKey.get(identityKey(kind, code))
  ).filter((value): value is IdentityCandidate => Boolean(value));
  add(canaries, Math.min(canaries.length, sampleSize), "canary");
  const remainingAfterCanaries = sampleSize - selected.size;
  const correctionQuota = Math.floor(remainingAfterCanaries * 0.37);
  const frequencyQuota = Math.floor(remainingAfterCanaries * 0.21);
  const languageQuota = Math.floor(
    (remainingAfterCanaries - correctionQuota - frequencyQuota) / 2
  );
  add(
    [...candidates].sort(
      (left, right) =>
        right.correctionCount - left.correctionCount ||
        totalOccurrences(right) - totalOccurrences(left) ||
        left.key.localeCompare(right.key)
    ),
    correctionQuota,
    "correction-heavy"
  );
  add(
    [...candidates].sort(
      (left, right) =>
        totalOccurrences(right) - totalOccurrences(left) ||
        left.key.localeCompare(right.key)
    ),
    frequencyQuota,
    "high-frequency"
  );
  add(
    deterministicOrder(
      candidates.filter(({ code }) => code.startsWith("H")),
      `${seed}:hebrew`
    ),
    languageQuota,
    "deterministic-hebrew"
  );
  add(
    deterministicOrder(
      candidates.filter(({ code }) => code.startsWith("G")),
      `${seed}:greek`
    ),
    languageQuota,
    "deterministic-greek"
  );
  add(
    deterministicOrder(candidates, `${seed}:fill`),
    sampleSize - selected.size,
    "deterministic-fill"
  );
  return [...selected.values()];
}

async function selectIdentitySampleFromAudit(
  candidates: IdentityCandidate[],
  auditPath: string,
  sampleSize: number
): Promise<SelectedIdentity[]> {
  const prior = await readJson<{
    identities: Array<{
      key: string;
      selectionStratum: SelectionStratum;
    }>;
  }>(auditPath);
  if (prior.identities.length !== sampleSize) {
    throw new Error(
      `english-strong-lexeme-audit-prior-sample-size:${prior.identities.length}:${sampleSize}`
    );
  }
  const candidatesByKey = new Map(
    candidates.map((candidate) => [candidate.key, candidate])
  );
  return prior.identities.map(({ key, selectionStratum }) => {
    const candidate = candidatesByKey.get(key);
    if (!candidate) {
      throw new Error(
        `english-strong-lexeme-audit-prior-identity-ineligible:${key}`
      );
    }
    return { ...candidate, selectionStratum };
  });
}

function requiredCatalogBible(
  catalog: ReleaseCatalog,
  bibleId: string,
  phase: string
): CatalogBible {
  const bible = catalog.bibles.find(
    ({ applicationVersionId }) => applicationVersionId === bibleId
  );
  if (!bible) {
    throw new Error(
      `english-strong-lexeme-audit-bible-missing:${phase}:${bibleId}`
    );
  }
  return bible;
}

function readCorrections(
  decisionIndexPath: string,
  bibleIds: string[]
): CorrectionRecord[] {
  const database = new DatabaseSync(decisionIndexPath, { readOnly: true });
  try {
    const placeholders = bibleIds.map(() => "?").join(",");
    return database
      .prepare(
        `SELECT applicationVersionId,bookOrder,chapter,verse,ordinal,lemma,
                previousPartOfSpeech,partOfSpeech,method,identityKind,identityCode
           FROM EnglishLexemeCorrections
          WHERE applicationVersionId IN (${placeholders})
          ORDER BY applicationVersionId,bookOrder,chapter,verse,ordinal`
      )
      .all(...bibleIds) as unknown as CorrectionRecord[];
  } finally {
    database.close();
  }
}

function readDecisionDigest(decisionIndexPath: string): string {
  const database = new DatabaseSync(decisionIndexPath, { readOnly: true });
  try {
    return String(
      database
        .prepare(`SELECT value FROM Metadata WHERE key='decisionDigest'`)
        .get()?.value ?? ""
    );
  } finally {
    database.close();
  }
}

function countCorrectionsByIdentity(
  corrections: CorrectionRecord[]
): Map<string, number> {
  const result = new Map<string, number>();
  for (const correction of corrections) {
    if (correction.identityKind > 2) continue;
    increment(
      result,
      identityKey(
        correction.identityKind as IdentityKind,
        correction.identityCode
      )
    );
  }
  return result;
}

function readIdentityStats(databasePath: string): Map<string, number> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const result = new Map<string, number>();
  try {
    for (const row of database
      .prepare(
        `SELECT c.kind,c.code,COUNT(*) AS occurrences
           FROM WordStrongCodes x
           JOIN StrongCodes c ON c.id=x.codeId
           JOIN WordSpans w
             ON w.verseId=x.verseId AND w.ordinal=x.ordinal
          WHERE c.kind BETWEEN 0 AND 2 AND w.lexemeId IS NOT NULL
          GROUP BY c.kind,c.code
          ORDER BY c.kind,c.code`
      )
      .iterate() as Iterable<{
      kind: IdentityKind;
      code: string;
      occurrences: number;
    }>) {
      result.set(identityKey(row.kind, row.code), Number(row.occurrences));
    }
  } finally {
    database.close();
  }
  return result;
}

function sharedIdentityCandidates(options: {
  bibleIds: string[];
  statsByBible: Map<string, Map<string, number>>;
  correctionCountByIdentity: Map<string, number>;
  minimumOccurrencesPerBible: number;
}): IdentityCandidate[] {
  const firstStats = options.statsByBible.get(options.bibleIds[0]!);
  if (!firstStats) throw new Error("english-strong-lexeme-audit-stats-missing");
  const candidates: IdentityCandidate[] = [];
  for (const key of firstStats.keys()) {
    const occurrencesByBible: Record<string, number> = {};
    let eligible = true;
    for (const bibleId of options.bibleIds) {
      const count = options.statsByBible.get(bibleId)?.get(key) ?? 0;
      occurrencesByBible[bibleId] = count;
      if (count < options.minimumOccurrencesPerBible) eligible = false;
    }
    if (!eligible) continue;
    const [kindValue, code] = key.split(":", 2);
    candidates.push({
      key,
      kind: Number(kindValue) as IdentityKind,
      code: code!,
      occurrencesByBible,
      correctionCount: options.correctionCountByIdentity.get(key) ?? 0
    });
  }
  return candidates.sort((left, right) => left.key.localeCompare(right.key));
}

function readSelectedAfterOccurrences(options: {
  bible: ExtractedBible;
  selectedKeys: Set<string>;
  correctionsByCoordinate: Map<string, CorrectionRecord>;
}): SelectedOccurrence[] {
  const database = new DatabaseSync(options.bible.afterDatabasePath, {
    readOnly: true
  });
  const results: SelectedOccurrence[] = [];
  try {
    const rows = database
      .prepare(
        `SELECT v.bookOrder,v.chapter,v.verse,w.ordinal,w.startOffset,w.length,
                w.stepTokenId,l.lemma,l.partOfSpeech,
                GROUP_CONCAT(c.kind || ':' || c.code,'|') AS identityKeys
           FROM WordSpans w
           JOIN Verses v ON v.id=w.verseId
           JOIN FrenchLexemes l ON l.id=w.lexemeId
           LEFT JOIN WordStrongCodes x
             ON x.verseId=w.verseId AND x.ordinal=w.ordinal
           LEFT JOIN StrongCodes c ON c.id=x.codeId
          GROUP BY v.bookOrder,v.chapter,v.verse,w.ordinal,w.startOffset,w.length,
                   w.stepTokenId,l.lemma,l.partOfSpeech
          ORDER BY v.bookOrder,v.chapter,v.verse,w.ordinal`
      )
      .iterate() as Iterable<{
      bookOrder: number;
      chapter: number;
      verse: number;
      ordinal: number;
      startOffset: number;
      length: number;
      stepTokenId: number | null;
      lemma: string;
      partOfSpeech: string;
      identityKeys: string | null;
    }>;
    for (const row of rows) {
      const identityKeys = (row.identityKeys ?? "")
        .split("|")
        .filter(Boolean)
        .map(normalizeSerializedIdentity);
      const selectedIdentityKeys = identityKeys.filter((key) =>
        options.selectedKeys.has(key)
      );
      if (selectedIdentityKeys.length === 0) continue;
      const verseText =
        options.bible.canonical.verses[String(row.bookOrder)]?.[
          String(row.chapter)
        ]?.[String(row.verse)]?.text ?? "";
      const surface = verseText.slice(
        row.startOffset,
        row.startOffset + row.length
      );
      results.push({
        bibleId: options.bible.bibleId,
        bookOrder: row.bookOrder,
        chapter: row.chapter,
        verse: row.verse,
        ordinal: row.ordinal,
        startOffset: row.startOffset,
        length: row.length,
        stepTokenId: row.stepTokenId,
        lemma: row.lemma,
        afterPartOfSpeech: row.partOfSpeech,
        identityKeys,
        selectedIdentityKeys,
        surface,
        context: contextSlice(verseText, row.startOffset, row.length),
        beforeLemma: "",
        beforePartOfSpeech: "",
        correction: options.correctionsByCoordinate.get(
          coordinateKey(options.bible.bibleId, row)
        )
      });
    }
  } finally {
    database.close();
  }
  return results;
}

function readBeforeLexemes(
  databasePath: string,
  selectedCoordinates: Set<string>
): Map<string, { lemma: string; partOfSpeech: string }> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const result = new Map<string, { lemma: string; partOfSpeech: string }>();
  try {
    for (const row of database
      .prepare(
        `SELECT v.bookOrder,v.chapter,v.verse,w.ordinal,l.lemma,l.partOfSpeech
           FROM WordSpans w
           JOIN Verses v ON v.id=w.verseId
           JOIN FrenchLexemes l ON l.id=w.lexemeId
          ORDER BY v.bookOrder,v.chapter,v.verse,w.ordinal`
      )
      .iterate() as Iterable<{
      bookOrder: number;
      chapter: number;
      verse: number;
      ordinal: number;
      lemma: string;
      partOfSpeech: string;
    }>) {
      const key = coordinateKey("", row);
      if (!selectedCoordinates.has(key)) continue;
      result.set(key, {
        lemma: row.lemma,
        partOfSpeech: row.partOfSpeech
      });
    }
  } finally {
    database.close();
  }
  return result;
}

function readStepMorphology(
  databasePath: string,
  selectedTokenIds: Set<number>
): Map<number, string> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const categories = new Map<number, Set<string>>();
  try {
    for (const row of database
      .prepare(
        `SELECT s.tokenId,m.code
           FROM Segments s
           JOIN Morphologies m ON m.id=s.morphologyId
          ORDER BY s.tokenId,s.ordinal`
      )
      .iterate() as Iterable<{ tokenId: number; code: string }>) {
      if (!selectedTokenIds.has(row.tokenId)) continue;
      const category = classifyMorphology(row.code);
      if (!category) continue;
      const values = categories.get(row.tokenId) ?? new Set<string>();
      values.add(category);
      categories.set(row.tokenId, values);
    }
  } finally {
    database.close();
  }
  const result = new Map<number, string>();
  for (const [tokenId, values] of categories) {
    if (values.size === 1) result.set(tokenId, [...values][0]!);
  }
  return result;
}

function classifyMorphology(value: string): string | undefined {
  const parts = value.split(/[/=;+ ]+/u).filter(Boolean);
  const categories = new Set<string>();
  for (const part of parts) {
    if (/^(?:H?Np|N-PRI)/u.test(part)) categories.add("name");
    else if (/^(?:H?N|N-)/u.test(part)) categories.add("noun");
    else if (/^(?:H?V|V-)/u.test(part)) categories.add("verb");
    else if (/^(?:H?A|A-)/u.test(part)) categories.add("adj");
    else if (/^(?:ADV|HD)/u.test(part)) categories.add("adv");
  }
  return categories.size === 1 ? [...categories][0] : undefined;
}

function buildIdentityAudits(options: {
  bibleIds: string[];
  selected: SelectedIdentity[];
  occurrences: SelectedOccurrence[];
}): IdentityAudit[] {
  const occurrencesByIdentity = new Map<string, SelectedOccurrence[]>();
  for (const occurrence of options.occurrences) {
    for (const key of occurrence.selectedIdentityKeys) {
      const values = occurrencesByIdentity.get(key) ?? [];
      values.push(occurrence);
      occurrencesByIdentity.set(key, values);
    }
  }
  return options.selected.map((selected) => {
    const occurrences = occurrencesByIdentity.get(selected.key) ?? [];
    const bibles: Record<string, IdentityBibleAudit> = {};
    for (const bibleId of options.bibleIds) {
      const bibleOccurrences = occurrences.filter(
        (occurrence) => occurrence.bibleId === bibleId
      );
      const beforePartsOfSpeech = countBy(
        bibleOccurrences,
        ({ beforePartOfSpeech }) => beforePartOfSpeech || "(missing)"
      );
      const afterPartsOfSpeech = countBy(
        bibleOccurrences,
        ({ afterPartOfSpeech }) => afterPartOfSpeech
      );
      const sourceComparable = bibleOccurrences.filter(
        ({ sourcePartOfSpeech }) => Boolean(sourcePartOfSpeech)
      );
      bibles[bibleId] = {
        occurrences: bibleOccurrences.length,
        changedOccurrences: bibleOccurrences.filter(
          ({ beforePartOfSpeech, afterPartOfSpeech }) =>
            beforePartOfSpeech !== afterPartOfSpeech
        ).length,
        beforePartsOfSpeech,
        afterPartsOfSpeech,
        dominantBeforePartOfSpeech: dominantCount(beforePartsOfSpeech),
        dominantAfterPartOfSpeech: dominantCount(afterPartsOfSpeech),
        sourceComparableOccurrences: sourceComparable.length,
        beforeSourceAgreements: sourceComparable.filter(
          ({ beforePartOfSpeech, sourcePartOfSpeech }) =>
            beforePartOfSpeech === sourcePartOfSpeech
        ).length,
        afterSourceAgreements: sourceComparable.filter(
          ({ afterPartOfSpeech, sourcePartOfSpeech }) =>
            afterPartOfSpeech === sourcePartOfSpeech
        ).length,
        examples: selectExamples(bibleOccurrences)
      };
    }
    return {
      key: selected.key,
      kind: selected.kind,
      kindLabel: KIND_LABELS[selected.kind],
      code: selected.code,
      testament: selected.code.startsWith("H") ? "Hebrew" : "Greek",
      selectionStratum: selected.selectionStratum,
      correctionCountInRelease: selected.correctionCount,
      bibles
    };
  });
}

function summarizeAudit(options: {
  bibleIds: string[];
  occurrences: SelectedOccurrence[];
  missingBeforeCoordinates: number;
}): {
  summary: Omit<
    EnglishStrongLexemeSampleAudit["summary"],
    "sampledIdentityCount" | "mechanicalStatus" | "semanticStatus"
  >;
  reviewCandidates: ReviewCandidate[];
} {
  const uniqueSpans = new Map<string, SelectedOccurrence>();
  let sampledIdentityOccurrences = 0;
  for (const occurrence of options.occurrences) {
    sampledIdentityOccurrences += occurrence.selectedIdentityKeys.length;
    uniqueSpans.set(coordinateKey(occurrence.bibleId, occurrence), occurrence);
  }
  const spans = [...uniqueSpans.values()];
  const changed = spans.filter(
    ({ beforePartOfSpeech, afterPartOfSpeech }) =>
      beforePartOfSpeech !== afterPartOfSpeech
  );
  const sourceComparable = spans.filter(({ sourcePartOfSpeech }) =>
    Boolean(sourcePartOfSpeech)
  );
  const changedSourceComparable = changed.filter(({ sourcePartOfSpeech }) =>
    Boolean(sourcePartOfSpeech)
  );
  const improvements = changedSourceComparable.filter(
    ({ beforePartOfSpeech, afterPartOfSpeech, sourcePartOfSpeech }) =>
      beforePartOfSpeech !== sourcePartOfSpeech &&
      afterPartOfSpeech === sourcePartOfSpeech
  );
  const regressions = changedSourceComparable.filter(
    ({ beforePartOfSpeech, afterPartOfSpeech, sourcePartOfSpeech }) =>
      beforePartOfSpeech === sourcePartOfSpeech &&
      afterPartOfSpeech !== sourcePartOfSpeech
  );
  const lowercaseNames = changed.filter(
    ({ afterPartOfSpeech, lemma, surface }) =>
      afterPartOfSpeech === "name" && !hasCapitalizedLemmaToken(surface, lemma)
  );
  const finalLowercaseNames = spans.filter(
    ({ afterPartOfSpeech, lemma, surface }) =>
      afterPartOfSpeech === "name" && !hasCapitalizedLemmaToken(surface, lemma)
  );
  const crossBible = compareCrossBibleIdentityLemmas(
    options.bibleIds,
    options.occurrences
  );
  const reviewCandidates: ReviewCandidate[] = lowercaseNames
    .slice(0, 75)
    .map((occurrence) => ({
      bibleId: occurrence.bibleId,
      identityKeys: occurrence.selectedIdentityKeys,
      reason: "lowercase-name" as const,
      ...toExample(occurrence)
    }));
  const lowercaseCoordinates = new Set(
    lowercaseNames.map((occurrence) =>
      coordinateKey(occurrence.bibleId, occurrence)
    )
  );
  reviewCandidates.push(
    ...regressions
      .filter(
        (occurrence) =>
          !lowercaseCoordinates.has(
            coordinateKey(occurrence.bibleId, occurrence)
          )
      )
      .slice(0, 25)
      .map((occurrence) => ({
        bibleId: occurrence.bibleId,
        identityKeys: occurrence.selectedIdentityKeys,
        reason: "source-regression" as const,
        ...toExample(occurrence)
      })),
    ...crossBible.reviewCandidates.slice(0, 25)
  );
  return {
    summary: {
      sampledIdentityOccurrences,
      sampledUniqueSpans: spans.length,
      changedUniqueSpans: changed.length,
      changedUniqueSpansByBible: Object.fromEntries(
        options.bibleIds.map((bibleId) => [
          bibleId,
          changed.filter((occurrence) => occurrence.bibleId === bibleId).length
        ])
      ),
      correctionsByMethod: countBy(
        changed.filter(
          (
            occurrence
          ): occurrence is SelectedOccurrence & {
            correction: CorrectionRecord;
          } => Boolean(occurrence.correction)
        ),
        ({ correction }) => correction.method
      ),
      correctionsByTransition: countBy(
        changed,
        ({ beforePartOfSpeech, afterPartOfSpeech }) =>
          `${beforePartOfSpeech}->${afterPartOfSpeech}`
      ),
      lowercaseNameCorrections: lowercaseNames.length,
      lowercaseNameCorrectionsByMethod: countBy(
        lowercaseNames.filter(
          (
            occurrence
          ): occurrence is SelectedOccurrence & {
            correction: CorrectionRecord;
          } => Boolean(occurrence.correction)
        ),
        ({ correction }) => correction.method
      ),
      lowercaseNameCorrectionsByLemma: topCounts(
        countBy(lowercaseNames, ({ lemma }) => normalizeLemma(lemma)),
        20
      ),
      lowercaseNameFinalOccurrences: finalLowercaseNames.length,
      lowercaseNameFinalOccurrencesByLemma: topCounts(
        countBy(finalLowercaseNames, ({ lemma }) => normalizeLemma(lemma)),
        1_000
      ),
      indeterminateSampledPos: spans.filter(({ afterPartOfSpeech }) =>
        INDETERMINATE_POS.has(afterPartOfSpeech.trim().toLowerCase())
      ).length,
      missingBeforeCoordinates: options.missingBeforeCoordinates,
      sourceComparableUniqueSpans: sourceComparable.length,
      beforeSourceAgreements: sourceComparable.filter(
        ({ beforePartOfSpeech, sourcePartOfSpeech }) =>
          beforePartOfSpeech === sourcePartOfSpeech
      ).length,
      afterSourceAgreements: sourceComparable.filter(
        ({ afterPartOfSpeech, sourcePartOfSpeech }) =>
          afterPartOfSpeech === sourcePartOfSpeech
      ).length,
      sourceAgreementImprovements: improvements.length,
      sourceAgreementRegressions: regressions.length,
      sharedIdentityLemmaPairs: crossBible.sharedPairs,
      beforeCrossBibleDisagreements: crossBible.beforeDisagreements,
      afterCrossBibleDisagreements: crossBible.afterDisagreements,
      resolvedCrossBibleDisagreements: crossBible.resolved,
      newCrossBibleDisagreements: crossBible.newDisagreements
    },
    reviewCandidates
  };
}

function compareCrossBibleIdentityLemmas(
  bibleIds: string[],
  occurrences: SelectedOccurrence[]
): {
  sharedPairs: number;
  beforeDisagreements: number;
  afterDisagreements: number;
  resolved: number;
  newDisagreements: number;
  reviewCandidates: ReviewCandidate[];
} {
  const counts = new Map<
    string,
    Record<
      string,
      { before: Record<string, number>; after: Record<string, number> }
    >
  >();
  const examples = new Map<string, SelectedOccurrence>();
  for (const occurrence of occurrences) {
    for (const identity of occurrence.selectedIdentityKeys) {
      const pairKey = `${identity}\u0000${normalizeLemma(occurrence.lemma)}`;
      const byBible = counts.get(pairKey) ?? {};
      const values = byBible[occurrence.bibleId] ?? {
        before: {},
        after: {}
      };
      values.before[occurrence.beforePartOfSpeech] =
        (values.before[occurrence.beforePartOfSpeech] ?? 0) + 1;
      values.after[occurrence.afterPartOfSpeech] =
        (values.after[occurrence.afterPartOfSpeech] ?? 0) + 1;
      byBible[occurrence.bibleId] = values;
      counts.set(pairKey, byBible);
      examples.set(`${pairKey}\u0000${occurrence.bibleId}`, occurrence);
    }
  }
  let sharedPairs = 0;
  let beforeDisagreements = 0;
  let afterDisagreements = 0;
  let resolved = 0;
  let newDisagreements = 0;
  const reviewCandidates: ReviewCandidate[] = [];
  for (const [pairKey, byBible] of counts) {
    const left = byBible[bibleIds[0]!];
    const right = byBible[bibleIds[1]!];
    if (!left || !right) continue;
    sharedPairs += 1;
    const beforeDisagrees =
      dominantCount(left.before) !== dominantCount(right.before);
    const afterDisagrees =
      dominantCount(left.after) !== dominantCount(right.after);
    if (beforeDisagrees) beforeDisagreements += 1;
    if (afterDisagrees) {
      afterDisagreements += 1;
      const occurrence =
        examples.get(`${pairKey}\u0000${bibleIds[0]!}`) ??
        examples.get(`${pairKey}\u0000${bibleIds[1]!}`);
      if (occurrence) {
        reviewCandidates.push({
          bibleId: occurrence.bibleId,
          identityKeys: occurrence.selectedIdentityKeys,
          reason: beforeDisagrees
            ? "residual-cross-bible-disagreement"
            : "new-cross-bible-disagreement",
          ...toExample(occurrence)
        });
      }
    }
    if (beforeDisagrees && !afterDisagrees) resolved += 1;
    if (!beforeDisagrees && afterDisagrees) {
      newDisagreements += 1;
    }
  }
  return {
    sharedPairs,
    beforeDisagreements,
    afterDisagreements,
    resolved,
    newDisagreements,
    reviewCandidates
  };
}

function selectExamples(occurrences: SelectedOccurrence[]): AuditExample[] {
  return [...occurrences]
    .sort(
      (left, right) =>
        Number(right.beforePartOfSpeech !== right.afterPartOfSpeech) -
          Number(left.beforePartOfSpeech !== left.afterPartOfSpeech) ||
        left.bookOrder - right.bookOrder ||
        left.chapter - right.chapter ||
        left.verse - right.verse ||
        left.ordinal - right.ordinal
    )
    .slice(0, 2)
    .map(toExample);
}

function toExample(occurrence: SelectedOccurrence): AuditExample {
  return {
    ref: formatReference(occurrence),
    ordinal: occurrence.ordinal,
    surface: occurrence.surface,
    context: occurrence.context,
    lemma: occurrence.lemma,
    transition: `${occurrence.beforePartOfSpeech}->${occurrence.afterPartOfSpeech}`,
    ...(occurrence.sourcePartOfSpeech
      ? { sourcePartOfSpeech: occurrence.sourcePartOfSpeech }
      : {}),
    ...(occurrence.correction
      ? { correctionMethod: occurrence.correction.method }
      : {})
  };
}

function renderMarkdown(audit: EnglishStrongLexemeSampleAudit): string {
  const summary = audit.summary;
  const sourceBeforeRate = percent(
    summary.beforeSourceAgreements,
    summary.sourceComparableUniqueSpans
  );
  const sourceAfterRate = percent(
    summary.afterSourceAgreements,
    summary.sourceComparableUniqueSpans
  );
  const identityRows = audit.identities
    .map((identity) => {
      const left = identity.bibles[audit.bibles[0]!.applicationVersionId]!;
      const right = identity.bibles[audit.bibles[1]!.applicationVersionId]!;
      return (
        `| ${identity.kind}:${identity.code} | ${identity.selectionStratum} | ` +
        `${left.occurrences} | ${left.changedOccurrences} | ` +
        `${left.dominantBeforePartOfSpeech}→${left.dominantAfterPartOfSpeech} | ` +
        `${right.occurrences} | ${right.changedOccurrences} | ` +
        `${right.dominantBeforePartOfSpeech}→${right.dominantAfterPartOfSpeech} |`
      );
    })
    .join("\n");
  const reviewRows =
    audit.reviewCandidates.length === 0
      ? "- Aucun candidat."
      : [
          "lowercase-name",
          "source-regression",
          "residual-cross-bible-disagreement",
          "new-cross-bible-disagreement"
        ]
          .map((reason) => {
            const candidates = audit.reviewCandidates
              .filter((candidate) => candidate.reason === reason)
              .slice(0, 10);
            if (candidates.length === 0) return "";
            return `### ${reason}\n\n${candidates
              .map(
                (candidate) =>
                  `- ${candidate.bibleId} ${candidate.ref} ` +
                  `(${candidate.identityKeys.join(", ")}), \`${escapeInline(candidate.surface)}\`, ` +
                  `${candidate.transition}, source=${candidate.sourcePartOfSpeech ?? "n/a"} — ` +
                  `${candidate.context}`
              )
              .join("\n")}`;
          })
          .filter(Boolean)
          .join("\n\n");
  const canaryRows = audit.bibles
    .map(
      (bible) =>
        `| ${bible.applicationVersionId} | ${Object.entries(
          bible.releaseCanaries
        )
          .map(([key, value]) => `${key}=${value}`)
          .join(", ")} |`
    )
    .join("\n");
  return `# Audit de 100 identités Strong — KJV / ASV

Date de génération : ${audit.generatedAt}

## Conclusion

Statut mécanique : **${summary.mechanicalStatus}**.

Statut sémantique : **${summary.semanticStatus}**.

L'audit existant du release v10 est exhaustif sur les lignes corrigées. Ce
nouvel audit complète ce journal avec un échantillon reproductible de
${summary.sampledIdentityCount} identités Strong partagées par les deux Bibles,
y compris des occurrences restées inchangées.

- ${summary.sampledIdentityOccurrences.toLocaleString("fr-FR")} occurrences
  identité–mot, correspondant à
  ${summary.sampledUniqueSpans.toLocaleString("fr-FR")} spans uniques.
- ${summary.changedUniqueSpans.toLocaleString("fr-FR")} spans corrigés dans
  l'échantillon.
- ${summary.indeterminateSampledPos} POS vide ou indéterminé.
- ${summary.missingBeforeCoordinates} coordonnée source manquante.
- ${summary.lowercaseNameCorrections.toLocaleString("fr-FR")} corrections vers
  \`name\` sans forme du lemme commençant par une majuscule dans le span
  (${Object.entries(summary.lowercaseNameCorrectionsByMethod)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}).
- Principaux lemmes concernés : ${Object.entries(
    summary.lowercaseNameCorrectionsByLemma
  )
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}.
- ${summary.lowercaseNameFinalOccurrences.toLocaleString("fr-FR")} occurrence
  finale \`name\` sans forme capitalisée du lemme
  (${Object.entries(summary.lowercaseNameFinalOccurrencesByLemma)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}).
- Accord diagnostique avec la morphologie STEP :
  ${sourceBeforeRate} avant, ${sourceAfterRate} après
  (${summary.sourceAgreementImprovements} améliorations,
  ${summary.sourceAgreementRegressions} régressions à revoir).
- Désaccords dominants KJV/ASV sur les couples identité+lemme partagés :
  ${summary.beforeCrossBibleDisagreements} avant,
  ${summary.afterCrossBibleDisagreements} après
  (${summary.resolvedCrossBibleDisagreements} résolus,
  ${summary.newCrossBibleDisagreements} nouveaux).

La morphologie de la langue source est un témoin diagnostique, pas une vérité
obligatoire pour le POS anglais : une traduction peut changer de catégorie
grammaticale. Les « régressions » ci-dessus sont donc une file de revue, pas
une preuve automatique d'erreur.

## Canaris du release complet

| Bible | Valeurs |
|---|---|
${canaryRows}

## Méthode d'échantillonnage

- Seed : \`${audit.seed}\`
- Identités éligibles présentes au moins
  ${audit.selection.minimumOccurrencesPerBible} fois dans chaque Bible :
  ${audit.selection.sharedEligibleIdentityCount.toLocaleString("fr-FR")}
- Strates : ${Object.entries(audit.selection.strata)
    .map(([key, value]) => `${key}=${value}`)
    .join(", ")}
- Les canaris partagés ciblent H430G/God, David, Moses et Christ. H3068 n'est
  plus une identité lexicale partagée après l'assainissement ASV ; Jehovah
  reste contrôlé par le canari global du release.
- Le reste combine identités très corrigées, très fréquentes, puis couverture
  hébraïque et grecque déterministe.

## Résultats par identité

Le préfixe numérique est le type d'identité :
\`0=Strong classique\`, \`1=eStrong\`, \`2=dStrong\`.

| Identité | Strate | KJV occ. | KJV changées | KJV POS dominant | ASV occ. | ASV changées | ASV POS dominant |
|---|---|---:|---:|---|---:|---:|---|
${identityRows}

## Candidats de revue

${reviewRows}

## Reproduction

\`\`\`sh
npm run strong:english:lexemes:audit
\`\`\`

La commande refuse d'écraser un audit existant. Pour une nouvelle génération,
il faut fournir un nouveau \`--output-dir\`, afin de préserver le caractère
additif des artefacts.
`;
}

function identityKey(kind: IdentityKind, code: string): string {
  return `${kind}:${normalizeIdentity(code)}`;
}

function normalizeSerializedIdentity(value: string): string {
  const separator = value.indexOf(":");
  if (separator < 1) return value;
  const kind = Number.parseInt(value.slice(0, separator), 10);
  if (kind < 0 || kind > 2) return value;
  return identityKey(kind as IdentityKind, value.slice(separator + 1));
}

function normalizeIdentity(value: string): string {
  return value
    .trim()
    .toUpperCase()
    .replace(/^([GH])0+(?=\d)/u, "$1");
}

function normalizeLemma(value: string): string {
  return value.trim().toLocaleLowerCase("en").normalize("NFC");
}

function hasCapitalizedLemmaToken(surface: string, lemma: string): boolean {
  const normalizedLemma = normalizeLemma(lemma).replace(/[’']s$/u, "");
  if (
    /\p{Lu}[\p{L}\p{M}]*(?:[-‑–—]\p{L}[\p{L}\p{M}]*)+/u.test(
      surface.normalize("NFC")
    )
  ) {
    return true;
  }
  const candidates = new Set([
    normalizedLemma,
    `${normalizedLemma}s`,
    `${normalizedLemma}es`,
    normalizedLemma.endsWith("y")
      ? `${normalizedLemma.slice(0, -1)}ies`
      : normalizedLemma
  ]);
  const tokens =
    surface.match(/\p{L}[\p{L}\p{M}]*(?:[’']\p{L}[\p{L}\p{M}]*)*/gu) ?? [];
  if (
    normalizedLemma.length === 1 &&
    tokens.some((token) => /^\p{Lu}/u.test(token.normalize("NFC")))
  ) {
    return true;
  }
  return tokens.some((token) => {
    const normalizedToken = normalizeLemma(token).replace(/[’']s$/u, "");
    return (
      candidates.has(normalizedToken) && /^\p{Lu}/u.test(token.normalize("NFC"))
    );
  });
}

function totalOccurrences(candidate: IdentityCandidate): number {
  return Object.values(candidate.occurrencesByBible).reduce(
    (sum, count) => sum + count,
    0
  );
}

function deterministicOrder(
  candidates: IdentityCandidate[],
  seed: string
): IdentityCandidate[] {
  return [...candidates].sort((left, right) => {
    const leftHash = createHash("sha256")
      .update(seed)
      .update("\u0000")
      .update(left.key)
      .digest("hex");
    const rightHash = createHash("sha256")
      .update(seed)
      .update("\u0000")
      .update(right.key)
      .digest("hex");
    return (
      leftHash.localeCompare(rightHash) || left.key.localeCompare(right.key)
    );
  });
}

function coordinateKey(
  bibleId: string,
  value: {
    bookOrder: number;
    chapter: number;
    verse: number;
    ordinal: number;
  }
): string {
  const coordinate = `${value.bookOrder}:${value.chapter}:${value.verse}:${value.ordinal}`;
  return bibleId ? `${bibleId}\u0000${coordinate}` : coordinate;
}

function contextSlice(
  verseText: string,
  startOffset: number,
  length: number
): string {
  const start = Math.max(0, startOffset - 36);
  const end = Math.min(verseText.length, startOffset + length + 36);
  return `${start > 0 ? "…" : ""}${verseText
    .slice(start, end)
    .replace(/\s+/gu, " ")
    .trim()}${end < verseText.length ? "…" : ""}`;
}

function formatReference(value: {
  bookOrder: number;
  chapter: number;
  verse: number;
}): string {
  return `${BOOK_IDS[value.bookOrder - 1] ?? `Book${value.bookOrder}`}.${
    value.chapter
  }.${value.verse}`;
}

function dominantCount(counts: Record<string, number>): string {
  return (
    Object.entries(counts).sort(
      ([leftKey, leftCount], [rightKey, rightCount]) =>
        rightCount - leftCount || leftKey.localeCompare(rightKey)
    )[0]?.[0] ?? "(none)"
  );
}

function percent(numerator: number, denominator: number): string {
  return denominator === 0
    ? "n/a"
    : `${((numerator / denominator) * 100).toFixed(2)} %`;
}

function escapeInline(value: string): string {
  return value.replaceAll("`", "'");
}

function increment(map: Map<string, number>, key: string): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

function countBy<T>(
  values: T[],
  keyForValue: (value: T) => string
): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) {
    const key = keyForValue(value);
    result[key] = (result[key] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(result).sort(([left], [right]) => left.localeCompare(right))
  );
}

function topCounts(
  counts: Record<string, number>,
  limit: number
): Record<string, number> {
  return Object.fromEntries(
    Object.entries(counts)
      .sort(
        ([leftKey, leftCount], [rightKey, rightCount]) =>
          rightCount - leftCount || leftKey.localeCompare(rightKey)
      )
      .slice(0, limit)
  );
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

async function readZipJson<T>(archivePath: string, entry: string): Promise<T> {
  const { stdout } = await execFileAsync("unzip", ["-p", archivePath, entry], {
    maxBuffer: 64 * 1024 * 1024
  });
  return JSON.parse(stdout) as T;
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

function readArg(args: string[], name: string): string | undefined {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] : undefined;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const bibleIds = readArg(args, "--bibles")
    ?.split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const sampleSizeValue = readArg(args, "--sample-size");
  const minimumOccurrencesValue = readArg(
    args,
    "--minimum-occurrences-per-bible"
  );
  const result = await auditEnglishStrongLexemeSample({
    beforeRelease: readArg(args, "--before-release"),
    afterRelease: readArg(args, "--after-release"),
    outputDir: readArg(args, "--output-dir"),
    bibleIds,
    sampleSize: sampleSizeValue
      ? Number.parseInt(sampleSizeValue, 10)
      : undefined,
    minimumOccurrencesPerBible: minimumOccurrencesValue
      ? Number.parseInt(minimumOccurrencesValue, 10)
      : undefined,
    seed: readArg(args, "--seed"),
    generatedAt: readArg(args, "--generated-at"),
    stepRuntimePath: readArg(args, "--step-runtime"),
    sampleFrom: readArg(args, "--sample-from")
  });
  process.stdout.write(
    `${JSON.stringify(
      {
        outputDir: result.outputDir,
        reportPath: result.reportPath,
        auditPath: result.auditPath,
        summary: result.audit.summary
      },
      null,
      2
    )}\n`
  );
}

const entryPath = process.argv[1] ? path.resolve(process.argv[1]) : "";
if (entryPath === fileURLToPath(import.meta.url)) await main();
