import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  createLexiconV3Schema,
  LEXICON_V3_SCHEMA_VERSION,
  verifyLexiconV3Schema
} from "../src/lexiconV3/schema.js";

test("creates and verifies the normalized lexicon v3 schema", (t) => {
  const db = openTestDatabase(t);

  createLexiconV3Schema(db);
  createLexiconV3Schema(db);

  const verification = verifyLexiconV3Schema(db);
  assert.equal(verification.ok, true, JSON.stringify(verification, null, 2));
  assert.equal(verification.schemaVersion, LEXICON_V3_SCHEMA_VERSION);
  assert.equal(verification.userVersion, 3);
  assert.equal(verification.foreignKeysEnabled, true);
  assert.equal(verification.integrity, "ok");
  assert.equal(verification.foreignKeyViolations, 0);
  assert.deepEqual(verification.missingTables, []);
  assert.deepEqual(verification.missingIndexes, []);
  assert.deepEqual(verification.missingTriggers, []);
});

test("refuses a different authoring schema version before mutating it", (t) => {
  const db = openTestDatabase(t);
  db.exec(`
    CREATE TABLE LexiconV3Meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO LexiconV3Meta (key, value) VALUES ('schemaVersion', 'lexicon-v2');
  `);

  assert.throws(
    () => createLexiconV3Schema(db),
    /lexicon-v3-schema-version-mismatch:lexicon-v2:lexicon-v3@1/
  );
  const row = db
    .prepare(
      "SELECT count(*) AS count FROM sqlite_master WHERE type = 'table' AND name = 'LexiconEntries'"
    )
    .get() as { count: number };
  assert.equal(row.count, 0);
});

