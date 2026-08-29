import { createHash } from "node:crypto";

import rawCatalog from "./sources/english-supplemental-gloss-audit-catalog.json" with { type: "json" };

export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SCHEMA_VERSION =
  "lexicon-v3-english-supplemental-gloss-audit-catalog@1" as const;
export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_POLICY_VERSION =
  "lexicon-v3-english-supplemental-gloss-audit-policy@1" as const;
export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_SCHEMA_VERSION =
  "lexicon-v3-english-supplemental-gloss-audit-witness-replay@1" as const;

export const PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES = Object.freeze({
  database: "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
  TBESG: "e8f58a8f841f2a338b3df648466a773928127e6080c06d32ee88694fb761facb",
  TFLSJ: "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691",
  TAGNT: Object.freeze({
    "TAGNT Act-Rev.txt":
      "524e32375361e6d3fa2f7ef00b87605fdc4317a762f395651a05fdc31ad031b7",
    "TAGNT Mat-Jhn.txt":
      "ab8eaaeb68e17a1dcfa34e1e9350358f22f03bc2a97244d848750ad81044bc8e"
  })
});

export type EnglishSupplementalGlossAuditClassification =
  | "EXACT_REPAIR"
  | "HOLD"
  | "RECONSTRUCTION"
  | "VALID_POLYSENSE";
export type EnglishSupplementalGlossAuditSourceFamily = "TBESG" | "TFLSJ";

export interface EnglishSupplementalGlossAuditIdentity {
  language: "greek";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
}

export interface EnglishSupplementalGlossAuditWitness {
  sourceFamily: EnglishSupplementalGlossAuditSourceFamily;
  role: string;
  locator: string;
  expectedLineDigest: string;
  exactFragments: readonly string[];
}

export interface EnglishSupplementalGlossAuditRule {
  batch: 1 | 2 | 3;
  entryKey: string;
  identity: EnglishSupplementalGlossAuditIdentity;
  rawGloss: string;
  rawMeaning: string;
  sourceRecordDigest: string;
  classification: EnglishSupplementalGlossAuditClassification;
  confidence: number;
  semanticClass: string | null;
  repairMethod: string | null;
  proposedMorph: string | null;
  proposedGloss: string | null;
  proposedMeaning: string | null;
  rationale: string;
  semanticBridge: string;
  expectedExactOccurrenceCount: 0;
  occurrenceCorpusDigest: string;
  witnesses: readonly EnglishSupplementalGlossAuditWitness[];
  holdReasons: readonly string[];
}

export interface EnglishSupplementalGlossAuditCatalog {
  schemaVersion: typeof ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SCHEMA_VERSION;
  policyVersion: typeof ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_POLICY_VERSION;
  sourceDigests: typeof PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES;
  expectedEntryCount: 132;
  batches: ReadonlyArray<{
    id: string;
    expectedEntryKeys: readonly string[];
  }>;
  entries: readonly EnglishSupplementalGlossAuditRule[];
}

export interface EnglishSupplementalGlossAuditWitnessReplayContext {
  schemaVersion: typeof ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_SCHEMA_VERSION;
  catalogDigest: string;
  ruleSetDigest: string;
  sourceDigests: Readonly<
    Record<EnglishSupplementalGlossAuditSourceFamily, string>
  >;
  entryCount: number;
  witnessCount: number;
  uniqueLocatorCount: number;
  fragmentCount: number;
  witnessCorpusDigest: string;
  replayDigest: string;
  /** Exact UTF-8 source lines, without their LF/CRLF terminator, by locator. */
  sourceLines: Readonly<Record<string, string>>;
}

export const EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST =
  "2db63d6c4d9623c701da28d185f92be6eb25943551ac27a8da74dd49d416eca3" as const;
export const EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_DIGEST =
  "f55bbbd5d6431c4deee601f62a01365980a64e7bcab43133da3c832d96b63cc4" as const;

const catalog = validateCatalog(rawCatalog);

export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG = catalog;
export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST = sha256(
  stableJson(catalog)
);
export const ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_RULES: ReadonlyMap<
  string,
  EnglishSupplementalGlossAuditRule
