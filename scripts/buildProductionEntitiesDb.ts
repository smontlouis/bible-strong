import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { dirname, resolve } from "node:path";

const DEFAULT_SOURCE = "data/entities/bible_entities.sqlite";
const DEFAULT_OUTPUT = "data/entities/bible_entities.production.sqlite";
const DEFAULT_REPORT = "reports/entities-production-db.md";

type DbStatRow = {
  name: string;
  bytes: number;
};

type CountRow = {
  entities: number;
  translations: number;
  refs: number;
  relations: number;
  places: number;
  names: number;
};

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const sourcePath = resolve(args.source ?? DEFAULT_SOURCE);
  const outputPath = resolve(args.output ?? DEFAULT_OUTPUT);
  const reportPath = resolve(args.report ?? DEFAULT_REPORT);

  if (!existsSync(sourcePath)) {
    throw new Error(`Source database not found: ${sourcePath}`);
  }

  mkdirSync(dirname(outputPath), { recursive: true });
  mkdirSync(dirname(reportPath), { recursive: true });
  if (existsSync(outputPath)) rmSync(outputPath);

  buildProductionDb(sourcePath, outputPath);
  runSql(outputPath, "VACUUM;");

  const sourceBytes = statSync(sourcePath).size;
  const outputBytes = statSync(outputPath).size;
  const gzipBytes = gzipSize(outputPath);
  const stats = dbStats(outputPath);
  const counts = productionCounts(outputPath);
  const integrity = runScalar(outputPath, "PRAGMA integrity_check;");

  writeFileSync(
    reportPath,
    renderReport({
      sourcePath,
      outputPath,
      sourceBytes,
      outputBytes,
      gzipBytes,
      stats,
      counts,
      integrity
    }),
    "utf8"
  );

  console.log(
    JSON.stringify(
      {
        sourcePath,
        outputPath,
        reportPath,
        sourceBytes,
        outputBytes,
        gzipBytes,
        reductionPct: roundPct(1 - outputBytes / sourceBytes),
        integrity
      },
      null,
      2
    )
  );
}

