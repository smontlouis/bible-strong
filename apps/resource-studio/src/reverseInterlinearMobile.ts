import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

export const REVERSE_INTERLINEAR_SCHEMA_VERSION = 3;
export const REVERSE_INTERLINEAR_MOBILE_SCHEMA_VERSION = 5;
export const REVERSE_INTERLINEAR_BUILDER_VERSION =
  "reverse-interlinear-mobile-sanitized@9";

type IdentityKind = 0 | 1 | 2 | 3;

interface StepToken {
  runtimeId: number;
  readingOrdinal: number;
  identities: Map<IdentityKind, Set<string>>;
  segments: StepSegment[];
}

interface StepSegment {
  ordinal: number;
  identities: Map<IdentityKind, Set<string>>;
  englishTerms: Set<string>;
}

interface TargetSpan {
  verseId: number;
  ordinal: number;
  length: number;
  lemma: string;
  partOfSpeech: string;
  identities: Map<IdentityKind, Set<string>>;
}

export interface ReverseInterlinearStepIndex {
  textRevision: string;
  textSha256: string;
  runtimeSha256: string;
  compatibleRuntimeSha256s: string[];
  tokensByRef: Map<string, StepToken[]>;
  englishTermsByStrong: Map<string, Set<string>>;
  tokenCount: number;
}

export interface StrongSanitizationSample {
  ref: string;
  ordinal: number;
  lemma: string;
  partOfSpeech: string;
  reason: "function-word" | "lexical-mismatch";
}

export interface StrongSanitizationCodeAudit {
  code: string;
  sourceCount: number;
  alignedKeptCount: number;
  lexicalKeptCount: number;
  suppressedFunctionCount: number;
  suppressedMismatchCount: number;
  samples: StrongSanitizationSample[];
}

export interface StrongSanitizationAudit {
  policy: "step-segment-lexical@1";
  sourceCount: number;
  alignedKeptCount: number;
  lexicalKeptCount: number;
  suppressedCount: number;
  suppressedFunctionCount: number;
  suppressedMismatchCount: number;
  byStrong: StrongSanitizationCodeAudit[];
}

interface MutableSanitizationCodeAudit {
  sourceCount: number;
  alignedKeptCount: number;
  lexicalKeptCount: number;
  suppressedFunctionCount: number;
  suppressedMismatchCount: number;
  samples: StrongSanitizationSample[];
}

export interface ReverseInterlinearMetrics {
  targetSpanCount: number;
  visibleTargetSpanCount: number;
  emptyTargetSpanCount: number;
  resolvedTargetSpanCount: number;
  partiallyResolvedTargetSpanCount: number;
  unresolvedTargetSpanCount: number;
  resolvedVisibleTargetSpanCount: number;
  sourceLinkCount: number;
  distinctStepTokenCount: number;
  exactIdentityTargetCount: number;
  occurrenceOrderTargetCount: number;
  uniqueCandidateTargetCount: number;
  semanticCarrierTargetCount: number;
  mixedMethodTargetCount: number;
  missingStepVerseTargetCount: number;
  enrichedIdentityCount: number;
  enrichedEStrongCount: number;
  enrichedDStrongCount: number;
  enrichedUStrongCount: number;
  sourceClassicalIdentityCount: number;
  alignedKeptClassicalIdentityCount: number;
  lexicalKeptClassicalIdentityCount: number;
  suppressedClassicalIdentityCount: number;
  suppressedFunctionWordCount: number;
  suppressedLexicalMismatchCount: number;
  visibleTargetCoverage: number;
  allTargetCoverage: number;
}

export interface ReverseInterlinearAugmentResult {
  baseStrongRevision: string;
  strongRevision: string;
  identityCount: number;
  metrics: ReverseInterlinearMetrics;
  sanitizationAudit?: StrongSanitizationAudit;
  integrityCheck: string;
  foreignKeyErrorCount: number;
}

