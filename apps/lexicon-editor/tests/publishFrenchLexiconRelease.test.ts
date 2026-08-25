import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  expectedCoreTranslationFingerprint,
  publishFrenchLexiconRelease
} from "../scripts/publishFrenchLexiconRelease.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";

test("fingerprints core translations in SQLite stepEntryId order", () => {
  const tasks = [
    { identity: { stepEntryId: 20 } },
    { identity: { stepEntryId: 10 } }
  ];
  const finals = [
    {
      glossFr: "vingt",
      meaningFr: "sens vingt",
      meaningHtmlFr: "<b>vingt</b>"
    },
    { glossFr: "dix", meaningFr: "sens dix", meaningHtmlFr: "<b>dix</b>" }
  ];

  assert.equal(
    expectedCoreTranslationFingerprint(tasks, finals),
    hashFrenchInternalJson([
      [10, "dix", "sens dix", "<b>dix</b>"],
      [20, "vingt", "sens vingt", "<b>vingt</b>"]
    ])
  );
});

test("publishes the core and LSJ pair with archives while leaving occurrences untouched", () => {
  const root = mkdtempSync(join(tmpdir(), "french-lexicon-release-"));
  const authoring = join(root, "strong_lexicon.full.production.sqlite");
  const production = join(root, "strong_lexicon.en-fr.full.production.sqlite");
  const occurrences = join(
    root,
    "strong_lexicon.occurrences.production.sqlite"
  );
  createTemplate(authoring, false);
  createTemplate(production, true);
  const occurrenceDb = new DatabaseSync(occurrences);
  occurrenceDb.exec(
    "CREATE TABLE untouched(value TEXT); INSERT INTO untouched VALUES ('same');"
  );
  occurrenceDb.close();
  const occurrenceHash = fileHash(occurrences);

  const sourceHash = hash("source");
  const taskHash = hash("task");
  const responseHash = hash("response");
  const tasksPath = join(root, "tasks.jsonl");
  const finalPath = join(root, "final.jsonl");
  const provenancePath = join(root, "provenance.jsonl");
  const coreSummaryPath = join(root, "core-summary.json");
  const lsjPath = join(root, "final-resources.jsonl");
  const lsjSummaryPath = join(root, "lsj-summary.json");
  writeJsonl(tasksPath, [
    {
      entryKey: "hebrew:H0001G",
      sourceHash,
      taskHash,
      identity: {
        stepEntryId: 1,
        language: "hebrew",
        eStrong: "H0001",
        dStrong: "H0001G =",
        uStrong: "H0001G",
        original: "אָב",
        transliteration: "ab",
        morph: "H:N-M"
      },
      english: {
        gloss: "father",
        meaning: "<b>father</b>",
        meaningHtml: "<b>father</b>"
      }
    }
  ]);
  const final = {
    entryKey: "hebrew:H0001G",
    sourceHash,
    taskHash,
    translationHash: hash("translation"),
    reviewHash: hash("review"),
    arbitrationHash: null,
    finalHash: hash("final"),
    glossFr: "père",
    meaningFr: "père",
    meaningHtmlFr: "<b>père</b>",
    validation: {
      valid: true,
      validationHash: hash("validation"),
      rendered: { meaningFr: "père", meaningHtmlFr: "<b>père</b>" }
    }
  };
  writeJsonl(finalPath, [final]);
  writeJsonl(provenancePath, [
    {
      entryKey: final.entryKey,
      sourceHash,
      taskHash,
      pipelineVersion: "test-core@1",
      finalHash: final.finalHash,
      translation: {
        batchId: "translator-1",
        promptVersion: "translator@1",
        model: "internal-test",
        reasoningEffort: "low",
        responseHash,
        translationHash: final.translationHash
      },
      review: {
        batchId: "reviewer-1",
        promptVersion: "reviewer@1",
        model: "internal-test",
        reasoningEffort: "low",
        responseHash,
        reviewHash: final.reviewHash
      },
      arbitration: null,
      deterministicValidation: {
        valid: true,
        validationHash: hash("deterministic")
      },
      reviewedValidation: { valid: true, validationHash: hash("reviewed") }
    }
  ]);
  writeSummary(coreSummaryPath, {
    status: "complete",
    invalidFinal: 0,
    outputs: {
      final: { sha256: fileHash(finalPath) },
      provenance: { sha256: fileHash(provenancePath) }
    },
    execution: internalExecution()
  });
  const lsj = {
    key: "lsj:1",
    sourceId: 1,
    sourceHash: hash("<b>word</b>\nword"),
    contentHtmlFr: "<b>mot</b>",
    contentTextFr: "mot",
    translationHash: hash("<b>mot</b>"),
    stage: "reviewer",
    validation: { valid: true, issues: [], checks: { tags: true } },
    provenance: { reviewer: { responseHash } }
  };
  writeJsonl(lsjPath, [lsj]);
  writeSummary(lsjSummaryPath, {
    status: "complete",
    scope: "full",
    counts: { invalidFinal: 0 },
    artifacts: { finalResources: { sha256: fileHash(lsjPath) } },
    execution: internalExecution()
  });

  const report = publishFrenchLexiconRelease({
    coreTasksPath: tasksPath,
    coreFinalPath: finalPath,
    coreProvenancePath: provenancePath,
    coreSummaryPath,
    lsjFinalPath: lsjPath,
    lsjSummaryPath,
    authoringTemplatePath: authoring,
    productionTemplatePath: production,
    authoringTargetPath: authoring,
    productionTargetPath: production,
    occurrencesPath: occurrences,
    candidateDirectory: join(root, "candidates"),
    archiveDirectory: join(root, "archive"),
    reportPath: join(root, "publication.json"),
    releaseKey: "fr-test-1"
  }) as {
    published: Array<{ archive: string; verification: { integrity: string } }>;
  };

  assert.equal(report.published.length, 2);
  assert.ok(
    report.published.every((item) => item.verification.integrity === "ok")
  );
  assert.ok(report.published.every((item) => existsSync(item.archive)));
  assert.equal(fileHash(occurrences), occurrenceHash);
  for (const path of [authoring, production]) {
    const db = new DatabaseSync(path, { readOnly: true });
    assert.deepEqual(
      {
        ...db
          .prepare(
            "SELECT gloss, meaning, meaningHtml FROM LexiconTranslations WHERE stepEntryId=1 AND language='fr'"
          )
          .get()
      },
      { gloss: "père", meaning: "père", meaningHtml: "<b>père</b>" }
    );
    assert.deepEqual(
      {
        ...db
          .prepare(
            "SELECT contentHtml, contentText FROM LexiconResourceTranslations WHERE resourceId=1 AND language='fr'"
          )
          .get()
      },
      { contentHtml: "<b>mot</b>", contentText: "mot" }
    );
    assert.equal(
      Number(
        (
          db
            .prepare("SELECT count(*) AS count FROM LexiconFrenchProvenance")
            .get() as {
            count: number;
          }
        ).count
      ),
      1
    );
    assert.equal(
      String(db.prepare("PRAGMA integrity_check").get()?.integrity_check),
      "ok"
    );
    db.close();
  }
});

