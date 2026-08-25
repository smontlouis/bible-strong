import { createHash, randomUUID } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createInterface } from "node:readline";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";

import { normalizeWord } from "./tokenize.js";
import type { StrongIdentityKind } from "./strongBibleSqlite.js";

export const FRENCH_LEMMA_PILOT_VERSION =
  "french-lemma-kaikki-strong-context@2";
export const DEFAULT_LSG_LEMMA_PILOT_OUTPUT =
  "outputs/pilots/french-lemmas-lsg/bible-lsg-strong-lemmas.sqlite";
export const DEFAULT_LSG_LEMMA_PILOT_REPORT =
  "outputs/pilots/french-lemmas-lsg/report.json";
export const DEFAULT_KAIKKI_FRENCH_JSONL =
  "data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl";

type LemmaMethod = 0 | 1 | 2 | 3 | 4;

interface SpanRow {
  verseId: number;
  ordinal: number;
  surface: string;
  normalized: string;
  preferredCodeIds: number[];
}

interface LemmaCandidate {
  lemma: string;
  partOfSpeech: string;
}

interface LemmaDecision {
  candidate?: LemmaCandidate;
  method: LemmaMethod;
}

interface KaikkiEntry {
  word?: unknown;
  lang_code?: unknown;
  pos?: unknown;
  senses?: Array<{
    form_of?: Array<{ word?: unknown }>;
  }>;
}

export interface FrenchLemmaPilotReport {
  format: "french-lemma-pilot-report";
  version: string;
  generatedAt: string;
  sourceDatabase: string;
  sourceDatabaseSha256: string;
  kaikkiSource: string;
  kaikkiSourceSha256: string;
  outputDatabase: string;
  outputDatabaseSha256: string;
  sourceBytes: number;
  outputBytes: number;
  addedBytes: number;
  spanCount: number;
  emptySpanCount: number;
  nonEmptySpanCount: number;
  distinctNormalizedForms: number;
  dictionaryCoveredForms: number;
  dictionaryCoveragePercent: number;
  resolvedUniqueCount: number;
  resolvedStrongContextCount: number;
  unresolvedAmbiguousCount: number;
  unavailableCount: number;
  resolvedCount: number;
  resolvedPercent: number;
  lexemeCount: number;
  integrityCheck: "ok";
  topLemmas: Array<{
    lemma: string;
    partOfSpeech: string;
    occurrences: number;
  }>;
}

export interface FrenchLemmaStats {
  matchedCode: string;
  matchedKind: StrongIdentityKind;
  total: number;
  resolved: number;
  unresolvedAmbiguous: number;
  unavailable: number;
  lemmas: Array<{
    lemma: string;
    partOfSpeech: string;
    occurrences: number;
  }>;
}

export interface FrenchLemmaDatabaseEnrichment {
  datasetId: string;
  database: string;
  spanCount: number;
  distinctNormalizedForms: number;
  dictionaryCoveredForms: number;
  dictionaryCoveragePercent: number;
  resolvedUniqueCount: number;
  resolvedStrongContextCount: number;
  unresolvedAmbiguousCount: number;
  unavailableCount: number;
  resolvedCount: number;
  resolvedPercent: number;
  lexemeCount: number;
}

