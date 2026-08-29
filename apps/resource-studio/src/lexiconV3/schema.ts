import { type DatabaseSync } from "node:sqlite";

export const LEXICON_V3_SCHEMA_VERSION = "lexicon-v3@1";

const REQUIRED_TABLES = [
  "LexiconV3Meta",
  "LexiconEntries",
  "LexiconEntryIds",
  "LexiconSources",
  "LexiconSourceAssertions",
  "LexiconFieldVersions",
  "LexiconFieldEvidence",
  "LexiconFieldReviews",
  "LexiconIssues",
  "LexiconCarrierTerms",
  "LexiconCarrierEvidence",
  "LexiconReleases",
  "LexiconReleaseFields",
  "LexiconReleaseCarriers"
] as const;

const REQUIRED_INDEXES = [
  "idx_LexiconEntries_eStrong",
  "idx_LexiconEntries_language_baseCode",
  "idx_LexiconSourceAssertions_entry_field",
  "idx_LexiconSourceAssertions_source",
  "idx_LexiconFieldVersions_entry_locale_field",
  "idx_LexiconFieldVersions_state",
  "idx_LexiconFieldEvidence_version",
  "idx_LexiconFieldReviews_version",
  "idx_LexiconIssues_open",
  "idx_LexiconCarrierTerms_lookup",
  "idx_LexiconCarrierTerms_state_policy",
  "idx_LexiconCarrierEvidence_term",
  "idx_LexiconReleaseFields_version",
  "idx_LexiconReleaseCarriers_term"
] as const;

const REQUIRED_TRIGGERS = [
  "trg_LexiconEntryIds_identity_immutable",
  "trg_LexiconEntryIds_no_delete",
  "trg_LexiconSourceAssertions_no_update",
  "trg_LexiconSourceAssertions_no_delete",
  "trg_LexiconFieldVersions_fr_source_insert",
  "trg_LexiconFieldVersions_fr_source_update",
  "trg_LexiconFieldVersions_content_immutable",
  "trg_LexiconFieldVersions_released_state_immutable",
  "trg_LexiconFieldEvidence_target_insert",
  "trg_LexiconFieldEvidence_no_update",
  "trg_LexiconFieldEvidence_no_delete",
  "trg_LexiconFieldReviews_no_update",
  "trg_LexiconFieldReviews_no_delete",
  "trg_LexiconCarrierTerms_source_insert",
  "trg_LexiconCarrierTerms_source_update",
  "trg_LexiconCarrierTerms_content_immutable",
  "trg_LexiconCarrierTerms_released_state_immutable",
  "trg_LexiconCarrierEvidence_source_insert",
  "trg_LexiconCarrierEvidence_source_update",
  "trg_LexiconCarrierEvidence_no_update",
  "trg_LexiconCarrierEvidence_no_delete",
  "trg_LexiconReleaseFields_validate_insert",
  "trg_LexiconReleaseFields_validate_update",
  "trg_LexiconReleaseCarriers_validate_insert",
  "trg_LexiconReleaseCarriers_validate_update",
  "trg_LexiconReleases_validate_promotion",
  "trg_LexiconReleases_promoted_no_update",
  "trg_LexiconReleases_promoted_no_delete",
  "trg_LexiconReleaseFields_promoted_no_insert",
  "trg_LexiconReleaseFields_promoted_no_update",
  "trg_LexiconReleaseFields_promoted_no_delete",
  "trg_LexiconReleaseCarriers_promoted_no_insert",
  "trg_LexiconReleaseCarriers_promoted_no_update",
  "trg_LexiconReleaseCarriers_promoted_no_delete"
] as const;

export interface LexiconV3SchemaVerification {
  ok: boolean;
  schemaVersion: string | null;
  userVersion: number;
  foreignKeysEnabled: boolean;
  integrity: string;
  foreignKeyViolations: number;
  missingTables: string[];
  missingIndexes: string[];
  missingTriggers: string[];
  dataErrors: string[];
}

export function createLexiconV3Schema(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON;");
  const existingVersion = readSchemaObjects(db, "table").has("LexiconV3Meta")
    ? readMetaValue(db, "schemaVersion")
    : null;
  if (
    existingVersion !== null &&
    existingVersion !== LEXICON_V3_SCHEMA_VERSION
  ) {
    throw new Error(
      `lexicon-v3-schema-version-mismatch:${existingVersion}:${LEXICON_V3_SCHEMA_VERSION}`
    );
  }

  db.exec(SCHEMA_SQL);
  db.prepare(
    `INSERT INTO LexiconV3Meta (key, value)
     VALUES ('schemaVersion', ?)
     ON CONFLICT(key) DO NOTHING`
  ).run(LEXICON_V3_SCHEMA_VERSION);
  db.exec("PRAGMA user_version = 3;");
}

export function verifyLexiconV3Schema(
  db: DatabaseSync
): LexiconV3SchemaVerification {
  const tables = readSchemaObjects(db, "table");
  const indexes = readSchemaObjects(db, "index");
  const triggers = readSchemaObjects(db, "trigger");
  const missingTables = REQUIRED_TABLES.filter((name) => !tables.has(name));
  const missingIndexes = REQUIRED_INDEXES.filter((name) => !indexes.has(name));
  const missingTriggers = REQUIRED_TRIGGERS.filter(
    (name) => !triggers.has(name)
  );

  const integrity = firstPragmaValue(db, "PRAGMA integrity_check");
  const foreignKeyViolations = db
    .prepare("PRAGMA foreign_key_check")
    .all().length;
  const foreignKeysEnabled = firstPragmaNumber(db, "PRAGMA foreign_keys") === 1;
  const userVersion = firstPragmaNumber(db, "PRAGMA user_version");
  const schemaVersion = tables.has("LexiconV3Meta")
    ? readMetaValue(db, "schemaVersion")
    : null;

  const dataErrors = missingTables.length === 0 ? verifyReleaseData(db) : [];
  if (schemaVersion !== LEXICON_V3_SCHEMA_VERSION) {
    dataErrors.push(
      `schema-version:${schemaVersion ?? "missing"}:${LEXICON_V3_SCHEMA_VERSION}`
    );
  }
  if (userVersion !== 3) dataErrors.push(`user-version:${userVersion}:3`);
  if (!foreignKeysEnabled) dataErrors.push("foreign-keys-disabled");

  return {
    ok:
      integrity === "ok" &&
      foreignKeyViolations === 0 &&
      missingTables.length === 0 &&
      missingIndexes.length === 0 &&
      missingTriggers.length === 0 &&
      dataErrors.length === 0,
    schemaVersion,
    userVersion,
    foreignKeysEnabled,
    integrity,
    foreignKeyViolations,
    missingTables,
    missingIndexes,
    missingTriggers,
    dataErrors
  };
}

