import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { pathToFileURL } from "node:url";

import {
  FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION,
  FRENCH_ADAPTIVE_PIPELINE_VERSION,
  type FrenchAdaptiveFinalRecord,
  type FrenchAdaptiveTask
} from "../src/lexiconV3/frenchAdaptivePipeline.js";
import {
  frenchRenderedHtmlSkeleton,
  frenchSourceHtmlSkeleton
} from "../src/lexiconV3/frenchHtmlRenderer.js";
import { hashFrenchInternalJson } from "../src/lexiconV3/frenchInternalReview.js";
import { lexiconV3FieldContentHash } from "../src/lexiconV3/review.js";

export const FRENCH_ADAPTIVE_SQLITE_BUILD_VERSION =
  "build-lexicon-v3-french-adaptive-sqlite@1" as const;

interface Options {
  core: string;
  tasks: string;
  final: string;
  provenance: string;
  runSummary: string;
  output: string;
  releaseKey: string;
}

interface ProvenanceRecord {
  schemaVersion: string;
  pipelineVersion: string;
  entryKey: string;
  sourceHash: string;
  taskHash: string;
  translation: AgentPointer & { translationHash: string };
  deterministicValidation: { valid: boolean; validationHash: string };
  review: AgentPointer & { verdict: string; reviewHash: string };
  reviewedValidation: { valid: boolean; validationHash: string };
  arbitration: (AgentPointer & { arbitrationHash: string }) | null;
  finalHash: string;
}

interface AgentPointer {
  batchId: string;
  promptVersion: string;
  model: string;
  reasoningEffort: string;
  responseHash: string;
}

interface AdaptiveRunSummary {
  schemaVersion: string;
  pipelineVersion: string;
  mode: string;
  status: string;
  entries: number;
  invalidFinal: number;
  finalDigest: string;
  runHash: string;
  execution: {
    internalCodex: boolean;
    cel: string;
    aiGateway: string;
  };
  files: {
    tasks: { sha256: string };
    final: { sha256: string };
    provenance: { sha256: string };
  };
}

interface StepRow {
  id: number;
  language: string;
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
  classicTransliteration: string;
  pronunciation: string;
}

interface FieldStatusRow {
  field: "gloss" | "meaning";
  fieldVersionId: number;
}