export async function enrichFrenchLemmaDatabasesInPlace(options: {
  targets: Array<{ database: string; datasetId: string }>;
  kaikkiJsonl: string;
}): Promise<FrenchLemmaDatabaseEnrichment[]> {
  const kaikkiJsonl = path.resolve(options.kaikkiJsonl);
  if (!existsSync(kaikkiJsonl)) {
    throw new Error(`french-lemma-pilot-source-missing:${kaikkiJsonl}`);
  }
  const targets = options.targets.map((target) => ({
    datasetId: target.datasetId,
    database: path.resolve(target.database)
  }));
  const spansByDatabase = new Map<string, SpanRow[]>();
  const allTargetForms = new Set<string>();
  for (const target of targets) {
    if (!existsSync(target.database)) {
      throw new Error(`french-lemma-pilot-source-missing:${target.database}`);
    }
    const database = new DatabaseSync(target.database);
    try {
      assertCompatibleSource(database, target.datasetId);
      const spans = readSpans(database);
      spansByDatabase.set(target.database, spans);
      for (const span of spans) {
        if (span.normalized) allTargetForms.add(span.normalized);
      }
    } finally {
      database.close();
    }
  }

  const candidates = await readTargetKaikkiCandidates(
    kaikkiJsonl,
    allTargetForms
  );
  return targets.map((target) => {
    const spans = spansByDatabase.get(target.database)!;
    const decisions = resolveLemmaDecisions(spans, candidates);
    const counts = applyLemmaDecisions(target.database, spans, decisions);
    const targetForms = new Set(
      spans.map(({ normalized }) => normalized).filter(Boolean)
    );
    const nonEmptySpanCount = spans.filter(({ normalized }) =>
      Boolean(normalized)
    ).length;
    const dictionaryCoveredForms = [...targetForms].filter(
      (form) => (candidates.get(form)?.length ?? 0) > 0
    ).length;
    const resolvedCount =
      counts.resolvedUniqueCount + counts.resolvedStrongContextCount;
    verifyPilotDatabase(target.database, spans.length);
    return {
      datasetId: target.datasetId,
      database: target.database,
      spanCount: spans.length,
      distinctNormalizedForms: targetForms.size,
      dictionaryCoveredForms,
      dictionaryCoveragePercent: percent(
        dictionaryCoveredForms,
        targetForms.size
      ),
      ...counts,
      resolvedCount,
      resolvedPercent: percent(resolvedCount, nonEmptySpanCount)
    };
  });
}

export function getFrenchLemmaDatasetVersion(sqlitePath: string): string {
  const database = new DatabaseSync(path.resolve(sqlitePath), {
    readOnly: true
  });
  try {
    const row = database
      .prepare("SELECT value FROM FrenchLemmaMetadata WHERE key='version'")
      .get() as { value: string } | undefined;
    if (!row?.value) throw new Error("french-lemma-version-missing");
    return row.value;
  } finally {
    database.close();
  }
}

export function queryFrenchLemmaStats(options: {
  sqlitePath: string;
  kind: StrongIdentityKind;
  code: string;
}): FrenchLemmaStats {
  const database = new DatabaseSync(path.resolve(options.sqlitePath), {
    readOnly: true
  });
  try {
    const codeRow = database
      .prepare("SELECT id FROM StrongCodes WHERE kind=? AND code=?")
      .get(strongIdentityKindCode(options.kind), options.code) as
      | { id: number }
      | undefined;
    if (!codeRow) {
      return {
        matchedCode: options.code,
        matchedKind: options.kind,
        total: 0,
        resolved: 0,
        unresolvedAmbiguous: 0,
        unavailable: 0,
        lemmas: []
      };
    }
    const counts = database
      .prepare(
        `
        SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN o.lexemeId IS NOT NULL THEN 1 ELSE 0 END) AS resolved,
          SUM(CASE WHEN o.lemmaMethod=3 THEN 1 ELSE 0 END) AS unresolvedAmbiguous,
          SUM(CASE WHEN o.lemmaMethod=4 THEN 1 ELSE 0 END) AS unavailable
        FROM WordStrongCodes w
        JOIN WordSpans o ON o.verseId=w.verseId AND o.ordinal=w.ordinal
        WHERE w.codeId=?
      `
      )
      .get(codeRow.id) as {
      total: number;
      resolved: number;
      unresolvedAmbiguous: number;
      unavailable: number;
    };
    const lemmas = (
      database
        .prepare(
          `
        SELECT l.lemma, l.partOfSpeech, COUNT(*) AS occurrences
        FROM WordStrongCodes w
        JOIN WordSpans o ON o.verseId=w.verseId AND o.ordinal=w.ordinal
        JOIN FrenchLexemes l ON l.id=o.lexemeId
        WHERE w.codeId=?
        GROUP BY l.id
        ORDER BY occurrences DESC, l.lemma, l.partOfSpeech
      `
        )
        .all(codeRow.id) as FrenchLemmaStats["lemmas"]
    ).map((lemma) => ({ ...lemma }));
    return {
      matchedCode: options.code,
      matchedKind: options.kind,
      total: Number(counts.total),
      resolved: Number(counts.resolved),
      unresolvedAmbiguous: Number(counts.unresolvedAmbiguous),
      unavailable: Number(counts.unavailable),
      lemmas
    };
  } finally {
    database.close();
  }
}

