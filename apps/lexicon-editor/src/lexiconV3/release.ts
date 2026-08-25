import { createHash, randomUUID } from "node:crypto";
import {
  closeSync,
  copyFileSync,
  existsSync,
  fsyncSync,
  lstatSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { type DatabaseSync, DatabaseSync as SqliteDatabase } from "node:sqlite";
import { fileURLToPath } from "node:url";

import {
  assertPinnedHebrewEnglishArtifactSummary,
  type HebrewEnglishArtifactSummary
} from "./hebrewEnglish.js";
import { lexiconV3CodeFingerprint } from "./codeFingerprint.js";
import { lexiconV3FieldContentHash } from "./review.js";
import { verifyLexiconV3Schema } from "./schema.js";
import { lexiconV3SourceLogicalFingerprint } from "./sourceFingerprint.js";

export const LEXICON_V3_RELEASE_POLICY_VERSION =
  "lexicon-v3-release-policy@2" as const;
export const LEXICON_V3_CORE_EN_RELEASE_POLICY_VERSION =
  "lexicon-v3-core-en-release-policy@1" as const;
export const LEXICON_V3_AUTO_VALIDATED_MIN_CONFIDENCE = 0.9 as const;
const LEXICON_V3_RELEASE_MANIFEST_SCHEMA =
  "lexicon-v3-release-manifest@4" as const;
const LEXICON_V3_PREVIOUS_RELEASE_MANIFEST_SCHEMA =
  "lexicon-v3-release-manifest@3" as const;
const LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA =
  "lexicon-v3-release-manifest@2" as const;
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

export type LexiconV3ReleaseProfile = "bilingual" | "core-en";
type LexiconV3ProductionProfile = "core" | "full" | "core-en";

type LexiconLocale = "en" | "fr";
type LexiconRequiredField = "gloss" | "meaning";
type ValidatedState = "auto_validated" | "human_validated";

interface FieldVersionRow {
  id: number;
  entryKey: string;
  locale: LexiconLocale;
  field: LexiconRequiredField;
  valueText: string;
  valueHtml: string | null;
  state: ValidatedState;
  confidence: number;
  method: string;
  generator: string;
  derivedFromVersionId: number | null;
  contentHash: string;
}

interface EntryRow {
  entryKey: string;
  stepEntryId: number | null;
  language: "greek" | "hebrew";
  baseCode: number;
  eStrong: string;
  primaryDStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  classicTransliteration: string;
  pronunciation: string;
}

interface CarrierRow {
  id: number;
  entryKey: string;
  strong: string;
  stepStrong: string;
  locale: LexiconLocale;
  surface: string;
  normalized: string;
  termKind: string;
  state: ValidatedState;
  policy: "auto_safe" | "review_only";
  confidence: number;
  derivedFromVersionId: number | null;
  contentHash: string;
}

interface SupportingSourceRow {
  fieldVersionId: number;
  sourceKey: string;
  rightsStatus: string;
  allowDisplay: number;
  allowTranslation: number;
}

interface SupportingEvidenceRow extends SupportingSourceRow {
  evidenceKind: string;
  assertionEntryKey: string;
  assertionField: string;
  assertionLocale: string;
}

interface RightsManifestRow {
  sourceKey: string;
  name: string;
  version: string;
  witnessFamily: string;
  locale: string;
  sha256: string;
  license: string;
  rightsStatus: string;
  allowDisplay: number;
  allowTranslation: number;
  allowCarrier: number;
  metadataJson: string;
}

interface ReleaseManifest {
  schemaVersion:
    | typeof LEXICON_V3_RELEASE_MANIFEST_SCHEMA
    | typeof LEXICON_V3_PREVIOUS_RELEASE_MANIFEST_SCHEMA
    | typeof LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA;
  releaseProfile: LexiconV3ReleaseProfile;
  sourceFingerprint: string;
  sourceLogicalFingerprint?: string;
  codeFingerprint: string;
  policyVersion?: string;
  snapshotFingerprint: string;
  entryIdentityFingerprint?: string;
  fieldCount: number;
  carrierCount: number;
  rightsManifestDigest: string;
  rightsManifest: RightsManifestRow[];
}

interface ReleaseRow {
  id: number;
  releaseKey: string;
  state: "building" | "candidate" | "promoted" | "failed";
  expectedEntryCount: number;
  sourceFingerprint: string;
  codeFingerprint: string;
  policyVersion: string;
  manifestJson: string;
  createdAt: string;
  promotedAt: string | null;
}

export interface LexiconV3ReleasePlan {
  profile: LexiconV3ReleaseProfile;
  expectedEntryCount: number;
  fields: FieldVersionRow[];
  carriers: CarrierRow[];
  errors: string[];
  sourceFingerprint: string;
  sourceLogicalFingerprint: string;
  snapshotFingerprint: string;
  entryIdentityFingerprint: string;
  rightsManifestDigest: string;
  rightsManifest: RightsManifestRow[];
}

export interface PlanLexiconV3ReleaseOptions {
  profile?: LexiconV3ReleaseProfile;
}

export interface CreateLexiconV3ReleaseOptions {
  releaseKey: string;
  profile?: LexiconV3ReleaseProfile;
  policyVersion?: string;
  codeFingerprint?: string;
}

export interface LexiconV3ReleaseSummary {
  id: number;
  releaseKey: string;
  profile: LexiconV3ReleaseProfile;
  state: "candidate" | "promoted";
  expectedEntryCount: number;
  fieldCount: number;
  carrierCount: number;
  sourceFingerprint: string;
  codeFingerprint: string;
  policyVersion: string;
  snapshotFingerprint: string;
  promotedAt: string | null;
}

export interface LexiconV3ReleaseVerification {
  ok: boolean;
  releaseKey: string;
  profile: LexiconV3ReleaseProfile | null;
  state: string | null;
  errors: string[];
  expectedEntryCount: number;
  fieldCount: number;
  carrierCount: number;
}

interface BuildLexiconV3ProductionBaseOptions {
  authoringPath: string;
  releaseKey: string;
  sourcePath: string;
  /** Required only when an output already exists. */
  overwriteExisting?: boolean;
}

export interface BuildLexiconV3BilingualProductionOptions extends BuildLexiconV3ProductionBaseOptions {
  profile?: "bilingual";
  coreOutputPath: string;
  fullOutputPath: string;
}

export interface BuildLexiconV3CoreEnglishProductionOptions extends BuildLexiconV3ProductionBaseOptions {
  profile: "core-en";
  outputPath: string;
}

export type BuildLexiconV3ProductionOptions =
  | BuildLexiconV3BilingualProductionOptions
  | BuildLexiconV3CoreEnglishProductionOptions;

export interface LexiconV3ProductionDatabaseSummary {
  path: string;
  profile: LexiconV3ProductionProfile;
  releaseKey: string;
  sha256: string;
  logicalFingerprint: string;
  integrity: string;
  foreignKeyViolations: number;
  freelistPages: number;
  stepEntries: number;
  translationRows: number;
  frenchTranslations: number;
  fieldStatuses: number;
  carrierTerms: number;
  resourceRows: number | null;
  resourceTranslationRows: number | null;
  morphologyTranslationRows: number | null;
}

export interface LexiconV3BilingualReleaseIdentity {
  releaseKey: string;
  sourceFingerprint: string;
  sourceLogicalFingerprint: string;
  entryIdentityFingerprint: string;
  codeFingerprint: string;
  policyVersion: string;
  snapshotFingerprint: string;
  rightsManifestDigest: string;
  releaseProfile: "bilingual";
}

export interface LexiconV3BilingualDeploymentManifestExpectation {
  manifestHash: string;
  releaseIdentity: LexiconV3BilingualReleaseIdentity;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
}

export interface LexiconV3BilingualProductionBuildSummary {
  profile: "bilingual";
  releaseKey: string;
  sourcePath: string;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
}

export interface LexiconV3CoreEnglishProductionBuildSummary {
  profile: "core-en";
  releaseKey: string;
  sourcePath: string;
  coreEnglish: LexiconV3ProductionDatabaseSummary;
}

export type LexiconV3ProductionBuildSummary =
  | LexiconV3BilingualProductionBuildSummary
  | LexiconV3CoreEnglishProductionBuildSummary;

export interface VerifyLexiconV3BilingualCandidatesOptions {
  authoringPath: string;
  sourcePath: string;
  releaseKey: string;
  coreCandidatePath: string;
  fullCandidatePath: string;
  expectedCoreSha256: string;
  expectedFullSha256: string;
  expectedCoreLogicalFingerprint: string;
  expectedFullLogicalFingerprint: string;
}

export interface LexiconV3BilingualCandidateVerification {
  profile: "bilingual";
  releaseKey: string;
  releaseIdentity: LexiconV3BilingualReleaseIdentity;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
}

export interface DeployLexiconV3BilingualCandidatesOptions extends VerifyLexiconV3BilingualCandidatesOptions {
  candidateManifestHash: string;
  candidateManifest: LexiconV3BilingualDeploymentManifestExpectation;
  releaseDirectory: string;
  currentManifestPath: string;
  deployedAt?: string;
}

export interface LexiconV3BilingualDeployment {
  schemaVersion: "lexicon-v3-bilingual-deployment@1";
  profile: "bilingual";
  releaseKey: string;
  releaseDirectory: string;
  currentManifestPath: string;
  candidateManifestHash: string;
  deploymentHash: string;
  pointerHash: string;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
}

type ProjectionVerificationSummary = Omit<
  LexiconV3ProductionDatabaseSummary,
  "releaseKey" | "sha256" | "logicalFingerprint"
>;

export class LexiconV3ReleaseError extends Error {
  readonly errors: string[];

  constructor(message: string, errors: string[]) {
    super(`${message}:${errors.join(",")}`);
    this.name = "LexiconV3ReleaseError";
    this.errors = errors;
  }
}

export function planLexiconV3Release(
  db: DatabaseSync,
  options: PlanLexiconV3ReleaseOptions = {}
): LexiconV3ReleasePlan {
  const profile = normalizeReleaseProfile(options.profile);
  const schema = verifyLexiconV3Schema(db);
  if (!schema.ok) {
    return emptyPlan(profile, [
      `invalid-authoring-schema:${JSON.stringify(schema)}`
    ]);
  }

  const entries = readAuthoringEntries(db);
  if (entries.length === 0) return emptyPlan(profile, ["no-lexicon-entries"]);

  const versions = db
    .prepare(
      `SELECT id, entryKey, locale, field, valueText, valueHtml, state,
              confidence, method, generator, derivedFromVersionId, contentHash
       FROM LexiconFieldVersions
       WHERE locale IN ('en', 'fr')
         AND field IN ('gloss', 'meaning')
         AND state IN ('auto_validated', 'human_validated')
       ORDER BY entryKey, locale, field,
                CASE state WHEN 'human_validated' THEN 0 ELSE 1 END,
                confidence DESC, id DESC`
    )
    .all() as unknown as FieldVersionRow[];
  const bySlot = groupFieldVersions(versions);
  const fields: FieldVersionRow[] = [];
  const errors: string[] = [];
  validatePinnedHebrewEnglishSource(db, errors);
  for (const entry of entries) {
    if (entry.stepEntryId === null) {
      errors.push(`missing-entry-id:${entry.entryKey}`);
    }
  }

  for (const entry of entries) {
    for (const field of ["gloss", "meaning"] as const) {
      const english = bySlot.get(slotKey(entry.entryKey, "en", field))?.[0];
      if (!english) {
        errors.push(`missing-validated-field:${entry.entryKey}:en:${field}`);
        continue;
      }
      validateStoredContentHash(english, errors);
      fields.push(english);

      if (profile === "core-en") continue;

      const allFrench = bySlot.get(slotKey(entry.entryKey, "fr", field)) ?? [];
      const french = allFrench.find(
        (version) => version.derivedFromVersionId === english.id
      );
      if (!french) {
        errors.push(
          allFrench.length > 0
            ? `stale-french-source:${entry.entryKey}:${field}:expected-${english.id}`
            : `missing-validated-field:${entry.entryKey}:fr:${field}`
        );
        continue;
      }
      validateStoredContentHash(french, errors);
      fields.push(french);
    }
  }

  const selectedIds = new Set(fields.map((field) => field.id));
  validateHumanFieldReviews(db, fields, errors);
  validateRequiredSupportingEvidence(db, fields, selectedIds, errors);
  if (profile === "bilingual") {
    validateFrenchInternalReviewProvenance(db, fields, errors);
  }
  validateAutomaticConfidence(fields, errors);
  validateOpenBlockers(db, profile, fields, errors);
  validateSourceRights(db, fields, selectedIds, errors);
  const carriers =
    profile === "bilingual" ? selectReleaseCarriers(db, fields) : [];
  const sourceFingerprint = readAuthoringFingerprint(
    db,
    "sourceFingerprint",
    errors
  );
  const sourceLogicalFingerprint = readAuthoringFingerprint(
    db,
    "sourceLogicalFingerprint",
    errors
  );
  const rightsManifest = readRightsManifest(db, profile, selectedIds);
  const rightsManifestDigest = hashJson(rightsManifest);
  const selectedFieldIds = new Set(fields.map((field) => field.id));
  const reviewTrail = readReviewTrail(db, selectedFieldIds);
  const issueTrail = readIssueTrail(db, profile, fields);
  const entryIdentityFingerprint = fingerprintEntryIdentities(entries);
  const contentHashById = new Map(
    versions.map((field) => [field.id, field.contentHash])
  );
  const snapshotFingerprint = hashJson({
    profile,
    policyVersion: requiredReleasePolicyVersion(profile),
    sourceLogicalFingerprint,
    entryIdentityFingerprint,
    rightsManifestDigest,
    fields: fields
      .map((field) => ({
        entryKey: field.entryKey,
        locale: field.locale,
        field: field.field,
        contentHash: field.contentHash,
        state: field.state,
        confidence: field.confidence,
        method: field.method,
        generator: field.generator,
        derivedFromContentHash: field.derivedFromVersionId
          ? (contentHashById.get(field.derivedFromVersionId) ?? null)
          : null
      }))
      .sort((left, right) =>
        `${left.entryKey}:${left.locale}:${left.field}`.localeCompare(
          `${right.entryKey}:${right.locale}:${right.field}`
        )
      ),
    carriers: carriers
      .map((carrier) => ({
        entryKey: carrier.entryKey,
        strong: carrier.strong,
        stepStrong: carrier.stepStrong,
        normalized: carrier.normalized,
        state: carrier.state,
        policy: carrier.policy,
        confidence: carrier.confidence,
        contentHash: carrier.contentHash
      }))
      .sort((left, right) =>
        `${left.entryKey}:${left.stepStrong}:${left.normalized}`.localeCompare(
          `${right.entryKey}:${right.stepStrong}:${right.normalized}`
        )
      ),
    reviews: reviewTrail,
    issues: issueTrail
  });

  return {
    profile,
    expectedEntryCount: entries.length,
    fields,
    carriers,
    errors: [...new Set(errors)].sort(),
    sourceFingerprint,
    sourceLogicalFingerprint,
    snapshotFingerprint,
    entryIdentityFingerprint,
    rightsManifestDigest,
    rightsManifest
  };
}

export function createLexiconV3ReleaseCandidate(
  db: DatabaseSync,
  options: CreateLexiconV3ReleaseOptions
): LexiconV3ReleaseSummary {
  const releaseKey = options.releaseKey.trim();
  if (!releaseKey) throw new Error("missing-release-key");
  const profile = normalizeReleaseProfile(options.profile);
  const plan = planLexiconV3Release(db, { profile });
  if (plan.errors.length > 0) {
    throw new LexiconV3ReleaseError("release-plan-invalid", plan.errors);
  }
  const policyVersion = requiredReleasePolicyVersion(profile);
  if (
    options.policyVersion?.trim() &&
    options.policyVersion.trim() !== policyVersion
  ) {
    throw new Error(
      `release-policy-version-mismatch:${options.policyVersion.trim()}:${policyVersion}`
    );
  }
  const codeFingerprint = requiredAuthoringFingerprint(db, "codeFingerprint");
  if (
    options.codeFingerprint?.trim() &&
    options.codeFingerprint.trim() !== codeFingerprint
  ) {
    throw new Error("release-code-fingerprint-must-match-authoring");
  }
  assertSha256(codeFingerprint, "code-fingerprint");
  if (
    db
      .prepare("SELECT 1 FROM LexiconReleases WHERE releaseKey = ?")
      .get(releaseKey)
  ) {
    throw new Error(`release-key-already-exists:${releaseKey}`);
  }

  db.exec("BEGIN IMMEDIATE");
  try {
    const manifestJson = JSON.stringify({
      schemaVersion: LEXICON_V3_RELEASE_MANIFEST_SCHEMA,
      releaseProfile: profile,
      sourceFingerprint: plan.sourceFingerprint,
      sourceLogicalFingerprint: plan.sourceLogicalFingerprint,
      codeFingerprint,
      policyVersion,
      snapshotFingerprint: plan.snapshotFingerprint,
      entryIdentityFingerprint: plan.entryIdentityFingerprint,
      fieldCount: plan.fields.length,
      carrierCount: plan.carriers.length,
      rightsManifestDigest: plan.rightsManifestDigest,
      rightsManifest: plan.rightsManifest
    });
    const result = db
      .prepare(
        `INSERT INTO LexiconReleases (
           releaseKey, state, expectedEntryCount, sourceFingerprint,
           codeFingerprint, policyVersion, manifestJson
         ) VALUES (?, 'building', ?, ?, ?, ?, ?)`
      )
      .run(
        releaseKey,
        plan.expectedEntryCount,
        plan.sourceFingerprint,
        codeFingerprint,
        policyVersion,
        manifestJson
      );
    const releaseId = Number(result.lastInsertRowid);
    const insertField = db.prepare(
      `INSERT INTO LexiconReleaseFields (
         releaseId, entryKey, locale, field, fieldVersionId
       ) VALUES (?, ?, ?, ?, ?)`
    );
    for (const field of plan.fields) {
      insertField.run(
        releaseId,
        field.entryKey,
        field.locale,
        field.field,
        field.id
      );
    }
    const insertCarrier = db.prepare(
      `INSERT INTO LexiconReleaseCarriers (releaseId, carrierTermId)
       VALUES (?, ?)`
    );
    for (const carrier of plan.carriers) {
      insertCarrier.run(releaseId, carrier.id);
    }
    db.prepare(
      "UPDATE LexiconReleases SET state = 'candidate' WHERE id = ?"
    ).run(releaseId);

    const verification = verifyLexiconV3Release(db, releaseKey, true);
    if (!verification.ok) {
      throw new LexiconV3ReleaseError(
        "release-candidate-verification-failed",
        verification.errors
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }

  return readReleaseSummary(db, releaseKey);
}

export function promoteLexiconV3Release(
  db: DatabaseSync,
  releaseKey: string,
  promotedAt = new Date().toISOString()
): LexiconV3ReleaseSummary {
  if (!Number.isFinite(Date.parse(promotedAt))) {
    throw new Error(`invalid-promotion-date:${promotedAt}`);
  }
  db.exec("BEGIN IMMEDIATE");
  try {
    const verification = verifyLexiconV3Release(db, releaseKey, true);
    if (!verification.ok) {
      throw new LexiconV3ReleaseError(
        "release-promotion-refused",
        verification.errors
      );
    }
    const result = db
      .prepare(
        `UPDATE LexiconReleases
         SET state = 'promoted', promotedAt = ?
         WHERE releaseKey = ? AND state = 'candidate'`
      )
      .run(promotedAt, releaseKey);
    if (Number(result.changes) !== 1) {
      throw new Error(`release-not-candidate:${releaseKey}`);
    }
    const schema = verifyLexiconV3Schema(db);
    if (!schema.ok) {
      throw new LexiconV3ReleaseError("post-promotion-schema-invalid", [
        JSON.stringify(schema)
      ]);
    }
    const promoted = verifyLexiconV3Release(db, releaseKey, false);
    if (!promoted.ok) {
      throw new LexiconV3ReleaseError(
        "post-promotion-release-invalid",
        promoted.errors
      );
    }
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
  return readReleaseSummary(db, releaseKey);
}

export function verifyLexiconV3Release(
  db: DatabaseSync,
  releaseKey: string,
  requireCurrentSelection = false
): LexiconV3ReleaseVerification {
  const release = readRelease(db, releaseKey);
  if (!release) {
    return {
      ok: false,
      releaseKey,
      profile: null,
      state: null,
      errors: [`missing-release:${releaseKey}`],
      expectedEntryCount: 0,
      fieldCount: 0,
      carrierCount: 0
    };
  }
  const errors: string[] = [];
  const manifest = validateReleaseManifest(release, errors);
  const profile = manifest?.releaseProfile ?? "bilingual";
  validatePinnedHebrewEnglishSource(db, errors);
  const authoringEntries = readAuthoringEntries(db);
  const authoringCount = authoringEntries.length;
  if (
    manifest?.entryIdentityFingerprint &&
    manifest.entryIdentityFingerprint !==
      fingerprintEntryIdentities(authoringEntries)
  ) {
    errors.push("release-entry-identity-fingerprint-mismatch");
  }
  const fieldCount = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconReleaseFields WHERE releaseId = ?",
    release.id
  );
  const carrierCount = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconReleaseCarriers WHERE releaseId = ?",
    release.id
  );
  const distinctEntries = readCount(
    db,
    "SELECT count(DISTINCT entryKey) AS count FROM LexiconReleaseFields WHERE releaseId = ?",
    release.id
  );
  if (release.expectedEntryCount !== authoringCount) {
    errors.push(
      `authoring-count-mismatch:${release.expectedEntryCount}:${authoringCount}`
    );
  }
  if (distinctEntries !== release.expectedEntryCount) {
    errors.push(
      `release-entry-count-mismatch:${distinctEntries}:${release.expectedEntryCount}`
    );
  }
  const expectedFieldCount =
    release.expectedEntryCount * requiredFieldMultiplier(profile);
  if (fieldCount !== expectedFieldCount) {
    errors.push(
      `release-field-count-mismatch:${fieldCount}:${expectedFieldCount}`
    );
  }
  if (profile === "core-en" && carrierCount !== 0) {
    errors.push(`release-core-en-carrier-count:${carrierCount}:0`);
  }
  if (
    manifest?.fieldCount !== undefined &&
    manifest.fieldCount !== fieldCount
  ) {
    errors.push(
      `release-manifest-field-count:${manifest.fieldCount}:${fieldCount}`
    );
  }
  if (
    manifest?.carrierCount !== undefined &&
    manifest.carrierCount !== carrierCount
  ) {
    errors.push(
      `release-manifest-carrier-count:${manifest.carrierCount}:${carrierCount}`
    );
  }
  appendSqlCountError(
    db,
    errors,
    "release-field-profile-invalid",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields rf
     WHERE rf.releaseId = ?
       AND (
         (? = 'core-en' AND (rf.locale <> 'en' OR rf.field NOT IN ('gloss', 'meaning')))
         OR
         (? = 'bilingual' AND (rf.locale NOT IN ('en', 'fr') OR rf.field NOT IN ('gloss', 'meaning')))
       )`,
    release.id,
    profile,
    profile
  );
  appendSqlCountError(
    db,
    errors,
    "release-field-invalid",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields rf
     JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
     WHERE rf.releaseId = ?
       AND (fv.entryKey <> rf.entryKey OR fv.locale <> rf.locale
         OR fv.field <> rf.field
         OR fv.state NOT IN ('auto_validated', 'human_validated'))`,
    release.id
  );
  appendSqlCountError(
    db,
    errors,
    "release-fr-source-mismatch",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields fr
     JOIN LexiconFieldVersions fv ON fv.id = fr.fieldVersionId
     LEFT JOIN LexiconReleaseFields en
       ON en.releaseId = fr.releaseId AND en.entryKey = fr.entryKey
      AND en.locale = 'en' AND en.field = fr.field
     WHERE fr.releaseId = ? AND fr.locale = 'fr'
       AND (en.fieldVersionId IS NULL
         OR en.fieldVersionId <> fv.derivedFromVersionId)`,
    release.id
  );
  appendSqlCountError(
    db,
    errors,
    "release-entry-id-missing",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields rf
     LEFT JOIN LexiconEntryIds ids ON ids.entryKey = rf.entryKey
     WHERE rf.releaseId = ? AND ids.entryKey IS NULL`,
    release.id
  );
  appendSqlCountError(
    db,
    errors,
    "release-open-blocker",
    `SELECT count(*) AS count
     FROM LexiconIssues issue
     WHERE issue.severity IN ('blocker', 'warning') AND issue.status = 'open'
       AND EXISTS (
         SELECT 1 FROM LexiconReleaseFields rf
         WHERE rf.releaseId = ? AND rf.entryKey = issue.entryKey
           AND (? = 'bilingual' OR issue.fieldVersionId IS NULL
             OR issue.fieldVersionId = rf.fieldVersionId)
       )`,
    release.id,
    profile
  );
  appendSqlCountError(
    db,
    errors,
    "release-rights-blocked",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields rf
     JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = rf.fieldVersionId
     JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
     JOIN LexiconSources source ON source.id = assertion.sourceId
     WHERE rf.releaseId = ? AND evidence.stance = 'supports'
       AND (source.rightsStatus <> 'cleared' OR source.allowDisplay <> 1)`,
    release.id
  );
  appendSqlCountError(
    db,
    errors,
    "release-translation-rights-blocked",
    `SELECT count(*) AS count
     FROM LexiconReleaseFields fr
     JOIN LexiconFieldVersions frVersion ON frVersion.id = fr.fieldVersionId
     JOIN LexiconFieldEvidence evidence
       ON evidence.fieldVersionId = frVersion.derivedFromVersionId
     JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
     JOIN LexiconSources source ON source.id = assertion.sourceId
     WHERE fr.releaseId = ? AND fr.locale = 'fr'
       AND evidence.stance = 'supports'
       AND (source.rightsStatus <> 'cleared' OR source.allowTranslation <> 1)`,
    release.id
  );
  appendSqlCountError(
    db,
    errors,
    "release-carrier-invalid",
    `SELECT count(*) AS count
     FROM LexiconReleaseCarriers rc
     JOIN LexiconCarrierTerms term ON term.id = rc.carrierTermId
     WHERE rc.releaseId = ?
       AND NOT (
         (term.state = 'human_validated'
          OR (term.state = 'auto_validated' AND term.policy = 'auto_safe'))
         AND term.policy <> 'blocked'
         AND EXISTS (
           SELECT 1 FROM LexiconCarrierEvidence evidence
           JOIN LexiconSources source ON source.id = evidence.sourceId
           WHERE evidence.carrierTermId = term.id
             AND evidence.stance = 'supports'
             AND source.allowCarrier = 1
             AND source.rightsStatus = 'cleared'
         )
       )`,
    release.id
  );

  const releaseFields = readReleaseFields(db, release.id);
  for (const field of releaseFields) validateStoredContentHash(field, errors);
  const releaseFieldIds = new Set(releaseFields.map((field) => field.id));
  validateRequiredSupportingEvidence(
    db,
    releaseFields,
    releaseFieldIds,
    errors
  );
  if (profile === "bilingual") {
    validateFrenchInternalReviewProvenance(db, releaseFields, errors);
  }
  validateAutomaticConfidence(releaseFields, errors);

  if (requireCurrentSelection) {
    const current = planLexiconV3Release(db, { profile });
    errors.push(...current.errors);
    if (current.sourceFingerprint !== release.sourceFingerprint) {
      errors.push("stale-release-sources");
    }
    const currentCodeFingerprint = readAuthoringFingerprint(
      db,
      "codeFingerprint",
      errors
    );
    if (currentCodeFingerprint !== release.codeFingerprint) {
      errors.push("stale-release-code");
    }
    if (lexiconV3CodeFingerprint() !== release.codeFingerprint) {
      errors.push("stale-release-code-on-disk");
    }
    if (manifest?.snapshotFingerprint !== current.snapshotFingerprint) {
      errors.push("stale-release-snapshot");
    }
    compareIdSets(
      "stale-release-fields",
      releaseFields.map((field) => field.id),
      current.fields.map((field) => field.id),
      errors
    );
    const releaseCarrierIds = db
      .prepare(
        `SELECT carrierTermId AS id FROM LexiconReleaseCarriers
         WHERE releaseId = ? ORDER BY carrierTermId`
      )
      .all(release.id) as unknown as Array<{ id: number }>;
    compareIdSets(
      "stale-release-carriers",
      releaseCarrierIds.map((row) => row.id),
      current.carriers.map((carrier) => carrier.id),
      errors
    );
  }

  return {
    ok: errors.length === 0,
    releaseKey,
    profile,
    state: release.state,
    errors: [...new Set(errors)].sort(),
    expectedEntryCount: release.expectedEntryCount,
    fieldCount,
    carrierCount
  };
}

export function buildLexiconV3Production(
  options: BuildLexiconV3BilingualProductionOptions
): LexiconV3BilingualProductionBuildSummary;
export function buildLexiconV3Production(
  options: BuildLexiconV3CoreEnglishProductionOptions
): LexiconV3CoreEnglishProductionBuildSummary;
export function buildLexiconV3Production(
  options: BuildLexiconV3ProductionOptions
): LexiconV3ProductionBuildSummary {
  const requestedProfile = normalizeReleaseProfile(options.profile);
  const authoringPath = resolve(options.authoringPath);
  const sourcePath = resolve(options.sourcePath);
  if (!existsSync(authoringPath)) {
    throw new Error(`missing-authoring-db:${authoringPath}`);
  }
  if (!existsSync(sourcePath))
    throw new Error(`missing-source-db:${sourcePath}`);
  const outputPaths =
    options.profile === "core-en"
      ? [resolve(options.outputPath)]
      : [resolve(options.coreOutputPath), resolve(options.fullOutputPath)];
  assertSafeProductionOutputPaths(authoringPath, sourcePath, outputPaths);
  if (requestedProfile === "bilingual" && outputPaths[0] === outputPaths[1]) {
    throw new Error("core-and-full-output-must-differ");
  }
  for (const outputPath of outputPaths) {
    if (existsSync(outputPath) && !options.overwriteExisting) {
      throw new Error(`output-exists-requires-write:${outputPath}`);
    }
    mkdirSync(dirname(outputPath), { recursive: true });
  }

  const authoring = new SqliteDatabase(authoringPath);
  let snapshot: ReleaseProjectionSnapshot;
  try {
    authoring.exec("PRAGMA foreign_keys = ON");
    const schema = verifyLexiconV3Schema(authoring);
    if (!schema.ok) {
      throw new LexiconV3ReleaseError("invalid-authoring-schema", [
        JSON.stringify(schema)
      ]);
    }
    const release = readRelease(authoring, options.releaseKey);
    if (!release || release.state !== "promoted") {
      throw new Error(`release-not-promoted:${options.releaseKey}`);
    }
    const verification = verifyLexiconV3Release(
      authoring,
      options.releaseKey,
      true
    );
    if (!verification.ok) {
      throw new LexiconV3ReleaseError(
        "promoted-release-invalid",
        verification.errors
      );
    }
    if (verification.profile !== requestedProfile) {
      throw new Error(
        `release-profile-mismatch:${verification.profile}:${requestedProfile}`
      );
    }
    snapshot = readProjectionSnapshot(authoring, release);
  } finally {
    authoring.close();
  }

  if (options.profile === "core-en") {
    const outputPath = resolve(options.outputPath);
    const temporary = temporarySibling(outputPath);
    try {
      copyFileSync(sourcePath, temporary);
      const coreEnglish = withProductionArtifactDigests(
        temporary,
        projectProductionDatabase(temporary, "core-en", snapshot),
        snapshot.release.releaseKey
      );
      publishLexiconV3AtomicPair(
        [{ temporary, output: outputPath }],
        options.overwriteExisting === true
      );
      return {
        profile: "core-en",
        releaseKey: options.releaseKey,
        sourcePath,
        coreEnglish: { ...coreEnglish, path: outputPath }
      };
    } catch (error) {
      removeSqliteFile(temporary);
      throw error;
    }
  }

  const coreOutputPath = resolve(options.coreOutputPath);
  const fullOutputPath = resolve(options.fullOutputPath);
  const tempCore = temporarySibling(coreOutputPath);
  const tempFull = temporarySibling(fullOutputPath);
  try {
    copyFileSync(sourcePath, tempCore);
    copyFileSync(sourcePath, tempFull);
    const core = withProductionArtifactDigests(
      tempCore,
      projectProductionDatabase(tempCore, "core", snapshot),
      snapshot.release.releaseKey
    );
    const full = withProductionArtifactDigests(
      tempFull,
      projectProductionDatabase(tempFull, "full", snapshot),
      snapshot.release.releaseKey
    );
    publishLexiconV3AtomicPair(
      [
        { temporary: tempCore, output: coreOutputPath },
        { temporary: tempFull, output: fullOutputPath }
      ],
      options.overwriteExisting === true
    );
    return {
      profile: "bilingual",
      releaseKey: options.releaseKey,
      sourcePath,
      core: { ...core, path: coreOutputPath },
      full: { ...full, path: fullOutputPath }
    };
  } catch (error) {
    removeSqliteFile(tempCore);
    removeSqliteFile(tempFull);
    throw error;
  }
}

/**
 * Replays every projection invariant against two already-built bilingual
 * candidates. Expected byte digests are mandatory so deployment cannot
 * silently accept a different local file merely because it is self-consistent.
 */
export function verifyLexiconV3BilingualCandidates(
  options: VerifyLexiconV3BilingualCandidatesOptions
): LexiconV3BilingualCandidateVerification {
  const authoringPath = resolve(options.authoringPath);
  const sourcePath = resolve(options.sourcePath);
  const coreCandidatePath = resolve(options.coreCandidatePath);
  const fullCandidatePath = resolve(options.fullCandidatePath);
  if (!existsSync(authoringPath)) {
    throw new Error(`missing-authoring-db:${authoringPath}`);
  }
  if (!existsSync(sourcePath)) {
    throw new Error(`missing-source-db:${sourcePath}`);
  }
  if (!existsSync(coreCandidatePath)) {
    throw new Error(`missing-core-candidate:${coreCandidatePath}`);
  }
  if (!existsSync(fullCandidatePath)) {
    throw new Error(`missing-full-candidate:${fullCandidatePath}`);
  }
  if (comparablePath(coreCandidatePath) === comparablePath(fullCandidatePath)) {
    throw new Error("core-and-full-candidate-must-differ");
  }
  for (const [label, digest] of [
    ["core-sha256", options.expectedCoreSha256],
    ["full-sha256", options.expectedFullSha256],
    ["core-logical-fingerprint", options.expectedCoreLogicalFingerprint],
    ["full-logical-fingerprint", options.expectedFullLogicalFingerprint]
  ] as const) {
    if (!/^[a-f0-9]{64}$/u.test(digest)) {
      throw new Error(`invalid-candidate-${label}`);
    }
  }

  const authoring = new SqliteDatabase(authoringPath);
  let snapshot: ReleaseProjectionSnapshot;
  try {
    authoring.exec("PRAGMA foreign_keys = ON");
    authoring.exec("BEGIN");
    try {
      const schema = verifyLexiconV3Schema(authoring);
      if (!schema.ok) {
        throw new LexiconV3ReleaseError("invalid-authoring-schema", [
          JSON.stringify(schema)
        ]);
      }
      const release = readRelease(authoring, options.releaseKey);
      if (!release || release.state !== "promoted") {
        throw new Error(`release-not-promoted:${options.releaseKey}`);
      }
      const releaseVerification = verifyLexiconV3Release(
        authoring,
        options.releaseKey,
        true
      );
      if (!releaseVerification.ok) {
        throw new LexiconV3ReleaseError(
          "promoted-release-invalid",
          releaseVerification.errors
        );
      }
      if (releaseVerification.profile !== "bilingual") {
        throw new Error(
          `release-profile-mismatch:${releaseVerification.profile}:bilingual`
        );
      }
      snapshot = readProjectionSnapshot(authoring, release);
      authoring.exec("COMMIT");
    } catch (error) {
      authoring.exec("ROLLBACK");
      throw error;
    }
  } finally {
    authoring.close();
  }

  const source = new SqliteDatabase(sourcePath, { readOnly: true });
  let core: LexiconV3ProductionDatabaseSummary;
  let full: LexiconV3ProductionDatabaseSummary;
  try {
    source.exec("BEGIN");
    const actualSourceLogicalFingerprint =
      lexiconV3SourceLogicalFingerprint(source);
    if (actualSourceLogicalFingerprint !== snapshot.sourceLogicalFingerprint) {
      throw new Error(
        `deployment-source-logical-fingerprint-mismatch:${actualSourceLogicalFingerprint}:${snapshot.sourceLogicalFingerprint}`
      );
    }
    core = verifyExistingProductionCandidate(
      coreCandidatePath,
      "core",
      snapshot,
      options.expectedCoreSha256,
      options.expectedCoreLogicalFingerprint
    );
    full = verifyExistingProductionCandidate(
      fullCandidatePath,
      "full",
      snapshot,
      options.expectedFullSha256,
      options.expectedFullLogicalFingerprint
    );
    assertPreservedSourceTables(source, coreCandidatePath, "core");
    assertPreservedSourceTables(source, fullCandidatePath, "full");
    source.exec("COMMIT");
  } catch (error) {
    source.exec("ROLLBACK");
    throw error;
  } finally {
    source.close();
  }
  return {
    profile: "bilingual",
    releaseKey: options.releaseKey,
    releaseIdentity: bilingualReleaseIdentity(snapshot),
    core,
    full
  };
}

function assertPreservedSourceTables(
  source: DatabaseSync,
  candidatePath: string,
  profile: "core" | "full"
): void {
  const candidate = new SqliteDatabase(candidatePath, { readOnly: true });
  try {
    const tables: string[] = ["MorphologyCodes"];
    if (profile === "full") tables.push("LexiconResources");
    for (const table of tables) {
      const sourceRows = source
        .prepare(`SELECT * FROM ${table} ORDER BY id`)
        .all();
      const candidateRows = candidate
        .prepare(`SELECT * FROM ${table} ORDER BY id`)
        .all();
      if (JSON.stringify(sourceRows) !== JSON.stringify(candidateRows)) {
        throw new Error(
          `deployment-preserved-table-mismatch:${profile}:${table}`
        );
      }
    }
    const sourceMeta = source
      .prepare(
        `SELECT key, value FROM DictionaryMeta
         WHERE key <> 'morphologyTranslations'
           AND key NOT GLOB 'lexiconV3*'
         ORDER BY key`
      )
      .all();
    const candidateMeta = candidate
      .prepare(
        `SELECT key, value FROM DictionaryMeta
         WHERE key NOT GLOB 'lexiconV3*'
         ORDER BY key`
      )
      .all();
    if (JSON.stringify(sourceMeta) !== JSON.stringify(candidateMeta)) {
      throw new Error(
        `deployment-preserved-dictionary-meta-mismatch:${profile}`
      );
    }
  } finally {
    candidate.close();
  }
}

/**
 * Installs a verified pair in one immutable versioned directory, then changes
 * one JSON pointer atomically. Readers must resolve the pointer once and use
 * both paths from that same document; they never observe a half-new pair.
 */
export function deployLexiconV3BilingualCandidates(
  options: DeployLexiconV3BilingualCandidatesOptions
): LexiconV3BilingualDeployment {
  const coreCandidatePath = resolve(options.coreCandidatePath);
  const fullCandidatePath = resolve(options.fullCandidatePath);
  const releaseDirectory = resolve(options.releaseDirectory);
  const currentManifestPath = resolve(options.currentManifestPath);
  const deploymentLockPath = `${currentManifestPath}.deploy-lock.sqlite`;
  if (!/^[A-Za-z0-9._-]+$/u.test(options.releaseKey)) {
    throw new Error(`deployment-release-key-path-unsafe:${options.releaseKey}`);
  }
  if (basename(releaseDirectory) !== options.releaseKey) {
    throw new Error("deployment-release-directory-key-mismatch");
  }
  if (!/^[a-f0-9]{64}$/u.test(options.candidateManifestHash)) {
    throw new Error("deployment-candidate-manifest-hash-invalid");
  }
  assertDeploymentManifestExpectation(options, {
    profile: "bilingual",
    releaseKey: options.releaseKey,
    releaseIdentity: options.candidateManifest.releaseIdentity,
    core: options.candidateManifest.core,
    full: options.candidateManifest.full
  });
  if (
    options.candidateManifest.manifestHash !== options.candidateManifestHash ||
    comparablePath(options.candidateManifest.core.path) !==
      comparablePath(coreCandidatePath) ||
    comparablePath(options.candidateManifest.full.path) !==
      comparablePath(fullCandidatePath)
  ) {
    throw new Error("deployment-candidate-manifest-envelope-mismatch");
  }
  const deployedAt = options.deployedAt ?? new Date().toISOString();
  if (!Number.isFinite(Date.parse(deployedAt))) {
    throw new Error(`deployment-date-invalid:${deployedAt}`);
  }
  assertSafeVersionedDeploymentPaths({
    authoringPath: resolve(options.authoringPath),
    sourcePath: resolve(options.sourcePath),
    candidatePaths: [coreCandidatePath, fullCandidatePath],
    releaseDirectory,
    currentManifestPath,
    deploymentLockPath
  });
  if (existsSync(currentManifestPath)) {
    assertRegularFileNotSymlink(
      currentManifestPath,
      "deployment-current-pointer"
    );
  }
  mkdirSync(dirname(releaseDirectory), { recursive: true });
  mkdirSync(dirname(currentManifestPath), { recursive: true });

  const releaseLock = acquireDeploymentLock(
    deploymentLockPath,
    options.releaseKey
  );
  try {
    const installed = existsSync(releaseDirectory)
      ? verifyInstalledBilingualRelease(options, releaseDirectory)
      : installVersionedBilingualRelease(options, releaseDirectory, deployedAt);
    const pointerContent = {
      schemaVersion: "lexicon-v3-bilingual-current@1" as const,
      releaseKey: options.releaseKey,
      releaseDirectory,
      deploymentReceipt: join(releaseDirectory, "deployment.json"),
      deploymentHash: installed.deploymentHash,
      core: {
        path: installed.core.path,
        sha256: installed.core.sha256,
        logicalFingerprint: installed.core.logicalFingerprint
      },
      full: {
        path: installed.full.path,
        sha256: installed.full.sha256,
        logicalFingerprint: installed.full.logicalFingerprint
      },
      activatedAt: deployedAt
    };
    const pointer = {
      ...pointerContent,
      pointerHash: hashJson(pointerContent)
    };
    const pointerHash = installCurrentDeploymentPointer(
      currentManifestPath,
      pointer
    );
    return {
      schemaVersion: "lexicon-v3-bilingual-deployment@1",
      profile: "bilingual",
      releaseKey: options.releaseKey,
      releaseDirectory,
      currentManifestPath,
      candidateManifestHash: options.candidateManifestHash,
      deploymentHash: installed.deploymentHash,
      pointerHash,
      core: installed.core,
      full: installed.full
    };
  } finally {
    releaseLock();
  }
}

interface InstalledBilingualRelease {
  deploymentHash: string;
  core: LexiconV3ProductionDatabaseSummary;
  full: LexiconV3ProductionDatabaseSummary;
}

function assertDeploymentManifestExpectation(
  options: DeployLexiconV3BilingualCandidatesOptions,
  actual: LexiconV3BilingualCandidateVerification
): void {
  const expected = options.candidateManifest;
  if (
    !/^[a-f0-9]{64}$/u.test(expected.manifestHash) ||
    expected.manifestHash !== options.candidateManifestHash ||
    expected.releaseIdentity.releaseKey !== options.releaseKey ||
    expected.releaseIdentity.releaseProfile !== "bilingual" ||
    expected.core.profile !== "core" ||
    expected.full.profile !== "full" ||
    expected.core.releaseKey !== options.releaseKey ||
    expected.full.releaseKey !== options.releaseKey ||
    expected.core.sha256 !== options.expectedCoreSha256 ||
    expected.full.sha256 !== options.expectedFullSha256 ||
    expected.core.logicalFingerprint !==
      options.expectedCoreLogicalFingerprint ||
    expected.full.logicalFingerprint !== options.expectedFullLogicalFingerprint
  ) {
    throw new Error("deployment-candidate-manifest-envelope-mismatch");
  }
  if (
    JSON.stringify(actual.releaseIdentity) !==
    JSON.stringify(expected.releaseIdentity)
  ) {
    throw new Error("deployment-candidate-manifest-release-identity-mismatch");
  }
  if (
    JSON.stringify(deploymentSummaryIdentity(actual.core)) !==
    JSON.stringify(deploymentSummaryIdentity(expected.core))
  ) {
    throw new Error("deployment-candidate-manifest-core-summary-mismatch");
  }
  if (
    JSON.stringify(deploymentSummaryIdentity(actual.full)) !==
    JSON.stringify(deploymentSummaryIdentity(expected.full))
  ) {
    throw new Error("deployment-candidate-manifest-full-summary-mismatch");
  }
}

function deploymentSummaryIdentity(
  summary: LexiconV3ProductionDatabaseSummary
): Omit<LexiconV3ProductionDatabaseSummary, "path"> {
  return {
    profile: summary.profile,
    releaseKey: summary.releaseKey,
    sha256: summary.sha256,
    logicalFingerprint: summary.logicalFingerprint,
    integrity: summary.integrity,
    foreignKeyViolations: summary.foreignKeyViolations,
    freelistPages: summary.freelistPages,
    stepEntries: summary.stepEntries,
    translationRows: summary.translationRows,
    frenchTranslations: summary.frenchTranslations,
    fieldStatuses: summary.fieldStatuses,
    carrierTerms: summary.carrierTerms,
    resourceRows: summary.resourceRows,
    resourceTranslationRows: summary.resourceTranslationRows,
    morphologyTranslationRows: summary.morphologyTranslationRows
  };
}

function installVersionedBilingualRelease(
  options: DeployLexiconV3BilingualCandidatesOptions,
  releaseDirectory: string,
  deployedAt: string
): InstalledBilingualRelease {
  const stagingDirectory = `${releaseDirectory}.tmp-${randomUUID()}`;
  const temporaryCore = join(
    stagingDirectory,
    "strong_lexicon.fr.core.production.sqlite"
  );
  const temporaryFull = join(
    stagingDirectory,
    "strong_lexicon.fr.full.production.sqlite"
  );
  mkdirSync(stagingDirectory, { recursive: false });
  try {
    copyFileSync(resolve(options.coreCandidatePath), temporaryCore);
    copyFileSync(resolve(options.fullCandidatePath), temporaryFull);
    const verified = verifyLexiconV3BilingualCandidates({
      ...options,
      coreCandidatePath: temporaryCore,
      fullCandidatePath: temporaryFull
    });
    assertDeploymentManifestExpectation(options, verified);
    const receiptContent = {
      schemaVersion: "lexicon-v3-bilingual-deployment-receipt@1" as const,
      profile: "bilingual" as const,
      releaseKey: options.releaseKey,
      candidateManifestHash: options.candidateManifestHash,
      sourcePath: resolve(options.sourcePath),
      deployedAt,
      core: {
        file: basename(temporaryCore),
        sha256: verified.core.sha256,
        logicalFingerprint: verified.core.logicalFingerprint
      },
      full: {
        file: basename(temporaryFull),
        sha256: verified.full.sha256,
        logicalFingerprint: verified.full.logicalFingerprint
      }
    };
    const receipt = {
      ...receiptContent,
      deploymentHash: hashJson(receiptContent)
    };
    const receiptPath = join(stagingDirectory, "deployment.json");
    writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    for (const path of [temporaryCore, temporaryFull, receiptPath]) {
      fsyncFile(path);
    }
    fsyncDirectory(stagingDirectory);
    renameSync(stagingDirectory, releaseDirectory);
    fsyncDirectory(dirname(releaseDirectory));
    return {
      deploymentHash: receipt.deploymentHash,
      core: {
        ...verified.core,
        path: join(releaseDirectory, basename(temporaryCore))
      },
      full: {
        ...verified.full,
        path: join(releaseDirectory, basename(temporaryFull))
      }
    };
  } catch (error) {
    rmSync(stagingDirectory, { recursive: true, force: true });
    throw error;
  }
}

function verifyInstalledBilingualRelease(
  options: DeployLexiconV3BilingualCandidatesOptions,
  releaseDirectory: string
): InstalledBilingualRelease {
  assertDirectoryNotSymlink(releaseDirectory, "deployment-release-directory");
  const names = readdirSync(releaseDirectory).sort();
  const expectedNames = [
    "deployment.json",
    "strong_lexicon.fr.core.production.sqlite",
    "strong_lexicon.fr.full.production.sqlite"
  ];
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) {
    throw new Error(
      `deployment-release-directory-content-invalid:${names.join(",")}`
    );
  }
  const corePath = join(releaseDirectory, expectedNames[1]!);
  const fullPath = join(releaseDirectory, expectedNames[2]!);
  for (const [label, path] of [
    ["deployment-receipt", join(releaseDirectory, "deployment.json")],
    ["deployment-core", corePath],
    ["deployment-full", fullPath]
  ] as const) {
    assertRegularFileNotSymlink(path, label);
  }
  const verified = verifyLexiconV3BilingualCandidates({
    ...options,
    coreCandidatePath: corePath,
    fullCandidatePath: fullPath
  });
  assertDeploymentManifestExpectation(options, verified);
  const receiptPath = join(releaseDirectory, "deployment.json");
  let receipt: Record<string, unknown>;
  try {
    receipt = JSON.parse(readFileSync(receiptPath, "utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error("deployment-receipt-json-invalid");
  }
  const { deploymentHash, ...content } = receipt;
  if (
    receipt.schemaVersion !== "lexicon-v3-bilingual-deployment-receipt@1" ||
    receipt.profile !== "bilingual" ||
    receipt.releaseKey !== options.releaseKey ||
    receipt.candidateManifestHash !== options.candidateManifestHash ||
    receipt.sourcePath !== resolve(options.sourcePath) ||
    typeof receipt.deployedAt !== "string" ||
    !Number.isFinite(Date.parse(receipt.deployedAt)) ||
    typeof deploymentHash !== "string" ||
    hashJson(content) !== deploymentHash
  ) {
    throw new Error("deployment-receipt-invalid");
  }
  const core = receipt.core as Record<string, unknown> | undefined;
  const full = receipt.full as Record<string, unknown> | undefined;
  if (
    core?.file !== basename(corePath) ||
    core.sha256 !== verified.core.sha256 ||
    core.logicalFingerprint !== verified.core.logicalFingerprint ||
    full?.file !== basename(fullPath) ||
    full.sha256 !== verified.full.sha256 ||
    full.logicalFingerprint !== verified.full.logicalFingerprint
  ) {
    throw new Error("deployment-receipt-artifacts-invalid");
  }
  return {
    deploymentHash,
    core: { ...verified.core, path: corePath },
    full: { ...verified.full, path: fullPath }
  };
}

function installCurrentDeploymentPointer(
  path: string,
  pointer: Record<string, unknown> & { pointerHash: string }
): string {
  assertDeploymentPointerEnvelope(pointer);
  if (existsSync(path)) {
    assertRegularFileNotSymlink(path, "deployment-current-pointer");
    let current: Record<string, unknown>;
    try {
      current = JSON.parse(readFileSync(path, "utf8")) as Record<
        string,
        unknown
      >;
    } catch {
      throw new Error("deployment-current-pointer-json-invalid");
    }
    assertDeploymentPointerEnvelope(current);
    if (current.deploymentHash === pointer.deploymentHash) {
      for (const key of [
        "schemaVersion",
        "releaseKey",
        "releaseDirectory",
        "deploymentReceipt",
        "deploymentHash",
        "core",
        "full"
      ]) {
        if (JSON.stringify(current[key]) !== JSON.stringify(pointer[key])) {
          throw new Error("deployment-current-pointer-same-release-drift");
        }
      }
      return String(current.pointerHash);
    }
  }
  const temporary = `${path}.tmp-${randomUUID()}`;
  try {
    writeFileSync(temporary, `${JSON.stringify(pointer, null, 2)}\n`, {
      encoding: "utf8",
      flag: "wx"
    });
    fsyncFile(temporary);
    renameSync(temporary, path);
    fsyncDirectory(dirname(path));
    return pointer.pointerHash;
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function assertDeploymentPointerEnvelope(
  pointer: Record<string, unknown>
): void {
  const { pointerHash, ...content } = pointer;
  const core = pointer.core as Record<string, unknown> | undefined;
  const full = pointer.full as Record<string, unknown> | undefined;
  if (
    pointer.schemaVersion !== "lexicon-v3-bilingual-current@1" ||
    typeof pointer.releaseKey !== "string" ||
    typeof pointer.releaseDirectory !== "string" ||
    resolve(pointer.releaseDirectory) !== pointer.releaseDirectory ||
    typeof pointer.deploymentReceipt !== "string" ||
    resolve(pointer.deploymentReceipt) !== pointer.deploymentReceipt ||
    typeof pointer.deploymentHash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(pointer.deploymentHash) ||
    typeof pointerHash !== "string" ||
    hashJson(content) !== pointerHash ||
    !isDeploymentPointerArtifact(core) ||
    !isDeploymentPointerArtifact(full) ||
    !String(pointer.deploymentReceipt).startsWith(
      `${String(pointer.releaseDirectory)}/`
    ) ||
    !String(core.path).startsWith(`${String(pointer.releaseDirectory)}/`) ||
    !String(full.path).startsWith(`${String(pointer.releaseDirectory)}/`)
  ) {
    throw new Error("deployment-current-pointer-invalid");
  }
}

function isDeploymentPointerArtifact(
  value: Record<string, unknown> | undefined
): value is Record<string, unknown> {
  return Boolean(
    value &&
    typeof value.path === "string" &&
    resolve(value.path) === value.path &&
    typeof value.sha256 === "string" &&
    /^[a-f0-9]{64}$/u.test(value.sha256) &&
    typeof value.logicalFingerprint === "string" &&
    /^[a-f0-9]{64}$/u.test(value.logicalFingerprint)
  );
}

function acquireDeploymentLock(path: string, releaseKey: string): () => void {
  let lock: SqliteDatabase | null = null;
  try {
    const existed = existsSync(path);
    if (existed) {
      assertRegularFileNotSymlink(path, "deployment-lock");
    }
    lock = new SqliteDatabase(path);
    lock.exec("PRAGMA busy_timeout = 0;");
    if (!existed) {
      lock.exec(`
        PRAGMA journal_mode = DELETE;
        PRAGMA synchronous = FULL;
        CREATE TABLE DeploymentLockMetadata (
          singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
          format TEXT NOT NULL
        );
        INSERT INTO DeploymentLockMetadata (singleton, format)
        VALUES (1, 'lexicon-v3-sqlite-deployment-lock@1');
      `);
    }
    const tables = [...userSchemaObjects(lock, "table")].sort();
    const metadata = lock
      .prepare(
        "SELECT singleton, format FROM DeploymentLockMetadata ORDER BY singleton"
      )
      .all();
    if (
      firstValue(lock, "PRAGMA integrity_check") !== "ok" ||
      JSON.stringify(tables) !== JSON.stringify(["DeploymentLockMetadata"]) ||
      JSON.stringify(metadata) !==
        JSON.stringify([
          {
            singleton: 1,
            format: "lexicon-v3-sqlite-deployment-lock@1"
          }
        ])
    ) {
      throw new Error("lock-schema-invalid");
    }
    lock.exec(`
      PRAGMA journal_mode = DELETE;
      PRAGMA synchronous = FULL;
    `);
    lock.exec("BEGIN EXCLUSIVE");
    lock
      .prepare(
        "UPDATE DeploymentLockMetadata SET format = format WHERE singleton = 1"
      )
      .run();
  } catch (error) {
    try {
      lock?.close();
    } catch {
      // The original acquisition error remains the authoritative failure.
    }
    const message = error instanceof Error ? error.message : String(error);
    if (/database is locked|SQLITE_BUSY/iu.test(message)) {
      throw new Error(`deployment-locked:${path}:${releaseKey}`);
    }
    throw new Error(`deployment-lock-invalid:${path}:${message}`);
  }
  fsyncDirectory(dirname(path));
  let released = false;
  return () => {
    if (released) return;
    try {
      lock!.exec("ROLLBACK");
    } finally {
      lock!.close();
      released = true;
    }
  };
}

function fsyncFile(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function fsyncDirectory(path: string): void {
  const descriptor = openSync(path, "r");
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
}

function assertSafeVersionedDeploymentPaths(input: {
  authoringPath: string;
  sourcePath: string;
  candidatePaths: string[];
  releaseDirectory: string;
  currentManifestPath: string;
  deploymentLockPath: string;
}): void {
  const files = [
    input.authoringPath,
    input.sourcePath,
    ...input.candidatePaths,
    input.currentManifestPath,
    input.deploymentLockPath
  ].map(comparablePath);
  if (new Set(files).size !== files.length) {
    throw new Error("deployment-input-output-path-collision");
  }
  const releaseDirectory = comparablePath(input.releaseDirectory);
  const currentManifestPath = comparablePath(input.currentManifestPath);
  if (
    files.some(
      (path) =>
        path === releaseDirectory || path.startsWith(`${releaseDirectory}/`)
    ) ||
    currentManifestPath.startsWith(`${releaseDirectory}/`) ||
    releaseDirectory.startsWith(`${currentManifestPath}/`)
  ) {
    throw new Error("deployment-release-directory-path-collision");
  }
  const protectedPaths = [
    "data/dictionaries/strong_lexicon.core.production.sqlite",
    "data/dictionaries/strong_lexicon.full.production.sqlite",
    "data/dictionaries/strong_lexicon.en.core.production.sqlite"
  ].map((path) => comparablePath(resolve(PROJECT_ROOT, path)));
  if (
    [...files, releaseDirectory].some((path) =>
      protectedPaths.includes(comparablePath(path))
    )
  ) {
    throw new Error("protected-production-output-refused");
  }
}

function verifyExistingProductionCandidate(
  path: string,
  profile: "core" | "full",
  snapshot: ReleaseProjectionSnapshot,
  expectedSha256: string,
  expectedLogicalFingerprint: string
): LexiconV3ProductionDatabaseSummary {
  assertRegularFileNotSymlink(path, `${profile}-candidate`);
  assertNoSqliteSidecars(path);
  const actualSha256 = fileSha256(path);
  if (actualSha256 !== expectedSha256) {
    throw new Error(
      `${profile}-candidate-sha256-mismatch:${actualSha256}:${expectedSha256}`
    );
  }
  const db = new SqliteDatabase(path, { readOnly: true });
  let summary: ProjectionVerificationSummary;
  try {
    summary = verifyProjectedDatabase(db, path, profile, snapshot);
  } finally {
    db.close();
  }
  const result = withProductionArtifactDigests(
    path,
    summary,
    snapshot.release.releaseKey
  );
  if (result.sha256 !== expectedSha256) {
    throw new Error(`${profile}-candidate-changed-during-verification`);
  }
  if (result.logicalFingerprint !== expectedLogicalFingerprint) {
    throw new Error(
      `${profile}-candidate-logical-fingerprint-mismatch:${result.logicalFingerprint}:${expectedLogicalFingerprint}`
    );
  }
  return result;
}

function withProductionArtifactDigests(
  path: string,
  summary: ProjectionVerificationSummary,
  releaseKey: string
): LexiconV3ProductionDatabaseSummary {
  const db = new SqliteDatabase(path, { readOnly: true });
  try {
    const logicalFingerprint = hashJson({
      entries: db
        .prepare(
          `SELECT id, language, baseCode, eStrong, dStrong, uStrong,
                  original, transliteration, morph, gloss, meaning,
                  classicTransliteration, pronunciation
           FROM StepEntries ORDER BY id`
        )
        .all(),
      translations: db
        .prepare(
          `SELECT stepEntryId, language, gloss, meaning, meaningHtml
           FROM LexiconTranslations ORDER BY stepEntryId, language`
        )
        .all(),
      fieldStatus: db
        .prepare(
          "SELECT * FROM LexiconFieldStatus ORDER BY stepEntryId, locale, field"
        )
        .all(),
      carriers: db
        .prepare("SELECT * FROM LexiconCarrierTerms ORDER BY id")
        .all(),
      resources: tableExists(db, "LexiconResources")
        ? db.prepare("SELECT * FROM LexiconResources ORDER BY id").all()
        : [],
      resourceTranslations: tableExists(db, "LexiconResourceTranslations")
        ? db
            .prepare(
              `SELECT * FROM LexiconResourceTranslations
               ORDER BY resourceId, language`
            )
            .all()
        : [],
      morphologyCodes: tableExists(db, "MorphologyCodes")
        ? db.prepare("SELECT * FROM MorphologyCodes ORDER BY id").all()
        : [],
      morphologyTranslations: tableExists(db, "MorphologyCodeTranslations")
        ? db
            .prepare(
              `SELECT * FROM MorphologyCodeTranslations
               ORDER BY morphologyCodeId, language`
            )
            .all()
        : [],
      dictionaryMeta: db
        .prepare("SELECT key, value FROM DictionaryMeta ORDER BY key")
        .all()
    });
    const sha256 = createHash("sha256")
      .update(readFileSync(path))
      .digest("hex");
    return { ...summary, releaseKey, sha256, logicalFingerprint };
  } finally {
    db.close();
  }
}

interface ReleaseProjectionField extends FieldVersionRow {
  releaseKey: string;
}

interface ReleaseProjectionEntry extends EntryRow {
  fields: Record<
    `${LexiconLocale}:${LexiconRequiredField}`,
    ReleaseProjectionField
  >;
}

interface ReleaseProjectionSnapshot {
  release: ReleaseRow;
  profile: LexiconV3ReleaseProfile;
  sourceLogicalFingerprint: string;
  entryIdentityFingerprint: string;
  rightsManifest: unknown[];
  entries: ReleaseProjectionEntry[];
  carriers: CarrierRow[];
}

function bilingualReleaseIdentity(
  snapshot: ReleaseProjectionSnapshot
): LexiconV3BilingualReleaseIdentity {
  const manifest = JSON.parse(snapshot.release.manifestJson) as ReleaseManifest;
  if (
    snapshot.profile !== "bilingual" ||
    !manifest.snapshotFingerprint ||
    !manifest.rightsManifestDigest
  ) {
    throw new Error("bilingual-release-identity-unavailable");
  }
  return {
    releaseKey: snapshot.release.releaseKey,
    sourceFingerprint: snapshot.release.sourceFingerprint,
    sourceLogicalFingerprint: snapshot.sourceLogicalFingerprint,
    entryIdentityFingerprint: snapshot.entryIdentityFingerprint,
    codeFingerprint: snapshot.release.codeFingerprint,
    policyVersion: snapshot.release.policyVersion,
    snapshotFingerprint: manifest.snapshotFingerprint,
    rightsManifestDigest: manifest.rightsManifestDigest,
    releaseProfile: "bilingual"
  };
}

function readProjectionSnapshot(
  db: DatabaseSync,
  release: ReleaseRow
): ReleaseProjectionSnapshot {
  const manifestErrors: string[] = [];
  const manifest = validateReleaseManifest(release, manifestErrors);
  if (!manifest || manifestErrors.length > 0) {
    throw new LexiconV3ReleaseError(
      "invalid-sealed-release-manifest",
      manifestErrors
    );
  }
  const rightsManifest = manifest.rightsManifest;
  const sourceLogicalFingerprint = manifest.sourceLogicalFingerprint;
  if (!sourceLogicalFingerprint) {
    throw new Error("missing-sealed-source-logical-fingerprint");
  }
  const entries = readAuthoringEntries(db);
  const currentEntryIdentityFingerprint = fingerprintEntryIdentities(entries);
  if (
    manifest.releaseProfile === "core-en" &&
    !manifest.entryIdentityFingerprint
  ) {
    throw new Error("missing-sealed-entry-identity-fingerprint");
  }
  if (
    manifest.entryIdentityFingerprint &&
    manifest.entryIdentityFingerprint !== currentEntryIdentityFingerprint
  ) {
    throw new Error("release-entry-identity-fingerprint-mismatch");
  }
  const entryIdentityFingerprint =
    manifest.entryIdentityFingerprint ?? currentEntryIdentityFingerprint;
  for (const entry of entries) {
    if (entry.stepEntryId === null) {
      throw new Error(`projection-missing-entry-id:${entry.entryKey}`);
    }
  }
  const fields = readReleaseFields(db, release.id);
  const byEntry = new Map<string, FieldVersionRow[]>();
  for (const field of fields) {
    const values = byEntry.get(field.entryKey) ?? [];
    values.push(field);
    byEntry.set(field.entryKey, values);
  }
  const projectedEntries = entries.map((entry) => {
    const record = {} as Record<
      `${LexiconLocale}:${LexiconRequiredField}`,
      ReleaseProjectionField
    >;
    for (const field of byEntry.get(entry.entryKey) ?? []) {
      record[`${field.locale}:${field.field}`] = {
        ...field,
        releaseKey: release.releaseKey
      };
    }
    const requiredKeys =
      manifest.releaseProfile === "core-en"
        ? (["en:gloss", "en:meaning"] as const)
        : (["en:gloss", "en:meaning", "fr:gloss", "fr:meaning"] as const);
    for (const key of requiredKeys) {
      if (!record[key]) {
        throw new Error(`projection-missing-field:${entry.entryKey}:${key}`);
      }
    }
    return { ...entry, fields: record };
  });
  const carriers = db
    .prepare(
      `SELECT term.id, term.entryKey, term.strong, term.stepStrong, term.locale,
              term.surface, term.normalized, term.termKind, term.state,
              term.policy, term.confidence, term.derivedFromVersionId,
              term.contentHash
       FROM LexiconReleaseCarriers releaseCarrier
       JOIN LexiconCarrierTerms term ON term.id = releaseCarrier.carrierTermId
       WHERE releaseCarrier.releaseId = ?
       ORDER BY term.id`
    )
    .all(release.id) as unknown as CarrierRow[];
  return {
    release,
    profile: manifest.releaseProfile,
    sourceLogicalFingerprint,
    entryIdentityFingerprint,
    rightsManifest,
    entries: projectedEntries,
    carriers
  };
}

function projectProductionDatabase(
  path: string,
  profile: LexiconV3ProductionProfile,
  snapshot: ReleaseProjectionSnapshot
): ProjectionVerificationSummary {
  if (
    (profile === "core-en" && snapshot.profile !== "core-en") ||
    (profile !== "core-en" && snapshot.profile !== "bilingual")
  ) {
    throw new Error(
      `projection-profile-mismatch:${snapshot.profile}:${profile}`
    );
  }
  const db = new SqliteDatabase(path);
  const purgeCanary = `LEXICON_V3_PHYSICAL_PURGE_CANARY_${randomUUID()}_${randomUUID()}`;
  let summary: ProjectionVerificationSummary | undefined;
  try {
    // Projection happens only in an unpublished temporary copy. Keep the
    // rollback journal in memory so it cannot retain a copy of the legacy
    // STEP payload on disk, and make every overwritten/deleted cell secure.
    db.exec(`
      PRAGMA journal_mode = MEMORY;
      PRAGMA secure_delete = ON;
      PRAGMA foreign_keys = OFF;
    `);
    if (firstValue(db, "PRAGMA journal_mode") !== "memory") {
      throw new Error("production-journal-mode-not-memory");
    }
    if (firstValue(db, "PRAGMA secure_delete") !== "1") {
      throw new Error("production-secure-delete-disabled");
    }
    requireTable(db, "StepEntries");
    requireTable(db, "LexiconTranslations");
    requireTable(db, "DictionaryMeta");
    if (profile === "full") {
      requireTable(db, "LexiconResources");
      requireTable(db, "LexiconResourceTranslations");
    }
    assertSupportedSourceDatabaseSchema(db, profile);
    const sourceLogicalFingerprint = lexiconV3SourceLogicalFingerprint(db);
    if (sourceLogicalFingerprint !== snapshot.sourceLogicalFingerprint) {
      throw new Error("source-logical-fingerprint-mismatch");
    }

    const sourceEntries = db
      .prepare("SELECT id FROM StepEntries ORDER BY id")
      .all() as unknown as Array<{ id: number }>;
    if (sourceEntries.length !== snapshot.release.expectedEntryCount) {
      throw new Error(
        `source-entry-count-mismatch:${sourceEntries.length}:${snapshot.release.expectedEntryCount}`
      );
    }
    const sourceIds = new Set(sourceEntries.map((entry) => entry.id));
    const stepIdByEntry = new Map<string, number>();
    for (const entry of snapshot.entries) {
      const stepEntryId = entry.stepEntryId;
      if (stepEntryId === null || !sourceIds.has(stepEntryId)) {
        throw new Error(
          `source-entry-id-mismatch:${entry.entryKey}:${String(stepEntryId)}`
        );
      }
      stepIdByEntry.set(entry.entryKey, stepEntryId);
    }

    db.exec("BEGIN IMMEDIATE");
    try {
      // A build-specific canary first replaces every legacy English meaning.
      // The validated projection immediately replaces it below. Its byte-level
      // absence after VACUUM proves that the final artifact is not merely
      // hiding superseded content behind SQL-visible rows.
      const canaryResult = db
        .prepare("UPDATE StepEntries SET meaning = ?")
        .run(purgeCanary);
      if (Number(canaryResult.changes) !== sourceEntries.length) {
        throw new Error(
          `production-purge-canary-count:${Number(canaryResult.changes)}:${sourceEntries.length}`
        );
      }
      // Legacy resource and morphology translations were not selected by the
      // sealed V3 release. No production profile may inherit them merely
      // because they happened to exist in the source database.
      if (tableExists(db, "LexiconResourceTranslations")) {
        db.exec("DELETE FROM LexiconResourceTranslations;");
      }
      if (tableExists(db, "MorphologyCodeTranslations")) {
        db.exec("DELETE FROM MorphologyCodeTranslations;");
      }
      db.exec(`
        DELETE FROM DictionaryMeta
        WHERE key = 'morphologyTranslations'
           OR key GLOB 'lexiconV3*';
      `);
      if (profile !== "full") {
        db.exec(`
          DROP TABLE IF EXISTS LexiconResourceTranslations;
          DROP TABLE IF EXISTS LexiconResources;
        `);
      }
      if (profile === "core-en") {
        db.exec("DELETE FROM LexiconTranslations;");
        db.exec(`
          DELETE FROM DictionaryMeta
          WHERE key IN (
            'hardenedAt', 'hardenedProfile',
            'productionGeneratedAt', 'productionProfile'
          );
        `);
      }
      db.exec(`
        DROP TABLE IF EXISTS LexiconFieldStatus;
        DROP TABLE IF EXISTS LexiconCarrierTerms;
        CREATE TABLE LexiconFieldStatus (
          stepEntryId INTEGER NOT NULL,
          locale TEXT NOT NULL CHECK(locale IN ('en', 'fr')),
          field TEXT NOT NULL CHECK(field IN ('gloss', 'meaning')),
          fieldVersionId INTEGER NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('auto_validated', 'human_validated')),
          confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
          method TEXT NOT NULL,
          generator TEXT NOT NULL,
          contentHash TEXT NOT NULL,
          derivedFromVersionId INTEGER,
          releaseKey TEXT NOT NULL,
          PRIMARY KEY(stepEntryId, locale, field),
          FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
        ) WITHOUT ROWID;
        CREATE INDEX idx_LexiconFieldStatus_release
          ON LexiconFieldStatus(releaseKey, locale, field);

        CREATE TABLE LexiconCarrierTerms (
          id INTEGER PRIMARY KEY,
          stepEntryId INTEGER NOT NULL,
          strong TEXT NOT NULL,
          stepStrong TEXT NOT NULL DEFAULT '',
          locale TEXT NOT NULL CHECK(locale IN ('en', 'fr')),
          surface TEXT NOT NULL,
          normalized TEXT NOT NULL,
          termKind TEXT NOT NULL,
          state TEXT NOT NULL CHECK(state IN ('auto_validated', 'human_validated')),
          policy TEXT NOT NULL CHECK(policy IN ('auto_safe', 'review_only')),
          confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
          derivedFromVersionId INTEGER,
          contentHash TEXT NOT NULL,
          releaseKey TEXT NOT NULL,
          FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
        );
        CREATE INDEX idx_LexiconCarrierTerms_lookup
          ON LexiconCarrierTerms(locale, strong, stepStrong, normalized);
      `);

      const updateEnglish = db.prepare(
        `UPDATE StepEntries
         SET language = ?, baseCode = ?, eStrong = ?, dStrong = ?, uStrong = ?,
             original = ?, transliteration = ?, morph = ?,
             classicTransliteration = ?, pronunciation = ?,
             gloss = ?, meaning = ?
         WHERE id = ?`
      );
      const updateFrench =
        profile === "core-en" ? null : prepareFrenchTranslationUpdate(db);
      const insertFrench =
        profile === "core-en" ? null : prepareFrenchTranslationInsert(db);
      const insertStatus = db.prepare(
        `INSERT INTO LexiconFieldStatus (
           stepEntryId, locale, field, fieldVersionId, state, confidence,
           method, generator, contentHash, derivedFromVersionId, releaseKey
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const entry of snapshot.entries) {
        const stepEntryId = requiredMapValue(stepIdByEntry, entry.entryKey);
        const enGloss = entry.fields["en:gloss"];
        const enMeaning = entry.fields["en:meaning"];
        const englishResult = updateEnglish.run(
          entry.language,
          entry.baseCode,
          entry.eStrong,
          entry.dStrong,
          entry.uStrong,
          entry.original,
          entry.transliteration,
          entry.morph,
          entry.classicTransliteration,
          entry.pronunciation,
          enGloss.valueText,
          enMeaning.valueHtml ?? enMeaning.valueText,
          stepEntryId
        );
        if (Number(englishResult.changes) !== 1) {
          throw new Error(
            `projection-entry-update-count:${entry.entryKey}:${Number(englishResult.changes)}`
          );
        }
        const selectedFields: ReleaseProjectionField[] = [enGloss, enMeaning];
        if (profile !== "core-en") {
          const frGloss = entry.fields["fr:gloss"];
          const frMeaning = entry.fields["fr:meaning"];
          const frenchResult = updateFrench!.run(
            frGloss.valueText,
            frMeaning.valueText,
            frMeaning.valueHtml ?? frMeaning.valueText,
            stepEntryId
          );
          if (Number(frenchResult.changes) === 0) {
            insertFrench!.run(
              stepEntryId,
              frGloss.valueText,
              frMeaning.valueText,
              frMeaning.valueHtml ?? frMeaning.valueText
            );
          }
          selectedFields.push(frGloss, frMeaning);
        }
        for (const field of selectedFields) {
          insertStatus.run(
            stepEntryId,
            field.locale,
            field.field,
            field.id,
            field.state,
            field.confidence,
            field.method,
            field.generator,
            field.contentHash,
            field.derivedFromVersionId,
            snapshot.release.releaseKey
          );
        }
      }

      const insertCarrier = db.prepare(
        `INSERT INTO LexiconCarrierTerms (
           id, stepEntryId, strong, stepStrong, locale, surface, normalized,
           termKind, state, policy, confidence, derivedFromVersionId,
           contentHash, releaseKey
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      );
      for (const carrier of snapshot.carriers) {
        insertCarrier.run(
          carrier.id,
          requiredMapValue(stepIdByEntry, carrier.entryKey),
          carrier.strong,
          carrier.stepStrong,
          carrier.locale,
          carrier.surface,
          carrier.normalized,
          carrier.termKind,
          carrier.state,
          carrier.policy,
          carrier.confidence,
          carrier.derivedFromVersionId,
          carrier.contentHash,
          snapshot.release.releaseKey
        );
      }

      const upsertMeta = db.prepare(
        `INSERT INTO DictionaryMeta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`
      );
      upsertMeta.run("lexiconV3ReleaseKey", snapshot.release.releaseKey);
      upsertMeta.run(
        "lexiconV3SourceFingerprint",
        snapshot.release.sourceFingerprint
      );
      // This remains the fingerprint of the untouched source copy measured
      // before authoring identity fields are projected into StepEntries.
      upsertMeta.run(
        "lexiconV3SourceLogicalFingerprint",
        snapshot.sourceLogicalFingerprint
      );
      upsertMeta.run(
        "lexiconV3EntryIdentityFingerprint",
        snapshot.entryIdentityFingerprint
      );
      upsertMeta.run(
        "lexiconV3CodeFingerprint",
        snapshot.release.codeFingerprint
      );
      upsertMeta.run("lexiconV3PolicyVersion", snapshot.release.policyVersion);
      upsertMeta.run("lexiconV3Profile", profile);
      upsertMeta.run("lexiconV3ReleaseProfile", snapshot.profile);
      if (profile === "core-en") {
        upsertMeta.run("productionProfile", "strong-lexicon-core-en-v3");
      }
      upsertMeta.run("lexiconV3ResourceTranslationStatus", "excluded");
      upsertMeta.run("lexiconV3MorphologyTranslationStatus", "excluded");
      upsertMeta.run(
        "lexiconV3TranslationStatus",
        profile === "core-en" ? "excluded" : "validated-fr"
      );
      upsertMeta.run(
        "lexiconV3PhysicalSanitization",
        "secure-delete+memory-journal+vacuum"
      );
      const releaseManifest = JSON.parse(snapshot.release.manifestJson) as {
        snapshotFingerprint?: string;
      };
      if (!releaseManifest.snapshotFingerprint) {
        throw new Error("missing-release-snapshot-fingerprint");
      }
      upsertMeta.run(
        "lexiconV3SnapshotFingerprint",
        releaseManifest.snapshotFingerprint
      );
      const rightsManifestJson = JSON.stringify(snapshot.rightsManifest);
      upsertMeta.run("lexiconV3RightsManifest", rightsManifestJson);
      upsertMeta.run(
        "lexiconV3RightsManifestDigest",
        createHash("sha256").update(rightsManifestJson).digest("hex")
      );
      db.exec("COMMIT");
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
    // VACUUM rebuilds both profiles solely from live rows. Running it before
    // verification makes the release gate cover the compacted artifact that
    // will actually be published, including the full profile.
    db.exec(`
      PRAGMA foreign_keys = ON;
      VACUUM;
      PRAGMA journal_mode = DELETE;
    `);
    summary = verifyProjectedDatabase(db, path, profile, snapshot);
  } finally {
    db.close();
  }
  if (!summary) throw new Error("production-verification-summary-missing");
  assertNoSqliteSidecars(path);
  assertSqliteOmitsTextBytes(path, purgeCanary);
  return summary;
}

function verifyProjectedDatabase(
  db: DatabaseSync,
  path: string,
  profile: LexiconV3ProductionProfile,
  snapshot: ReleaseProjectionSnapshot
): ProjectionVerificationSummary {
  const integrity = firstValue(db, "PRAGMA integrity_check");
  const foreignKeyViolations = db
    .prepare("PRAGMA foreign_key_check")
    .all().length;
  const freelistPages = Number(firstValue(db, "PRAGMA freelist_count"));
  const stepEntries = readCount(
    db,
    "SELECT count(*) AS count FROM StepEntries"
  );
  const translationRows = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconTranslations"
  );
  const frenchTranslations = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconTranslations WHERE language = 'fr'"
  );
  const fieldStatuses = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconFieldStatus"
  );
  const carrierTerms = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconCarrierTerms"
  );
  const hasResources = tableExists(db, "LexiconResources");
  const resourceRows = hasResources
    ? readCount(db, "SELECT count(*) AS count FROM LexiconResources")
    : null;
  const resourceTranslationRows = tableExists(db, "LexiconResourceTranslations")
    ? readCount(db, "SELECT count(*) AS count FROM LexiconResourceTranslations")
    : null;
  const morphologyTranslationRows = tableExists(
    db,
    "MorphologyCodeTranslations"
  )
    ? readCount(db, "SELECT count(*) AS count FROM MorphologyCodeTranslations")
    : null;
  const errors: string[] = [];
  validateProjectedDatabaseSchema(db, profile, errors);
  if (integrity !== "ok") errors.push(`integrity:${integrity}`);
  if (foreignKeyViolations !== 0) {
    errors.push(`foreign-key-violations:${foreignKeyViolations}`);
  }
  if (freelistPages !== 0) errors.push(`freelist-pages:${freelistPages}`);
  if (firstValue(db, "PRAGMA journal_mode") !== "delete") {
    errors.push("journal-mode-not-delete");
  }
  if (stepEntries !== snapshot.release.expectedEntryCount) {
    errors.push(`step-entry-count:${stepEntries}`);
  }
  const expectedFrenchTranslations =
    profile === "core-en" ? 0 : snapshot.release.expectedEntryCount;
  if (frenchTranslations !== expectedFrenchTranslations) {
    errors.push(`french-translation-count:${frenchTranslations}`);
  }
  if (translationRows !== expectedFrenchTranslations) {
    errors.push(
      `translation-row-count:${translationRows}:${expectedFrenchTranslations}`
    );
  }
  const unexpectedTranslationRows = readCount(
    db,
    "SELECT count(*) AS count FROM LexiconTranslations WHERE language <> 'fr'"
  );
  if (unexpectedTranslationRows !== 0) {
    errors.push(
      `unexpected-translation-language-rows:${unexpectedTranslationRows}`
    );
  }
  if (
    fieldStatuses !==
    snapshot.release.expectedEntryCount *
      requiredFieldMultiplier(snapshot.profile)
  ) {
    errors.push(`field-status-count:${fieldStatuses}`);
  }
  if (carrierTerms !== snapshot.carriers.length) {
    errors.push(`carrier-count:${carrierTerms}:${snapshot.carriers.length}`);
  }
  if (profile !== "full" && hasResources)
    errors.push(`${profile}-has-resources`);
  if (profile === "full" && !hasResources)
    errors.push("full-missing-resources");
  if (profile === "core-en" && resourceTranslationRows !== null) {
    errors.push("core-en-has-resource-translations");
  }
  if (resourceTranslationRows !== null && resourceTranslationRows !== 0) {
    errors.push(`resource-translation-rows:${resourceTranslationRows}:0`);
  }
  if (morphologyTranslationRows !== null && morphologyTranslationRows !== 0) {
    errors.push(`morphology-translation-rows:${morphologyTranslationRows}:0`);
  }
  if (profile === "core-en") {
    const frenchFieldStatuses = readCount(
      db,
      "SELECT count(*) AS count FROM LexiconFieldStatus WHERE locale = 'fr'"
    );
    if (frenchFieldStatuses !== 0) {
      errors.push(`core-en-french-field-statuses:${frenchFieldStatuses}`);
    }
  }

  const actualFieldStatuses = db
    .prepare(
      `SELECT stepEntryId, locale, field, fieldVersionId, state, confidence,
              method, generator, contentHash, derivedFromVersionId, releaseKey
       FROM LexiconFieldStatus
       ORDER BY stepEntryId, locale, field`
    )
    .all()
    .map((row) => ({ ...row }));
  const requiredFieldKeys =
    profile === "core-en"
      ? (["en:gloss", "en:meaning"] as const)
      : (["en:gloss", "en:meaning", "fr:gloss", "fr:meaning"] as const);
  const expectedFieldStatuses = snapshot.entries
    .flatMap((entry) =>
      requiredFieldKeys.map((key) => {
        const field = entry.fields[key];
        return {
          stepEntryId: entry.stepEntryId,
          locale: field.locale,
          field: field.field,
          fieldVersionId: field.id,
          state: field.state,
          confidence: field.confidence,
          method: field.method,
          generator: field.generator,
          contentHash: field.contentHash,
          derivedFromVersionId: field.derivedFromVersionId,
          releaseKey: snapshot.release.releaseKey
        };
      })
    )
    .sort(
      (left, right) =>
        Number(left.stepEntryId) - Number(right.stepEntryId) ||
        left.locale.localeCompare(right.locale) ||
        left.field.localeCompare(right.field)
    );
  if (
    JSON.stringify(actualFieldStatuses) !==
    JSON.stringify(expectedFieldStatuses)
  ) {
    errors.push("projection-field-status-mismatch");
  }

  const actualCarrierTerms = db
    .prepare(
      `SELECT id, stepEntryId, strong, stepStrong, locale, surface, normalized,
              termKind, state, policy, confidence, derivedFromVersionId,
              contentHash, releaseKey
       FROM LexiconCarrierTerms
       ORDER BY id`
    )
    .all()
    .map((row) => ({ ...row }));
  const stepIdByEntryKey = new Map(
    snapshot.entries.map((entry) => [entry.entryKey, entry.stepEntryId])
  );
  const expectedCarrierTerms = snapshot.carriers.map((carrier) => ({
    id: carrier.id,
    stepEntryId: requiredMapValue(stepIdByEntryKey, carrier.entryKey),
    strong: carrier.strong,
    stepStrong: carrier.stepStrong,
    locale: carrier.locale,
    surface: carrier.surface,
    normalized: carrier.normalized,
    termKind: carrier.termKind,
    state: carrier.state,
    policy: carrier.policy,
    confidence: carrier.confidence,
    derivedFromVersionId: carrier.derivedFromVersionId,
    contentHash: carrier.contentHash,
    releaseKey: snapshot.release.releaseKey
  }));
  if (
    JSON.stringify(actualCarrierTerms) !== JSON.stringify(expectedCarrierTerms)
  ) {
    errors.push("projection-carrier-terms-mismatch");
  }

  const projected = db
    .prepare(
      `SELECT se.id AS stepEntryId, se.language, se.baseCode,
              se.eStrong, se.dStrong, se.uStrong, se.original,
              se.transliteration, se.morph, se.classicTransliteration,
              se.pronunciation,
              se.gloss AS enGloss, se.meaning AS enMeaning,
              fr.gloss AS frGloss, fr.meaning AS frMeaning,
              fr.meaningHtml AS frMeaningHtml
       FROM StepEntries se
       LEFT JOIN LexiconTranslations fr
         ON fr.stepEntryId = se.id AND fr.language = 'fr'`
    )
    .all() as unknown as Array<{
    stepEntryId: number;
    language: string;
    baseCode: number;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
    classicTransliteration: string;
    pronunciation: string;
    enGloss: string;
    enMeaning: string;
    frGloss: string | null;
    frMeaning: string | null;
    frMeaningHtml: string | null;
  }>;
  const expectedByStepId = new Map(
    snapshot.entries.map((entry) => [entry.stepEntryId, entry])
  );
  for (const row of projected) {
    const expected = expectedByStepId.get(row.stepEntryId);
    if (!expected) {
      errors.push(`unexpected-source-entry:${row.stepEntryId}`);
      continue;
    }
    if (
      row.language !== expected.language ||
      row.baseCode !== expected.baseCode ||
      row.eStrong !== expected.eStrong ||
      row.dStrong !== expected.dStrong ||
      row.uStrong !== expected.uStrong ||
      row.original !== expected.original ||
      row.transliteration !== expected.transliteration ||
      row.morph !== expected.morph ||
      row.classicTransliteration !== expected.classicTransliteration ||
      row.pronunciation !== expected.pronunciation
    ) {
      errors.push(`projection-identity-mismatch:${expected.entryKey}`);
    }
    if (
      row.enGloss !== expected.fields["en:gloss"].valueText ||
      row.enMeaning !==
        (expected.fields["en:meaning"].valueHtml ??
          expected.fields["en:meaning"].valueText) ||
      (profile === "core-en"
        ? row.frGloss !== null ||
          row.frMeaning !== null ||
          row.frMeaningHtml !== null
        : row.frGloss !== expected.fields["fr:gloss"].valueText ||
          row.frMeaning !== expected.fields["fr:meaning"].valueText ||
          row.frMeaningHtml !==
            (expected.fields["fr:meaning"].valueHtml ??
              expected.fields["fr:meaning"].valueText))
    ) {
      errors.push(`projection-content-mismatch:${expected.entryKey}`);
    }
  }
  const releaseManifest = JSON.parse(snapshot.release.manifestJson) as {
    snapshotFingerprint?: string;
  };
  if (!releaseManifest.snapshotFingerprint) {
    errors.push("projection-missing-snapshot-fingerprint");
  }
  const rightsManifestJson = JSON.stringify(snapshot.rightsManifest);
  const expectedLexiconV3Meta = [
    {
      key: "lexiconV3CodeFingerprint",
      value: snapshot.release.codeFingerprint
    },
    {
      key: "lexiconV3EntryIdentityFingerprint",
      value: snapshot.entryIdentityFingerprint
    },
    { key: "lexiconV3MorphologyTranslationStatus", value: "excluded" },
    {
      key: "lexiconV3PhysicalSanitization",
      value: "secure-delete+memory-journal+vacuum"
    },
    { key: "lexiconV3PolicyVersion", value: snapshot.release.policyVersion },
    { key: "lexiconV3Profile", value: profile },
    { key: "lexiconV3ReleaseKey", value: snapshot.release.releaseKey },
    { key: "lexiconV3ReleaseProfile", value: snapshot.profile },
    { key: "lexiconV3ResourceTranslationStatus", value: "excluded" },
    { key: "lexiconV3RightsManifest", value: rightsManifestJson },
    {
      key: "lexiconV3RightsManifestDigest",
      value: createHash("sha256").update(rightsManifestJson).digest("hex")
    },
    {
      key: "lexiconV3SnapshotFingerprint",
      value: releaseManifest.snapshotFingerprint ?? ""
    },
    {
      key: "lexiconV3SourceFingerprint",
      value: snapshot.release.sourceFingerprint
    },
    {
      key: "lexiconV3SourceLogicalFingerprint",
      value: snapshot.sourceLogicalFingerprint
    },
    {
      key: "lexiconV3TranslationStatus",
      value: profile === "core-en" ? "excluded" : "validated-fr"
    }
  ].sort((left, right) => left.key.localeCompare(right.key));
  const actualLexiconV3Meta = (
    db
      .prepare(
        `SELECT key, value FROM DictionaryMeta
         WHERE key GLOB 'lexiconV3*'
         ORDER BY key`
      )
      .all() as unknown as Array<{ key: string; value: string }>
  ).map((row) => ({ ...row }));
  if (
    JSON.stringify(actualLexiconV3Meta) !==
    JSON.stringify(expectedLexiconV3Meta)
  ) {
    errors.push("projection-lexicon-v3-meta-mismatch");
  }
  if (errors.length > 0) {
    throw new LexiconV3ReleaseError("production-verification-failed", errors);
  }
  return {
    path,
    profile,
    integrity,
    foreignKeyViolations,
    freelistPages,
    stepEntries,
    translationRows,
    frenchTranslations,
    fieldStatuses,
    carrierTerms,
    resourceRows,
    resourceTranslationRows,
    morphologyTranslationRows
  };
}

function selectReleaseCarriers(
  db: DatabaseSync,
  fields: FieldVersionRow[]
): CarrierRow[] {
  const selectedGlosses = new Set(
    fields.filter((field) => field.field === "gloss").map((field) => field.id)
  );
  const rows = db
    .prepare(
      `SELECT term.id, term.entryKey, term.strong, term.stepStrong, term.locale,
              term.surface, term.normalized, term.termKind, term.state,
              term.policy, term.confidence, term.derivedFromVersionId,
              term.contentHash
       FROM LexiconCarrierTerms term
       WHERE term.policy <> 'blocked'
         AND (
           term.state = 'human_validated'
           OR (term.state = 'auto_validated' AND term.policy = 'auto_safe')
         )
         AND EXISTS (
           SELECT 1 FROM LexiconCarrierEvidence evidence
           JOIN LexiconSources source ON source.id = evidence.sourceId
           WHERE evidence.carrierTermId = term.id
             AND evidence.stance = 'supports'
             AND source.allowCarrier = 1
             AND source.rightsStatus = 'cleared'
         )
       ORDER BY term.id`
    )
    .all() as unknown as CarrierRow[];
  return rows.filter(
    (row) =>
      row.derivedFromVersionId === null ||
      selectedGlosses.has(row.derivedFromVersionId)
  );
}

function validateOpenBlockers(
  db: DatabaseSync,
  profile: LexiconV3ReleaseProfile,
  fields: FieldVersionRow[],
  errors: string[]
): void {
  const selectedIds = new Set(fields.map((field) => field.id));
  const selectedEntries = new Set(fields.map((field) => field.entryKey));
  const rows = db
    .prepare(
      `SELECT id, entryKey, fieldVersionId, code, severity
       FROM LexiconIssues
       WHERE severity IN ('blocker', 'warning') AND status = 'open'
       ORDER BY entryKey, id`
    )
    .all() as unknown as Array<{
    id: number;
    entryKey: string;
    fieldVersionId: number | null;
    code: string;
    severity: "blocker" | "warning";
  }>;
  for (const row of rows) {
    if (profile === "bilingual") {
      errors.push(`open-${row.severity}:${row.entryKey}:${row.code}:${row.id}`);
      continue;
    }
    if (!selectedEntries.has(row.entryKey)) continue;
    if (row.fieldVersionId !== null && !selectedIds.has(row.fieldVersionId)) {
      continue;
    }
    errors.push(`open-${row.severity}:${row.entryKey}:${row.code}:${row.id}`);
  }
}

function validateHumanFieldReviews(
  db: DatabaseSync,
  fields: FieldVersionRow[],
  errors: string[]
): void {
  const accepted = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT fieldVersionId
           FROM LexiconFieldReviews
           WHERE reviewerType = 'human' AND verdict = 'accept'`
        )
        .all() as unknown as Array<{ fieldVersionId: number }>
    ).map((row) => row.fieldVersionId)
  );
  for (const field of fields) {
    if (field.state === "human_validated" && !accepted.has(field.id)) {
      errors.push(
        `missing-human-accept-review:${field.entryKey}:${field.locale}:${field.field}`
      );
    }
  }
}

