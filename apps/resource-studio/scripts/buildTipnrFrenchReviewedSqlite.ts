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

import { validateTipnrFrenchFields } from "./runTipnrFrenchRevision.js";

const DEFAULT_SOURCE = "data/entities/bible_entities.sqlite";
const DEFAULT_TASKS = "outputs/lexicon-fr-quality/triage/tipnr/tasks.jsonl";
const DEFAULT_DECISIONS = "outputs/lexicon-fr-quality/triage/tipnr/decisions.jsonl";
const DEFAULT_FINAL = "outputs/lexicon-fr-quality/revision/tipnr/final.jsonl";
const DEFAULT_PROVENANCE = "outputs/lexicon-fr-quality/revision/tipnr/provenance.jsonl";
const DEFAULT_OUTPUT =
  "outputs/lexicon-fr-quality/release/tipnr/bible_entities.reviewed.sqlite";
const PIPELINE_VERSION = "tipnr-french-reviewed-sqlite@1";

interface Task {
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  deterministicIssues: Array<Record<string, unknown>>;
  fields: Record<string, { english: string; french: string }>;
}

interface Decision {
  key: string;
  verdict: "keep" | "correct" | "escalate";
  issueCodes: string[];
  fields: string[];
  reasons: string[];
  confidence: number;
}

interface FinalRecord {
  key: string;
  sourceId: number;
  sourceHash: string;
  priorTranslationHash: string;
  finalHash: string;
  fields: Record<string, string>;
  path: string;
  provenance: Record<string, unknown>;
  recordHash: string;
}