function buildProductionDb(sourcePath: string, outputPath: string): void {
  runSql(
    sourcePath,
    `
      ATTACH ${sqlString(outputPath)} AS out;
      PRAGMA out.foreign_keys = OFF;
      PRAGMA out.page_size = 4096;
      PRAGMA out.journal_mode = OFF;
      PRAGMA out.synchronous = OFF;

      CREATE TABLE out.Entities (
        id INTEGER PRIMARY KEY,
        uniqueName TEXT NOT NULL,
        uStrong TEXT NOT NULL,
        displayName TEXT NOT NULL,
        category TEXT NOT NULL,
        type TEXT NOT NULL,
        description TEXT NOT NULL,
        summaryHtml TEXT NOT NULL,
        briefest TEXT NOT NULL,
        brief TEXT NOT NULL,
        shortDescription TEXT NOT NULL,
        articleHtml TEXT NOT NULL
      );

      INSERT INTO out.Entities
        (id, uniqueName, uStrong, displayName, category, type, description, summaryHtml, briefest, brief, shortDescription, articleHtml)
      SELECT
        id, uniqueName, uStrong, displayName, category, type, description, summaryHtml, briefest, brief, shortDescription, articleHtml
      FROM main.Entities;

      CREATE TABLE out.EntityTranslations (
        id INTEGER PRIMARY KEY,
        entityId INTEGER NOT NULL,
        language TEXT NOT NULL,
        displayName TEXT NOT NULL,
        description TEXT NOT NULL,
        summaryHtml TEXT NOT NULL,
        briefest TEXT NOT NULL,
        brief TEXT NOT NULL,
        shortDescription TEXT NOT NULL,
        articleHtml TEXT NOT NULL,
        UNIQUE (entityId, language)
      );

      INSERT INTO out.EntityTranslations
        (entityId, language, displayName, description, summaryHtml, briefest, brief, shortDescription, articleHtml)
      SELECT
        entityId, language, displayName, description, summaryHtml, briefest, brief, shortDescription, articleHtml
      FROM main.EntityTranslations;

      CREATE TABLE out.EntityRefs (
        entityId INTEGER NOT NULL,
        book TEXT NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL,
        suffix TEXT NOT NULL,
        refText TEXT NOT NULL,
        PRIMARY KEY (entityId, book, chapter, verse, suffix)
      ) WITHOUT ROWID;

      INSERT INTO out.EntityRefs
        (entityId, book, chapter, verse, suffix, refText)
      SELECT
        entityId, book, chapter, verse, suffix, refText
      FROM main.EntityRefs;

      CREATE TABLE out.EntityRelations (
        fromEntityId INTEGER NOT NULL,
        relation TEXT NOT NULL,
        toUniqueName TEXT NOT NULL,
        toEntityId INTEGER,
        certainty TEXT NOT NULL
      );

      INSERT INTO out.EntityRelations
        (fromEntityId, relation, toUniqueName, toEntityId, certainty)
      SELECT
        fromEntityId, relation, toUniqueName, toEntityId, certainty
      FROM main.EntityRelations;

      CREATE TABLE out.EntityPlaces (
        entityId INTEGER PRIMARY KEY,
        openBibleName TEXT NOT NULL,
        googleMapUrl TEXT NOT NULL,
        palopenmapsUrl TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        area TEXT NOT NULL
      ) WITHOUT ROWID;

      INSERT INTO out.EntityPlaces
        (entityId, openBibleName, googleMapUrl, palopenmapsUrl, latitude, longitude, area)
      SELECT
        entityId, openBibleName, googleMapUrl, palopenmapsUrl, latitude, longitude, area
      FROM main.EntityPlaces;

      CREATE TABLE out.EntityNames (
        entityId INTEGER NOT NULL,
        significance TEXT NOT NULL,
        uniqueName TEXT NOT NULL,
        dStrong TEXT NOT NULL,
        eStrong TEXT NOT NULL,
        original TEXT NOT NULL,
        displayName TEXT NOT NULL,
        stepBibleLink TEXT NOT NULL,
        refsText TEXT NOT NULL
      );

      INSERT INTO out.EntityNames
        (entityId, significance, uniqueName, dStrong, eStrong, original, displayName, stepBibleLink, refsText)
      SELECT
        entityId, significance, uniqueName, dStrong, eStrong, original, displayName, stepBibleLink, refsText
      FROM main.EntityNames;

      CREATE TABLE out.EntityMeta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;

      INSERT INTO out.EntityMeta (key, value)
      SELECT key, value
      FROM main.EntityMeta
      WHERE key IN ('attribution', 'license', 'source', 'sourceDigests');

      INSERT INTO out.EntityMeta (key, value)
      VALUES
        ('productionGeneratedAt', ${sqlString(new Date().toISOString())}),
        ('productionProfile', 'mobile-safe-v1'),
        ('removedColumns', 'rawJson,rawHeader,source,createdAt,updatedAt,ids-on-child-tables');

      CREATE INDEX out.idx_entities_category ON Entities(category);
      CREATE INDEX out.idx_entities_displayName ON Entities(displayName);
      CREATE INDEX out.idx_refs_ref ON EntityRefs(book, chapter, verse);
      CREATE INDEX out.idx_relations_from ON EntityRelations(fromEntityId);
      CREATE INDEX out.idx_relations_to ON EntityRelations(toEntityId);
      CREATE INDEX out.idx_names_entity ON EntityNames(entityId);
      CREATE INDEX out.idx_names_dStrong ON EntityNames(dStrong);

      DETACH out;
    `
  );
}

function productionCounts(dbPath: string): CountRow {
  const rows = runJson<CountRow>(
    dbPath,
    `
      SELECT
        (SELECT count(*) FROM Entities) AS entities,
        (SELECT count(*) FROM EntityTranslations) AS translations,
        (SELECT count(*) FROM EntityRefs) AS refs,
        (SELECT count(*) FROM EntityRelations) AS relations,
        (SELECT count(*) FROM EntityPlaces) AS places,
        (SELECT count(*) FROM EntityNames) AS names
    `
  );
  const [row] = rows;
  if (!row) throw new Error("Failed to read production counts");
  return row;
}