export function loadReverseInterlinearStepIndex(options: {
  ledgerPath: string;
  runtimePath: string;
  runtimeSha256: string;
  compatibleRuntimeSha256s?: string[];
  textRevision: string;
  textSha256: string;
}): ReverseInterlinearStepIndex {
  const runtime = new DatabaseSync(options.runtimePath, { readOnly: true });
  const runtimeTokens = new Map<
    string,
    { runtimeId: number; termsBySegment: Map<number, Set<string>> }
  >();
  try {
    for (const row of runtime
      .prepare(
        `SELECT t.id, v.ref, t.readingOrdinal, s.ordinal AS segmentOrdinal,
                g.text AS gloss
           FROM Tokens t
           JOIN Verses v ON v.id=t.verseId
           JOIN Segments s ON s.tokenId=t.id
           JOIN Glosses g ON g.id=s.glossId
          ORDER BY t.id, s.ordinal`
      )
      .iterate() as Iterable<{
      id: number;
      ref: string;
      readingOrdinal: number;
      segmentOrdinal: number;
      gloss: string;
    }>) {
      const key = `${row.ref}\u0000${row.readingOrdinal}`;
      const value = runtimeTokens.get(key) ?? {
        runtimeId: row.id,
        termsBySegment: new Map<number, Set<string>>()
      };
      const terms =
        value.termsBySegment.get(row.segmentOrdinal) ?? new Set<string>();
      for (const term of englishTerms(row.gloss)) terms.add(term);
      value.termsBySegment.set(row.segmentOrdinal, terms);
      runtimeTokens.set(key, value);
    }
  } finally {
    runtime.close();
  }

  const ledger = new DatabaseSync(options.ledgerPath, { readOnly: true });
  const tokensByRef = new Map<string, StepToken[]>();
  const englishTermCountsByStrong = new Map<
    string,
    Map<string, number>
  >();
  const segmentCountsByStrong = new Map<string, number>();
  let tokenCount = 0;
  try {
    const statement = ledger.prepare(
      `SELECT t.id, v.ref AS canonicalRef, t.alternateRefs,
              t.readingOrdinal, sc.segmentOrdinal, c.kind, c.code
         FROM Tokens t
         JOIN Verses v ON v.id=t.verseId
         LEFT JOIN SegmentStrongCodes sc ON sc.tokenId=t.id
         LEFT JOIN StrongCodes c ON c.id=sc.codeId
        WHERE t.isCanonical=1
        ORDER BY t.id, sc.segmentOrdinal, c.kind, c.code`
    );
    let currentId = "";
    let current:
      | {
          canonicalRef: string;
          alternateRefs: string;
          readingOrdinal: number;
          token: StepToken;
        }
      | undefined;
    const flush = () => {
      if (!current) return;
      for (const segment of current.token.segments) {
        for (const strong of segment.identities.get(0) ?? []) {
          segmentCountsByStrong.set(
            strong,
            (segmentCountsByStrong.get(strong) ?? 0) + 1
          );
          const terms =
            englishTermCountsByStrong.get(strong) ??
            new Map<string, number>();
          for (const term of segment.englishTerms) {
            if (!isCandidateLexicalTerm(strong, term)) continue;
            terms.set(term, (terms.get(term) ?? 0) + 1);
          }
          englishTermCountsByStrong.set(strong, terms);
        }
      }
      const refs = [
        current.canonicalRef,
        ...parseStringArray(current.alternateRefs)
      ];
      for (const ref of new Set(refs)) {
        const values = tokensByRef.get(ref) ?? [];
        if (!values.some((token) => token.runtimeId === current!.token.runtimeId)) {
          values.push(current.token);
        }
        tokensByRef.set(ref, values);
      }
      tokenCount += 1;
    };

    for (const row of statement.iterate() as Iterable<{
      id: string;
      canonicalRef: string;
      alternateRefs: string;
      readingOrdinal: number;
      segmentOrdinal: number | null;
      kind: number | null;
      code: string | null;
    }>) {
      if (row.id !== currentId) {
        flush();
        currentId = row.id;
        const runtimeToken = runtimeTokens.get(
          `${row.canonicalRef}\u0000${row.readingOrdinal}`
        );
        if (!runtimeToken?.runtimeId) {
          throw new Error(`reverse-step-runtime-token-missing:${row.id}`);
        }
        current = {
          canonicalRef: row.canonicalRef,
          alternateRefs: row.alternateRefs,
          readingOrdinal: row.readingOrdinal,
          token: {
            runtimeId: runtimeToken.runtimeId,
            readingOrdinal: row.readingOrdinal,
            identities: new Map(),
            segments: [...runtimeToken.termsBySegment.entries()]
              .sort(([left], [right]) => left - right)
              .map(([ordinal, terms]) => ({
                ordinal,
                identities: new Map(),
                englishTerms: new Set(terms)
              }))
          }
        };
      }
      if (row.kind != null && row.code) {
        const kind = row.kind as IdentityKind;
        const code = normalizeIdentity(row.code);
        const values = current!.token.identities.get(kind) ?? new Set();
        values.add(code);
        current!.token.identities.set(kind, values);
        const segment = current!.token.segments.find(
          ({ ordinal }) => ordinal === row.segmentOrdinal
        );
        if (!segment) {
          throw new Error(
            `reverse-step-runtime-segment-missing:${row.id}:${row.segmentOrdinal}`
          );
        }
        const segmentValues = segment.identities.get(kind) ?? new Set();
        segmentValues.add(code);
        segment.identities.set(kind, segmentValues);
      }
    }
    flush();
    for (const tokens of tokensByRef.values()) {
      tokens.sort(
        (left, right) =>
          left.readingOrdinal - right.readingOrdinal ||
          left.runtimeId - right.runtimeId
      );
    }
  } finally {
    ledger.close();
  }
  const englishTermsByStrong = new Map<string, Set<string>>();
  for (const [strong, counts] of englishTermCountsByStrong) {
    const minimumCount = Math.max(
      2,
      Math.ceil((segmentCountsByStrong.get(strong) ?? 0) * 0.01)
    );
    englishTermsByStrong.set(
      strong,
      new Set(
        [...counts.entries()]
          .filter(([, count]) => count >= minimumCount)
          .map(([term]) => term)
      )
    );
  }

  return {
    textRevision: options.textRevision,
    textSha256: options.textSha256,
    runtimeSha256: options.runtimeSha256,
    compatibleRuntimeSha256s: [
      ...new Set([
        options.runtimeSha256,
        ...(options.compatibleRuntimeSha256s ?? [])
      ])
    ].sort(),
    tokensByRef,
    englishTermsByStrong,
    tokenCount
  };
}