function validateRequiredSupportingEvidence(
  db: DatabaseSync,
  fields: FieldVersionRow[],
  selectedIds: Set<number>,
  errors: string[]
): void {
  const rows = db
    .prepare(
      `SELECT evidence.fieldVersionId, evidence.evidenceKind,
              assertion.entryKey AS assertionEntryKey,
              assertion.field AS assertionField,
              assertion.locale AS assertionLocale,
              source.sourceKey, source.rightsStatus, source.allowDisplay,
              source.allowTranslation
       FROM LexiconFieldEvidence evidence
       JOIN LexiconSourceAssertions assertion
         ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE evidence.stance = 'supports'
       ORDER BY evidence.fieldVersionId, source.sourceKey`
    )
    .all() as unknown as SupportingEvidenceRow[];
  const evidenceByVersion = new Map<number, SupportingEvidenceRow[]>();
  for (const row of rows) {
    if (!selectedIds.has(row.fieldVersionId)) continue;
    const values = evidenceByVersion.get(row.fieldVersionId) ?? [];
    values.push(row);
    evidenceByVersion.set(row.fieldVersionId, values);
  }

  for (const field of fields) {
    const admissible = (evidenceByVersion.get(field.id) ?? []).some((row) => {
      if (
        row.assertionEntryKey !== field.entryKey ||
        row.assertionField !== field.field ||
        row.rightsStatus !== "cleared" ||
        row.allowDisplay !== 1
      ) {
        return false;
      }
      if (field.locale === "en") {
        return (
          (row.assertionLocale === "en" || row.assertionLocale === "mul") &&
          row.allowTranslation === 1
        );
      }
      return (
        (row.assertionLocale === "fr" || row.assertionLocale === "mul") &&
        (row.evidenceKind === "review" || row.evidenceKind === "validator")
      );
    });
    if (!admissible) {
      errors.push(
        `missing-admissible-support-evidence:${field.entryKey}:${field.locale}:${field.field}`
      );
    }
  }
}

