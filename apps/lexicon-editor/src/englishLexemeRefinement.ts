import { createHash } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

import {
  ENGLISH_POS_RESOLVER_POLICY,
  analyzeEnglishSpan,
  isCapitalizedLemmaHead,
  normalizeEnglishWord,
  resolveEnglishPartOfSpeech,
  type EnglishSpanAnalysis
} from "./englishPosResolver.js";

export const ENGLISH_LEXEME_REFINEMENT_POLICY = "english-lexeme-refinement@9";
export const PREVIOUS_ENGLISH_LEXEME_REFINEMENT_POLICY =
  "english-lexeme-refinement@1";

type IdentityKind = 0 | 1 | 2 | 3;

interface SpanIdentity {
  kind: IdentityKind;
  code: string;
}

interface SpanRecord {
  verseId: number;
  ordinal: number;
  bookOrder: number;
  chapter: number;
  verse: number;
  startOffset: number;
  length: number;
  verseText: string;
  stepTokenId: number | null;
  lemma: string;
  partOfSpeech: string;
  identities: SpanIdentity[];
}

interface VoteBucket {
  partOfSpeech: Map<string, number>;
  sourcePartOfSpeech: Map<string, number>;
  evidenceCount: number;
}

export interface EnglishLexemeConsensusDecision {
  identityKind: 0 | 1 | 2;
  identityCode: string;
  lemma: string;
  partOfSpeech: string;
  method: "cross-version-consensus";
  evidenceCount: number;
  confidence: number;
  sourcePartOfSpeech?: string;
}

export interface EnglishLexemeCorrection {
  bookOrder: number;
  chapter: number;
  verse: number;
  ordinal: number;
  lemma: string;
  previousPartOfSpeech: string;
  partOfSpeech: string;
  method:
    | "surface-divine-identity"
    | "surface-entity"
    | "dictionary-single-pos"
    | "dictionary-context"
    | "contextual-tagger"
    | "cross-version-consensus"
    | "curated-override";
  identityKind: IdentityKind;
  identityCode: string;
  evidenceCount: number;
  confidence: number;
  surface: string;
  candidatePartsOfSpeech: string[];
  decisionMargin: number;
  evidence: string[];
  sourcePartOfSpeech?: string;
}

export interface EnglishLexemeBibleRefinementResult {
  applicationVersionId: string;
  sqlitePath: string;
  policy: typeof ENGLISH_LEXEME_REFINEMENT_POLICY;
  sourceRevision: string;
  refinedRevision: string;
  decisionDigest: string;
  appliedDigest: string;
  occurrenceCount: number;
  correctionCount: number;
  retainedProvisionalCount: number;
  correctionsByMethod: Record<string, number>;
  correctionsByTransition: Record<string, number>;
  lowMarginCount: number;
  lowMarginSamples: Array<{
    bookOrder: number;
    chapter: number;
    verse: number;
    ordinal: number;
    surface: string;
    lemma: string;
    retainedPartOfSpeech: string;
    candidatePartsOfSpeech: string[];
    evidence: string[];
  }>;
  remainingCanaries: {
    h0430gVerb: number;
    h0430gCommonNotNoun: number;
    h0430gDivineNotName: number;
    jehovahNotName: number;
    capitalizedEntityVerb: number;
    knownLowercaseName: number;
    indeterminate: number;
  };
  corrections: EnglishLexemeCorrection[];
}

export interface EnglishLexemeRefinementResult {
  policy: typeof ENGLISH_LEXEME_REFINEMENT_POLICY;
  entityRegistryDigest: string;
  morphologyDigest: string;
  lexicalResourceDigest: string;
  surfaceCorpusDigest: string;
  lexicalCandidateDigest: string;
  lexicalCandidates: Array<{
    normalizedSurface: string;
    lemma: string;
    partOfSpeech: string;
    source: typeof ENGLISH_POS_RESOLVER_POLICY;
  }>;
  decisionDigest: string;
  decisionCount: number;
  decisions: EnglishLexemeConsensusDecision[];
  bibles: EnglishLexemeBibleRefinementResult[];
}

