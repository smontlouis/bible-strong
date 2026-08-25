import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type EntityTranslationRow = {
  entityId: number;
  category: string;
  englishName: string;
  frenchName: string;
  summaryHtml: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
};

type NormalizationScope = "own" | "global";

type NameMapping = {
  englishName: string;
  frenchName: string;
};

type ReplacementDetail = NameMapping & {
  count: number;
};

type ReplacementRow = EntityTranslationRow & {
  nextSummaryHtml: string;
  nextBrief: string;
  nextShortDescription: string;
  nextArticleHtml: string;
  replacementCount: number;
  replacementDetails: ReplacementDetail[];
};

const DEFAULT_DB = "data/entities/bible_entities.sqlite";
const DEFAULT_REPORT = "reports/entity-fr-name-normalization.md";
const DEFAULT_JSON = "reports/entity-fr-name-normalization.json";
const DEFAULT_LANGUAGE = "fr";
const FIELDS = [
  "summaryHtml",
  "brief",
  "shortDescription",
  "articleHtml"
] as const;
const MIN_GLOBAL_NAME_LENGTH = 4;
const ALWAYS_SKIP = new Set([
  "Ai",
  "Bel",
  "Dan",
  "Gad",
  "James",
  "Job",
  "Lot",
  "No",
  "On",
  "Ram",
  "Sin",
  "Ur"
]);

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const dbPath = resolve(args.db ?? DEFAULT_DB);
  const reportPath = args.report ?? DEFAULT_REPORT;
  const jsonPath = args.json ?? DEFAULT_JSON;
  const language = args.language ?? DEFAULT_LANGUAGE;
  const write = args.write === "true";
  const includeAmbiguous = args.includeAmbiguous === "true";
  const scope = parseScope(args.scope);

  if (!existsSync(dbPath)) throw new Error(`Database not found: ${dbPath}`);

  const rows = selectRows(dbPath, language);
  const globalMappings =
    scope === "global" ? buildGlobalMappings(rows, includeAmbiguous) : [];
  const replacements =
    scope === "own"
      ? rows
          .filter((row) => row.englishName !== row.frenchName)
          .filter(
            (row) => includeAmbiguous || !ALWAYS_SKIP.has(row.englishName)
          )
          .map(applyOwnNameReplacement)
          .filter((row) => row.replacementCount > 0)
      : rows
          .map((row) => applyGlobalNameReplacement(row, globalMappings))
          .filter((row) => row.replacementCount > 0);

  mkdirSync(dirname(resolve(reportPath)), { recursive: true });
  mkdirSync(dirname(resolve(jsonPath)), { recursive: true });
  writeFileSync(
    reportPath,
    renderReport(replacements, {
      write,
      scope,
      globalMappingCount: globalMappings.length
    }),
    "utf8"
  );
  writeFileSync(
    jsonPath,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        mode: write ? "write" : "dry-run",
        scope,
        language,
        candidateRows: rows.length,
        globalMappingCount: globalMappings.length,
        replacementRows: replacements.length,
        replacementCount: replacements.reduce(
          (total, row) => total + row.replacementCount,
          0
        ),
        replacements: replacements.slice(0, 500).map((row) => ({
          entityId: row.entityId,
          category: row.category,
          englishName: row.englishName,
          frenchName: row.frenchName,
          replacementCount: row.replacementCount,
          replacementDetails: row.replacementDetails.slice(0, 20)
        }))
      },
      null,
      2
    )}\n`,
    "utf8"
  );

  if (write) {
    const backupPath = createBackup(dbPath);
    importRows(dbPath, replacements, language);
    console.log(
      JSON.stringify(
        {
          mode: "write",
          database: dbPath,
          language,
          scope,
          globalMappingCount: globalMappings.length,
          replacementRows: replacements.length,
          replacementCount: replacements.reduce(
            (total, row) => total + row.replacementCount,
            0
          ),
          reportPath,
          jsonPath,
          backupPath
        },
        null,
        2
      )
    );
  } else {
    console.log(
      JSON.stringify(
        {
          mode: "dry-run",
          database: dbPath,
          language,
          scope,
          globalMappingCount: globalMappings.length,
          replacementRows: replacements.length,
          replacementCount: replacements.reduce(
            (total, row) => total + row.replacementCount,
            0
          ),
          reportPath,
          jsonPath
        },
        null,
        2
      )
    );
  }
}

function selectRows(dbPath: string, language: string): EntityTranslationRow[] {
  const sql = `
    SELECT
      et.entityId,
      e.category,
      e.displayName AS englishName,
      et.displayName AS frenchName,
      et.summaryHtml,
      et.brief,
      et.shortDescription,
      et.articleHtml
    FROM EntityTranslations et
    JOIN Entities e ON e.id = et.entityId
    WHERE et.language = ${sqlString(language)}
    ORDER BY et.entityId
  `;
  const raw = execFileSync("sqlite3", ["-json", dbPath, sql], {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 120
  });
  return JSON.parse(raw) as EntityTranslationRow[];
}

function applyOwnNameReplacement(row: EntityTranslationRow): ReplacementRow {
  let replacementCount = 0;
  const next = {
    nextSummaryHtml: row.summaryHtml,
    nextBrief: row.brief,
    nextShortDescription: row.shortDescription,
    nextArticleHtml: row.articleHtml
  };
  for (const field of FIELDS) {
    const key =
      `next${field[0].toUpperCase()}${field.slice(1)}` as keyof typeof next;
    const result = replaceTextNodes(next[key], row.englishName, row.frenchName);
    next[key] = result.value;
    replacementCount += result.count;
  }
  return {
    ...row,
    ...next,
    replacementCount,
    replacementDetails:
      replacementCount > 0
        ? [
            {
              englishName: row.englishName,
              frenchName: row.frenchName,
              count: replacementCount
            }
          ]
        : []
  };
}

function buildGlobalMappings(
  rows: EntityTranslationRow[],
  includeAmbiguous: boolean
): NameMapping[] {
  const byEnglishName = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!row.englishName || row.englishName === row.frenchName) continue;
    if (Array.from(row.englishName).length < MIN_GLOBAL_NAME_LENGTH) continue;
    if (!includeAmbiguous && ALWAYS_SKIP.has(row.englishName)) continue;
    const frenchNames = byEnglishName.get(row.englishName) ?? new Set<string>();
    frenchNames.add(row.frenchName);
    byEnglishName.set(row.englishName, frenchNames);
  }
  return [...byEnglishName.entries()]
    .filter(([, frenchNames]) => includeAmbiguous || frenchNames.size === 1)
    .map(([englishName, frenchNames]) => ({
      englishName,
      frenchName: [...frenchNames][0] ?? englishName
    }))
    .filter((mapping) => mapping.englishName !== mapping.frenchName)
    .sort((left, right) => {
      const lengthDiff =
        Array.from(right.englishName).length -
        Array.from(left.englishName).length;
      return lengthDiff || left.englishName.localeCompare(right.englishName);
    });
}

function applyGlobalNameReplacement(
  row: EntityTranslationRow,
  mappings: NameMapping[]
): ReplacementRow {
  let replacementCount = 0;
  const detailCounts = new Map<string, ReplacementDetail>();
  const next = {
    nextSummaryHtml: row.summaryHtml,
    nextBrief: row.brief,
    nextShortDescription: row.shortDescription,
    nextArticleHtml: row.articleHtml
  };
  for (const field of FIELDS) {
    const key =
      `next${field[0].toUpperCase()}${field.slice(1)}` as keyof typeof next;
    const result = replaceTextNodesMany(next[key], mappings);
    next[key] = result.value;
    replacementCount += result.count;
    for (const detail of result.details) {
      const existing = detailCounts.get(detail.englishName);
      if (existing) {
        existing.count += detail.count;
      } else {
        detailCounts.set(detail.englishName, { ...detail });
      }
    }
  }
  return {
    ...row,
    ...next,
    replacementCount,
    replacementDetails: [...detailCounts.values()].sort(
      (left, right) => right.count - left.count
    )
  };
}

function replaceTextNodes(
  value: string,
  englishName: string,
  frenchName: string
): { value: string; count: number } {
  if (!value || !englishName || englishName === frenchName) {
    return { value, count: 0 };
  }
  const pattern = namePattern(englishName);
  let count = 0;
  const parts = value.split(/(<[^>]+>)/g);
  const next = parts
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;
      return part.replace(pattern, () => {
        count += 1;
        return frenchName;
      });
    })
    .join("");
  return { value: next, count };
}

function replaceTextNodesMany(
  value: string,
  mappings: NameMapping[]
): { value: string; count: number; details: ReplacementDetail[] } {
  if (!value || mappings.length === 0) {
    return { value, count: 0, details: [] };
  }
  const frenchNameByEnglishName = new Map(
    mappings.map((mapping) => [mapping.englishName, mapping.frenchName])
  );
  const pattern = namesPattern(mappings.map((mapping) => mapping.englishName));
  let count = 0;
  const detailCounts = new Map<string, ReplacementDetail>();
  const parts = value.split(/(<[^>]+>)/g);
  const next = parts
    .map((part) => {
      if (part.startsWith("<") && part.endsWith(">")) return part;
      return part.replace(pattern, (matched: string) => {
        const frenchName = frenchNameByEnglishName.get(matched);
        if (!frenchName) return matched;
        count += 1;
        const existing = detailCounts.get(matched);
        if (existing) {
          existing.count += 1;
        } else {
          detailCounts.set(matched, {
            englishName: matched,
            frenchName,
            count: 1
          });
        }
        return frenchName;
      });
    })
    .join("");
  return {
    value: next,
    count,
    details: [...detailCounts.values()].sort(
      (left, right) => right.count - left.count
    )
  };
}

function namePattern(name: string): RegExp {
  const escaped = escapeRegex(name);
  return new RegExp(
    `(?<![\\p{L}\\p{N}_-])${escaped}(?![\\p{L}\\p{N}_-])`,
    "gu"
  );
}

function namesPattern(names: string[]): RegExp {
  const alternation = names.map(escapeRegex).join("|");
  return new RegExp(
    `(?<![\\p{L}\\p{N}_-])(${alternation})(?![\\p{L}\\p{N}_-])`,
    "gu"
  );
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function importRows(
  dbPath: string,
  rows: ReplacementRow[],
  language: string
): void {
  if (rows.length === 0) return;
  const values = rows
    .map(
      (row) =>
        `(${row.entityId}, ${sqlString(row.nextSummaryHtml)}, ${sqlString(row.nextBrief)}, ${sqlString(row.nextShortDescription)}, ${sqlString(row.nextArticleHtml)})`
    )
    .join(",\n");
  runSql(
    dbPath,
    `
      BEGIN;
      CREATE TEMP TABLE EntityNameNormalizationImport (
        entityId INTEGER PRIMARY KEY,
        summaryHtml TEXT NOT NULL,
        brief TEXT NOT NULL,
        shortDescription TEXT NOT NULL,
        articleHtml TEXT NOT NULL
      );
      INSERT INTO EntityNameNormalizationImport
        (entityId, summaryHtml, brief, shortDescription, articleHtml)
      VALUES
        ${values};
      UPDATE EntityTranslations
      SET
        summaryHtml = (
          SELECT summaryHtml FROM EntityNameNormalizationImport
          WHERE entityId = EntityTranslations.entityId
        ),
        brief = (
          SELECT brief FROM EntityNameNormalizationImport
          WHERE entityId = EntityTranslations.entityId
        ),
        shortDescription = (
          SELECT shortDescription FROM EntityNameNormalizationImport
          WHERE entityId = EntityTranslations.entityId
        ),
        articleHtml = (
          SELECT articleHtml FROM EntityNameNormalizationImport
          WHERE entityId = EntityTranslations.entityId
        ),
        updatedAt = datetime('now')
      WHERE language = ${sqlString(language)}
        AND entityId IN (SELECT entityId FROM EntityNameNormalizationImport);
      DROP TABLE EntityNameNormalizationImport;
      COMMIT;
    `
  );
}

function renderReport(
  rows: ReplacementRow[],
  input: {
    write: boolean;
    scope: NormalizationScope;
    globalMappingCount: number;
  }
): string {
  const topRows =
    rows
      .slice(0, 80)
      .map(
        (row) =>
          `| ${row.entityId} | ${mdCell(row.category)} | ${mdCell(row.englishName)} | ${mdCell(row.frenchName)} | ${row.replacementCount} | ${mdCell(formatDetails(row.replacementDetails))} |`
      )
      .join("\n") || "| none | none | none | none | 0 | none |";
  return `# Entity FR Name Normalization