test("enforces field status, provenance, and carrier isolation contracts", (t) => {
  const db = openTestDatabase(t);
  createLexiconV3Schema(db);
  insertEntryAndSource(db);

  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconFieldVersions (
          entryKey, locale, field, valueText, state, confidence,
          method, generator, contentHash
        ) VALUES (
          'greek:G1623', 'en', 'gloss', 'sixth', 'trusted', 1,
          'source', 'test', '${hash("9")}'
        )
      `),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconFieldVersions (
          entryKey, locale, field, valueText, state, confidence,
          method, generator, contentHash
        ) VALUES (
          'greek:G1623', 'fr', 'gloss', 'sixième', 'candidate', 0.8,
          'translation', 'test', '${hash("8")}'
        )
      `),
    /lexicon-fr-derived-source-mismatch/
  );

  db.exec(`
    INSERT INTO LexiconFieldVersions (
      entryKey, locale, field, valueText, state, confidence,
      method, generator, contentHash
    ) VALUES (
      'greek:G1623', 'en', 'meaning', 'The ordinal number sixth.',
      'auto_validated', 0.98, 'editorial', 'test', '${hash("7")}'
    );
  `);

  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconFieldVersions (
          entryKey, locale, field, valueText, state, confidence,
          method, generator, derivedFromVersionId, contentHash
        ) VALUES (
          'greek:G1623', 'fr', 'gloss', 'sixième', 'auto_validated', 0.98,
          'translation', 'test',
          (SELECT id FROM LexiconFieldVersions WHERE locale = 'en' AND field = 'meaning'),
          '${hash("6")}'
        )
      `),
    /lexicon-fr-derived-source-mismatch/
  );

  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconCarrierTerms (
          entryKey, strong, locale, surface, normalized, termKind,
          state, policy, confidence, contentHash
        ) VALUES (
          'greek:G1623', 'G1623', 'fr', 'sixième', 'sixieme', 'word',
          'candidate', 'auto_safe', 0.7, '${hash("5")}'
        )
      `),
    /CHECK constraint failed/
  );

  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconSourceAssertions (
          sourceId, entryKey, scope, field, locale, valueText, locator, sha256
        ) VALUES (
          1, 'greek:G9999', 'entry', 'gloss', 'en', 'missing', 'fixture:missing',
          '${hash("4")}'
        )
      `),
    /FOREIGN KEY constraint failed/
  );

  assert.equal(db.prepare("PRAGMA foreign_key_check").all().length, 0);
});

test("promotes only complete coherent snapshots and freezes them", (t) => {
  const db = openTestDatabase(t);
  createLexiconV3Schema(db);
  insertCompleteReleaseFixture(db);

  assert.throws(
    () =>
      db.exec(`
        UPDATE LexiconReleases
        SET state = 'promoted', promotedAt = '2026-07-12T12:00:00.000Z'
        WHERE releaseKey = 'fixture-v3'
      `),
    /lexicon-release-open-blocker/
  );

  db.exec(`
    INSERT INTO LexiconFieldReviews (
      fieldVersionId, reviewerType, reviewer, verdict, reason, artifactHash
    )
    SELECT id, 'human', 'fixture-reviewer', 'accept',
           'The corrected English and French meanings agree.', '${hash("d")}'
    FROM LexiconFieldVersions
    WHERE entryKey = 'greek:G1623' AND locale = 'fr' AND field = 'meaning';

    UPDATE LexiconIssues
    SET status = 'resolved',
        resolutionReviewId = (SELECT id FROM LexiconFieldReviews LIMIT 1),
        resolvedAt = '2026-07-12T11:59:00.000Z'
    WHERE code = 'source-lemma-mismatch';

    UPDATE LexiconReleases
    SET state = 'promoted', promotedAt = '2026-07-12T12:00:00.000Z'
    WHERE releaseKey = 'fixture-v3';
  `);

  const verification = verifyLexiconV3Schema(db);
  assert.equal(verification.ok, true, JSON.stringify(verification, null, 2));

  assert.throws(
    () =>
      db.exec(`
        UPDATE LexiconReleases
        SET manifestJson = '{"changed":true}'
        WHERE releaseKey = 'fixture-v3'
      `),
    /lexicon-promoted-release-immutable/
  );
  assert.throws(
    () =>
      db.exec(`
        DELETE FROM LexiconReleaseFields
        WHERE releaseId = (SELECT id FROM LexiconReleases WHERE releaseKey = 'fixture-v3')
          AND locale = 'fr' AND field = 'gloss'
      `),
    /lexicon-promoted-release-fields-immutable/
  );
  assert.throws(
    () =>
      db.exec(`
        INSERT INTO LexiconReleaseCarriers (releaseId, carrierTermId)
        SELECT release.id, term.id
        FROM LexiconReleases release, LexiconCarrierTerms term
        WHERE release.releaseKey = 'fixture-v3'
      `),
    /lexicon-promoted-release-carriers-immutable|UNIQUE constraint failed/
  );
  assert.throws(
    () => db.exec("UPDATE LexiconEntryIds SET stepEntryId = 9999"),
    /lexicon-entry-id-immutable/
  );
  assert.throws(
    () => db.exec("UPDATE LexiconSourceAssertions SET valueText = 'changed'"),
    /lexicon-source-assertion-immutable/
  );
  assert.throws(
    () =>
      db.exec(`
        UPDATE LexiconFieldVersions
        SET state = 'rejected'
        WHERE locale = 'fr' AND field = 'gloss'
      `),
    /lexicon-released-field-version-immutable/
  );
  assert.throws(
    () => db.exec("UPDATE LexiconCarrierTerms SET policy = 'blocked'"),
    /lexicon-released-carrier-immutable/
  );
  assert.throws(
    () => db.exec("DELETE FROM LexiconFieldEvidence WHERE id = 1"),
    /lexicon-field-evidence-immutable/
  );
  assert.throws(
    () => db.exec("UPDATE LexiconCarrierEvidence SET occurrenceCount = 2"),
    /lexicon-carrier-evidence-immutable/
  );
});

function openTestDatabase(t: test.TestContext): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  t.after(() => db.close());
  return db;
}

function insertEntryAndSource(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO LexiconEntries (
      entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
      uStrong, original, transliteration, morph
    ) VALUES (
      'greek:G1623', 'greek', 1623, 'G1623', 'G1623', 'G1623 =',
      'G1623', 'ἕκτος', 'hektos', 'G:A'
    );

    INSERT INTO LexiconEntryIds (entryKey, stepEntryId)
    VALUES ('greek:G1623', 1673);

    INSERT INTO LexiconSources (
      sourceKey, name, version, witnessFamily, locale, sha256, license,
      rightsStatus, allowDisplay, allowTranslation, allowCarrier
    ) VALUES
      ('step:tbesg:fixture', 'TBESG', 'fixture', 'STEP-TBES', 'en',
       '${hash("a")}', 'CC BY 4.0', 'cleared', 1, 1, 1),
      ('artifact:fr:fixture', 'French review', 'fixture', 'fixture-fr-review',
       'fr', '${hash("f")}', 'project fixture', 'cleared', 1, 0, 1);

    INSERT INTO LexiconSourceAssertions (
      sourceId, entryKey, scope, field, locale, valueText, locator, sha256
    ) VALUES (
      1, 'greek:G1623', 'entry', 'gloss', 'en', 'sixth',
      'TBESG:fixture:G1623', '${hash("b")}'
    );
  `);
}

