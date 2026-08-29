import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  parseLexiconV3ProductionDeployArgs,
  runLexiconV3ProductionDeploy
} from "../scripts/deployLexiconV3Production.js";
import {
  buildLexiconV3BilingualCandidateManifest,
  writeLexiconV3BilingualCandidateManifest
} from "../src/lexiconV3/productionCandidateManifest.js";
import { lexiconV3CodeFingerprint } from "../src/lexiconV3/codeFingerprint.js";
import { resolveLexiconV3CurrentProduction } from "../src/lexiconV3/productionPointer.js";
import {
  buildLexiconV3Production,
  createLexiconV3ReleaseCandidate,
  deployLexiconV3BilingualCandidates,
  LexiconV3ReleaseError,
  planLexiconV3Release,
  publishLexiconV3AtomicPair,
  promoteLexiconV3Release,
  verifyLexiconV3BilingualCandidates,
  verifyLexiconV3Release
} from "../src/lexiconV3/release.js";
import { lexiconV3FieldContentHash } from "../src/lexiconV3/review.js";
import { createLexiconV3Schema } from "../src/lexiconV3/schema.js";
import { lexiconV3SourceLogicalFingerprint } from "../src/lexiconV3/sourceFingerprint.js";
import {
  PINNED_G20354_PERSEUS_ACCESSED_AT,
  PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
  PINNED_G20354_PERSEUS_ATTRIBUTION,
  PINNED_G20354_PERSEUS_LICENSE_URL,
  PINNED_G20354_PERSEUS_MODIFICATIONS,
  PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
  PINNED_G20354_PERSEUS_PROVENANCE_URL,
  PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST
} from "../src/lexiconV3/perseusLsjG20354.js";
import {
  readStrongDictionaryTranslationCandidates,
  resolveDefaultStrongDictionaryInput
} from "../src/strongDictionaryLexicon.js";

const LEGACY_SOURCE_MEANING_SENTINEL =
  "SUPERSEDED_SOURCE_MEANING_SENTINEL_6f315f28_DO_NOT_PUBLISH_".repeat(4);

test("production deployment CLI defaults to the sealed bilingual candidate manifest", () => {
  const parsed = parseLexiconV3ProductionDeployArgs(["--release-key=fixture"]);
  assert.equal(parsed.releaseKey, "fixture");
  assert.equal(
    parsed.candidateManifestPath,
    resolve(
      "outputs/lexicon-v3/strong_lexicon.bilingual.candidate.manifest.json"
    )
  );
  assert.equal(
    parsed.releaseDirectory,
    resolve("data/dictionaries/lexicon-v3-fr/releases/fixture")
  );
  assert.equal(
    parsed.currentManifestPath,
    resolve("data/dictionaries/lexicon-v3-fr/current.json")
  );
  assert.equal(
    parsed.authoringPath,
    resolve("outputs/lexicon-v3/authoring.sqlite")
  );
  assert.throws(
    () =>
      parseLexiconV3ProductionDeployArgs([
        "--release-key",
        "fixture",
        "--write"
      ]),
    /unknown-option:write/u
  );
});

test("production projection refuses authoring, source, and protected outputs", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-safe-output-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const authoringPath = join(directory, "authoring.sqlite");
  const sourcePath = join(directory, "source.sqlite");
  writeFileSync(authoringPath, "not-opened", "utf8");
  writeFileSync(sourcePath, "not-opened", "utf8");
  const common = {
    profile: "core-en" as const,
    authoringPath,
    releaseKey: "never-opened",
    sourcePath,
    overwriteExisting: true
  };
  assert.throws(
    () => buildLexiconV3Production({ ...common, outputPath: authoringPath }),
    /output-must-differ-from-authoring/u
  );
  assert.throws(
    () => buildLexiconV3Production({ ...common, outputPath: sourcePath }),
    /output-must-differ-from-source/u
  );
  for (const outputPath of [
    resolve("data/dictionaries/strong_lexicon.core.production.sqlite"),
    resolve("data/dictionaries/strong_lexicon.full.production.sqlite"),
    resolve("data/dictionaries/strong_lexicon.en.core.production.sqlite")
  ]) {
    assert.throws(
      () => buildLexiconV3Production({ ...common, outputPath }),
      /protected-production-output-refused/u
    );
  }
});

test("release planning refuses incomplete, stale, blocked, and restricted fields", () => {
  const incomplete = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(incomplete);
    insertAuthoringFixture(incomplete, { omitFrenchMeaning: true });
    const plan = planLexiconV3Release(incomplete);
    assert.ok(
      plan.errors.some((error) =>
        error.startsWith("missing-validated-field:greek:G1623:fr:meaning")
      )
    );
    assert.throws(
      () =>
        createLexiconV3ReleaseCandidate(incomplete, {
          releaseKey: "incomplete"
        }),
      (error) =>
        error instanceof LexiconV3ReleaseError &&
        error.errors.some((value) => value.includes("missing-validated-field"))
    );
  } finally {
    incomplete.close();
  }

  const stale = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(stale);
    insertAuthoringFixture(stale, {});
    insertField(stale, {
      locale: "en",
      field: "gloss",
      valueText: "sixth (revised)",
      valueHtml: null,
      state: "human_validated",
      derivedFromVersionId: null
    });
    const plan = planLexiconV3Release(stale);
    assert.ok(
      plan.errors.some((error) =>
        error.startsWith("stale-french-source:greek:G1623:gloss")
      )
    );
  } finally {
    stale.close();
  }

  const restricted = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(restricted);
    insertAuthoringFixture(restricted, { restrictedRights: true });
    const plan = planLexiconV3Release(restricted);
    assert.ok(
      plan.errors.some((error) => error.startsWith("display-rights-blocked:"))
    );
    assert.ok(
      plan.errors.some((error) =>
        error.startsWith("translation-rights-blocked:")
      )
    );
    assert.equal(
      readScalar(
        restricted,
        `SELECT count(*) FROM LexiconFieldEvidence evidence
         JOIN LexiconFieldVersions field ON field.id = evidence.fieldVersionId
         WHERE field.locale = 'fr' AND evidence.sourceAssertionId IS NOT NULL`
      ),
      2,
      "FR must retain its own translation/review provenance"
    );
    assert.ok(
      plan.errors.includes(
        "translation-rights-blocked:greek:G1623:gloss:step:fixture"
      )
    );
    const coreEnglishPlan = planLexiconV3Release(restricted, {
      profile: "core-en"
    });
    assert.ok(
      coreEnglishPlan.errors.some((error) =>
        error.startsWith("display-rights-blocked:greek:G1623:en:")
      )
    );
    assert.ok(
      coreEnglishPlan.errors.some((error) =>
        error.startsWith("missing-admissible-support-evidence:greek:G1623:en:")
      )
    );
  } finally {
    restricted.close();
  }

  const blocked = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(blocked);
    insertAuthoringFixture(blocked, { openBlocker: true });
    const plan = planLexiconV3Release(blocked);
    assert.ok(
      plan.errors.some((error) =>
        error.startsWith("open-blocker:greek:G1623:fixture-blocker")
      )
    );
    assert.ok(
      planLexiconV3Release(blocked, { profile: "core-en" }).errors.some(
        (error) => error.startsWith("open-blocker:greek:G1623:fixture-blocker")
      )
    );
  } finally {
    blocked.close();
  }

  const unpinnedHebrew = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(unpinnedHebrew);
    insertAuthoringFixture(unpinnedHebrew, {});
    insertUnpinnedHebrewArtifactSource(unpinnedHebrew);
    const plan = planLexiconV3Release(unpinnedHebrew);
    assert.ok(
      plan.errors.some((error) =>
        error.startsWith("hebrew-english-unpinned-revision:")
      )
    );
    assert.throws(
      () =>
        createLexiconV3ReleaseCandidate(unpinnedHebrew, {
          releaseKey: "unpinned-hebrew"
        }),
      (error) =>
        error instanceof LexiconV3ReleaseError &&
        error.errors.some((value) =>
          value.startsWith("hebrew-english-unpinned-revision:")
        )
    );
  } finally {
    unpinnedHebrew.close();
  }
});

test("release refuses unproven low-confidence Hebrew content and direct SQL promotion", () => {
  const unproven = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(unproven);
    insertUnprovenHebrewFixture(unproven);
    const plan = planLexiconV3Release(unproven);
    assert.ok(plan.errors.includes("missing-hebrew-open-english-source"));
    assert.ok(
      plan.errors.includes(
        "missing-admissible-support-evidence:hebrew:H0001:en:gloss"
      )
    );
    assert.ok(
      plan.errors.includes(
        "missing-admissible-support-evidence:hebrew:H0001:fr:meaning"
      )
    );
    assert.ok(
      plan.errors.includes(
        "auto-validated-confidence-too-low:hebrew:H0001:en:gloss:0.01"
      )
    );
    assert.throws(
      () =>
        createLexiconV3ReleaseCandidate(unproven, {
          releaseKey: "unproven-hebrew"
        }),
      (error) =>
        error instanceof LexiconV3ReleaseError &&
        error.errors.includes("missing-hebrew-open-english-source")
    );
  } finally {
    unproven.close();
  }

  const direct = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(direct);
    insertAuthoringFixture(direct, {});
    createLexiconV3ReleaseCandidate(direct, {
      releaseKey: "direct-sql-confidence"
    });
    direct
      .prepare(
        `UPDATE LexiconFieldVersions SET state = 'auto_validated', confidence = 0.01
         WHERE id = (
           SELECT fieldVersionId FROM LexiconReleaseFields
           WHERE locale = 'en' AND field = 'gloss' LIMIT 1
         )`
      )
      .run();
    assert.throws(
      () =>
        direct
          .prepare(
            `UPDATE LexiconReleases
             SET state = 'promoted', promotedAt = '2026-07-12T12:00:00.000Z'
             WHERE releaseKey = 'direct-sql-confidence'`
          )
          .run(),
      /lexicon-release-auto-confidence-too-low/u
    );
  } finally {
    direct.close();
  }

  const directWithoutEvidence = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(directWithoutEvidence);
    insertAuthoringFixture(directWithoutEvidence, {
      skipFieldEvidence: true
    });
    insertRawCandidateRelease(directWithoutEvidence, "direct-sql-evidence");
    assert.throws(
      () =>
        promoteReleaseDirectly(directWithoutEvidence, "direct-sql-evidence"),
      /lexicon-release-missing-admissible-evidence/u
    );
  } finally {
    directWithoutEvidence.close();
  }

  const directWithoutHebrewArtifact = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(directWithoutHebrewArtifact);
    insertUnprovenHebrewFixture(directWithoutHebrewArtifact);
    directWithoutHebrewArtifact
      .prepare("UPDATE LexiconFieldVersions SET confidence = 0.95")
      .run();
    insertAdmissibleEvidenceForUnprovenHebrew(directWithoutHebrewArtifact);
    insertRawCandidateRelease(
      directWithoutHebrewArtifact,
      "direct-sql-hebrew-source"
    );
    assert.throws(
      () =>
        promoteReleaseDirectly(
          directWithoutHebrewArtifact,
          "direct-sql-hebrew-source"
        ),
      /lexicon-release-missing-hebrew-open-source/u
    );
  } finally {
    directWithoutHebrewArtifact.close();
  }
});

