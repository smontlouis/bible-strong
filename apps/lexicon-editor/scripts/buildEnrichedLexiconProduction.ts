import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

const DEFAULT_CORE =
  "data/dictionaries/strong_lexicon.en-fr.core.production.sqlite";
const DEFAULT_RESOURCES =
  "data/dictionaries/strong_lexicon.full.production.sqlite";
const DEFAULT_OUTPUT =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const BUILDER_VERSION = "build-enriched-lexicon-production@1";

interface ResourceRow {
  id: number;
  sourceHtml: string;
  translatedHtml: string;
  translatedText: string;
}

interface StepIdentityRow {
  id: number;
  dStrong: string;
  uStrong: string;
}

interface RelationDescription {
  kind: string;
  labelEn: string;
  labelFr: string;
}

const RELATIONS = new Map<string, RelationDescription>([
  [
    "in aramaic of",
    {
      kind: "aramaic_of",
      labelEn: "Aramaic equivalent of",
      labelFr: "équivalent araméen de"
    }
  ],
  [
    "a meaning of",
    { kind: "meaning_of", labelEn: "Meaning of", labelFr: "sens de" }
  ],
  ["a name of", { kind: "name_of", labelEn: "Name of", labelFr: "nom de" }],
  [
    "a spelling of",
    {
      kind: "spelling_of",
      labelEn: "Spelling of",
      labelFr: "variante orthographique de"
    }
  ],
  [
    "the greek of",
    {
      kind: "greek_of",
      labelEn: "Greek equivalent of",
      labelFr: "équivalent grec de"
    }
  ],
  [
    "a group of",
    { kind: "group_of", labelEn: "Group of", labelFr: "groupe de" }
  ],
  ["a part of", { kind: "part_of", labelEn: "Part of", labelFr: "partie de" }],
  ["a form of", { kind: "form_of", labelEn: "Form of", labelFr: "forme de" }],
  [
    "a combination of",
    {
      kind: "combination_of",
      labelEn: "Combination of",
      labelFr: "combinaison de"
    }
  ],
  [
    "combination of",
    {
      kind: "combination_of",
      labelEn: "Combination of",
      labelFr: "combinaison de"
    }
  ],
  [
    "a group member of",
    {
      kind: "group_member_of",
      labelEn: "Member of group",
      labelFr: "membre du groupe"
    }
  ],
  [
    "in hebrew of",
    {
      kind: "hebrew_of",
      labelEn: "Hebrew equivalent of",
      labelFr: "équivalent hébreu de"
    }
  ]
]);

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const corePath = resolve(args.core ?? DEFAULT_CORE);
  const resourcePath = resolve(args.resources ?? DEFAULT_RESOURCES);
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const summaryPath = resolve(args.summary ?? `${outputPath}.summary.json`);
  const overwrite = args.write === "true";

  for (const source of [corePath, resourcePath]) {
    if (!existsSync(source)) throw new Error(`missing-source:${source}`);
  }
  if (outputPath === corePath || outputPath === resourcePath) {
    throw new Error("output-must-not-overwrite-source");
  }
  if (existsSync(outputPath) && !overwrite) {
    throw new Error(`output-exists-requires-write:${outputPath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(summaryPath), { recursive: true });
  const temporary = `${outputPath}.tmp-${process.pid}`;
  rmSync(temporary, { force: true });
  copyFileSync(corePath, temporary);

  try {
    let summary: Record<string, unknown>;
    let published = false;
    const db = new DatabaseSync(temporary);
    try {
      db.exec("PRAGMA foreign_keys = OFF; PRAGMA journal_mode = DELETE;");
      db.exec(`ATTACH DATABASE ${sqlString(resourcePath)} AS resource_source;`);
      assertSourceCompatibility(db);
      db.exec("BEGIN IMMEDIATE;");
      try {
        db.exec(`
        DROP TABLE IF EXISTS main.LexiconResourceProvenance;
        DROP TABLE IF EXISTS main.StepEntryIdentities;
        DROP TABLE IF EXISTS main.LexiconResourceTranslations;
        DROP TABLE IF EXISTS main.LexiconResources;

        CREATE TABLE main.LexiconResources (
          id INTEGER PRIMARY KEY,
          stepEntryId INTEGER NOT NULL,
          source TEXT NOT NULL,
          kind TEXT NOT NULL,
          contentHtml TEXT NOT NULL,
          UNIQUE(stepEntryId, source, kind)
        );
        CREATE INDEX main.idx_LexiconResources_stepEntryId
          ON LexiconResources(stepEntryId);
        CREATE INDEX main.idx_LexiconResources_source_kind
          ON LexiconResources(source, kind);

        CREATE TABLE main.LexiconResourceTranslations (
          resourceId INTEGER NOT NULL,
          language TEXT NOT NULL CHECK(language = 'fr'),
          contentHtml TEXT NOT NULL,
          contentText TEXT NOT NULL,
          UNIQUE(resourceId, language)
        );

        CREATE TABLE main.LexiconResourceProvenance (
          resourceId INTEGER PRIMARY KEY,
          sourceHash TEXT NOT NULL,
          translationHash TEXT NOT NULL,
          importedFrom TEXT NOT NULL,
          validationResult TEXT NOT NULL
        );

        CREATE TABLE main.StepEntryIdentities (
          stepEntryId INTEGER PRIMARY KEY,
          stepCode TEXT NOT NULL,
          rawDStrong TEXT NOT NULL,
          relationKind TEXT,
          relatedStepCode TEXT,
          relationLabelEn TEXT,
          relationLabelFr TEXT
        );
        CREATE UNIQUE INDEX main.idx_StepEntryIdentities_stepCode
          ON StepEntryIdentities(stepCode);
        CREATE INDEX main.idx_StepEntryIdentities_relatedStepCode
          ON StepEntryIdentities(relatedStepCode);

        INSERT INTO LexiconResources
          SELECT id, stepEntryId, source, kind, contentHtml
          FROM resource_source.LexiconResources
          ORDER BY id;
        INSERT INTO LexiconResourceTranslations
          SELECT resourceId, language, contentHtml, contentText
          FROM resource_source.LexiconResourceTranslations
          WHERE language = 'fr'
          ORDER BY resourceId;
      `);

        insertResourceProvenance(db, resourcePath);
        insertStepIdentities(db);
        const generatedAt = new Date().toISOString();
        const setMeta = db.prepare(
          `INSERT INTO DictionaryMeta(key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value=excluded.value`
        );
        const metadata: Record<string, string> = {
          lexiconEnrichedAt: generatedAt,
          lexiconEnrichedBuilderVersion: BUILDER_VERSION,
          lexiconEnrichedCoreSha256: sha256File(corePath),
          lexiconEnrichedResourceSourceSha256: sha256File(resourcePath),
          lexiconV3ResourceTranslationStatus: "included:fr",
          lexiconViewerProfile: "step-en-fr-full+legacy-external",
          productionProfile: "strong-lexicon-en-fr-full-v3"
        };
        for (const [key, value] of Object.entries(metadata)) {
          setMeta.run(key, value);
        }
        db.exec("COMMIT;");
      } catch (error) {
        db.exec("ROLLBACK;");
        throw error;
      }
      db.exec("DETACH DATABASE resource_source; VACUUM;");
      summary = verifyOutput(db, corePath, resourcePath);
    } finally {
      db.close();
    }

    if (existsSync(outputPath)) rmSync(outputPath);
    renameSync(temporary, outputPath);
    published = true;
    const finalSummary = {
      ...summary,
      outputPath,
      outputSha256: sha256File(outputPath),
      generatedAt: new Date().toISOString(),
      builderVersion: BUILDER_VERSION
    };
    writeFileSync(summaryPath, `${JSON.stringify(finalSummary, null, 2)}\n`);
    console.log(JSON.stringify({ ...finalSummary, summaryPath }, null, 2));
    if (!published) rmSync(temporary, { force: true });
  } catch (error) {
    rmSync(temporary, { force: true });
    throw error;
  }
}

function assertSourceCompatibility(db: DatabaseSync): void {
  const missing = scalar(
    db,
    `SELECT count(*)
     FROM resource_source.LexiconResources lr
     LEFT JOIN StepEntries se ON se.id = lr.stepEntryId
     WHERE se.id IS NULL`
  );
  if (missing !== 0) throw new Error(`orphan-resource-entries:${missing}`);

  const mismatches = scalar(
    db,
    `SELECT count(*)
     FROM StepEntries current
     JOIN resource_source.StepEntries source ON source.id = current.id
     WHERE current.language <> source.language
        OR current.baseCode <> source.baseCode
        OR current.eStrong <> source.eStrong
        OR current.dStrong <> source.dStrong
        OR current.uStrong <> source.uStrong`
  );
  if (mismatches !== 0) {
    throw new Error(`step-identity-mismatches:${mismatches}`);
  }
}

function insertResourceProvenance(
  db: DatabaseSync,
  resourcePath: string
): void {
  const rows = db
    .prepare(
      `SELECT lr.id,
              lr.contentHtml AS sourceHtml,
              lrt.contentHtml AS translatedHtml,
              lrt.contentText AS translatedText
       FROM LexiconResources lr
       JOIN LexiconResourceTranslations lrt
         ON lrt.resourceId = lr.id AND lrt.language = 'fr'
       ORDER BY lr.id`
    )
    .all() as unknown as ResourceRow[];
  const expected = scalar(db, "SELECT count(*) FROM LexiconResources");
  if (rows.length !== expected) {
    throw new Error(`resource-translation-coverage:${rows.length}:${expected}`);
  }
  const insert = db.prepare(
    `INSERT INTO LexiconResourceProvenance(
       resourceId, sourceHash, translationHash, importedFrom, validationResult
     ) VALUES (?, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    const validation = validateResourcePair(row);
    insert.run(
      row.id,
      sha256(row.sourceHtml),
      sha256(row.translatedHtml),
      resourcePath,
      JSON.stringify(validation)
    );
  }
}

function validateResourcePair(row: ResourceRow): Record<string, unknown> {
  if (!row.sourceHtml.trim() || !row.translatedHtml.trim()) {
    throw new Error(`empty-resource-content:${row.id}`);
  }
  if (!row.translatedText.trim()) {
    throw new Error(`empty-resource-text:${row.id}`);
  }
  const sourceTags = validateHtmlStructure(row.id, "en", row.sourceHtml);
  const translatedTags = validateHtmlStructure(
    row.id,
    "fr",
    row.translatedHtml
  );
  const sourceReferences = protectedReferences(row.sourceHtml);
  const translatedReferences = protectedReferences(row.translatedHtml);
  if (sourceReferences.join("|") !== translatedReferences.join("|")) {
    throw new Error(`resource-reference-mismatch:${row.id}`);
  }
  return {
    ok: true,
    checks: ["non-empty", "balanced-html", "reference-tokens"],
    sourceTagCount: sourceTags,
    translationTagCount: translatedTags,
    referenceCount: sourceReferences.length
  };
}

function validateHtmlStructure(
  resourceId: number,
  locale: "en" | "fr",
  html: string
): number {
  if (/<\s*(?:script|style)\b/iu.test(html)) {
    throw new Error(`unsafe-resource-html:${resourceId}:${locale}`);
  }
  // STEP's LSJ payload uses Level1/Level2 as editorial markers and some rows
  // intentionally leave them open. Validate only real paired HTML emphasis.
  const pairedTags = new Set(["b", "i", "em", "strong"]);
  const stack: string[] = [];
  const tokens = [...html.matchAll(/<[^>]+>/gu)];
  for (const match of tokens) {
    if (/\son[a-z]+\s*=/iu.test(match[0])) {
      throw new Error(`unsafe-resource-html:${resourceId}:${locale}`);
    }
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)/iu.exec(match[0]);
    // LSJ also uses angle brackets as editorial notation around Greek words.
    // Only ASCII tag names participate in the HTML balance check.
    if (!parsed) continue;
    const tag = (parsed[2] ?? "").toLowerCase();
    if (!pairedTags.has(tag)) continue;
    if (parsed[1] === "/") {
      if (stack.pop() !== tag) {
        throw new Error(
          `unbalanced-resource-html:${resourceId}:${locale}:${tag}`
        );
      }
    } else {
      stack.push(tag);
    }
  }
  if (stack.length > 0) {
    throw new Error(
      `unbalanced-resource-html:${resourceId}:${locale}:${stack.join(",")}`
    );
  }
  return tokens.length;
}

function protectedReferences(html: string): string[] {
  const refs = [...html.matchAll(/<ref\s*=\s*(['"])(.*?)\1\s*>/giu)].map(
    (match) => match[2] ?? ""
  );
  const strongCodes = html.match(/\b[GH]\d{4,5}[A-Za-z]?\b/gu) ?? [];
  return [
    ...refs.map((ref) => `ref:${ref}`),
    ...strongCodes.map((code) => `strong:${code}`)
  ];
}

function insertStepIdentities(db: DatabaseSync): void {
  const rows = db
    .prepare("SELECT id, dStrong, uStrong FROM StepEntries ORDER BY id")
    .all() as unknown as StepIdentityRow[];
  const insert = db.prepare(
    `INSERT INTO StepEntryIdentities(
       stepEntryId, stepCode, rawDStrong, relationKind, relatedStepCode,
       relationLabelEn, relationLabelFr
     ) VALUES (?, ?, ?, ?, ?, ?, ?)`
  );
  for (const row of rows) {
    const match = /^(\S+)\s+=\s*(.*)$/u.exec(row.dStrong.trim());
    if (!match) throw new Error(`invalid-dstrong:${row.id}:${row.dStrong}`);
    const stepCode = match[1] ?? "";
    const rawRelation = (match[2] ?? "").trim();
    if (!rawRelation) {
      insert.run(row.id, stepCode, row.dStrong, null, null, null, null);
      continue;
    }
    const relation = RELATIONS.get(rawRelation.toLowerCase());
    if (!relation) {
      throw new Error(`unknown-step-relation:${row.id}:${rawRelation}`);
    }
    insert.run(
      row.id,
      stepCode,
      row.dStrong,
      relation.kind,
      row.uStrong,
      relation.labelEn,
      relation.labelFr
    );
  }
}

function verifyOutput(
  db: DatabaseSync,
  corePath: string,
  resourcePath: string
): Record<string, unknown> {
  const integrity = String(
    db.prepare("PRAGMA integrity_check").get()?.integrity_check ?? "unknown"
  );
  const counts = {
    stepEntries: scalar(db, "SELECT count(*) FROM StepEntries"),
    frenchEntries: scalar(
      db,
      "SELECT count(*) FROM LexiconTranslations WHERE language='fr'"
    ),
    identities: scalar(db, "SELECT count(*) FROM StepEntryIdentities"),
    relations: scalar(
      db,
      "SELECT count(*) FROM StepEntryIdentities WHERE relationKind IS NOT NULL"
    ),
    resources: scalar(db, "SELECT count(*) FROM LexiconResources"),
    frenchResources: scalar(
      db,
      "SELECT count(*) FROM LexiconResourceTranslations WHERE language='fr'"
    ),
    resourceProvenance: scalar(
      db,
      "SELECT count(*) FROM LexiconResourceProvenance"
    )
  };
  if (integrity !== "ok") throw new Error(`integrity-check:${integrity}`);
  if (counts.stepEntries !== counts.frenchEntries) {
    throw new Error("incomplete-main-french-coverage");
  }
  if (counts.stepEntries !== counts.identities) {
    throw new Error("incomplete-step-identity-coverage");
  }
  if (
    counts.resources !== counts.frenchResources ||
    counts.resources !== counts.resourceProvenance
  ) {
    throw new Error("incomplete-resource-french-coverage");
  }
  return {
    integrity,
    counts,
    corePath,
    coreSha256: sha256File(corePath),
    resourcePath,
    resourceSha256: sha256File(resourcePath)
  };
}

function scalar(db: DatabaseSync, sql: string): number {
  const row = db.prepare(sql).get() as Record<string, unknown> | undefined;
  return Number(Object.values(row ?? {})[0] ?? 0);
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function sqlString(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function parseArgs(argv: readonly string[]): Record<string, string> {
  const allowed = new Set(["core", "resources", "output", "summary", "write"]);
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