export async function buildFrenchLemmaPilot(options: {
  sourceDatabase: string;
  kaikkiJsonl: string;
  outputDatabase: string;
  reportPath: string;
}): Promise<FrenchLemmaPilotReport> {
  const sourceDatabase = path.resolve(options.sourceDatabase);
  const kaikkiJsonl = path.resolve(options.kaikkiJsonl);
  const outputDatabase = path.resolve(options.outputDatabase);
  const reportPath = path.resolve(options.reportPath);
  for (const required of [sourceDatabase, kaikkiJsonl]) {
    if (!existsSync(required)) {
      throw new Error(`french-lemma-pilot-source-missing:${required}`);
    }
  }
  if (existsSync(outputDatabase) || existsSync(reportPath)) {
    throw new Error("french-lemma-pilot-output-already-exists");
  }

  const temporaryDatabase = `${outputDatabase}.tmp-${process.pid}-${randomUUID()}`;
  await mkdir(path.dirname(outputDatabase), { recursive: true });
  await copyFile(sourceDatabase, temporaryDatabase);

  try {
    const database = new DatabaseSync(temporaryDatabase);
    let spans: SpanRow[];
    try {
      assertCompatibleSource(database);
      spans = readSpans(database);
    } finally {
      database.close();
    }

    const targetForms = new Set(
      spans.map(({ normalized }) => normalized).filter(Boolean)
    );
    const candidates = await readTargetKaikkiCandidates(
      kaikkiJsonl,
      targetForms
    );
    const decisions = resolveLemmaDecisions(spans, candidates);
    const counts = applyLemmaDecisions(temporaryDatabase, spans, decisions);

    const [sourceStats, outputStats, sourceDatabaseSha256, kaikkiSourceSha256] =
      await Promise.all([
        stat(sourceDatabase),
        stat(temporaryDatabase),
        sha256File(sourceDatabase),
        sha256File(kaikkiJsonl)
      ]);
    const outputDatabaseSha256 = await sha256File(temporaryDatabase);
    const topLemmas = readTopLemmas(temporaryDatabase);
    const integrityCheck = verifyPilotDatabase(temporaryDatabase, spans.length);
    const nonEmptySpanCount = spans.filter(({ normalized }) =>
      Boolean(normalized)
    ).length;
    const dictionaryCoveredForms = [...targetForms].filter(
      (form) => (candidates.get(form)?.length ?? 0) > 0
    ).length;
    const resolvedCount =
      counts.resolvedUniqueCount + counts.resolvedStrongContextCount;
    const report: FrenchLemmaPilotReport = {
      format: "french-lemma-pilot-report",
      version: FRENCH_LEMMA_PILOT_VERSION,
      generatedAt: new Date().toISOString(),
      sourceDatabase,
      sourceDatabaseSha256,
      kaikkiSource: kaikkiJsonl,
      kaikkiSourceSha256,
      outputDatabase,
      outputDatabaseSha256,
      sourceBytes: sourceStats.size,
      outputBytes: outputStats.size,
      addedBytes: outputStats.size - sourceStats.size,
      spanCount: spans.length,
      emptySpanCount: spans.length - nonEmptySpanCount,
      nonEmptySpanCount,
      distinctNormalizedForms: targetForms.size,
      dictionaryCoveredForms,
      dictionaryCoveragePercent: percent(
        dictionaryCoveredForms,
        targetForms.size
      ),
      ...counts,
      resolvedCount,
      resolvedPercent: percent(resolvedCount, nonEmptySpanCount),
      integrityCheck,
      topLemmas
    };

    await rename(temporaryDatabase, outputDatabase);
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    return report;
  } catch (error) {
    await rm(temporaryDatabase, { force: true });
    throw error;
  }
}