export function refineEnglishBibleLexemes(options: {
  bibles: Array<{
    applicationVersionId: string;
    sqlitePath: string;
    verseTexts: ReadonlyMap<string, string>;
  }>;
  entityDatabasePath: string;
  stepRuntimePath: string;
  lexicalResourceDigest?: string;
  surfaceCorpusDigest?: string;
}): EnglishLexemeRefinementResult {
  if (options.bibles.length === 0) {
    throw new Error("english-lexeme-refinement-no-bibles");
  }
  const entityIndex = loadEntityAliasIndex(options.entityDatabasePath);
  const morphologyIndex = loadStepMorphologyIndex(options.stepRuntimePath);
  const votes = new Map<string, VoteBucket>();
  const lexicalCandidates = new Map<
    string,
    {
      normalizedSurface: string;
      lemma: string;
      partOfSpeech: string;
      source: typeof ENGLISH_POS_RESOLVER_POLICY;
    }
  >();

  for (const bible of options.bibles) {
    const database = new DatabaseSync(bible.sqlitePath, { readOnly: true });
    try {
      for (const span of readSpans(database, bible.verseTexts)) {
        if (span.stepTokenId === null) continue;
        const sourcePartOfSpeech = morphologyIndex.byTokenId.get(
          span.stepTokenId
        );
        const intrinsic = intrinsicDecisionForSpan(
          span,
          sourcePartOfSpeech,
          entityIndex.aliasesByCode
        );
        recordLexicalCandidates(lexicalCandidates, span, intrinsic.analysis);
        const votePartOfSpeech = intrinsic.partOfSpeech ?? span.partOfSpeech;
        for (const identity of lexicalIdentities(span.identities)) {
          const key = decisionKey(identity.kind, identity.code, span.lemma);
          const bucket = votes.get(key) ?? {
            partOfSpeech: new Map<string, number>(),
            sourcePartOfSpeech: new Map<string, number>(),
            evidenceCount: 0
          };
          increment(bucket.partOfSpeech, votePartOfSpeech);
          if (sourcePartOfSpeech) {
            increment(bucket.sourcePartOfSpeech, sourcePartOfSpeech);
          }
          bucket.evidenceCount += 1;
          votes.set(key, bucket);
        }
      }
    } finally {
      database.close();
    }
  }

  const decisions = buildConsensusDecisions(votes);
  const sortedLexicalCandidates = [...lexicalCandidates.values()].sort(
    (left, right) =>
      left.normalizedSurface.localeCompare(right.normalizedSurface) ||
      left.lemma.localeCompare(right.lemma) ||
      left.partOfSpeech.localeCompare(right.partOfSpeech)
  );
  const lexicalResourceDigest =
    options.lexicalResourceDigest ??
    sha256Canonical({ source: ENGLISH_POS_RESOLVER_POLICY });
  const surfaceCorpusDigest =
    options.surfaceCorpusDigest ??
    sha256Canonical(
      options.bibles.map(({ applicationVersionId, verseTexts }) => [
        applicationVersionId,
        verseTexts.size
      ])
    );
  const lexicalCandidateDigest = sha256Canonical(sortedLexicalCandidates);
  const decisionsByKey = new Map(
    decisions.map((decision) => [
      decisionKey(decision.identityKind, decision.identityCode, decision.lemma),
      decision
    ])
  );
  const decisionDigest = sha256Canonical({
    policy: ENGLISH_LEXEME_REFINEMENT_POLICY,
    entityRegistryDigest: entityIndex.digest,
    morphologyDigest: morphologyIndex.digest,
    lexicalResourceDigest,
    surfaceCorpusDigest,
    lexicalCandidateDigest,
    decisions
  });
  const bibles = options.bibles.map((bible) =>
    refineBible({
      ...bible,
      entityAliasesByCode: entityIndex.aliasesByCode,
      morphologyByTokenId: morphologyIndex.byTokenId,
      decisionsByKey,
      decisionDigest,
      lexicalResourceDigest,
      surfaceCorpusDigest,
      lexicalCandidateDigest
    })
  );

  return {
    policy: ENGLISH_LEXEME_REFINEMENT_POLICY,
    entityRegistryDigest: entityIndex.digest,
    morphologyDigest: morphologyIndex.digest,
    lexicalResourceDigest,
    surfaceCorpusDigest,
    lexicalCandidateDigest,
    lexicalCandidates: sortedLexicalCandidates,
    decisionDigest,
    decisionCount: decisions.length,
    decisions,
    bibles
  };
}

