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
import { LEXICAL_MORPHOLOGY_SUPPLEMENTS } from "../src/lexiconV3/morphologySupplements.js";

const DEFAULT_LEXICON =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_LEGACY = "data/dictionaries/strong.legacy.sqlite";
const DEFAULT_MORPHOLOGY =
  "outputs/lexicon-v3/french-editorial/morphology-translations.jsonl";
const DEFAULT_ARCHIVE = "data/dictionaries/archive";
const BUILDER_VERSION = "lexicon-viewer-enrichment@1";

interface MorphologyTranslation {
  morphologyCodeId: number;
  code: string;
  language: string;
  meaning: string;
  description: string;
  example: string;
  contentHash: string;
}

interface StepRow {
  id: number;
  eStrong: string;
  uStrong: string;
  stepCode: string;
  relationKind: string | null;
  relatedStepCode: string | null;
  relationLabelEn: string | null;
  relationLabelFr: string | null;
}

interface LegacyOriginRow {
  language: "greek" | "hebrew";
  code: number;
  originHtml: string;
}

interface RelationInsert {
  fromStepEntryId: number;
  toStepEntryId: number | null;
  toStepCode: string;
  groupKind: "identity" | "subentry" | "family";
  relationKind: string;
  labelEn: string;
  labelFr: string;
  source: string;
  evidence: string;
  sortOrder: number;
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const lexiconPath = resolve(args.lexicon ?? DEFAULT_LEXICON);
  const legacyPath = resolve(args.legacy ?? DEFAULT_LEGACY);
  const morphologyPath = resolve(args.morphology ?? DEFAULT_MORPHOLOGY);
  const archiveDir = resolve(args.archive ?? DEFAULT_ARCHIVE);
  const summaryPath = resolve(
    args.summary ?? `${lexiconPath}.viewer-summary.json`
  );

  for (const source of [lexiconPath, legacyPath, morphologyPath]) {
    if (!existsSync(source)) throw new Error(`missing-source:${source}`);
  }

  mkdirSync(dirname(summaryPath), { recursive: true });
  mkdirSync(archiveDir, { recursive: true });
  const sourceSha256 = sha256File(lexiconPath);
  const archivePath = resolve(
    archiveDir,
    `${basename(lexiconPath, ".sqlite")}.pre-viewer-${sourceSha256.slice(0, 12)}.sqlite`
  );
  if (!existsSync(archivePath)) copyFileSync(lexiconPath, archivePath);

