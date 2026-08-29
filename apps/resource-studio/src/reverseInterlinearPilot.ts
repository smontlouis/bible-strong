import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  statSync,
  writeFileSync
} from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

import { BOOK_IDS } from "./books.js";

const ROOT = process.cwd();
const OUTPUT_ROOT = path.join(
  ROOT,
  "outputs/pilots/reverse-interlinear-bsb-lsg"
);
const STEP_LEDGER = path.join(
  ROOT,
  "outputs/releases/bible-step-interlinear-ledger-v2/bible-step-interlinear-en.sqlite"
);
const STEP_RUNTIME_CATALOG = path.join(
  ROOT,
  "outputs/releases/bible-step-interlinear-runtime-v4/catalog.json"
);
const STEP_RUNTIME = path.join(
  ROOT,
  "outputs/releases/bible-step-interlinear-runtime-v4/bible-step-interlinear-en.sqlite"
);

type Corpus = "TAHOT" | "TAGNT";
type MappingMethod = "manual-target-tsv" | "manual-strong-order";

interface CanonicalPublication {
  textRevision: string;
  textSha256: string;
  verses: Record<
    string,
    Record<string, Record<string, { text: string }>>
  >;
}

interface EncodedLocation {
  book: number;
  chapter: number;
  verse: number;
  ordinal: number;
  ref: string;
}

interface AlignmentRecord {
  source: string[];
  target: string[];
  meta?: { id?: string };
}

interface AlignmentDocument {
  records: AlignmentRecord[];
}

interface TargetToken {
  id: string;
  location: EncodedLocation;
  surface: string;
  startOffset: number | null;
  length: number | null;
  mappingMethod: MappingMethod;
  wordOrdinal: number | null;
}

interface WordSpan {
  ordinal: number;
  startOffset: number;
  length: number;
  strong: Set<string>;
}

interface StepToken {
  id: string;
  runtimeId: number;
  corpus: Corpus;
  sourceRef: string;
  tokenIndex: number;
  tokenType: string;
  strong: Set<string>;
}

interface PilotDefinition {
  id: "bsb" | "lsg";
  applicationVersionId: "BSB" | "LSG";
  sqlitePath?: string;
  sqliteZipPath?: string;
  canonicalZipPath: string;
  canonicalEntry: string;
  alignments: Array<{
    corpus: Corpus;
    sourceName: "WLCM" | "SBLGNT";
    path: string;
    sourceTsv: string;
    targetTsv?: string;
    mappingMethod: MappingMethod;
  }>;
}

interface PilotMetrics {
  id: string;
  applicationVersionId: string;
  inputSqliteBytes: number;
  outputSqliteBytes: number;
  outputZipBytes: number;
  addedSqliteBytes: number;
  addedSqlitePercent: number;
  integrityCheck: string;
  stepRevision: string;
  alignmentGroupCount: number;
  fullyResolvedGroupCount: number;
  partiallyResolvedGroupCount: number;
  unresolvedGroupCount: number;
  rawSourceMemberCount: number;
  storedSourceLinkCount: number;
  distinctSourceMemberCount: number;
  mappedSourceMemberCount: number;
  ambiguousSourceMemberCount: number;
  unmappedSourceMemberCount: number;
  distinctStepTokenCount: number;
  rawTargetMemberCount: number;
  distinctTargetTokenCount: number;
  locatedTargetTokenCount: number;
  unresolvedTargetTokenCount: number;
  targetTokenWithWordSpanCount: number;
  sourceMappingRate: number;
  targetLocationRate: number;
  fullyResolvedGroupRate: number;
  methods: Record<
    MappingMethod,
    {
      groups: number;
      sourceMembers: number;
      mappedSourceMembers: number;
      targetMembers: number;
      locatedTargetMembers: number;
    }
  >;
  artifacts: {
    sqlite: string;
    sqliteSha256: string;
    zip: string;
    zipSha256: string;
  };
}

