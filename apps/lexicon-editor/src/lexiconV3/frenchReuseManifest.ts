import { createHash } from "node:crypto";
import {
  createReadStream,
  mkdirSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { HEBREW_GLOSS_RESIDUAL_AUDIT } from "./hebrewGlossResidualAudit.js";
import {
  HEBREW_IDENTITY_CORRECTIONS,
  HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
} from "./hebrewIdentityCorrections.js";
import { HEBREW_MEANING_RESIDUAL_AUDIT } from "./hebrewMeaningResidualAudit.js";
import { parseTbeshMeaning } from "./tbeshMeaning.js";
import { stripLexiconHtml } from "./frenchValidation.js";
import { lexiconV3FieldContentHash } from "./review.js";

export const FRENCH_REUSE_RECORD_SCHEMA_VERSION =
  "lexicon-v3-french-reuse-record@1" as const;
export const FRENCH_REUSE_MANIFEST_SCHEMA_VERSION =
  "lexicon-v3-french-reuse-manifest@1" as const;
export const FRENCH_REUSE_POLICY_VERSION =
  "lexicon-v3-french-reuse-policy@2" as const;

/**
 * Historical EN .1 regression fixture. Production builds do not apply this
 * release-specific snapshot implicitly: they replay the promoted release and
 * seal its exact lineage into the generated manifest.
 */
export const FRENCH_REUSE_HISTORICAL_EN_1_BASELINE = {
  releaseKey: "lexicon-v3-en-2026-07-13.1",
  releaseSnapshotFingerprint:
    "7d643c0a9fa72fe7258071b23e363c651d0162517078f2d0901408cb599d8c17",
  legacyFullDigest:
    "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
  expectedEntryCount: 22_717,
  expectedEnglishFieldCount: 45_434,
  meaningCohorts: {
    unchanged: 17_406,
    step_specific_only: 3_269,
    other_changed: 2_042
  },
  glossReviewSeedCount: 216,
  meaningReviewSeedCount: 208,
  stepSpecificFrenchPrefixDivergenceCount: 2_577,
  stepSpecificFrenchTextUnavailableCount: 692,
  residualMeaningCohorts: {
    unchanged: 132,
    step_specific_only: 18,
    other_changed: 58
  },
  otherChangedSelections: {
    exact_companion: 1_973,
    editorial_reconstruction: 43,
    "greek-editorial": 15,
    "greek-reconstruction": 9,
    legacy_general_only: 1,
    "step-technical-marker": 1
  }
} as const;

export type FrenchReuseMeaningCohort =
  | "unchanged"
  | "step_specific_only"
  | "other_changed";

export interface FrenchReuseExpectation {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  legacyFullDigest: string;
  expectedEntryCount: number;
  expectedEnglishFieldCount: number;
  meaningCohorts: Record<FrenchReuseMeaningCohort, number>;
  glossReviewSeedCount: number;
  meaningReviewSeedCount: number;
  stepSpecificFrenchPrefixDivergenceCount: number;
  stepSpecificFrenchTextUnavailableCount: number;
  residualMeaningCohorts: Record<FrenchReuseMeaningCohort, number>;
  otherChangedSelections: Record<string, number>;
}

export interface FrenchReuseSourceDigests {
  authoring: string;
  legacyFull: string;
}

export interface FrenchReuseParentField {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  entryKey: string;
  field: "gloss" | "meaning";
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
  state: "auto_validated" | "human_validated";
  method: string;
  generator: string;
}

export interface FrenchReuseSourceAssertionProof {
  sourceKey: string;
  locator: string;
  assertionHash: string;
  stance: "supports" | "contradicts" | "context";
  valueHtml: string | null;
}

export interface FrenchReusePublicationActionProof {
  action: string;
  rawHtmlDigest: string | null;
  stepSpecificDigest: string | null;
}

export type FrenchReuseCohortProof =
  | {
      kind: "byte_identity";
      currentHtmlDigest: string;
      previousHtmlDigest: string;
    }
  | {
      kind: "tbesh_step_specific";
      publicationAction: "step_specific_only";
      separatorCount: 1;
      rawHtmlDigest: string;
      extractedSpecificHash: string;
      rawAssertionHash: string;
      specificAssertionHash: string;
    }
  | {
      kind: "changed_selection";
      publicationAction: string | null;
      currentHtmlDigest: string;
      previousHtmlDigest: string;
    };

export interface ClassifyFrenchReuseMeaningInput {
  stepEntryId: number;
  currentHtml: string;
  previousHtml: string;
  publicationProofs: readonly FrenchReusePublicationActionProof[];
  assertions: readonly FrenchReuseSourceAssertionProof[];
}

export interface ClassifyFrenchReuseMeaningResult {
  cohort: FrenchReuseMeaningCohort;
  proof: FrenchReuseCohortProof;
  publicationAction: string | null;
}

export interface FrenchReuseRecord {
  schemaVersion: typeof FRENCH_REUSE_RECORD_SCHEMA_VERSION;
  entryKey: string;
  stepEntryId: number;
  identity: {
    language: "greek" | "hebrew";
    eStrong: string;
    primaryDStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  identityHash: string;
  parents: {
    gloss: FrenchReuseParentField;
    meaning: FrenchReuseParentField;
  };
  priorEnglish: {
    glossHash: string;
    meaningHtmlHash: string;
  };
  priorFrench: {
    glossHash: string;
    meaningTextHash: string;
    meaningHtmlHash: string;
    specificTextHash: string | null;
    specificHtmlHash: string | null;
    specificVisibleTextHtmlMatch: boolean | null;
  };
  meaningCohort: FrenchReuseMeaningCohort;
  cohortProof: FrenchReuseCohortProof;
  publicationAction: string | null;
  glossReviewSeed: boolean;
  meaningReviewSeed: boolean;
  glossRiskFlags: string[];
  highRiskFlags: string[];
  recordDigest: string;
}

export interface FrenchReuseManifestSummary {
  schemaVersion: typeof FRENCH_REUSE_MANIFEST_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_REUSE_POLICY_VERSION;
  generatedAt: string;
  sourcePaths: {
    authoring: string;
    legacyFull: string;
    records: string | null;
  };
  sourceDigests: FrenchReuseSourceDigests;
  englishRelease: {
    releaseKey: string;
    releaseId: number;
    state: "promoted";
    snapshotFingerprint: string;
    sourceFingerprint: string;
    sourceLogicalFingerprint: string;
    codeFingerprint: string;
    policyVersion: string;
  };
  counts: {
    entries: number;
    englishFields: number;
    meaningCohorts: Record<FrenchReuseMeaningCohort, number>;
    glossReviewSeed: number;
    meaningReviewSeed: number;
    highRiskEntries: number;
    stepSpecificFrenchPrefixDivergence: number;
    stepSpecificFrenchTextUnavailable: number;
    residualMeaningCohorts: Record<FrenchReuseMeaningCohort, number>;
    otherChangedSelections: Record<string, number>;
    glossRiskFlags: Record<string, number>;
    highRiskFlags: Record<string, number>;
  };
  registryDigests: {
    hebrewGlossResidual: string;
    hebrewMeaningResidual: string;
    hebrewIdentityCorrections: string;
  };
  recordsLogicalDigest: string;
  recordsOutputDigest: string;
  manifestDigest: string;
}

export interface BuildFrenchReuseManifestOptions {
  authoringDatabase: string;
  legacyFullDatabase: string;
  releaseKey?: string;
  generatedAt?: string;
  recordsPath?: string | null;
  expectations?: FrenchReuseExpectation | null;
}

export interface FrenchReuseManifestBuild {
  records: FrenchReuseRecord[];
  summary: FrenchReuseManifestSummary;
}

interface ReleaseRow {
  id: number;
  releaseKey: string;
  state: string;
  expectedEntryCount: number;
  sourceFingerprint: string;
  codeFingerprint: string;
  policyVersion: string;
  manifestJson: string;
}

interface ReleaseManifest {
  releaseProfile?: string;
  snapshotFingerprint?: string;
  sourceLogicalFingerprint?: string;
  sourceFingerprint?: string;
  codeFingerprint?: string;
  policyVersion?: string;
  fieldCount?: number;
}

interface ReleasedFieldRow {
  entryKey: string;
  stepEntryId: number;
  language: "greek" | "hebrew";
  eStrong: string;
  primaryDStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  field: "gloss" | "meaning";
  fieldVersionId: number;
  valueText: string;
  valueHtml: string | null;
  state: "auto_validated" | "human_validated";
  method: string;
  generator: string;
  contentHash: string;
}

interface PreviousEnglishRow {
  id: number;
  gloss: string;
  meaning: string;
}

interface PreviousFrenchRow {
  stepEntryId: number;
  gloss: string;
  meaning: string;
  meaningHtml: string;
}

const SHA256_PATTERN = /^[0-9a-f]{64}$/u;
const UNCERTAINTY_PATTERN =
  /\b(?:perhaps|possibly|possible|probably|probable|apparently|likely|unlikely|uncertain|uncertainty|conjectur(?:al|ally)|doubtful|dubious|may be|might be)\b/iu;
const STRONG_PATTERN = /\b[GH]\d{3,5}[A-Za-z]?(?:_[A-Za-z])?\b/u;
const ORIGINAL_SCRIPT_PATTERN =
  /[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{Mark}]*/u;
const REFERENCE_PATTERN = /\b[1-3]?[A-Za-z]{2,}\.?\s*\d+[.:]\d+\b/u;

/**
 * Classify a current promoted English meaning against its historical source.
 * Byte identity is deliberately evaluated before the STEP-specific branch.
 */
export function classifyFrenchReuseMeaning(
  input: ClassifyFrenchReuseMeaningInput
): ClassifyFrenchReuseMeaningResult {
  const publicationActions = uniqueSorted(
    input.publicationProofs.map((proof) => proof.action).filter(Boolean)
  );
  if (publicationActions.length > 1) {
    throw new Error(
      `french-reuse-publication-action-ambiguous:${publicationActions.join(",")}`
    );
  }
  const publicationAction = publicationActions[0] ?? null;
  if (input.currentHtml === input.previousHtml) {
    const digest = sha256(input.currentHtml);
    return {
      cohort: "unchanged",
      publicationAction,
      proof: {
        kind: "byte_identity",
        currentHtmlDigest: digest,
        previousHtmlDigest: digest
      }
    };
  }

  if (publicationAction !== "step_specific_only") {
    return {
      cohort: "other_changed",
      publicationAction,
      proof: {
        kind: "changed_selection",
        publicationAction,
        currentHtmlDigest: sha256(input.currentHtml),
        previousHtmlDigest: sha256(input.previousHtml)
      }
    };
  }

  const sections = parseTbeshMeaning(input.previousHtml);
  if (
    !sections.hasSectionSeparator ||
    sections.sectionSeparatorCount !== 1 ||
    !stripLexiconHtml(sections.stepSpecificHtml).trim()
  ) {
    throw new Error("french-reuse-step-specific-source-structure-invalid");
  }
  if (sections.stepSpecificHtml !== input.currentHtml) {
    throw new Error("french-reuse-step-specific-content-mismatch");
  }

  const rawLocator = `StepEntries:${input.stepEntryId}:meaning`;
  const specificLocator = `${rawLocator}:step-specific`;
  const rawAssertions = input.assertions.filter(
    (assertion) =>
      assertion.sourceKey === "step-tbesh-meaning" &&
      assertion.locator === rawLocator &&
      assertion.valueHtml === input.previousHtml
  );
  const specificAssertions = input.assertions.filter(
    (assertion) =>
      assertion.sourceKey === "step-tbesh-meaning" &&
      assertion.locator === specificLocator &&
      assertion.stance === "supports" &&
      assertion.valueHtml === input.currentHtml
  );
  if (rawAssertions.length !== 1) {
    throw new Error(
      `french-reuse-step-specific-raw-assertion-count:${rawAssertions.length}`
    );
  }
  if (specificAssertions.length !== 1) {
    throw new Error(
      `french-reuse-step-specific-support-count:${specificAssertions.length}`
    );
  }
  for (const assertion of [...rawAssertions, ...specificAssertions]) {
    if (!SHA256_PATTERN.test(assertion.assertionHash)) {
      throw new Error("french-reuse-step-specific-assertion-hash-invalid");
    }
  }

  const rawDigest = sha256(input.previousHtml);
  const specificDigest = sha256(input.currentHtml);
  const proofRawDigests = uniqueSorted(
    input.publicationProofs
      .map((proof) => proof.rawHtmlDigest)
      .filter((value): value is string => Boolean(value))
  );
  const proofSpecificDigests = uniqueSorted(
    input.publicationProofs
      .map((proof) => proof.stepSpecificDigest)
      .filter((value): value is string => Boolean(value))
  );
  if (
    proofRawDigests.length !== 1 ||
    proofRawDigests[0] !== rawDigest ||
    proofSpecificDigests.length !== 1 ||
    proofSpecificDigests[0] !== specificDigest
  ) {
    throw new Error("french-reuse-step-specific-policy-digest-mismatch");
  }

  return {
    cohort: "step_specific_only",
    publicationAction,
    proof: {
      kind: "tbesh_step_specific",
      publicationAction: "step_specific_only",
      separatorCount: 1,
      rawHtmlDigest: rawDigest,
      extractedSpecificHash: specificDigest,
      rawAssertionHash: rawAssertions[0]!.assertionHash,
      specificAssertionHash: specificAssertions[0]!.assertionHash
    }
  };
}

export async function buildFrenchReuseManifest(
  options: BuildFrenchReuseManifestOptions
): Promise<FrenchReuseManifestBuild> {
  const authoringPath = resolve(options.authoringDatabase);
  const legacyFullPath = resolve(options.legacyFullDatabase);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const expectations =
    options.expectations === undefined ? null : options.expectations;
  const [authoringDigest, legacyFullDigest] = await Promise.all([
    sha256File(authoringPath),
    sha256File(legacyFullPath)
  ]);
  const sourceDigests = {
    authoring: authoringDigest,
    legacyFull: legacyFullDigest
  };
  if (expectations && legacyFullDigest !== expectations.legacyFullDigest) {
    throw new Error("french-reuse-legacy-full-digest-mismatch");
  }

  const authoring = new DatabaseSync(authoringPath, { readOnly: true });
  const legacy = new DatabaseSync(legacyFullPath, { readOnly: true });
  try {
    const release = readPromotedRelease(authoring, options.releaseKey);
    const releaseManifest = parseReleaseManifest(release);
    const fields = readReleasedEnglishFields(authoring, release.id);
    const fieldsByEntry = groupReleasedFields(fields);
    const previousEnglish = readPreviousEnglish(legacy);
    const previousFrench = readPreviousFrench(legacy);
    const publicationProofs = readPublicationProofs(authoring);
    const assertions = readTbeshAssertionProofs(authoring);
    const records: FrenchReuseRecord[] = [];

    for (const [entryKey, entryFields] of fieldsByEntry) {
      const gloss = requiredField(entryFields, "gloss", entryKey);
      const meaning = requiredField(entryFields, "meaning", entryKey);
      assertSameReleasedIdentity(gloss, meaning);
      const previous = previousEnglish.get(gloss.stepEntryId);
      const french = previousFrench.get(gloss.stepEntryId);
      if (!previous) {
        throw new Error(`french-reuse-previous-english-missing:${entryKey}`);
      }
      if (!french) {
        throw new Error(`french-reuse-previous-french-missing:${entryKey}`);
      }
      if (
        !french.gloss.trim() ||
        !french.meaning.trim() ||
        !french.meaningHtml.trim()
      ) {
        throw new Error(`french-reuse-previous-french-empty:${entryKey}`);
      }

      const classification = classifyFrenchReuseMeaning({
        stepEntryId: gloss.stepEntryId,
        currentHtml: requiredMeaningHtml(meaning),
        previousHtml: previous.meaning,
        publicationProofs: publicationProofs.get(meaning.fieldVersionId) ?? [],
        assertions: assertions.get(meaning.fieldVersionId) ?? []
      });
      const identity = {
        language: gloss.language,
        eStrong: gloss.eStrong,
        primaryDStrong: gloss.primaryDStrong,
        dStrong: gloss.dStrong,
        uStrong: gloss.uStrong,
        original: gloss.original,
        transliteration: gloss.transliteration,
        morph: gloss.morph
      };
      const glossRiskFlags = classifyGlossRisk({
        entryKey,
        currentGloss: gloss.valueText,
        previousEnglishGloss: previous.gloss,
        previousFrenchGloss: french.gloss,
        morph: gloss.morph
      });
      const glossReviewSeed = glossRiskFlags.some((flag) =>
        [
          "english-gloss-changed",
          "sealed-hebrew-gloss-residual",
          "hebrew-identity-correction"
        ].includes(flag)
      );
      const meaningReviewSeed = MEANING_RESIDUAL_KEYS.has(entryKey);
      const priorFrenchSpecific =
        classification.cohort === "step_specific_only"
          ? frenchSpecificEvidence(french, entryKey)
          : {
              specificTextHash: null,
              specificHtmlHash: null,
              specificVisibleTextHtmlMatch: null
            };
      const highRiskFlags = classifyHighRisk({
        entryKey,
        meaning,
        identity,
        cohort: classification.cohort,
        publicationAction: classification.publicationAction,
        glossRiskFlags,
        specificVisibleTextHtmlMatch:
          priorFrenchSpecific.specificVisibleTextHtmlMatch
      });
      const content = {
        schemaVersion: FRENCH_REUSE_RECORD_SCHEMA_VERSION,
        entryKey,
        stepEntryId: gloss.stepEntryId,
        identity,
        identityHash: sha256(canonicalJson(identity)),
        parents: {
          gloss: parentField(gloss, release, releaseManifest),
          meaning: parentField(meaning, release, releaseManifest)
        },
        priorEnglish: {
          glossHash: sha256(previous.gloss),
          meaningHtmlHash: sha256(previous.meaning)
        },
        priorFrench: {
          glossHash: sha256(french.gloss),
          meaningTextHash: sha256(french.meaning),
          meaningHtmlHash: sha256(french.meaningHtml),
          ...priorFrenchSpecific
        },
        meaningCohort: classification.cohort,
        cohortProof: classification.proof,
        publicationAction: classification.publicationAction,
        glossReviewSeed,
        meaningReviewSeed,
        glossRiskFlags,
        highRiskFlags
      };
      records.push({
        ...content,
        recordDigest: sha256(canonicalJson(content))
      });
    }
    records.sort((left, right) => left.entryKey.localeCompare(right.entryKey));

    const recordsText = renderFrenchReuseRecords(records);
    const counts = buildCounts(records);
    const summaryWithoutDigest = {
      schemaVersion: FRENCH_REUSE_MANIFEST_SCHEMA_VERSION,
      policyVersion: FRENCH_REUSE_POLICY_VERSION,
      generatedAt,
      sourcePaths: {
        authoring: authoringPath,
        legacyFull: legacyFullPath,
        records: options.recordsPath ? resolve(options.recordsPath) : null
      },
      sourceDigests,
      englishRelease: {
        releaseKey: release.releaseKey,
        releaseId: release.id,
        state: "promoted" as const,
        snapshotFingerprint: releaseManifest.snapshotFingerprint!,
        sourceFingerprint: release.sourceFingerprint,
        sourceLogicalFingerprint: releaseManifest.sourceLogicalFingerprint!,
        codeFingerprint: release.codeFingerprint,
        policyVersion: release.policyVersion
      },
      counts,
      registryDigests: {
        hebrewGlossResidual: HEBREW_GLOSS_RESIDUAL_AUDIT.registryDigest,
        hebrewMeaningResidual: HEBREW_MEANING_RESIDUAL_AUDIT.registryDigest,
        hebrewIdentityCorrections: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
      },
      recordsLogicalDigest: sha256(
        canonicalJson(
          records.map((record) => ({
            entryKey: record.entryKey,
            recordDigest: record.recordDigest
          }))
        )
      ),
      recordsOutputDigest: sha256(recordsText)
    };
    const summary: FrenchReuseManifestSummary = {
      ...summaryWithoutDigest,
      manifestDigest: sha256(
        canonicalJson(summaryLogicalProjection(summaryWithoutDigest))
      )
    };
    const build = { records, summary };
    assertFrenchReuseManifest(build, expectations);
    return build;
  } finally {
    authoring.close();
    legacy.close();
  }
}

export function assertFrenchReuseManifest(
  build: FrenchReuseManifestBuild,
  expectations: FrenchReuseExpectation | null = null
): void {
  const { records, summary } = build;
  if (summary.schemaVersion !== FRENCH_REUSE_MANIFEST_SCHEMA_VERSION) {
    throw new Error("french-reuse-summary-schema-invalid");
  }
  if (summary.policyVersion !== FRENCH_REUSE_POLICY_VERSION) {
    throw new Error("french-reuse-policy-version-invalid");
  }
  const seen = new Set<string>();
  let previousKey = "";
  for (const record of records) {
    if (record.schemaVersion !== FRENCH_REUSE_RECORD_SCHEMA_VERSION) {
      throw new Error(`french-reuse-record-schema-invalid:${record.entryKey}`);
    }
    if (seen.has(record.entryKey)) {
      throw new Error(`french-reuse-record-duplicate:${record.entryKey}`);
    }
    if (previousKey && previousKey.localeCompare(record.entryKey) >= 0) {
      throw new Error("french-reuse-record-order-invalid");
    }
    seen.add(record.entryKey);
    previousKey = record.entryKey;
    const { recordDigest, ...content } = record;
    if (sha256(canonicalJson(content)) !== recordDigest) {
      throw new Error(`french-reuse-record-digest-invalid:${record.entryKey}`);
    }
    for (const parent of [record.parents.gloss, record.parents.meaning]) {
      if (
        parent.releaseKey !== summary.englishRelease.releaseKey ||
        parent.releaseSnapshotFingerprint !==
          summary.englishRelease.snapshotFingerprint ||
        parent.entryKey !== record.entryKey ||
        !SHA256_PATTERN.test(parent.contentHash) ||
        !SHA256_PATTERN.test(parent.valueTextHash) ||
        (parent.valueHtmlHash !== null &&
          !SHA256_PATTERN.test(parent.valueHtmlHash))
      ) {
        throw new Error(`french-reuse-parent-invalid:${record.entryKey}`);
      }
    }
  }
  const recomputedCounts = buildCounts(records);
  if (canonicalJson(recomputedCounts) !== canonicalJson(summary.counts)) {
    throw new Error("french-reuse-summary-counts-invalid");
  }
  const recordsText = renderFrenchReuseRecords(records);
  if (sha256(recordsText) !== summary.recordsOutputDigest) {
    throw new Error("french-reuse-output-digest-invalid");
  }
  const logicalDigest = sha256(
    canonicalJson(
      records.map((record) => ({
        entryKey: record.entryKey,
        recordDigest: record.recordDigest
      }))
    )
  );
  if (logicalDigest !== summary.recordsLogicalDigest) {
    throw new Error("french-reuse-records-logical-digest-invalid");
  }
  const { manifestDigest, ...summaryWithoutDigest } = summary;
  if (
    sha256(canonicalJson(summaryLogicalProjection(summaryWithoutDigest))) !==
    manifestDigest
  ) {
    throw new Error("french-reuse-manifest-digest-invalid");
  }
  if (expectations) assertExpectedBaseline(summary, expectations);
}

export async function runFrenchReuseManifest(options: {
  authoringDatabase: string;
  legacyFullDatabase: string;
  releaseKey?: string;
  recordsOutput: string;
  summaryOutput: string;
  generatedAt?: string;
  expectations?: FrenchReuseExpectation | null;
}): Promise<FrenchReuseManifestBuild> {
  const build = await buildFrenchReuseManifest({
    authoringDatabase: options.authoringDatabase,
    legacyFullDatabase: options.legacyFullDatabase,
    releaseKey: options.releaseKey,
    generatedAt: options.generatedAt,
    recordsPath: options.recordsOutput,
    expectations: options.expectations
  });
  const recordsText = renderFrenchReuseRecords(build.records);
  writeAtomic(options.recordsOutput, recordsText);
  if (
    (await sha256File(options.recordsOutput)) !==
    build.summary.recordsOutputDigest
  ) {
    throw new Error("french-reuse-written-records-digest-mismatch");
  }
  writeAtomic(options.summaryOutput, renderFrenchReuseSummary(build.summary));
  return build;
}

export function renderFrenchReuseRecords(
  records: readonly FrenchReuseRecord[]
): string {
  return `${records.map((record) => canonicalJson(record)).join("\n")}\n`;
}

export function renderFrenchReuseSummary(
  summary: FrenchReuseManifestSummary
): string {
  return `${JSON.stringify(summary, null, 2)}\n`;
}

export function canonicalFrenchReuseJson(value: unknown): string {
  return canonicalJson(value);
}

function readPromotedRelease(
  db: DatabaseSync,
  requestedReleaseKey?: string
): ReleaseRow {
  const releaseKey = requestedReleaseKey?.trim();
  const row = (
    releaseKey
      ? db
          .prepare(
            `SELECT id, releaseKey, state, expectedEntryCount, sourceFingerprint,
                  codeFingerprint, policyVersion, manifestJson
           FROM LexiconReleases WHERE releaseKey = ?`
          )
          .get(releaseKey)
      : db
          .prepare(
            `SELECT id, releaseKey, state, expectedEntryCount, sourceFingerprint,
                  codeFingerprint, policyVersion, manifestJson
           FROM LexiconReleases
           WHERE state = 'promoted'
             AND json_extract(manifestJson, '$.releaseProfile') = 'core-en'
           ORDER BY promotedAt DESC, id DESC
           LIMIT 1`
          )
          .get()
  ) as ReleaseRow | undefined;
  if (!row) {
    throw new Error(
      releaseKey
        ? `french-reuse-release-missing:${releaseKey}`
        : "french-reuse-promoted-release-missing"
    );
  }
  if (row.state !== "promoted") {
    throw new Error(`french-reuse-release-not-promoted:${row.state}`);
  }
  return row;
}

function parseReleaseManifest(release: ReleaseRow): ReleaseManifest {
  let manifest: ReleaseManifest;
  try {
    manifest = JSON.parse(release.manifestJson) as ReleaseManifest;
  } catch {
    throw new Error("french-reuse-release-manifest-json-invalid");
  }
  if (
    manifest.releaseProfile !== "core-en" ||
    !manifest.snapshotFingerprint ||
    !SHA256_PATTERN.test(manifest.snapshotFingerprint) ||
    !manifest.sourceLogicalFingerprint ||
    !SHA256_PATTERN.test(manifest.sourceLogicalFingerprint) ||
    manifest.sourceFingerprint !== release.sourceFingerprint ||
    manifest.codeFingerprint !== release.codeFingerprint ||
    manifest.policyVersion !== release.policyVersion ||
    manifest.fieldCount !== release.expectedEntryCount * 2
  ) {
    throw new Error("french-reuse-release-manifest-invalid");
  }
  return manifest;
}

function readReleasedEnglishFields(
  db: DatabaseSync,
  releaseId: number
): ReleasedFieldRow[] {
  return db
    .prepare(
      `SELECT rf.entryKey, ids.stepEntryId, entry.language, entry.eStrong,
              entry.primaryDStrong, entry.dStrong, entry.uStrong,
              entry.original, entry.transliteration, entry.morph,
              rf.field, rf.fieldVersionId, fv.valueText, fv.valueHtml,
              fv.state, fv.method, fv.generator, fv.contentHash
       FROM LexiconReleaseFields rf
       JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
       JOIN LexiconEntryIds ids ON ids.entryKey = rf.entryKey
       JOIN LexiconEntries entry ON entry.entryKey = rf.entryKey
       WHERE rf.releaseId = ? AND rf.locale = 'en'
         AND rf.field IN ('gloss', 'meaning')
       ORDER BY rf.entryKey, rf.field`
    )
    .all(releaseId) as unknown as ReleasedFieldRow[];
}

function groupReleasedFields(
  fields: readonly ReleasedFieldRow[]
): Map<string, ReleasedFieldRow[]> {
  const result = new Map<string, ReleasedFieldRow[]>();
  for (const field of fields) {
    if (!["auto_validated", "human_validated"].includes(field.state)) {
      throw new Error(`french-reuse-parent-state-invalid:${field.entryKey}`);
    }
    const expectedHash = lexiconV3FieldContentHash({
      entryKey: field.entryKey,
      locale: "en",
      field: field.field,
      valueText: field.valueText,
      valueHtml: field.valueHtml,
      derivedFromVersionId: null
    });
    if (expectedHash !== field.contentHash) {
      throw new Error(
        `french-reuse-parent-content-hash-invalid:${field.entryKey}`
      );
    }
    const rows = result.get(field.entryKey) ?? [];
    rows.push(field);
    result.set(field.entryKey, rows);
  }
  return result;
}

function readPreviousEnglish(
  db: DatabaseSync
): Map<number, PreviousEnglishRow> {
  const rows = db
    .prepare("SELECT id, gloss, meaning FROM StepEntries ORDER BY id")
    .all() as unknown as PreviousEnglishRow[];
  return uniqueMap(rows, (row) => row.id, "previous-english");
}

function readPreviousFrench(db: DatabaseSync): Map<number, PreviousFrenchRow> {
  const rows = db
    .prepare(
      `SELECT stepEntryId, gloss, meaning, meaningHtml
       FROM LexiconTranslations WHERE language = 'fr' ORDER BY stepEntryId`
    )
    .all() as unknown as PreviousFrenchRow[];
  return uniqueMap(rows, (row) => row.stepEntryId, "previous-french");
}

function readPublicationProofs(
  db: DatabaseSync
): Map<number, FrenchReusePublicationActionProof[]> {
  const rows = db
    .prepare(
      `SELECT fieldVersionId,
              json_extract(detailsJson, '$.publicationSelection.action') AS action,
              json_extract(detailsJson, '$.publicationSelection.canonicalPolicyProof.structure.rawHtmlDigest') AS rawHtmlDigest,
              json_extract(detailsJson, '$.publicationSelection.canonicalPolicyProof.structure.stepSpecificDigest') AS stepSpecificDigest
       FROM LexiconFieldEvidence
       WHERE json_extract(detailsJson, '$.publicationSelection.action') IS NOT NULL
       ORDER BY fieldVersionId, id`
    )
    .all() as unknown as Array<
    FrenchReusePublicationActionProof & { fieldVersionId: number }
  >;
  return groupBy(
    rows,
    (row) => row.fieldVersionId,
    (row) => ({
      action: row.action,
      rawHtmlDigest: row.rawHtmlDigest,
      stepSpecificDigest: row.stepSpecificDigest
    })
  );
}

function readTbeshAssertionProofs(
  db: DatabaseSync
): Map<number, FrenchReuseSourceAssertionProof[]> {
  const rows = db
    .prepare(
      `SELECT evidence.fieldVersionId, source.sourceKey, assertion.locator,
              assertion.sha256 AS assertionHash, evidence.stance,
              assertion.valueHtml
       FROM LexiconFieldEvidence evidence
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE source.sourceKey = 'step-tbesh-meaning'
         AND assertion.field = 'meaning'
       ORDER BY evidence.fieldVersionId, assertion.locator, evidence.id`
    )
    .all() as unknown as Array<
    FrenchReuseSourceAssertionProof & { fieldVersionId: number }
  >;
  return groupBy(
    rows,
    (row) => row.fieldVersionId,
    (row) => ({
      sourceKey: row.sourceKey,
      locator: row.locator,
      assertionHash: row.assertionHash,
      stance: row.stance,
      valueHtml: row.valueHtml
    })
  );
}

function requiredField(
  fields: readonly ReleasedFieldRow[],
  field: "gloss" | "meaning",
  entryKey: string
): ReleasedFieldRow {
  const matches = fields.filter((candidate) => candidate.field === field);
  if (matches.length !== 1) {
    throw new Error(
      `french-reuse-parent-field-count:${entryKey}:${field}:${matches.length}`
    );
  }
  return matches[0]!;
}

function assertSameReleasedIdentity(
  gloss: ReleasedFieldRow,
  meaning: ReleasedFieldRow
): void {
  for (const key of [
    "entryKey",
    "stepEntryId",
    "language",
    "eStrong",
    "primaryDStrong",
    "dStrong",
    "uStrong",
    "original",
    "transliteration",
    "morph"
  ] as const) {
    if (gloss[key] !== meaning[key]) {
      throw new Error(
        `french-reuse-parent-identity-drift:${gloss.entryKey}:${key}`
      );
    }
  }
}

function requiredMeaningHtml(field: ReleasedFieldRow): string {
  if (!field.valueHtml?.trim()) {
    throw new Error(
      `french-reuse-parent-meaning-html-missing:${field.entryKey}`
    );
  }
  return field.valueHtml;
}

function parentField(
  field: ReleasedFieldRow,
  release: ReleaseRow,
  manifest: ReleaseManifest
): FrenchReuseParentField {
  return {
    releaseKey: release.releaseKey,
    releaseSnapshotFingerprint: manifest.snapshotFingerprint!,
    entryKey: field.entryKey,
    field: field.field,
    fieldVersionId: field.fieldVersionId,
    contentHash: field.contentHash,
    valueTextHash: sha256(field.valueText),
    valueHtmlHash: field.valueHtml === null ? null : sha256(field.valueHtml),
    state: field.state,
    method: field.method,
    generator: field.generator
  };
}

function frenchSpecificEvidence(
  french: PreviousFrenchRow,
  entryKey: string
): Pick<
  FrenchReuseRecord["priorFrench"],
  "specificTextHash" | "specificHtmlHash" | "specificVisibleTextHtmlMatch"
> {
  const text = parseTbeshMeaning(french.meaning);
  const html = parseTbeshMeaning(french.meaningHtml);
  if (
    !html.hasSectionSeparator ||
    html.sectionSeparatorCount !== 1 ||
    !stripLexiconHtml(html.stepSpecificHtml).trim()
  ) {
    throw new Error(`french-reuse-prior-french-specific-invalid:${entryKey}`);
  }
  if (text.sectionSeparatorCount > 1) {
    throw new Error(
      `french-reuse-prior-french-text-separators-invalid:${entryKey}`
    );
  }
  const textSpecificAvailable =
    text.hasSectionSeparator && text.sectionSeparatorCount === 1;
  return {
    specificTextHash: textSpecificAvailable
      ? sha256(text.stepSpecificHtml)
      : null,
    specificHtmlHash: sha256(html.stepSpecificHtml),
    specificVisibleTextHtmlMatch: textSpecificAvailable
      ? normalizeVisible(text.stepSpecificHtml) ===
        normalizeVisible(stripLexiconHtml(html.stepSpecificHtml))
      : null
  };
}

function classifyGlossRisk(input: {
  entryKey: string;
  currentGloss: string;
  previousEnglishGloss: string;
  previousFrenchGloss: string;
  morph: string;
}): string[] {
  const flags = new Set<string>();
  if (input.currentGloss !== input.previousEnglishGloss) {
    flags.add("english-gloss-changed");
  }
  if (GLOSS_RESIDUAL_KEYS.has(input.entryKey)) {
    flags.add("sealed-hebrew-gloss-residual");
  }
  if (IDENTITY_CORRECTION_KEYS.has(input.entryKey)) {
    flags.add("hebrew-identity-correction");
  }
  const french = input.previousFrenchGloss.trim();
  if (!french) flags.add("legacy-french-gloss-empty");
  if (french.length > 140) flags.add("legacy-french-gloss-too-long");
  if (/[.!?;:]$/u.test(french)) {
    flags.add("legacy-french-gloss-terminal-punctuation");
  }
  const properName = isProperNameMorph(input.morph);
  if (
    !properName &&
    normalizeVisible(french) === normalizeVisible(input.currentGloss)
  ) {
    flags.add("legacy-french-gloss-equals-english-non-name");
  }
  if (/^to\s+/iu.test(input.currentGloss) && /^pour\s+/iu.test(french)) {
    flags.add("legacy-french-verb-not-infinitive");
  }
  if (knownFalseFriend(input.currentGloss, french)) {
    flags.add("legacy-french-known-false-friend");
  }
  return [...flags].sort();
}

function classifyHighRisk(input: {
  entryKey: string;
  meaning: ReleasedFieldRow;
  identity: FrenchReuseRecord["identity"];
  cohort: FrenchReuseMeaningCohort;
  publicationAction: string | null;
  glossRiskFlags: readonly string[];
  specificVisibleTextHtmlMatch: boolean | null;
}): string[] {
  const flags = new Set<string>(input.glossRiskFlags);
  if (input.cohort === "other_changed") flags.add("meaning-other-changed");
  if (input.cohort === "step_specific_only") {
    flags.add("step-specific-prefix-candidate");
  }
  if (input.specificVisibleTextHtmlMatch === false) {
    flags.add("legacy-french-specific-text-html-divergence");
  }
  if (
    input.cohort === "step_specific_only" &&
    input.specificVisibleTextHtmlMatch === null
  ) {
    flags.add("legacy-french-specific-text-unavailable");
  }
  if (MEANING_RESIDUAL_KEYS.has(input.entryKey)) {
    flags.add("sealed-hebrew-meaning-residual");
  }
  if (input.meaning.method === "editorial") {
    flags.add("editorial-english-parent");
  }
  if (input.meaning.valueText.length >= 1_000) {
    flags.add("long-visible-meaning");
  }
  if (UNCERTAINTY_PATTERN.test(input.meaning.valueText)) {
    flags.add("source-uncertainty-marker");
  }
  if (STRONG_PATTERN.test(input.meaning.valueText)) {
    flags.add("protected-strong-code");
  }
  if (ORIGINAL_SCRIPT_PATTERN.test(input.meaning.valueText)) {
    flags.add("protected-original-script");
  }
  if (REFERENCE_PATTERN.test(input.meaning.valueText)) {
    flags.add("protected-bible-reference");
  }
  if (input.identity.primaryDStrong !== input.identity.eStrong) {
    flags.add("suffixed-or-extended-step-identity");
  }
  if (isProperNameMorph(input.identity.morph)) {
    flags.add("proper-name-canonicalization");
  }
  if (input.publicationAction === "legacy_general_only") {
    flags.add("legacy-general-selected");
  }
  return [...flags].sort();
}

function buildCounts(
  records: readonly FrenchReuseRecord[]
): FrenchReuseManifestSummary["counts"] {
  const meaningCohorts = emptyCohortCounts();
  const residualMeaningCohorts = emptyCohortCounts();
  const otherChangedSelections: Record<string, number> = {};
  const glossRiskFlags: Record<string, number> = {};
  const highRiskFlags: Record<string, number> = {};
  let glossReviewSeed = 0;
  let meaningReviewSeed = 0;
  let highRiskEntries = 0;
  let stepSpecificFrenchPrefixDivergence = 0;
  let stepSpecificFrenchTextUnavailable = 0;
  for (const record of records) {
    meaningCohorts[record.meaningCohort] += 1;
    if (record.glossReviewSeed) glossReviewSeed += 1;
    if (record.meaningReviewSeed) {
      meaningReviewSeed += 1;
      residualMeaningCohorts[record.meaningCohort] += 1;
    }
    if (record.highRiskFlags.length > 0) highRiskEntries += 1;
    if (record.priorFrench.specificVisibleTextHtmlMatch === false) {
      stepSpecificFrenchPrefixDivergence += 1;
    }
    if (
      record.meaningCohort === "step_specific_only" &&
      record.priorFrench.specificVisibleTextHtmlMatch === null
    ) {
      stepSpecificFrenchTextUnavailable += 1;
    }
    if (record.meaningCohort === "other_changed") {
      increment(otherChangedSelections, otherChangedSelectionKey(record));
    }
    for (const flag of record.glossRiskFlags) increment(glossRiskFlags, flag);
    for (const flag of record.highRiskFlags) increment(highRiskFlags, flag);
  }
  return {
    entries: records.length,
    englishFields: records.length * 2,
    meaningCohorts,
    glossReviewSeed,
    meaningReviewSeed,
    highRiskEntries,
    stepSpecificFrenchPrefixDivergence,
    stepSpecificFrenchTextUnavailable,
    residualMeaningCohorts,
    otherChangedSelections: sortedRecord(otherChangedSelections),
    glossRiskFlags: sortedRecord(glossRiskFlags),
    highRiskFlags: sortedRecord(highRiskFlags)
  };
}

function otherChangedSelectionKey(record: FrenchReuseRecord): string {
  if (record.publicationAction) return record.publicationAction;
  const parent = record.parents.meaning;
  if (parent.generator === "greek-reconstruction@1") {
    return "greek-reconstruction";
  }
  if (parent.method === "editorial" && record.identity.language === "greek") {
    return "greek-editorial";
  }
  if (parent.generator === "step-technical-marker@1") {
    return "step-technical-marker";
  }
  return "unclassified";
}

function assertExpectedBaseline(
  summary: FrenchReuseManifestSummary,
  expected: FrenchReuseExpectation
): void {
  const mismatches: string[] = [];
  if (summary.englishRelease.releaseKey !== expected.releaseKey) {
    mismatches.push("release-key");
  }
  if (
    summary.englishRelease.snapshotFingerprint !==
    expected.releaseSnapshotFingerprint
  ) {
    mismatches.push("release-snapshot");
  }
  if (summary.sourceDigests.legacyFull !== expected.legacyFullDigest) {
    mismatches.push("legacy-full-digest");
  }
  if (summary.counts.entries !== expected.expectedEntryCount) {
    mismatches.push("entry-count");
  }
  if (summary.counts.englishFields !== expected.expectedEnglishFieldCount) {
    mismatches.push("english-field-count");
  }
  for (const cohort of Object.keys(
    expected.meaningCohorts
  ) as FrenchReuseMeaningCohort[]) {
    if (
      summary.counts.meaningCohorts[cohort] !== expected.meaningCohorts[cohort]
    ) {
      mismatches.push(`meaning-cohort:${cohort}`);
    }
    if (
      summary.counts.residualMeaningCohorts[cohort] !==
      expected.residualMeaningCohorts[cohort]
    ) {
      mismatches.push(`residual-meaning-cohort:${cohort}`);
    }
  }
  if (summary.counts.glossReviewSeed !== expected.glossReviewSeedCount) {
    mismatches.push("gloss-review-seed");
  }
  if (summary.counts.meaningReviewSeed !== expected.meaningReviewSeedCount) {
    mismatches.push("meaning-review-seed");
  }
  if (
    summary.counts.stepSpecificFrenchPrefixDivergence !==
    expected.stepSpecificFrenchPrefixDivergenceCount
  ) {
    mismatches.push("step-specific-french-prefix-divergence");
  }
  if (
    summary.counts.stepSpecificFrenchTextUnavailable !==
    expected.stepSpecificFrenchTextUnavailableCount
  ) {
    mismatches.push("step-specific-french-text-unavailable");
  }
  if (
    canonicalJson(summary.counts.otherChangedSelections) !==
    canonicalJson(expected.otherChangedSelections)
  ) {
    mismatches.push("other-changed-selections");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `french-reuse-current-baseline-mismatch:${mismatches.join(",")}`
    );
  }
}

function summaryLogicalProjection(
  summary: Omit<FrenchReuseManifestSummary, "manifestDigest">
): unknown {
  return {
    schemaVersion: summary.schemaVersion,
    policyVersion: summary.policyVersion,
    sourceDigests: summary.sourceDigests,
    englishRelease: summary.englishRelease,
    counts: summary.counts,
    registryDigests: summary.registryDigests,
    recordsLogicalDigest: summary.recordsLogicalDigest,
    recordsOutputDigest: summary.recordsOutputDigest
  };
}

function emptyCohortCounts(): Record<FrenchReuseMeaningCohort, number> {
  return { unchanged: 0, step_specific_only: 0, other_changed: 0 };
}

function normalizeVisible(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function isProperNameMorph(morph: string): boolean {
  return (
    morph.startsWith("N:") ||
    morph.includes("/ N:") ||
    morph.startsWith("G:N-PRI")
  );
}

function knownFalseFriend(englishGloss: string, frenchGloss: string): boolean {
  const english = englishGloss.trim().toLocaleLowerCase("en");
  const french = frenchGloss.trim().toLocaleLowerCase("fr");
  return (
    (english === "scroll" && /\bd[ée]fil/u.test(french)) ||
    (english === "branch" && /\bsuccursale\b/u.test(french)) ||
    (english === "capital" && french === "capital") ||
    (english === "to jest" && /c['’]est[- ]?[àa][- ]dire/u.test(french)) ||
    (english === "to bring up" && /\babord/u.test(french))
  );
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function sortedRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right))
  );
}

function groupBy<T, K, V = T>(
  values: readonly T[],
  keyFor: (value: T) => K,
  project: (value: T) => V = (value: T) => value as unknown as V
): Map<K, V[]> {
  const result = new Map<K, V[]>();
  for (const value of values) {
    const key = keyFor(value);
    const rows = result.get(key) ?? [];
    rows.push(project(value));
    result.set(key, rows);
  }
  return result;
}

function uniqueMap<T, K>(
  values: readonly T[],
  keyFor: (value: T) => K,
  label: string
): Map<K, T> {
  const result = new Map<K, T>();
  for (const value of values) {
    const key = keyFor(value);
    if (result.has(key)) throw new Error(`french-reuse-${label}-duplicate`);
    result.set(key, value);
  }
  return result;
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value) ?? "null";
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function sha256FrenchReuseFile(path: string): Promise<string> {
  return sha256File(path);
}

function sha256File(path: string): Promise<string> {
  return new Promise((resolveDigest, reject) => {
    const hash = createHash("sha256");
    const input = createReadStream(path);
    input.on("error", reject);
    input.on("data", (chunk) => hash.update(chunk));
    input.on("end", () => resolveDigest(hash.digest("hex")));
  });
}

function writeAtomic(path: string, content: string): void {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  const temporary = `${target}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  try {
    writeFileSync(temporary, content, "utf8");
    renameSync(temporary, target);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

const GLOSS_RESIDUAL_KEYS = new Set(
  HEBREW_GLOSS_RESIDUAL_AUDIT.records.map((record) => `hebrew:${record.key}`)
);
const MEANING_RESIDUAL_KEYS = new Set(
  HEBREW_MEANING_RESIDUAL_AUDIT.records.map((record) => `hebrew:${record.key}`)
);
const IDENTITY_CORRECTION_KEYS = new Set(
  HEBREW_IDENTITY_CORRECTIONS.map((record) => `hebrew:${record.key}`)
);

if (
  GLOSS_RESIDUAL_KEYS.size !== HEBREW_GLOSS_RESIDUAL_AUDIT.reviewedCount ||
  MEANING_RESIDUAL_KEYS.size !== HEBREW_MEANING_RESIDUAL_AUDIT.reviewedCount ||
  IDENTITY_CORRECTION_KEYS.size !== HEBREW_IDENTITY_CORRECTIONS.length
) {
  throw new Error("french-reuse-sealed-registry-duplicate");
}