function verifyReleaseData(db: DatabaseSync): string[] {
  const checks: Array<{ code: string; sql: string }> = [
    {
      code: "active-fr-parent-invalid",
      sql: `
        SELECT count(*) AS count
        FROM LexiconFieldVersions fr
        LEFT JOIN LexiconFieldVersions en ON en.id = fr.derivedFromVersionId
        WHERE fr.locale = 'fr'
          AND fr.state IN ('auto_validated', 'human_validated')
          AND (
            en.id IS NULL
            OR en.locale <> 'en'
            OR en.entryKey <> fr.entryKey
            OR en.field <> fr.field
            OR en.state NOT IN ('auto_validated', 'human_validated')
          )
      `
    },
    {
      code: "active-carrier-parent-invalid",
      sql: `
        SELECT count(*) AS count
        FROM LexiconCarrierTerms carrier
        LEFT JOIN LexiconFieldVersions fr
          ON fr.id = carrier.derivedFromVersionId
        WHERE carrier.state IN ('auto_validated', 'human_validated')
          AND (
            fr.id IS NULL
            OR fr.locale <> 'fr'
            OR fr.entryKey <> carrier.entryKey
            OR fr.state NOT IN ('auto_validated', 'human_validated')
          )
      `
    },
    {
      code: "release-field-mismatch",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconFieldVersions fv ON fv.id = rf.fieldVersionId
        WHERE fv.entryKey <> rf.entryKey
           OR fv.locale <> rf.locale
           OR fv.field <> rf.field
           OR fv.state NOT IN ('auto_validated', 'human_validated')
      `
    },
    {
      code: "release-fr-source-mismatch",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields fr
        JOIN LexiconFieldVersions fv ON fv.id = fr.fieldVersionId
        LEFT JOIN LexiconReleaseFields en
          ON en.releaseId = fr.releaseId
         AND en.entryKey = fr.entryKey
         AND en.locale = 'en'
         AND en.field = fr.field
        WHERE fr.locale = 'fr'
          AND (en.fieldVersionId IS NULL OR en.fieldVersionId <> fv.derivedFromVersionId)
      `
    },
    {
      code: "release-carrier-invalid",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseCarriers rc
        JOIN LexiconCarrierTerms ct ON ct.id = rc.carrierTermId
        WHERE ct.state NOT IN ('auto_validated', 'human_validated')
           OR ct.policy = 'blocked'
           OR NOT EXISTS (
             SELECT 1
             FROM LexiconCarrierEvidence ce
             JOIN LexiconSources source ON source.id = ce.sourceId
             WHERE ce.carrierTermId = ct.id
               AND ce.stance = 'supports'
               AND source.allowCarrier = 1
           )
      `
    },
    {
      code: "promoted-release-count-mismatch",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleases release
        WHERE release.state = 'promoted'
          AND (
            release.expectedEntryCount <> (SELECT count(*) FROM LexiconEntries)
            OR
            (SELECT count(DISTINCT rf.entryKey)
             FROM LexiconReleaseFields rf
             WHERE rf.releaseId = release.id) <> release.expectedEntryCount
            OR
            (SELECT count(*)
             FROM LexiconReleaseFields rf
             WHERE rf.releaseId = release.id
               AND rf.locale IN ('en', 'fr')
               AND rf.field IN ('gloss', 'meaning')) <>
              release.expectedEntryCount * CASE
                WHEN json_extract(release.manifestJson, '$.schemaVersion') =
                     'lexicon-v3-release-manifest@2' THEN 4
                WHEN json_extract(release.manifestJson, '$.releaseProfile') =
                     'bilingual' THEN 4
                WHEN json_extract(release.manifestJson, '$.releaseProfile') =
                     'core-en' THEN 2
                ELSE -1
              END
            OR
            (json_extract(release.manifestJson, '$.releaseProfile') = 'core-en'
             AND EXISTS (
               SELECT 1 FROM LexiconReleaseFields rf
               WHERE rf.releaseId = release.id
                 AND (rf.locale <> 'en' OR rf.field NOT IN ('gloss', 'meaning'))
             ))
            OR
            (coalesce(json_extract(
               release.manifestJson, '$.releaseProfile'
             ), 'bilingual') = 'bilingual'
             AND EXISTS (
               SELECT 1 FROM LexiconReleaseFields rf
               WHERE rf.releaseId = release.id
                 AND rf.field NOT IN ('gloss', 'meaning')
             ))
            OR
            (json_extract(release.manifestJson, '$.releaseProfile') = 'core-en'
             AND EXISTS (
               SELECT 1 FROM LexiconReleaseCarriers rc
               WHERE rc.releaseId = release.id
             ))
          )
      `
    },
    {
      code: "promoted-release-missing-entry-id",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconReleases release ON release.id = rf.releaseId
        LEFT JOIN LexiconEntryIds ids ON ids.entryKey = rf.entryKey
        WHERE release.state = 'promoted'
          AND ids.entryKey IS NULL
      `
    },
    {
      code: "promoted-release-open-blocker",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconReleases release ON release.id = rf.releaseId
        JOIN LexiconIssues issue ON issue.entryKey = rf.entryKey
        WHERE release.state = 'promoted'
          AND issue.severity IN ('blocker', 'warning')
          AND issue.status = 'open'
          AND (issue.fieldVersionId IS NULL OR issue.fieldVersionId = rf.fieldVersionId)
      `
    },
    {
      code: "promoted-release-rights-blocked",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconReleases release ON release.id = rf.releaseId
        JOIN LexiconFieldEvidence evidence ON evidence.fieldVersionId = rf.fieldVersionId
        JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
        JOIN LexiconSources source ON source.id = assertion.sourceId
        WHERE release.state = 'promoted'
          AND evidence.stance = 'supports'
          AND (source.rightsStatus <> 'cleared' OR source.allowDisplay <> 1)
      `
    },
    {
      code: "promoted-release-missing-admissible-evidence",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconReleases release ON release.id = rf.releaseId
        JOIN LexiconFieldVersions field ON field.id = rf.fieldVersionId
        WHERE release.state = 'promoted'
          AND NOT EXISTS (
            SELECT 1
            FROM LexiconFieldEvidence evidence
            JOIN LexiconSourceAssertions assertion
              ON assertion.id = evidence.sourceAssertionId
            JOIN LexiconSources source ON source.id = assertion.sourceId
            WHERE evidence.fieldVersionId = field.id
              AND evidence.stance = 'supports'
              AND assertion.entryKey = field.entryKey
              AND assertion.field = field.field
              AND source.rightsStatus = 'cleared'
              AND source.allowDisplay = 1
              AND (
                (field.locale = 'en'
                  AND assertion.locale IN ('en', 'mul')
                  AND source.allowTranslation = 1)
                OR
                (field.locale = 'fr'
                  AND assertion.locale IN ('fr', 'mul')
                  AND evidence.evidenceKind IN ('review', 'validator'))
              )
          )
      `
    },
    {
      code: "promoted-release-auto-confidence-too-low",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields rf
        JOIN LexiconReleases release ON release.id = rf.releaseId
        JOIN LexiconFieldVersions field ON field.id = rf.fieldVersionId
        WHERE release.state = 'promoted'
          AND field.state = 'auto_validated'
          AND field.confidence < 0.9
      `
    },
    {
      code: "promoted-release-missing-hebrew-open-source",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleases release
        WHERE release.state = 'promoted'
          AND EXISTS (SELECT 1 FROM LexiconEntries WHERE language = 'hebrew')
          AND NOT EXISTS (
            SELECT 1 FROM LexiconSources
            WHERE sourceKey = 'artifact-hebrew-open-english'
          )
      `
    },
    {
      code: "promoted-release-manifest-invalid",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleases release
        WHERE release.state = 'promoted'
          AND (
            json_extract(release.manifestJson, '$.schemaVersion') NOT IN (
              'lexicon-v3-release-manifest@2',
              'lexicon-v3-release-manifest@3',
              'lexicon-v3-release-manifest@4'
            )
            OR (
              json_extract(release.manifestJson, '$.schemaVersion') IN (
                'lexicon-v3-release-manifest@3',
                'lexicon-v3-release-manifest@4'
              )
              AND (
                coalesce(json_extract(
                  release.manifestJson, '$.releaseProfile'
                ), '') NOT IN ('bilingual', 'core-en')
                OR coalesce(json_type(
                  release.manifestJson, '$.fieldCount'
                ), '') <> 'integer'
                OR json_extract(release.manifestJson, '$.fieldCount') <>
                  (SELECT count(*) FROM LexiconReleaseFields rf
                   WHERE rf.releaseId = release.id)
                OR coalesce(json_type(
                  release.manifestJson, '$.carrierCount'
                ), '') <> 'integer'
                OR json_extract(release.manifestJson, '$.carrierCount') <>
                  (SELECT count(*) FROM LexiconReleaseCarriers rc
                   WHERE rc.releaseId = release.id)
                OR coalesce(length(json_extract(
                  release.manifestJson, '$.snapshotFingerprint'
                )), -1) <> 64
                OR coalesce(json_extract(
                  release.manifestJson, '$.sourceFingerprint'
                ), '') <>
                  release.sourceFingerprint
                OR coalesce(json_extract(
                  release.manifestJson, '$.codeFingerprint'
                ), '') <>
                  release.codeFingerprint
                OR (
                  json_extract(release.manifestJson, '$.schemaVersion') =
                    'lexicon-v3-release-manifest@4'
                  AND (
                    coalesce(length(json_extract(
                      release.manifestJson, '$.sourceLogicalFingerprint'
                    )), -1) <> 64
                    OR coalesce(json_extract(
                      release.manifestJson, '$.policyVersion'
                    ), '') <> release.policyVersion
                    OR release.policyVersion <> CASE
                      WHEN json_extract(
                        release.manifestJson, '$.releaseProfile'
                      ) = 'core-en'
                        THEN 'lexicon-v3-core-en-release-policy@1'
                      ELSE 'lexicon-v3-release-policy@2'
                    END
                  )
                )
              )
            )
            OR json_type(release.manifestJson, '$.rightsManifest') IS NOT 'array'
            OR coalesce(length(json_extract(
              release.manifestJson, '$.rightsManifestDigest'
            )), -1) <> 64
          )
      `
    },
    {
      code: "promoted-release-translation-rights-blocked",
      sql: `
        SELECT count(*) AS count
        FROM LexiconReleaseFields fr
        JOIN LexiconReleases release ON release.id = fr.releaseId
        JOIN LexiconFieldVersions frVersion ON frVersion.id = fr.fieldVersionId
        JOIN LexiconFieldEvidence evidence
          ON evidence.fieldVersionId = frVersion.derivedFromVersionId
        JOIN LexiconSourceAssertions assertion ON assertion.id = evidence.sourceAssertionId
        JOIN LexiconSources source ON source.id = assertion.sourceId
        WHERE release.state = 'promoted'
          AND fr.locale = 'fr'
          AND evidence.stance = 'supports'
          AND (source.rightsStatus <> 'cleared' OR source.allowTranslation <> 1)
      `
    }
  ];

  return checks.flatMap(({ code, sql }) => {
    const count = readCount(db, sql);
    return count === 0 ? [] : [`${code}:${count}`];
  });
}

function readSchemaObjects(
  db: DatabaseSync,
  type: "table" | "index" | "trigger"
): Set<string> {
  const rows = db
    .prepare(
      "SELECT name FROM sqlite_master WHERE type = ? AND name NOT LIKE 'sqlite_%'"
    )
    .all(type) as Array<{ name: string }>;
  return new Set(rows.map((row) => row.name));
}

function readMetaValue(db: DatabaseSync, key: string): string | null {
  const row = db
    .prepare("SELECT value FROM LexiconV3Meta WHERE key = ?")
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function readCount(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as { count: number } | undefined;
  return Number(row?.count ?? 0);
}

function firstPragmaValue(db: DatabaseSync, sql: string): string {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return String(row ? Object.values(row)[0] : "missing");
}

function firstPragmaNumber(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(row ? Object.values(row)[0] : 0);
}

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS LexiconV3Meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS LexiconEntries (
  entryKey TEXT PRIMARY KEY,
  language TEXT NOT NULL CHECK(language IN ('greek', 'hebrew')),
  baseCode INTEGER NOT NULL CHECK(baseCode > 0),
  eStrong TEXT NOT NULL CHECK(
    (length(eStrong) = 5 AND eStrong GLOB '[GH][0-9][0-9][0-9][0-9]')
    OR
    (length(eStrong) = 6 AND (
      eStrong GLOB '[GH][0-9][0-9][0-9][0-9][0-9]'
      OR eStrong GLOB '[GH][0-9][0-9][0-9][0-9][A-Za-z]'
    ))
  ),
  primaryDStrong TEXT NOT NULL,
  dStrong TEXT NOT NULL CHECK(length(trim(dStrong)) > 0),
  uStrong TEXT NOT NULL CHECK(length(trim(uStrong)) > 0),
  -- One upstream STEP row currently has an empty original. It must remain
  -- representable so the authoring database can quarantine it explicitly.
  original TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  morph TEXT NOT NULL,
  classicTransliteration TEXT NOT NULL DEFAULT '',
  pronunciation TEXT NOT NULL DEFAULT '',
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(entryKey = language || ':' || primaryDStrong),
  UNIQUE(language, primaryDStrong),
  UNIQUE(language, eStrong, dStrong, uStrong)
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS LexiconEntryIds (
  entryKey TEXT PRIMARY KEY,
  stepEntryId INTEGER NOT NULL UNIQUE CHECK(stepEntryId > 0),
  assignedAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  retiredAt TEXT,
  CHECK(retiredAt IS NULL OR retiredAt >= assignedAt),
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS LexiconSources (
  id INTEGER PRIMARY KEY,
  sourceKey TEXT NOT NULL UNIQUE CHECK(length(trim(sourceKey)) > 0),
  name TEXT NOT NULL CHECK(length(trim(name)) > 0),
  version TEXT NOT NULL CHECK(length(trim(version)) > 0),
  witnessFamily TEXT NOT NULL CHECK(length(trim(witnessFamily)) > 0),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr', 'grc', 'hbo', 'arc', 'mul')),
  sha256 TEXT NOT NULL CHECK(
    length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  license TEXT NOT NULL,
  rightsStatus TEXT NOT NULL CHECK(
    rightsStatus IN ('cleared', 'restricted', 'pending', 'unknown')
  ),
  allowDisplay INTEGER NOT NULL DEFAULT 0 CHECK(allowDisplay IN (0, 1)),
  allowTranslation INTEGER NOT NULL DEFAULT 0 CHECK(allowTranslation IN (0, 1)),
  allowCarrier INTEGER NOT NULL DEFAULT 0 CHECK(allowCarrier IN (0, 1)),
  metadataJson TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(metadataJson)),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE TABLE IF NOT EXISTS LexiconSourceAssertions (
  id INTEGER PRIMARY KEY,
  sourceId INTEGER NOT NULL,
  entryKey TEXT NOT NULL,
  scope TEXT NOT NULL CHECK(
    scope IN ('entry', 'base_strong', 'resource', 'occurrence')
  ),
  field TEXT NOT NULL CHECK(
    field IN (
      'identity', 'gloss', 'meaning', 'morph', 'resource',
      'occurrence_gloss', 'carrier'
    )
  ),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr', 'grc', 'hbo', 'arc', 'mul')),
  valueText TEXT,
  valueHtml TEXT,
  locator TEXT NOT NULL CHECK(length(trim(locator)) > 0),
  sha256 TEXT NOT NULL CHECK(
    length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'
  ),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(
    length(trim(coalesce(valueText, ''))) > 0
    OR length(trim(coalesce(valueHtml, ''))) > 0
  ),
  UNIQUE(sourceId, entryKey, field, locator, sha256),
  FOREIGN KEY(sourceId) REFERENCES LexiconSources(id) ON DELETE RESTRICT,
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconFieldVersions (
  id INTEGER PRIMARY KEY,
  entryKey TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr')),
  field TEXT NOT NULL CHECK(field IN ('gloss', 'meaning', 'notes')),
  valueText TEXT NOT NULL CHECK(length(trim(valueText)) > 0),
  valueHtml TEXT,
  state TEXT NOT NULL CHECK(
    state IN (
      'candidate', 'auto_validated', 'human_validated',
      'blocked_source_issue', 'rejected', 'superseded'
    )
  ),
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  method TEXT NOT NULL CHECK(
    method IN ('source', 'editorial', 'translation', 'model', 'rule', 'import')
  ),
  generator TEXT NOT NULL CHECK(length(trim(generator)) > 0),
  promptVersion TEXT,
  derivedFromVersionId INTEGER,
  supersedesId INTEGER,
  contentHash TEXT NOT NULL CHECK(
    length(contentHash) = 64 AND contentHash NOT GLOB '*[^0-9a-f]*'
  ),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(
    (locale = 'en' AND derivedFromVersionId IS NULL)
    OR (locale = 'fr' AND derivedFromVersionId IS NOT NULL)
  ),
  CHECK(field = 'meaning' OR valueHtml IS NULL),
  CHECK(supersedesId IS NULL OR supersedesId <> id),
  UNIQUE(entryKey, locale, field, contentHash),
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT,
  FOREIGN KEY(derivedFromVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT,
  FOREIGN KEY(supersedesId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconFieldEvidence (
  id INTEGER PRIMARY KEY,
  fieldVersionId INTEGER NOT NULL,
  sourceAssertionId INTEGER,
  evidenceKind TEXT NOT NULL CHECK(
    evidenceKind IN (
      'direct_source', 'cross_source', 'occurrence', 'legacy',
      'concordance', 'validator', 'review'
    )
  ),
  stance TEXT NOT NULL CHECK(stance IN ('supports', 'contradicts', 'context')),
  witnessFamily TEXT NOT NULL CHECK(length(trim(witnessFamily)) > 0),
  weight REAL NOT NULL CHECK(weight >= 0 AND weight <= 1),
  detailsJson TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detailsJson)),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(fieldVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT,
  FOREIGN KEY(sourceAssertionId) REFERENCES LexiconSourceAssertions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconFieldReviews (
  id INTEGER PRIMARY KEY,
  fieldVersionId INTEGER NOT NULL,
  reviewerType TEXT NOT NULL CHECK(reviewerType IN ('human', 'model', 'rule', 'import')),
  reviewer TEXT NOT NULL CHECK(length(trim(reviewer)) > 0),
  verdict TEXT NOT NULL CHECK(
    verdict IN ('accept', 'reject', 'needs_review', 'source_issue')
  ),
  reason TEXT NOT NULL CHECK(length(trim(reason)) > 0),
  artifactHash TEXT NOT NULL CHECK(
    length(artifactHash) = 64 AND artifactHash NOT GLOB '*[^0-9a-f]*'
  ),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(fieldVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconIssues (
  id INTEGER PRIMARY KEY,
  entryKey TEXT NOT NULL,
  fieldVersionId INTEGER,
  sourceAssertionId INTEGER,
  code TEXT NOT NULL CHECK(length(trim(code)) > 0),
  severity TEXT NOT NULL CHECK(severity IN ('info', 'warning', 'blocker')),
  status TEXT NOT NULL CHECK(status IN ('open', 'resolved', 'waived')),
  detailsJson TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detailsJson)),
  resolutionReviewId INTEGER,
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  resolvedAt TEXT,
  CHECK(
    (status = 'open' AND resolutionReviewId IS NULL AND resolvedAt IS NULL)
    OR (status IN ('resolved', 'waived') AND resolutionReviewId IS NOT NULL AND resolvedAt IS NOT NULL)
  ),
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT,
  FOREIGN KEY(fieldVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT,
  FOREIGN KEY(sourceAssertionId) REFERENCES LexiconSourceAssertions(id) ON DELETE RESTRICT,
  FOREIGN KEY(resolutionReviewId) REFERENCES LexiconFieldReviews(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconCarrierTerms (
  id INTEGER PRIMARY KEY,
  entryKey TEXT NOT NULL,
  strong TEXT NOT NULL CHECK(
    strong GLOB '[GH][0-9][0-9][0-9][0-9]'
    OR strong GLOB '[GH][0-9][0-9][0-9][0-9][0-9]'
  ),
  stepStrong TEXT NOT NULL DEFAULT '' CHECK(
    stepStrong = ''
    OR stepStrong GLOB '[GH][0-9][0-9][0-9][0-9]'
    OR stepStrong GLOB '[GH][0-9][0-9][0-9][0-9][A-Za-z]'
    OR stepStrong GLOB '[GH][0-9][0-9][0-9][0-9][0-9]'
  ),
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr')),
  surface TEXT NOT NULL CHECK(length(trim(surface)) > 0),
  normalized TEXT NOT NULL CHECK(length(trim(normalized)) > 0),
  termKind TEXT NOT NULL CHECK(termKind IN ('word', 'stem', 'phrase', 'proper_name')),
  state TEXT NOT NULL CHECK(
    state IN ('candidate', 'auto_validated', 'human_validated', 'rejected', 'superseded')
  ),
  policy TEXT NOT NULL CHECK(policy IN ('auto_safe', 'review_only', 'blocked')),
  confidence REAL NOT NULL CHECK(confidence >= 0 AND confidence <= 1),
  derivedFromVersionId INTEGER,
  contentHash TEXT NOT NULL CHECK(
    length(contentHash) = 64 AND contentHash NOT GLOB '*[^0-9a-f]*'
  ),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  CHECK(policy <> 'auto_safe' OR state IN ('auto_validated', 'human_validated')),
  UNIQUE(entryKey, strong, stepStrong, locale, normalized, termKind, contentHash),
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT,
  FOREIGN KEY(derivedFromVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconCarrierEvidence (
  id INTEGER PRIMARY KEY,
  carrierTermId INTEGER NOT NULL,
  sourceId INTEGER NOT NULL,
  sourceAssertionId INTEGER,
  witnessFamily TEXT NOT NULL CHECK(length(trim(witnessFamily)) > 0),
  verseRef TEXT,
  evidenceKind TEXT NOT NULL CHECK(
    evidenceKind IN (
      'exact', 'stem', 'phrase', 'proper_name', 'legacy',
      'concordance', 'occurrence', 'review'
    )
  ),
  stance TEXT NOT NULL CHECK(stance IN ('supports', 'contradicts', 'context')),
  observedSurface TEXT NOT NULL CHECK(length(trim(observedSurface)) > 0),
  occurrenceCount INTEGER NOT NULL DEFAULT 1 CHECK(occurrenceCount > 0),
  weight REAL NOT NULL CHECK(weight >= 0 AND weight <= 1),
  detailsJson TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(detailsJson)),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  FOREIGN KEY(carrierTermId) REFERENCES LexiconCarrierTerms(id) ON DELETE RESTRICT,
  FOREIGN KEY(sourceId) REFERENCES LexiconSources(id) ON DELETE RESTRICT,
  FOREIGN KEY(sourceAssertionId) REFERENCES LexiconSourceAssertions(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS LexiconReleases (
  id INTEGER PRIMARY KEY,
  releaseKey TEXT NOT NULL UNIQUE CHECK(length(trim(releaseKey)) > 0),
  state TEXT NOT NULL CHECK(state IN ('building', 'candidate', 'promoted', 'failed')),
  expectedEntryCount INTEGER NOT NULL CHECK(expectedEntryCount > 0),
  sourceFingerprint TEXT NOT NULL CHECK(
    length(sourceFingerprint) = 64 AND sourceFingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  codeFingerprint TEXT NOT NULL CHECK(
    length(codeFingerprint) = 64 AND codeFingerprint NOT GLOB '*[^0-9a-f]*'
  ),
  policyVersion TEXT NOT NULL CHECK(length(trim(policyVersion)) > 0),
  manifestJson TEXT NOT NULL DEFAULT '{}' CHECK(json_valid(manifestJson)),
  createdAt TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
  promotedAt TEXT,
  CHECK(
    (state = 'promoted' AND promotedAt IS NOT NULL)
    OR (state <> 'promoted' AND promotedAt IS NULL)
  )
);

CREATE TABLE IF NOT EXISTS LexiconReleaseFields (
  releaseId INTEGER NOT NULL,
  entryKey TEXT NOT NULL,
  locale TEXT NOT NULL CHECK(locale IN ('en', 'fr')),
  field TEXT NOT NULL CHECK(field IN ('gloss', 'meaning', 'notes')),
  fieldVersionId INTEGER NOT NULL,
  PRIMARY KEY(releaseId, entryKey, locale, field),
  UNIQUE(releaseId, fieldVersionId),
  FOREIGN KEY(releaseId) REFERENCES LexiconReleases(id) ON DELETE CASCADE,
  FOREIGN KEY(entryKey) REFERENCES LexiconEntries(entryKey) ON DELETE RESTRICT,
  FOREIGN KEY(fieldVersionId) REFERENCES LexiconFieldVersions(id) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS LexiconReleaseCarriers (
  releaseId INTEGER NOT NULL,
  carrierTermId INTEGER NOT NULL,
  PRIMARY KEY(releaseId, carrierTermId),
  FOREIGN KEY(releaseId) REFERENCES LexiconReleases(id) ON DELETE CASCADE,
  FOREIGN KEY(carrierTermId) REFERENCES LexiconCarrierTerms(id) ON DELETE RESTRICT
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_LexiconEntries_eStrong
  ON LexiconEntries(eStrong);
CREATE INDEX IF NOT EXISTS idx_LexiconEntries_language_baseCode
  ON LexiconEntries(language, baseCode);
CREATE INDEX IF NOT EXISTS idx_LexiconSourceAssertions_entry_field
  ON LexiconSourceAssertions(entryKey, field, locale);
CREATE INDEX IF NOT EXISTS idx_LexiconSourceAssertions_source
  ON LexiconSourceAssertions(sourceId);
CREATE INDEX IF NOT EXISTS idx_LexiconFieldVersions_entry_locale_field
  ON LexiconFieldVersions(entryKey, locale, field, state);
CREATE INDEX IF NOT EXISTS idx_LexiconFieldVersions_state
  ON LexiconFieldVersions(state);
CREATE INDEX IF NOT EXISTS idx_LexiconFieldEvidence_version
  ON LexiconFieldEvidence(fieldVersionId);
CREATE INDEX IF NOT EXISTS idx_LexiconFieldReviews_version
  ON LexiconFieldReviews(fieldVersionId, createdAt);
CREATE INDEX IF NOT EXISTS idx_LexiconIssues_open
  ON LexiconIssues(entryKey, severity, status);
CREATE INDEX IF NOT EXISTS idx_LexiconCarrierTerms_lookup
  ON LexiconCarrierTerms(locale, strong, stepStrong, normalized);
CREATE INDEX IF NOT EXISTS idx_LexiconCarrierTerms_state_policy
  ON LexiconCarrierTerms(state, policy);
CREATE INDEX IF NOT EXISTS idx_LexiconCarrierEvidence_term
  ON LexiconCarrierEvidence(carrierTermId, stance);
CREATE INDEX IF NOT EXISTS idx_LexiconReleaseFields_version
  ON LexiconReleaseFields(fieldVersionId);
CREATE INDEX IF NOT EXISTS idx_LexiconReleaseCarriers_term
  ON LexiconReleaseCarriers(carrierTermId);

CREATE TRIGGER IF NOT EXISTS trg_LexiconEntryIds_identity_immutable
BEFORE UPDATE OF entryKey, stepEntryId ON LexiconEntryIds
BEGIN
  SELECT RAISE(ABORT, 'lexicon-entry-id-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconEntryIds_no_delete
BEFORE DELETE ON LexiconEntryIds
BEGIN
  SELECT RAISE(ABORT, 'lexicon-entry-id-no-delete');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconSourceAssertions_no_update
BEFORE UPDATE ON LexiconSourceAssertions
BEGIN
  SELECT RAISE(ABORT, 'lexicon-source-assertion-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconSourceAssertions_no_delete
BEFORE DELETE ON LexiconSourceAssertions
BEGIN
  SELECT RAISE(ABORT, 'lexicon-source-assertion-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldVersions_fr_source_insert
BEFORE INSERT ON LexiconFieldVersions
WHEN NEW.locale = 'fr'
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconFieldVersions source
    WHERE source.id = NEW.derivedFromVersionId
      AND source.entryKey = NEW.entryKey
      AND source.locale = 'en'
      AND source.field = NEW.field
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-fr-derived-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldVersions_fr_source_update
BEFORE UPDATE OF entryKey, locale, field, derivedFromVersionId ON LexiconFieldVersions
WHEN NEW.locale = 'fr'
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconFieldVersions source
    WHERE source.id = NEW.derivedFromVersionId
      AND source.entryKey = NEW.entryKey
      AND source.locale = 'en'
      AND source.field = NEW.field
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-fr-derived-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldVersions_content_immutable
BEFORE UPDATE OF
  entryKey, locale, field, valueText, valueHtml, method, generator,
  promptVersion, derivedFromVersionId, supersedesId, contentHash, createdAt
ON LexiconFieldVersions
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-version-content-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldVersions_released_state_immutable
BEFORE UPDATE OF state, confidence ON LexiconFieldVersions
WHEN EXISTS (
  SELECT 1
  FROM LexiconReleaseFields field
  JOIN LexiconReleases release ON release.id = field.releaseId
  WHERE field.fieldVersionId = OLD.id
    AND release.state = 'promoted'
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-released-field-version-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldEvidence_target_insert
BEFORE INSERT ON LexiconFieldEvidence
WHEN NEW.sourceAssertionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconSourceAssertions assertion
    JOIN LexiconFieldVersions version ON version.id = NEW.fieldVersionId
    WHERE assertion.id = NEW.sourceAssertionId
      AND assertion.entryKey = version.entryKey
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-evidence-entry-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldEvidence_no_update
BEFORE UPDATE ON LexiconFieldEvidence
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-evidence-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldEvidence_no_delete
BEFORE DELETE ON LexiconFieldEvidence
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-evidence-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldReviews_no_update
BEFORE UPDATE ON LexiconFieldReviews
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-review-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconFieldReviews_no_delete
BEFORE DELETE ON LexiconFieldReviews
BEGIN
  SELECT RAISE(ABORT, 'lexicon-field-review-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierTerms_source_insert
BEFORE INSERT ON LexiconCarrierTerms
WHEN NEW.derivedFromVersionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconFieldVersions source
    WHERE source.id = NEW.derivedFromVersionId
      AND source.entryKey = NEW.entryKey
      AND source.locale = NEW.locale
      AND source.field = 'gloss'
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-display-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierTerms_source_update
BEFORE UPDATE OF entryKey, locale, derivedFromVersionId ON LexiconCarrierTerms
WHEN NEW.derivedFromVersionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconFieldVersions source
    WHERE source.id = NEW.derivedFromVersionId
      AND source.entryKey = NEW.entryKey
      AND source.locale = NEW.locale
      AND source.field = 'gloss'
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-display-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierTerms_content_immutable
BEFORE UPDATE OF
  entryKey, strong, stepStrong, locale, surface, normalized, termKind,
  derivedFromVersionId, contentHash, createdAt
ON LexiconCarrierTerms
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-content-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierTerms_released_state_immutable
BEFORE UPDATE OF state, policy, confidence ON LexiconCarrierTerms
WHEN EXISTS (
  SELECT 1
  FROM LexiconReleaseCarriers carrier
  JOIN LexiconReleases release ON release.id = carrier.releaseId
  WHERE carrier.carrierTermId = OLD.id
    AND release.state = 'promoted'
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-released-carrier-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierEvidence_source_insert
BEFORE INSERT ON LexiconCarrierEvidence
WHEN NEW.sourceAssertionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconSourceAssertions assertion
    JOIN LexiconCarrierTerms term ON term.id = NEW.carrierTermId
    WHERE assertion.id = NEW.sourceAssertionId
      AND assertion.sourceId = NEW.sourceId
      AND assertion.entryKey = term.entryKey
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-evidence-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierEvidence_source_update
BEFORE UPDATE OF sourceId, sourceAssertionId ON LexiconCarrierEvidence
WHEN NEW.sourceAssertionId IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM LexiconSourceAssertions assertion
    JOIN LexiconCarrierTerms term ON term.id = NEW.carrierTermId
    WHERE assertion.id = NEW.sourceAssertionId
      AND assertion.sourceId = NEW.sourceId
      AND assertion.entryKey = term.entryKey
  )
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-evidence-source-mismatch');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierEvidence_no_update
BEFORE UPDATE ON LexiconCarrierEvidence
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-evidence-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconCarrierEvidence_no_delete
BEFORE DELETE ON LexiconCarrierEvidence
BEGIN
  SELECT RAISE(ABORT, 'lexicon-carrier-evidence-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseFields_validate_insert
BEFORE INSERT ON LexiconReleaseFields
WHEN NOT EXISTS (
  SELECT 1
  FROM LexiconFieldVersions version
  WHERE version.id = NEW.fieldVersionId
    AND version.entryKey = NEW.entryKey
    AND version.locale = NEW.locale
    AND version.field = NEW.field
    AND version.state IN ('auto_validated', 'human_validated')
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-release-field-invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseFields_validate_update
BEFORE UPDATE ON LexiconReleaseFields
WHEN NOT EXISTS (
  SELECT 1
  FROM LexiconFieldVersions version
  WHERE version.id = NEW.fieldVersionId
    AND version.entryKey = NEW.entryKey
    AND version.locale = NEW.locale
    AND version.field = NEW.field
    AND version.state IN ('auto_validated', 'human_validated')
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-release-field-invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseCarriers_validate_insert
BEFORE INSERT ON LexiconReleaseCarriers
WHEN NOT EXISTS (
  SELECT 1
  FROM LexiconCarrierTerms term
  WHERE term.id = NEW.carrierTermId
    AND term.state IN ('auto_validated', 'human_validated')
    AND term.policy <> 'blocked'
    AND EXISTS (
      SELECT 1
      FROM LexiconCarrierEvidence evidence
      JOIN LexiconSources source ON source.id = evidence.sourceId
      WHERE evidence.carrierTermId = term.id
        AND evidence.stance = 'supports'
        AND source.allowCarrier = 1
    )
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-release-carrier-invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseCarriers_validate_update
BEFORE UPDATE ON LexiconReleaseCarriers
WHEN NOT EXISTS (
  SELECT 1
  FROM LexiconCarrierTerms term
  WHERE term.id = NEW.carrierTermId
    AND term.state IN ('auto_validated', 'human_validated')
    AND term.policy <> 'blocked'
    AND EXISTS (
      SELECT 1
      FROM LexiconCarrierEvidence evidence
      JOIN LexiconSources source ON source.id = evidence.sourceId
      WHERE evidence.carrierTermId = term.id
        AND evidence.stance = 'supports'
        AND source.allowCarrier = 1
    )
)
BEGIN
  SELECT RAISE(ABORT, 'lexicon-release-carrier-invalid');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleases_validate_promotion
BEFORE UPDATE OF state ON LexiconReleases
WHEN NEW.state = 'promoted' AND OLD.state <> 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-release-must-be-candidate')
  WHERE OLD.state <> 'candidate';

  SELECT RAISE(ABORT, 'lexicon-release-authoring-count-mismatch')
  WHERE NEW.expectedEntryCount <> (SELECT count(*) FROM LexiconEntries);

  SELECT RAISE(ABORT, 'lexicon-release-entry-count-mismatch')
  WHERE (
    SELECT count(DISTINCT entryKey)
    FROM LexiconReleaseFields
    WHERE releaseId = OLD.id
  ) <> NEW.expectedEntryCount;

  SELECT RAISE(ABORT, 'lexicon-release-required-fields-incomplete')
  WHERE (
    SELECT count(*)
    FROM LexiconReleaseFields
    WHERE releaseId = OLD.id
      AND locale IN ('en', 'fr')
      AND field IN ('gloss', 'meaning')
  ) <> NEW.expectedEntryCount * CASE
    WHEN json_extract(NEW.manifestJson, '$.schemaVersion') =
         'lexicon-v3-release-manifest@2' THEN 4
    WHEN json_extract(NEW.manifestJson, '$.releaseProfile') = 'bilingual' THEN 4
    WHEN json_extract(NEW.manifestJson, '$.releaseProfile') = 'core-en' THEN 2
    ELSE -1
  END;

  SELECT RAISE(ABORT, 'lexicon-release-field-profile-invalid')
  WHERE EXISTS (
      SELECT 1
      FROM LexiconReleaseFields
      WHERE releaseId = OLD.id
        AND (
          field NOT IN ('gloss', 'meaning')
          OR (
            json_extract(NEW.manifestJson, '$.releaseProfile') = 'core-en'
            AND locale <> 'en'
          )
        )
    );

  SELECT RAISE(ABORT, 'lexicon-release-field-invalid')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields field
    JOIN LexiconFieldVersions version ON version.id = field.fieldVersionId
    WHERE field.releaseId = OLD.id
      AND (
        version.entryKey <> field.entryKey
        OR version.locale <> field.locale
        OR version.field <> field.field
        OR version.state NOT IN ('auto_validated', 'human_validated')
      )
  );

  SELECT RAISE(ABORT, 'lexicon-release-auto-confidence-too-low')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields releaseField
    JOIN LexiconFieldVersions field ON field.id = releaseField.fieldVersionId
    WHERE releaseField.releaseId = OLD.id
      AND field.state = 'auto_validated'
      AND field.confidence < 0.9
  );

  SELECT RAISE(ABORT, 'lexicon-release-missing-admissible-evidence')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields releaseField
    JOIN LexiconFieldVersions field ON field.id = releaseField.fieldVersionId
    WHERE releaseField.releaseId = OLD.id
      AND NOT EXISTS (
        SELECT 1
        FROM LexiconFieldEvidence evidence
        JOIN LexiconSourceAssertions assertion
          ON assertion.id = evidence.sourceAssertionId
        JOIN LexiconSources source ON source.id = assertion.sourceId
        WHERE evidence.fieldVersionId = field.id
          AND evidence.stance = 'supports'
          AND assertion.entryKey = field.entryKey
          AND assertion.field = field.field
          AND source.rightsStatus = 'cleared'
          AND source.allowDisplay = 1
          AND (
            (field.locale = 'en'
              AND assertion.locale IN ('en', 'mul')
              AND source.allowTranslation = 1)
            OR
            (field.locale = 'fr'
              AND assertion.locale IN ('fr', 'mul')
              AND evidence.evidenceKind IN ('review', 'validator'))
          )
      )
  );

  SELECT RAISE(ABORT, 'lexicon-release-missing-hebrew-open-source')
  WHERE EXISTS (SELECT 1 FROM LexiconEntries WHERE language = 'hebrew')
    AND NOT EXISTS (
      SELECT 1 FROM LexiconSources
      WHERE sourceKey = 'artifact-hebrew-open-english'
    );

  SELECT RAISE(ABORT, 'lexicon-release-manifest-invalid')
  WHERE json_extract(NEW.manifestJson, '$.schemaVersion') NOT IN (
          'lexicon-v3-release-manifest@2',
          'lexicon-v3-release-manifest@3',
          'lexicon-v3-release-manifest@4'
        )
    OR (
      json_extract(NEW.manifestJson, '$.schemaVersion') IN (
        'lexicon-v3-release-manifest@3',
        'lexicon-v3-release-manifest@4'
      )
      AND (
        coalesce(json_extract(
          NEW.manifestJson, '$.releaseProfile'
        ), '') NOT IN ('bilingual', 'core-en')
        OR coalesce(json_type(
          NEW.manifestJson, '$.fieldCount'
        ), '') <> 'integer'
        OR json_extract(NEW.manifestJson, '$.fieldCount') <>
          (SELECT count(*) FROM LexiconReleaseFields WHERE releaseId = OLD.id)
        OR coalesce(json_type(
          NEW.manifestJson, '$.carrierCount'
        ), '') <> 'integer'
        OR json_extract(NEW.manifestJson, '$.carrierCount') <>
          (SELECT count(*) FROM LexiconReleaseCarriers WHERE releaseId = OLD.id)
        OR coalesce(length(json_extract(
          NEW.manifestJson, '$.snapshotFingerprint'
        )), -1) <> 64
        OR coalesce(json_extract(
          NEW.manifestJson, '$.sourceFingerprint'
        ), '') <>
          NEW.sourceFingerprint
        OR coalesce(json_extract(
          NEW.manifestJson, '$.codeFingerprint'
        ), '') <>
          NEW.codeFingerprint
        OR (
          json_extract(NEW.manifestJson, '$.schemaVersion') =
            'lexicon-v3-release-manifest@4'
          AND (
            coalesce(length(json_extract(
              NEW.manifestJson, '$.sourceLogicalFingerprint'
            )), -1) <> 64
            OR coalesce(json_extract(
              NEW.manifestJson, '$.policyVersion'
            ), '') <> NEW.policyVersion
            OR NEW.policyVersion <> CASE
              WHEN json_extract(
                NEW.manifestJson, '$.releaseProfile'
              ) = 'core-en'
                THEN 'lexicon-v3-core-en-release-policy@1'
              ELSE 'lexicon-v3-release-policy@2'
            END
          )
        )
      )
    )
    OR json_type(NEW.manifestJson, '$.rightsManifest') IS NOT 'array'
    OR coalesce(length(json_extract(
      NEW.manifestJson, '$.rightsManifestDigest'
    )), -1) <> 64;

  SELECT RAISE(ABORT, 'lexicon-release-entry-id-missing')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields field
    LEFT JOIN LexiconEntryIds ids ON ids.entryKey = field.entryKey
    WHERE field.releaseId = OLD.id
      AND ids.entryKey IS NULL
  );

  SELECT RAISE(ABORT, 'lexicon-release-fr-source-mismatch')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields fr
    JOIN LexiconFieldVersions version ON version.id = fr.fieldVersionId
    LEFT JOIN LexiconReleaseFields en
      ON en.releaseId = fr.releaseId
     AND en.entryKey = fr.entryKey
     AND en.locale = 'en'
     AND en.field = fr.field
    WHERE fr.releaseId = OLD.id
      AND fr.locale = 'fr'
      AND (en.fieldVersionId IS NULL OR en.fieldVersionId <> version.derivedFromVersionId)
  );

  SELECT RAISE(ABORT, 'lexicon-release-open-blocker')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields field
    JOIN LexiconIssues issue ON issue.entryKey = field.entryKey
    WHERE field.releaseId = OLD.id
      AND issue.severity IN ('blocker', 'warning')
      AND issue.status = 'open'
      AND (issue.fieldVersionId IS NULL OR issue.fieldVersionId = field.fieldVersionId)
  );

  SELECT RAISE(ABORT, 'lexicon-release-rights-blocked')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields field
    JOIN LexiconFieldEvidence evidence
      ON evidence.fieldVersionId = field.fieldVersionId
    JOIN LexiconSourceAssertions assertion
      ON assertion.id = evidence.sourceAssertionId
    JOIN LexiconSources source ON source.id = assertion.sourceId
    WHERE field.releaseId = OLD.id
      AND evidence.stance = 'supports'
      AND (source.rightsStatus <> 'cleared' OR source.allowDisplay <> 1)
  );

  SELECT RAISE(ABORT, 'lexicon-release-translation-rights-blocked')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseFields fr
    JOIN LexiconFieldVersions frVersion ON frVersion.id = fr.fieldVersionId
    JOIN LexiconFieldEvidence evidence
      ON evidence.fieldVersionId = frVersion.derivedFromVersionId
    JOIN LexiconSourceAssertions assertion
      ON assertion.id = evidence.sourceAssertionId
    JOIN LexiconSources source ON source.id = assertion.sourceId
    WHERE fr.releaseId = OLD.id
      AND fr.locale = 'fr'
      AND evidence.stance = 'supports'
      AND (source.rightsStatus <> 'cleared' OR source.allowTranslation <> 1)
  );

  SELECT RAISE(ABORT, 'lexicon-release-carrier-invalid')
  WHERE EXISTS (
    SELECT 1
    FROM LexiconReleaseCarriers carrier
    JOIN LexiconCarrierTerms term ON term.id = carrier.carrierTermId
    WHERE carrier.releaseId = OLD.id
      AND (
        term.state NOT IN ('auto_validated', 'human_validated')
        OR term.policy = 'blocked'
        OR NOT EXISTS (
          SELECT 1
          FROM LexiconCarrierEvidence evidence
          JOIN LexiconSources source ON source.id = evidence.sourceId
          WHERE evidence.carrierTermId = term.id
            AND evidence.stance = 'supports'
            AND source.allowCarrier = 1
        )
      )
  );

  SELECT RAISE(ABORT, 'lexicon-release-core-en-carriers-present')
  WHERE json_extract(NEW.manifestJson, '$.releaseProfile') = 'core-en'
    AND EXISTS (
      SELECT 1 FROM LexiconReleaseCarriers WHERE releaseId = OLD.id
    );
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleases_promoted_no_update
BEFORE UPDATE ON LexiconReleases
WHEN OLD.state = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleases_promoted_no_delete
BEFORE DELETE ON LexiconReleases
WHEN OLD.state = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseFields_promoted_no_insert
BEFORE INSERT ON LexiconReleaseFields
WHEN (SELECT state FROM LexiconReleases WHERE id = NEW.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-fields-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseFields_promoted_no_update
BEFORE UPDATE ON LexiconReleaseFields
WHEN (SELECT state FROM LexiconReleases WHERE id = OLD.releaseId) = 'promoted'
  OR (SELECT state FROM LexiconReleases WHERE id = NEW.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-fields-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseFields_promoted_no_delete
BEFORE DELETE ON LexiconReleaseFields
WHEN (SELECT state FROM LexiconReleases WHERE id = OLD.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-fields-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseCarriers_promoted_no_insert
BEFORE INSERT ON LexiconReleaseCarriers
WHEN (SELECT state FROM LexiconReleases WHERE id = NEW.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-carriers-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseCarriers_promoted_no_update
BEFORE UPDATE ON LexiconReleaseCarriers
WHEN (SELECT state FROM LexiconReleases WHERE id = OLD.releaseId) = 'promoted'
  OR (SELECT state FROM LexiconReleases WHERE id = NEW.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-carriers-immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_LexiconReleaseCarriers_promoted_no_delete
BEFORE DELETE ON LexiconReleaseCarriers
WHEN (SELECT state FROM LexiconReleases WHERE id = OLD.releaseId) = 'promoted'
BEGIN
  SELECT RAISE(ABORT, 'lexicon-promoted-release-carriers-immutable');
END;
`;