export function augmentStrongBibleWithReverseInterlinear(options: {
  sqlitePath: string;
  step: ReverseInterlinearStepIndex;
  carrierPolicy?: "strong-order" | "semantic-over-tagged";
  sanitizeClassicalStrong?: boolean;
}): ReverseInterlinearAugmentResult {
  const database = new DatabaseSync(options.sqlitePath);
  database.exec("PRAGMA foreign_keys=ON");
  const metadata = readMetadata(database);
  const baseStrongRevision = metadata.strongRevision ?? "";
  if (!baseStrongRevision) {
    database.close();
    throw new Error("reverse-interlinear-base-strong-revision-missing");
  }
  const existingTableCount = Number(
    (
      database
        .prepare(
          `SELECT count(*) AS count
             FROM sqlite_schema
          WHERE (type='table' AND name IN (
                   'ReverseInterlinearTargets',
                   'WordStepTokenExtras'
                 ))
             OR (type='table' AND name='WordSpans' AND sql LIKE '%stepTokenId%')`
        )
        .get() as { count: number }
    ).count
  );
  if (existingTableCount > 0) {
    database.close();
    throw new Error("reverse-interlinear-already-present");
  }

  const metrics = emptyMetrics();
  const sanitization = options.sanitizeClassicalStrong
    ? new Map<string, MutableSanitizationCodeAudit>()
    : undefined;
  const distinctStepTokens = new Set<number>();

  database.exec("BEGIN IMMEDIATE");
  try {
    createSchema(database);
    const updatePrimarySource = database.prepare(
      `UPDATE WordSpans
          SET stepTokenId=?
        WHERE verseId=? AND ordinal=?`
    );
    const insertExtraSource = database.prepare(
      `INSERT INTO WordStepTokenExtras(
         verseId, targetOrdinal, sourceOrder, stepTokenId
       ) VALUES (?, ?, ?, ?)`
    );
    const insertStrongCode = database.prepare(
      `INSERT OR IGNORE INTO StrongCodes(kind, code) VALUES (?, ?)`
    );
    const selectStrongCode = database.prepare(
      `SELECT id FROM StrongCodes WHERE kind=? AND code=?`
    );
    const selectNextIdentityOrder = database.prepare(
      `SELECT coalesce(max(identityOrder), -1) + 1 AS nextOrder
         FROM WordStrongCodes WHERE verseId=? AND ordinal=?`
    );
    const selectSpanIdentity = database.prepare(
      `SELECT 1
         FROM WordStrongCodes x
         JOIN StrongCodes c ON c.id=x.codeId
        WHERE x.verseId=? AND x.ordinal=? AND c.kind=? AND c.code=?`
    );
    const insertWordStrongCode = database.prepare(
      `INSERT INTO WordStrongCodes(
         verseId, ordinal, identityOrder, codeId
       ) VALUES (?, ?, ?, ?)`
    );
    const deleteClassicalStrong = database.prepare(
      `DELETE FROM WordStrongCodes
        WHERE verseId=? AND ordinal=?
          AND codeId=(
            SELECT id FROM StrongCodes WHERE kind=0 AND code=?
          )`
    );
    for (const verse of readTargetVerses(database)) {
      const sourceTokens = options.step.tokensByRef.get(verse.ref) ?? [];
      alignVerse({
        ref: verse.ref,
        spans: verse.spans,
        sourceTokens,
        englishTermsByStrong: options.step.englishTermsByStrong,
        metrics,
        sanitization,
        distinctStepTokens,
        updatePrimarySource,
        insertExtraSource,
        insertStrongCode,
        selectStrongCode,
        selectNextIdentityOrder,
        selectSpanIdentity,
        insertWordStrongCode,
        deleteClassicalStrong,
        carrierPolicy: options.carrierPolicy ?? "strong-order"
      });
    }
    metrics.distinctStepTokenCount = distinctStepTokens.size;
    metrics.visibleTargetCoverage = ratio(
      metrics.resolvedVisibleTargetSpanCount,
      metrics.visibleTargetSpanCount
    );
    metrics.allTargetCoverage = ratio(
      metrics.resolvedTargetSpanCount,
      metrics.targetSpanCount
    );
    const identityCount = Number(
      (
        database
          .prepare(`SELECT count(*) AS count FROM WordStrongCodes`)
          .get() as { count: number }
      ).count
    );
    const strongRevision = createHash("sha256")
      .update(baseStrongRevision)
      .update("\u0000")
      .update(REVERSE_INTERLINEAR_BUILDER_VERSION)
      .update("\u0000")
      .update(options.step.textRevision)
      .update("\u0000")
      .update(options.step.compatibleRuntimeSha256s.join(","))
      .update("\u0000")
      .update(JSON.stringify(metrics))
      .digest("hex");
    const sanitizationAudit = sanitization
      ? finalizeSanitizationAudit(sanitization)
      : undefined;
    writeMetadata(database, {
      schemaVersion: REVERSE_INTERLINEAR_MOBILE_SCHEMA_VERSION,
      strongRevision,
      baseStrongRevision,
      reverseInterlinearSchemaVersion: REVERSE_INTERLINEAR_SCHEMA_VERSION,
      reverseInterlinearBuilderVersion: REVERSE_INTERLINEAR_BUILDER_VERSION,
      reverseInterlinearStepRevision: options.step.textRevision,
      reverseInterlinearStepTextSha256: options.step.textSha256,
      reverseInterlinearStepRuntimeSha256: options.step.runtimeSha256,
      reverseInterlinearCompatibleRuntimeSha256s: JSON.stringify(
        options.step.compatibleRuntimeSha256s
      ),
      reverseInterlinearMetrics: JSON.stringify(metrics),
      ...(sanitizationAudit
        ? {
            strongSanitizationPolicy: sanitizationAudit.policy,
            strongSanitizationSummary: JSON.stringify({
              sourceCount: sanitizationAudit.sourceCount,
              alignedKeptCount: sanitizationAudit.alignedKeptCount,
              lexicalKeptCount: sanitizationAudit.lexicalKeptCount,
              suppressedCount: sanitizationAudit.suppressedCount,
              suppressedFunctionCount:
                sanitizationAudit.suppressedFunctionCount,
              suppressedMismatchCount:
                sanitizationAudit.suppressedMismatchCount
            })
          }
        : {}),
      identityCount
    });
    database.exec("COMMIT");
    database.exec("ANALYZE");
    database.exec("VACUUM");

    const integrityCheck = String(
      (
        database.prepare("PRAGMA integrity_check").get() as {
          integrity_check: string;
        }
      ).integrity_check
    );
    const foreignKeyErrorCount = Number(
      (
        database
          .prepare(`SELECT count(*) AS count FROM pragma_foreign_key_check`)
          .get() as { count: number }
      ).count
    );
    if (integrityCheck !== "ok" || foreignKeyErrorCount !== 0) {
      throw new Error(
        `reverse-interlinear-integrity-failed:${integrityCheck}:${foreignKeyErrorCount}`
      );
    }
    return {
      baseStrongRevision,
      strongRevision,
      identityCount,
      metrics,
      ...(sanitizationAudit ? { sanitizationAudit } : {}),
      integrityCheck,
      foreignKeyErrorCount
    };
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
    throw error;
  } finally {
    database.close();
  }
}