Generated: ${new Date().toISOString()}

Mode: ${input.write ? "write" : "dry-run"}
Scope: ${input.scope}

## Summary

- Replacement rows: ${rows.length}
- Replacement count: ${rows.reduce((total, row) => total + row.replacementCount, 0)}
- Global mapping count: ${input.globalMappingCount}

## Top Replacements

| Entity ID | Category | Entity EN | Entity FR | Count | Details |
| ---: | --- | --- | --- | ---: | --- |
${topRows}
`;
}

function formatDetails(details: ReplacementDetail[]): string {
  return details
    .slice(0, 6)
    .map(
      (detail) =>
        `${detail.englishName}=>${detail.frenchName} (${detail.count})`
    )
    .join("; ");
}

function mdCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}

function createBackup(dbPath: string): string {
  const parsed = new Date().toISOString().replace(/[:.]/g, "-");
  const backupPath = `${dbPath}.backup-${parsed}-before-entity-name-normalization`;
  mkdirSync(dirname(backupPath), { recursive: true });
  copyFileSync(dbPath, backupPath);
  return backupPath;
}

function runSql(dbPath: string, sql: string): void {
  execFileSync("sqlite3", [dbPath], {
    input: sql,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 160
  });
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

function parseScope(value: string | undefined): NormalizationScope {
  if (!value) return "own";
  if (value === "own" || value === "global") return value;
  throw new Error(`Unsupported scope: ${value}. Expected "own" or "global".`);
}

function sqlString(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

main();