const FIELD_COLUMNS: Record<string, string> = {
  displayName: "displayName",
  description: "description",
  summaryHtml: "summaryHtml",
  briefest: "briefest",
  brief: "brief",
  shortDescription: "shortDescription",
  articleHtml: "articleHtml"
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolve(args.source ?? DEFAULT_SOURCE);
  const tasksPath = resolve(args.tasks ?? DEFAULT_TASKS);
  const decisionsPath = resolve(args.decisions ?? DEFAULT_DECISIONS);
  const finalPath = resolve(args.final ?? DEFAULT_FINAL);
  const provenancePath = resolve(args.provenance ?? DEFAULT_PROVENANCE);
  const finalExtraPath = args["final-extra"] ? resolve(args["final-extra"]) : null;
  const provenanceExtraPath = args["provenance-extra"]
    ? resolve(args["provenance-extra"])
    : null;
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  for (const path of [
    sourcePath,
    tasksPath,
    decisionsPath,
    finalPath,
    provenancePath,
    ...(finalExtraPath ? [finalExtraPath] : []),
    ...(provenanceExtraPath ? [provenanceExtraPath] : [])
  ]) {
    if (!existsSync(path)) throw new Error(`missing-input:${path}`);
  }
  const tasks = readJsonl<Task>(tasksPath);
  const decisions = readJsonl<Decision>(decisionsPath);
  const finals = [
    ...readJsonl<FinalRecord>(finalPath),
    ...(finalExtraPath ? readJsonl<FinalRecord>(finalExtraPath) : [])
  ];
  const selectedProvenance = [
    ...readJsonl<Record<string, unknown>>(provenancePath),
    ...(provenanceExtraPath
      ? readJsonl<Record<string, unknown>>(provenanceExtraPath)
      : [])
  ];
  assertCoverage(tasks, decisions, finals);
  const decisionByKey = new Map(decisions.map((value) => [value.key, value]));
  const finalByKey = new Map(finals.map((value) => [value.key, value]));
  const provenanceByKey = new Map(
    selectedProvenance.map((value) => [String(value.key ?? ""), value])
  );
  const termbaseHash = sha256File(
    resolve("data/dictionaries/strong_lexicon.en-fr.full.production.sqlite")
  );

  mkdirSync(dirname(outputPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(sourcePath, temporary);
  try {
    const db = new DatabaseSync(temporary);
    let counts: Record<string, number>;
    try {
      const englishBefore = englishDigest(db);
      db.exec("PRAGMA foreign_keys=ON; BEGIN IMMEDIATE;");
      try {
        db.exec(`
          DROP TABLE IF EXISTS EntityTranslationProvenance;
          CREATE TABLE EntityTranslationProvenance (
            entityId INTEGER NOT NULL,
            language TEXT NOT NULL CHECK(language='fr'),
            sourceHash TEXT NOT NULL,
            priorTranslationHash TEXT NOT NULL,
            finalTranslationHash TEXT NOT NULL,
            reviewHash TEXT NOT NULL,
            arbitrationHash TEXT,
            validationHash TEXT NOT NULL,
            pipelineVersion TEXT NOT NULL,
            promptModelVersion TEXT NOT NULL,
            termbaseHash TEXT NOT NULL,
            revisionDecision TEXT NOT NULL,
            generatedAt TEXT NOT NULL,
            validationPassed INTEGER NOT NULL CHECK(validationPassed=1),
            PRIMARY KEY(entityId, language),
            FOREIGN KEY(entityId) REFERENCES Entities(id)
          ) WITHOUT ROWID;
          CREATE INDEX idx_EntityTranslationProvenance_sourceHash
            ON EntityTranslationProvenance(sourceHash);
        `);
        const update = db.prepare(`
          UPDATE EntityTranslations
          SET displayName=?, description=?, summaryHtml=?, briefest=?, brief=?,
              shortDescription=?, articleHtml=?, updatedAt=?
          WHERE entityId=? AND language='fr'
        `);
        const insertProvenance = db.prepare(`
          INSERT INTO EntityTranslationProvenance(
            entityId, language, sourceHash, priorTranslationHash,
            finalTranslationHash, reviewHash, arbitrationHash, validationHash,
            pipelineVersion, promptModelVersion, termbaseHash,
            revisionDecision, generatedAt, validationPassed
          ) VALUES (?, 'fr', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
        `);
        const generatedAt = new Date().toISOString();
        for (const task of tasks) {
          const decision = required(decisionByKey, task.key);
          const selected = finalByKey.get(task.key);
          const fields = selected?.fields ?? Object.fromEntries(
            Object.entries(task.fields).map(([field, pair]) => [field, pair.french])
          );
          const validation = validateTipnrFrenchFields(task, fields);
          if (!validation.valid) {
            throw new Error(
              `invalid-overlay:${task.key}:${validation.issues.map((issue) => issue.code).join(",")}`
            );
          }
          if (selected) {
            const result = update.run(
              fields.displayName,
              fields.description,
              fields.summaryHtml,
              fields.briefest,
              fields.brief,
              fields.shortDescription,
              fields.articleHtml,
              generatedAt,
              task.sourceId
            );
            if (result.changes !== 1) throw new Error(`translation-update-miss:${task.key}`);
          }
          const selectedProof = provenanceByKey.get(task.key);
          const finalHash = hashFields(fields);
          const reviewHash = selected
            ? sha256(stableJson(selectedProof ?? selected.provenance))
            : sha256(stableJson(decision));
          const arbitrationHash = selectedProof && selectedProof.arbitration
            ? sha256(stableJson(selectedProof.arbitration))
            : null;
          insertProvenance.run(
            task.sourceId,
            task.sourceHash,
            task.translationHash,
            finalHash,
            reviewHash,
            arbitrationHash,
            sha256(stableJson(validation)),
            PIPELINE_VERSION,
            selected ? "translator:gpt-5.6-sol@low;reviewer:gpt-5.6-terra@low;arbiter:gpt-5.6-sol@low-if-needed" : "triage:gpt-5.6-terra@low;keep",
            termbaseHash,
            decision.verdict,
            generatedAt
          );
        }
        const setMeta = db.prepare(`
          INSERT INTO EntityMeta(key, value) VALUES (?, ?)
          ON CONFLICT(key) DO UPDATE SET value=excluded.value
        `);
        const metadata: Record<string, string> = {
          frenchQualityPipelineVersion: PIPELINE_VERSION,
          frenchQualityGeneratedAt: generatedAt,
          frenchQualityTasksSha256: sha256File(tasksPath),
          frenchQualityDecisionsSha256: sha256File(decisionsPath),
          frenchQualityFinalSha256: sha256(
            [finalPath, finalExtraPath].filter(Boolean).map((path) => sha256File(path!)).join(":")
          ),
          frenchQualityTermbaseSha256: termbaseHash,
          frenchQualityExecution: "internal-codex;cel=forbidden;ai-gateway=forbidden"
        };
        for (const [key, value] of Object.entries(metadata)) setMeta.run(key, value);
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
      if (englishDigest(db) !== englishBefore) throw new Error("english-entity-drift");
      const integrity = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
      if (integrity !== "ok") throw new Error(`integrity-check:${integrity}`);
      const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
      if (foreignKeys.length) throw new Error(`foreign-key-check:${foreignKeys.length}`);
      counts = {
        entities: scalar(db, "SELECT count(*) FROM Entities"),
        translations: scalar(db, "SELECT count(*) FROM EntityTranslations WHERE language='fr'"),
        provenance: scalar(db, "SELECT count(*) FROM EntityTranslationProvenance WHERE language='fr'"),
        changed: finals.length,
        kept: tasks.length - finals.length
      };
      if (counts.entities !== 4232 || counts.translations !== 4232 || counts.provenance !== 4232) {
        throw new Error(`coverage-check:${stableJson(counts)}`);
      }
      db.exec("VACUUM;");
    } finally {
      db.close();
    }
    rmSync(outputPath, { force: true });
    renameSync(temporary, outputPath);
    const summary = {
      schemaVersion: "tipnr-french-reviewed-sqlite-summary@1",
      pipelineVersion: PIPELINE_VERSION,
      status: "complete",
      source: { path: sourcePath, sha256: sha256File(sourcePath) },
      output: { path: outputPath, sha256: sha256File(outputPath), bytes: statSync(outputPath).size },
      counts,
      integrity: "ok",
      foreignKeyCheck: "ok",
      englishUnchanged: true,
      inputs: {
        tasks: sha256File(tasksPath),
        decisions: sha256File(decisionsPath),
        final: [finalPath, finalExtraPath].filter(Boolean).map((path) => sha256File(path!)),
        provenance: [provenancePath, provenanceExtraPath]
          .filter(Boolean)
          .map((path) => sha256File(path!)),
        termbase: termbaseHash
      }
    };
    writeFileSync(`${outputPath}.summary.json`, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function assertCoverage(tasks: Task[], decisions: Decision[], finals: FinalRecord[]): void {
  if (tasks.length !== 4232 || decisions.length !== tasks.length) {
    throw new Error(`triage-coverage:${tasks.length}:${decisions.length}`);
  }
  const selected = decisions.filter((decision) => decision.verdict !== "keep");
  const taskKeys = new Set(tasks.map((task) => task.key));
  const finalKeys = new Set(finals.map((value) => value.key));
  if (
    taskKeys.size !== tasks.length ||
    new Set(decisions.map((value) => value.key)).size !== decisions.length ||
    finalKeys.size !== finals.length ||
    selected.some((decision) => !finalKeys.has(decision.key)) ||
    finals.some((value) => !taskKeys.has(value.key))
  ) {
    throw new Error("duplicate-or-missing-key");
  }
}

function englishDigest(db: DatabaseSync): string {
  const rows = db.prepare(`
    SELECT id, uniqueName, uStrong, displayName, category, type, description,
           summaryHtml, briefest, brief, shortDescription, articleHtml
    FROM Entities ORDER BY id
  `).all();
  return sha256(stableJson(rows));
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(row ? Object.values(row)[0] : 0);
}

function hashFields(fields: Record<string, string>): string {
  return sha256(
    Object.keys(FIELD_COLUMNS).map((field) => fields[field] ?? "").join("\n")
  );
}

function readJsonl<T>(path: string): T[] {
  return readFileSync(path, "utf8").split(/\r?\n/u).filter(Boolean).map((line) => JSON.parse(line) as T);
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) throw new Error(`unexpected-argument:${value}`);
    const [key, inline] = value.slice(2).split("=", 2);
    result[key] = inline ?? values[++index] ?? "";
  }
  return result;
}

function required<K, V>(map: Map<K, V>, key: K): V {
  const value = map.get(key);
  if (value === undefined) throw new Error(`missing-value:${String(key)}`);
  return value;
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`).join(",")}}`;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

main();
