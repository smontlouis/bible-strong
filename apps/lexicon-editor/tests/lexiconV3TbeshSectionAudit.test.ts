import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test, { type TestContext } from "node:test";

import {
  assertLexiconV3TbeshSectionAudit,
  buildLexiconV3TbeshSectionAudit,
  renderLexiconV3TbeshSectionAuditJson,
  renderLexiconV3TbeshSectionAuditMarkdown,
  runLexiconV3TbeshSectionAudit
} from "../scripts/auditLexiconV3TbeshSections.js";
import {
  applyEnglishExactRepairs,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import { HEBREW_CANONICAL_MEANING_POLICY_ID } from "../src/lexiconV3/hebrewCanonicalPolicy.js";
import { buildHebrewExactMeaningRepairProjection } from "../src/lexiconV3/hebrewExactMeaningRepair.js";
import {
  hasMeaningfulTbeshHtml,
  parseTbeshMeaning
} from "../src/lexiconV3/tbeshMeaning.js";
import type { TbeshPublicationAction } from "../src/lexiconV3/tbeshPublication.js";

const FIXED_TIME = "2026-07-13T00:00:00.000Z";

interface Fixture {
  directory: string;
  sourceDatabase: string;
  authoringDatabase: string;
}

interface FixtureEntry {
  id: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  meaning: string;
  action: TbeshPublicationAction;
  companionHtml?: string;
  editorialHtml?: string;
}

test("audits raw TBESH meanings, derived sections and evidence deterministically", (t) => {
  const fixture = createFixture(t);
  const options = {
    sourceDatabase: fixture.sourceDatabase,
    authoringDatabase: fixture.authoringDatabase,
    generatedAt: FIXED_TIME
  };

  const first = buildLexiconV3TbeshSectionAudit(options);
  const second = buildLexiconV3TbeshSectionAudit(options);

  assert.equal(first.ok, true);
  assert.deepEqual(first, second);
  assert.equal(
    renderLexiconV3TbeshSectionAuditJson(first),
    renderLexiconV3TbeshSectionAuditJson(second)
  );
  assert.equal(
    renderLexiconV3TbeshSectionAuditMarkdown(first),
    renderLexiconV3TbeshSectionAuditMarkdown(second)
  );
  assert.deepEqual(first.counts.classifications, {
    both: 4,
    specific_only: 1,
    legacy_only: 1,
    empty: 0
  });
  assert.deepEqual(first.counts.publicationActions, {
    raw_combined: 1,
    step_specific_only: 1,
    legacy_general_only: 1,
    exact_companion: 1,
    editorial_reconstruction: 1,
    blocked: 1
  });
  assert.deepEqual(first.counts.separatorCounts, { "1": 6 });
  assert.deepEqual(first.counts.activeEnglishMeaningStates, {
    auto_validated: 5,
    candidate: 1
  });
  assert.deepEqual(first.counts.assertions, {
    rawExpected: 6,
    rawFound: 6,
    stepSpecificExpected: 5,
    stepSpecificFound: 5,
    legacyGeneralExpected: 5,
    legacyGeneralFound: 5
  });
  assert.deepEqual(first.counts.evidence, {
    publishableSupportsExpected: 5,
    publishableSupportsFound: 5,
    rawSupportsExpected: 1,
    rawSupportsFound: 1,
    stepSpecificSupportsExpected: 1,
    stepSpecificSupportsFound: 1,
    legacyGeneralSupportsExpected: 1,
    legacyGeneralSupportsFound: 1,
    exactCompanionSupportsExpected: 1,
    exactCompanionSupportsFound: 1,
    editorialReconstructionSupportsExpected: 1,
    editorialReconstructionSupportsFound: 1,
    exactRepairSupportsExpected: 0,
    exactRepairSupportsFound: 0,
    rawContextExpected: 4,
    rawContextFound: 4,
    stepSpecificContextExpected: 4,
    stepSpecificContextFound: 4,
    legacyGeneralContextExpected: 4,
    legacyGeneralContextFound: 4
  });
  assert.deepEqual(first.counts.issues.byStatus, { open: 6 });
  assert.equal(first.counts.frenchContent.total, 0);
  assert.match(first.logicalDigests.sourceSections, /^[0-9a-f]{64}$/u);
  assert.match(first.logicalDigests.authoringSections, /^[0-9a-f]{64}$/u);
  assert.doesNotThrow(() => assertLexiconV3TbeshSectionAudit(first));
});

test("fails after diagnostics are written when source, assertions or FR drift", (t) => {
  const fixture = createFixture(t);
  const source = new DatabaseSync(fixture.sourceDatabase);
  source
    .prepare("UPDATE StepEntries SET meaning = ? WHERE id = 1")
    .run("Specific § Legacy § Extra");
  source.close();

  const authoring = new DatabaseSync(fixture.authoringDatabase);
  authoring
    .prepare("DELETE FROM LexiconSourceAssertions WHERE locator = ?")
    .run("StepEntries:1:meaning:step-specific");
  authoring
    .prepare(
      `INSERT INTO LexiconFieldVersions
         (entryKey, locale, field, valueText, valueHtml, state)
       VALUES ('hebrew:H0001', 'fr', 'meaning', 'français', NULL, 'candidate')`
    )
    .run();
  authoring.close();

  const options = {
    sourceDatabase: fixture.sourceDatabase,
    authoringDatabase: fixture.authoringDatabase,
    generatedAt: FIXED_TIME
  };
  const report = buildLexiconV3TbeshSectionAudit(options);
  const codes = new Set(report.violations.map((violation) => violation.code));

  assert.equal(report.ok, false);
  assert.ok(codes.has("tbesh-multiple-section-separators"));
  assert.ok(codes.has("tbesh-raw-html-lost"));
  assert.ok(codes.has("tbesh-step-specific-assertion-missing"));
  assert.ok(codes.has("tbesh-french-content-present"));
  assert.throws(
    () => assertLexiconV3TbeshSectionAudit(report),
    /tbesh-section-audit-failed/u
  );

  const outputJson = join(fixture.directory, "audit.json");
  const outputMarkdown = join(fixture.directory, "audit.md");
  assert.throws(
    () =>
      runLexiconV3TbeshSectionAudit({
        ...options,
        outputJson,
        outputMarkdown
      }),
    /tbesh-section-audit-failed/u
  );
  assert.equal(existsSync(outputJson), true);
  assert.equal(existsSync(outputMarkdown), true);
  assert.equal(
    (JSON.parse(readFileSync(outputJson, "utf8")) as { ok: boolean }).ok,
    false
  );
  assert.match(readFileSync(outputMarkdown, "utf8"), /Status: \*\*FAIL\*\*/u);
});

test("fails closed when a canonical meaning proof is no longer proven", (t) => {
  const fixture = createFixture(t);
  const authoring = new DatabaseSync(fixture.authoringDatabase);
  const field = authoring
    .prepare(
      `SELECT id FROM LexiconFieldVersions
       WHERE entryKey = 'hebrew:H0006' AND locale = 'en' AND field = 'meaning'`
    )
    .get() as { id: number };
  authoring
    .prepare(
      `UPDATE LexiconFieldEvidence
       SET detailsJson = json_set(
         detailsJson,
         '$.publicationSelection.canonicalPolicyProof.proven',
         0
       )
       WHERE fieldVersionId = ?`
    )
    .run(field.id);
  authoring.close();

  const report = buildLexiconV3TbeshSectionAudit({
    sourceDatabase: fixture.sourceDatabase,
    authoringDatabase: fixture.authoringDatabase,
    generatedAt: FIXED_TIME
  });
  const codes = new Set(report.violations.map((violation) => violation.code));
  assert.equal(report.ok, false);
  assert.ok(codes.has("tbesh-canonical-policy-proof-invalid"));
  assert.ok(codes.has("tbesh-publication-selection-drift"));
});

test("accepts only sealed exact-repair publication contracts for H3356H and H3659", (t) => {
  for (const entryKey of ["hebrew:H3356H", "hebrew:H3659"] as const) {
    const fixture = createExactRepairFixture(t, entryKey);
    const report = buildLexiconV3TbeshSectionAudit({
      sourceDatabase: fixture.sourceDatabase,
      authoringDatabase: fixture.authoringDatabase,
      generatedAt: FIXED_TIME
    });
    assert.equal(report.ok, true, entryKey);
    assert.deepEqual(report.counts.exactMeaningRepairs, {
      expected: 1,
      found: 1,
      byMode: {
        [entryKey === "hebrew:H3356H"
          ? "repaired_step_specific"
          : "repaired_full_replacement"]: 1
      }
    });
    assert.equal(report.counts.publicationActions.raw_combined, 0);
    assert.equal(report.counts.evidence.exactRepairSupportsExpected, 1);
    assert.equal(report.counts.evidence.exactRepairSupportsFound, 1);
  }
});

test("fails exact repairs closed on published bytes, proof, issue or raw linkage drift", async (t) => {
  await t.test("published bytes", () => {
    const fixture = createExactRepairFixture(t, "hebrew:H3356H");
    const db = new DatabaseSync(fixture.authoringDatabase);
    db.prepare(
      `UPDATE LexiconFieldVersions SET valueHtml = valueHtml || ' drift'
       WHERE entryKey = 'hebrew:H3356H' AND field = 'meaning'`
    ).run();
    db.close();
    const report = buildLexiconV3TbeshSectionAudit({
      sourceDatabase: fixture.sourceDatabase,
      authoringDatabase: fixture.authoringDatabase,
      generatedAt: FIXED_TIME
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.violations.some(
        (violation) =>
          violation.code === "tbesh-exact-repair-publication-html-drift"
      )
    );
  });

  await t.test("repair proof", () => {
    const fixture = createExactRepairFixture(t, "hebrew:H3659");
    const db = new DatabaseSync(fixture.authoringDatabase);
    db.prepare(
      `UPDATE LexiconFieldEvidence
       SET detailsJson = json_set(detailsJson, '$.repair.repairDigest', ?)
       WHERE stance = 'supports'`
    ).run("0".repeat(64));
    db.close();
    const report = buildLexiconV3TbeshSectionAudit({
      sourceDatabase: fixture.sourceDatabase,
      authoringDatabase: fixture.authoringDatabase,
      generatedAt: FIXED_TIME
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.violations.some(
        (violation) => violation.code === "tbesh-exact-repair-proof-invalid"
      )
    );
  });

  await t.test("dedicated issue", () => {
    const fixture = createExactRepairFixture(t, "hebrew:H3659");
    const db = new DatabaseSync(fixture.authoringDatabase);
    db.prepare("DELETE FROM LexiconIssues").run();
    db.close();
    const report = buildLexiconV3TbeshSectionAudit({
      sourceDatabase: fixture.sourceDatabase,
      authoringDatabase: fixture.authoringDatabase,
      generatedAt: FIXED_TIME
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.violations.some(
        (violation) => violation.code === "tbesh-exact-repair-issue-missing"
      )
    );
  });

  await t.test("raw section assertion", () => {
    const fixture = createExactRepairFixture(t, "hebrew:H3356H");
    const db = new DatabaseSync(fixture.authoringDatabase);
    db.prepare(
      `UPDATE LexiconSourceAssertions SET valueHtml = valueHtml || ' drift'
       WHERE locator LIKE 'StepEntries:%:meaning:step-specific'`
    ).run();
    db.close();
    const report = buildLexiconV3TbeshSectionAudit({
      sourceDatabase: fixture.sourceDatabase,
      authoringDatabase: fixture.authoringDatabase,
      generatedAt: FIXED_TIME
    });
    assert.equal(report.ok, false);
    assert.ok(
      report.violations.some(
        (violation) => violation.code === "tbesh-step-specific-html-drift"
      )
    );
  });
});

function createExactRepairFixture(
  t: TestContext,
  entryKey: "hebrew:H3356H" | "hebrew:H3659"
): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-tbesh-repair-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourceDatabase = join(directory, "source.sqlite");
  const authoringDatabase = join(directory, "authoring.sqlite");
  const stepEntryId = entryKey === "hebrew:H3356H" ? 15647 : 16072;
  const production = new DatabaseSync(
    "data/dictionaries/strong_lexicon.full.production.sqlite",
    { readOnly: true }
  );
  const entry = production
    .prepare(
      `SELECT language, eStrong, dStrong, uStrong, original, transliteration,
              morph, gloss, meaning
       FROM StepEntries WHERE id = ?`
    )
    .get(stepEntryId) as unknown as EnglishExactRepairEntry;
  production.close();
  const replay = applyEnglishExactRepairs(entry, {
    databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
    sourceDigests: {
      TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
      TIPNR: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR
    }
  });
  const repair = replay?.repairs.find((item) => item.field === "meaning");
  assert.ok(repair);
  const projection = buildHebrewExactMeaningRepairProjection(repair);
  const sections = parseTbeshMeaning(entry.meaning);

  const source = new DatabaseSync(sourceDatabase);
  source.exec(`
    CREATE TABLE StepEntries (
      id INTEGER PRIMARY KEY,
      language TEXT NOT NULL,
      eStrong TEXT NOT NULL,
      dStrong TEXT NOT NULL,
      uStrong TEXT NOT NULL,
      original TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      morph TEXT NOT NULL,
      gloss TEXT NOT NULL,
      meaning TEXT NOT NULL
    );
  `);
  source
    .prepare(
      `INSERT INTO StepEntries (
         id, language, eStrong, dStrong, uStrong, original, transliteration,
         morph, gloss, meaning
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      stepEntryId,
      entry.language,
      entry.eStrong,
      entry.dStrong,
      entry.uStrong,
      entry.original,
      entry.transliteration,
      entry.morph,
      entry.gloss,
      entry.meaning
    );
  source.close();

  const authoring = new DatabaseSync(authoringDatabase);
  authoring.exec(`
    CREATE TABLE LexiconEntryIds (
      entryKey TEXT NOT NULL,
      stepEntryId INTEGER NOT NULL
    );
    CREATE TABLE LexiconSources (
      id INTEGER PRIMARY KEY,
      sourceKey TEXT NOT NULL
    );
    CREATE TABLE LexiconSourceAssertions (
      id INTEGER PRIMARY KEY,
      sourceId INTEGER NOT NULL,
      entryKey TEXT NOT NULL,
      scope TEXT NOT NULL,
      field TEXT NOT NULL,
      locale TEXT NOT NULL,
      valueText TEXT,
      valueHtml TEXT,
      locator TEXT NOT NULL,
      sha256 TEXT NOT NULL
    );
    CREATE TABLE LexiconFieldVersions (
      id INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL,
      locale TEXT NOT NULL,
      field TEXT NOT NULL,
      valueText TEXT NOT NULL,
      valueHtml TEXT,
      state TEXT NOT NULL,
      method TEXT NOT NULL,
      generator TEXT NOT NULL
    );
    CREATE TABLE LexiconFieldEvidence (
      id INTEGER PRIMARY KEY,
      fieldVersionId INTEGER NOT NULL,
      sourceAssertionId INTEGER,
      evidenceKind TEXT NOT NULL,
      stance TEXT NOT NULL,
      witnessFamily TEXT NOT NULL,
      detailsJson TEXT NOT NULL
    );
    CREATE TABLE LexiconIssues (
      id INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL,
      fieldVersionId INTEGER,
      sourceAssertionId INTEGER,
      code TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      detailsJson TEXT NOT NULL
    );
    CREATE TABLE LexiconCarrierTerms (
      id INTEGER PRIMARY KEY,
      locale TEXT NOT NULL
    );
    INSERT INTO LexiconSources (id, sourceKey)
    VALUES (1, 'step-tbesh-meaning'), (2, 'artifact-english-audit');
  `);
  authoring
    .prepare(
      "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
    )
    .run(entryKey, stepEntryId);
  const insertAssertion = authoring.prepare(
    `INSERT INTO LexiconSourceAssertions
       (sourceId, entryKey, scope, field, locale, valueText, valueHtml,
        locator, sha256)
     VALUES (?, ?, ?, 'meaning', 'en', ?, ?, ?, ?)`
  );
  const rawAssertionId = insertFixtureAssertion({
    statement: insertAssertion,
    sourceId: 1,
    entryKey,
    scope: "entry",
    valueHtml: entry.meaning,
    locator: `StepEntries:${stepEntryId}:meaning`
  });
  const stepAssertionId = insertFixtureAssertion({
    statement: insertAssertion,
    sourceId: 1,
    entryKey,
    scope: "entry",
    valueHtml: sections.stepSpecificHtml,
    locator: `StepEntries:${stepEntryId}:meaning:step-specific`
  });
  const legacyAssertionId = insertFixtureAssertion({
    statement: insertAssertion,
    sourceId: 1,
    entryKey,
    scope: "base_strong",
    valueHtml: sections.legacyGeneralHtml,
    locator: `StepEntries:${stepEntryId}:meaning:legacy-general`
  });
  const repairAssertionId = insertFixtureAssertion({
    statement: insertAssertion,
    sourceId: 2,
    entryKey,
    scope: "entry",
    valueHtml: repair.repairedValue,
    locator: `english-audit-field-repair:${entryKey}:meaning:${repair.ruleId}`,
    digest: repair.repairDigest
  });
  const publishedHtml = projection.publishedHtml.replaceAll("<->", "&lt;-&gt;");
  const fieldId = Number(
    authoring
      .prepare(
        `INSERT INTO LexiconFieldVersions
           (entryKey, locale, field, valueText, valueHtml, state, method,
            generator)
         VALUES (?, 'en', 'meaning', ?, ?, 'auto_validated', 'rule',
                 'english-audit-field-repair@1')`
      )
      .run(entryKey, visibleText(publishedHtml), publishedHtml).lastInsertRowid
  );
  const insertEvidence = authoring.prepare(
    `INSERT INTO LexiconFieldEvidence
       (fieldVersionId, sourceAssertionId, evidenceKind, stance,
        witnessFamily, detailsJson)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  insertEvidence.run(
    fieldId,
    repairAssertionId,
    "validator",
    "supports",
    "lexicon-v3-audit-field-repair",
    JSON.stringify({
      repair,
      role: "exact-source-field-repair",
      exactMeaningRepairProjection: projection
    })
  );
  insertEvidence.run(
    fieldId,
    rawAssertionId,
    "direct_source",
    entryKey === "hebrew:H3659" ? "contradicts" : "context",
    "STEP-TBES",
    JSON.stringify({
      exactMeaningRepairProjection: projection,
      role: "quarantined-raw-source"
    })
  );
  insertEvidence.run(
    fieldId,
    stepAssertionId,
    "direct_source",
    "context",
    "STEP-TBESH-step-specific",
    JSON.stringify({
      exactMeaningRepairProjection: projection,
      role: "step-specific",
      digest: hash(sections.stepSpecificHtml)
    })
  );
  insertEvidence.run(
    fieldId,
    legacyAssertionId,
    "direct_source",
    "context",
    "STEP-TBESH-legacy-general",
    JSON.stringify({
      exactMeaningRepairProjection: projection,
      role: "legacy-general",
      digest: hash(sections.legacyGeneralHtml)
    })
  );
  authoring
    .prepare(
      `INSERT INTO LexiconIssues
         (entryKey, fieldVersionId, sourceAssertionId, code, severity, status,
          detailsJson)
       VALUES (?, ?, ?, 'hebrew-tbesh-exact-meaning-repair-applied',
               'info', 'open', ?)`
    )
    .run(
      entryKey,
      fieldId,
      repairAssertionId,
      JSON.stringify({
        repair,
        projection,
        rawSource: {
          assertionId: rawAssertionId,
          rawHtmlDigest: hash(entry.meaning),
          sectionSeparatorCount: sections.sectionSeparatorCount,
          stepSpecificAssertionId: stepAssertionId,
          stepSpecificDigest: hash(sections.stepSpecificHtml),
          legacyGeneralAssertionId: legacyAssertionId,
          legacyGeneralDigest: hash(sections.legacyGeneralHtml)
        },
        publicationSource: "artifact-english-audit"
      })
    );
  authoring.close();
  return { directory, sourceDatabase, authoringDatabase };
}

function createFixture(t: TestContext): Fixture {
  const directory = mkdtempSync(join(tmpdir(), "lexicon-v3-tbesh-audit-"));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  const sourceDatabase = join(directory, "source.sqlite");
  const authoringDatabase = join(directory, "authoring.sqlite");
  const entries: FixtureEntry[] = [
    {
      id: 1,
      eStrong: "H0001",
      dStrong: "H0001",
      uStrong: "H0001",
      meaning: "Specific<br /> § <br />Legacy",
      action: "raw_combined"
    },
    {
      id: 2,
      eStrong: "H0002",
      dStrong: "H0002",
      uStrong: "H0002",
      meaning: "<br /> § <br />Legacy only",
      action: "exact_companion",
      companionHtml: "<p>Exact H0002 companion.</p>"
    },
    {
      id: 3,
      eStrong: "H0003",
      dStrong: "H0003",
      uStrong: "H0003",
      meaning: "Specific only<br /> § <br />",
      action: "step_specific_only"
    },
    {
      id: 4,
      eStrong: "H0004",
      dStrong: "H0004",
      uStrong: "H0004",
      meaning: "Unproven specific<br /> § <br />Unproven legacy",
      action: "blocked"
    },
    {
      id: 5,
      eStrong: "H0005",
      dStrong: "H0005",
      uStrong: "H0005",
      meaning: "Wrong sibling notice<br /> § <br />Exact lexical tail",
      action: "legacy_general_only"
    },
    {
      id: 6,
      eStrong: "H0006",
      dStrong: "H0006",
      uStrong: "H0006",
      meaning: "Conflicted entity notice<br /> § <br />Shared family notice",
      action: "editorial_reconstruction",
      editorialHtml: "<p>Sealed exact H0006 reconstruction.</p>"
    }
  ];

  const source = new DatabaseSync(sourceDatabase);
  source.exec(`
    CREATE TABLE StepEntries (
      id INTEGER PRIMARY KEY,
      language TEXT NOT NULL,
      eStrong TEXT NOT NULL,
      dStrong TEXT NOT NULL,
      uStrong TEXT NOT NULL,
      original TEXT NOT NULL DEFAULT '',
      transliteration TEXT NOT NULL DEFAULT '',
      morph TEXT NOT NULL DEFAULT 'N:',
      gloss TEXT NOT NULL DEFAULT 'fixture',
      meaning TEXT NOT NULL
    );
  `);
  const insertSource = source.prepare(
    `INSERT INTO StepEntries
       (id, language, eStrong, dStrong, uStrong, meaning)
     VALUES (?, 'hebrew', ?, ?, ?, ?)`
  );
  for (const entry of entries) {
    insertSource.run(
      entry.id,
      entry.eStrong,
      entry.dStrong,
      entry.uStrong,
      entry.meaning
    );
  }
  source.close();

  const authoring = new DatabaseSync(authoringDatabase);
  authoring.exec(`
    CREATE TABLE LexiconEntryIds (
      entryKey TEXT NOT NULL,
      stepEntryId INTEGER NOT NULL
    );
    CREATE TABLE LexiconSources (
      id INTEGER PRIMARY KEY,
      sourceKey TEXT NOT NULL
    );
    CREATE TABLE LexiconSourceAssertions (
      id INTEGER PRIMARY KEY,
      sourceId INTEGER NOT NULL,
      entryKey TEXT NOT NULL,
      scope TEXT NOT NULL,
      field TEXT NOT NULL,
      locale TEXT NOT NULL,
      valueText TEXT,
      valueHtml TEXT,
      locator TEXT NOT NULL,
      sha256 TEXT NOT NULL
    );
    CREATE TABLE LexiconFieldVersions (
      id INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL,
      locale TEXT NOT NULL,
      field TEXT NOT NULL,
      valueText TEXT NOT NULL,
      valueHtml TEXT,
      state TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'source',
      generator TEXT NOT NULL DEFAULT 'buildLexiconV3Authoring@1'
    );
    CREATE TABLE LexiconFieldEvidence (
      id INTEGER PRIMARY KEY,
      fieldVersionId INTEGER NOT NULL,
      sourceAssertionId INTEGER,
      evidenceKind TEXT NOT NULL,
      stance TEXT NOT NULL,
      witnessFamily TEXT NOT NULL,
      detailsJson TEXT NOT NULL
    );
    CREATE TABLE LexiconIssues (
      id INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL,
      fieldVersionId INTEGER,
      sourceAssertionId INTEGER,
      code TEXT NOT NULL,
      severity TEXT NOT NULL,
      status TEXT NOT NULL,
      detailsJson TEXT NOT NULL DEFAULT '{}'
    );
    CREATE TABLE LexiconCarrierTerms (
      id INTEGER PRIMARY KEY,
      locale TEXT NOT NULL
    );
    INSERT INTO LexiconSources (id, sourceKey)
    VALUES (1, 'step-tbesh-meaning'),
           (2, 'artifact-hebrew-open-english'),
           (3, 'artifact-hebrew-meaning-adjudication');
  `);
  const insertEntryId = authoring.prepare(
    "INSERT INTO LexiconEntryIds (entryKey, stepEntryId) VALUES (?, ?)"
  );
  const insertField = authoring.prepare(
    `INSERT INTO LexiconFieldVersions
       (entryKey, locale, field, valueText, valueHtml, state, method, generator)
     VALUES (?, 'en', 'meaning', ?, ?, ?, ?, ?)`
  );
  const insertAssertion = authoring.prepare(
    `INSERT INTO LexiconSourceAssertions
       (sourceId, entryKey, scope, field, locale, valueText, valueHtml,
        locator, sha256)
     VALUES (?, ?, ?, 'meaning', 'en', ?, ?, ?, ?)`
  );
  const insertEvidence = authoring.prepare(
    `INSERT INTO LexiconFieldEvidence
       (fieldVersionId, sourceAssertionId, evidenceKind, stance,
        witnessFamily, detailsJson)
     VALUES (?, ?, ?, ?, ?, ?)`
  );
  const insertIssue = authoring.prepare(
    `INSERT INTO LexiconIssues
       (entryKey, fieldVersionId, sourceAssertionId, code, severity, status,
        detailsJson)
     VALUES (?, ?, ?, 'hebrew-tbesh-meaning-sectioned', 'info', 'open', ?)`
  );

  for (const entry of entries) {
    const entryKey = `hebrew:${entry.dStrong}`;
    const sections = parseTbeshMeaning(entry.meaning);
    insertEntryId.run(entryKey, entry.id);
    const rawAssertionId = insertFixtureAssertion({
      statement: insertAssertion,
      sourceId: 1,
      entryKey,
      scope: "entry",
      valueHtml: entry.meaning,
      locator: `StepEntries:${entry.id}:meaning`
    });
    let stepAssertionId: number | null = null;
    if (hasMeaningfulTbeshHtml(sections.stepSpecificHtml)) {
      stepAssertionId = insertFixtureAssertion({
        statement: insertAssertion,
        sourceId: 1,
        entryKey,
        scope: "entry",
        valueHtml: sections.stepSpecificHtml,
        locator: `StepEntries:${entry.id}:meaning:step-specific`
      });
    }
    let legacyAssertionId: number | null = null;
    if (hasMeaningfulTbeshHtml(sections.legacyGeneralHtml)) {
      legacyAssertionId = insertFixtureAssertion({
        statement: insertAssertion,
        sourceId: 1,
        entryKey,
        scope: "base_strong",
        valueHtml: sections.legacyGeneralHtml,
        locator: `StepEntries:${entry.id}:meaning:legacy-general`
      });
    }
    const companionAssertionId = entry.companionHtml
      ? insertFixtureAssertion({
          statement: insertAssertion,
          sourceId: 2,
          entryKey,
          scope: "entry",
          valueHtml: entry.companionHtml,
          locator: `hebrew-open-english:${hash(`companion:${entryKey}`)}`,
          digest: hash(`companion:${entryKey}`)
        })
      : null;
    const canonicalPolicyProof = fixtureCanonicalPolicyProof(entry, sections);
    const editorialSelection = asFixtureRecord(canonicalPolicyProof?.selection);
    const editorialAssertionId = entry.editorialHtml
      ? insertFixtureAssertion({
          statement: insertAssertion,
          sourceId: 3,
          entryKey,
          scope: "entry",
          valueHtml: entry.editorialHtml,
          locator: `hebrew-meaning-adjudication:${entry.dStrong}:${String(editorialSelection?.recordDigest)}`,
          digest: String(editorialSelection?.recordDigest)
        })
      : null;
    const decision = fixturePublicationDecision(entry, sections);
    const proof =
      entry.action === "exact_companion" ? fixtureProof(entry) : null;
    const counterfactualAction = canonicalPolicyProof ? "blocked" : null;
    const selectionDigest = fixtureSelectionDigest(
      entry,
      decision,
      proof,
      canonicalPolicyProof,
      counterfactualAction
    );
    const publicationSelection = {
      action: decision.action,
      ...(canonicalPolicyProof
        ? { canonicalPolicyProof, counterfactualAction }
        : {}),
      proof,
      quarantinedParts: decision.quarantinedParts.map((part) => ({
        digest: hash(part.html),
        part: part.part,
        reasonCode: part.reasonCode
      })),
      reasonCodes: decision.reasonCodes,
      selectionDigest
    };
    const selectedHtml =
      entry.action === "step_specific_only"
        ? sections.stepSpecificHtml
        : entry.action === "legacy_general_only"
          ? sections.legacyGeneralHtml
          : entry.action === "editorial_reconstruction"
            ? entry.editorialHtml!
            : entry.action === "exact_companion"
              ? entry.companionHtml!
              : entry.meaning;
    const state = entry.action === "blocked" ? "candidate" : "auto_validated";
    const method =
      entry.action === "editorial_reconstruction"
        ? "editorial"
        : canonicalPolicyProof
          ? "rule"
          : entry.action === "exact_companion"
            ? "import"
            : entry.action === "step_specific_only"
              ? "rule"
              : "source";
    const generator = canonicalPolicyProof
      ? HEBREW_CANONICAL_MEANING_POLICY_ID
      : entry.action === "blocked"
        ? "buildLexiconV3Authoring@1"
        : "tbesh-publication-selector@1";
    const fieldId = Number(
      insertField.run(
        entryKey,
        visibleText(selectedHtml),
        selectedHtml.replaceAll("<->", "&lt;-&gt;"),
        state,
        method,
        generator
      ).lastInsertRowid
    );
    const canonicalAssertionId =
      entry.action === "step_specific_only"
        ? stepAssertionId!
        : entry.action === "legacy_general_only"
          ? legacyAssertionId!
          : entry.action === "editorial_reconstruction"
            ? editorialAssertionId!
            : entry.action === "exact_companion"
              ? companionAssertionId!
              : rawAssertionId;
    insertEvidence.run(
      fieldId,
      canonicalAssertionId,
      entry.action === "editorial_reconstruction"
        ? "validator"
        : entry.action === "exact_companion"
          ? "cross_source"
          : "direct_source",
      "supports",
      entry.action === "exact_companion"
        ? "OpenScriptures+STEP-TIPNR"
        : entry.action === "step_specific_only"
          ? "STEP-TBESH-step-specific"
          : entry.action === "legacy_general_only"
            ? "STEP-TBESH-legacy-general"
            : entry.action === "editorial_reconstruction"
              ? "lexicon-v3-hebrew-adjudication"
              : "STEP-TBES",
      JSON.stringify({
        publicationSelection,
        role:
          entry.action === "exact_companion"
            ? "exact-companion"
            : entry.action === "step_specific_only"
              ? "step-specific"
              : entry.action === "legacy_general_only"
                ? "legacy-general-exact-section"
                : entry.action === "editorial_reconstruction"
                  ? "editorial-reconstruction"
                  : "canonical-raw"
      })
    );
    if (
      [
        "step_specific_only",
        "legacy_general_only",
        "exact_companion",
        "editorial_reconstruction"
      ].includes(entry.action)
    ) {
      insertEvidence.run(
        fieldId,
        rawAssertionId,
        "direct_source",
        [
          "legacy_general_only",
          "exact_companion",
          "editorial_reconstruction"
        ].includes(entry.action)
          ? "contradicts"
          : "context",
        "STEP-TBES",
        JSON.stringify({
          publicationSelection,
          role: "quarantined-raw-source"
        })
      );
    }
    if (stepAssertionId && entry.action !== "step_specific_only") {
      insertEvidence.run(
        fieldId,
        stepAssertionId,
        "direct_source",
        "context",
        "STEP-TBESH-step-specific",
        JSON.stringify({
          publicationSelection,
          role: "step-specific",
          digest: hash(sections.stepSpecificHtml)
        })
      );
    }
    if (legacyAssertionId && entry.action !== "legacy_general_only") {
      insertEvidence.run(
        fieldId,
        legacyAssertionId,
        "direct_source",
        ["exact_companion", "editorial_reconstruction"].includes(entry.action)
          ? "contradicts"
          : "context",
        "STEP-TBESH-legacy-general",
        JSON.stringify({
          publicationSelection,
          role: "legacy-general",
          digest: hash(sections.legacyGeneralHtml)
        })
      );
    }
    insertIssue.run(
      entryKey,
      fieldId,
      rawAssertionId,
      JSON.stringify({
        publicationDecision: decision,
        publicationProof: proof,
        selectionDigest
      })
    );
  }
  authoring.close();
  return { directory, sourceDatabase, authoringDatabase };
}

function insertFixtureAssertion(input: {
  statement: ReturnType<DatabaseSync["prepare"]>;
  sourceId: number;
  entryKey: string;
  scope: string;
  valueHtml: string;
  locator: string;
  digest?: string;
}): number {
  const valueText = visibleText(input.valueHtml);
  const digest = input.digest ?? hash(`${valueText}\u0000${input.valueHtml}`);
  return Number(
    input.statement.run(
      input.sourceId,
      input.entryKey,
      input.scope,
      valueText,
      input.valueHtml,
      input.locator,
      digest
    ).lastInsertRowid
  );
}

function fixturePublicationDecision(
  entry: FixtureEntry,
  sections: ReturnType<typeof parseTbeshMeaning>
) {
  const reasonCode = `fixture-${entry.action}`;
  if (entry.action === "blocked") {
    return {
      action: entry.action,
      content: null,
      rawProvenanceHtml: entry.meaning,
      quarantinedParts: [
        {
          part: "raw_combined",
          html: entry.meaning,
          reasonCode
        }
      ],
      reasonCodes: [reasonCode]
    };
  }
  if (entry.action === "exact_companion") {
    return {
      action: entry.action,
      content: {
        html: entry.companionHtml!,
        source: "hebrew_english_exact_companion"
      },
      rawProvenanceHtml: entry.meaning,
      quarantinedParts: [
        {
          part: "raw_combined",
          html: entry.meaning,
          reasonCode
        }
      ],
      reasonCodes: [reasonCode]
    };
  }
  if (entry.action === "legacy_general_only") {
    return {
      action: entry.action,
      content: {
        html: sections.legacyGeneralHtml,
        source: "tbesh_legacy_general"
      },
      rawProvenanceHtml: entry.meaning,
      quarantinedParts: [
        {
          part: "raw_combined",
          html: entry.meaning,
          reasonCode
        }
      ],
      reasonCodes: [reasonCode]
    };
  }
  if (entry.action === "editorial_reconstruction") {
    return {
      action: entry.action,
      content: {
        html: entry.editorialHtml!,
        source: "lexicon_v3_hebrew_adjudication"
      },
      rawProvenanceHtml: entry.meaning,
      quarantinedParts: [
        {
          part: "raw_combined",
          html: entry.meaning,
          reasonCode
        }
      ],
      reasonCodes: [reasonCode]
    };
  }
  if (entry.action === "step_specific_only") {
    return {
      action: entry.action,
      content: {
        html: sections.stepSpecificHtml,
        source: "tbesh_step_specific"
      },
      rawProvenanceHtml: entry.meaning,
      quarantinedParts: [],
      reasonCodes: [reasonCode]
    };
  }
  return {
    action: entry.action,
    content: { html: entry.meaning, source: "tbesh_raw" },
    rawProvenanceHtml: entry.meaning,
    quarantinedParts: [],
    reasonCodes: [reasonCode]
  };
}

function fixtureCanonicalPolicyProof(
  entry: FixtureEntry,
  sections: ReturnType<typeof parseTbeshMeaning>
) {
  if (
    !["legacy_general_only", "editorial_reconstruction"].includes(entry.action)
  ) {
    return null;
  }
  const policyDigest = hash("fixture-canonical-meaning-policy");
  const selectedHtml =
    entry.action === "legacy_general_only"
      ? sections.legacyGeneralHtml
      : entry.editorialHtml!;
  const source =
    entry.action === "legacy_general_only"
      ? "tbesh_legacy_general"
      : "lexicon_v3_hebrew_adjudication";
  return {
    policy: {
      id: HEBREW_CANONICAL_MEANING_POLICY_ID,
      digest: policyDigest
    },
    proven: true,
    disposition:
      entry.action === "legacy_general_only"
        ? "publish_legacy_general"
        : "publish_editorial_reconstruction",
    basis: "sealed_residual_adjudication",
    canonicalRawProof: null,
    selection: {
      html: selectedHtml,
      source,
      recordDigest: hash(`fixture-adjudication:${entry.dStrong}`)
    },
    conflictKind: null,
    facts: {
      auditDigestValid: true,
      residualAdjudicationExact: true
    },
    reasonCodes: ["hebrew-canonical-meaning:sealed_residual_adjudication"],
    structure: {
      rawPreserved: false,
      hasSectionSeparator: true,
      sectionSeparatorCount: 1,
      stepSpecificScope: "step_specific",
      baseStrongContextScope: "base_strong_context",
      rawHtmlDigest: hash(entry.meaning),
      stepSpecificDigest: hasMeaningfulTbeshHtml(sections.stepSpecificHtml)
        ? hash(sections.stepSpecificHtml)
        : null,
      baseStrongContextDigest: hasMeaningfulTbeshHtml(
        sections.legacyGeneralHtml
      )
        ? hash(sections.legacyGeneralHtml)
        : null
    },
    digests: {
      policy: policyDigest,
      ledger: hash("fixture-canonical-meaning-ledger"),
      content: hash(`fixture-content:${entry.dStrong}`),
      proof: hash(`fixture-proof:${entry.dStrong}`)
    }
  };
}

function asFixtureRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function fixtureProof(entry: FixtureEntry) {
  return {
    proven: true,
    issueCodes: [],
    method: "open-scriptures-lexical-exact",
    normalizedPrimaryDStrong: entry.dStrong,
    normalizedCandidateDStrong: entry.dStrong,
    facts: {
      meaningHasContent: true,
      meaningValidated: true,
      candidateValidated: true,
      exactCandidateIdentity: true,
      exactOccurrenceCount: 1,
      tipnrEntityId: null,
      tipnrReferencesValid: true,
      exactOccurrenceIntersectsTipnr: false,
      lexicalIndexId: "fixture",
      augmentedStrong: null,
      augmentedStrongExact: false
    },
    references: { tipnrEntity: [], exactTahotOccurrences: ["Gen.1.1"] }
  };
}

function fixtureSelectionDigest(
  entry: FixtureEntry,
  decision: ReturnType<typeof fixturePublicationDecision>,
  proof: ReturnType<typeof fixtureProof> | null,
  canonicalPolicyProof: ReturnType<typeof fixtureCanonicalPolicyProof>,
  counterfactualAction: TbeshPublicationAction | null
): string {
  const canonicalContract = canonicalPolicyProof !== null;
  return hash(
    stableJson({
      action: decision.action,
      ...(canonicalContract ? { canonicalPolicyProof } : {}),
      contentHtml: decision.content?.html ?? null,
      ...(canonicalContract ? { counterfactualAction } : {}),
      proof: proof
        ? {
            issueCodes: proof.issueCodes,
            method: proof.method,
            normalizedCandidateDStrong: proof.normalizedCandidateDStrong,
            normalizedPrimaryDStrong: proof.normalizedPrimaryDStrong,
            proven: proof.proven,
            ...(canonicalContract ? { facts: proof.facts } : {}),
            references: proof.references
          }
        : null,
      quarantinedParts: decision.quarantinedParts,
      rawDigest: hash(entry.meaning),
      reasonCodes: decision.reasonCodes
    })
  );
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function visibleText(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