function alignVerse(options: {
  ref: string;
  spans: TargetSpan[];
  sourceTokens: StepToken[];
  englishTermsByStrong: Map<string, Set<string>>;
  metrics: ReverseInterlinearMetrics;
  sanitization?: Map<string, MutableSanitizationCodeAudit>;
  distinctStepTokens: Set<number>;
  updatePrimarySource: ReturnType<DatabaseSync["prepare"]>;
  insertExtraSource: ReturnType<DatabaseSync["prepare"]>;
  insertStrongCode: ReturnType<DatabaseSync["prepare"]>;
  selectStrongCode: ReturnType<DatabaseSync["prepare"]>;
  selectNextIdentityOrder: ReturnType<DatabaseSync["prepare"]>;
  selectSpanIdentity: ReturnType<DatabaseSync["prepare"]>;
  insertWordStrongCode: ReturnType<DatabaseSync["prepare"]>;
  deleteClassicalStrong: ReturnType<DatabaseSync["prepare"]>;
  carrierPolicy: "strong-order" | "semantic-over-tagged";
}): void {
  const targetByStrong = new Map<string, TargetSpan[]>();
  for (const span of options.spans) {
    for (const strong of span.identities.get(0) ?? []) {
      const targets = targetByStrong.get(strong) ?? [];
      targets.push(span);
      targetByStrong.set(strong, targets);
    }
  }
  const resolutions = new Map<
    string,
    { token: StepToken; method: ResolutionMethod }
  >();
  for (const [strong, targets] of targetByStrong) {
    const candidates = options.sourceTokens.filter((token) =>
      (token.identities.get(0) ?? new Set()).has(strong)
    );
    for (const match of resolveStrongGroup(
      targets,
      candidates,
      options.carrierPolicy,
      strong,
      options.englishTermsByStrong.get(strong) ?? new Set()
    )) {
      resolutions.set(
        `${match.target.verseId}\u0000${match.target.ordinal}\u0000${strong}`,
        { token: match.token, method: match.method }
      );
    }
  }

  for (const span of options.spans) {
    options.metrics.targetSpanCount += 1;
    if (span.length > 0) options.metrics.visibleTargetSpanCount += 1;
    else options.metrics.emptyTargetSpanCount += 1;

    const strongCodes = [...(span.identities.get(0) ?? [])];
    const selected = new Map<number, ResolutionMethod>();
    const selectedStrongs = new Map<number, Set<string>>();
    let unresolvedStrongCount = 0;
    let missingStepVerse = false;

    if (options.sourceTokens.length === 0) {
      unresolvedStrongCount = strongCodes.length || 1;
      missingStepVerse = true;
    } else if (strongCodes.length === 0) {
      unresolvedStrongCount = 1;
    } else {
      for (const strong of strongCodes) {
        const resolution = resolutions.get(
          `${span.verseId}\u0000${span.ordinal}\u0000${strong}`
        );
        if (!resolution) {
          unresolvedStrongCount += 1;
          continue;
        }
        const previousMethod = selected.get(resolution.token.runtimeId);
        selected.set(
          resolution.token.runtimeId,
          strongerMethod(previousMethod, resolution.method)
        );
        const values =
          selectedStrongs.get(resolution.token.runtimeId) ?? new Set<string>();
        values.add(strong);
        selectedStrongs.set(resolution.token.runtimeId, values);
      }
    }

    const fullyResolved =
      strongCodes.length > 0 && unresolvedStrongCount === 0 && selected.size > 0;
    const partiallyResolved = !fullyResolved && selected.size > 0;
    const method = summarizeMethods([...selected.values()], missingStepVerse);
    const orderedRuntimeIds = [...selected.keys()].sort((left, right) => {
      const leftToken = options.sourceTokens.find(
        (token) => token.runtimeId === left
      );
      const rightToken = options.sourceTokens.find(
        (token) => token.runtimeId === right
      );
      return (
        (leftToken?.readingOrdinal ?? 0) -
          (rightToken?.readingOrdinal ?? 0) ||
        left - right
      );
    });
    const primaryRuntimeId = orderedRuntimeIds[0];
    if (primaryRuntimeId !== undefined) {
      options.updatePrimarySource.run(
        primaryRuntimeId,
        span.verseId,
        span.ordinal
      );
    }
    for (const [sourceOrder, runtimeId] of orderedRuntimeIds.entries()) {
      if (sourceOrder > 0) {
        options.insertExtraSource.run(
          span.verseId,
          span.ordinal,
          sourceOrder,
          runtimeId
        );
      }
      options.metrics.sourceLinkCount += 1;
      options.distinctStepTokens.add(runtimeId);
    }
    for (const runtimeId of orderedRuntimeIds) {
      const token = options.sourceTokens.find(
        (candidate) => candidate.runtimeId === runtimeId
      );
      if (token) {
        materializeEnrichedIdentities(
          span,
          token,
          selectedStrongs.get(runtimeId) ?? new Set(),
          options
        );
      }
    }
    if (options.sanitization) {
      for (const strong of strongCodes) {
        const audit = getSanitizationCodeAudit(
          options.sanitization,
          strong
        );
        audit.sourceCount += 1;
        options.metrics.sourceClassicalIdentityCount += 1;
        const resolution = resolutions.get(
          `${span.verseId}\u0000${span.ordinal}\u0000${strong}`
        );
        if (resolution) {
          audit.alignedKeptCount += 1;
          options.metrics.alignedKeptClassicalIdentityCount += 1;
          continue;
        }
        if (
          isLexicallyCompatibleClassicalCarrier(
            span,
            options.englishTermsByStrong.get(strong) ?? new Set()
          )
        ) {
          audit.lexicalKeptCount += 1;
          options.metrics.lexicalKeptClassicalIdentityCount += 1;
          continue;
        }
        const reason = isFunctionPartOfSpeech(span.partOfSpeech)
          ? "function-word"
          : "lexical-mismatch";
        options.deleteClassicalStrong.run(
          span.verseId,
          span.ordinal,
          strong
        );
        options.metrics.suppressedClassicalIdentityCount += 1;
        if (reason === "function-word") {
          audit.suppressedFunctionCount += 1;
          options.metrics.suppressedFunctionWordCount += 1;
        } else {
          audit.suppressedMismatchCount += 1;
          options.metrics.suppressedLexicalMismatchCount += 1;
        }
        if (audit.samples.length < 5) {
          audit.samples.push({
            ref: options.ref,
            ordinal: span.ordinal,
            lemma: span.lemma,
            partOfSpeech: span.partOfSpeech,
            reason
          });
        }
      }
    }

    if (fullyResolved) {
      options.metrics.resolvedTargetSpanCount += 1;
      if (span.length > 0) options.metrics.resolvedVisibleTargetSpanCount += 1;
    } else if (partiallyResolved) {
      options.metrics.partiallyResolvedTargetSpanCount += 1;
    } else {
      options.metrics.unresolvedTargetSpanCount += 1;
    }
    if (missingStepVerse) options.metrics.missingStepVerseTargetCount += 1;
    if (method === 0) options.metrics.exactIdentityTargetCount += 1;
    else if (method === 1) options.metrics.uniqueCandidateTargetCount += 1;
    else if (method === 2) options.metrics.occurrenceOrderTargetCount += 1;
    else if (method === 3) options.metrics.semanticCarrierTargetCount += 1;
    else if (method === 4) options.metrics.mixedMethodTargetCount += 1;
  }
}

