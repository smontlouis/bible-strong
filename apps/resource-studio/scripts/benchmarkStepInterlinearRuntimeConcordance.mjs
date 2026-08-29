import { performance } from "node:perf_hooks";
import process from "node:process";
import { readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const root = process.cwd();
const v4Dir = path.resolve(
  root,
  "outputs/releases/bible-step-interlinear-runtime-v4"
);
const v5Dir = path.resolve(
  root,
  "outputs/releases/bible-step-interlinear-runtime-v5"
);
const reportBase = path.resolve(
  root,
  "reports/step-interlinear-runtime-v5-benchmark"
);
const databaseFile = "bible-step-interlinear-fr.sqlite";
const familyBits = [
  ["strong", 1],
  ["estrong", 2],
  ["dstrong", 4],
  ["ustrong", 8]
];

const v4 = new DatabaseSync(path.join(v4Dir, databaseFile), {
  readOnly: true
});
const v5 = new DatabaseSync(path.join(v5Dir, databaseFile), {
  readOnly: true
});

try {
  for (const database of [v4, v5]) {
    database.exec("PRAGMA cache_size=-65536; PRAGMA temp_store=MEMORY;");
  }

  const frequencies = v5
    .prepare(
      `SELECT c.code, count(*) AS verseCount
         FROM StrongVerseIndex i
         JOIN StrongCodes c ON c.id=i.codeId
        GROUP BY c.id, c.code
        ORDER BY verseCount DESC, c.code`
    )
    .all();
  const byCode = new Map(frequencies.map((row) => [row.code, row]));
  const cases = [];
  const used = new Set();
  const addCase = (category, row) => {
    if (!row || used.has(row.code)) return;
    const total = byCode.get(row.code) ?? row;
    cases.push({
      category,
      code: row.code,
      expectedVerseCount: Number(total.verseCount)
    });
    used.add(row.code);
  };
  addCase("very-frequent", byCode.get("G2316") ?? frequencies[0]);
  addCase(
    "medium-frequency",
    frequencies
      .filter(({ code }) => !used.has(code))
      .sort(
        (left, right) =>
          Math.abs(Number(left.verseCount) - 100) -
            Math.abs(Number(right.verseCount) - 100) ||
          String(left.code).localeCompare(String(right.code))
      )[0]
  );
  addCase(
    "rare",
    frequencies.find(
      ({ code, verseCount }) => !used.has(code) && Number(verseCount) === 1
    )
  );
  for (const [family, bit] of familyBits) {
    const rows = v5
      .prepare(
        `SELECT c.code, count(*) AS verseCount
           FROM StrongVerseIndex i
           JOIN StrongCodes c ON c.id=i.codeId
          WHERE (i.kindMask & ?) != 0
          GROUP BY c.id, c.code
          ORDER BY verseCount DESC, c.code`
      )
      .all(bit);
    addCase(
      `family-${family}`,
      rows.find(({ code }) => !used.has(code)) ?? rows[0]
    );
  }
  cases.push({
    category: "absent",
    code: "__ABSENT_STRONG__",
    expectedVerseCount: 0
  });

  const results = cases.map((benchmarkCase) => ({
    ...benchmarkCase,
    v4: benchmarkDatabase(v4, benchmarkCase.code, false),
    v5: benchmarkDatabase(v5, benchmarkCase.code, true)
  }));
  for (const result of results) {
    if (
      result.v4.resultVerseCount !== result.expectedVerseCount ||
      result.v5.resultVerseCount !== result.expectedVerseCount
    ) {
      throw new Error(
        `benchmark-result-parity:${result.code}:${result.expectedVerseCount}:${result.v4.resultVerseCount}:${result.v5.resultVerseCount}`
      );
    }
    if (
      result.v5.timingsMs.countByBook.median >= 10 ||
      result.v5.timingsMs.page60.median >= 10
    ) {
      throw new Error(`benchmark-v5-budget:${result.code}`);
    }
    if (
      [...result.v5.plans.countByBook, ...result.v5.plans.page60].some(
        (detail) => /\bSegments\b/iu.test(detail)
      )
    ) {
      throw new Error(`benchmark-v5-segments-plan:${result.code}`);
    }
  }
  const v4Catalog = JSON.parse(
    await readFile(path.join(v4Dir, "catalog.json"), "utf8")
  );
  const v5Catalog = JSON.parse(
    await readFile(path.join(v5Dir, "catalog.json"), "utf8")
  );
  const sizes = await buildSizeSummary(v4Catalog, v5Catalog);
  const indexBytes = Object.fromEntries(
    v5
      .prepare(
        `SELECT name, sum(pgsize) AS bytes
           FROM dbstat
          WHERE name IN (
            'StrongVerseIndex',
            'idx_runtime_strong_codes_code'
          )
          GROUP BY name
          ORDER BY name`
      )
      .all()
      .map(({ name, bytes }) => [name, Number(bytes)])
  );
  const report = {
    generatedAt: new Date().toISOString(),
    environment: {
      node: process.version,
      sqlite: v5.prepare("SELECT sqlite_version() AS version").get().version,
      platform: `${process.platform}-${process.arch}`,
      database: databaseFile,
      cache: "warm, SQLite cache_size=64 MiB"
    },
    iterations: { v4: 3, v5: 25, warmups: 2 },
    cases: results,
    sizes,
    indexBytes
  };
  await writeFile(
    `${reportBase}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
    "utf8"
  );
  await writeFile(`${reportBase}.md`, renderMarkdown(report), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
} finally {
  v4.close();
  v5.close();
}

function benchmarkDatabase(database, code, hasInverseIndex) {
  const resolve = database.prepare(
    "SELECT id FROM StrongCodes WHERE code=? LIMIT 1"
  );
  const resolved = resolve.get(code);
  const codeId = Number(resolved?.id ?? -1);
  const count = database.prepare(
    hasInverseIndex
      ? `SELECT v.bookOrder, v.bookId, count(*) AS verseCount
           FROM StrongVerseIndex i
           JOIN Verses v ON v.id=i.verseId
          WHERE i.codeId=?
          GROUP BY v.bookOrder, v.bookId
          ORDER BY v.bookOrder`
      : `SELECT v.bookOrder, v.bookId, count(DISTINCT v.id) AS verseCount
           FROM Segments s
           JOIN Tokens t ON t.id=s.tokenId
           JOIN Verses v ON v.id=t.verseId
          WHERE s.strongCodeId=? OR s.eStrongCodeId=? OR
                s.dStrongCodeId=? OR s.uStrongCodeId=?
          GROUP BY v.bookOrder, v.bookId
          ORDER BY v.bookOrder`
  );
  const page = database.prepare(
    hasInverseIndex
      ? `SELECT v.id, v.bookOrder, v.bookId, v.chapter, v.verse
           FROM StrongVerseIndex i
           JOIN Verses v ON v.id=i.verseId
          WHERE i.codeId=?
          ORDER BY i.verseId
          LIMIT 60 OFFSET 0`
      : `SELECT DISTINCT v.id, v.bookOrder, v.bookId, v.chapter, v.verse
           FROM Segments s
           JOIN Tokens t ON t.id=s.tokenId
           JOIN Verses v ON v.id=t.verseId
          WHERE s.strongCodeId=? OR s.eStrongCodeId=? OR
                s.dStrongCodeId=? OR s.uStrongCodeId=?
          ORDER BY v.bookOrder, v.chapter, v.verse
          LIMIT 60 OFFSET 0`
  );
  const resolveArgs = [code];
  const lookupArgs = hasInverseIndex
    ? [codeId]
    : [codeId, codeId, codeId, codeId];
  const pageRows = page.all(...lookupArgs);
  const verseIds = pageRows.map(({ id }) => Number(id));
  const span =
    verseIds.length === 0
      ? undefined
      : database.prepare(
          `SELECT t.verseId, t.id AS tokenId, t.readingOrdinal,
                  t.startOffset AS tokenStartOffset, t.length AS tokenLength,
                  s.id AS segmentId, s.ordinal AS segmentOrdinal,
                  s.startOffset AS segmentStartOffset,
                  s.length AS segmentLength,
                  s.strongCodeId, s.eStrongCodeId,
                  s.dStrongCodeId, s.uStrongCodeId
             FROM Tokens t
             JOIN Segments s ON s.tokenId=t.id
            WHERE t.verseId IN (${verseIds.map(() => "?").join(",")})
            ORDER BY t.verseId, t.readingOrdinal, s.ordinal`
        );
  const iterations = hasInverseIndex ? 25 : 3;
  return {
    resolvedCodeId: codeId === -1 ? null : codeId,
    resultVerseCount: Number(
      count
        .all(...lookupArgs)
        .reduce((total, row) => total + Number(row.verseCount), 0)
    ),
    pageSize: pageRows.length,
    timingsMs: {
      resolve: timeStatement(resolve, resolveArgs, iterations),
      countByBook: timeStatement(count, lookupArgs, iterations),
      page60: timeStatement(page, lookupArgs, iterations),
      loadSegments: span
        ? timeStatement(span, verseIds, iterations)
        : emptyTiming()
    },
    plans: {
      resolve: explain(database, resolve.sourceSQL, resolveArgs),
      countByBook: explain(database, count.sourceSQL, lookupArgs),
      page60: explain(database, page.sourceSQL, lookupArgs),
      loadSegments: span ? explain(database, span.sourceSQL, verseIds) : []
    }
  };
}

function timeStatement(statement, args, iterations) {
  for (let warmup = 0; warmup < 2; warmup += 1) statement.all(...args);
  const samples = [];
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const start = performance.now();
    statement.all(...args);
    samples.push(performance.now() - start);
  }
  samples.sort((left, right) => left - right);
  return {
    median: round(samples[Math.floor(samples.length / 2)]),
    p95: round(
      samples[
        Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)
      ]
    ),
    min: round(samples[0]),
    max: round(samples.at(-1))
  };
}

function emptyTiming() {
  return { median: 0, p95: 0, min: 0, max: 0 };
}

function explain(database, sql, args) {
  return database
    .prepare(`EXPLAIN QUERY PLAN ${sql}`)
    .all(...args)
    .map(({ detail }) => String(detail));
}

async function buildSizeSummary(v4Catalog, v5Catalog) {
  const entries = {};
  for (const [version, directory, catalog] of [
    ["v4", v4Dir, v4Catalog],
    ["v5", v5Dir, v5Catalog]
  ]) {
    entries[version] = {};
    for (const locale of ["fr", "en"]) {
      const file = `bible-step-interlinear-${locale}.sqlite`;
      entries[version][locale] = {
        sqliteBytes: (await stat(path.join(directory, file))).size,
        zipBytes: (await stat(path.join(directory, `${file}.zip`))).size
      };
    }
    entries[version].pair = {
      sqliteBytes: catalog.sizes.runtimeSqliteBytes,
      zipBytes: catalog.archives
        .filter(({ entry }) => entry.endsWith(".sqlite"))
        .reduce((total, archive) => total + archive.archiveBytes, 0)
    };
  }
  entries.added = {
    sqliteBytes: entries.v5.pair.sqliteBytes - entries.v4.pair.sqliteBytes,
    zipBytes: entries.v5.pair.zipBytes - entries.v4.pair.zipBytes
  };
  return entries;
}

function renderMarkdown(report) {
  const rows = report.cases
    .map((entry) => {
      const v4Count = entry.v4.timingsMs.countByBook.median.toFixed(3);
      const v5Count = entry.v5.timingsMs.countByBook.median.toFixed(3);
      const v4Page = entry.v4.timingsMs.page60.median.toFixed(3);
      const v5Page = entry.v5.timingsMs.page60.median.toFixed(3);
      const spans = entry.v5.timingsMs.loadSegments.median.toFixed(3);
      return `| ${entry.category} | \`${entry.code}\` | ${entry.expectedVerseCount} | ${v4Count} | ${v5Count} | ${v4Page} | ${v5Page} | ${spans} |`;
    })
    .join("\n");
  const plans = report.cases
    .map(
      (entry) => `### ${entry.category}: \`${entry.code}\`

V4 page:

\`\`\`text
${entry.v4.plans.page60.join("\n")}
\`\`\`

V5 page:

\`\`\`text
${entry.v5.plans.page60.join("\n")}
\`\`\`
`
    )
    .join("\n");
  return `# STEP interlinear runtime V5 concordance benchmark

Generated: ${report.generatedAt}

Environment: ${report.environment.node}, SQLite ${report.environment.sqlite}, ${report.environment.platform}; ${report.environment.cache}. Median warm timings in milliseconds (${report.iterations.v4} V4 and ${report.iterations.v5} V5 measured iterations after ${report.iterations.warmups} warmups).

| Case | Code | Verses | V4 count | V5 count | V4 page 60 | V5 page 60 | V5 spans |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
${rows}

## Sizes

| Artifact pair | SQLite bytes | ZIP bytes |
| --- | ---: | ---: |
| V4 FR + EN | ${report.sizes.v4.pair.sqliteBytes} | ${report.sizes.v4.pair.zipBytes} |
| V5 FR + EN | ${report.sizes.v5.pair.sqliteBytes} | ${report.sizes.v5.pair.zipBytes} |
| Added | ${report.sizes.added.sqliteBytes} | ${report.sizes.added.zipBytes} |

V5 on-disk index objects in the French database:

\`\`\`json
${JSON.stringify(report.indexBytes, null, 2)}
\`\`\`

## Query plans

${plans}
`;
}

function round(value) {
  return Math.round(value * 1000) / 1000;
}
