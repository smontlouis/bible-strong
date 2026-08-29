import { createHash } from "node:crypto";

/**
 * This is an agreement threshold, not a fuzzy-similarity score. Every
 * significant STEP gloss token must occur verbatim in at least this share of
 * the exact-dStrong TAHOT occurrences. Contextual additions are harmless;
 * missing, inflected, or merely similar tokens are not counted.
 */
export const TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO = 0.8 as const;

export type TahotGlossProofReasonCode =
  | "tahot-gloss-candidate-empty"
  | "tahot-gloss-candidate-without-significant-token"
  | "tahot-gloss-dstrong-invalid"
  | "tahot-gloss-occurrence-dstrong-invalid"
  | "tahot-gloss-occurrence-dstrong-mismatch"
  | "tahot-gloss-occurrence-duplicate-locator"
  | "tahot-gloss-occurrence-gloss-empty"
  | "tahot-gloss-occurrence-locator-empty"
  | "tahot-gloss-occurrences-missing"
  | "tahot-gloss-token-coverage-incomplete"
  | "tahot-gloss-token-support-below-threshold"
  | "tahot-gloss-token-support-proven";

export interface TahotGlossOccurrenceInput {
  /** One extracted STEP dStrong code, without a relation or compound syntax. */
  dStrong: string;
  /** Raw contextual occurrence gloss from TAHOT. */
  gloss: string;
  /** Stable source locator, for example `Gen.1.1#03`. */
  locator: string;
}

export interface TahotGlossProofInput {
  /** Exact STEP dStrong of the lexicon row, without a relation. */
  dStrong: string;
  /** Raw English STEP lexicon gloss to corroborate. */
  gloss: string;
  occurrences: readonly TahotGlossOccurrenceInput[];
}

export interface TahotGlossTokenSupportFact {
  token: string;
  supportingOccurrenceCount: number;
  supportRatio: number;
  meetsThreshold: boolean;
}

export interface TahotGlossOccurrenceFact {
  locator: string;
  normalizedDStrong: string | null;
  normalizedGloss: string;
  tokens: string[];
  digest: string;
}

export interface TahotGlossProof {
  proven: boolean;
  reasonCodes: TahotGlossProofReasonCode[];
  normalizedDStrong: string | null;
  normalizedGloss: string;
  significantTokens: string[];
  facts: {
    occurrenceCount: number;
    usableExactOccurrenceCount: number;
    distinctLocatorCount: number;
    minimumTokenSupportRatio: typeof TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO;
    requiredSupportingOccurrenceCount: number;
    allSignificantTokensCovered: boolean;
    allSignificantTokensMeetThreshold: boolean;
    tokenSupport: TahotGlossTokenSupportFact[];
    occurrences: TahotGlossOccurrenceFact[];
  };
  digests: {
    candidateGloss: string;
    occurrenceCorpus: string;
    policy: string;
    proof: string;
  };
}

const STRICT_DSTRONG_PATTERN =
  /^([GH])0*(\d{1,5})([A-Za-z]?)(?:_([A-Za-z]))?$/u;

/**
 * Deliberately small list of English grammatical glue. Removing broader
 * vocabulary (for example `not`, `very`, `one`, or pronouns) could erase a
 * real lexical distinction, so those words remain significant.
 */
const ENGLISH_GLUE_TOKENS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with"
]);

const POLICY_DIGEST = sha256(
  JSON.stringify({
    policy: "tahot-exact-dstrong-complete-token-support@1",
    minimumTokenSupportRatio: TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO,
    glueTokens: [...ENGLISH_GLUE_TOKENS].sort(),
    normalization:
      "NFKC+lowercase+unicode-alphanumeric-tokenization+possessive-suffix-only",
    stemming: false,
    substringMatching: false
  })
);

/**
 * Corroborates a STEP English gloss against contextual TAHOT glosses for one
 * exact, case-sensitive dStrong. This is intentionally a pure, fail-closed
 * gate: malformed, empty, mixed-identity, or duplicated evidence invalidates
 * the proof instead of being silently discarded.
 */