function validateFrenchInternalReviewProvenance(
  db: DatabaseSync,
  fields: FieldVersionRow[],
  errors: string[]
): void {
  const automaticFrench = fields.filter(
    (field) => field.locale === "fr" && field.state === "auto_validated"
  );
  if (automaticFrench.length === 0) return;
  const rows = db
    .prepare(
      `SELECT evidence.fieldVersionId, evidence.witnessFamily,
              evidence.detailsJson
       FROM LexiconFieldEvidence evidence
       WHERE evidence.fieldVersionId IN (
         SELECT id FROM LexiconFieldVersions
         WHERE locale = 'fr' AND state = 'auto_validated'
       )
         AND evidence.evidenceKind = 'review'
         AND evidence.stance = 'supports'
       ORDER BY evidence.fieldVersionId, evidence.id`
    )
    .all() as unknown as Array<{
    fieldVersionId: number;
    witnessFamily: string;
    detailsJson: string;
  }>;
  const rowsByField = new Map<number, typeof rows>();
  for (const row of rows) {
    const values = rowsByField.get(row.fieldVersionId) ?? [];
    values.push(row);
    rowsByField.set(row.fieldVersionId, values);
  }
  for (const field of automaticFrench) {
    const valid = (rowsByField.get(field.id) ?? []).some((row) => {
      if (row.witnessFamily !== "lexicon-v3-french-internal-review") {
        return false;
      }
      let details: unknown;
      try {
        details = JSON.parse(row.detailsJson) as unknown;
      } catch {
        return false;
      }
      if (!details || typeof details !== "object" || Array.isArray(details)) {
        return false;
      }
      const value = details as Record<string, unknown>;
      if (
        value.reviewSchemaVersion !== "lexicon-v3-french-review@4" ||
        value.reviewMode !== "internal_agents" ||
        value.policyVersion !== "lexicon-v3-french-internal-review-policy@1" ||
        typeof value.artifactHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.artifactHash) ||
        typeof value.generationConfigHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.generationConfigHash) ||
        typeof value.executionAttestationHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.executionAttestationHash) ||
        typeof value.executionReceiptsDigest !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.executionReceiptsDigest) ||
        typeof value.adjudicationSummaryHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.adjudicationSummaryHash) ||
        typeof value.siblingConsistencyProofHash !== "string" ||
        !/^[a-f0-9]{64}$/u.test(value.siblingConsistencyProofHash)
      ) {
        return false;
      }
      const proofs = value.agentProofHashes;
      const receipts = value.executionReceiptHashes;
      if (
        !proofs ||
        typeof proofs !== "object" ||
        Array.isArray(proofs) ||
        !receipts ||
        typeof receipts !== "object" ||
        Array.isArray(receipts)
      ) {
        return false;
      }
      const proofRecord = proofs as Record<string, unknown>;
      const receiptRecord = receipts as Record<string, unknown>;
      return ["proposerA", "proposerB", "arbiter", "auditor"].every(
        (role) =>
          typeof proofRecord[role] === "string" &&
          /^[a-f0-9]{64}$/u.test(proofRecord[role]) &&
          typeof receiptRecord[role] === "string" &&
          /^[a-f0-9]{64}$/u.test(receiptRecord[role])
      );
    });
    if (!valid) {
      errors.push(
        `missing-french-internal-review-provenance:${field.entryKey}:${field.field}`
      );
    }
  }
}