> = new Map(catalog.entries.map((entry) => [entry.entryKey, entry]));

if (
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST !==
  EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST
) {
  throw new Error("english-supplemental-gloss-audit-catalog-drift");
}

export function getEnglishSupplementalGlossAuditRule(
  entryKey: string
): EnglishSupplementalGlossAuditRule | null {
  return ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_RULES.get(entryKey) ?? null;
}

/**
 * Replays exact supplemental witness locators against the pinned STEP texts.
 * This lower-level form accepts an explicit rule set so drift behavior can be
 * tested without mutating the sealed canonical catalog.
 */
export function replayEnglishSupplementalGlossAuditWitnesses(
  sourceTexts: Readonly<
    Record<EnglishSupplementalGlossAuditSourceFamily, string>
  >,
  rules: readonly EnglishSupplementalGlossAuditRule[]
): EnglishSupplementalGlossAuditWitnessReplayContext {
  const sources = new Map<
    EnglishSupplementalGlossAuditSourceFamily,
    { bytes: Buffer; offsets: number[]; digest: string }
  >();
  const sourceDigests = {} as Record<
    EnglishSupplementalGlossAuditSourceFamily,
    string
  >;
  for (const sourceFamily of ["TBESG", "TFLSJ"] as const) {
    const text = sourceTexts[sourceFamily];
    if (typeof text !== "string") {
      throw new Error(
        `english-supplemental-gloss-audit-witness-source-missing:${sourceFamily}`
      );
    }
    const bytes = Buffer.from(text, "utf8");
    const digest = sha256(text);
    if (
      digest !== PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES[sourceFamily]
    ) {
      throw new Error(
        `english-supplemental-gloss-audit-witness-source-drift:${sourceFamily}`
      );
    }
    const offsets = [0];
    for (let index = 0; index < bytes.length; index += 1) {
      if (bytes[index] === 0x0a) offsets.push(index + 1);
    }
    sources.set(sourceFamily, { bytes, offsets, digest });
    sourceDigests[sourceFamily] = digest;
  }

  const sourceLines: Record<string, string> = {};
  const witnessProofs: Array<{
    entryKey: string;
    witnessIndex: number;
    sourceFamily: EnglishSupplementalGlossAuditSourceFamily;
    role: string;
    locator: string;
    lineDigest: string;
    fragmentDigests: string[];
  }> = [];
  let witnessCount = 0;
  let fragmentCount = 0;

  for (const rule of rules) {
    for (
      let witnessIndex = 0;
      witnessIndex < rule.witnesses.length;
      witnessIndex += 1
    ) {
      const witness = rule.witnesses[witnessIndex]!;
      witnessCount += 1;
      const parsed = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(witness.locator);
      if (!parsed || parsed[1] !== witness.sourceFamily) {
        throw new Error(
          `english-supplemental-gloss-audit-witness-invalid-locator:${rule.entryKey}:${witness.locator}`
        );
      }
      const lineNumber = Number(parsed[2]);
      const byteOffset = Number(parsed[3]);
      if (
        !Number.isSafeInteger(lineNumber) ||
        lineNumber < 1 ||
        !Number.isSafeInteger(byteOffset) ||
        byteOffset < 0
      ) {
        throw new Error(
          `english-supplemental-gloss-audit-witness-invalid-locator:${rule.entryKey}:${witness.locator}`
        );
      }

      const source = sources.get(witness.sourceFamily)!;
      const actualOffset = source.offsets[lineNumber - 1];
      if (actualOffset !== byteOffset) {
        const actualLineAtOffset = source.offsets.indexOf(byteOffset);
        const reason =
          actualLineAtOffset >= 0 ? "line-number-drift" : "byte-offset-drift";
        throw new Error(
          `english-supplemental-gloss-audit-witness-${reason}:${rule.entryKey}:${witness.locator}`
        );
      }

      const lf = source.bytes.indexOf(0x0a, byteOffset);
      let end = lf === -1 ? source.bytes.length : lf;
      if (end > byteOffset && source.bytes[end - 1] === 0x0d) end -= 1;
      const exactLine = source.bytes.subarray(byteOffset, end).toString("utf8");
      const lineDigest = sha256(exactLine);
      if (lineDigest !== witness.expectedLineDigest) {
        throw new Error(
          `english-supplemental-gloss-audit-witness-line-digest-drift:${rule.entryKey}:${witness.locator}`
        );
      }

      const fragmentDigests: string[] = [];
      for (
        let fragmentIndex = 0;
        fragmentIndex < witness.exactFragments.length;
        fragmentIndex += 1
      ) {
        const fragment = witness.exactFragments[fragmentIndex];
        if (typeof fragment !== "string" || fragment.length === 0) {
          throw new Error(
            `english-supplemental-gloss-audit-witness-invalid-fragment:${rule.entryKey}:${witness.locator}:${fragmentIndex}`
          );
        }
        if (!exactLine.includes(fragment)) {
          throw new Error(
            `english-supplemental-gloss-audit-witness-fragment-drift:${rule.entryKey}:${witness.locator}:${fragmentIndex}`
          );
        }
        fragmentDigests.push(sha256(fragment));
        fragmentCount += 1;
      }

      const previousLine = sourceLines[witness.locator];
      if (previousLine !== undefined && previousLine !== exactLine) {
        throw new Error(
          `english-supplemental-gloss-audit-witness-locator-collision:${witness.locator}`
        );
      }
      sourceLines[witness.locator] = exactLine;
      witnessProofs.push({
        entryKey: rule.entryKey,
        witnessIndex,
        sourceFamily: witness.sourceFamily,
        role: witness.role,
        locator: witness.locator,
        lineDigest,
        fragmentDigests
      });
    }
  }

  const ruleSetDigest = sha256(stableJson(rules));
  const witnessCorpusDigest = sha256(stableJson(witnessProofs));
  const withoutReplayDigest = {
    schemaVersion:
      ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_SCHEMA_VERSION,
    catalogDigest: ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
    ruleSetDigest,
    sourceDigests,
    entryCount: rules.length,
    witnessCount,
    uniqueLocatorCount: Object.keys(sourceLines).length,
    fragmentCount,
    witnessCorpusDigest
  };
  return Object.freeze({
    ...withoutReplayDigest,
    replayDigest: sha256(stableJson(withoutReplayDigest)),
    sourceLines: Object.freeze(sourceLines)
  });
}