function dbStats(dbPath: string): DbStatRow[] {
  return runJson<DbStatRow>(
    dbPath,
    `
      SELECT name, SUM(pgsize) AS bytes
      FROM dbstat
      GROUP BY name
      ORDER BY bytes DESC
    `
  );
}

function gzipSize(dbPath: string): number {
  const output = execFileSync("gzip", ["-c", "-9", dbPath], {
    maxBuffer: 1024 * 1024 * 60
  });
  return output.byteLength;
}

function runSql(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 200
  });
}

function runJson<T>(dbPath: string, sql: string): T[] {
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 120
  });
  return JSON.parse(raw || "[]") as T[];
}

function runScalar(dbPath: string, sql: string): string {
  return execFileSync("sqlite3", [dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024
  }).trim();
}

function renderReport(input: {
  sourcePath: string;
  outputPath: string;
  sourceBytes: number;
  outputBytes: number;
  gzipBytes: number;
  stats: DbStatRow[];
  counts: CountRow;
  integrity: string;
}): string {
  const topStats = input.stats
    .map(
      (row) =>
        `| ${row.name} | ${formatBytes(row.bytes)} | ${(row.bytes / 1024 / 1024).toFixed(2)} MiB |`
    )
    .join("\n");

  return `# Production Bible Entities DB

Generated: ${new Date().toISOString()}

## Files

- Source: \`${input.sourcePath}\`
- Output: \`${input.outputPath}\`
- Integrity: \`${input.integrity}\`

## Size

| File | Bytes | Size |
| --- | ---: | ---: |
| Source SQLite | ${input.sourceBytes} | ${formatBytes(input.sourceBytes)} |
| Production SQLite | ${input.outputBytes} | ${formatBytes(input.outputBytes)} |
| Production SQLite gzip -9 | ${input.gzipBytes} | ${formatBytes(input.gzipBytes)} |

- SQLite reduction: ${roundPct(1 - input.outputBytes / input.sourceBytes)}%
- gzip transfer reduction vs source SQLite: ${roundPct(1 - input.gzipBytes / input.sourceBytes)}%

## Counts

| Table | Rows |
| --- | ---: |
| Entities | ${input.counts.entities} |
| EntityTranslations | ${input.counts.translations} |
| EntityRefs | ${input.counts.refs} |
| EntityRelations | ${input.counts.relations} |
| EntityPlaces | ${input.counts.places} |
| EntityNames | ${input.counts.names} |

## Removed

- Raw/import payloads: \`rawJson\`, \`rawHeader\`
- Build/source metadata on rows: \`source\`, \`createdAt\`, \`updatedAt\`
- Integer row ids on child tables where not needed by the app

## Kept Product Content

- English and French text tiers: \`description\`, \`summaryHtml\`, \`briefest\`, \`brief\`, \`shortDescription\`, \`articleHtml\`
- Entity name data: \`uniqueName\`, \`significance\`, \`dStrong\`, \`eStrong\`, \`original\`, \`displayName\`, \`stepBibleLink\`, \`refsText\`
- Place URLs and coordinates: \`googleMapUrl\`, \`palopenmapsUrl\`, \`latitude\`, \`longitude\`, \`area\`
- Relation resolver text: \`toUniqueName\`, kept for unresolved relation targets

## Table Sizes

| Object | Size | MiB |
| --- | ---: | ---: |
${topStats}
`;
}

function formatBytes(bytes: number): string {
  return `${(bytes / 1024 / 1024).toFixed(2)} MiB`;
}

function roundPct(value: number): number {
  return Math.round(value * 10000) / 100;
}

function parseArgs(args: string[]): Record<string, string> {
  const parsed: Record<string, string> = {};
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (!arg?.startsWith("--")) continue;
    const [rawKey, inlineValue] = arg.slice(2).split("=", 2);
    const nextValue = args[index + 1];
    const key = rawKey.replace(/-([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );
    if (inlineValue !== undefined) {
      parsed[key] = inlineValue;
    } else if (nextValue && !nextValue.startsWith("--")) {
      parsed[key] = nextValue;
      index += 1;
    } else {
      parsed[key] = "true";
    }
  }
  return parsed;
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main();