function validateAutomaticConfidence(
  fields: FieldVersionRow[],
  errors: string[]
): void {
  for (const field of fields) {
    if (
      field.state === "auto_validated" &&
      field.confidence < LEXICON_V3_AUTO_VALIDATED_MIN_CONFIDENCE
    ) {
      errors.push(
        `auto-validated-confidence-too-low:${field.entryKey}:${field.locale}:${field.field}:${field.confidence}`
      );
    }
  }
}

function validateSourceRights(
  db: DatabaseSync,
  fields: FieldVersionRow[],
  selectedIds: Set<number>,
  errors: string[]
): void {
  const rows = db
    .prepare(
      `SELECT evidence.fieldVersionId, source.sourceKey, source.rightsStatus,
              source.allowDisplay, source.allowTranslation
       FROM LexiconFieldEvidence evidence
       JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
       JOIN LexiconSources source ON source.id = assertion.sourceId
       WHERE evidence.stance = 'supports'
       ORDER BY evidence.fieldVersionId, source.sourceKey`
    )
    .all() as unknown as SupportingSourceRow[];
  const sourcesByVersion = new Map<number, SupportingSourceRow[]>();
  for (const row of rows) {
    if (!selectedIds.has(row.fieldVersionId)) continue;
    const values = sourcesByVersion.get(row.fieldVersionId) ?? [];
    values.push(row);
    sourcesByVersion.set(row.fieldVersionId, values);
  }
  for (const field of fields) {
    for (const source of sourcesByVersion.get(field.id) ?? []) {
      if (source.rightsStatus !== "cleared" || source.allowDisplay !== 1) {
        errors.push(
          `display-rights-blocked:${field.entryKey}:${field.locale}:${field.field}:${source.sourceKey}`
        );
      }
      if (
        field.locale === "en" &&
        (source.rightsStatus !== "cleared" || source.allowTranslation !== 1)
      ) {
        errors.push(
          `translation-rights-blocked:${field.entryKey}:${field.field}:${source.sourceKey}`
        );
      }
    }
  }
}