function createTemplate(path: string, withStatuses: boolean): void {
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE DictionaryMeta(key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE StepEntries(
      id INTEGER PRIMARY KEY, language TEXT NOT NULL, baseCode INTEGER NOT NULL,
      eStrong TEXT NOT NULL, dStrong TEXT NOT NULL, uStrong TEXT NOT NULL,
      original TEXT NOT NULL, transliteration TEXT NOT NULL, morph TEXT NOT NULL,
      gloss TEXT NOT NULL, meaning TEXT NOT NULL,
      classicTransliteration TEXT NOT NULL DEFAULT '', pronunciation TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE LexiconTranslations(
      stepEntryId INTEGER NOT NULL, language TEXT NOT NULL, gloss TEXT NOT NULL,
      meaning TEXT NOT NULL, meaningHtml TEXT NOT NULL, UNIQUE(stepEntryId, language)
    );
    CREATE TABLE LexiconResources(
      id INTEGER PRIMARY KEY, stepEntryId INTEGER NOT NULL, source TEXT NOT NULL,
      kind TEXT NOT NULL, contentHtml TEXT NOT NULL, UNIQUE(stepEntryId, source, kind)
    );
    CREATE TABLE LexiconResourceTranslations(
      resourceId INTEGER NOT NULL, language TEXT NOT NULL, contentHtml TEXT NOT NULL,
      contentText TEXT NOT NULL, UNIQUE(resourceId, language)
    );
    CREATE TABLE StableViewerData(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO DictionaryMeta VALUES ('source','STEP');
    INSERT INTO StepEntries VALUES (
      1,'hebrew',1,'H0001','H0001G =','H0001G','אָב','ab','H:N-M',
      'father','<b>father</b>','',''
    );
    INSERT INTO LexiconTranslations VALUES (1,'fr','ancien','ancien','<b>ancien</b>');
    INSERT INTO LexiconResources VALUES (1,1,'STEP-TFLSJ','lsj','<b>word</b>');
    INSERT INTO LexiconResourceTranslations VALUES (1,'fr','<b>ancien mot</b>','ancien mot');
    INSERT INTO StableViewerData VALUES (1,'preserved');
  `);
  if (withStatuses) {
    db.exec(`
      CREATE TABLE LexiconFieldStatus(
        stepEntryId INTEGER NOT NULL, locale TEXT NOT NULL, field TEXT NOT NULL,
        fieldVersionId INTEGER NOT NULL, state TEXT NOT NULL, confidence REAL NOT NULL,
        method TEXT NOT NULL, generator TEXT NOT NULL, contentHash TEXT NOT NULL,
        derivedFromVersionId INTEGER, releaseKey TEXT NOT NULL,
        PRIMARY KEY(stepEntryId, locale, field),
        FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
      ) WITHOUT ROWID;
      INSERT INTO LexiconFieldStatus VALUES
        (1,'en','gloss',1,'auto_validated',1,'source','test','a',NULL,'old'),
        (1,'en','meaning',2,'auto_validated',1,'source','test','b',NULL,'old'),
        (1,'fr','gloss',3,'auto_validated',1,'translation','test','c',1,'old'),
        (1,'fr','meaning',4,'auto_validated',1,'translation','test','d',2,'old');
    `);
  }
  db.close();
}

function writeJsonl(path: string, values: unknown[]): void {
  writeFileSync(
    path,
    `${values.map((value) => JSON.stringify(value)).join("\n")}\n`,
    "utf8"
  );
}

function writeSummary(path: string, content: Record<string, unknown>): void {
  writeFileSync(
    path,
    `${JSON.stringify({ ...content, runHash: hashFrenchInternalJson(content) }, null, 2)}\n`,
    "utf8"
  );
}

function internalExecution(): Record<string, unknown> {
  return { internalCodex: true, cel: "forbidden", aiGateway: "forbidden" };
}

function hash(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function fileHash(path: string): string {
  return hash(readFileSync(path, "utf8"));
}