/** Builds and seals the production replay context for all 132 catalog rows. */
export function buildEnglishSupplementalGlossAuditWitnessContext(
  sourceTexts: Readonly<
    Record<EnglishSupplementalGlossAuditSourceFamily, string>
  >
): EnglishSupplementalGlossAuditWitnessReplayContext {
  const context = replayEnglishSupplementalGlossAuditWitnesses(
    sourceTexts,
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries
  );
  if (
    context.entryCount !==
      ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.expectedEntryCount ||
    context.witnessCount === 0 ||
    context.fragmentCount === 0
  ) {
    throw new Error("english-supplemental-gloss-audit-witness-coverage-drift");
  }
  if (
    context.replayDigest !==
    EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_DIGEST
  ) {
    throw new Error("english-supplemental-gloss-audit-witness-replay-drift");
  }
  return context;
}

function validateCatalog(value: unknown): EnglishSupplementalGlossAuditCatalog {
  const catalogValue = requireRecord(value, "catalog");
  requireEqual(
    catalogValue.schemaVersion,
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SCHEMA_VERSION,
    "schema-version"
  );
  requireEqual(
    catalogValue.policyVersion,
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_POLICY_VERSION,
    "policy-version"
  );
  requireEqual(catalogValue.expectedEntryCount, 132, "expected-entry-count");
  requireEqual(
    stableJson(catalogValue.sourceDigests),
    stableJson(PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES),
    "source-digests"
  );
  if (
    !Array.isArray(catalogValue.batches) ||
    catalogValue.batches.length !== 3
  ) {
    throw new Error("english-supplemental-gloss-audit-invalid-batches");
  }
  if (
    !Array.isArray(catalogValue.entries) ||
    catalogValue.entries.length !== 132
  ) {
    throw new Error("english-supplemental-gloss-audit-invalid-entry-count");
  }

  const expectedKeys: string[] = [];
  for (let index = 0; index < catalogValue.batches.length; index += 1) {
    const batch = requireRecord(
      catalogValue.batches[index],
      `batch:${index + 1}`
    );
    requireEqual(
      batch.id,
      `supplemental-gloss-audit-batch-${index + 1}`,
      `batch-id:${index + 1}`
    );
    if (
      !Array.isArray(batch.expectedEntryKeys) ||
      batch.expectedEntryKeys.length !== 44
    ) {
      throw new Error(
        `english-supplemental-gloss-audit-invalid-batch-coverage:${index + 1}`
      );
    }
    expectedKeys.push(
      ...batch.expectedEntryKeys.map((key) => requireString(key, "entry-key"))
    );
  }

  const observedKeys = catalogValue.entries.map((rawEntry, index) => {
    const entry = validateEntry(rawEntry, index);
    return entry.entryKey;
  });
  requireEqual(
    stableJson(observedKeys),
    stableJson(expectedKeys),
    "entry-order"
  );
  if (new Set(observedKeys).size !== observedKeys.length) {
    throw new Error("english-supplemental-gloss-audit-duplicate-entry-key");
  }

  const counts = new Map<EnglishSupplementalGlossAuditClassification, number>();
  for (const rawEntry of catalogValue.entries) {
    const classification = (
      rawEntry as {
        classification: EnglishSupplementalGlossAuditClassification;
      }
    ).classification;
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
  }
  const expectedCounts: Readonly<
    Record<EnglishSupplementalGlossAuditClassification, number>
  > = {
    EXACT_REPAIR: 62,
    HOLD: 0,
    RECONSTRUCTION: 3,
    VALID_POLYSENSE: 67
  };
  for (const [classification, expected] of Object.entries(expectedCounts)) {
    requireEqual(
      counts.get(
        classification as EnglishSupplementalGlossAuditClassification
      ) ?? 0,
      expected,
      `classification-count:${classification}`
    );
  }

  return value as EnglishSupplementalGlossAuditCatalog;
}