function validateStoredContentHash(
  field: FieldVersionRow,
  errors: string[]
): void {
  const expected = lexiconV3FieldContentHash({
    entryKey: field.entryKey,
    locale: field.locale,
    field: field.field,
    valueText: field.valueText,
    valueHtml: field.valueHtml,
    derivedFromVersionId: field.derivedFromVersionId
  });
  if (expected !== field.contentHash) {
    errors.push(`content-hash-mismatch:${field.id}`);
  }
}

function groupFieldVersions(
  versions: FieldVersionRow[]
): Map<string, FieldVersionRow[]> {
  const result = new Map<string, FieldVersionRow[]>();
  for (const version of versions) {
    const key = slotKey(version.entryKey, version.locale, version.field);
    const values = result.get(key) ?? [];
    values.push(version);
    result.set(key, values);
  }
  return result;
}

function slotKey(
  entryKey: string,
  locale: LexiconLocale,
  field: LexiconRequiredField
): string {
  return `${entryKey}\u0000${locale}\u0000${field}`;
}

function readRightsManifest(
  db: DatabaseSync,
  profile: LexiconV3ReleaseProfile,
  selectedFieldIds: Set<number>
): RightsManifestRow[] {
  const rows = db
    .prepare(
      `SELECT sourceKey, name, version, witnessFamily, locale, sha256,
              license, rightsStatus, allowDisplay, allowTranslation,
              allowCarrier, metadataJson
       FROM LexiconSources ORDER BY sourceKey`
    )
    .all() as unknown as RightsManifestRow[];
  if (profile === "bilingual") return rows;

  const relevantSourceKeys = new Set(
    (
      db
        .prepare(
          `SELECT DISTINCT evidence.fieldVersionId, source.sourceKey
           FROM LexiconFieldEvidence evidence
           JOIN LexiconSourceAssertions assertion
             ON assertion.id = evidence.sourceAssertionId
           JOIN LexiconSources source ON source.id = assertion.sourceId
           ORDER BY source.sourceKey`
        )
        .all() as unknown as Array<{
        fieldVersionId: number;
        sourceKey: string;
      }>
    )
      .filter((row) => selectedFieldIds.has(row.fieldVersionId))
      .map((row) => row.sourceKey)
  );
  relevantSourceKeys.add("artifact-hebrew-open-english");
  return rows.filter((row) => relevantSourceKeys.has(row.sourceKey));
}