function refineBible(options: {
  applicationVersionId: string;
  sqlitePath: string;
  verseTexts: ReadonlyMap<string, string>;
  entityAliasesByCode: Map<string, Set<string>>;
  morphologyByTokenId: Map<number, string>;
  decisionsByKey: Map<string, EnglishLexemeConsensusDecision>;
  decisionDigest: string;
  lexicalResourceDigest: string;
  surfaceCorpusDigest: string;
  lexicalCandidateDigest: string;
}): EnglishLexemeBibleRefinementResult {
  const database = new DatabaseSync(options.sqlitePath);
  database.exec("PRAGMA foreign_keys=ON");
  const metadata = readMetadata(database);
  const sourceRevision = metadata.strongRevision ?? "";
  if (!sourceRevision) {
    database.close();
    throw new Error(
      `english-lexeme-refinement-source-revision-missing:${options.applicationVersionId}`
    );
  }
  if (
    metadata.englishLexemeRefinementPolicy === ENGLISH_LEXEME_REFINEMENT_POLICY
  ) {
    database.close();
    throw new Error(
      `english-lexeme-refinement-already-applied:${options.applicationVersionId}`
    );
  }
  if (
    metadata.englishLexemeRefinementPolicy &&
    metadata.englishLexemeRefinementPolicy !==
      PREVIOUS_ENGLISH_LEXEME_REFINEMENT_POLICY
  ) {
    database.close();
    throw new Error(
      `english-lexeme-refinement-unsupported-parent:${options.applicationVersionId}:${metadata.englishLexemeRefinementPolicy}`
    );
  }

  const corrections: EnglishLexemeCorrection[] = [];
  const lowMarginSamples: EnglishLexemeBibleRefinementResult["lowMarginSamples"] =
    [];
  let lowMarginCount = 0;
  let occurrenceCount = 0;
  for (const span of readSpans(database, options.verseTexts)) {
    occurrenceCount += 1;
    const sourcePartOfSpeech =
      span.stepTokenId === null
        ? undefined
        : options.morphologyByTokenId.get(span.stepTokenId);
    const candidate = correctionForSpan(
      span,
      sourcePartOfSpeech,
      options.entityAliasesByCode,
      options.decisionsByKey
    );
    if (candidate.lowMargin) {
      lowMarginCount += 1;
      if (lowMarginSamples.length < 100) {
        lowMarginSamples.push({
          bookOrder: span.bookOrder,
          chapter: span.chapter,
          verse: span.verse,
          ordinal: span.ordinal,
          surface: candidate.analysis.surface,
          lemma: span.lemma,
          retainedPartOfSpeech: span.partOfSpeech,
          candidatePartsOfSpeech: candidate.analysis.candidates,
          evidence: candidate.evidence
        });
      }
    }
    if (!candidate || candidate.partOfSpeech === span.partOfSpeech) continue;
    corrections.push({
      bookOrder: span.bookOrder,
      chapter: span.chapter,
      verse: span.verse,
      ordinal: span.ordinal,
      lemma: span.lemma,
      previousPartOfSpeech: span.partOfSpeech,
      partOfSpeech: candidate.partOfSpeech,
      method: candidate.method,
      identityKind: candidate.identity.kind,
      identityCode: candidate.identity.code,
      evidenceCount: candidate.evidenceCount,
      confidence: candidate.confidence,
      surface: candidate.analysis.surface,
      candidatePartsOfSpeech: candidate.analysis.candidates,
      decisionMargin: candidate.margin,
      evidence: candidate.evidence,
      ...(sourcePartOfSpeech ? { sourcePartOfSpeech } : {})
    });
  }
  corrections.sort(compareCorrections);
  const appliedDigest = sha256Canonical(corrections);
  const correctionsByMethod = countBy(corrections, ({ method }) => method);
  const correctionsByTransition = countBy(
    corrections,
    ({ previousPartOfSpeech, partOfSpeech }) =>
      `${previousPartOfSpeech}->${partOfSpeech}`
  );
  const refinedRevision = createHash("sha256")
    .update(sourceRevision)
    .update("\u0000")
    .update(ENGLISH_LEXEME_REFINEMENT_POLICY)
    .update("\u0000")
    .update(options.decisionDigest)
    .update("\u0000")
    .update(appliedDigest)
    .digest("hex");
  let remainingCanaries:
    | EnglishLexemeBibleRefinementResult["remainingCanaries"]
    | undefined;

  database.exec("BEGIN IMMEDIATE");
  try {
    const insertLexeme = database.prepare(
      `INSERT OR IGNORE INTO FrenchLexemes(lemma, partOfSpeech) VALUES (?, ?)`
    );
    const selectLexeme = database.prepare(
      `SELECT id FROM FrenchLexemes WHERE lemma=? AND partOfSpeech=?`
    );
    const updateSpan = database.prepare(
      `UPDATE WordSpans SET lexemeId=? WHERE verseId=(
         SELECT id FROM Verses
          WHERE bookOrder=? AND chapter=? AND verse=?
       ) AND ordinal=?`
    );
    for (const correction of corrections) {
      insertLexeme.run(correction.lemma, correction.partOfSpeech);
      const row = selectLexeme.get(
        correction.lemma,
        correction.partOfSpeech
      ) as { id: number } | undefined;
      if (!row) {
        throw new Error(
          `english-lexeme-refinement-lexeme-missing:${correction.lemma}:${correction.partOfSpeech}`
        );
      }
      const result = updateSpan.run(
        row.id,
        correction.bookOrder,
        correction.chapter,
        correction.verse,
        correction.ordinal
      );
      if (Number(result.changes) !== 1) {
        throw new Error(
          `english-lexeme-refinement-span-update:${options.applicationVersionId}:${correction.bookOrder}:${correction.chapter}:${correction.verse}:${correction.ordinal}`
        );
      }
    }
    remainingCanaries = readRemainingCanaries(
      database,
      options.entityAliasesByCode,
      options.verseTexts
    );
    if (
      remainingCanaries.h0430gVerb !== 0 ||
      remainingCanaries.h0430gCommonNotNoun !== 0 ||
      remainingCanaries.h0430gDivineNotName !== 0 ||
      remainingCanaries.jehovahNotName !== 0 ||
      remainingCanaries.capitalizedEntityVerb !== 0 ||
      remainingCanaries.knownLowercaseName !== 0 ||
      remainingCanaries.indeterminate !== 0
    ) {
      const diagnosticSamples = readKnownLowercaseNameSamples(
        database,
        options.verseTexts
      );
      throw new Error(
        `english-lexeme-refinement-canary:${options.applicationVersionId}:${JSON.stringify({ ...remainingCanaries, diagnosticSamples })}`
      );
    }
    writeMetadata(database, {
      strongRevision: refinedRevision,
      ...(metadata.englishLexemeRefinementPolicy
        ? {
            englishLexemeRefinementPreviousPolicy:
              metadata.englishLexemeRefinementPolicy,
            englishLexemeRefinementPreviousDecisionDigest:
              metadata.englishLexemeRefinementDecisionDigest ?? "",
            englishLexemeRefinementPreviousAppliedDigest:
              metadata.englishLexemeRefinementAppliedDigest ?? ""
          }
        : {}),
      englishLexemeRefinementPolicy: ENGLISH_LEXEME_REFINEMENT_POLICY,
      englishLexemeRefinementDecisionDigest: options.decisionDigest,
      englishLexemeRefinementAppliedDigest: appliedDigest,
      englishLexemeRefinementResolverPolicy: ENGLISH_POS_RESOLVER_POLICY,
      englishLexemeRefinementLexicalResourceDigest:
        options.lexicalResourceDigest,
      englishLexemeRefinementSurfaceCorpusDigest: options.surfaceCorpusDigest,
      englishLexemeRefinementLexicalCandidateDigest:
        options.lexicalCandidateDigest,
      englishLexemeRefinementSummary: JSON.stringify({
        occurrenceCount,
        correctionCount: corrections.length,
        retainedProvisionalCount: occurrenceCount - corrections.length,
        lowMarginCount,
        correctionsByMethod,
        correctionsByTransition
      })
    });
    database.exec("COMMIT");
  } catch (error) {
    if (database.isTransaction) database.exec("ROLLBACK");
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
  const foreignKeyErrors = Number(
    (
      database
        .prepare(`SELECT count(*) AS count FROM pragma_foreign_key_check`)
        .get() as { count: number }
    ).count
  );
  database.close();
  if (integrityCheck !== "ok" || foreignKeyErrors !== 0) {
    throw new Error(
      `english-lexeme-refinement-integrity:${options.applicationVersionId}:${integrityCheck}:${foreignKeyErrors}`
    );
  }
  if (!remainingCanaries) {
    throw new Error(
      `english-lexeme-refinement-canary-missing:${options.applicationVersionId}`
    );
  }

  return {
    applicationVersionId: options.applicationVersionId,
    sqlitePath: options.sqlitePath,
    policy: ENGLISH_LEXEME_REFINEMENT_POLICY,
    sourceRevision,
    refinedRevision,
    decisionDigest: options.decisionDigest,
    appliedDigest,
    occurrenceCount,
    correctionCount: corrections.length,
    retainedProvisionalCount: occurrenceCount - corrections.length,
    correctionsByMethod,
    correctionsByTransition,
    lowMarginCount,
    lowMarginSamples,
    remainingCanaries,
    corrections
  };
}

function readKnownLowercaseNameSamples(
  database: DatabaseSync,
  verseTexts: ReadonlyMap<string, string>
): Array<Record<string, unknown>> {
  const samples: Array<Record<string, unknown>> = [];
  for (const span of readSpans(database, verseTexts)) {
    const lemma = normalizeLemma(span.lemma);
    if (span.partOfSpeech !== "name") {
      continue;
    }
    const analysis = analyzeEnglishSpan({
      verseText: span.verseText,
      startOffset: span.startOffset,
      length: span.length,
      lemma: span.lemma
    });
    if (isCapitalizedLemmaHead(analysis, lemma)) {
      continue;
    }
    samples.push({
      bookOrder: span.bookOrder,
      chapter: span.chapter,
      verse: span.verse,
      ordinal: span.ordinal,
      surface: analysis.surface,
      head: analysis.head?.value ?? null,
      lemma,
      candidates: analysis.candidates,
      identities: span.identities
    });
    if (samples.length === 20) break;
  }
  return samples;
}

function correctionForSpan(
  span: SpanRecord,
  sourcePartOfSpeech: string | undefined,
  entityAliasesByCode: Map<string, Set<string>>,
  decisionsByKey: Map<string, EnglishLexemeConsensusDecision>
): IntrinsicDecision {
  const intrinsic = intrinsicDecisionForSpan(
    span,
    sourcePartOfSpeech,
    entityAliasesByCode
  );
  if (
    intrinsic.partOfSpeech !== span.partOfSpeech ||
    intrinsic.method !== "contextual-tagger" ||
    intrinsic.evidence.some((item) =>
      item.startsWith("contextual-tagger-retain:")
    )
  ) {
    return intrinsic;
  }
  const allowedPartsOfSpeech = new Set(intrinsic.analysis.candidates);
  for (const kind of [2, 1, 0] as const) {
    const candidates = span.identities
      .filter((identity) => identity.kind === kind)
      .map((identity) => ({
        identity,
        decision: decisionsByKey.get(
          decisionKey(kind, identity.code, span.lemma)
        )
      }))
      .filter(
        (
          value
        ): value is {
          identity: SpanIdentity;
          decision: EnglishLexemeConsensusDecision;
        } => Boolean(value.decision)
      )
      .filter(
        ({ decision }) =>
          allowedPartsOfSpeech.size === 0 ||
          allowedPartsOfSpeech.has(
            decision.partOfSpeech as "noun" | "verb" | "adj" | "adv"
          )
      );
    if (candidates.length === 0) continue;
    const partsOfSpeech = new Set(
      candidates.map(({ decision }) => decision.partOfSpeech)
    );
    if (partsOfSpeech.size !== 1) return intrinsic;
    const best = candidates.sort(
      (left, right) =>
        right.decision.evidenceCount - left.decision.evidenceCount ||
        left.identity.code.localeCompare(right.identity.code)
    )[0]!;
    return {
      ...intrinsic,
      partOfSpeech: best.decision.partOfSpeech,
      method: "cross-version-consensus",
      identity: best.identity,
      evidenceCount: best.decision.evidenceCount,
      confidence: best.decision.confidence,
      margin: Math.max(3, intrinsic.margin),
      lowMargin: false,
      evidence: [
        ...intrinsic.evidence,
        `cross-version-consensus:${best.decision.evidenceCount}:${best.decision.confidence}`
      ]
    };
  }
  return intrinsic;
}

interface IntrinsicDecision {
  partOfSpeech: string;
  method:
    | "surface-divine-identity"
    | "surface-entity"
    | "dictionary-single-pos"
    | "dictionary-context"
    | "contextual-tagger"
    | "cross-version-consensus"
    | "curated-override";
  identity: SpanIdentity;
  evidenceCount: number;
  confidence: number;
  margin: number;
  lowMargin: boolean;
  evidence: string[];
  analysis: EnglishSpanAnalysis;
}

function intrinsicDecisionForSpan(
  span: SpanRecord,
  sourcePartOfSpeech: string | undefined,
  entityAliasesByCode: Map<string, Set<string>>
): IntrinsicDecision {
  const lemma = normalizeLemma(span.lemma);
  const resolution = resolveEnglishPartOfSpeech({
    verseText: span.verseText,
    startOffset: span.startOffset,
    length: span.length,
    lemma: span.lemma,
    currentPartOfSpeech: span.partOfSpeech,
    ...(sourcePartOfSpeech ? { sourcePartOfSpeech } : {})
  });
  const identity =
    [...span.identities].sort(compareIdentitySpecificity)[0] ??
    ({ kind: 0, code: "LEXICAL" } as const);
  const h0430g = span.identities.find(
    ({ kind, code }) => kind === 2 && normalizeIdentity(code) === "H430G"
  );
  const h0430 =
    h0430g ??
    span.identities.find(
      ({ kind, code }) => kind === 0 && normalizeIdentity(code) === "H430"
    );
  if (h0430 && lemma === "god") {
    const divine =
      resolution.head?.normalized === "god" &&
      isCapitalizedLemmaHead(resolution, lemma);
    return {
      partOfSpeech: divine ? "name" : "noun",
      method: "surface-divine-identity",
      identity: h0430,
      evidenceCount: 1,
      confidence: 1,
      margin: 10,
      lowMargin: false,
      analysis: resolution,
      evidence: [
        ...resolution.evidence,
        divine ? "surface-divine-name:God" : "surface-common-divine-noun"
      ]
    };
  }
  const jehovahIdentity =
    span.identities.find(({ code }) =>
      new Set(["H3068", "H3068G"]).has(normalizeIdentity(code))
    ) ?? [...span.identities].sort(compareIdentitySpecificity)[0];
  if (lemma === "jehovah") {
    return {
      partOfSpeech: "name",
      method: jehovahIdentity ? "surface-divine-identity" : "curated-override",
      identity: jehovahIdentity ?? { kind: 0, code: "H3068" },
      evidenceCount: 1,
      confidence: 1,
      margin: 10,
      lowMargin: false,
      analysis: resolution,
      evidence: [...resolution.evidence, "curated-divine-name:Jehovah"]
    };
  }

  for (const identity of [...span.identities].sort(
    compareIdentitySpecificity
  )) {
    const aliases = entityAliasesByCode.get(normalizeIdentity(identity.code));
    if (
      aliases?.has(lemma) &&
      isCapitalizedLemmaHead(resolution, lemma) &&
      (sourcePartOfSpeech === "name" || span.partOfSpeech === "name")
    ) {
      return {
        partOfSpeech: "name",
        method: "surface-entity",
        identity,
        evidenceCount: aliases.size,
        confidence: 1,
        margin: 10,
        lowMargin: false,
        analysis: resolution,
        evidence: [
          ...resolution.evidence,
          `entity-alias:${lemma}`,
          `entity-guard:${sourcePartOfSpeech ?? span.partOfSpeech}`
        ]
      };
    }
  }

  return {
    partOfSpeech: resolution.partOfSpeech,
    method: resolution.method,
    identity,
    evidenceCount: Math.max(1, resolution.candidates.length),
    confidence: resolution.confidence,
    margin: resolution.margin,
    lowMargin: resolution.lowMargin,
    analysis: resolution,
    evidence: resolution.evidence
  };
}

function buildConsensusDecisions(
  votes: Map<string, VoteBucket>
): EnglishLexemeConsensusDecision[] {
  const decisions: EnglishLexemeConsensusDecision[] = [];
  for (const [key, bucket] of [...votes.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    const [kindValue, identityCode, lemma] = key.split("\u0000");
    const identityKind = Number(kindValue) as 0 | 1 | 2;
    const ranked = rankCounts(bucket.partOfSpeech);
    const winner = ranked[0];
    if (!winner || bucket.evidenceCount < 5) continue;
    const runnerUpCount = ranked[1]?.[1] ?? 0;
    const confidence = winner[1] / bucket.evidenceCount;
    if (confidence < 0.9 || winner[1] - runnerUpCount < 3) continue;

    const sourceRanked = rankCounts(bucket.sourcePartOfSpeech);
    const sourceWinner = sourceRanked[0];
    const sourceEvidenceCount = sumCounts(bucket.sourcePartOfSpeech);
    const sourceConfidence =
      sourceWinner && sourceEvidenceCount > 0
        ? sourceWinner[1] / sourceEvidenceCount
        : 0;
    const sourcePartOfSpeech =
      sourceWinner && sourceEvidenceCount >= 3 && sourceConfidence >= 0.9
        ? sourceWinner[0]
        : undefined;

    if (sourcePartOfSpeech && sourcePartOfSpeech !== winner[0]) continue;
    if (
      !sourcePartOfSpeech &&
      (confidence < 0.98 || bucket.evidenceCount < 20)
    ) {
      continue;
    }
    decisions.push({
      identityKind,
      identityCode,
      lemma,
      partOfSpeech: winner[0],
      method: "cross-version-consensus",
      evidenceCount: bucket.evidenceCount,
      confidence: Number(confidence.toFixed(6)),
      ...(sourcePartOfSpeech ? { sourcePartOfSpeech } : {})
    });
  }
  return decisions;
}

function* readSpans(
  database: DatabaseSync,
  verseTexts: ReadonlyMap<string, string>
): Iterable<SpanRecord> {
  const rows = database
    .prepare(
      `SELECT w.verseId, w.ordinal, w.startOffset, w.length, w.stepTokenId,
              v.bookOrder, v.chapter, v.verse,
              l.lemma, l.partOfSpeech, c.kind, c.code
         FROM WordSpans w
         JOIN Verses v ON v.id=w.verseId
         JOIN FrenchLexemes l ON l.id=w.lexemeId
         LEFT JOIN WordStrongCodes x
           ON x.verseId=w.verseId AND x.ordinal=w.ordinal
         LEFT JOIN StrongCodes c ON c.id=x.codeId
        ORDER BY w.verseId, w.ordinal, c.kind, c.code`
    )
    .iterate() as Iterable<{
    verseId: number;
    ordinal: number;
    startOffset: number;
    length: number;
    stepTokenId: number | null;
    bookOrder: number;
    chapter: number;
    verse: number;
    lemma: string;
    partOfSpeech: string;
    kind: number | null;
    code: string | null;
  }>;
  let current: SpanRecord | undefined;
  for (const row of rows) {
    if (
      !current ||
      current.verseId !== row.verseId ||
      current.ordinal !== row.ordinal
    ) {
      if (current) yield current;
      current = {
        verseId: row.verseId,
        ordinal: row.ordinal,
        stepTokenId: row.stepTokenId,
        bookOrder: row.bookOrder,
        chapter: row.chapter,
        verse: row.verse,
        startOffset: row.startOffset,
        length: row.length,
        verseText: requiredVerseText(
          verseTexts,
          row.bookOrder,
          row.chapter,
          row.verse
        ),
        lemma: row.lemma,
        partOfSpeech: row.partOfSpeech,
        identities: []
      };
    }
    if (row.kind !== null && row.code) {
      current.identities.push({
        kind: row.kind as IdentityKind,
        code: normalizeIdentity(row.code)
      });
    }
  }
  if (current) yield current;
}

function lexicalIdentities(
  identities: SpanIdentity[]
): Array<SpanIdentity & { kind: 0 | 1 | 2 }> {
  return identities.filter(
    (identity): identity is SpanIdentity & { kind: 0 | 1 | 2 } =>
      identity.kind === 0 || identity.kind === 1 || identity.kind === 2
  );
}

function recordLexicalCandidates(
  output: Map<
    string,
    {
      normalizedSurface: string;
      lemma: string;
      partOfSpeech: string;
      source: typeof ENGLISH_POS_RESOLVER_POLICY;
    }
  >,
  span: SpanRecord,
  analysis: EnglishSpanAnalysis
): void {
  const normalizedSurface =
    analysis.head?.normalized ||
    normalizeEnglishWord(analysis.surface) ||
    normalizeLemma(span.lemma);
  const lemma = normalizeLemma(span.lemma);
  for (const partOfSpeech of analysis.candidates) {
    const key = `${normalizedSurface}\u0000${lemma}\u0000${partOfSpeech}`;
    output.set(key, {
      normalizedSurface,
      lemma,
      partOfSpeech,
      source: ENGLISH_POS_RESOLVER_POLICY
    });
  }
}

function requiredVerseText(
  verseTexts: ReadonlyMap<string, string>,
  bookOrder: number,
  chapter: number,
  verse: number
): string {
  const key = verseTextKey(bookOrder, chapter, verse);
  const value = verseTexts.get(key);
  if (value === undefined) {
    throw new Error(`english-lexeme-canonical-verse-missing:${key}`);
  }
  return value;
}

export function verseTextKey(
  bookOrder: number,
  chapter: number,
  verse: number
): string {
  return `${bookOrder}:${chapter}:${verse}`;
}

function loadEntityAliasIndex(path: string): {
  aliasesByCode: Map<string, Set<string>>;
  digest: string;
} {
  const database = new DatabaseSync(path, { readOnly: true });
  const rows: Array<{
    uniqueName: string;
    entityDisplayName: string;
    uStrong: string;
    dStrong: string;
    nameDisplayName: string;
  }> = [];
  try {
    for (const row of database
      .prepare(
        `SELECT e.uniqueName, e.displayName AS entityDisplayName, e.uStrong,
                n.dStrong, n.displayName AS nameDisplayName
           FROM Entities e
           JOIN EntityNames n ON n.entityId=e.id
          ORDER BY e.uniqueName, n.dStrong, n.displayName`
      )
      .iterate() as Iterable<{
      uniqueName: string;
      entityDisplayName: string;
      uStrong: string;
      dStrong: string;
      nameDisplayName: string;
    }>) {
      rows.push(row);
    }
  } finally {
    database.close();
  }
  const aliasesByCode = new Map<string, Set<string>>();
  for (const row of rows) {
    const aliases = new Set(
      [
        row.uniqueName.split("@", 1)[0] ?? "",
        row.entityDisplayName,
        cleanEntityDisplayName(row.nameDisplayName)
      ]
        .map(normalizeEntityAlias)
        .filter((value): value is string => Boolean(value))
    );
    for (const rawCode of [row.uStrong, row.dStrong]) {
      const code = normalizeIdentity(rawCode);
      if (!code) continue;
      const values = aliasesByCode.get(code) ?? new Set<string>();
      for (const alias of aliases) values.add(alias);
      aliasesByCode.set(code, values);
    }
  }
  return {
    aliasesByCode,
    digest: sha256Canonical(
      [...aliasesByCode.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([code, aliases]) => [code, [...aliases].sort()])
    )
  };
}

function loadStepMorphologyIndex(path: string): {
  byTokenId: Map<number, string>;
  digest: string;
} {
  const database = new DatabaseSync(path, { readOnly: true });
  const categoriesByToken = new Map<number, Set<string>>();
  const digestRows: Array<[number, string]> = [];
  try {
    for (const row of database
      .prepare(
        `SELECT s.tokenId, m.code
           FROM Segments s
           JOIN Morphologies m ON m.id=s.morphologyId
          ORDER BY s.tokenId, s.ordinal`
      )
      .iterate() as Iterable<{ tokenId: number; code: string }>) {
      digestRows.push([row.tokenId, row.code]);
      const category = classifyMorphology(row.code);
      if (!category) continue;
      const values = categoriesByToken.get(row.tokenId) ?? new Set<string>();
      values.add(category);
      categoriesByToken.set(row.tokenId, values);
    }
  } finally {
    database.close();
  }
  const byTokenId = new Map<number, string>();
  for (const [tokenId, categories] of categoriesByToken) {
    if (categories.size === 1) {
      byTokenId.set(tokenId, [...categories][0]!);
    }
  }
  return {
    byTokenId,
    digest: sha256Canonical(digestRows)
  };
}

function classifyMorphology(value: string): string | undefined {
  const parts = value.split(/[/=;+ ]+/u).filter(Boolean);
  const categories = new Set<string>();
  for (const part of parts) {
    if (/^(?:H?Np|N-PRI)/u.test(part)) categories.add("name");
    else if (/^(?:H?N|N-)/u.test(part)) categories.add("noun");
    else if (/^(?:H?V|V-)/u.test(part)) categories.add("verb");
    else if (/^(?:H?A|A-)/u.test(part)) categories.add("adj");
    else if (/^(?:ADV|HD)/u.test(part)) categories.add("adv");
  }
  return categories.size === 1 ? [...categories][0] : undefined;
}

function readRemainingCanaries(
  database: DatabaseSync,
  entityAliasesByCode: Map<string, Set<string>>,
  verseTexts: ReadonlyMap<string, string>
): EnglishLexemeBibleRefinementResult["remainingCanaries"] {
  let h0430gVerb = 0;
  let h0430gCommonNotNoun = 0;
  let h0430gDivineNotName = 0;
  let jehovahNotName = 0;
  let capitalizedEntityVerb = 0;
  let knownLowercaseName = 0;
  let indeterminate = 0;
  for (const span of readSpans(database, verseTexts)) {
    const lemma = normalizeLemma(span.lemma);
    const analysis = analyzeEnglishSpan({
      verseText: span.verseText,
      startOffset: span.startOffset,
      length: span.length,
      lemma: span.lemma
    });
    const capitalized = isCapitalizedLemmaHead(analysis, lemma);
    const h0430g = span.identities.some(
      ({ kind, code }) => kind === 2 && normalizeIdentity(code) === "H430G"
    );
    if (!span.partOfSpeech.trim() || isIndeterminate(span.partOfSpeech)) {
      indeterminate += 1;
    }
    if (span.partOfSpeech === "verb" && lemma === "god" && h0430g) {
      h0430gVerb += 1;
    }
    if (h0430g && lemma === "god") {
      const divine = analysis.head?.normalized === "god" && capitalized;
      if (divine && span.partOfSpeech !== "name") {
        h0430gDivineNotName += 1;
      }
      if (!divine && span.partOfSpeech !== "noun") {
        h0430gCommonNotNoun += 1;
      }
    }
    if (lemma === "jehovah" && span.partOfSpeech !== "name") {
      jehovahNotName += 1;
    }
    if (
      span.partOfSpeech === "verb" &&
      capitalized &&
      span.identities.some((identity) =>
        entityAliasesByCode.get(normalizeIdentity(identity.code))?.has(lemma)
      )
    ) {
      capitalizedEntityVerb += 1;
    }
    if (
      span.partOfSpeech === "name" &&
      !isCapitalizedLemmaHead(analysis, lemma)
    ) {
      knownLowercaseName += 1;
    }
  }
  return {
    h0430gVerb,
    h0430gCommonNotNoun,
    h0430gDivineNotName,
    jehovahNotName,
    capitalizedEntityVerb,
    knownLowercaseName,
    indeterminate
  };
}

function readMetadata(database: DatabaseSync): Record<string, string> {
  const values: Record<string, string> = {};
  for (const row of database
    .prepare(`SELECT key, value FROM ResourceMetadata`)
    .iterate() as Iterable<{ key: string; value: string }>) {
    values[row.key] = row.value;
  }
  return values;
}

function writeMetadata(
  database: DatabaseSync,
  values: Record<string, string>
): void {
  const statement = database.prepare(
    `INSERT OR REPLACE INTO ResourceMetadata(key, value) VALUES (?, ?)`
  );
  for (const [key, value] of Object.entries(values).sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    statement.run(key, value);
  }
}

function cleanEntityDisplayName(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .split(/\s+(?:=|\(|\[)/u, 1)[0]!
    .trim();
}

function normalizeEntityAlias(value: string): string | undefined {
  const normalized = normalizeLemma(value);
  if (!/^[\p{L}\p{M}][\p{L}\p{M}.'’_-]*$/u.test(normalized)) {
    return undefined;
  }
  return normalized;
}

function normalizeLemma(value: string): string {
  return value
    .trim()
    .toLocaleLowerCase("en")
    .normalize("NFC")
    .replace(/[’']s$/u, "");
}

function normalizeIdentity(value: string): string {
  const trimmed = value.trim().normalize("NFC");
  const match = /^([HG])0*(\d+)(.*)$/u.exec(trimmed);
  if (!match) return trimmed;
  return `${match[1]}${Number(match[2])}${match[3] ?? ""}`;
}

function decisionKey(kind: 0 | 1 | 2, code: string, lemma: string): string {
  return `${kind}\u0000${normalizeIdentity(code)}\u0000${normalizeLemma(lemma)}`;
}

function increment(values: Map<string, number>, key: string): void {
  values.set(key, (values.get(key) ?? 0) + 1);
}

function rankCounts(values: Map<string, number>): Array<[string, number]> {
  return [...values.entries()].sort(
    ([leftKey, leftCount], [rightKey, rightCount]) =>
      rightCount - leftCount || leftKey.localeCompare(rightKey)
  );
}

function sumCounts(values: Map<string, number>): number {
  return [...values.values()].reduce((sum, value) => sum + value, 0);
}

function countBy<T>(
  values: T[],
  key: (value: T) => string
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) {
    const name = key(value);
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right))
  );
}

function compareIdentitySpecificity(
  left: SpanIdentity,
  right: SpanIdentity
): number {
  const priority: Record<IdentityKind, number> = {
    2: 0,
    3: 1,
    1: 2,
    0: 3
  };
  return (
    priority[left.kind] - priority[right.kind] ||
    left.code.localeCompare(right.code)
  );
}

function compareCorrections(
  left: EnglishLexemeCorrection,
  right: EnglishLexemeCorrection
): number {
  return (
    left.bookOrder - right.bookOrder ||
    left.chapter - right.chapter ||
    left.verse - right.verse ||
    left.ordinal - right.ordinal ||
    left.lemma.localeCompare(right.lemma)
  );
}

function isIndeterminate(value: string): boolean {
  return new Set([
    "unknown",
    "undetermined",
    "unresolved",
    "indeterminate",
    "indéterminé"
  ]).has(value.trim().toLocaleLowerCase("en"));
}

function sha256Canonical(value: unknown): string {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}