test("atomic pair publication restores both old profiles if full publication fails", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-atomic-pair-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const coreOutput = join(directory, "core.sqlite");
  const fullOutput = join(directory, "full.sqlite");
  const coreTemporary = join(directory, "core.new.sqlite");
  const missingFullTemporary = join(directory, "full.missing.sqlite");
  writeFileSync(coreOutput, "old-core");
  writeFileSync(fullOutput, "old-full");
  writeFileSync(coreTemporary, "new-core");

  assert.throws(
    () =>
      publishLexiconV3AtomicPair(
        [
          { temporary: coreTemporary, output: coreOutput },
          { temporary: missingFullTemporary, output: fullOutput }
        ],
        true
      ),
    /ENOENT/
  );
  assert.equal(readFileSync(coreOutput, "utf8"), "old-core");
  assert.equal(readFileSync(fullOutput, "utf8"), "old-full");
  assert.equal(existsSync(coreTemporary), false);
});

test("candidate promotion and production projection are exact and carrier-isolated", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-release-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const authoringPath = join(directory, "authoring.sqlite");
  const sourcePath = join(directory, "source.sqlite");
  const corePath = join(directory, "core.sqlite");
  const fullPath = join(directory, "full.sqlite");

  createSourceFixture(sourcePath);
  assert.equal(
    readFileSync(sourcePath).includes(
      Buffer.from(LEGACY_SOURCE_MEANING_SENTINEL, "utf8")
    ),
    true,
    "the source fixture must physically contain the superseded sentinel"
  );
  const sourceForFingerprint = new DatabaseSync(sourcePath, { readOnly: true });
  const sourceLogicalFingerprint =
    lexiconV3SourceLogicalFingerprint(sourceForFingerprint);
  sourceForFingerprint.close();

  const authoring = new DatabaseSync(authoringPath);
  try {
    createLexiconV3Schema(authoring);
    insertAuthoringFixture(authoring, { sourceLogicalFingerprint });
    assert.throws(
      () =>
        createLexiconV3ReleaseCandidate(authoring, {
          releaseKey: "arbitrary-policy",
          policyVersion: "unreviewed-policy@999"
        }),
      /release-policy-version-mismatch/u
    );
    const candidate = createLexiconV3ReleaseCandidate(authoring, {
      releaseKey: "fixture-release"
    });
    assert.equal(candidate.state, "candidate");
    assert.equal(candidate.fieldCount, 4);
    assert.equal(candidate.carrierCount, 2);
    const manifest = JSON.parse(
      String(
        (
          authoring
            .prepare(
              `SELECT manifestJson FROM LexiconReleases
               WHERE releaseKey = 'fixture-release'`
            )
            .get() as { manifestJson: string }
        ).manifestJson
      )
    ) as {
      policyVersion?: string;
      schemaVersion?: string;
      sourceLogicalFingerprint?: string;
    };
    assert.equal(manifest.schemaVersion, "lexicon-v3-release-manifest@4");
    assert.equal(manifest.policyVersion, "lexicon-v3-release-policy@2");
    assert.equal(manifest.sourceLogicalFingerprint, sourceLogicalFingerprint);
    assert.equal(
      verifyLexiconV3Release(authoring, "fixture-release", true).ok,
      true
    );
  } finally {
    authoring.close();
  }
  assert.throws(
    () =>
      buildLexiconV3Production({
        authoringPath,
        releaseKey: "fixture-release",
        sourcePath,
        coreOutputPath: corePath,
        fullOutputPath: fullPath
      }),
    /release-not-promoted/
  );

  const promotionDb = new DatabaseSync(authoringPath);
  try {
    promotionDb.exec("PRAGMA foreign_keys = ON");
    const promoted = promoteLexiconV3Release(
      promotionDb,
      "fixture-release",
      "2026-07-12T12:00:00.000Z"
    );
    assert.equal(promoted.state, "promoted");
  } finally {
    promotionDb.close();
  }

  const rightsDriftDb = new DatabaseSync(authoringPath);
  try {
    rightsDriftDb.exec("PRAGMA foreign_keys = ON");
    rightsDriftDb
      .prepare(
        `UPDATE LexiconSources
         SET license = 'PROPRIETARY-NO-REUSE', metadataJson = '{"drift":true}'
         WHERE sourceKey = 'step:fixture'`
      )
      .run();
    const frozen = verifyLexiconV3Release(
      rightsDriftDb,
      "fixture-release",
      false
    );
    const current = verifyLexiconV3Release(
      rightsDriftDb,
      "fixture-release",
      true
    );
    assert.equal(frozen.ok, true);
    assert.equal(current.ok, false);
    assert.ok(current.errors.includes("stale-release-snapshot"));
    assert.throws(
      () =>
        buildLexiconV3Production({
          authoringPath,
          releaseKey: "fixture-release",
          sourcePath,
          coreOutputPath: join(directory, "rights-drift-core.sqlite"),
          fullOutputPath: join(directory, "rights-drift-full.sqlite")
        }),
      /stale-release-snapshot/u
    );
    rightsDriftDb
      .prepare(
        `UPDATE LexiconSources
         SET license = 'fixture', metadataJson = '{}'
         WHERE sourceKey = 'step:fixture'`
      )
      .run();
  } finally {
    rightsDriftDb.close();
  }

  const logicalDriftDb = new DatabaseSync(authoringPath);
  try {
    logicalDriftDb.exec("PRAGMA foreign_keys = ON");
    logicalDriftDb
      .prepare(
        `UPDATE LexiconV3Meta SET value = ?
         WHERE key = 'sourceLogicalFingerprint'`
      )
      .run(hash("post-promotion-source-logical-drift"));
    const current = verifyLexiconV3Release(
      logicalDriftDb,
      "fixture-release",
      true
    );
    assert.equal(current.ok, false);
    assert.ok(current.errors.includes("stale-release-snapshot"));
    assert.throws(
      () =>
        buildLexiconV3Production({
          authoringPath,
          releaseKey: "fixture-release",
          sourcePath,
          coreOutputPath: join(directory, "logical-drift-core.sqlite"),
          fullOutputPath: join(directory, "logical-drift-full.sqlite")
        }),
      /stale-release-snapshot/u
    );
    logicalDriftDb
      .prepare(
        `UPDATE LexiconV3Meta SET value = ?
         WHERE key = 'sourceLogicalFingerprint'`
      )
      .run(sourceLogicalFingerprint);
  } finally {
    logicalDriftDb.close();
  }

  const corruptedSource = join(directory, "source-corrupted.sqlite");
  copyFileSync(sourcePath, corruptedSource);
  const corrupted = new DatabaseSync(corruptedSource);
  corrupted
    .prepare("UPDATE StepEntries SET original = 'corrupted' WHERE id = 73")
    .run();
  corrupted.close();
  assert.throws(
    () =>
      buildLexiconV3Production({
        authoringPath,
        releaseKey: "fixture-release",
        sourcePath: corruptedSource,
        coreOutputPath: join(directory, "corrupt-core.sqlite"),
        fullOutputPath: join(directory, "corrupt-full.sqlite")
      }),
    /source-logical-fingerprint-mismatch/u
  );

  const corruptedMorphologySource = join(
    directory,
    "source-morphology-corrupted.sqlite"
  );
  copyFileSync(sourcePath, corruptedMorphologySource);
  const corruptedMorphology = new DatabaseSync(corruptedMorphologySource);
  corruptedMorphology
    .prepare("UPDATE MorphologyCodes SET meaning = 'corrupted' WHERE id = 1")
    .run();
  corruptedMorphology.close();
  assert.throws(
    () =>
      buildLexiconV3Production({
        authoringPath,
        releaseKey: "fixture-release",
        sourcePath: corruptedMorphologySource,
        coreOutputPath: join(directory, "corrupt-morph-core.sqlite"),
        fullOutputPath: join(directory, "corrupt-morph-full.sqlite")
      }),
    /source-logical-fingerprint-mismatch/u
  );

  const extendedSource = join(directory, "source-extra-table.sqlite");
  copyFileSync(sourcePath, extendedSource);
  const extended = new DatabaseSync(extendedSource);
  extended.exec(
    "CREATE TABLE UnexpectedFrenchPayload (id INTEGER PRIMARY KEY, value TEXT NOT NULL)"
  );
  extended.close();
  assert.throws(
    () =>
      buildLexiconV3Production({
        authoringPath,
        releaseKey: "fixture-release",
        sourcePath: extendedSource,
        coreOutputPath: join(directory, "extra-table-core.sqlite"),
        fullOutputPath: join(directory, "extra-table-full.sqlite")
      }),
    /source-schema-extra-table:UnexpectedFrenchPayload/u
  );

  const result = buildLexiconV3Production({
    authoringPath,
    releaseKey: "fixture-release",
    sourcePath,
    coreOutputPath: corePath,
    fullOutputPath: fullPath
  });
  assert.equal(result.core.integrity, "ok");
  assert.equal(result.full.integrity, "ok");
  assert.equal(result.core.freelistPages, 0);
  assert.equal(result.full.freelistPages, 0);
  assert.equal(result.core.resourceRows, null);
  assert.equal(result.full.resourceRows, 1);
  assert.equal(result.core.resourceTranslationRows, null);
  assert.equal(result.full.resourceTranslationRows, 0);
  assert.equal(result.core.morphologyTranslationRows, 0);
  assert.equal(result.full.morphologyTranslationRows, 0);
  assert.equal(result.core.fieldStatuses, 4);
  assert.equal(result.full.carrierTerms, 2);
  assert.equal(result.core.releaseKey, "fixture-release");
  assert.equal(result.full.releaseKey, "fixture-release");
  assert.match(result.core.sha256, /^[a-f0-9]{64}$/u);
  assert.match(result.full.sha256, /^[a-f0-9]{64}$/u);
  assert.equal(
    result.core.sha256,
    createHash("sha256").update(readFileSync(corePath)).digest("hex")
  );
  assert.equal(
    result.full.sha256,
    createHash("sha256").update(readFileSync(fullPath)).digest("hex")
  );
  assert.match(result.core.logicalFingerprint, /^[a-f0-9]{64}$/u);
  assert.match(result.full.logicalFingerprint, /^[a-f0-9]{64}$/u);
  assert.notEqual(result.core.sha256, result.full.sha256);
  assert.notEqual(
    result.core.logicalFingerprint,
    result.full.logicalFingerprint
  );

  const verifiedCandidates = verifyLexiconV3BilingualCandidates({
    authoringPath,
    sourcePath,
    releaseKey: "fixture-release",
    coreCandidatePath: corePath,
    fullCandidatePath: fullPath,
    expectedCoreSha256: result.core.sha256,
    expectedFullSha256: result.full.sha256,
    expectedCoreLogicalFingerprint: result.core.logicalFingerprint,
    expectedFullLogicalFingerprint: result.full.logicalFingerprint
  });
  assert.equal(verifiedCandidates.core.sha256, result.core.sha256);
  assert.equal(verifiedCandidates.full.sha256, result.full.sha256);
  assert.throws(
    () =>
      verifyLexiconV3BilingualCandidates({
        authoringPath,
        sourcePath,
        releaseKey: "fixture-release",
        coreCandidatePath: corePath,
        fullCandidatePath: fullPath,
        expectedCoreSha256: "0".repeat(64),
        expectedFullSha256: result.full.sha256,
        expectedCoreLogicalFingerprint: result.core.logicalFingerprint,
        expectedFullLogicalFingerprint: result.full.logicalFingerprint
      }),
    /core-candidate-sha256-mismatch/u
  );

  const assertTamperedCandidateRejected = (
    name: string,
    profile: "core" | "full",
    sql: string,
    expected: RegExp
  ): void => {
    const tamperedPath = join(directory, `tampered-${name}.sqlite`);
    const originalPath = profile === "core" ? corePath : fullPath;
    copyFileSync(originalPath, tamperedPath);
    const tampered = new DatabaseSync(tamperedPath);
    try {
      tampered.exec(sql);
    } finally {
      tampered.close();
    }
    const tamperedSha256 = createHash("sha256")
      .update(readFileSync(tamperedPath))
      .digest("hex");
    assert.throws(
      () =>
        verifyLexiconV3BilingualCandidates({
          authoringPath,
          sourcePath,
          releaseKey: "fixture-release",
          coreCandidatePath: profile === "core" ? tamperedPath : corePath,
          fullCandidatePath: profile === "full" ? tamperedPath : fullPath,
          expectedCoreSha256:
            profile === "core" ? tamperedSha256 : result.core.sha256,
          expectedFullSha256:
            profile === "full" ? tamperedSha256 : result.full.sha256,
          expectedCoreLogicalFingerprint: result.core.logicalFingerprint,
          expectedFullLogicalFingerprint: result.full.logicalFingerprint
        }),
      expected
    );
  };
  assertTamperedCandidateRejected(
    "field-status",
    "core",
    "UPDATE LexiconFieldStatus SET method = 'tampered' WHERE locale = 'en' AND field = 'gloss'",
    /projection-field-status-mismatch/u
  );
  assertTamperedCandidateRejected(
    "carrier",
    "core",
    "UPDATE LexiconCarrierTerms SET normalized = 'tampered' WHERE id = 1",
    /projection-carrier-terms-mismatch/u
  );
  assertTamperedCandidateRejected(
    "metadata",
    "full",
    "UPDATE DictionaryMeta SET value = 'tampered' WHERE key = 'lexiconV3PolicyVersion'",
    /projection-lexicon-v3-meta-mismatch/u
  );
  assertTamperedCandidateRejected(
    "translation-language",
    "core",
    `INSERT INTO LexiconTranslations
       (stepEntryId, language, gloss, meaning, meaningHtml)
     VALUES (73, 'es', 'sexto', 'El número ordinal sexto.', '<p>sexto</p>')`,
    /unexpected-translation-language-rows/u
  );
  assertTamperedCandidateRejected(
    "resource-translation",
    "full",
    `INSERT INTO LexiconResourceTranslations
       (resourceId, language, contentHtml, contentText)
     VALUES (1, 'fr', '<p>ressource historique</p>', 'ressource historique')`,
    /resource-translation-rows:1:0/u
  );
  assertTamperedCandidateRejected(
    "morphology-translation",
    "full",
    `INSERT INTO MorphologyCodeTranslations
       (morphologyCodeId, language, meaning, description, example)
     VALUES (1, 'fr', 'adjectif', 'adjectif grec', 'G:A')`,
    /morphology-translation-rows:1:0/u
  );

  const manifestPath = join(directory, "candidate-manifest.json");
  const candidateManifest = buildLexiconV3BilingualCandidateManifest(
    result,
    "2026-07-13T12:30:00.000Z"
  );
  writeLexiconV3BilingualCandidateManifest(manifestPath, candidateManifest);
  const deploymentOptions = parseLexiconV3ProductionDeployArgs([
    "--authoring",
    authoringPath,
    "--candidate-manifest",
    manifestPath,
    "--release-key",
    "fixture-release",
    "--releases-root",
    join(directory, "releases"),
    "--current-manifest",
    join(directory, "current.json"),
    "--deployed-at",
    "2026-07-13T12:35:00.000Z"
  ]);
  assert.throws(
    () =>
      runLexiconV3ProductionDeploy({
        ...deploymentOptions,
        currentManifestPath: manifestPath
      }),
    /french-production-deploy-path-collision/u
  );
  const lockCollisionCurrent = join(directory, "lock-collision-current.json");
  const lockCollisionCandidate = `${lockCollisionCurrent}.deploy-lock.sqlite`;
  copyFileSync(corePath, lockCollisionCandidate);
  assert.throws(
    () =>
      deployLexiconV3BilingualCandidates({
        authoringPath,
        sourcePath,
        releaseKey: "fixture-release",
        coreCandidatePath: lockCollisionCandidate,
        fullCandidatePath: fullPath,
        expectedCoreSha256: result.core.sha256,
        expectedFullSha256: result.full.sha256,
        expectedCoreLogicalFingerprint: result.core.logicalFingerprint,
        expectedFullLogicalFingerprint: result.full.logicalFingerprint,
        candidateManifestHash: candidateManifest.manifestHash,
        candidateManifest: {
          ...candidateManifest,
          core: { ...candidateManifest.core, path: lockCollisionCandidate }
        },
        releaseDirectory: join(
          directory,
          "lock-collision-releases",
          "fixture-release"
        ),
        currentManifestPath: lockCollisionCurrent,
        deployedAt: "2026-07-13T12:35:00.000Z"
      }),
    /deployment-input-output-path-collision/u
  );
  const semanticManifestOptions = {
    authoringPath,
    sourcePath,
    releaseKey: "fixture-release",
    coreCandidatePath: corePath,
    fullCandidatePath: fullPath,
    expectedCoreSha256: result.core.sha256,
    expectedFullSha256: result.full.sha256,
    expectedCoreLogicalFingerprint: result.core.logicalFingerprint,
    expectedFullLogicalFingerprint: result.full.logicalFingerprint,
    candidateManifestHash: candidateManifest.manifestHash,
    deployedAt: "2026-07-13T12:35:00.000Z"
  } as const;
  assert.throws(
    () =>
      deployLexiconV3BilingualCandidates({
        ...semanticManifestOptions,
        candidateManifest: {
          ...candidateManifest,
          releaseIdentity: {
            ...candidateManifest.releaseIdentity,
            policyVersion: "tampered-policy"
          }
        },
        releaseDirectory: join(
          directory,
          "tampered-identity-releases",
          "fixture-release"
        ),
        currentManifestPath: join(directory, "tampered-identity-current.json")
      }),
    /deployment-candidate-manifest-release-identity-mismatch/u
  );
  assert.throws(
    () =>
      deployLexiconV3BilingualCandidates({
        ...semanticManifestOptions,
        candidateManifest: {
          ...candidateManifest,
          core: {
            ...candidateManifest.core,
            stepEntries: candidateManifest.core.stepEntries + 1
          }
        },
        releaseDirectory: join(
          directory,
          "tampered-summary-releases",
          "fixture-release"
        ),
        currentManifestPath: join(directory, "tampered-summary-current.json")
      }),
    /deployment-candidate-manifest-core-summary-mismatch/u
  );
  const deploymentLockPath = `${deploymentOptions.currentManifestPath}.deploy-lock.sqlite`;
  writeFileSync(deploymentLockPath, "not-a-deployment-lock\n", "utf8");
  assert.throws(
    () => runLexiconV3ProductionDeploy(deploymentOptions),
    /deployment-lock-invalid/u
  );
  assert.equal(existsSync(corePath), true);
  rmSync(deploymentLockPath, { force: true });
  const competingLock = new DatabaseSync(deploymentLockPath);
  competingLock.exec(`
    PRAGMA journal_mode = DELETE;
    CREATE TABLE DeploymentLockMetadata (
      singleton INTEGER PRIMARY KEY CHECK(singleton = 1),
      format TEXT NOT NULL
    );
    INSERT INTO DeploymentLockMetadata (singleton, format)
    VALUES (1, 'lexicon-v3-sqlite-deployment-lock@1');
    BEGIN EXCLUSIVE;
    UPDATE DeploymentLockMetadata SET format = format WHERE singleton = 1;
  `);
  assert.throws(
    () => runLexiconV3ProductionDeploy(deploymentOptions),
    /deployment-locked/u
  );
  competingLock.close();
  const deployed = runLexiconV3ProductionDeploy(deploymentOptions);
  const deployedCorePath = join(
    deploymentOptions.releaseDirectory,
    "strong_lexicon.fr.core.production.sqlite"
  );
  const deployedFullPath = join(
    deploymentOptions.releaseDirectory,
    "strong_lexicon.fr.full.production.sqlite"
  );
  assert.equal(deployed.core.path, deployedCorePath);
  assert.equal(deployed.full.path, deployedFullPath);
  assert.equal(
    createHash("sha256").update(readFileSync(deployedCorePath)).digest("hex"),
    result.core.sha256
  );
  assert.equal(
    createHash("sha256").update(readFileSync(deployedFullPath)).digest("hex"),
    result.full.sha256
  );
  const resolvedProduction = resolveLexiconV3CurrentProduction(
    deploymentOptions.currentManifestPath
  );
  assert.equal(resolvedProduction.releaseKey, "fixture-release");
  assert.equal(resolvedProduction.core.path, deployedCorePath);
  assert.equal(resolvedProduction.full.path, deployedFullPath);
  const dictionaryInput = resolveDefaultStrongDictionaryInput(
    deploymentOptions.currentManifestPath
  );
  assert.equal(dictionaryInput.path, deployedFullPath);
  assert.deepEqual(dictionaryInput.activation, {
    mode: "lexicon-v3-current",
    pointerPath: resolvedProduction.pointerPath,
    pointerHash: resolvedProduction.pointerHash,
    releaseKey: resolvedProduction.releaseKey,
    deploymentReceipt: resolvedProduction.deploymentReceipt,
    deploymentHash: resolvedProduction.deploymentHash,
    fullPath: resolvedProduction.full.path,
    fullSha256: resolvedProduction.full.sha256,
    fullLogicalFingerprint: resolvedProduction.full.logicalFingerprint
  });
  const productionCandidates = readStrongDictionaryTranslationCandidates(
    undefined,
    {
      strict: true,
      currentManifestPath: deploymentOptions.currentManifestPath
    }
  );
  assert.equal(
    productionCandidates.some(
      (candidate) =>
        candidate.strong === "G1623" && candidate.normalized === "sixieme"
    ),
    true
  );
  const symlinkReleaseParent = join(directory, "symlink-releases");
  mkdirSync(symlinkReleaseParent, { recursive: true });
  const symlinkReleaseDirectory = join(symlinkReleaseParent, "fixture-release");
  symlinkSync(
    deploymentOptions.releaseDirectory,
    symlinkReleaseDirectory,
    "dir"
  );
  assert.throws(
    () =>
      deployLexiconV3BilingualCandidates({
        ...semanticManifestOptions,
        candidateManifest,
        releaseDirectory: symlinkReleaseDirectory,
        currentManifestPath: join(directory, "symlink-release-current.json")
      }),
    /deployment-release-directory-must-be-regular-directory/u
  );
  const symlinkCurrentManifest = join(directory, "symlink-current.json");
  symlinkSync(deploymentOptions.currentManifestPath, symlinkCurrentManifest);
  assert.throws(
    () =>
      runLexiconV3ProductionDeploy({
        ...deploymentOptions,
        currentManifestPath: symlinkCurrentManifest
      }),
    /deployment-current-pointer-must-be-regular-file/u
  );
  const replayedDeployment = runLexiconV3ProductionDeploy(deploymentOptions);
  assert.equal(replayedDeployment.deploymentHash, deployed.deploymentHash);
  assert.equal(replayedDeployment.pointerHash, deployed.pointerHash);
  rmSync(deploymentOptions.currentManifestPath, { force: true });
  const recoveredActivation = runLexiconV3ProductionDeploy(deploymentOptions);
  assert.equal(recoveredActivation.deploymentHash, deployed.deploymentHash);
  assert.equal(existsSync(deploymentOptions.currentManifestPath), true);
  const tamperedManifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    manifestHash: string;
  };
  tamperedManifest.manifestHash = "0".repeat(64);
  writeFileSync(manifestPath, JSON.stringify(tamperedManifest), "utf8");
  assert.throws(
    () =>
      runLexiconV3ProductionDeploy({
        ...deploymentOptions,
        releaseDirectory: join(directory, "tampered-release")
      }),
    /bilingual-candidate-manifest-hash-invalid/u
  );
  for (const outputPath of [corePath, fullPath]) {
    const artifact = readFileSync(outputPath);
    assert.equal(
      artifact.includes(Buffer.from(LEGACY_SOURCE_MEANING_SENTINEL, "utf8")),
      false,
      `${outputPath} must not retain superseded source meaning bytes`
    );
    for (const legacyTranslation of [
      "<p>ressource</p>",
      "ancienne traduction morphologique",
      "ancienne description morphologique"
    ]) {
      assert.equal(
        artifact.includes(Buffer.from(legacyTranslation, "utf8")),
        false,
        `${outputPath} must physically purge ${legacyTranslation}`
      );
    }
    for (const suffix of ["-journal", "-wal", "-shm"]) {
      assert.equal(existsSync(`${outputPath}${suffix}`), false);
    }
  }

  const full = new DatabaseSync(fullPath);
  try {
    const english = full
      .prepare("SELECT gloss, meaning FROM StepEntries WHERE id = 73")
      .get() as { gloss: string; meaning: string };
    assert.deepEqual(
      { ...english },
      {
        gloss: "sixth",
        meaning: "<p>The ordinal number sixth.</p>"
      }
    );
    const french = full
      .prepare(
        `SELECT gloss, meaning, meaningHtml
         FROM LexiconTranslations WHERE stepEntryId = 73 AND language = 'fr'`
      )
      .get() as { gloss: string; meaning: string; meaningHtml: string };
    assert.deepEqual(
      { ...french },
      {
        gloss: "sixième",
        meaning: "Le nombre ordinal sixième.",
        meaningHtml: "<p>Le nombre ordinal sixième.</p>"
      }
    );
    const carriers = full
      .prepare(
        `SELECT normalized, state, policy
         FROM LexiconCarrierTerms ORDER BY normalized`
      )
      .all() as unknown as Array<{
      normalized: string;
      state: string;
      policy: string;
    }>;
    assert.deepEqual(
      carriers.map((carrier) => ({ ...carrier })),
      [
        {
          normalized: "ordinal",
          state: "auto_validated",
          policy: "auto_safe"
        },
        {
          normalized: "sixieme",
          state: "human_validated",
          policy: "review_only"
        }
      ]
    );
    assert.equal(
      carriers.some((carrier) => carrier.normalized === "contamination"),
      false
    );
    assert.equal(readScalar(full, "SELECT count(*) FROM LexiconResources"), 1);
    assert.equal(
      readScalar(full, "SELECT count(*) FROM LexiconResourceTranslations"),
      0
    );
    assert.equal(
      readScalar(full, "SELECT count(*) FROM MorphologyCodeTranslations"),
      0
    );
    assert.equal(
      readScalar(
        full,
        "SELECT count(*) FROM LexiconFieldStatus WHERE releaseKey = 'fixture-release'"
      ),
      4
    );
    const meta = Object.fromEntries(
      (
        full
          .prepare(
            `SELECT key, value FROM DictionaryMeta
             WHERE key LIKE 'lexiconV3%' ORDER BY key`
          )
          .all() as unknown as Array<{ key: string; value: string }>
      ).map((row) => [row.key, row.value])
    );
    assert.equal(meta.lexiconV3ReleaseKey, "fixture-release");
    assert.equal(meta.lexiconV3Profile, "full");
    assert.equal(meta.lexiconV3ReleaseProfile, "bilingual");
    assert.equal(
      meta.lexiconV3SourceLogicalFingerprint,
      sourceLogicalFingerprint
    );
    assert.equal(meta.lexiconV3ResourceTranslationStatus, "excluded");
    assert.equal(meta.lexiconV3MorphologyTranslationStatus, "excluded");
    assert.equal(
      full
        .prepare(
          "SELECT value FROM DictionaryMeta WHERE key = 'morphologyTranslations'"
        )
        .get(),
      undefined
    );
    assert.equal(
      meta.lexiconV3PhysicalSanitization,
      "secure-delete+memory-journal+vacuum"
    );
    for (const key of [
      "lexiconV3SourceFingerprint",
      "lexiconV3CodeFingerprint",
      "lexiconV3SnapshotFingerprint",
      "lexiconV3RightsManifestDigest"
    ]) {
      assert.match(meta[key] ?? "", /^[a-f0-9]{64}$/u);
    }
    assert.ok(Array.isArray(JSON.parse(meta.lexiconV3RightsManifest ?? "")));
    const rightsManifest = JSON.parse(
      meta.lexiconV3RightsManifest ?? "[]"
    ) as Array<{ sourceKey?: string; license?: string }>;
    assert.equal(
      rightsManifest.find((source) => source.sourceKey === "step:fixture")
        ?.license,
      "fixture",
      "projection must use the rights manifest sealed by the promoted release"
    );
  } finally {
    full.close();
  }

  const core = new DatabaseSync(corePath);
  try {
    assert.equal(tableExists(core, "LexiconResources"), false);
    assert.equal(tableExists(core, "LexiconResourceTranslations"), false);
    assert.equal(tableExists(core, "LexiconCarrierTerms"), true);
  } finally {
    core.close();
  }

  assert.throws(
    () =>
      buildLexiconV3Production({
        authoringPath,
        releaseKey: "fixture-release",
        sourcePath,
        coreOutputPath: corePath,
        fullOutputPath: fullPath
      }),
    /output-exists-requires-write/
  );
});