function validatePinnedHebrewEnglishSource(
  db: DatabaseSync,
  errors: string[]
): void {
  const source = db
    .prepare(
      `SELECT sha256, metadataJson
       FROM LexiconSources
       WHERE sourceKey = 'artifact-hebrew-open-english'`
    )
    .get() as { sha256: string; metadataJson: string } | undefined;
  if (!source) {
    const hasHebrew = Boolean(
      db
        .prepare(
          "SELECT 1 FROM LexiconEntries WHERE language = 'hebrew' LIMIT 1"
        )
        .get()
    );
    if (hasHebrew) errors.push("missing-hebrew-open-english-source");
    return;
  }

  let metadata: { summary?: HebrewEnglishArtifactSummary };
  try {
    metadata = JSON.parse(source.metadataJson) as {
      summary?: HebrewEnglishArtifactSummary;
    };
  } catch {
    errors.push("hebrew-english-source-invalid-metadata");
    return;
  }
  if (!metadata.summary) {
    errors.push("hebrew-english-source-missing-summary");
    return;
  }
  try {
    assertPinnedHebrewEnglishArtifactSummary(metadata.summary);
  } catch (error) {
    errors.push(
      error instanceof Error
        ? error.message
        : "hebrew-english-source-pinning-invalid"
    );
  }
  if (metadata.summary.outputDigest !== source.sha256) {
    errors.push("hebrew-english-source-output-digest-mismatch");
  }
}