const PILOTS: PilotDefinition[] = [
  {
    id: "bsb",
    applicationVersionId: "BSB",
    sqliteZipPath: path.join(
      ROOT,
      "outputs/releases/bible-strong-english-mobile-v7-candidate/bibles/bible-bsb-strong.sqlite.zip"
    ),
    canonicalZipPath: path.join(
      ROOT,
      "outputs/releases/bible-strong-english-mobile-v7-candidate/bibles/bible-bsb.json.zip"
    ),
    canonicalEntry: "bible-bsb.json",
    alignments: [
      {
        corpus: "TAHOT",
        sourceName: "WLCM",
        path: path.join(
          ROOT,
          "data/external/Alignments/data/eng/alignments/BSB/WLCM-BSB-manual.json"
        ),
        sourceTsv: path.join(
          ROOT,
          "data/external/Alignments/data/sources/WLCM.tsv"
        ),
        targetTsv: path.join(
          ROOT,
          "data/external/Alignments/data/eng/targets/BSB/ot_BSB.tsv"
        ),
        mappingMethod: "manual-target-tsv"
      },
      {
        corpus: "TAGNT",
        sourceName: "SBLGNT",
        path: path.join(
          ROOT,
          "data/external/Alignments/data/eng/alignments/BSB/SBLGNT-BSB-manual.json"
        ),
        sourceTsv: path.join(
          ROOT,
          "data/external/Alignments/data/sources/SBLGNT.tsv"
        ),
        targetTsv: path.join(
          ROOT,
          "data/external/Alignments/data/eng/targets/BSB/nt_BSB.tsv"
        ),
        mappingMethod: "manual-target-tsv"
      }
    ]
  },
  {
    id: "lsg",
    applicationVersionId: "LSG",
    sqlitePath: path.join(
      ROOT,
      "outputs/releases/bible-strong-mobile-v3-candidate/bibles/bible-lsg-strong.sqlite"
    ),
    canonicalZipPath: path.join(
      ROOT,
      "outputs/releases/bible-strong-mobile-v3-candidate/bibles/bible-lsg.json.zip"
    ),
    canonicalEntry: "bible-lsg.json",
    alignments: [
      {
        corpus: "TAHOT",
        sourceName: "WLCM",
        path: path.join(
          ROOT,
          "data/external/Alignments/data/fra/alignments/LSG/WLCM-LSG-manual.json"
        ),
        sourceTsv: path.join(
          ROOT,
          "data/external/Alignments/data/sources/WLCM.tsv"
        ),
        mappingMethod: "manual-strong-order"
      },
      {
        corpus: "TAGNT",
        sourceName: "SBLGNT",
        path: path.join(
          ROOT,
          "data/external/Alignments/data/fra/alignments/LSG/SBLGNT-LSG-manual.json"
        ),
        sourceTsv: path.join(
          ROOT,
          "data/external/Alignments/data/sources/SBLGNT.tsv"
        ),
        targetTsv: path.join(
          ROOT,
          "data/external/Alignments/data/fra/targets/LSG/nt_LSG.tsv"
        ),
        mappingMethod: "manual-target-tsv"
      }
    ]
  }
];

async function main(): Promise<void> {
  assertInputs();
  if (existsSync(OUTPUT_ROOT)) {
    throw new Error(`reverse-interlinear-pilot-output-exists:${OUTPUT_ROOT}`);
  }
  await mkdir(OUTPUT_ROOT, { recursive: true });

  const stepCatalog = JSON.parse(
    readFileSync(STEP_RUNTIME_CATALOG, "utf8")
  ) as { textRevision: string; textSha256: string };
  const stepIndex = loadStepTokenIndex(STEP_LEDGER);
  const results: PilotMetrics[] = [];

  try {
    for (const pilot of PILOTS) {
      results.push(buildPilot(pilot, stepIndex, stepCatalog));
    }
    const report = {
      schemaVersion: 1,
      format: "reverse-interlinear-bsb-lsg-pilot",
      generatedAt: new Date().toISOString(),
      step: {
        ledger: relative(STEP_LEDGER),
        runtimeCatalog: relative(STEP_RUNTIME_CATALOG),
        textRevision: stepCatalog.textRevision,
        textSha256: stepCatalog.textSha256
      },
      results
    };
    writeFileSync(
      path.join(OUTPUT_ROOT, "report.json"),
      `${JSON.stringify(report, null, 2)}\n`
    );
  } catch (error) {
    await rm(OUTPUT_ROOT, { recursive: true, force: true });
    throw error;
  }

  console.log(
    JSON.stringify(
      {
        outputRoot: relative(OUTPUT_ROOT),
        results
      },
      null,
      2
    )
  );
}