function validateEntry(
  value: unknown,
  index: number
): EnglishSupplementalGlossAuditRule {
  const entry = requireRecord(value, `entry:${index}`);
  const identity = requireRecord(entry.identity, `identity:${index}`);
  const entryKey = requireString(entry.entryKey, `entry-key:${index}`);
  const dStrong = requireString(identity.dStrong, `dstrong:${entryKey}`);
  const code = /^((?:G)\d+[A-Z]?)\b/u.exec(dStrong)?.[1];
  requireEqual(
    entryKey,
    code ? `greek:${code}` : null,
    `identity-key:${entryKey}`
  );
  requireEqual(identity.language, "greek", `language:${entryKey}`);
  requireEqual(entry.batch, Math.floor(index / 44) + 1, `batch:${entryKey}`);

  const rawGloss = requireString(entry.rawGloss, `raw-gloss:${entryKey}`);
  const rawMeaning = requireString(entry.rawMeaning, `raw-meaning:${entryKey}`);
  const sourceRecord = {
    language: identity.language,
    eStrong: requireString(identity.eStrong, `estrong:${entryKey}`),
    dStrong,
    uStrong: requireString(identity.uStrong, `ustrong:${entryKey}`),
    original: requireString(identity.original, `original:${entryKey}`),
    transliteration: requireString(
      identity.transliteration,
      `transliteration:${entryKey}`
    ),
    morph: requireString(identity.morph, `morph:${entryKey}`),
    gloss: rawGloss,
    meaning: rawMeaning
  };
  requireEqual(
    entry.sourceRecordDigest,
    sha256(stableJson(sourceRecord)),
    `source-record-digest:${entryKey}`
  );

  const classification = entry.classification;
  if (
    classification !== "EXACT_REPAIR" &&
    classification !== "HOLD" &&
    classification !== "RECONSTRUCTION" &&
    classification !== "VALID_POLYSENSE"
  ) {
    throw new Error(
      `english-supplemental-gloss-audit-invalid-classification:${entryKey}`
    );
  }
  const confidence = entry.confidence;
  if (typeof confidence !== "number" || confidence < 0 || confidence > 1) {
    throw new Error(
      `english-supplemental-gloss-audit-invalid-confidence:${entryKey}`
    );
  }
  requireEqual(
    entry.expectedExactOccurrenceCount,
    0,
    `exact-occurrence-count:${entryKey}`
  );
  requireDigest(entry.occurrenceCorpusDigest, `occurrence-corpus:${entryKey}`);

  const proposedGloss = entry.proposedGloss;
  const proposedMeaning = entry.proposedMeaning;
  const proposedMorph = entry.proposedMorph;
  if (classification === "HOLD") {
    requireEqual(proposedMorph, null, `hold-morph:${entryKey}`);
    requireEqual(proposedGloss, null, `hold-gloss:${entryKey}`);
    requireEqual(proposedMeaning, null, `hold-meaning:${entryKey}`);
    if (!Array.isArray(entry.holdReasons) || entry.holdReasons.length === 0) {
      throw new Error(
        `english-supplemental-gloss-audit-empty-hold:${entryKey}`
      );
    }
  } else {
    requireString(proposedMorph, `proposed-morph:${entryKey}`);
    requireString(proposedGloss, `proposed-gloss:${entryKey}`);
    requireString(proposedMeaning, `proposed-meaning:${entryKey}`);
    if (
      classification === "VALID_POLYSENSE" &&
      (proposedGloss !== rawGloss || proposedMeaning !== rawMeaning)
    ) {
      throw new Error(
        `english-supplemental-gloss-audit-polysense-mutates-fields:${entryKey}`
      );
    }
    if (
      classification !== "VALID_POLYSENSE" &&
      proposedMorph === identity.morph &&
      proposedGloss === rawGloss &&
      proposedMeaning === rawMeaning
    ) {
      throw new Error(
        `english-supplemental-gloss-audit-noop-change:${entryKey}`
      );
    }
  }

  requireString(entry.rationale, `rationale:${entryKey}`);
  requireString(entry.semanticBridge, `semantic-bridge:${entryKey}`);
  if (!Array.isArray(entry.witnesses) || entry.witnesses.length === 0) {
    throw new Error(
      `english-supplemental-gloss-audit-missing-witness:${entryKey}`
    );
  }
  for (const rawWitness of entry.witnesses) {
    const witness = requireRecord(rawWitness, `witness:${entryKey}`);
    if (witness.sourceFamily !== "TBESG" && witness.sourceFamily !== "TFLSJ") {
      throw new Error(
        `english-supplemental-gloss-audit-invalid-source-family:${entryKey}`
      );
    }
    const locator = requireString(witness.locator, `locator:${entryKey}`);
    if (!/^(TBESG|TFLSJ):\d+@\d+$/u.test(locator)) {
      throw new Error(
        `english-supplemental-gloss-audit-invalid-locator:${entryKey}`
      );
    }
    requireDigest(witness.expectedLineDigest, `line-digest:${entryKey}`);
    if (
      !Array.isArray(witness.exactFragments) ||
      witness.exactFragments.length === 0
    ) {
      throw new Error(
        `english-supplemental-gloss-audit-empty-fragments:${entryKey}`
      );
    }
    for (const fragment of witness.exactFragments) {
      requireString(fragment, `fragment:${entryKey}`);
    }
  }

  return value as EnglishSupplementalGlossAuditRule;
}

function requireRecord(value: unknown, field: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`english-supplemental-gloss-audit-invalid-record:${field}`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    throw new Error(`english-supplemental-gloss-audit-invalid-string:${field}`);
  }
  return value;
}

function requireDigest(value: unknown, field: string): void {
  if (typeof value !== "string" || !/^[0-9a-f]{64}$/u.test(value)) {
    throw new Error(`english-supplemental-gloss-audit-invalid-digest:${field}`);
  }
}

function requireEqual(actual: unknown, expected: unknown, field: string): void {
  if (actual !== expected) {
    throw new Error(`english-supplemental-gloss-audit-mismatch:${field}`);
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}