function readReviewTrail(
  db: DatabaseSync,
  selectedFieldIds: Set<number>
): unknown[] {
  if (selectedFieldIds.size === 0) return [];
  const rows = db
    .prepare(
      `SELECT review.fieldVersionId, field.entryKey, field.locale, field.field,
              field.contentHash,
              review.reviewerType, review.reviewer, review.verdict,
              review.reason, review.artifactHash
       FROM LexiconFieldReviews review
       JOIN LexiconFieldVersions field ON field.id = review.fieldVersionId
       ORDER BY field.entryKey, field.locale, field.field,
                review.artifactHash`
    )
    .all() as Array<Record<string, unknown> & { fieldVersionId: number }>;
  return rows
    .filter((row) => selectedFieldIds.has(row.fieldVersionId))
    .map((row) =>
      Object.fromEntries(
        Object.entries(row).filter(([key]) => key !== "fieldVersionId")
      )
    );
}

function readIssueTrail(
  db: DatabaseSync,
  profile: LexiconV3ReleaseProfile,
  fields: FieldVersionRow[]
): unknown[] {
  const selectedIds = new Set(fields.map((field) => field.id));
  const selectedEntries = new Set(fields.map((field) => field.entryKey));
  const rows = db
    .prepare(
      `SELECT issue.fieldVersionId, issue.entryKey, field.locale, field.field, issue.code,
              issue.severity, issue.status, issue.detailsJson,
              review.artifactHash AS resolutionArtifactHash,
              issue.resolvedAt
       FROM LexiconIssues issue
       LEFT JOIN LexiconFieldVersions field ON field.id = issue.fieldVersionId
       LEFT JOIN LexiconFieldReviews review ON review.id = issue.resolutionReviewId
       ORDER BY issue.entryKey, field.locale, field.field, issue.code,
                issue.detailsJson, issue.status, resolutionArtifactHash`
    )
    .all() as Array<
    Record<string, unknown> & {
      fieldVersionId: number | null;
      entryKey: string;
      detailsJson?: string;
    }
  >;
  return rows
    .filter(
      (row) =>
        profile === "bilingual" ||
        (selectedEntries.has(row.entryKey) &&
          (row.fieldVersionId === null || selectedIds.has(row.fieldVersionId)))
    )
    .map((row) => ({
      ...Object.fromEntries(
        Object.entries(row).filter(
          ([key]) => key !== "fieldVersionId" && key !== "detailsJson"
        )
      ),
      details: sanitizeIssueDetails(row.detailsJson)
    }));
}

function sanitizeIssueDetails(value: string | undefined): unknown {
  if (!value) return {};
  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return { invalidJson: true };
  }
  const sanitize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sanitize);
    if (!input || typeof input !== "object") return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>)
        .filter(([key]) => !/(?:^|[A-Z_])ids?$/iu.test(key))
        .map(([key, nested]) => [key, sanitize(nested)])
    );
  };
  return sanitize(parsed);
}

function readAuthoringFingerprint(
  db: DatabaseSync,
  key: "sourceFingerprint" | "sourceLogicalFingerprint" | "codeFingerprint",
  errors: string[]
): string {
  const row = db
    .prepare("SELECT value FROM LexiconV3Meta WHERE key = ?")
    .get(key) as { value?: string } | undefined;
  const value = row?.value?.trim() ?? "";
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    errors.push(`missing-authoring-${key}`);
    return hashJson([]);
  }
  return value;
}

function requiredAuthoringFingerprint(
  db: DatabaseSync,
  key: "sourceFingerprint" | "sourceLogicalFingerprint" | "codeFingerprint"
): string {
  const errors: string[] = [];
  const value = readAuthoringFingerprint(db, key, errors);
  if (errors.length > 0) throw new Error(errors[0]);
  return value;
}

function readAuthoringEntries(db: DatabaseSync): EntryRow[] {
  return db
    .prepare(
      `SELECT entry.entryKey, ids.stepEntryId, entry.language, entry.baseCode,
              entry.eStrong, entry.primaryDStrong, entry.dStrong,
              entry.uStrong, entry.original, entry.transliteration,
              entry.morph, entry.classicTransliteration,
              entry.pronunciation
       FROM LexiconEntries entry
       LEFT JOIN LexiconEntryIds ids ON ids.entryKey = entry.entryKey
       ORDER BY entry.entryKey`
    )
    .all() as unknown as EntryRow[];
}

function fingerprintEntryIdentities(entries: EntryRow[]): string {
  return hashJson(
    entries.map((entry) => ({
      entryKey: entry.entryKey,
      stepEntryId: entry.stepEntryId,
      language: entry.language,
      baseCode: entry.baseCode,
      eStrong: entry.eStrong,
      primaryDStrong: entry.primaryDStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      classicTransliteration: entry.classicTransliteration,
      pronunciation: entry.pronunciation
    }))
  );
}

function emptyPlan(
  profile: LexiconV3ReleaseProfile,
  errors: string[]
): LexiconV3ReleasePlan {
  return {
    profile,
    expectedEntryCount: 0,
    fields: [],
    carriers: [],
    errors,
    sourceFingerprint: hashJson([]),
    sourceLogicalFingerprint: hashJson([]),
    snapshotFingerprint: hashJson([]),
    entryIdentityFingerprint: hashJson([]),
    rightsManifestDigest: hashJson([]),
    rightsManifest: []
  };
}

function normalizeReleaseProfile(
  profile: LexiconV3ReleaseProfile | undefined
): LexiconV3ReleaseProfile {
  const value = profile ?? "bilingual";
  if (value !== "bilingual" && value !== "core-en") {
    throw new Error(`invalid-release-profile:${String(value)}`);
  }
  return value;
}

function requiredFieldMultiplier(profile: LexiconV3ReleaseProfile): 2 | 4 {
  return profile === "core-en" ? 2 : 4;
}

function requiredReleasePolicyVersion(
  profile: LexiconV3ReleaseProfile
): string {
  return profile === "core-en"
    ? LEXICON_V3_CORE_EN_RELEASE_POLICY_VERSION
    : LEXICON_V3_RELEASE_POLICY_VERSION;
}

function validateReleaseManifest(
  release: ReleaseRow,
  errors: string[]
): ReleaseManifest | null {
  let manifest: Partial<ReleaseManifest>;
  try {
    manifest = JSON.parse(release.manifestJson) as Partial<ReleaseManifest>;
  } catch {
    errors.push("release-manifest-invalid-json");
    return null;
  }
  if (
    manifest.schemaVersion !== LEXICON_V3_RELEASE_MANIFEST_SCHEMA &&
    manifest.schemaVersion !== LEXICON_V3_PREVIOUS_RELEASE_MANIFEST_SCHEMA &&
    manifest.schemaVersion !== LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA
  ) {
    errors.push("release-manifest-schema-invalid");
    return null;
  }
  if (manifest.schemaVersion === LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA) {
    manifest.releaseProfile = "bilingual";
  } else if (
    manifest.releaseProfile !== "bilingual" &&
    manifest.releaseProfile !== "core-en"
  ) {
    errors.push("release-manifest-profile-invalid");
    return null;
  }
  const expectedPolicyVersion = requiredReleasePolicyVersion(
    manifest.releaseProfile
  );
  if (release.policyVersion !== expectedPolicyVersion) {
    errors.push("release-policy-version-invalid");
  }
  if (
    manifest.schemaVersion !== LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA &&
    (!Number.isInteger(manifest.fieldCount) ||
      !Number.isInteger(manifest.carrierCount))
  ) {
    errors.push("release-manifest-counts-invalid");
    return null;
  }
  if (!Array.isArray(manifest.rightsManifest)) {
    errors.push("release-rights-manifest-missing");
    return null;
  }
  if (!/^[a-f0-9]{64}$/u.test(manifest.rightsManifestDigest ?? "")) {
    errors.push("release-rights-manifest-digest-invalid");
    return null;
  }
  if (hashJson(manifest.rightsManifest) !== manifest.rightsManifestDigest) {
    errors.push("release-rights-manifest-digest-mismatch");
  }
  if (manifest.sourceFingerprint !== release.sourceFingerprint) {
    errors.push("release-manifest-source-fingerprint-mismatch");
  }
  if (
    manifest.schemaVersion === LEXICON_V3_RELEASE_MANIFEST_SCHEMA &&
    !/^[a-f0-9]{64}$/u.test(manifest.sourceLogicalFingerprint ?? "")
  ) {
    errors.push("release-manifest-source-logical-fingerprint-invalid");
  }
  if (
    manifest.schemaVersion === LEXICON_V3_RELEASE_MANIFEST_SCHEMA &&
    manifest.policyVersion !== release.policyVersion
  ) {
    errors.push("release-manifest-policy-version-mismatch");
  }
  if (manifest.codeFingerprint !== release.codeFingerprint) {
    errors.push("release-manifest-code-fingerprint-mismatch");
  }
  if (!/^[a-f0-9]{64}$/u.test(manifest.snapshotFingerprint ?? "")) {
    errors.push("release-manifest-snapshot-fingerprint-invalid");
  }
  if (
    manifest.entryIdentityFingerprint !== undefined &&
    !/^[a-f0-9]{64}$/u.test(manifest.entryIdentityFingerprint)
  ) {
    errors.push("release-manifest-entry-identity-fingerprint-invalid");
  }
  if (
    manifest.schemaVersion !== LEXICON_V3_LEGACY_RELEASE_MANIFEST_SCHEMA &&
    manifest.releaseProfile === "core-en" &&
    !manifest.entryIdentityFingerprint
  ) {
    errors.push("release-manifest-entry-identity-fingerprint-missing");
  }
  return manifest as ReleaseManifest;
}