function assertCompatibleSource(
  database: DatabaseSync,
  expectedDatasetId?: string
): void {
  const schemaVersion = String(
    (
      database
        .prepare("SELECT value FROM ResourceMetadata WHERE key='schemaVersion'")
        .get() as { value: string }
    ).value
  );
  const datasetId = String(
    (
      database
        .prepare("SELECT value FROM ResourceMetadata WHERE key='datasetId'")
        .get() as { value: string }
    ).value
  );
  if (
    schemaVersion !== "3" ||
    (expectedDatasetId !== undefined && datasetId !== expectedDatasetId)
  ) {
    throw new Error(
      `french-lemma-pilot-incompatible-source:${schemaVersion}:${datasetId}`
    );
  }
  const assigned = Number(
    (
      database
        .prepare(
          "SELECT COUNT(*) AS count FROM WordSpans WHERE lexemeId IS NOT NULL"
        )
        .get() as { count: number }
    ).count
  );
  if (assigned > 0) {
    throw new Error("french-lemma-pilot-source-already-enriched");
  }
}

function readSpans(database: DatabaseSync): SpanRow[] {
  const rows = database
    .prepare(
      `
      SELECT o.verseId, o.ordinal,
             substr(v.canonicalText, o.startOffset + 1, o.length) AS surface,
             group_concat(c.kind || ':' || c.id) AS identityCodes
      FROM WordSpans o
      JOIN Verses v ON v.id=o.verseId
      LEFT JOIN WordStrongCodes w
        ON w.verseId=o.verseId AND w.ordinal=o.ordinal
      LEFT JOIN StrongCodes c ON c.id=w.codeId
      GROUP BY o.verseId, o.ordinal
      ORDER BY o.verseId, o.ordinal
    `
    )
    .all() as Array<{
    verseId: number;
    ordinal: number;
    surface: string;
    identityCodes: string | null;
  }>;
  return rows.map((row) => ({
    verseId: row.verseId,
    ordinal: row.ordinal,
    surface: row.surface,
    normalized: normalizeWord(row.surface),
    preferredCodeIds: preferredCodeIds(row.identityCodes)
  }));
}

function preferredCodeIds(value: string | null): number[] {
  if (!value) return [];
  const identities = value.split(",").flatMap((item) => {
    const [kindValue, idValue] = item.split(":");
    const kind = Number(kindValue);
    const id = Number(idValue);
    return Number.isSafeInteger(kind) && Number.isSafeInteger(id)
      ? [{ kind, id }]
      : [];
  });
  for (const kind of [2, 1, 0]) {
    const ids = identities
      .filter((identity) => identity.kind === kind)
      .map(({ id }) => id);
    if (ids.length > 0) return [...new Set(ids)];
  }
  return [];
}

async function readTargetKaikkiCandidates(
  filePath: string,
  targetForms: Set<string>
): Promise<Map<string, LemmaCandidate[]>> {
  const candidates = new Map<string, Map<string, LemmaCandidate>>();
  let pending = new Set(targetForms);
  for (let pass = 0; pass < 4 && pending.size > 0; pass += 1) {
    await readKaikkiCandidatePass(filePath, pending, candidates);
    const next = new Set<string>();
    for (const form of pending) {
      for (const candidate of candidates.get(form)?.values() ?? []) {
        const candidateForm = normalizeWord(candidate.lemma);
        if (
          candidateForm &&
          candidateForm !== form &&
          !candidates.has(candidateForm)
        ) {
          next.add(candidateForm);
        }
      }
    }
    pending = next;
  }
  return new Map(
    [...targetForms].flatMap((form) => {
      const values = candidates.get(form);
      if (!values) return [];
      const collapsed = [...values.values()].map((candidate) =>
        collapseLemmaCandidate(candidate, candidates)
      );
      return [
        [
          form,
          [
            ...new Map(
              collapsed.map((item) => [candidateKey(item), item])
            ).values()
          ].sort(
            (left, right) =>
              left.lemma.localeCompare(right.lemma, "fr") ||
              left.partOfSpeech.localeCompare(right.partOfSpeech, "en")
          )
        ]
      ];
    })
  );
}

