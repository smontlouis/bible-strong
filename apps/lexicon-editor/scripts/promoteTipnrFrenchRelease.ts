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
import { basename, dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_AUTHORING_CANDIDATE =
  "outputs/lexicon-fr-quality/release/tipnr/bible_entities.reviewed.sqlite";
const DEFAULT_PRODUCTION_CANDIDATE =
  "outputs/lexicon-fr-quality/release/tipnr/bible_entities.production.sqlite";
const DEFAULT_AUTHORING_TARGET = "data/entities/bible_entities.sqlite";
const DEFAULT_PRODUCTION_TARGET = "data/entities/bible_entities.production.sqlite";
const DEFAULT_ARCHIVE = "data/entities/archive";

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const pairs = [
    {
      role: "authoring",
      candidate: resolve(args["authoring-candidate"] ?? DEFAULT_AUTHORING_CANDIDATE),
      target: resolve(args["authoring-target"] ?? DEFAULT_AUTHORING_TARGET)
    },
    {
      role: "production",
      candidate: resolve(args["production-candidate"] ?? DEFAULT_PRODUCTION_CANDIDATE),
      target: resolve(args["production-target"] ?? DEFAULT_PRODUCTION_TARGET)
    }
  ];
  const archiveDir = resolve(args.archive ?? DEFAULT_ARCHIVE);
  for (const pair of pairs) {
    if (!existsSync(pair.candidate) || !existsSync(pair.target)) {
      throw new Error(`missing-release-file:${pair.role}`);
    }
    verify(pair.candidate, pair.role);
  }
  mkdirSync(archiveDir, { recursive: true });
  const archives = pairs.map((pair) => archive(pair.target, archiveDir, pair.role));
  const staged = pairs.map((pair) => {
    const path = `${pair.target}.promote-${process.pid}`;
    rmSync(path, { force: true });
    copyFileSync(pair.candidate, path);
    if (sha256File(path) !== sha256File(pair.candidate)) {
      throw new Error(`staging-hash-mismatch:${pair.role}`);
    }
    verify(path, pair.role);
    return { ...pair, staged: path };
  });
  try {
    for (const pair of staged) renameSync(pair.staged, pair.target);
  } finally {
    for (const pair of staged) rmSync(pair.staged, { force: true });
  }
  const result = {
    schemaVersion: "tipnr-french-promotion@1",
    promotedAt: new Date().toISOString(),
    files: staged.map((pair, index) => ({
      role: pair.role,
      target: pair.target,
      sha256: sha256File(pair.target),
      bytes: statSync(pair.target).size,
      archive: archives[index]
    }))
  };
  const report = resolve(
    args.report ?? "outputs/lexicon-fr-quality/release/tipnr/promotion.json"
  );
  mkdirSync(dirname(report), { recursive: true });
  writeFileSync(report, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ ...result, report }, null, 2)}\n`);
}

function verify(path: string, role: string): void {
  const db = new DatabaseSync(path, { readOnly: true });
  try {
    const integrity = String(db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "");
    const foreignKeys = db.prepare("PRAGMA foreign_key_check").all();
    const entities = scalar(db, "SELECT count(*) FROM Entities");
    const translations = scalar(
      db,
      "SELECT count(*) FROM EntityTranslations WHERE language='fr'"
    );
    const provenance = scalar(
      db,
      "SELECT count(*) FROM EntityTranslationProvenance WHERE language='fr'"
    );
    if (
      integrity !== "ok" ||
      foreignKeys.length ||
      entities !== 4232 ||
      translations !== 4232 ||
      provenance !== 4232
    ) {
      throw new Error(
        `candidate-gate:${role}:${integrity}:${foreignKeys.length}:${entities}:${translations}:${provenance}`
      );
    }
  } finally {
    db.close();
  }
}

function archive(target: string, archiveDir: string, role: string): string {
  const digest = sha256File(target);
  const path = resolve(
    archiveDir,
    `${basename(target, ".sqlite")}.pre-fr-quality-${role}-${digest.slice(0, 12)}.sqlite`
  );
  if (!existsSync(path)) {
    const temporary = `${path}.tmp-${process.pid}`;
    copyFileSync(target, temporary);
    if (sha256File(temporary) !== digest) throw new Error(`archive-hash-mismatch:${role}`);
    renameSync(temporary, path);
  }
  return path;
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(row ? Object.values(row)[0] : 0);
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

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

main();