function buildPilot(
  pilot: PilotDefinition,
  stepIndex: Map<string, StepToken[]>,
  stepCatalog: { textRevision: string; textSha256: string }
): PilotMetrics {
  const pilotRoot = path.join(OUTPUT_ROOT, pilot.id);
  mkdirSyncSafe(pilotRoot);
  const outputSqlite = path.join(
    pilotRoot,
    `bible-${pilot.id}-strong-reverse.sqlite`
  );
  materializeSqlite(pilot, outputSqlite);
  const inputSqliteBytes = statSync(outputSqlite).size;
  const canonical = readZipJson<CanonicalPublication>(
    pilot.canonicalZipPath,
    pilot.canonicalEntry
  );
  const database = new DatabaseSync(outputSqlite);
  const sourceStrongById = new Map<string, Set<string>>();
  for (const alignment of pilot.alignments) {
    for (const [id, values] of readSourceStrongTsv(
      alignment.sourceTsv,
      alignment.corpus === "TAHOT" ? "H" : "G"
    )) {
      sourceStrongById.set(id, values);
    }
  }

  const wordSpansByRef = loadWordSpans(database);
  const verseIds = loadVerseIds(database);
  const targetTokens = new Map<string, TargetToken>();
  for (const alignment of pilot.alignments) {
    if (!alignment.targetTsv) continue;
    const located = locateTargetTsvTokens(
      alignment.targetTsv,
      canonical,
      alignment.mappingMethod,
      wordSpansByRef
    );
    for (const [id, token] of located) targetTokens.set(id, token);
  }
  for (const alignment of pilot.alignments) {
    if (alignment.mappingMethod !== "manual-strong-order") continue;
    const document = readAlignment(alignment.path);
    const derived = deriveTargetsByStrongOrder(
      document.records,
      canonical,
      wordSpansByRef,
      sourceStrongById
    );
    for (const [id, token] of derived) targetTokens.set(id, token);
  }

  createReverseSchema(database);
  const insertGroup = database.prepare(`
    INSERT INTO ReverseInterlinearGroups(
      id, alignmentOrder, sourceCorpus, sourceName, mappingMethod, status
    ) VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertSource = database.prepare(`
    INSERT INTO ReverseInterlinearSources(
      groupId, sourceOrder, stepTokenId, mappingStatus
    ) VALUES (?, ?, ?, ?)
  `);
  const insertTarget = database.prepare(`
    INSERT INTO ReverseInterlinearTargets(
      groupId, targetOrder, verseId, targetOrdinal,
      startOffset, length, wordOrdinal, mappingStatus
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let alignmentGroupCount = 0;
  let fullyResolvedGroupCount = 0;
  let partiallyResolvedGroupCount = 0;
  let unresolvedGroupCount = 0;
  let rawSourceMemberCount = 0;
  let storedSourceLinkCount = 0;
  let mappedSourceMemberCount = 0;
  let ambiguousSourceMemberCount = 0;
  let unmappedSourceMemberCount = 0;
  let rawTargetMemberCount = 0;
  let globalOrder = 0;
  const distinctRawSources = new Set<string>();
  const distinctStepTokens = new Set<string>();
  const distinctRawTargets = new Set<string>();
  const locatedRawTargets = new Set<string>();
  const targetWithWordSpan = new Set<string>();
  const methods = emptyMethodMetrics();

  database.exec("BEGIN IMMEDIATE");
  try {
    for (const alignment of pilot.alignments) {
      const document = readAlignment(alignment.path);
      for (const record of document.records) {
        globalOrder += 1;
        alignmentGroupCount += 1;
        const sourceRows = record.source.map((rawSourceId, sourceOrder) => {
          rawSourceMemberCount += 1;
          methods[alignment.mappingMethod].sourceMembers += 1;
          distinctRawSources.add(`${alignment.sourceName}:${rawSourceId}`);
          const source = parseSourceId(rawSourceId, alignment.sourceName);
          const candidates = source
            ? (stepIndex.get(
                `${alignment.corpus}\u0000${source.ref}\u0000${source.ordinal}`
              ) ?? [])
            : [];
          const matches = resolveStepMatches(
            candidates,
            sourceStrongById.get(rawSourceId) ?? new Set()
          );
          if (matches.length === 1) {
            mappedSourceMemberCount += 1;
            methods[alignment.mappingMethod].mappedSourceMembers += 1;
            distinctStepTokens.add(matches[0]!.id);
          } else if (matches.length > 1) {
            ambiguousSourceMemberCount += 1;
          } else {
            unmappedSourceMemberCount += 1;
          }
          return {
            sourceOrder,
            rawSourceId,
            source,
            matches
          };
        });
        const targetRows = record.target.map((rawTargetId, targetOrder) => {
          rawTargetMemberCount += 1;
          methods[alignment.mappingMethod].targetMembers += 1;
          distinctRawTargets.add(rawTargetId);
          const token = targetTokens.get(rawTargetId);
          if (token?.startOffset != null && token.length != null) {
            methods[alignment.mappingMethod].locatedTargetMembers += 1;
            locatedRawTargets.add(rawTargetId);
            if (token.wordOrdinal != null) targetWithWordSpan.add(rawTargetId);
          }
          return { targetOrder, rawTargetId, token };
        });
        methods[alignment.mappingMethod].groups += 1;

        const resolvedSources = sourceRows.filter(
          (row) => row.matches.length === 1
        ).length;
        const resolvedTargets = targetRows.filter(
          (row) =>
            row.token?.startOffset != null && row.token.length != null
        ).length;
        const fullyResolved =
          sourceRows.length > 0 &&
          targetRows.length > 0 &&
          resolvedSources === sourceRows.length &&
          resolvedTargets === targetRows.length;
        const partiallyResolved =
          !fullyResolved && (resolvedSources > 0 || resolvedTargets > 0);
        const status = fullyResolved
          ? "resolved"
          : partiallyResolved
            ? "partial"
            : "unresolved";
        if (fullyResolved) fullyResolvedGroupCount += 1;
        else if (partiallyResolved) partiallyResolvedGroupCount += 1;
        else unresolvedGroupCount += 1;

        insertGroup.run(
          globalOrder,
          globalOrder,
          alignment.corpus === "TAHOT" ? 0 : 1,
          alignment.sourceName === "WLCM" ? 0 : 1,
          alignment.mappingMethod === "manual-target-tsv" ? 0 : 1,
          status === "resolved" ? 0 : status === "partial" ? 1 : 2
        );
        const insertedSourceRows = deduplicatePhysicalSources(sourceRows);
        storedSourceLinkCount += insertedSourceRows.length;
        for (const [sourceOrder, row] of insertedSourceRows.entries()) {
          insertSource.run(
            globalOrder,
            sourceOrder,
            row.matches.length === 1 ? row.matches[0]!.runtimeId : null,
            row.matches.length === 1 ? 0 : row.matches.length > 1 ? 1 : 2
          );
        }
        for (const row of targetRows) {
          const location =
            row.token?.location ?? parseTargetId(row.rawTargetId);
          const verseId = location
            ? (verseIds.get(location.ref) ?? null)
            : null;
          insertTarget.run(
            globalOrder,
            row.targetOrder,
            verseId,
            location?.ordinal ?? -1,
            row.token?.startOffset ?? null,
            row.token?.length ?? null,
            row.token?.wordOrdinal ?? null,
            row.token?.startOffset != null && row.token.length != null ? 0 : 1
          );
        }
      }
    }
    writeReverseMetadata(database, {
      reverseInterlinearSchemaVersion: 1,
      reverseInterlinearBuilderVersion: "reverse-interlinear-pilot@1",
      reverseInterlinearStepRevision: stepCatalog.textRevision,
      reverseInterlinearStepSha256: stepCatalog.textSha256,
      reverseInterlinearCanonicalTextRevision: canonical.textRevision,
      reverseInterlinearCanonicalTextSha256: canonical.textSha256,
      reverseInterlinearAlignmentSources: JSON.stringify(
        pilot.alignments.map((alignment) => ({
          corpus: alignment.corpus,
          sourceName: alignment.sourceName,
          alignmentFile: relative(alignment.path),
          alignmentSha256: sha256File(alignment.path),
          sourceTsv: relative(alignment.sourceTsv),
          sourceTsvSha256: sha256File(alignment.sourceTsv),
          targetTsv: alignment.targetTsv
            ? relative(alignment.targetTsv)
            : null,
          targetTsvSha256: alignment.targetTsv
            ? sha256File(alignment.targetTsv)
            : null,
          mappingMethod: alignment.mappingMethod
        }))
      ),
      reverseInterlinearGroupCount: alignmentGroupCount,
      reverseInterlinearSourceMemberCount: rawSourceMemberCount,
      reverseInterlinearStoredSourceLinkCount: storedSourceLinkCount,
      reverseInterlinearTargetMemberCount: rawTargetMemberCount
    });
    database.exec("COMMIT");
    database.exec("ANALYZE");
    database.exec("VACUUM");
  } catch (error) {
    database.exec("ROLLBACK");
    database.close();
    throw error;
  }
  const integrityCheck = String(
    (
      database.prepare("PRAGMA integrity_check").get() as {
        integrity_check: string;
      }
    ).integrity_check
  );
  database.close();

  const outputZip = `${outputSqlite}.zip`;
  execFileSync("zip", ["-X", "-9", "-q", outputZip, path.basename(outputSqlite)], {
    cwd: pilotRoot
  });
  const outputSqliteBytes = statSync(outputSqlite).size;
  const outputZipBytes = statSync(outputZip).size;

  return {
    id: pilot.id,
    applicationVersionId: pilot.applicationVersionId,
    inputSqliteBytes,
    outputSqliteBytes,
    outputZipBytes,
    addedSqliteBytes: outputSqliteBytes - inputSqliteBytes,
    addedSqlitePercent: ratioPercent(
      outputSqliteBytes - inputSqliteBytes,
      inputSqliteBytes
    ),
    integrityCheck,
    stepRevision: stepCatalog.textRevision,
    alignmentGroupCount,
    fullyResolvedGroupCount,
    partiallyResolvedGroupCount,
    unresolvedGroupCount,
    rawSourceMemberCount,
    storedSourceLinkCount,
    distinctSourceMemberCount: distinctRawSources.size,
    mappedSourceMemberCount,
    ambiguousSourceMemberCount,
    unmappedSourceMemberCount,
    distinctStepTokenCount: distinctStepTokens.size,
    rawTargetMemberCount,
    distinctTargetTokenCount: distinctRawTargets.size,
    locatedTargetTokenCount: locatedRawTargets.size,
    unresolvedTargetTokenCount:
      distinctRawTargets.size - locatedRawTargets.size,
    targetTokenWithWordSpanCount: targetWithWordSpan.size,
    sourceMappingRate: ratio(mappedSourceMemberCount, rawSourceMemberCount),
    targetLocationRate: ratio(locatedRawTargets.size, distinctRawTargets.size),
    fullyResolvedGroupRate: ratio(
      fullyResolvedGroupCount,
      alignmentGroupCount
    ),
    methods,
    artifacts: {
      sqlite: relative(outputSqlite),
      sqliteSha256: sha256File(outputSqlite),
      zip: relative(outputZip),
      zipSha256: sha256File(outputZip)
    }
  };
}

function createReverseSchema(database: DatabaseSync): void {
  database.exec(`
    CREATE TABLE ReverseInterlinearGroups (
      id INTEGER PRIMARY KEY,
      alignmentOrder INTEGER NOT NULL,
      sourceCorpus INTEGER NOT NULL CHECK(sourceCorpus IN (0,1)),
      sourceName INTEGER NOT NULL CHECK(sourceName IN (0,1)),
      mappingMethod INTEGER NOT NULL CHECK(mappingMethod IN (0,1)),
      status INTEGER NOT NULL CHECK(status IN (0,1,2))
    );

    CREATE TABLE ReverseInterlinearSources (
      groupId INTEGER NOT NULL REFERENCES ReverseInterlinearGroups(id)
        ON DELETE CASCADE,
      sourceOrder INTEGER NOT NULL,
      stepTokenId INTEGER,
      mappingStatus INTEGER NOT NULL CHECK(mappingStatus IN (0,1,2)),
      PRIMARY KEY(groupId, sourceOrder)
    ) WITHOUT ROWID;

    CREATE TABLE ReverseInterlinearTargets (
      groupId INTEGER NOT NULL REFERENCES ReverseInterlinearGroups(id)
        ON DELETE CASCADE,
      targetOrder INTEGER NOT NULL,
      verseId INTEGER REFERENCES Verses(id),
      targetOrdinal INTEGER NOT NULL,
      startOffset INTEGER,
      length INTEGER,
      wordOrdinal INTEGER,
      mappingStatus INTEGER NOT NULL CHECK(mappingStatus IN (0,1)),
      PRIMARY KEY(groupId, targetOrder),
      FOREIGN KEY(verseId, wordOrdinal)
        REFERENCES WordSpans(verseId, ordinal)
    ) WITHOUT ROWID;

    CREATE INDEX idx_ReverseInterlinearSources_step
      ON ReverseInterlinearSources(stepTokenId, groupId);
    CREATE INDEX idx_ReverseInterlinearTargets_location
      ON ReverseInterlinearTargets(
        verseId, startOffset, targetOrdinal, groupId
      );
    CREATE INDEX idx_ReverseInterlinearGroups_order
      ON ReverseInterlinearGroups(alignmentOrder);
  `);
}

function loadStepTokenIndex(
  databasePath: string
): Map<string, StepToken[]> {
  const runtimeIds = loadRuntimeTokenIds(STEP_RUNTIME);
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const rows = database
      .prepare(
        `SELECT t.id, t.source AS corpus, t.sourceRef, t.alternateRefs,
                t.tokenIndex, t.tokenType, v.ref AS canonicalRef,
                t.readingOrdinal,
                group_concat(DISTINCT CASE WHEN c.kind=0 THEN c.code END)
                  AS strongCodes
           FROM Tokens t
           JOIN Verses v ON v.id=t.verseId
           LEFT JOIN SegmentStrongCodes sc ON sc.tokenId=t.id
           LEFT JOIN StrongCodes c ON c.id=sc.codeId
          WHERE t.isCanonical=1
          GROUP BY t.id`
      )
      .all() as unknown as Array<
      StepToken & {
        alternateRefs: string;
        strongCodes: string | null;
        canonicalRef: string;
        readingOrdinal: number;
      }
    >;
    const index = new Map<string, StepToken[]>();
    for (const row of rows) {
      const token: StepToken = {
        id: row.id,
        runtimeId:
          runtimeIds.get(`${row.canonicalRef}\u0000${row.readingOrdinal}`) ??
          0,
        corpus: row.corpus,
        sourceRef: row.sourceRef,
        tokenIndex: row.tokenIndex,
        tokenType: row.tokenType,
        strong: new Set(
          (row.strongCodes ?? "")
            .split(",")
            .map(normalizeStrong)
            .filter(Boolean)
        )
      };
      if (!token.runtimeId) {
        throw new Error(`step-runtime-token-missing:${row.id}`);
      }
      const refs = [
        row.sourceRef,
        ...parseStringArray(row.alternateRefs)
      ];
      for (const ref of refs) {
        const key = `${row.corpus}\u0000${ref}\u0000${row.tokenIndex}`;
        const values = index.get(key) ?? [];
        if (!values.some((value) => value.id === token.id)) values.push(token);
        index.set(key, values);
      }
    }
    return index;
  } finally {
    database.close();
  }
}

function loadRuntimeTokenIds(databasePath: string): Map<string, number> {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    return new Map(
      (
        database
          .prepare(
            `SELECT t.id, v.ref, t.readingOrdinal
               FROM Tokens t
               JOIN Verses v ON v.id=t.verseId`
          )
          .all() as Array<{
          id: number;
          ref: string;
          readingOrdinal: number;
        }>
      ).map((row) => [
        `${row.ref}\u0000${row.readingOrdinal}`,
        row.id
      ])
    );
  } finally {
    database.close();
  }
}