type ResolutionMethod =
  | "exact"
  | "unique"
  | "occurrence-order"
  | "semantic-carrier";

function resolveStrongGroup(
  targets: TargetSpan[],
  candidates: StepToken[],
  carrierPolicy: "strong-order" | "semantic-over-tagged",
  strong: string,
  lexicalTerms: Set<string>
): Array<{
  target: TargetSpan;
  token: StepToken;
  method: ResolutionMethod;
}> {
  if (targets.length === 0 || candidates.length === 0) return [];
  if (
    targets.length === candidates.length &&
    carrierPolicy === "strong-order"
  ) {
    return targets.map((target, index) => ({
      target,
      token: candidates[index]!,
      method: hasSpecificIdentityMatch(target, candidates[index]!)
        ? "exact"
        : targets.length === 1
          ? "unique"
          : "occurrence-order"
    }));
  }
  if (candidates.length > targets.length) return [];
  const selected = selectSemanticCarriers(
    targets,
    candidates,
    strong,
    lexicalTerms
  );
  return (
    selected?.map(({ target, token }) => ({
      target,
      token,
      method: "semantic-carrier" as const
    })) ?? []
  );
}

function selectSemanticCarriers(
  targets: TargetSpan[],
  candidates: StepToken[],
  strong: string,
  lexicalTerms: Set<string>
): Array<{ target: TargetSpan; token: StepToken }> | undefined {
  const memo = new Map<string, { score: number; indexes: number[] } | null>();
  const solve = (
    sourceIndex: number,
    targetIndex: number
  ): { score: number; indexes: number[] } | null => {
    const key = `${sourceIndex}:${targetIndex}`;
    if (memo.has(key)) return memo.get(key) ?? null;
    if (sourceIndex === candidates.length) {
      const result = { score: 0, indexes: [] };
      memo.set(key, result);
      return result;
    }
    if (targets.length - targetIndex < candidates.length - sourceIndex) {
      memo.set(key, null);
      return null;
    }
    let best = solve(sourceIndex, targetIndex + 1);
    const score = semanticScore(
      targets[targetIndex]!,
      candidates[sourceIndex]!,
      strong,
      lexicalTerms
    );
    if (score >= 6) {
      const suffix = solve(sourceIndex + 1, targetIndex + 1);
      if (suffix) {
        const matched = {
          score: score + suffix.score,
          indexes: [targetIndex, ...suffix.indexes]
        };
        if (
          !best ||
          matched.score > best.score ||
          (matched.score === best.score &&
            compareNumberArrays(matched.indexes, best.indexes) < 0)
        ) {
          best = matched;
        }
      }
    }
    memo.set(key, best);
    return best;
  };
  const result = solve(0, 0);
  if (!result || result.indexes.length !== candidates.length) return undefined;
  return result.indexes.map((targetIndex, sourceIndex) => ({
    target: targets[targetIndex]!,
    token: candidates[sourceIndex]!
  }));
}