test("core-en release is English-only from planning through physical projection", (t) => {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-core-en-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const authoringPath = join(directory, "authoring.sqlite");
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "strong_lexicon.en.core.candidate.sqlite");

  createSourceFixture(sourcePath);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const sourceLogicalFingerprint = lexiconV3SourceLogicalFingerprint(source);
  source.close();

  const authoring = new DatabaseSync(authoringPath);
  try {
    createLexiconV3Schema(authoring);
    insertAuthoringFixture(authoring, {
      omitFrenchMeaning: true,
      sourceLogicalFingerprint
    });
    authoring.exec(`
      INSERT INTO LexiconIssues (
        entryKey, fieldVersionId, code, severity, status, detailsJson
      ) VALUES (
        'greek:G1623',
        (SELECT id FROM LexiconFieldVersions
         WHERE locale = 'fr' AND field = 'gloss'),
        'future-fr-review', 'warning', 'open', '{}'
      )
    `);
    const plan = planLexiconV3Release(authoring, { profile: "core-en" });
    assert.equal(plan.profile, "core-en");
    assert.deepEqual(plan.errors, []);
    assert.equal(plan.fields.length, 2);
    assert.equal(
      plan.fields.every((field) => field.locale === "en"),
      true
    );
    assert.equal(plan.carriers.length, 0);
    assert.deepEqual(
      plan.rightsManifest.map((sourceRow) => sourceRow.sourceKey),
      ["step:fixture"],
      "the sealed EN rights manifest must omit unrelated French sources"
    );

    const candidate = createLexiconV3ReleaseCandidate(authoring, {
      releaseKey: "fixture-core-en",
      profile: "core-en"
    });
    assert.equal(candidate.profile, "core-en");
    assert.equal(
      candidate.policyVersion,
      "lexicon-v3-core-en-release-policy@1"
    );
    assert.equal(candidate.fieldCount, 2);
    assert.equal(candidate.carrierCount, 0);
    const verified = verifyLexiconV3Release(authoring, "fixture-core-en", true);
    assert.equal(verified.ok, true);
    assert.equal(verified.profile, "core-en");

    const promoted = promoteLexiconV3Release(
      authoring,
      "fixture-core-en",
      "2026-07-13T12:00:00.000Z"
    );
    assert.equal(promoted.profile, "core-en");
    assert.equal(promoted.state, "promoted");
  } finally {
    authoring.close();
  }

  assert.throws(
    () =>
      buildLexiconV3Production({
        profile: "bilingual",
        authoringPath,
        releaseKey: "fixture-core-en",
        sourcePath,
        coreOutputPath: join(directory, "wrong-core.sqlite"),
        fullOutputPath: join(directory, "wrong-full.sqlite")
      }),
    /release-profile-mismatch:core-en:bilingual/u
  );

  const result = buildLexiconV3Production({
    profile: "core-en",
    authoringPath,
    releaseKey: "fixture-core-en",
    sourcePath,
    outputPath
  });
  assert.equal(result.profile, "core-en");
  assert.equal(result.coreEnglish.profile, "core-en");
  assert.equal(result.coreEnglish.integrity, "ok");
  assert.equal(result.coreEnglish.translationRows, 0);
  assert.equal(result.coreEnglish.frenchTranslations, 0);
  assert.equal(result.coreEnglish.fieldStatuses, 2);
  assert.equal(result.coreEnglish.carrierTerms, 0);
  assert.equal(result.coreEnglish.resourceRows, null);
  assert.equal(result.coreEnglish.resourceTranslationRows, null);
  assert.equal(result.coreEnglish.morphologyTranslationRows, 0);

  const bytes = readFileSync(outputPath);
  for (const removedText of [
    "ancienne traduction",
    "<p>ancienne</p>",
    "<p>ressource</p>",
    "ancienne traduction morphologique",
    "ancienne description morphologique",
    "fr-production-hardening-v1",
    "strong-lexicon-full-v1"
  ]) {
    assert.equal(
      bytes.includes(Buffer.from(removedText, "utf8")),
      false,
      `core-en must physically purge ${removedText}`
    );
  }

  const projected = new DatabaseSync(outputPath, { readOnly: true });
  try {
    assert.equal(
      readScalar(projected, "SELECT count(*) FROM LexiconTranslations"),
      0
    );
    assert.equal(
      readScalar(projected, "SELECT count(*) FROM MorphologyCodeTranslations"),
      0
    );
    assert.equal(tableExists(projected, "LexiconResources"), false);
    assert.equal(tableExists(projected, "LexiconResourceTranslations"), false);
    assert.equal(
      readScalar(
        projected,
        "SELECT count(*) FROM LexiconFieldStatus WHERE locale <> 'en'"
      ),
      0
    );
    assert.equal(
      readScalar(projected, "SELECT count(*) FROM LexiconCarrierTerms"),
      0
    );
    const meta = Object.fromEntries(
      (
        projected
          .prepare(
            `SELECT key, value FROM DictionaryMeta
             WHERE key LIKE 'lexiconV3%'
                OR key IN (
                  'productionProfile', 'hardenedProfile',
                  'morphologyTranslations'
                )
             ORDER BY key`
          )
          .all() as unknown as Array<{ key: string; value: string }>
      ).map((row) => [row.key, row.value])
    );
    assert.equal(meta.lexiconV3Profile, "core-en");
    assert.equal(meta.lexiconV3ReleaseProfile, "core-en");
    assert.equal(meta.lexiconV3TranslationStatus, "excluded");
    assert.equal(meta.lexiconV3ResourceTranslationStatus, "excluded");
    assert.equal(meta.lexiconV3MorphologyTranslationStatus, "excluded");
    assert.equal(meta.productionProfile, "strong-lexicon-core-en-v3");
    assert.equal(meta.hardenedProfile, undefined);
    assert.equal(meta.morphologyTranslations, undefined);
    const rightsManifest = JSON.parse(
      meta.lexiconV3RightsManifest ?? "[]"
    ) as Array<{ sourceKey?: string }>;
    assert.deepEqual(
      rightsManifest.map((sourceRow) => sourceRow.sourceKey),
      ["step:fixture"]
    );
  } finally {
    projected.close();
  }

  assert.throws(
    () =>
      buildLexiconV3Production({
        profile: "core-en",
        authoringPath,
        releaseKey: "fixture-core-en",
        sourcePath,
        outputPath
      }),
    /output-exists-requires-write/u
  );
});