function locateTargetTsvTokens(
  tsvPath: string,
  canonical: CanonicalPublication,
  mappingMethod: MappingMethod,
  wordSpansByRef: Map<string, WordSpan[]>
): Map<string, TargetToken> {
  const rows = readTsv(tsvPath);
  const grouped = new Map<string, Array<{ id: string; text: string }>>();
  for (const row of rows) {
    const location = parseTargetId(row.id ?? "");
    if (!location) continue;
    const values = grouped.get(location.ref) ?? [];
    values.push({ id: row.id!, text: row.text ?? "" });
    grouped.set(location.ref, values);
  }
  const result = new Map<string, TargetToken>();
  for (const [ref, tokens] of grouped) {
    const location = parseTargetId(tokens[0]!.id)!;
    const text = canonicalText(canonical, location);
    let cursor = 0;
    for (const item of tokens.sort(
      (left, right) =>
        parseTargetId(left.id)!.ordinal - parseTargetId(right.id)!.ordinal
    )) {
      const tokenLocation = parseTargetId(item.id)!;
      const match = locateSurface(text, item.text, cursor);
      if (match) cursor = match.startOffset + match.length;
      const wordOrdinal = match
        ? overlappingWordOrdinal(
            wordSpansByRef.get(ref) ?? [],
            match.startOffset,
            match.length
          )
        : null;
      result.set(item.id, {
        id: item.id,
        location: tokenLocation,
        surface: match
          ? text.slice(match.startOffset, match.startOffset + match.length)
          : item.text,
        startOffset: match?.startOffset ?? null,
        length: match?.length ?? null,
        mappingMethod,
        wordOrdinal
      });
    }
  }
  return result;
}