export function buildLexiconV3FrenchAdaptiveSqlite(options: Options): object {
  assertOptions(options);
  for (const path of [
    options.core,
    options.tasks,
    options.final,
    options.provenance,
    options.runSummary
  ]) {
    if (!existsSync(path) || !statSync(path).isFile()) {
      throw new Error(`missing-french-adaptive-sqlite-input:${path}`);
    }
  }
  if (existsSync(options.output) || existsSync(`${options.output}.summary.json`)) {
    throw new Error(`french-adaptive-sqlite-output-exists:${options.output}`);
  }

  const tasks = readJsonl<FrenchAdaptiveTask>(options.tasks);
  const finals = readJsonl<FrenchAdaptiveFinalRecord>(options.final);
  const provenance = readJsonl<ProvenanceRecord>(options.provenance);
  const runSummary = JSON.parse(
    readFileSync(options.runSummary, "utf8")
  ) as AdaptiveRunSummary;
  verifyRunArtifacts({ options, tasks, finals, provenance, runSummary });

  mkdirSync(dirname(options.output), { recursive: true });
  const temporary = `${options.output}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(options.core, temporary);

  let database: DatabaseSync | null = null;
  try {
    database = new DatabaseSync(temporary);
    database.exec("PRAGMA foreign_keys=ON; PRAGMA secure_delete=ON;");
    const englishFingerprintBefore = englishFingerprint(database);
    installFrenchContent({
      database,
      tasks,
      finals,
      provenance,
      runSummary,
      releaseKey: options.releaseKey,
      coreSha256: sha256File(options.core),
      finalSha256: sha256File(options.final),
      provenanceSha256: sha256File(options.provenance)
    });
    const englishFingerprintAfter = englishFingerprint(database);
    if (englishFingerprintAfter !== englishFingerprintBefore) {
      throw new Error("french-adaptive-sqlite-english-content-mutated");
    }
    verifyDatabase(database, tasks.length, options.releaseKey);
    database.exec("PRAGMA journal_mode=DELETE; VACUUM;");
    verifyDatabase(database, tasks.length, options.releaseKey);
    database.close();
    database = null;
    renameSync(temporary, options.output);
  } catch (error) {
    database?.close();
    rmSync(temporary, { force: true });
    throw error;
  }

  const outputDb = new DatabaseSync(options.output, { readOnly: true });
  const databaseFingerprint = productionFingerprint(outputDb);
  outputDb.close();
  const content = {
    schemaVersion: "lexicon-v3-french-adaptive-sqlite-build@1",
    builderVersion: FRENCH_ADAPTIVE_SQLITE_BUILD_VERSION,
    pipelineVersion: FRENCH_ADAPTIVE_PIPELINE_VERSION,
    status: "complete",
    releaseKey: options.releaseKey,
    entries: tasks.length,
    translationsFr: tasks.length,
    invalidFinal: 0,
    internalOnly: true,
    cel: "forbidden",
    aiGateway: "forbidden",
    input: {
      core: artifact(options.core),
      tasks: artifact(options.tasks),
      final: artifact(options.final),
      provenance: artifact(options.provenance),
      runSummary: artifact(options.runSummary)
    },
    output: {
      ...artifact(options.output),
      databaseFingerprint
    }
  };
  const summary = { ...content, buildHash: hashFrenchInternalJson(content) };
  writeFileSync(
    `${options.output}.summary.json`,
    `${JSON.stringify(summary, null, 2)}\n`,
    "utf8"
  );
  return summary;
}

function installFrenchContent(input: {
  database: DatabaseSync;
  tasks: FrenchAdaptiveTask[];
  finals: FrenchAdaptiveFinalRecord[];
  provenance: ProvenanceRecord[];
  runSummary: AdaptiveRunSummary;
  releaseKey: string;
  coreSha256: string;
  finalSha256: string;
  provenanceSha256: string;
}): void {
  const db = input.database;
  const existingFr = Number(
    (db
      .prepare("SELECT count(*) AS count FROM LexiconTranslations WHERE language='fr'")
      .get() as { count: number | bigint }).count
  );
  const existingFrStatus = Number(
    (db
      .prepare("SELECT count(*) AS count FROM LexiconFieldStatus WHERE locale='fr'")
      .get() as { count: number | bigint }).count
  );
  if (existingFr !== 0 || existingFrStatus !== 0) {
    throw new Error("french-adaptive-sqlite-core-already-has-french");
  }

  const finalByKey = uniqueMap(input.finals, (value) => value.entryKey);
  const provenanceByKey = uniqueMap(input.provenance, (value) => value.entryKey);
  const selectStep = db.prepare(
    `SELECT id, language, baseCode, eStrong, dStrong, uStrong, original,
            transliteration, morph, gloss, meaning, classicTransliteration,
            pronunciation
       FROM StepEntries WHERE id=?`
  );
  const selectEnglishStatuses = db.prepare(
    `SELECT field, fieldVersionId FROM LexiconFieldStatus
      WHERE stepEntryId=? AND locale='en' ORDER BY field`
  );
  const insertTranslation = db.prepare(
    `INSERT INTO LexiconTranslations
      (stepEntryId, language, gloss, meaning, meaningHtml)
     VALUES (?, 'fr', ?, ?, ?)`
  );
  const insertStatus = db.prepare(
    `INSERT INTO LexiconFieldStatus
      (stepEntryId, locale, field, fieldVersionId, state, confidence, method,
       generator, contentHash, derivedFromVersionId, releaseKey)
     VALUES (?, 'fr', ?, ?, 'auto_validated', 1.0, 'translation', ?, ?, ?, ?)`
  );

  db.exec(`
    CREATE TABLE LexiconFrenchProvenance (
      stepEntryId INTEGER PRIMARY KEY,
      entryKey TEXT NOT NULL UNIQUE,
      sourceHash TEXT NOT NULL,
      taskHash TEXT NOT NULL,
      translationHash TEXT NOT NULL,
      reviewHash TEXT NOT NULL,
      arbitrationHash TEXT,
      finalHash TEXT NOT NULL,
      finalValidationHash TEXT NOT NULL,
      pipelineVersion TEXT NOT NULL,
      translatorPromptVersion TEXT NOT NULL,
      translatorModel TEXT NOT NULL,
      translatorReasoning TEXT NOT NULL,
      translatorResponseHash TEXT NOT NULL,
      reviewerPromptVersion TEXT NOT NULL,
      reviewerModel TEXT NOT NULL,
      reviewerReasoning TEXT NOT NULL,
      reviewerResponseHash TEXT NOT NULL,
      arbiterPromptVersion TEXT,
      arbiterModel TEXT,
      arbiterReasoning TEXT,
      arbiterResponseHash TEXT,
      validationPassed INTEGER NOT NULL CHECK(validationPassed = 1),
      FOREIGN KEY(stepEntryId) REFERENCES StepEntries(id) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);
  const insertProvenance = db.prepare(
    `INSERT INTO LexiconFrenchProvenance (
       stepEntryId, entryKey, sourceHash, taskHash, translationHash,
       reviewHash, arbitrationHash, finalHash, finalValidationHash,
       pipelineVersion, translatorPromptVersion, translatorModel,
       translatorReasoning, translatorResponseHash, reviewerPromptVersion,
       reviewerModel, reviewerReasoning, reviewerResponseHash,
       arbiterPromptVersion, arbiterModel, arbiterReasoning,
       arbiterResponseHash, validationPassed
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`
  );
  const maxVersion = Number(
    (db
      .prepare("SELECT coalesce(max(fieldVersionId), 0) AS value FROM LexiconFieldStatus")
      .get() as { value: number | bigint }).value
  );
  let nextVersion = maxVersion + 1;

  db.exec("BEGIN IMMEDIATE");
  try {
    for (const task of input.tasks) {
      const final = required(finalByKey, task.entryKey);
      const proof = required(provenanceByKey, task.entryKey);
      const step = selectStep.get(task.identity.stepEntryId) as unknown as
        | StepRow
        | undefined;
      verifyStepIdentity(step, task);
      verifyFinal(task, final, proof);
      const statuses = selectEnglishStatuses.all(task.identity.stepEntryId) as unknown as
        FieldStatusRow[];
      if (statuses.length !== 2) {
        throw new Error(`french-adaptive-sqlite-english-status:${task.entryKey}`);
      }
      const glossParent = statuses.find((value) => value.field === "gloss")!;
      const meaningParent = statuses.find((value) => value.field === "meaning")!;

      insertTranslation.run(
        task.identity.stepEntryId,
        final.glossFr,
        final.meaningFr,
        final.meaningHtmlFr
      );
      insertStatus.run(
        task.identity.stepEntryId,
        "gloss",
        nextVersion++,
        FRENCH_ADAPTIVE_PIPELINE_VERSION,
        lexiconV3FieldContentHash({
          entryKey: task.entryKey,
          locale: "fr",
          field: "gloss",
          valueText: final.glossFr,
          valueHtml: null,
          derivedFromVersionId: glossParent.fieldVersionId
        }),
        glossParent.fieldVersionId,
        input.releaseKey
      );
      insertStatus.run(
        task.identity.stepEntryId,
        "meaning",
        nextVersion++,
        FRENCH_ADAPTIVE_PIPELINE_VERSION,
        lexiconV3FieldContentHash({
          entryKey: task.entryKey,
          locale: "fr",
          field: "meaning",
          valueText: final.meaningFr,
          valueHtml: final.meaningHtmlFr,
          derivedFromVersionId: meaningParent.fieldVersionId
        }),
        meaningParent.fieldVersionId,
        input.releaseKey
      );
      insertProvenance.run(
        task.identity.stepEntryId,
        task.entryKey,
        task.sourceHash,
        task.taskHash,
        final.translationHash,
        final.reviewHash,
        final.arbitrationHash,
        final.finalHash,
        final.validation.validationHash,
        final.pipelineVersion,
        proof.translation.promptVersion,
        proof.translation.model,
        proof.translation.reasoningEffort,
        proof.translation.responseHash,
        proof.review.promptVersion,
        proof.review.model,
        proof.review.reasoningEffort,
        proof.review.responseHash,
        proof.arbitration?.promptVersion ?? null,
        proof.arbitration?.model ?? null,
        proof.arbitration?.reasoningEffort ?? null,
        proof.arbitration?.responseHash ?? null
      );
    }

    const metadata = new Map<string, string>([
      ["generatedAt", new Date().toISOString()],
      ["lexiconV3Profile", "core-en-fr"],
      ["lexiconV3ReleaseProfile", "core-en-fr"],
      ["productionProfile", "strong-lexicon-core-en-fr-v3"],
      ["lexiconV3ReleaseKey", input.releaseKey],
      ["lexiconV3TranslationStatus", "included:fr"],
      ["lexiconV3FrenchPipelineVersion", FRENCH_ADAPTIVE_PIPELINE_VERSION],
      ["lexiconV3FrenchBuilderVersion", FRENCH_ADAPTIVE_SQLITE_BUILD_VERSION],
      ["lexiconV3FrenchEntryCount", String(input.tasks.length)],
      ["lexiconV3FrenchCoreSourceSha256", input.coreSha256],
      ["lexiconV3FrenchFinalSha256", input.finalSha256],
      ["lexiconV3FrenchProvenanceSha256", input.provenanceSha256],
      ["lexiconV3FrenchRunHash", input.runSummary.runHash],
      ["lexiconV3FrenchExecution", "internal-codex;cel=forbidden;ai-gateway=forbidden"]
    ]);
    const upsertMeta = db.prepare(
      `INSERT INTO DictionaryMeta(key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value=excluded.value`
    );
    for (const [key, value] of metadata) upsertMeta.run(key, value);
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function verifyRunArtifacts(input: {
  options: Options;
  tasks: FrenchAdaptiveTask[];
  finals: FrenchAdaptiveFinalRecord[];
  provenance: ProvenanceRecord[];
  runSummary: AdaptiveRunSummary;
}): void {
  const { options, tasks, finals, provenance, runSummary } = input;
  if (
    runSummary.pipelineVersion !== FRENCH_ADAPTIVE_PIPELINE_VERSION ||
    runSummary.mode !== "full" ||
    runSummary.status !== "complete" ||
    runSummary.entries !== tasks.length ||
    runSummary.invalidFinal !== 0 ||
    !runSummary.execution.internalCodex ||
    runSummary.execution.cel !== "forbidden" ||
    runSummary.execution.aiGateway !== "forbidden"
  ) {
    throw new Error("invalid-french-adaptive-full-run-summary");
  }
  if (
    runSummary.files.tasks.sha256 !== sha256File(options.tasks) ||
    runSummary.files.final.sha256 !== sha256File(options.final) ||
    runSummary.files.provenance.sha256 !== sha256File(options.provenance)
  ) {
    throw new Error("french-adaptive-run-artifact-digest-mismatch");
  }
  const { runHash, ...runContent } = runSummary;
  if (
    runHash !== hashFrenchInternalJson(runContent) ||
    runSummary.finalDigest !==
      hashFrenchInternalJson(finals.map((value) => [value.entryKey, value.finalHash]))
  ) {
    throw new Error("french-adaptive-run-summary-hash-mismatch");
  }
  if (
    tasks.length === 0 ||
    finals.length !== tasks.length ||
    provenance.length !== tasks.length
  ) {
    throw new Error("french-adaptive-sqlite-coverage-mismatch");
  }
  uniqueMap(tasks, (value) => value.entryKey);
  uniqueMap(finals, (value) => value.entryKey);
  uniqueMap(provenance, (value) => value.entryKey);
}

function verifyStepIdentity(
  step: StepRow | undefined,
  task: FrenchAdaptiveTask
): asserts step is StepRow {
  if (
    !step ||
    step.id !== task.identity.stepEntryId ||
    step.language !== task.identity.language ||
    step.eStrong !== task.identity.eStrong ||
    step.dStrong !== task.identity.dStrong ||
    step.uStrong !== task.identity.uStrong ||
    step.original !== task.identity.original ||
    step.transliteration !== task.identity.transliteration ||
    step.morph !== task.identity.morph ||
    step.gloss !== task.english.gloss ||
    (step.meaning !== task.english.meaning &&
      step.meaning !== task.english.meaningHtml)
  ) {
    throw new Error(`french-adaptive-sqlite-core-drift:${task.entryKey}`);
  }
}

function verifyFinal(
  task: FrenchAdaptiveTask,
  final: FrenchAdaptiveFinalRecord,
  proof: ProvenanceRecord
): void {
  if (
    final.schemaVersion !== FRENCH_ADAPTIVE_FINAL_SCHEMA_VERSION ||
    final.pipelineVersion !== FRENCH_ADAPTIVE_PIPELINE_VERSION ||
    final.entryKey !== task.entryKey ||
    final.sourceHash !== task.sourceHash ||
    final.taskHash !== task.taskHash ||
    !final.validation.valid ||
    !final.validation.rendered ||
    final.validation.rendered.meaningFr !== final.meaningFr ||
    final.validation.rendered.meaningHtmlFr !== final.meaningHtmlFr ||
    proof.pipelineVersion !== final.pipelineVersion ||
    proof.entryKey !== task.entryKey ||
    proof.sourceHash !== task.sourceHash ||
    proof.taskHash !== task.taskHash ||
    proof.translation.translationHash !== final.translationHash ||
    proof.review.reviewHash !== final.reviewHash ||
    (proof.arbitration?.arbitrationHash ?? null) !== final.arbitrationHash ||
    proof.finalHash !== final.finalHash ||
    !proof.deterministicValidation.valid && !proof.arbitration ||
    !proof.reviewedValidation.valid && !proof.arbitration ||
    !final.glossFr.trim() ||
    !final.meaningFr.trim() ||
    !final.meaningHtmlFr.trim() ||
    !arraysEqual(
      frenchSourceHtmlSkeleton(task.english.meaningHtml),
      frenchRenderedHtmlSkeleton(final.meaningHtmlFr)
    )
  ) {
    throw new Error(`invalid-french-adaptive-sqlite-final:${task.entryKey}`);
  }
}

function verifyDatabase(
  db: DatabaseSync,
  expected: number,
  releaseKey: string
): void {
  const scalar = (sql: string, ...params: Array<string | number>): string | number =>
    Object.values(db.prepare(sql).get(...params) as Record<string, string | number>)[0]!;
  if (String(scalar("PRAGMA integrity_check")) !== "ok") {
    throw new Error("french-adaptive-sqlite-integrity-check-failed");
  }
  if (db.prepare("PRAGMA foreign_key_check").all().length !== 0) {
    throw new Error("french-adaptive-sqlite-foreign-key-check-failed");
  }
  if (
    Number(
      scalar("SELECT count(*) FROM LexiconTranslations WHERE language='fr'")
    ) !== expected ||
    Number(
      scalar("SELECT count(*) FROM LexiconFieldStatus WHERE locale='fr'")
    ) !== expected * 2 ||
    Number(scalar("SELECT count(*) FROM LexiconFrenchProvenance")) !== expected ||
    Number(
      scalar(
        "SELECT count(*) FROM LexiconFieldStatus WHERE locale='fr' AND releaseKey=?",
        releaseKey
      )
    ) !== expected * 2 ||
    Number(
      scalar(
        `SELECT count(*) FROM LexiconTranslations t
          LEFT JOIN StepEntries s ON s.id=t.stepEntryId
         WHERE t.language='fr' AND (s.id IS NULL OR trim(t.gloss)='' OR
               trim(t.meaning)='' OR trim(t.meaningHtml)='')`
      )
    ) !== 0
  ) {
    throw new Error("french-adaptive-sqlite-count-check-failed");
  }
}

function englishFingerprint(db: DatabaseSync): string {
  return hashFrenchInternalJson({
    entries: db.prepare("SELECT * FROM StepEntries ORDER BY id").all(),
    statuses: db
      .prepare("SELECT * FROM LexiconFieldStatus WHERE locale='en' ORDER BY stepEntryId, field")
      .all()
  });
}

function productionFingerprint(db: DatabaseSync): string {
  return hashFrenchInternalJson({
    entries: db.prepare("SELECT * FROM StepEntries ORDER BY id").all(),
    translations: db
      .prepare("SELECT * FROM LexiconTranslations ORDER BY language, stepEntryId")
      .all(),
    statuses: db
      .prepare("SELECT * FROM LexiconFieldStatus ORDER BY locale, stepEntryId, field")
      .all(),
    provenance: db
      .prepare("SELECT * FROM LexiconFrenchProvenance ORDER BY stepEntryId")
      .all()
  });
}

function readJsonl<T>(path: string): T[] {
  const text = readFileSync(path, "utf8");
  return text
    .split(/\r?\n/u)
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as T);
}

function uniqueMap<T>(values: T[], key: (value: T) => string): Map<string, T> {
  const result = new Map<string, T>();
  for (const value of values) {
    const name = key(value);
    if (result.has(name)) throw new Error(`duplicate-french-adaptive-entry:${name}`);
    result.set(name, value);
  }
  return result;
}

function required<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`missing-french-adaptive-entry:${String(key)}`);
  return value;
}

function arraysEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function artifact(path: string): { path: string; bytes: number; sha256: string } {
  return { path: resolve(path), bytes: statSync(path).size, sha256: sha256File(path) };
}

function assertOptions(options: Options): void {
  if (!/^[a-z0-9][a-z0-9._-]+$/u.test(options.releaseKey)) {
    throw new Error("invalid-french-adaptive-release-key");
  }
  const resolved = [options.core, options.tasks, options.final, options.provenance,
    options.runSummary, options.output].map((value) => resolve(value));
  if (new Set(resolved).size !== resolved.length) {
    throw new Error("french-adaptive-sqlite-path-collision");
  }
}

export function parseFrenchAdaptiveSqliteCli(argv: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined || value.startsWith("--")) {
      throw new Error(`invalid-french-adaptive-sqlite-argument:${flag ?? "missing"}`);
    }
    if (values.has(flag)) throw new Error(`duplicate-french-adaptive-sqlite-argument:${flag}`);
    values.set(flag, value);
  }
  const allowed = new Set([
    "--core", "--tasks", "--final", "--provenance", "--run-summary",
    "--output", "--release-key"
  ]);
  for (const flag of values.keys()) {
    if (!allowed.has(flag)) throw new Error(`unknown-french-adaptive-sqlite-argument:${flag}`);
  }
  const take = (flag: string): string => {
    const value = values.get(flag);
    if (!value) throw new Error(`missing-french-adaptive-sqlite-argument:${flag}`);
    return value;
  };
  return {
    core: resolve(take("--core")),
    tasks: resolve(take("--tasks")),
    final: resolve(take("--final")),
    provenance: resolve(take("--provenance")),
    runSummary: resolve(take("--run-summary")),
    output: resolve(take("--output")),
    releaseKey: take("--release-key")
  };
}

function isMain(): boolean {
  return Boolean(process.argv[1]) && import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href;
}

if (isMain()) {
  try {
    const summary = buildLexiconV3FrenchAdaptiveSqlite(
      parseFrenchAdaptiveSqliteCli(process.argv.slice(2))
    );
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  } catch (error) {
    process.stderr.write(`${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
}