function semanticScore(
  target: TargetSpan,
  source: StepToken,
  strong: string,
  lexicalTerms: Set<string>
): number {
  const lemma = normalizeEnglishTerm(target.lemma);
  if (!lemma) return 0;
  if (isFunctionPartOfSpeech(target.partOfSpeech)) return 0;
  const terms = new Set(
    source.segments
      .filter((segment) => segment.identities.get(0)?.has(strong))
      .flatMap((segment) => [...segment.englishTerms])
      .filter((term) => lexicalTerms.has(term))
  );
  if (terms.has(lemma)) return 10;
  const stem = englishStem(lemma);
  if ([...terms].some((term) => englishStem(term) === stem)) {
    return 8;
  }
  return 0;
}

function isFunctionPartOfSpeech(partOfSpeech: string): boolean {
  return new Set([
    "conj",
    "conjunction",
    "det",
    "determiner",
    "particle",
    "prep",
    "preposition",
    "pron",
    "pronoun"
  ]).has(partOfSpeech);
}

function isLexicallyCompatibleClassicalCarrier(
  target: TargetSpan,
  terms: Set<string>
): boolean {
  const lemma = normalizeEnglishTerm(target.lemma);
  if (!lemma || isFunctionPartOfSpeech(target.partOfSpeech)) return false;
  if (terms.has(lemma)) return true;
  const stem = englishStem(lemma);
  return [...terms].some((term) => englishStem(term) === stem);
}

function getSanitizationCodeAudit(
  audits: Map<string, MutableSanitizationCodeAudit>,
  code: string
): MutableSanitizationCodeAudit {
  const existing = audits.get(code);
  if (existing) return existing;
  const created: MutableSanitizationCodeAudit = {
    sourceCount: 0,
    alignedKeptCount: 0,
    lexicalKeptCount: 0,
    suppressedFunctionCount: 0,
    suppressedMismatchCount: 0,
    samples: []
  };
  audits.set(code, created);
  return created;
}

function finalizeSanitizationAudit(
  audits: Map<string, MutableSanitizationCodeAudit>
): StrongSanitizationAudit {
  const byStrong = [...audits.entries()]
    .map(([code, audit]) => ({ code, ...audit }))
    .sort((left, right) => left.code.localeCompare(right.code, "en"));
  const sum = (
    key:
      | "sourceCount"
      | "alignedKeptCount"
      | "lexicalKeptCount"
      | "suppressedFunctionCount"
      | "suppressedMismatchCount"
  ) => byStrong.reduce((total, row) => total + row[key], 0);
  const suppressedFunctionCount = sum("suppressedFunctionCount");
  const suppressedMismatchCount = sum("suppressedMismatchCount");
  return {
    policy: "step-segment-lexical@1",
    sourceCount: sum("sourceCount"),
    alignedKeptCount: sum("alignedKeptCount"),
    lexicalKeptCount: sum("lexicalKeptCount"),
    suppressedCount: suppressedFunctionCount + suppressedMismatchCount,
    suppressedFunctionCount,
    suppressedMismatchCount,
    byStrong
  };
}