function deriveTargetsByStrongOrder(
  records: AlignmentRecord[],
  canonical: CanonicalPublication,
  wordSpansByRef: Map<string, WordSpan[]>,
  sourceStrongById: Map<string, Set<string>>
): Map<string, TargetToken> {
  const targetStrong = new Map<string, Set<string>>();
  for (const record of records) {
    const strongs = new Set(
      record.source.flatMap((id) => [
        ...(sourceStrongById.get(id) ?? [])
      ])
    );
    for (const targetId of record.target) {
      const existing = targetStrong.get(targetId) ?? new Set<string>();
      for (const strong of strongs) existing.add(normalizeStrong(strong));
      targetStrong.set(targetId, existing);
    }
  }

  const byRef = new Map<string, string[]>();
  for (const targetId of targetStrong.keys()) {
    const location = parseTargetId(targetId);
    if (!location) continue;
    const values = byRef.get(location.ref) ?? [];
    values.push(targetId);
    byRef.set(location.ref, values);
  }

  const result = new Map<string, TargetToken>();
  for (const [ref, targetIds] of byRef) {
    const spans = wordSpansByRef.get(ref) ?? [];
    const usedOrdinals = new Set<number>();
    let previousOrdinal = -1;
    for (const targetId of targetIds.sort(
      (left, right) =>
        parseTargetId(left)!.ordinal - parseTargetId(right)!.ordinal
    )) {
      const location = parseTargetId(targetId)!;
      const desired = targetStrong.get(targetId) ?? new Set<string>();
      const candidates = spans.filter(
        (span) =>
          !usedOrdinals.has(span.ordinal) &&
          [...span.strong].some((strong) => desired.has(normalizeStrong(strong)))
      );
      const selected =
        candidates.find((span) => span.ordinal > previousOrdinal) ??
        candidates[0];
      if (selected) {
        usedOrdinals.add(selected.ordinal);
        previousOrdinal = Math.max(previousOrdinal, selected.ordinal);
      }
      const text = canonicalText(canonical, location);
      result.set(targetId, {
        id: targetId,
        location,
        surface: selected
          ? text.slice(
              selected.startOffset,
              selected.startOffset + selected.length
            )
          : "",
        startOffset: selected?.startOffset ?? null,
        length: selected?.length ?? null,
        mappingMethod: "manual-strong-order",
        wordOrdinal: selected?.ordinal ?? null
      });
    }
  }
  return result;
}