  const temporary = `${lexiconPath}.viewer-tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(lexiconPath, temporary);

  try {
    const db = new DatabaseSync(temporary);
    let summary: Record<string, unknown>;
    try {
      db.exec("PRAGMA foreign_keys=OFF; PRAGMA journal_mode=DELETE;");
      db.exec(`ATTACH DATABASE ${sqlString(legacyPath)} AS legacy;`);
      db.exec("BEGIN IMMEDIATE;");
      try {
        rebuildMorphologyTranslations(db, morphologyPath);
        rebuildRelations(db);
        const setMeta = db.prepare(
          `INSERT INTO DictionaryMeta(key, value) VALUES (?, ?)
           ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        );
        const metadata: Record<string, string> = {
          lexiconViewerEnrichedAt: new Date().toISOString(),
          lexiconViewerEnrichmentVersion: BUILDER_VERSION,
          lexiconViewerLegacySha256: sha256File(legacyPath),
          lexiconViewerMorphologySha256: sha256File(morphologyPath),
          lexiconViewerProfile:
            "step-en-fr-full+relations+morphology+legacy-external"
        };
        for (const [key, value] of Object.entries(metadata)) {
          setMeta.run(key, value);
        }
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
      db.exec("DETACH DATABASE legacy; VACUUM;");
      summary = verify(db);
    } finally {
      db.close();
    }

    renameSync(temporary, lexiconPath);
    const result = {
      ...summary,
      lexiconPath,
      archivePath,
      summaryPath,
      sourceSha256,
      outputSha256: sha256File(lexiconPath),
      outputBytes: statSync(lexiconPath).size,
      builderVersion: BUILDER_VERSION,
      generatedAt: new Date().toISOString()
    };
    writeFileSync(summaryPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function rebuildMorphologyTranslations(
  db: DatabaseSync,
  morphologyPath: string
): void {
  const insertCode = db.prepare(
    `INSERT INTO MorphologyCodes(
       code, normalizedCode, language, scope, example, meaning, description, source
     ) VALUES (?, ?, ?, 'lexical_brief', ?, ?, ?, ?)
     ON CONFLICT(source, scope, code) DO UPDATE SET
       normalizedCode=excluded.normalizedCode,
       language=excluded.language,
       example=excluded.example,
       meaning=excluded.meaning,
       description=excluded.description`
  );
  for (const row of LEXICAL_MORPHOLOGY_SUPPLEMENTS) {
    insertCode.run(
      row.code,
      row.normalizedCode,
      row.language,
      row.example,
      row.meaning,
      row.description,
      row.source
    );
  }
  db.exec(`
    UPDATE MorphologyCodes
    SET description='Lexical category: ' || trim(meaning) || '.'
    WHERE scope='lexical_brief'
      AND trim(description)=''
      AND trim(meaning)<>'';
  `);

  const translations = readJsonl<MorphologyTranslation>(morphologyPath);
  const sourceCount = scalar(db, "SELECT count(*) FROM MorphologyCodes");
  const supplementalCount = scalar(
    db,
    `SELECT count(*) FROM MorphologyCodes WHERE source='STEP-lexical-morphology-supplement@1'`
  );
  if (translations.length + supplementalCount !== sourceCount) {
    throw new Error(
      `morphology-translation-coverage:${translations.length}+${supplementalCount}:${sourceCount}`
    );
  }

  db.exec(`
    DROP TABLE IF EXISTS MorphologyCodeTranslations;
    CREATE TABLE MorphologyCodeTranslations (
      morphologyCodeId INTEGER NOT NULL,
      language TEXT NOT NULL CHECK(language = 'fr'),
      meaning TEXT NOT NULL,
      description TEXT NOT NULL,
      example TEXT NOT NULL,
      sourceHash TEXT NOT NULL,
      PRIMARY KEY(morphologyCodeId, language)
    ) WITHOUT ROWID;
    CREATE INDEX idx_MorphologyCodeTranslations_language
      ON MorphologyCodeTranslations(language);
  `);

  const sourceById = new Map(
    (
      db
        .prepare("SELECT id, code FROM MorphologyCodes ORDER BY id")
        .all() as unknown as Array<{ id: number; code: string }>
    ).map((row) => [row.id, row.code])
  );
  const insert = db.prepare(
    `INSERT INTO MorphologyCodeTranslations(
       morphologyCodeId, language, meaning, description, example, sourceHash
     ) VALUES (?, 'fr', ?, ?, ?, ?)`
  );
  const seen = new Set<number>();
  for (const row of translations) {
    if (row.language !== "fr") {
      throw new Error(`invalid-morphology-language:${row.morphologyCodeId}`);
    }
    const expectedCode = sourceById.get(row.morphologyCodeId);
    if (!expectedCode || expectedCode !== row.code) {
      throw new Error(
        `morphology-identity-mismatch:${row.morphologyCodeId}:${row.code}:${expectedCode ?? "missing"}`
      );
    }
    if (seen.has(row.morphologyCodeId)) {
      throw new Error(
        `duplicate-morphology-translation:${row.morphologyCodeId}`
      );
    }
    seen.add(row.morphologyCodeId);
    insert.run(
      row.morphologyCodeId,
      row.meaning,
      row.description,
      row.example,
      row.contentHash
    );
  }

  const findSupplement = db.prepare(
    `SELECT id FROM MorphologyCodes
     WHERE source=? AND scope='lexical_brief' AND code=?`
  );
  for (const row of LEXICAL_MORPHOLOGY_SUPPLEMENTS) {
    const found = findSupplement.get(row.source, row.code) as
      | { id: number }
      | undefined;
    if (!found) throw new Error(`missing-morphology-supplement:${row.code}`);
    insert.run(
      found.id,
      row.meaningFr,
      row.descriptionFr,
      row.exampleFr,
      createHash("sha256").update(JSON.stringify(row)).digest("hex")
    );
  }
}

function rebuildRelations(db: DatabaseSync): void {
  db.exec(`
    DROP TABLE IF EXISTS LexiconRelationProvenance;
    DROP TABLE IF EXISTS LexiconRelations;
    CREATE TABLE LexiconRelations (
      id INTEGER PRIMARY KEY,
      fromStepEntryId INTEGER NOT NULL,
      toStepEntryId INTEGER,
      toStepCode TEXT NOT NULL,
      groupKind TEXT NOT NULL CHECK(groupKind IN ('identity','subentry','family')),
      relationKind TEXT NOT NULL,
      labelEn TEXT NOT NULL,
      labelFr TEXT NOT NULL,
      source TEXT NOT NULL,
      evidence TEXT NOT NULL,
      sortOrder INTEGER NOT NULL,
      UNIQUE(fromStepEntryId, toStepCode, relationKind, source)
    );
    CREATE INDEX idx_LexiconRelations_from
      ON LexiconRelations(fromStepEntryId, groupKind, sortOrder);
    CREATE INDEX idx_LexiconRelations_to
      ON LexiconRelations(toStepEntryId);
    CREATE INDEX idx_LexiconRelations_code
      ON LexiconRelations(toStepCode);
    CREATE TABLE LexiconRelationProvenance (
      relationId INTEGER PRIMARY KEY,
      sourceHash TEXT NOT NULL,
      validationResult TEXT NOT NULL
    ) WITHOUT ROWID;
  `);

  const rows = db
    .prepare(
      `SELECT se.id, se.eStrong, se.uStrong, i.stepCode, i.relationKind,
              i.relatedStepCode, i.relationLabelEn, i.relationLabelFr
       FROM StepEntries se
       JOIN StepEntryIdentities i ON i.stepEntryId=se.id
       ORDER BY se.id`
    )
    .all() as unknown as StepRow[];
  const byStepCode = new Map(rows.map((row) => [row.stepCode, row]));
  const byEStrong = groupBy(rows, (row) => row.eStrong);
  const byUStrong = groupBy(rows, (row) => row.uStrong);
  const relations: RelationInsert[] = [];

  for (const row of rows) {
    if (row.relationKind && row.relatedStepCode) {
      const target = byStepCode.get(row.relatedStepCode) ?? null;
      relations.push({
        fromStepEntryId: row.id,
        toStepEntryId: target?.id ?? null,
        toStepCode: row.relatedStepCode,
        groupKind: "identity",
        relationKind: row.relationKind,
        labelEn: row.relationLabelEn ?? "Related identity",
        labelFr: row.relationLabelFr ?? "identité associée",
        source: "STEP_IDENTITY",
        evidence: `${row.stepCode} -> ${row.relatedStepCode}`,
        sortOrder: 10
      });
      if (target) {
        const reverse = reverseRelation(row.relationKind);
        relations.push({
          fromStepEntryId: target.id,
          toStepEntryId: row.id,
          toStepCode: row.stepCode,
          groupKind: "identity",
          relationKind: reverse.kind,
          labelEn: reverse.labelEn,
          labelFr: reverse.labelFr,
          source: "STEP_IDENTITY_REVERSE",
          evidence: `${row.relatedStepCode} <- ${row.stepCode}`,
          sortOrder: 20
        });
      }
    }

    for (const sibling of byEStrong.get(row.eStrong) ?? []) {
      if (sibling.id === row.id) continue;
      relations.push({
        fromStepEntryId: row.id,
        toStepEntryId: sibling.id,
        toStepCode: sibling.stepCode,
        groupKind: "subentry",
        relationKind: "same_estrong",
        labelEn: "Another STEP sense",
        labelFr: "autre sens STEP",
        source: "STEP_ESTRONG",
        evidence: row.eStrong,
        sortOrder: 30
      });
    }

    for (const unified of byUStrong.get(row.uStrong) ?? []) {
      if (unified.id === row.id || unified.eStrong === row.eStrong) continue;
      relations.push({
        fromStepEntryId: row.id,
        toStepEntryId: unified.id,
        toStepCode: unified.stepCode,
        groupKind: "identity",
        relationKind: "same_ustrong",
        labelEn: "Same unified identity",
        labelFr: "même identité unifiée",
        source: "STEP_USTRONG",
        evidence: row.uStrong,
        sortOrder: 40
      });
    }
  }

  const legacyRows = db
    .prepare(
      `SELECT 'greek' AS language, Code AS code, Origine AS originHtml
       FROM legacy.Grec WHERE Code > 0 AND Origine <> ''
       UNION ALL
       SELECT 'hebrew', Code, Origine
       FROM legacy.Hebreu WHERE Code > 0 AND Origine <> ''`
    )
    .all() as unknown as LegacyOriginRow[];
  for (const legacy of legacyRows) {
    const prefix = legacy.language === "greek" ? "G" : "H";
    const fromCode = `${prefix}${String(legacy.code).padStart(4, "0")}`;
    const fromEntries = byEStrong.get(fromCode) ?? [];
    if (fromEntries.length === 0) continue;
    const linkedCodes = extractLegacyStrongLinks(legacy.originHtml);
    for (const linkedCode of linkedCodes) {
      const targetEntries = byEStrong.get(linkedCode) ?? [];
      const target =
        targetEntries.find((entry) => entry.stepCode === linkedCode) ??
        targetEntries[0] ??
        null;
      const sameRoot = /m(?:ê|e)me mot|m(?:ê|e)me racine/iu.test(
        legacy.originHtml
      );
      for (const from of fromEntries) {
        relations.push({
          fromStepEntryId: from.id,
          toStepEntryId: target?.id ?? null,
          toStepCode: target?.stepCode ?? linkedCode,
          groupKind: "family",
          relationKind: sameRoot ? "same_root" : "derived_from",
          labelEn: sameRoot ? "Same root" : "Derived from",
          labelFr: sameRoot ? "même racine" : "dérivé de",
          source: "STRONG_LEGACY_ORIGIN",
          evidence: legacy.originHtml,
          sortOrder: 50
        });
      }
      if (target) {
        for (const from of fromEntries) {
          relations.push({
            fromStepEntryId: target.id,
            toStepEntryId: from.id,
            toStepCode: from.stepCode,
            groupKind: "family",
            relationKind: sameRoot ? "same_root" : "derivative",
            labelEn: sameRoot ? "Same root" : "Derived word",
            labelFr: sameRoot ? "même racine" : "mot dérivé",
            source: "STRONG_LEGACY_ORIGIN_REVERSE",
            evidence: legacy.originHtml,
            sortOrder: 60
          });
        }
      }
    }
  }

  const insert = db.prepare(
    `INSERT OR IGNORE INTO LexiconRelations(
       fromStepEntryId, toStepEntryId, toStepCode, groupKind, relationKind,
       labelEn, labelFr, source, evidence, sortOrder
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  );
  for (const relation of relations) {
    insert.run(
      relation.fromStepEntryId,
      relation.toStepEntryId,
      relation.toStepCode,
      relation.groupKind,
      relation.relationKind,
      relation.labelEn,
      relation.labelFr,
      relation.source,
      relation.evidence,
      relation.sortOrder
    );
  }
  const provenanceRows = db
    .prepare("SELECT id, source, evidence FROM LexiconRelations ORDER BY id")
    .all() as unknown as Array<{
    id: number;
    source: string;
    evidence: string;
  }>;
  const insertProvenance = db.prepare(
    `INSERT INTO LexiconRelationProvenance(
       relationId, sourceHash, validationResult
     ) VALUES (?, ?, ?)`
  );
  for (const row of provenanceRows) {
    insertProvenance.run(
      row.id,
      createHash("sha256")
        .update(row.source)
        .update("\0")
        .update(row.evidence)
        .digest("hex"),
      '{"ok":true,"checks":["known-source","target-code"]}'
    );
  }
}

function reverseRelation(kind: string): {
  kind: string;
  labelEn: string;
  labelFr: string;
} {
  const relations: Record<string, [string, string, string]> = {
    name_of: ["has_name", "Associated name", "nom associé"],
    part_of: ["has_part", "Has component", "possède ce composant"],
    combination_of: ["component_of", "Component of", "composant de"],
    group_of: ["has_group", "Associated group", "groupe associé"],
    group_member_of: ["has_member", "Group member", "membre du groupe"],
    meaning_of: ["has_meaning", "Related meaning", "sens associé"],
    spelling_of: [
      "spelling_variant",
      "Spelling variant",
      "variante orthographique"
    ],
    form_of: ["has_form", "Related form", "forme associée"],
    greek_of: ["hebrew_equivalent", "Hebrew equivalent", "équivalent hébreu"],
    hebrew_of: ["greek_equivalent", "Greek equivalent", "équivalent grec"],
    aramaic_of: ["hebrew_equivalent", "Hebrew equivalent", "équivalent hébreu"]
  };
  const relation =
    relations[kind] ??
    (["related_identity", "Related identity", "identité associée"] as [
      string,
      string,
      string
    ]);
  return { kind: relation[0], labelEn: relation[1], labelFr: relation[2] };
}

function extractLegacyStrongLinks(html: string): string[] {
  const result = new Set<string>();
  const pattern = /Strong-(Grec|Hebreu)-(\d+)\.htm/giu;
  for (const match of html.matchAll(pattern)) {
    const prefix = match[1]?.toLocaleLowerCase() === "grec" ? "G" : "H";
    const number = Number.parseInt(match[2] ?? "", 10);
    if (!Number.isInteger(number) || number <= 0) continue;
    result.add(`${prefix}${String(number).padStart(4, "0")}`);
  }
  return [...result];
}

function verify(db: DatabaseSync): Record<string, unknown> {
  const integrity = String(
    db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "unknown"
  );
  const counts = {
    stepEntries: scalar(db, "SELECT count(*) FROM StepEntries"),
    morphologyCodes: scalar(db, "SELECT count(*) FROM MorphologyCodes"),
    morphologyTranslations: scalar(
      db,
      "SELECT count(*) FROM MorphologyCodeTranslations WHERE language='fr'"
    ),
    relations: scalar(db, "SELECT count(*) FROM LexiconRelations"),
    relationProvenance: scalar(
      db,
      "SELECT count(*) FROM LexiconRelationProvenance"
    ),
    relationOrphans: scalar(
      db,
      `SELECT count(*) FROM LexiconRelations r
       LEFT JOIN StepEntries se ON se.id=r.fromStepEntryId
       WHERE se.id IS NULL OR trim(r.toStepCode)=''`
    )
  };
  if (integrity !== "ok") throw new Error(`integrity-check:${integrity}`);
  if (counts.morphologyCodes !== counts.morphologyTranslations) {
    throw new Error("incomplete-morphology-translation-coverage");
  }
  if (counts.relations !== counts.relationProvenance) {
    throw new Error("incomplete-relation-provenance");
  }
  if (counts.relationOrphans !== 0) {
    throw new Error(`relation-orphans:${counts.relationOrphans}`);
  }
  return { integrity, counts };
}

function readJsonl<T>(filePath: string): T[] {
  return readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as T);
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const result = new Map<string, T[]>();
  for (const row of rows) {
    const value = key(row);
    const group = result.get(value) ?? [];
    group.push(row);
    result.set(value, group);
  }
  return result;
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(Object.values(row ?? {})[0] ?? 0);
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const allowed = new Set([
    "lexicon",
    "legacy",
    "morphology",
    "archive",
    "summary"
  ]);
  const result: Record<string, string> = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index] ?? "";
    if (!token.startsWith("--"))
      throw new Error(`unexpected-argument:${token}`);
    const key = token.slice(2);
    if (!allowed.has(key)) throw new Error(`unknown-option:${key}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--"))
      throw new Error(`missing-value:${key}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

try {
  main();
} catch (error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exitCode = 1;
}