test("G20354 selects the pinned Perseus assertions into the core-en rights manifest", () => {
  const db = new DatabaseSync(":memory:");
  try {
    createLexiconV3Schema(db);
    insertAuthoringFixture(db, { omitFrenchMeaning: true });
    db.prepare(
      `INSERT INTO LexiconEntries (
         entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
         uStrong, original, transliteration, morph
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      "greek:G20354",
      "greek",
      20354,
      "G20354",
      "G20354",
      "G20354 =",
      "G20354",
      "ἐνδιαλλάσσω",
      "endiallassō",
      "G:V"
    );
    db.prepare(
      "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
    ).run("greek:G20354", 9901);
    const sourceId = Number(
      db
        .prepare(
          `INSERT INTO LexiconSources (
             sourceKey, name, version, witnessFamily, locale, sha256, license,
             rightsStatus, allowDisplay, allowTranslation, allowCarrier,
             metadataJson
           ) VALUES (?, ?, ?, ?, ?, ?, ?, 'cleared', 1, 1, 0, ?)`
        )
        .run(
          "perseus-lsj-g20354",
          "Perseus LSJ entry n35193 (G20354)",
          PINNED_G20354_PERSEUS_ARTIFACT_DIGEST.slice(0, 16),
          "Perseus-LSJ",
          "en",
          PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
          "CC-BY-SA-4.0",
          JSON.stringify({
            provider: "Perseus Digital Library",
            artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
            artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
            payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
            sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
            sourceFragmentDigest: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
            licenseUrl: PINNED_G20354_PERSEUS_LICENSE_URL,
            attribution: PINNED_G20354_PERSEUS_ATTRIBUTION,
            provenanceUrl: PINNED_G20354_PERSEUS_PROVENANCE_URL,
            accessedAt: PINNED_G20354_PERSEUS_ACCESSED_AT,
            modifications: PINNED_G20354_PERSEUS_MODIFICATIONS
          })
        ).lastInsertRowid
    );
    const values = {
      gloss: {
        text: "to alter; passive participle: a sodomite",
        html: null
      },
      meaning: {
        text: "to alter in the active voice (Aristotle, Physiognomonica 806a13); in the passive participle, substantivally, a sodomite (LXX 3 Kings 22:47; Aquila, Genesis 38:21).",
        html: "<b>to alter</b> in the active voice (Aristotle, <i>Physiognomonica</i> 806a13); in the passive participle, substantivally, <b>a sodomite</b> (LXX 3 Kings 22:47; Aquila, Genesis 38:21)."
      }
    } as const;
    for (const fieldName of ["gloss", "meaning"] as const) {
      const value = values[fieldName];
      const assertionId = Number(
        db
          .prepare(
            `INSERT INTO LexiconSourceAssertions (
               sourceId, entryKey, scope, field, locale, valueText, valueHtml,
               locator, sha256
             ) VALUES (?, 'greek:G20354', 'entry', ?, 'en', ?, ?, ?, ?)`
          )
          .run(
            sourceId,
            fieldName,
            value.text,
            value.html,
            `perseus-lsj:n35193:${fieldName}`,
            hash(fieldName === "gloss" ? "g" : "m")
          ).lastInsertRowid
      );
      const contentHash = lexiconV3FieldContentHash({
        entryKey: "greek:G20354",
        locale: "en",
        field: fieldName,
        valueText: value.text,
        valueHtml: value.html,
        derivedFromVersionId: null
      });
      const fieldVersionId = Number(
        db
          .prepare(
            `INSERT INTO LexiconFieldVersions (
               entryKey, locale, field, valueText, valueHtml, state,
               confidence, method, generator, contentHash
             ) VALUES (
               'greek:G20354', 'en', ?, ?, ?, 'auto_validated', 0.95,
               'rule', 'lexicon-v3-english-audit-field-repair@1', ?
             )`
          )
          .run(fieldName, value.text, value.html, contentHash).lastInsertRowid
      );
      db.prepare(
        `INSERT INTO LexiconFieldEvidence (
           fieldVersionId, sourceAssertionId, evidenceKind, stance,
           witnessFamily, weight
         ) VALUES (?, ?, 'cross_source', 'supports', 'Perseus-LSJ', 1)`
      ).run(fieldVersionId, assertionId);
    }

    const assertions = db
      .prepare(
        `SELECT assertion.field, assertion.valueText, source.sourceKey,
                evidence.evidenceKind, evidence.stance
         FROM LexiconSourceAssertions assertion
         JOIN LexiconSources source ON source.id = assertion.sourceId
         JOIN LexiconFieldEvidence evidence
           ON evidence.sourceAssertionId = assertion.id
         WHERE assertion.entryKey = 'greek:G20354'
         ORDER BY assertion.field`
      )
      .all() as Array<Record<string, string>>;
    assert.deepEqual(
      assertions.map((row) => ({ ...row })),
      [
        {
          field: "gloss",
          valueText: values.gloss.text,
          sourceKey: "perseus-lsj-g20354",
          evidenceKind: "cross_source",
          stance: "supports"
        },
        {
          field: "meaning",
          valueText: values.meaning.text,
          sourceKey: "perseus-lsj-g20354",
          evidenceKind: "cross_source",
          stance: "supports"
        }
      ]
    );

    const plan = planLexiconV3Release(db, { profile: "core-en" });
    assert.deepEqual(plan.errors, []);
    const rights = plan.rightsManifest.find(
      (source) => source.sourceKey === "perseus-lsj-g20354"
    );
    assert.ok(rights);
    assert.equal(rights.license, "CC-BY-SA-4.0");
    assert.equal(rights.sha256, PINNED_G20354_PERSEUS_ARTIFACT_DIGEST);
    assert.deepEqual(JSON.parse(rights.metadataJson), {
      provider: "Perseus Digital Library",
      artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
      artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
      payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
      sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
      sourceFragmentDigest: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
      licenseUrl: PINNED_G20354_PERSEUS_LICENSE_URL,
      attribution: PINNED_G20354_PERSEUS_ATTRIBUTION,
      provenanceUrl: PINNED_G20354_PERSEUS_PROVENANCE_URL,
      accessedAt: PINNED_G20354_PERSEUS_ACCESSED_AT,
      modifications: PINNED_G20354_PERSEUS_MODIFICATIONS
    });
  } finally {
    db.close();
  }
});

test("core-en projects the sealed G0001H and G5441 authoring identities while retaining raw-source fingerprints", (t) => {
  const directory = mkdtempSync(
    join(tmpdir(), "lexicon-v3-core-en-reconstructed-identity-")
  );
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const authoringPath = join(directory, "authoring.sqlite");
  const sourcePath = join(directory, "source.sqlite");
  const outputPath = join(directory, "core-en.sqlite");

  createGreekReconstructionSourceFixture(sourcePath);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  const rawSourceLogicalFingerprint = lexiconV3SourceLogicalFingerprint(source);
  source.close();

  const authoring = new DatabaseSync(authoringPath);
  let entryIdentityFingerprint = "";
  try {
    createLexiconV3Schema(authoring);
    insertGreekReconstructionAuthoringFixture(
      authoring,
      rawSourceLogicalFingerprint
    );
    const plan = planLexiconV3Release(authoring, { profile: "core-en" });
    assert.deepEqual(plan.errors, []);
    assert.match(plan.entryIdentityFingerprint, /^[a-f0-9]{64}$/u);
    entryIdentityFingerprint = plan.entryIdentityFingerprint;
    createLexiconV3ReleaseCandidate(authoring, {
      releaseKey: "greek-reconstruction-core-en",
      profile: "core-en"
    });
    const manifest = JSON.parse(
      String(
        (
          authoring
            .prepare(
              `SELECT manifestJson FROM LexiconReleases
               WHERE releaseKey = 'greek-reconstruction-core-en'`
            )
            .get() as { manifestJson: string }
        ).manifestJson
      )
    ) as { entryIdentityFingerprint?: string };
    assert.equal(
      manifest.entryIdentityFingerprint,
      entryIdentityFingerprint,
      "the promoted selection must seal the exact authoring identity set"
    );
    promoteLexiconV3Release(
      authoring,
      "greek-reconstruction-core-en",
      "2026-07-13T15:00:00.000Z"
    );
  } finally {
    authoring.close();
  }

  const result = buildLexiconV3Production({
    profile: "core-en",
    authoringPath,
    releaseKey: "greek-reconstruction-core-en",
    sourcePath,
    outputPath
  });
  assert.equal(result.coreEnglish.integrity, "ok");
  assert.equal(result.coreEnglish.stepEntries, 2);

  const projected = new DatabaseSync(outputPath, { readOnly: true });
  try {
    const entries = projected
      .prepare(
        `SELECT id, language, baseCode, eStrong, dStrong, uStrong,
                original, transliteration, morph, classicTransliteration,
                pronunciation, gloss, meaning
         FROM StepEntries ORDER BY id`
      )
      .all() as unknown as Array<Record<string, unknown>>;
    assert.deepEqual(
      entries.map((entry) => ({ ...entry })),
      [
        {
          id: 2,
          language: "greek",
          baseCode: 1,
          eStrong: "G0001",
          dStrong: "G0001H =",
          uStrong: "G0001H",
          original: "ἆ",
          transliteration: "a",
          morph: "G:INJ",
          classicTransliteration: "A",
          pronunciation: "",
          gloss: "ah!",
          meaning:
            "ἆ, an exclamation expressing emotions such as pity, envy, or contempt, and also used in reproofs or warnings; it may stand with an adjective, alone, or doubled."
        },
        {
          id: 5514,
          language: "greek",
          baseCode: 5441,
          eStrong: "G5441",
          dStrong: "G5441 =",
          uStrong: "G5441",
          original: "φύλαξ",
          transliteration: "phulax",
          morph: "G:N-M",
          classicTransliteration: "phulax",
          pronunciation: "foo'-lax",
          gloss: "guard; keeper",
          meaning: "φύλαξ, -ακος, ὁ, a guard or keeper (Acts 5:23; 12:6, 19)."
        }
      ]
    );
    const meta = Object.fromEntries(
      (
        projected
          .prepare(
            `SELECT key, value FROM DictionaryMeta
             WHERE key IN (
               'lexiconV3SourceFingerprint',
               'lexiconV3SourceLogicalFingerprint',
               'lexiconV3EntryIdentityFingerprint'
             )`
          )
          .all() as unknown as Array<{ key: string; value: string }>
      ).map((row) => [row.key, row.value])
    );
    assert.equal(
      meta.lexiconV3SourceFingerprint,
      hash("greek-reconstruction-source")
    );
    assert.equal(
      meta.lexiconV3SourceLogicalFingerprint,
      rawSourceLogicalFingerprint,
      "the output must retain the fingerprint measured before projection"
    );
    assert.equal(
      meta.lexiconV3EntryIdentityFingerprint,
      entryIdentityFingerprint
    );
  } finally {
    projected.close();
  }

  const bytes = readFileSync(outputPath);
  for (const supersededIdentity of ["al'-fah", "φυλακτήριος", "phulaktērios"]) {
    assert.equal(
      bytes.includes(Buffer.from(supersededIdentity, "utf8")),
      false,
      `the compacted projection must purge ${supersededIdentity}`
    );
  }

  const driftedAuthoring = new DatabaseSync(authoringPath);
  try {
    driftedAuthoring
      .prepare(
        `UPDATE LexiconEntries SET pronunciation = 'tampered-after-promotion'
         WHERE entryKey = 'greek:G0001H'`
      )
      .run();
    const verification = verifyLexiconV3Release(
      driftedAuthoring,
      "greek-reconstruction-core-en",
      false
    );
    assert.equal(verification.ok, false);
    assert.ok(
      verification.errors.includes(
        "release-entry-identity-fingerprint-mismatch"
      )
    );
  } finally {
    driftedAuthoring.close();
  }
  assert.throws(
    () =>
      buildLexiconV3Production({
        profile: "core-en",
        authoringPath,
        releaseKey: "greek-reconstruction-core-en",
        sourcePath,
        outputPath: join(directory, "must-not-publish-drift.sqlite")
      }),
    (error) =>
      error instanceof LexiconV3ReleaseError &&
      error.errors.includes("release-entry-identity-fingerprint-mismatch")
  );
});

function insertAuthoringFixture(
  db: DatabaseSync,
  options: {
    omitFrenchMeaning?: boolean;
    restrictedRights?: boolean;
    openBlocker?: boolean;
    sourceLogicalFingerprint?: string;
    skipFieldEvidence?: boolean;
  }
): void {
  db.exec("PRAGMA foreign_keys = ON");
  db.prepare("INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)").run(
    "sourceFingerprint",
    hash("e")
  );
  db.prepare("INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)").run(
    "codeFingerprint",
    lexiconV3CodeFingerprint()
  );
  db.prepare("INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)").run(
    "sourceLogicalFingerprint",
    options.sourceLogicalFingerprint ?? hash("0")
  );
  db.prepare(
    `INSERT INTO LexiconEntries (
       entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
       uStrong, original, transliteration, morph
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "greek:G1623",
    "greek",
    1623,
    "G1623",
    "G1623",
    "G1623 =",
    "G1623",
    "ἕκτος",
    "hektos",
    "G:A"
  );
  db.prepare(
    "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
  ).run("greek:G1623", 73);
  db.prepare(
    `INSERT INTO LexiconSources (
       sourceKey, name, version, witnessFamily, locale, sha256, license,
       rightsStatus, allowDisplay, allowTranslation, allowCarrier
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "step:fixture",
    "STEP fixture",
    "1",
    "STEP",
    "en",
    hash("a"),
    "fixture",
    options.restrictedRights ? "restricted" : "cleared",
    options.restrictedRights ? 0 : 1,
    options.restrictedRights ? 0 : 1,
    1
  );
  db.prepare(
    `INSERT INTO LexiconSources (
       sourceKey, name, version, witnessFamily, locale, sha256, license,
       rightsStatus, allowDisplay, allowTranslation, allowCarrier
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "artifact:fr:fixture",
    "French review fixture",
    "1",
    "fixture-fr-review",
    "fr",
    hash("fr-source"),
    "project-generated fixture",
    "cleared",
    1,
    0,
    1
  );

  const glossAssertion = insertAssertion(db, "gloss", "sixth", "gloss");
  const meaningAssertion = insertAssertion(
    db,
    "meaning",
    "The ordinal number sixth.",
    "meaning"
  );
  const enGloss = insertField(db, {
    locale: "en",
    field: "gloss",
    valueText: "sixth",
    valueHtml: null,
    state: "human_validated",
    derivedFromVersionId: null
  });
  const enMeaning = insertField(db, {
    locale: "en",
    field: "meaning",
    valueText: "The ordinal number sixth.",
    valueHtml: "<p>The ordinal number sixth.</p>",
    state: "human_validated",
    derivedFromVersionId: null
  });
  const frGloss = insertField(db, {
    locale: "fr",
    field: "gloss",
    valueText: "sixième",
    valueHtml: null,
    state: "human_validated",
    derivedFromVersionId: enGloss
  });
  let frMeaning: number | null = null;
  if (!options.omitFrenchMeaning) {
    frMeaning = insertField(db, {
      locale: "fr",
      field: "meaning",
      valueText: "Le nombre ordinal sixième.",
      valueHtml: "<p>Le nombre ordinal sixième.</p>",
      state: "human_validated",
      derivedFromVersionId: enMeaning
    });
  }
  if (!options.skipFieldEvidence) {
    insertFieldEvidence(db, enGloss, glossAssertion);
    insertFieldEvidence(db, enMeaning, meaningAssertion);
    insertFrenchFieldEvidence(db, frGloss, "gloss", "sixième");
    if (frMeaning) {
      insertFrenchFieldEvidence(
        db,
        frMeaning,
        "meaning",
        "Le nombre ordinal sixième."
      );
    }
  }
  for (const [index, fieldVersionId] of [
    enGloss,
    enMeaning,
    frGloss,
    frMeaning
  ].entries()) {
    if (!fieldVersionId) continue;
    db.prepare(
      `INSERT INTO LexiconFieldReviews (
         fieldVersionId, reviewerType, reviewer, verdict, reason, artifactHash
       ) VALUES (?, 'human', 'fixture-reviewer', 'accept',
                 'Fixture content reviewed.', ?)`
    ).run(fieldVersionId, String(index + 1).repeat(64));
  }

  const humanCarrier = insertCarrier(
    db,
    "sixième",
    "sixieme",
    "human_validated",
    "review_only",
    frGloss,
    "b"
  );
  const autoCarrier = insertCarrier(
    db,
    "ordinal",
    "ordinal",
    "auto_validated",
    "auto_safe",
    frGloss,
    "c"
  );
  const excludedCarrier = insertCarrier(
    db,
    "contamination",
    "contamination",
    "auto_validated",
    "review_only",
    frGloss,
    "d"
  );
  for (const carrierId of [humanCarrier, autoCarrier, excludedCarrier]) {
    db.prepare(
      `INSERT INTO LexiconCarrierEvidence (
         carrierTermId, sourceId, witnessFamily, evidenceKind, stance,
         observedSurface, occurrenceCount, weight
       ) VALUES (?, 1, 'fixture-family', 'concordance', 'supports', ?, 2, 0.9)`
    ).run(carrierId, carrierId === humanCarrier ? "sixième" : "ordinal");
  }

  if (options.openBlocker) {
    db.prepare(
      `INSERT INTO LexiconIssues (
         entryKey, code, severity, status, detailsJson
       ) VALUES ('greek:G1623', 'fixture-blocker', 'blocker', 'open', '{}')`
    ).run();
  }
}

function insertUnpinnedHebrewArtifactSource(db: DatabaseSync): void {
  const outputDigest = hash("unpinned-output");
  db.prepare(
    `INSERT INTO LexiconSources (
       sourceKey, name, version, witnessFamily, locale, sha256, license,
       rightsStatus, allowDisplay, allowTranslation, allowCarrier,
       metadataJson
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "artifact-hebrew-open-english",
    "Unpinned Hebrew artifact",
    "unverified",
    "OpenScriptures",
    "en",
    outputDigest,
    "fixture",
    "cleared",
    1,
    1,
    0,
    JSON.stringify({
      summary: {
        schema: "lexicon-v3-hebrew-english-summary@5",
        openScripturesRevision: "unverified-local-input",
        sourceDigests: {},
        outputDigest
      }
    })
  );
}

function insertAssertion(
  db: DatabaseSync,
  field: "gloss" | "meaning",
  valueText: string,
  locator: string
): number {
  const result = db
    .prepare(
      `INSERT INTO LexiconSourceAssertions (
         sourceId, entryKey, scope, field, locale, valueText, locator, sha256
       ) VALUES (1, 'greek:G1623', 'entry', ?, 'en', ?, ?, ?)`
    )
    .run(field, valueText, `fixture:${locator}`, hash(locator));
  return Number(result.lastInsertRowid);
}

function insertField(
  db: DatabaseSync,
  value: {
    locale: "en" | "fr";
    field: "gloss" | "meaning";
    valueText: string;
    valueHtml: string | null;
    state: "auto_validated" | "human_validated";
    derivedFromVersionId: number | null;
  }
): number {
  const contentHash = lexiconV3FieldContentHash({
    entryKey: "greek:G1623",
    ...value
  });
  const result = db
    .prepare(
      `INSERT INTO LexiconFieldVersions (
         entryKey, locale, field, valueText, valueHtml, state, confidence,
         method, generator, derivedFromVersionId, contentHash
       ) VALUES ('greek:G1623', ?, ?, ?, ?, ?, 0.99, ?, 'fixture', ?, ?)`
    )
    .run(
      value.locale,
      value.field,
      value.valueText,
      value.valueHtml,
      value.state,
      value.locale === "fr" ? "translation" : "editorial",
      value.derivedFromVersionId,
      contentHash
    );
  return Number(result.lastInsertRowid);
}

function insertFieldEvidence(
  db: DatabaseSync,
  fieldVersionId: number,
  sourceAssertionId: number
): void {
  db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight
     ) VALUES (?, ?, 'direct_source', 'supports', 'STEP', 1)`
  ).run(fieldVersionId, sourceAssertionId);
}

function insertFrenchFieldEvidence(
  db: DatabaseSync,
  fieldVersionId: number,
  field: "gloss" | "meaning",
  valueText: string
): void {
  const assertion = db
    .prepare(
      `INSERT INTO LexiconSourceAssertions (
         sourceId, entryKey, scope, field, locale, valueText, locator, sha256
       ) VALUES (2, 'greek:G1623', 'entry', ?, 'fr', ?, ?, ?)`
    )
    .run(field, valueText, `fixture:fr:${field}`, hash(`fr:${field}`));
  db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight
     ) VALUES (?, ?, 'review', 'supports', 'fixture-fr-review', 1)`
  ).run(fieldVersionId, Number(assertion.lastInsertRowid));
}

function insertCarrier(
  db: DatabaseSync,
  surface: string,
  normalized: string,
  state: "auto_validated" | "human_validated",
  policy: "auto_safe" | "review_only",
  derivedFromVersionId: number,
  hashCharacter: string
): number {
  const result = db
    .prepare(
      `INSERT INTO LexiconCarrierTerms (
         entryKey, strong, stepStrong, locale, surface, normalized, termKind,
         state, policy, confidence, derivedFromVersionId, contentHash
       ) VALUES (
         'greek:G1623', 'G1623', 'G1623', 'fr', ?, ?, 'word', ?, ?, 0.95, ?, ?
       )`
    )
    .run(
      surface,
      normalized,
      state,
      policy,
      derivedFromVersionId,
      hash(hashCharacter)
    );
  return Number(result.lastInsertRowid);
}

function insertUnprovenHebrewFixture(db: DatabaseSync): void {
  db.exec("PRAGMA foreign_keys = ON");
  for (const [key, value] of [
    ["sourceFingerprint", hash("unproven-source")],
    ["codeFingerprint", lexiconV3CodeFingerprint()],
    ["sourceLogicalFingerprint", hash("unproven-logical-source")]
  ]) {
    db.prepare("INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)").run(
      key,
      value
    );
  }
  db.prepare(
    `INSERT INTO LexiconEntries (
       entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
       uStrong, original, transliteration, morph
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    "hebrew:H0001",
    "hebrew",
    1,
    "H0001",
    "H0001",
    "H0001",
    "H0001",
    "אָב",
    "ab",
    "N"
  );
  db.prepare(
    "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
  ).run("hebrew:H0001", 1);
  const insert = db.prepare(
    `INSERT INTO LexiconFieldVersions (
       entryKey, locale, field, valueText, valueHtml, state, confidence,
       method, generator, derivedFromVersionId, contentHash
     ) VALUES (?, ?, ?, ?, ?, 'auto_validated', 0.01, 'source',
               'unproven-fixture', ?, ?)`
  );
  const add = (
    locale: "en" | "fr",
    field: "gloss" | "meaning",
    valueText: string,
    derivedFromVersionId: number | null
  ): number => {
    const valueHtml = field === "meaning" ? `<p>${valueText}</p>` : null;
    const contentHash = lexiconV3FieldContentHash({
      entryKey: "hebrew:H0001",
      locale,
      field,
      valueText,
      valueHtml,
      derivedFromVersionId
    });
    return Number(
      insert.run(
        "hebrew:H0001",
        locale,
        field,
        valueText,
        valueHtml,
        derivedFromVersionId,
        contentHash
      ).lastInsertRowid
    );
  };
  const enGloss = add("en", "gloss", "invented", null);
  const enMeaning = add("en", "meaning", "Invented meaning.", null);
  add("fr", "gloss", "inventé", enGloss);
  add("fr", "meaning", "Notice inventée.", enMeaning);
}

function insertAdmissibleEvidenceForUnprovenHebrew(db: DatabaseSync): void {
  db.exec(`
    INSERT INTO LexiconSources (
      sourceKey, name, version, witnessFamily, locale, sha256, license,
      rightsStatus, allowDisplay, allowTranslation, allowCarrier
    ) VALUES
      ('open:fixture', 'Open fixture', '1', 'open-fixture', 'en',
       '${hash("open-source")}', 'fixture', 'cleared', 1, 1, 0),
      ('fr:fixture', 'French fixture', '1', 'fr-fixture', 'fr',
       '${hash("fr-source")}', 'fixture', 'cleared', 1, 0, 0);

    INSERT INTO LexiconSourceAssertions (
      sourceId, entryKey, scope, field, locale, valueText, locator, sha256
    ) VALUES
      (1, 'hebrew:H0001', 'entry', 'gloss', 'en', 'invented',
       'open:gloss', '${hash("open-gloss")}'),
      (1, 'hebrew:H0001', 'entry', 'meaning', 'en', 'Invented meaning.',
       'open:meaning', '${hash("open-meaning")}'),
      (2, 'hebrew:H0001', 'entry', 'gloss', 'fr', 'inventé',
       'fr:gloss', '${hash("fr-gloss")}'),
      (2, 'hebrew:H0001', 'entry', 'meaning', 'fr', 'Notice inventée.',
       'fr:meaning', '${hash("fr-meaning")}');

    INSERT INTO LexiconFieldEvidence (
      fieldVersionId, sourceAssertionId, evidenceKind, stance,
      witnessFamily, weight
    )
    SELECT field.id,
           CASE
             WHEN field.locale = 'en' AND field.field = 'gloss' THEN 1
             WHEN field.locale = 'en' AND field.field = 'meaning' THEN 2
             WHEN field.locale = 'fr' AND field.field = 'gloss' THEN 3
             ELSE 4
           END,
           CASE WHEN field.locale = 'fr' THEN 'review' ELSE 'direct_source' END,
           'supports',
           CASE WHEN field.locale = 'fr' THEN 'fr-fixture' ELSE 'open-fixture' END,
           1
    FROM LexiconFieldVersions field;
  `);
}

function insertRawCandidateRelease(db: DatabaseSync, releaseKey: string): void {
  const release = db
    .prepare(
      `INSERT INTO LexiconReleases (
         releaseKey, state, expectedEntryCount, sourceFingerprint,
         codeFingerprint, policyVersion, manifestJson
       ) VALUES (?, 'candidate', 1, ?, ?, 'fixture-policy', ?)`
    )
    .run(
      releaseKey,
      hash("raw-source"),
      hash("raw-code"),
      JSON.stringify({
        schemaVersion: "lexicon-v3-release-manifest@2",
        rightsManifest: [],
        rightsManifestDigest: hash("raw-rights")
      })
    );
  db.prepare(
    `INSERT INTO LexiconReleaseFields (
       releaseId, entryKey, locale, field, fieldVersionId
     )
     SELECT ?, entryKey, locale, field, id
     FROM LexiconFieldVersions
     WHERE field IN ('gloss', 'meaning')`
  ).run(Number(release.lastInsertRowid));
}

function promoteReleaseDirectly(db: DatabaseSync, releaseKey: string): void {
  db.prepare(
    `UPDATE LexiconReleases
     SET state = 'promoted', promotedAt = '2026-07-12T12:00:00.000Z'
     WHERE releaseKey = ?`
  ).run(releaseKey);
}

const GREEK_RECONSTRUCTION_RELEASE_FIXTURE = [
  {
    entryKey: "greek:G0001H",
    stepEntryId: 2,
    baseCode: 1,
    eStrong: "G0001",
    primaryDStrong: "G0001H",
    dStrong: "G0001H =",
    uStrong: "G0001H",
    rawOriginal: "ἆ",
    rawTransliteration: "a",
    rawMorph: "G:INJ",
    rawClassicTransliteration: "A",
    rawPronunciation: "al'-fah",
    original: "ἆ",
    transliteration: "a",
    morph: "G:INJ",
    classicTransliteration: "A",
    pronunciation: "",
    gloss: "ah!",
    meaning:
      "ἆ, an exclamation expressing emotions such as pity, envy, or contempt, and also used in reproofs or warnings; it may stand with an adjective, alone, or doubled."
  },
  {
    entryKey: "greek:G5441",
    stepEntryId: 5514,
    baseCode: 5441,
    eStrong: "G5441",
    primaryDStrong: "G5441",
    dStrong: "G5441 =",
    uStrong: "G5441",
    rawOriginal: "φυλακτήριος",
    rawTransliteration: "phulaktērios",
    rawMorph: "G:N-M",
    rawClassicTransliteration: "phulax",
    rawPronunciation: "foo'-lax",
    original: "φύλαξ",
    transliteration: "phulax",
    morph: "G:N-M",
    classicTransliteration: "phulax",
    pronunciation: "foo'-lax",
    gloss: "guard; keeper",
    meaning: "φύλαξ, -ακος, ὁ, a guard or keeper (Acts 5:23; 12:6, 19)."
  }
] as const;

function createGreekReconstructionSourceFixture(path: string): void {
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      CREATE TABLE StepEntries (
        id INTEGER PRIMARY KEY,
        language TEXT NOT NULL,
        baseCode INTEGER NOT NULL,
        eStrong TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        morph TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        classicTransliteration TEXT NOT NULL DEFAULT '',
        pronunciation TEXT NOT NULL DEFAULT '',
        UNIQUE(language, eStrong, dStrong, uStrong)
      );
      CREATE TABLE LexiconTranslations (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        meaningHtml TEXT NOT NULL,
        UNIQUE(stepEntryId, language),
        FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
      );
      CREATE TABLE DictionaryMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
      INSERT INTO DictionaryMeta VALUES ('fixture', 'greek-reconstruction');
    `);
    const insert = db.prepare(
      `INSERT INTO StepEntries (
         id, language, baseCode, eStrong, dStrong, uStrong, original,
         transliteration, morph, gloss, meaning, classicTransliteration,
         pronunciation
       ) VALUES (?, 'greek', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    for (const entry of GREEK_RECONSTRUCTION_RELEASE_FIXTURE) {
      insert.run(
        entry.stepEntryId,
        entry.baseCode,
        entry.eStrong,
        entry.dStrong,
        entry.uStrong,
        entry.rawOriginal,
        entry.rawTransliteration,
        entry.rawMorph,
        `legacy ${entry.entryKey} gloss`,
        `legacy ${entry.entryKey} meaning`,
        entry.rawClassicTransliteration,
        entry.rawPronunciation
      );
    }
  } finally {
    db.close();
  }
}

function insertGreekReconstructionAuthoringFixture(
  db: DatabaseSync,
  sourceLogicalFingerprint: string
): void {
  db.exec("PRAGMA foreign_keys = ON");
  const insertMeta = db.prepare(
    "INSERT INTO LexiconV3Meta (key, value) VALUES (?, ?)"
  );
  insertMeta.run("sourceFingerprint", hash("greek-reconstruction-source"));
  insertMeta.run("codeFingerprint", lexiconV3CodeFingerprint());
  insertMeta.run("sourceLogicalFingerprint", sourceLogicalFingerprint);
  const sourceId = Number(
    db
      .prepare(
        `INSERT INTO LexiconSources (
           sourceKey, name, version, witnessFamily, locale, sha256, license,
           rightsStatus, allowDisplay, allowTranslation, allowCarrier
         ) VALUES (
           'step:greek-reconstruction-fixture', 'Greek reconstruction fixture',
           '1', 'STEP', 'en', ?, 'fixture', 'cleared', 1, 1, 0
         )`
      )
      .run(hash("greek-reconstruction-witness")).lastInsertRowid
  );
  const insertEntry = db.prepare(
    `INSERT INTO LexiconEntries (
       entryKey, language, baseCode, eStrong, primaryDStrong, dStrong,
       uStrong, original, transliteration, morph, classicTransliteration,
       pronunciation
     ) VALUES (?, 'greek', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  const insertEntryId = db.prepare(
    "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
  );
  const insertAssertion = db.prepare(
    `INSERT INTO LexiconSourceAssertions (
       sourceId, entryKey, scope, field, locale, valueText, valueHtml,
       locator, sha256
     ) VALUES (?, ?, 'entry', ?, 'en', ?, ?, ?, ?)`
  );
  const insertField = db.prepare(
    `INSERT INTO LexiconFieldVersions (
       entryKey, locale, field, valueText, valueHtml, state, confidence,
       method, generator, derivedFromVersionId, contentHash
     ) VALUES (?, 'en', ?, ?, ?, 'auto_validated', 0.95, 'editorial',
               'greek-reconstruction@1', NULL, ?)`
  );
  const insertEvidence = db.prepare(
    `INSERT INTO LexiconFieldEvidence (
       fieldVersionId, sourceAssertionId, evidenceKind, stance,
       witnessFamily, weight
     ) VALUES (?, ?, 'direct_source', 'supports', 'STEP', 1)`
  );
  for (const entry of GREEK_RECONSTRUCTION_RELEASE_FIXTURE) {
    insertEntry.run(
      entry.entryKey,
      entry.baseCode,
      entry.eStrong,
      entry.primaryDStrong,
      entry.dStrong,
      entry.uStrong,
      entry.original,
      entry.transliteration,
      entry.morph,
      entry.classicTransliteration,
      entry.pronunciation
    );
    insertEntryId.run(entry.entryKey, entry.stepEntryId);
    for (const field of ["gloss", "meaning"] as const) {
      const valueText = entry[field];
      const valueHtml = field === "meaning" ? valueText : null;
      const locator = `${entry.entryKey}:${field}`;
      const assertionId = Number(
        insertAssertion.run(
          sourceId,
          entry.entryKey,
          field,
          valueText,
          valueHtml,
          locator,
          hash(locator)
        ).lastInsertRowid
      );
      const contentHash = lexiconV3FieldContentHash({
        entryKey: entry.entryKey,
        locale: "en",
        field,
        valueText,
        valueHtml,
        derivedFromVersionId: null
      });
      const fieldVersionId = Number(
        insertField.run(
          entry.entryKey,
          field,
          valueText,
          valueHtml,
          contentHash
        ).lastInsertRowid
      );
      insertEvidence.run(fieldVersionId, assertionId);
    }
  }
}

function createSourceFixture(path: string): void {
  const db = new DatabaseSync(path);
  try {
    db.exec(`
      PRAGMA foreign_keys = ON;
      CREATE TABLE StepEntries (
        id INTEGER PRIMARY KEY,
        language TEXT NOT NULL,
        baseCode INTEGER NOT NULL,
        eStrong TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        transliteration TEXT NOT NULL,
        morph TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        classicTransliteration TEXT NOT NULL DEFAULT '',
        pronunciation TEXT NOT NULL DEFAULT '',
        UNIQUE(language, eStrong, dStrong, uStrong)
      );
      INSERT INTO StepEntries (
        id, language, baseCode, eStrong, dStrong, uStrong, original,
        transliteration, morph, gloss, meaning
      ) VALUES (
        73, 'greek', 1623, 'G1623', 'G1623 =', 'G1623', 'ἕκτος',
        'hektos', 'G:A', 'wrong old English', 'legacy meaning placeholder'
      );

      CREATE TABLE LexiconTranslations (
        stepEntryId INTEGER NOT NULL,
        language TEXT NOT NULL,
        gloss TEXT NOT NULL,
        meaning TEXT NOT NULL,
        meaningHtml TEXT NOT NULL,
        UNIQUE(stepEntryId, language),
        FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
      );
      INSERT INTO LexiconTranslations
        (stepEntryId, language, gloss, meaning, meaningHtml)
      VALUES (73, 'fr', 'contamination', 'ancienne traduction', '<p>ancienne</p>');

      CREATE TABLE DictionaryMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
      INSERT INTO DictionaryMeta VALUES
        ('fixture', 'true'),
        ('hardenedProfile', 'fr-production-hardening-v1'),
        ('morphologyTranslations', 'fr'),
        ('productionProfile', 'strong-lexicon-full-v1');

      CREATE TABLE LexiconResources (
        id INTEGER PRIMARY KEY,
        stepEntryId INTEGER NOT NULL,
        source TEXT NOT NULL,
        kind TEXT NOT NULL,
        contentHtml TEXT NOT NULL,
        FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
      );
      INSERT INTO LexiconResources
        (id, stepEntryId, source, kind, contentHtml)
      VALUES (1, 73, 'TFLSJ', 'entry', '<p>resource</p>');

      CREATE TABLE LexiconResourceTranslations (
        resourceId INTEGER NOT NULL,
        language TEXT NOT NULL,
        contentHtml TEXT NOT NULL,
        contentText TEXT NOT NULL DEFAULT '',
        PRIMARY KEY(resourceId, language),
        FOREIGN KEY(resourceId) REFERENCES LexiconResources(id) ON DELETE CASCADE
      ) WITHOUT ROWID;
      INSERT INTO LexiconResourceTranslations
        (resourceId, language, contentHtml)
      VALUES (1, 'fr', '<p>ressource</p>');

      CREATE TABLE MorphologyCodes (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL,
        normalizedCode TEXT NOT NULL,
        language TEXT NOT NULL,
        scope TEXT NOT NULL,
        example TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        source TEXT NOT NULL
      );
      INSERT INTO MorphologyCodes (
        id, code, normalizedCode, language, scope, example, meaning,
        description, source
      ) VALUES (1, 'G:A', 'G:A', 'greek', 'word', 'G:A', 'adjectif',
                'adjectif grec', 'fixture');

      CREATE TABLE MorphologyCodeTranslations (
        morphologyCodeId INTEGER NOT NULL,
        language TEXT NOT NULL,
        meaning TEXT NOT NULL,
        description TEXT NOT NULL,
        example TEXT NOT NULL,
        PRIMARY KEY(morphologyCodeId, language)
      ) WITHOUT ROWID;
      INSERT INTO MorphologyCodeTranslations (
        morphologyCodeId, language, meaning, description, example
      ) VALUES (
        1, 'fr', 'ancienne traduction morphologique',
        'ancienne description morphologique', 'G:A'
      );
    `);
    db.prepare("UPDATE StepEntries SET meaning = ? WHERE id = 73").run(
      LEGACY_SOURCE_MEANING_SENTINEL
    );
  } finally {
    db.close();
  }
}

function readScalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown>;
  return Number(Object.values(row)[0]);
}

function tableExists(db: DatabaseSync, name: string): boolean {
  return Boolean(
    db
      .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?")
      .get(name)
  );
}

function hash(character: string): string {
  return createHash("sha256").update(character).digest("hex");
}