function loadWordSpans(database: DatabaseSync): Map<string, WordSpan[]> {
  const rows = database
    .prepare(
      `SELECT v.bookOrder, v.chapter, v.verse,
              w.ordinal, w.startOffset, w.length, c.code
         FROM Verses v
         JOIN WordSpans w ON w.verseId=v.id
         LEFT JOIN WordStrongCodes x
           ON x.verseId=w.verseId AND x.ordinal=w.ordinal
         LEFT JOIN StrongCodes c ON c.id=x.codeId AND c.kind=0
        ORDER BY v.bookOrder, v.chapter, v.verse,
                 w.ordinal, x.identityOrder`
    )
    .all() as unknown as Array<{
    bookOrder: number;
    chapter: number;
    verse: number;
    ordinal: number;
    startOffset: number;
    length: number;
    code: string | null;
  }>;
  const result = new Map<string, WordSpan[]>();
  const spanIndex = new Map<string, WordSpan>();
  for (const row of rows) {
    const ref = refFromNumbers(row.bookOrder, row.chapter, row.verse);
    const key = `${ref}\u0000${row.ordinal}`;
    let span = spanIndex.get(key);
    if (!span) {
      span = {
        ordinal: row.ordinal,
        startOffset: row.startOffset,
        length: row.length,
        strong: new Set()
      };
      spanIndex.set(key, span);
      const values = result.get(ref) ?? [];
      values.push(span);
      result.set(ref, values);
    }
    if (row.code) span.strong.add(normalizeStrong(row.code));
  }
  return result;
}