async function readKaikkiCandidatePass(
  filePath: string,
  targetForms: Set<string>,
  candidates: Map<string, Map<string, LemmaCandidate>>
): Promise<void> {
  const lines = createInterface({
    input: createReadStream(filePath, { encoding: "utf8" }),
    crlfDelay: Infinity
  });
  for await (const line of lines) {
    if (!line.trim()) continue;
    let entry: KaikkiEntry;
    try {
      entry = JSON.parse(line) as KaikkiEntry;
    } catch {
      continue;
    }
    if (entry.lang_code !== "fr" || typeof entry.word !== "string") continue;
    const form = normalizeWord(entry.word);
    if (!form || !targetForms.has(form)) continue;
    const partOfSpeech =
      typeof entry.pos === "string" && entry.pos.trim()
        ? entry.pos.trim().toLowerCase()
        : "unknown";
    const formOf = new Set<string>();
    for (const sense of entry.senses ?? []) {
      for (const relation of sense.form_of ?? []) {
        if (typeof relation.word !== "string") continue;
        const lemma = displayLemma(relation.word);
        if (lemma) formOf.add(lemma);
      }
    }
    const lemmas = formOf.size > 0 ? [...formOf] : [displayLemma(entry.word)];
    const formCandidates =
      candidates.get(form) ?? new Map<string, LemmaCandidate>();
    for (const lemma of lemmas) {
      if (!lemma) continue;
      const candidate = { lemma, partOfSpeech };
      formCandidates.set(candidateKey(candidate), candidate);
    }
    candidates.set(form, formCandidates);
  }
}

function collapseLemmaCandidate(
  candidate: LemmaCandidate,
  candidates: Map<string, Map<string, LemmaCandidate>>
): LemmaCandidate {
  let current = candidate;
  const visited = new Set<string>();
  for (let depth = 0; depth < 4; depth += 1) {
    const form = normalizeWord(current.lemma);
    if (!form || visited.has(form)) break;
    visited.add(form);
    const next = [...(candidates.get(form)?.values() ?? [])].filter(
      (item) => item.partOfSpeech === current.partOfSpeech
    );
    if (next.length !== 1 || candidateKey(next[0]!) === candidateKey(current)) {
      break;
    }
    current = next[0]!;
  }
  return current;
}

function resolveLemmaDecisions(
  spans: SpanRow[],
  candidatesByForm: Map<string, LemmaCandidate[]>
): LemmaDecision[] {
  const codeCandidateCounts = new Map<number, Map<string, number>>();
  for (const span of spans) {
    const candidates = candidatesByForm.get(span.normalized) ?? [];
    if (candidates.length !== 1) continue;
    const key = candidateKey(candidates[0]!);
    for (const codeId of span.preferredCodeIds) {
      const counts =
        codeCandidateCounts.get(codeId) ?? new Map<string, number>();
      counts.set(key, (counts.get(key) ?? 0) + 1);
      codeCandidateCounts.set(codeId, counts);
    }
  }

  return spans.map((span) => {
    if (!span.normalized) return { method: 0 };
    const candidates = candidatesByForm.get(span.normalized) ?? [];
    if (candidates.length === 0) return { method: 4 };
    if (candidates.length === 1) {
      return { candidate: candidates[0], method: 1 };
    }
    const ranked = candidates
      .map((candidate) => ({
        candidate,
        score: span.preferredCodeIds.reduce(
          (score, codeId) =>
            score +
            (codeCandidateCounts.get(codeId)?.get(candidateKey(candidate)) ??
              0),
          0
        )
      }))
      .sort(
        (left, right) =>
          right.score - left.score ||
          left.candidate.lemma.localeCompare(right.candidate.lemma, "fr") ||
          left.candidate.partOfSpeech.localeCompare(
            right.candidate.partOfSpeech,
            "en"
          )
      );
    const best = ranked[0]!;
    const secondScore = ranked[1]?.score ?? 0;
    if (
      best.score >= 2 &&
      (secondScore === 0 || best.score >= secondScore * 2)
    ) {
      return { candidate: best.candidate, method: 2 };
    }
    return { method: 3 };
  });
}