function insertCompleteReleaseFixture(db: DatabaseSync): void {
  insertEntryAndSource(db);
  db.exec(`
    INSERT INTO LexiconSourceAssertions (
      sourceId, entryKey, scope, field, locale, valueText, locator, sha256
    ) VALUES
      (1, 'greek:G1623', 'entry', 'meaning', 'en',
       'The ordinal number sixth.', 'TBESG:fixture:G1623:meaning', '${hash("c")}'),
      (2, 'greek:G1623', 'entry', 'gloss', 'fr',
       'sixième', 'review:fixture:G1623:gloss', '${hash("d")}'),
      (2, 'greek:G1623', 'entry', 'meaning', 'fr',
       'Le nombre ordinal sixième.', 'review:fixture:G1623:meaning', '${hash("e")}');

    INSERT INTO LexiconFieldVersions (
      entryKey, locale, field, valueText, state, confidence,
      method, generator, contentHash
    ) VALUES
      ('greek:G1623', 'en', 'gloss', 'sixth', 'human_validated', 1,
       'editorial', 'fixture', '${hash("1")}'),
      ('greek:G1623', 'en', 'meaning', 'The ordinal number sixth.',
       'human_validated', 1, 'editorial', 'fixture', '${hash("2")}');

    INSERT INTO LexiconFieldVersions (
      entryKey, locale, field, valueText, valueHtml, state, confidence,
      method, generator, derivedFromVersionId, contentHash
    ) VALUES
      ('greek:G1623', 'fr', 'gloss', 'sixième', NULL, 'human_validated', 1,
       'translation', 'fixture',
       (SELECT id FROM LexiconFieldVersions WHERE locale = 'en' AND field = 'gloss'),
       '${hash("3")}'),
      ('greek:G1623', 'fr', 'meaning', 'Le nombre ordinal sixième.',
       '<p>Le nombre ordinal <b>sixième</b>.</p>', 'human_validated', 1,
       'translation', 'fixture',
       (SELECT id FROM LexiconFieldVersions WHERE locale = 'en' AND field = 'meaning'),
       '${hash("4")}');

    INSERT INTO LexiconFieldEvidence (
      fieldVersionId, sourceAssertionId, evidenceKind, stance,
      witnessFamily, weight
    )
    SELECT id,
           CASE
             WHEN locale = 'en' AND field = 'gloss' THEN 1
             WHEN locale = 'en' AND field = 'meaning' THEN 2
             WHEN locale = 'fr' AND field = 'gloss' THEN 3
             ELSE 4
           END,
           CASE WHEN locale = 'fr' THEN 'review' ELSE 'direct_source' END,
           'supports',
           CASE WHEN locale = 'fr' THEN 'fixture-fr-review' ELSE 'STEP-TBES' END,
           1
    FROM LexiconFieldVersions;

    INSERT INTO LexiconCarrierTerms (
      entryKey, strong, stepStrong, locale, surface, normalized, termKind,
      state, policy, confidence, derivedFromVersionId, contentHash
    ) VALUES (
      'greek:G1623', 'G1623', 'G1623', 'fr', 'sixième', 'sixieme', 'word',
      'human_validated', 'auto_safe', 1,
      (SELECT id FROM LexiconFieldVersions WHERE locale = 'fr' AND field = 'gloss'),
      '${hash("5")}'
    );

    INSERT INTO LexiconCarrierEvidence (
      carrierTermId, sourceId, sourceAssertionId, witnessFamily,
      evidenceKind, stance, observedSurface, occurrenceCount, weight
    ) VALUES (
      1, 2, 3, 'fixture-fr-review', 'review', 'supports', 'sixième', 1, 1
    );

    INSERT INTO LexiconIssues (
      entryKey, fieldVersionId, sourceAssertionId, code, severity, status,
      detailsJson
    ) VALUES (
      'greek:G1623',
      (SELECT id FROM LexiconFieldVersions WHERE locale = 'fr' AND field = 'meaning'),
      1, 'source-lemma-mismatch', 'blocker', 'open',
      '{"sourceLemma":"ἐκτός","entryLemma":"ἕκτος"}'
    );

    INSERT INTO LexiconReleases (
      releaseKey, state, expectedEntryCount, sourceFingerprint,
      codeFingerprint, policyVersion, manifestJson
    ) VALUES (
      'fixture-v3', 'candidate', 1, '${hash("6")}', '${hash("7")}',
      'fixture-policy-v1',
      '{"schemaVersion":"lexicon-v3-release-manifest@2","rightsManifest":[],"rightsManifestDigest":"${hash("8")}"}'
    );

    INSERT INTO LexiconReleaseFields (
      releaseId, entryKey, locale, field, fieldVersionId
    )
    SELECT release.id, version.entryKey, version.locale, version.field, version.id
    FROM LexiconReleases release, LexiconFieldVersions version
    WHERE release.releaseKey = 'fixture-v3';

    INSERT INTO LexiconReleaseCarriers (releaseId, carrierTermId)
    SELECT release.id, term.id
    FROM LexiconReleases release, LexiconCarrierTerms term
    WHERE release.releaseKey = 'fixture-v3';
  `);
}

function hash(character: string): string {
  return character.repeat(64);
}