function loadVerseIds(database: DatabaseSync): Map<string, number> {
  return new Map(
    (
      database
        .prepare(
          `SELECT id, bookOrder, chapter, verse
             FROM Verses`
        )
        .all() as Array<{
        id: number;
        bookOrder: number;
        chapter: number;
        verse: number;
      }>
    ).map((row) => [
      refFromNumbers(row.bookOrder, row.chapter, row.verse),
      row.id
    ])
  );
}

function parseSourceId(
  id: string,
  sourceName: "WLCM" | "SBLGNT"
): EncodedLocation | null {
  const digits = id.slice(1);
  if (!/^\d+$/u.test(digits)) return null;
  if (sourceName === "WLCM" && digits.length === 12) {
    return encodedLocation(
      digits.slice(0, 2),
      digits.slice(2, 5),
      digits.slice(5, 8),
      digits.slice(8, 11)
    );
  }
  if (sourceName === "SBLGNT" && digits.length === 11) {
    return encodedLocation(
      digits.slice(0, 2),
      digits.slice(2, 5),
      digits.slice(5, 8),
      digits.slice(8, 11)
    );
  }
  return null;
}

function parseTargetId(id: string): EncodedLocation | null {
  if (!/^\d{11}$/u.test(id)) return null;
  return encodedLocation(
    id.slice(0, 2),
    id.slice(2, 5),
    id.slice(5, 8),
    id.slice(8, 11)
  );
}

function encodedLocation(
  bookText: string,
  chapterText: string,
  verseText: string,
  ordinalText: string
): EncodedLocation | null {
  const book = Number(bookText);
  const chapter = Number(chapterText);
  const verse = Number(verseText);
  const ordinal = Number(ordinalText);
  const bookId = BOOK_IDS[book - 1];
  if (!bookId || !chapter || !verse || !ordinal) return null;
  return {
    book,
    chapter,
    verse,
    ordinal,
    ref: `${bookId}.${chapter}.${verse}`
  };
}

function locateSurface(
  text: string,
  surface: string,
  cursor: number
): { startOffset: number; length: number } | null {
  if (!surface) return null;
  const variants = unique([
    surface,
    surface.replaceAll("'", "’"),
    surface.replaceAll("’", "'"),
    surface.replaceAll("--", "—"),
    surface.replaceAll("–", "-"),
    surface.replaceAll("—", "-")
  ]);
  let best: { startOffset: number; length: number } | null = null;
  for (const variant of variants) {
    const index = text.indexOf(variant, cursor);
    if (index < 0 || index - cursor > 160) continue;
    if (!best || index < best.startOffset) {
      best = { startOffset: index, length: variant.length };
    }
  }
  return best;
}

function overlappingWordOrdinal(
  spans: WordSpan[],
  startOffset: number,
  length: number
): number | null {
  const endOffset = startOffset + length;
  const match = spans.find((span) => {
    const spanEnd = span.startOffset + span.length;
    return (
      (length === 0 && span.startOffset === startOffset) ||
      (span.length > 0 &&
        Math.max(startOffset, span.startOffset) <
          Math.min(endOffset, spanEnd))
    );
  });
  return match?.ordinal ?? null;
}

function canonicalText(
  canonical: CanonicalPublication,
  location: Pick<EncodedLocation, "book" | "chapter" | "verse">
): string {
  return (
    canonical.verses[String(location.book)]?.[String(location.chapter)]?.[
      String(location.verse)
    ]?.text ?? ""
  );
}

function readAlignment(filePath: string): AlignmentDocument {
  return JSON.parse(readFileSync(filePath, "utf8")) as AlignmentDocument;
}

function readSourceStrongTsv(
  filePath: string,
  prefix: "H" | "G"
): Map<string, Set<string>> {
  return new Map(
    readTsv(filePath).map((row) => [
      row.id ?? "",
      new Set(
        (row.strongs ?? "")
          .split(/[ ,;]+/u)
          .map((value) =>
            normalizeStrong(/^[HG]/iu.test(value) ? value : `${prefix}${value}`)
          )
          .filter(Boolean)
      )
    ])
  );
}