export function proveTahotOccurrenceGlossSupport(
  input: TahotGlossProofInput
): TahotGlossProof {
  const reasons = new Set<TahotGlossProofReasonCode>();
  const normalizedDStrong = normalizeStrictDStrong(input.dStrong);
  if (!normalizedDStrong) reasons.add("tahot-gloss-dstrong-invalid");

  const rawGloss = input.gloss.trim();
  if (!rawGloss) reasons.add("tahot-gloss-candidate-empty");
  const normalizedGloss = normalizeGlossText(rawGloss);
  const significantTokens = significantGlossTokens(rawGloss);
  if (significantTokens.length === 0) {
    reasons.add("tahot-gloss-candidate-without-significant-token");
  }
  if (input.occurrences.length === 0) {
    reasons.add("tahot-gloss-occurrences-missing");
  }

  const occurrenceFacts = input.occurrences.map((occurrence) => {
    const occurrenceDStrong = normalizeStrictDStrong(occurrence.dStrong);
    const locator = occurrence.locator.trim();
    const occurrenceGloss = occurrence.gloss.trim();
    if (!occurrenceDStrong) {
      reasons.add("tahot-gloss-occurrence-dstrong-invalid");
    } else if (normalizedDStrong && occurrenceDStrong !== normalizedDStrong) {
      reasons.add("tahot-gloss-occurrence-dstrong-mismatch");
    }
    if (!locator) reasons.add("tahot-gloss-occurrence-locator-empty");
    if (!occurrenceGloss) {
      reasons.add("tahot-gloss-occurrence-gloss-empty");
    }

    const normalizedOccurrenceGloss = normalizeGlossText(occurrenceGloss);
    const tokens = tokenizeGloss(occurrenceGloss);
    return {
      locator,
      normalizedDStrong: occurrenceDStrong,
      normalizedGloss: normalizedOccurrenceGloss,
      tokens,
      digest: sha256(
        JSON.stringify({
          locator,
          dStrong: occurrence.dStrong,
          gloss: occurrence.gloss,
          normalizedDStrong: occurrenceDStrong,
          normalizedGloss: normalizedOccurrenceGloss,
          tokens
        })
      )
    } satisfies TahotGlossOccurrenceFact;
  });

  const distinctLocators = new Set(
    occurrenceFacts.map((occurrence) => occurrence.locator)
  );
  if (distinctLocators.size !== occurrenceFacts.length) {
    reasons.add("tahot-gloss-occurrence-duplicate-locator");
  }

  const usableOccurrences = occurrenceFacts.filter(
    (occurrence) =>
      Boolean(occurrence.locator) &&
      Boolean(occurrence.normalizedGloss) &&
      occurrence.normalizedDStrong === normalizedDStrong
  );
  const requiredSupportingOccurrenceCount = Math.ceil(
    usableOccurrences.length * TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO
  );
  const tokenSupport = significantTokens.map((token) => {
    const supportingOccurrenceCount = usableOccurrences.filter((occurrence) =>
      occurrence.tokens.includes(token)
    ).length;
    const supportRatio =
      usableOccurrences.length === 0
        ? 0
        : supportingOccurrenceCount / usableOccurrences.length;
    return {
      token,
      supportingOccurrenceCount,
      supportRatio,
      meetsThreshold:
        usableOccurrences.length > 0 &&
        supportingOccurrenceCount >= requiredSupportingOccurrenceCount
    } satisfies TahotGlossTokenSupportFact;
  });
  const allSignificantTokensCovered =
    significantTokens.length > 0 &&
    tokenSupport.every((support) => support.supportingOccurrenceCount > 0);
  const allSignificantTokensMeetThreshold =
    significantTokens.length > 0 &&
    tokenSupport.every((support) => support.meetsThreshold);
  if (!allSignificantTokensCovered) {
    reasons.add("tahot-gloss-token-coverage-incomplete");
  }
  if (!allSignificantTokensMeetThreshold) {
    reasons.add("tahot-gloss-token-support-below-threshold");
  }

  const blockingReasons = [...reasons];
  const proven = blockingReasons.length === 0;
  if (proven) reasons.add("tahot-gloss-token-support-proven");
  const reasonCodes = [...reasons].sort();
  const sortedOccurrenceFacts = [...occurrenceFacts].sort(
    (left, right) =>
      left.locator.localeCompare(right.locator) ||
      left.digest.localeCompare(right.digest)
  );
  const facts = {
    occurrenceCount: input.occurrences.length,
    usableExactOccurrenceCount: usableOccurrences.length,
    distinctLocatorCount: distinctLocators.size,
    minimumTokenSupportRatio: TAHOT_GLOSS_MIN_TOKEN_SUPPORT_RATIO,
    requiredSupportingOccurrenceCount,
    allSignificantTokensCovered,
    allSignificantTokensMeetThreshold,
    tokenSupport,
    occurrences: sortedOccurrenceFacts
  } satisfies TahotGlossProof["facts"];
  const digestsWithoutProof = {
    candidateGloss: sha256(input.gloss),
    occurrenceCorpus: sha256(
      JSON.stringify(
        sortedOccurrenceFacts.map((occurrence) => occurrence.digest)
      )
    ),
    policy: POLICY_DIGEST
  };
  const proofDigest = sha256(
    JSON.stringify({
      normalizedDStrong,
      normalizedGloss,
      significantTokens,
      facts,
      reasonCodes,
      digests: digestsWithoutProof
    })
  );

  return {
    proven,
    reasonCodes,
    normalizedDStrong,
    normalizedGloss,
    significantTokens,
    facts,
    digests: { ...digestsWithoutProof, proof: proofDigest }
  };
}

/** Prefix and numeric padding normalize; every suffix/variant letter keeps case. */
export function normalizeStrictDStrong(value: string): string | null {
  const match = STRICT_DSTRONG_PATTERN.exec(value.trim());
  if (!match) return null;
  const numeric = Number.parseInt(match[2] ?? "", 10);
  if (!Number.isSafeInteger(numeric) || numeric < 1) return null;
  return `${match[1]}${String(numeric).padStart(4, "0")}${match[3] ?? ""}${match[4] ? `_${match[4]}` : ""}`;
}

export function significantGlossTokens(value: string): string[] {
  return [
    ...new Set(
      tokenizeGloss(value).filter((token) => !ENGLISH_GLUE_TOKENS.has(token))
    )
  ];
}

function tokenizeGloss(value: string): string[] {
  const normalized = normalizeGlossText(value);
  const matches = normalized.match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
  return matches.map((token) =>
    token.endsWith("'s") && token.length > 2 ? token.slice(0, -2) : token
  );
}

function normalizeGlossText(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019\u02BC]/gu, "'")
    .toLocaleLowerCase("en-US")
    .trim()
    .replace(/\s+/gu, " ");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