function applyLemmaDecisions(
  filePath: string,
  spans: SpanRow[],
  decisions: LemmaDecision[]
): {
  resolvedUniqueCount: number;
  resolvedStrongContextCount: number;
  unresolvedAmbiguousCount: number;
  unavailableCount: number;
  lexemeCount: number;
} {
  const database = new DatabaseSync(filePath);
  const methodCounts = new Map<LemmaMethod, number>();
  const lexemeIds = new Map<string, number>();
  try {
    database.exec(`
      ALTER TABLE WordSpans
        ADD COLUMN lemmaMethod INTEGER NOT NULL DEFAULT 0
        CHECK(lemmaMethod BETWEEN 0 AND 4);
      CREATE TABLE FrenchLemmaMetadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
    `);
    const insertLexeme = database.prepare(
      "INSERT OR IGNORE INTO FrenchLexemes(lemma, partOfSpeech) VALUES (?, ?)"
    );
    const selectLexeme = database.prepare(
      "SELECT id FROM FrenchLexemes WHERE lemma=? AND partOfSpeech=?"
    );
    const updateSpan = database.prepare(`
      UPDATE WordSpans
      SET lexemeId=?, lemmaMethod=?
      WHERE verseId=? AND ordinal=?
    `);
    database.exec("BEGIN IMMEDIATE");
    try {
      for (let index = 0; index < spans.length; index += 1) {
        const span = spans[index]!;
        const decision = decisions[index]!;
        methodCounts.set(
          decision.method,
          (methodCounts.get(decision.method) ?? 0) + 1
        );
        let lexemeId: number | null = null;
        if (decision.candidate) {
          const key = candidateKey(decision.candidate);
          lexemeId = lexemeIds.get(key) ?? null;
          if (lexemeId === null) {
            insertLexeme.run(
              decision.candidate.lemma,
              decision.candidate.partOfSpeech
            );
            lexemeId = Number(
              (
                selectLexeme.get(
                  decision.candidate.lemma,
                  decision.candidate.partOfSpeech
                ) as { id: number }
              ).id
            );
            lexemeIds.set(key, lexemeId);
          }
        }
        if (decision.method !== 0) {
          updateSpan.run(lexemeId, decision.method, span.verseId, span.ordinal);
        }
      }
      const insertMetadata = database.prepare(
        "INSERT INTO FrenchLemmaMetadata(key, value) VALUES (?, ?)"
      );
      for (const [key, value] of Object.entries({
        version: FRENCH_LEMMA_PILOT_VERSION,
        source: "Kaikki French + Strong-context consensus",
        method0: "empty",
        method1: "unique-dictionary-candidate",
        method2: "strong-context-consensus",
        method3: "ambiguous-unresolved",
        method4: "dictionary-unavailable"
      })) {
        insertMetadata.run(key, value);
      }
      const upsertResourceMetadata = database.prepare(`
        INSERT INTO ResourceMetadata(key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value=excluded.value
      `);
      upsertResourceMetadata.run(
        "lexemeAssignmentCount",
        String((methodCounts.get(1) ?? 0) + (methodCounts.get(2) ?? 0))
      );
      upsertResourceMetadata.run("lexemeCount", String(lexemeIds.size));
      upsertResourceMetadata.run(
        "lemmaDatasetVersion",
        FRENCH_LEMMA_PILOT_VERSION
      );
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
    database.exec("ANALYZE");
    database.exec("VACUUM");
  } finally {
    database.close();
  }
  return {
    resolvedUniqueCount: methodCounts.get(1) ?? 0,
    resolvedStrongContextCount: methodCounts.get(2) ?? 0,
    unresolvedAmbiguousCount: methodCounts.get(3) ?? 0,
    unavailableCount: methodCounts.get(4) ?? 0,
    lexemeCount: lexemeIds.size
  };
}

function readTopLemmas(filePath: string): FrenchLemmaPilotReport["topLemmas"] {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    return database
      .prepare(
        `
        SELECT l.lemma, l.partOfSpeech, COUNT(*) AS occurrences
        FROM WordSpans o
        JOIN FrenchLexemes l ON l.id=o.lexemeId
        GROUP BY l.id
        ORDER BY occurrences DESC, l.lemma, l.partOfSpeech
        LIMIT 50
      `
      )
      .all() as FrenchLemmaPilotReport["topLemmas"];
  } finally {
    database.close();
  }
}