function resolveStepMatches(
  candidates: StepToken[],
  desiredStrong: Set<string>
): StepToken[] {
  if (candidates.length <= 1 || desiredStrong.size === 0) return candidates;
  const matching = candidates.filter((candidate) =>
    [...candidate.strong].some((strong) => desiredStrong.has(strong))
  );
  return matching.length > 0 ? matching : candidates;
}

function deduplicatePhysicalSources<T extends {
  rawSourceId: string;
  matches: StepToken[];
}>(rows: T[]): T[] {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key =
      row.matches.length === 1
        ? `step:${row.matches[0]!.runtimeId}`
        : `raw:${row.rawSourceId}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function readTsv(filePath: string): Array<Record<string, string>> {
  const lines = readFileSync(filePath, "utf8")
    .split(/\r?\n/u)
    .filter((line) => line.length > 0);
  const headers = (lines.shift() ?? "").split("\t");
  return lines.map((line) =>
    Object.fromEntries(
      line
        .split("\t")
        .map((value, index) => [headers[index] ?? String(index), value])
    )
  );
}

function readZipJson<T>(zipPath: string, entry: string): T {
  const output = execFileSync("unzip", ["-p", zipPath, entry], {
    encoding: "utf8",
    maxBuffer: 96 * 1024 * 1024
  });
  return JSON.parse(output) as T;
}

function materializeSqlite(
  pilot: PilotDefinition,
  destination: string
): void {
  if (pilot.sqlitePath) {
    copyFileSync(pilot.sqlitePath, destination);
    return;
  }
  if (!pilot.sqliteZipPath) throw new Error(`pilot-sqlite-missing:${pilot.id}`);
  const temporary = mkdtempSync(
    path.join(tmpdir(), `reverse-interlinear-${pilot.id}-`)
  );
  try {
    execFileSync("unzip", ["-j", "-q", pilot.sqliteZipPath, "-d", temporary]);
    const entry = path.join(
      temporary,
      `bible-${pilot.id}-strong.sqlite`
    );
    copyFileSync(entry, destination);
  } finally {
    execFileSync("rm", ["-r", temporary]);
  }
}

function writeReverseMetadata(
  database: DatabaseSync,
  values: Record<string, string | number>
): void {
  const insert = database.prepare(
    `INSERT OR REPLACE INTO ResourceMetadata(key, value) VALUES (?, ?)`
  );
  for (const [key, value] of Object.entries(values)) {
    insert.run(key, String(value));
  }
}

function normalizeStrong(value: string): string {
  const match = value.toUpperCase().match(/^([HG])?0*(\d+)/u);
  if (!match) return value.toUpperCase();
  return `${match[1] ?? ""}${Number(match[2])}`;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === "string")
      : [];
  } catch {
    return [];
  }
}

function refFromNumbers(
  book: number,
  chapter: number,
  verse: number
): string {
  const bookId = BOOK_IDS[book - 1];
  if (!bookId) throw new Error(`invalid-book-order:${book}`);
  return `${bookId}.${chapter}.${verse}`;
}

function sha256File(filePath: string): string {
  return createHash("sha256").update(readFileSync(filePath)).digest("hex");
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number((numerator / denominator).toFixed(6));
}

function ratioPercent(numerator: number, denominator: number): number {
  return Number((ratio(numerator, denominator) * 100).toFixed(2));
}

function relative(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

function emptyMethodMetrics(): PilotMetrics["methods"] {
  return {
    "manual-target-tsv": {
      groups: 0,
      sourceMembers: 0,
      mappedSourceMembers: 0,
      targetMembers: 0,
      locatedTargetMembers: 0
    },
    "manual-strong-order": {
      groups: 0,
      sourceMembers: 0,
      mappedSourceMembers: 0,
      targetMembers: 0,
      locatedTargetMembers: 0
    }
  };
}

function mkdirSyncSafe(directory: string): void {
  execFileSync("mkdir", ["-p", directory]);
}

function assertInputs(): void {
  for (const filePath of [STEP_LEDGER, STEP_RUNTIME_CATALOG, STEP_RUNTIME]) {
    if (!existsSync(filePath)) throw new Error(`pilot-input-missing:${filePath}`);
  }
  for (const pilot of PILOTS) {
    for (const filePath of [
      pilot.sqlitePath,
      pilot.sqliteZipPath,
      pilot.canonicalZipPath,
      ...pilot.alignments.flatMap((alignment) => [
        alignment.path,
        alignment.sourceTsv,
        alignment.targetTsv
      ])
    ].filter((value): value is string => Boolean(value))) {
      if (!existsSync(filePath)) {
        throw new Error(`pilot-input-missing:${filePath}`);
      }
    }
  }
}

void main();