function materializeEnrichedIdentities(
  span: TargetSpan,
  token: StepToken,
  selectedStrongs: Set<string>,
  options: Parameters<typeof alignVerse>[0]
): void {
  const represented = new Set<string>(
    [...span.identities.values()].flatMap((values) => [...values])
  );
  for (const kind of [1, 2, 3] as const) {
    const sourceCodes = new Set(
      token.segments
        .filter((segment) =>
          [...selectedStrongs].some((strong) =>
            segment.identities.get(0)?.has(strong)
          )
        )
        .flatMap((segment) => [...(segment.identities.get(kind) ?? [])])
    );
    for (const code of sourceCodes) {
      if (represented.has(code)) continue;
      if (
        options.selectSpanIdentity.get(
          span.verseId,
          span.ordinal,
          kind,
          code
        )
      ) {
        represented.add(code);
        continue;
      }
      options.insertStrongCode.run(kind, code);
      const codeId = Number(
        (options.selectStrongCode.get(kind, code) as { id: number }).id
      );
      const nextOrder = Number(
        (
          options.selectNextIdentityOrder.get(
            span.verseId,
            span.ordinal
          ) as { nextOrder: number }
        ).nextOrder
      );
      options.insertWordStrongCode.run(
        span.verseId,
        span.ordinal,
        nextOrder,
        codeId
      );
      represented.add(code);
      options.metrics.enrichedIdentityCount += 1;
      if (kind === 1) options.metrics.enrichedEStrongCount += 1;
      else if (kind === 2) options.metrics.enrichedDStrongCount += 1;
      else options.metrics.enrichedUStrongCount += 1;
    }
  }
}

function hasSpecificIdentityMatch(
  target: TargetSpan,
  source: StepToken
): boolean {
  for (const kind of [2, 1] as const) {
    const targetValues = target.identities.get(kind) ?? new Set();
    const sourceValues = source.identities.get(kind) ?? new Set();
    if ([...targetValues].some((value) => sourceValues.has(value))) return true;
  }
  return false;
}

function strongerMethod(
  left: ResolutionMethod | undefined,
  right: ResolutionMethod
): ResolutionMethod {
  if (!left) return right;
  const rank: Record<ResolutionMethod, number> = {
    exact: 3,
    unique: 2,
    "semantic-carrier": 2,
    "occurrence-order": 1
  };
  return rank[right] > rank[left] ? right : left;
}

function summarizeMethods(
  methods: ResolutionMethod[],
  missingStepVerse: boolean
): number {
  if (missingStepVerse || methods.length === 0) return 5;
  const unique = new Set(methods);
  if (unique.size > 1) return 4;
  const method = methods[0];
  return method === "exact"
    ? 0
    : method === "unique"
      ? 1
      : method === "occurrence-order"
        ? 2
        : 3;
}

function* readTargetVerses(
  database: DatabaseSync
): Generator<{ ref: string; spans: TargetSpan[] }> {
  const statement = database.prepare(
    `SELECT v.id AS verseId, v.bookOrder, v.chapter, v.verse,
            w.ordinal, w.length, coalesce(l.lemma, '') AS lemma,
            coalesce(l.partOfSpeech, '') AS partOfSpeech, c.kind, c.code
       FROM Verses v
       JOIN WordSpans w ON w.verseId=v.id
       LEFT JOIN FrenchLexemes l ON l.id=w.lexemeId
       LEFT JOIN WordStrongCodes x
         ON x.verseId=w.verseId AND x.ordinal=w.ordinal
       LEFT JOIN StrongCodes c ON c.id=x.codeId
      ORDER BY v.bookOrder, v.chapter, v.verse,
               w.ordinal, x.identityOrder`
  );
  let currentRef = "";
  let currentVerseId = -1;
  let currentSpanOrdinal = -1;
  let spans: TargetSpan[] = [];
  let span: TargetSpan | undefined;
  const flushSpan = () => {
    if (span) spans.push(span);
    span = undefined;
  };
  for (const row of statement.iterate() as Iterable<{
    verseId: number;
    bookOrder: number;
    chapter: number;
    verse: number;
    ordinal: number;
    length: number;
    lemma: string;
    partOfSpeech: string;
    kind: number | null;
    code: string | null;
  }>) {
    const ref = `${bookId(row.bookOrder)}.${row.chapter}.${row.verse}`;
    if (currentRef && ref !== currentRef) {
      flushSpan();
      yield { ref: currentRef, spans };
      spans = [];
      currentSpanOrdinal = -1;
    }
    currentRef = ref;
    currentVerseId = row.verseId;
    if (row.ordinal !== currentSpanOrdinal) {
      flushSpan();
      currentSpanOrdinal = row.ordinal;
      span = {
        verseId: currentVerseId,
        ordinal: row.ordinal,
        length: row.length,
        lemma: row.lemma,
        partOfSpeech: row.partOfSpeech,
        identities: new Map()
      };
    }
    if (span && row.kind != null && row.code) {
      const kind = row.kind as IdentityKind;
      const values = span.identities.get(kind) ?? new Set();
      values.add(normalizeIdentity(row.code));
      span.identities.set(kind, values);
    }
  }
  if (currentRef) {
    flushSpan();
    yield { ref: currentRef, spans };
  }
}