function assertSafeProductionOutputPaths(
  authoringPath: string,
  sourcePath: string,
  outputPaths: string[]
): void {
  const canonicalAuthoring = comparablePath(authoringPath);
  const canonicalSource = comparablePath(sourcePath);
  const protectedPaths = new Set(
    [
      "data/dictionaries/strong_lexicon.core.production.sqlite",
      "data/dictionaries/strong_lexicon.full.production.sqlite",
      "data/dictionaries/strong_lexicon.en.core.production.sqlite"
    ].map((path) => comparablePath(resolve(PROJECT_ROOT, path)))
  );
  const seen = new Set<string>();
  for (const outputPath of outputPaths) {
    const canonicalOutput = comparablePath(outputPath);
    if (canonicalOutput === canonicalAuthoring) {
      throw new Error(`output-must-differ-from-authoring:${outputPath}`);
    }
    if (canonicalOutput === canonicalSource) {
      throw new Error(`output-must-differ-from-source:${outputPath}`);
    }
    if (protectedPaths.has(canonicalOutput)) {
      throw new Error(`protected-production-output-refused:${outputPath}`);
    }
    if (seen.has(canonicalOutput)) {
      throw new Error(`duplicate-production-output:${outputPath}`);
    }
    seen.add(canonicalOutput);
  }
}

function fileSha256(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function comparablePath(path: string): string {
  const resolved = resolve(path);
  if (existsSync(resolved)) return realpathSync(resolved);
  const suffix: string[] = [];
  let ancestor = resolved;
  while (!existsSync(ancestor)) {
    const parent = dirname(ancestor);
    if (parent === ancestor) return resolved;
    suffix.unshift(basename(ancestor));
    ancestor = parent;
  }
  return resolve(realpathSync(ancestor), ...suffix);
}

function assertRegularFileNotSymlink(path: string, label: string): void {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isFile()) {
    throw new Error(`${label}-must-be-regular-file:${path}`);
  }
}

function assertDirectoryNotSymlink(path: string, label: string): void {
  const stats = lstatSync(path);
  if (stats.isSymbolicLink() || !stats.isDirectory()) {
    throw new Error(`${label}-must-be-regular-directory:${path}`);
  }
}

function readRelease(
  db: DatabaseSync,
  releaseKey: string
): ReleaseRow | undefined {
  return db
    .prepare("SELECT * FROM LexiconReleases WHERE releaseKey = ?")
    .get(releaseKey) as unknown as ReleaseRow | undefined;
}

function readReleaseFields(
  db: DatabaseSync,
  releaseId: number
): FieldVersionRow[] {
  return db
    .prepare(
      `SELECT fv.id, fv.entryKey, fv.locale, fv.field, fv.valueText,
              fv.valueHtml, fv.state, fv.confidence, fv.method, fv.generator,
              fv.derivedFromVersionId, fv.contentHash
       FROM LexiconReleaseFields rf
       JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
       WHERE rf.releaseId = ?
       ORDER BY fv.entryKey, fv.locale, fv.field`
    )
    .all(releaseId) as unknown as FieldVersionRow[];
}

function readReleaseSummary(
  db: DatabaseSync,
  releaseKey: string
): LexiconV3ReleaseSummary {
  const release = readRelease(db, releaseKey);
  if (!release) throw new Error(`missing-release:${releaseKey}`);
  if (release.state !== "candidate" && release.state !== "promoted") {
    throw new Error(`release-not-publishable:${releaseKey}:${release.state}`);
  }
  const manifestErrors: string[] = [];
  const manifest = validateReleaseManifest(release, manifestErrors);
  if (!manifest || manifestErrors.length > 0) {
    throw new LexiconV3ReleaseError("release-manifest-invalid", manifestErrors);
  }
  return {
    id: release.id,
    releaseKey,
    profile: manifest.releaseProfile,
    state: release.state,
    expectedEntryCount: release.expectedEntryCount,
    fieldCount: readCount(
      db,
      "SELECT count(*) AS count FROM LexiconReleaseFields WHERE releaseId = ?",
      release.id
    ),
    carrierCount: readCount(
      db,
      "SELECT count(*) AS count FROM LexiconReleaseCarriers WHERE releaseId = ?",
      release.id
    ),
    sourceFingerprint: release.sourceFingerprint,
    codeFingerprint: release.codeFingerprint,
    policyVersion: release.policyVersion,
    snapshotFingerprint: manifest.snapshotFingerprint,
    promotedAt: release.promotedAt
  };
}

function appendSqlCountError(
  db: DatabaseSync,
  errors: string[],
  code: string,
  sql: string,
  ...parameters: Array<string | number>
): void {
  const count = readCount(db, sql, ...parameters);
  if (count > 0) errors.push(`${code}:${count}`);
}

function compareIdSets(
  code: string,
  left: number[],
  right: number[],
  errors: string[]
): void {
  const a = [...left].sort((x, y) => x - y).join(",");
  const b = [...right].sort((x, y) => x - y).join(",");
  if (a !== b) errors.push(code);
}

function readCount(
  db: DatabaseSync,
  sql: string,
  ...parameters: Array<string | number>
): number {
  const row = db.prepare(sql).get(...parameters) as
    | { count: number }
    | undefined;
  return Number(row?.count ?? 0);
}

function firstValue(db: DatabaseSync, sql: string): string {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return String(row ? Object.values(row)[0] : "missing");
}

function hashJson(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function assertSha256(value: string, label: string): void {
  if (!/^[a-f0-9]{64}$/u.test(value)) {
    throw new Error(`invalid-${label}:${value}`);
  }
}

function requiredMapValue<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`missing-map-value:${String(key)}`);
  return value;
}

function prepareFrenchTranslationInsert(db: DatabaseSync) {
  const columns = tableColumns(db, "LexiconTranslations");
  if (columns.has("createdAt") && columns.has("updatedAt")) {
    return db.prepare(
      `INSERT INTO LexiconTranslations (
         stepEntryId, language, gloss, meaning, meaningHtml, createdAt, updatedAt
       ) VALUES (?, 'fr', ?, ?, ?, strftime('%Y-%m-%dT%H:%M:%fZ', 'now'),
                 strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`
    );
  }
  return db.prepare(
    `INSERT INTO LexiconTranslations (
       stepEntryId, language, gloss, meaning, meaningHtml
     ) VALUES (?, 'fr', ?, ?, ?)`
  );
}

function prepareFrenchTranslationUpdate(db: DatabaseSync) {
  const columns = tableColumns(db, "LexiconTranslations");
  const updatedAt = columns.has("updatedAt")
    ? ", updatedAt = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')"
    : "";
  return db.prepare(
    `UPDATE LexiconTranslations
     SET gloss = ?, meaning = ?, meaningHtml = ?${updatedAt}
     WHERE stepEntryId = ? AND language = 'fr'`
  );
}

function tableColumns(db: DatabaseSync, table: string): Set<string> {
  return new Set(
    (
      db.prepare(`PRAGMA table_info(${table})`).all() as Array<{
        name: string;
      }>
    ).map((row) => row.name)
  );
}

const PRODUCTION_TABLE_COLUMNS = {
  DictionaryMeta: ["key", "value"],
  LexiconCarrierTerms: [
    "id",
    "stepEntryId",
    "strong",
    "stepStrong",
    "locale",
    "surface",
    "normalized",
    "termKind",
    "state",
    "policy",
    "confidence",
    "derivedFromVersionId",
    "contentHash",
    "releaseKey"
  ],
  LexiconFieldStatus: [
    "stepEntryId",
    "locale",
    "field",
    "fieldVersionId",
    "state",
    "confidence",
    "method",
    "generator",
    "contentHash",
    "derivedFromVersionId",
    "releaseKey"
  ],
  LexiconResources: ["id", "stepEntryId", "source", "kind", "contentHtml"],
  LexiconResourceTranslations: [
    "resourceId",
    "language",
    "contentHtml",
    "contentText"
  ],
  LexiconTranslations: [
    "stepEntryId",
    "language",
    "gloss",
    "meaning",
    "meaningHtml"
  ],
  MorphologyCodes: [
    "id",
    "code",
    "normalizedCode",
    "language",
    "scope",
    "example",
    "meaning",
    "description",
    "source"
  ],
  MorphologyCodeTranslations: [
    "morphologyCodeId",
    "language",
    "meaning",
    "description",
    "example"
  ],
  StepEntries: [
    "id",
    "language",
    "baseCode",
    "eStrong",
    "dStrong",
    "uStrong",
    "original",
    "transliteration",
    "morph",
    "gloss",
    "meaning",
    "classicTransliteration",
    "pronunciation"
  ]
} as const;

function assertSupportedSourceDatabaseSchema(
  db: DatabaseSync,
  profile: LexiconV3ProductionProfile
): void {
  const required = new Set([
    "DictionaryMeta",
    "LexiconTranslations",
    "StepEntries"
  ]);
  if (profile === "full") {
    required.add("LexiconResources");
    required.add("LexiconResourceTranslations");
  }
  const allowed = new Set([
    "DictionaryMeta",
    "LexiconResources",
    "LexiconResourceTranslations",
    "LexiconTranslations",
    "MorphologyCodes",
    "MorphologyCodeTranslations",
    "StepEntries"
  ]);
  const tables = userSchemaObjects(db, "table");
  for (const name of required) {
    if (!tables.has(name))
      throw new Error(`source-schema-missing-table:${name}`);
  }
  for (const name of tables) {
    if (!allowed.has(name))
      throw new Error(`source-schema-extra-table:${name}`);
    assertExactTableColumns(db, name);
  }
  for (const type of ["view", "trigger"] as const) {
    const objects = userSchemaObjects(db, type);
    if (objects.size > 0) {
      throw new Error(
        `source-schema-extra-${type}:${[...objects].sort().join(",")}`
      );
    }
  }
}

function validateProjectedDatabaseSchema(
  db: DatabaseSync,
  profile: LexiconV3ProductionProfile,
  errors: string[]
): void {
  const required = new Set([
    "DictionaryMeta",
    "LexiconCarrierTerms",
    "LexiconFieldStatus",
    "LexiconTranslations",
    "StepEntries"
  ]);
  if (profile === "full") {
    required.add("LexiconResources");
    required.add("LexiconResourceTranslations");
  }
  const allowed = new Set(Object.keys(PRODUCTION_TABLE_COLUMNS));
  if (profile !== "full") {
    allowed.delete("LexiconResources");
    allowed.delete("LexiconResourceTranslations");
  }
  const tables = userSchemaObjects(db, "table");
  for (const name of required) {
    if (!tables.has(name))
      errors.push(`projection-schema-missing-table:${name}`);
  }
  for (const name of tables) {
    if (!allowed.has(name)) {
      errors.push(`projection-schema-extra-table:${name}`);
      continue;
    }
    try {
      assertExactTableColumns(db, name);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error));
    }
  }
  for (const type of ["view", "trigger"] as const) {
    for (const name of userSchemaObjects(db, type)) {
      errors.push(`projection-schema-extra-${type}:${name}`);
    }
  }
}

function assertExactTableColumns(db: DatabaseSync, table: string): void {
  const expected =
    PRODUCTION_TABLE_COLUMNS[table as keyof typeof PRODUCTION_TABLE_COLUMNS];
  if (!expected) throw new Error(`source-schema-unknown-table:${table}`);
  const actual = [...tableColumns(db, table)].sort();
  const wanted = [...expected].sort();
  if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
    throw new Error(`schema-columns-mismatch:${table}`);
  }
}

function userSchemaObjects(
  db: DatabaseSync,
  type: "table" | "view" | "trigger"
): Set<string> {
  const rows = db
    .prepare(
      `SELECT name FROM sqlite_schema
       WHERE type = ? AND name NOT LIKE 'sqlite_%'
       ORDER BY name`
    )
    .all(type) as unknown as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function requireTable(db: DatabaseSync, name: string): void {
  if (!tableExists(db, name)) throw new Error(`missing-source-table:${name}`);
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name)
  );
}

function temporarySibling(path: string): string {
  return `${path}.tmp-${randomUUID()}`;
}

function removeSqliteFile(path: string): void {
  for (const suffix of ["", "-journal", "-wal", "-shm"]) {
    rmSync(`${path}${suffix}`, { force: true });
  }
}

function assertNoSqliteSidecars(path: string): void {
  for (const suffix of ["-journal", "-wal", "-shm"]) {
    if (existsSync(`${path}${suffix}`)) {
      throw new Error(`production-sqlite-sidecar-present:${suffix}`);
    }
  }
}

function assertSqliteOmitsTextBytes(path: string, value: string): void {
  const file = readFileSync(path);
  const utf16Le = Buffer.from(value, "utf16le");
  const utf16Be = Buffer.from(utf16Le);
  for (let index = 0; index < utf16Be.length; index += 2) {
    const first = utf16Be[index];
    utf16Be[index] = utf16Be[index + 1] ?? 0;
    utf16Be[index + 1] = first ?? 0;
  }
  for (const [encoding, bytes] of [
    ["utf8", Buffer.from(value, "utf8")],
    ["utf16le", utf16Le],
    ["utf16be", utf16Be]
  ] as const) {
    const offset = file.indexOf(bytes);
    if (offset !== -1) {
      throw new Error(`production-physical-purge-failed:${encoding}:${offset}`);
    }
  }
}

/**
 * Publish the two SQLite profiles as one recoverable operation. Both old
 * outputs are moved aside before either new output is exposed; a failure while
 * publishing either profile restores the complete previous pair.
 */
export function publishLexiconV3AtomicPair(
  files: Array<{ temporary: string; output: string }>,
  overwriteExisting: boolean
): void {
  const backups: Array<{ output: string; backup: string }> = [];
  const published: string[] = [];
  try {
    for (const file of files) {
      if (!existsSync(file.output)) continue;
      if (!overwriteExisting) {
        throw new Error(`output-exists-requires-write:${file.output}`);
      }
      const backup = `${file.output}.previous-${randomUUID()}`;
      renameSync(file.output, backup);
      backups.push({ output: file.output, backup });
    }
    for (const file of files) {
      renameSync(file.temporary, file.output);
      published.push(file.output);
    }
  } catch (error) {
    for (const output of published) removeSqliteFile(output);
    for (const backup of backups.reverse()) {
      if (existsSync(backup.backup)) renameSync(backup.backup, backup.output);
    }
    throw error;
  }

  // Publication is committed once both new files are visible. Backup cleanup
  // is intentionally best-effort: a cleanup error must never roll back only
  // one side after a complete pair has been published.
  for (const backup of backups) {
    try {
      removeSqliteFile(backup.backup);
    } catch {
      return;
    }
  }
}
