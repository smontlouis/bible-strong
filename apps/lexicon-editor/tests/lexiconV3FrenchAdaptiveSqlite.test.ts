import { createHash } from "node:crypto";
import {
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import assert from "node:assert/strict";

import {
  buildLexiconV3FrenchAdaptiveSqlite,
  parseFrenchAdaptiveSqliteCli
} from "../scripts/buildLexiconV3FrenchAdaptiveSqlite.js";
import {
  FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_PIPELINE_VERSION,
  FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION
} from "../src/lexiconV3/frenchAdaptivePipeline.js";
import { buildFrenchHtmlTemplate } from "../src/lexiconV3/frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";

test("builds a verified French production SQLite without changing English", (t) => {
  const root = mkdtempSync(resolve(tmpdir(), "lexicon-v3-fr-adaptive-sqlite-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const core = resolve(root, "core.sqlite");
  const tasksPath = resolve(root, "tasks.jsonl");
  const finalPath = resolve(root, "final.jsonl");
  const provenancePath = resolve(root, "provenance.jsonl");
  const runSummaryPath = resolve(root, "summary.json");
  const output = resolve(root, "production.sqlite");
  const db = new DatabaseSync(core);
  db.exec(`
    CREATE TABLE StepEntries (
      id INTEGER PRIMARY KEY, language TEXT NOT NULL, baseCode INTEGER NOT NULL,
      eStrong TEXT NOT NULL, dStrong TEXT NOT NULL, uStrong TEXT NOT NULL,
      original TEXT NOT NULL, transliteration TEXT NOT NULL, morph TEXT NOT NULL,
      gloss TEXT NOT NULL, meaning TEXT NOT NULL,
      classicTransliteration TEXT NOT NULL DEFAULT '',
      pronunciation TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE LexiconTranslations (
      stepEntryId INTEGER NOT NULL, language TEXT NOT NULL, gloss TEXT NOT NULL,
      meaning TEXT NOT NULL, meaningHtml TEXT NOT NULL,
      UNIQUE(stepEntryId, language)
    );
    CREATE TABLE DictionaryMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL) WITHOUT ROWID;
    CREATE TABLE LexiconFieldStatus (
      stepEntryId INTEGER NOT NULL, locale TEXT NOT NULL, field TEXT NOT NULL,
      fieldVersionId INTEGER NOT NULL, state TEXT NOT NULL, confidence REAL NOT NULL,
      method TEXT NOT NULL, generator TEXT NOT NULL, contentHash TEXT NOT NULL,
      derivedFromVersionId INTEGER, releaseKey TEXT NOT NULL,
      PRIMARY KEY(stepEntryId, locale, field),
      FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
    INSERT INTO StepEntries VALUES
      (1, 'greek', 1, 'G0001', 'G0001 =', 'G0001', 'α', 'a', 'G:N-F',
       'first', '<b>α</b>, the first.', '', '');
    INSERT INTO LexiconFieldStatus VALUES
      (1, 'en', 'gloss', 1, 'auto_validated', 1, 'source', 'fixture',
       'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', NULL, 'en-release'),
      (1, 'en', 'meaning', 2, 'auto_validated', 1, 'source', 'fixture',
       'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb', NULL, 'en-release');
  `);
  db.close();

  const sourceHash = "c".repeat(64);
  const taskContent = {
    schemaVersion: FRENCH_ADAPTIVE_TASK_SCHEMA_VERSION,
    entryKey: "greek:G0001",
    sourceHash,
    releaseKey: "en-release",
    identity: {
      stepEntryId: 1,
      language: "greek" as const,
      eStrong: "G0001",
      dStrong: "G0001 =",
      uStrong: "G0001",
      original: "α",
      transliteration: "a",
      morph: "G:N-F"
    },
    english: {
      gloss: "first",
      meaning: "α, the first.",
      meaningHtml: "<b>α</b>, the first.",
      segments: [{ id: "t0", text: "α" }, { id: "t1", text: ", the first." }]
    },
    htmlTemplate: buildFrenchHtmlTemplate("<b>α</b>, the first."),
    protectedContent: {
      strongCodes: [], references: [], referenceLiterals: [], originalTokens: ["α"],
      numericLiterals: [], sigla: []
    },
    entityGlossFr: null,
    entityMentions: [],
    riskReasons: [],
    size: "short" as const
  };
  const task = { ...taskContent, taskHash: hashFrenchInternalJson(taskContent) };
  const validation = {
    valid: true,
    issues: [],
    checks: {
      lineage: true, segmentCoverage: true, htmlStructure: true,
      protectedContent: true, noEnglishResidue: true, entities: true, gloss: true
    },
    rendered: {
      meaningFr: "α, le premier.",
      meaningHtmlFr: "<b>α</b>, le premier."
    },
    validationHash: "d".repeat(64)
  };
  const final = {
    schemaVersion: FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION,
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    entryKey: task.entryKey,
    sourceHash,
    taskHash: task.taskHash,
    translationHash: "e".repeat(64),
    reviewHash: "f".repeat(64),
    arbitrationHash: null,
    finalHash: "1".repeat(64),
    glossFr: "premier",
    meaningFr: validation.rendered.meaningFr,
    meaningHtmlFr: validation.rendered.meaningHtmlFr,
    meaningSegmentsFr: [{ id: "t0", text: "α" }, { id: "t1", text: ", le premier." }],
    entityMentionsFr: [],
    validation,
    riskReasons: []
  };
  const pointer = {
    batchId: "batch-1", promptVersion: "prompt@1", model: "model",
    reasoningEffort: "low", responseHash: "2".repeat(64)
  };
  const provenance = {
    schemaVersion: "lexicon-v3-french-adaptive-provenance@1",
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    entryKey: task.entryKey,
    sourceHash,
    taskHash: task.taskHash,
    translation: { ...pointer, translationHash: final.translationHash },
    deterministicValidation: validation,
    review: { ...pointer, verdict: "accept", reviewHash: final.reviewHash },
    reviewedValidation: validation,
    arbitration: null,
    finalHash: final.finalHash
  };
  writeJsonl(tasksPath, task);
  writeJsonl(finalPath, final);
  writeJsonl(provenancePath, provenance);
  const runContent = {
    schemaVersion: "lexicon-v3-french-adaptive-run@1",
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    mode: "full",
    status: "complete",
    entries: 1,
    invalidFinal: 0,
    finalDigest: hashFrenchInternalJson([[final.entryKey, final.finalHash]]),
    execution: { internalCodex: true, cel: "forbidden", aiGateway: "forbidden" },
    files: {
      tasks: fileArtifact(tasksPath),
      final: fileArtifact(finalPath),
      provenance: fileArtifact(provenancePath)
    }
  };
  const runSummary = { ...runContent, runHash: hashFrenchInternalJson(runContent) };
  writeFileSync(runSummaryPath, `${JSON.stringify(runSummary)}\n`);

  const summary = buildLexiconV3FrenchAdaptiveSqlite({
    core, tasks: tasksPath, final: finalPath, provenance: provenancePath,
    runSummary: runSummaryPath, output, releaseKey: "fr-release"
  }) as { entries: number; invalidFinal: number };
  assert.equal(summary.entries, 1);
  assert.equal(summary.invalidFinal, 0);
  const production = new DatabaseSync(output, { readOnly: true });
  assert.deepEqual(
    { ...production.prepare("SELECT gloss, meaning, meaningHtml FROM LexiconTranslations WHERE language='fr'").get() },
    { gloss: "premier", meaning: "α, le premier.", meaningHtml: "<b>α</b>, le premier." }
  );
  assert.equal(
    (production.prepare("SELECT count(*) AS n FROM LexiconFrenchProvenance").get() as { n: number }).n,
    1
  );
  assert.equal(
    (production.prepare("SELECT meaning FROM StepEntries WHERE id=1").get() as { meaning: string }).meaning,
    "<b>α</b>, the first."
  );
  production.close();
});

test("uses a strict French adaptive SQLite CLI", () => {
  assert.throws(() => parseFrenchAdaptiveSqliteCli(["--core", "a"]), /missing/);
  assert.throws(
    () => parseFrenchAdaptiveSqliteCli([
      "--core", "a", "--tasks", "b", "--final", "c", "--provenance", "d",
      "--run-summary", "e", "--output", "f", "--release-key", "r", "--wat", "x"
    ]),
    /unknown/
  );
});

function writeJsonl(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

function fileArtifact(path: string): { sha256: string } {
  return { sha256: createHash("sha256").update(readFileSync(path)).digest("hex") };
}