function createSchema(database: DatabaseSync): void {
  database.exec(`
    ALTER TABLE WordSpans ADD COLUMN stepTokenId INTEGER;

    CREATE TABLE WordStepTokenExtras (
      verseId INTEGER NOT NULL,
      targetOrdinal INTEGER NOT NULL,
      sourceOrder INTEGER NOT NULL CHECK(sourceOrder > 0),
      stepTokenId INTEGER NOT NULL,
      PRIMARY KEY(verseId, targetOrdinal, sourceOrder),
      FOREIGN KEY(verseId, targetOrdinal)
        REFERENCES WordSpans(verseId, ordinal) ON DELETE CASCADE
    ) WITHOUT ROWID;
  `);
}

function readMetadata(database: DatabaseSync): Record<string, string> {
  return Object.fromEntries(
    (
      database
        .prepare(`SELECT key, value FROM ResourceMetadata`)
        .all() as Array<{ key: string; value: string }>
    ).map((row) => [row.key, row.value])
  );
}

function writeMetadata(
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

function normalizeIdentity(value: string): string {
  const match = value.trim().match(/^([HG])0*(\d+)(.*)$/u);
  if (!match) return value.trim();
  return `${match[1]}${Number(match[2])}${match[3] ?? ""}`;
}

const GLOSS_SCAFFOLD_TERMS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "be",
  "been",
  "being",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "does",
  "for",
  "from",
  "had",
  "has",
  "have",
  "he",
  "her",
  "him",
  "his",
  "i",
  "in",
  "is",
  "it",
  "let",
  "may",
  "me",
  "might",
  "must",
  "my",
  "not",
  "o",
  "of",
  "on",
  "or",
  "our",
  "shall",
  "she",
  "should",
  "that",
  "the",
  "their",
  "them",
  "there",
  "these",
  "they",
  "this",
  "those",
  "to",
  "us",
  "was",
  "we",
  "were",
  "what",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your"
]);

const COPULA_STRONGS = new Set(["H1961", "G1510"]);
const COPULA_TERMS = new Set(["are", "be", "been", "being", "is", "was", "were"]);

function isCandidateLexicalTerm(strong: string, term: string): boolean {
  if (COPULA_STRONGS.has(strong) && COPULA_TERMS.has(term)) return true;
  return !GLOSS_SCAFFOLD_TERMS.has(term);
}

function englishTerms(value: string): string[] {
  return [
    ...new Set(
      value
        .split(/[·,;|/()[\]{}"'!?=:–—\s]+/u)
        .map(normalizeEnglishTerm)
        .filter(Boolean)
    )
  ];
}

function normalizeEnglishTerm(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("en")
    .replace(/[^a-z0-9]+/gu, "");
}

function englishStem(value: string): string {
  if (value.length > 5 && value.endsWith("ies")) return `${value.slice(0, -3)}y`;
  if (value.length > 4 && value.endsWith("es")) return value.slice(0, -2);
  if (value.length > 3 && value.endsWith("s")) return value.slice(0, -1);
  if (value.length > 5 && value.endsWith("ing")) return value.slice(0, -3);
  if (value.length > 4 && value.endsWith("ed")) return value.slice(0, -2);
  return value;
}

function compareNumberArrays(left: number[], right: number[]): number {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    if (left[index] !== right[index]) return left[index]! - right[index]!;
  }
  return left.length - right.length;
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

function ratio(numerator: number, denominator: number): number {
  return denominator === 0
    ? 0
    : Number((numerator / denominator).toFixed(6));
}

function emptyMetrics(): ReverseInterlinearMetrics {
  return {
    targetSpanCount: 0,
    visibleTargetSpanCount: 0,
    emptyTargetSpanCount: 0,
    resolvedTargetSpanCount: 0,
    partiallyResolvedTargetSpanCount: 0,
    unresolvedTargetSpanCount: 0,
    resolvedVisibleTargetSpanCount: 0,
    sourceLinkCount: 0,
    distinctStepTokenCount: 0,
    exactIdentityTargetCount: 0,
    occurrenceOrderTargetCount: 0,
    uniqueCandidateTargetCount: 0,
    semanticCarrierTargetCount: 0,
    mixedMethodTargetCount: 0,
    missingStepVerseTargetCount: 0,
    enrichedIdentityCount: 0,
    enrichedEStrongCount: 0,
    enrichedDStrongCount: 0,
    enrichedUStrongCount: 0,
    sourceClassicalIdentityCount: 0,
    alignedKeptClassicalIdentityCount: 0,
    lexicalKeptClassicalIdentityCount: 0,
    suppressedClassicalIdentityCount: 0,
    suppressedFunctionWordCount: 0,
    suppressedLexicalMismatchCount: 0,
    visibleTargetCoverage: 0,
    allTargetCoverage: 0
  };
}

const BOOK_IDS = [
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jonah",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev"
] as const;

function bookId(bookOrder: number): string {
  const value = BOOK_IDS[bookOrder - 1];
  if (!value) throw new Error(`reverse-interlinear-invalid-book:${bookOrder}`);
  return value;
}