function verifyPilotDatabase(
  filePath: string,
  expectedSpanCount: number
): "ok" {
  const database = new DatabaseSync(filePath, { readOnly: true });
  try {
    const integrity = String(
      (
        database.prepare("PRAGMA integrity_check").get() as Record<
          string,
          unknown
        >
      ).integrity_check
    );
    if (integrity !== "ok") {
      throw new Error(`french-lemma-pilot-integrity:${integrity}`);
    }
    const counts = database
      .prepare(
        `
        SELECT
          (SELECT COUNT(*) FROM WordSpans) AS spans,
          (SELECT COUNT(*) FROM WordSpans WHERE lexemeId IS NOT NULL) AS resolved,
          (SELECT COUNT(*) FROM WordSpans
             WHERE lexemeId IS NOT NULL AND lemmaMethod NOT IN (1, 2)) AS invalid,
          (SELECT COUNT(*) FROM WordSpans
             WHERE lexemeId IS NULL AND lemmaMethod IN (1, 2)) AS missing
      `
      )
      .get() as {
      spans: number;
      resolved: number;
      invalid: number;
      missing: number;
    };
    if (
      Number(counts.spans) !== expectedSpanCount ||
      Number(counts.resolved) <= 0 ||
      Number(counts.invalid) !== 0 ||
      Number(counts.missing) !== 0
    ) {
      throw new Error(
        `french-lemma-pilot-invalid-counts:${JSON.stringify(counts)}`
      );
    }
    return "ok";
  } finally {
    database.close();
  }
}

function displayLemma(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("fr-FR")
    .normalize("NFC")
    .replace(/[‐‑‒–—]/gu, "-")
    .replace(/’/gu, "'");
}

function candidateKey(candidate: LemmaCandidate): string {
  return `${candidate.lemma}\u0000${candidate.partOfSpeech}`;
}

function percent(value: number, total: number): number {
  return total > 0 ? Number(((value / total) * 100).toFixed(2)) : 0;
}

function strongIdentityKindCode(kind: StrongIdentityKind): number {
  return {
    strong: 0,
    estrong: 1,
    dstrong: 2,
    ustrong: 3
  }[kind];
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest("hex");
}

async function main(): Promise<void> {
  const root = process.cwd();
  const report = await buildFrenchLemmaPilot({
    sourceDatabase: path.resolve(
      root,
      "outputs/releases/bible-strong-production-v2/bibles/bible-lsg-strong.sqlite"
    ),
    kaikkiJsonl: path.resolve(root, DEFAULT_KAIKKI_FRENCH_JSONL),
    outputDatabase: path.resolve(root, DEFAULT_LSG_LEMMA_PILOT_OUTPUT),
    reportPath: path.resolve(root, DEFAULT_LSG_LEMMA_PILOT_REPORT)
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

if (
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  await main();
}
