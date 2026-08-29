import { createHash } from "node:crypto";

import {
  canonicalFrenchEntityPolicyForms,
  frenchEntityPolicyContractForTreatment,
  FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION,
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION,
  isFrenchEntityBindingRelation,
  isFrenchEntityNameConstraint,
  isFrenchEntityNameTreatment
} from "./frenchEntityCanonicalization.js";
import { classifyFrenchEditorialPos } from "./frenchEditorialPolicy.js";
import { buildFrenchHtmlTemplate } from "./frenchHtmlRenderer.js";
import {
  canonicalFrenchInternalJson,
  hashFrenchInternalJson
} from "./frenchCodexExecutionReceipt.js";
import {
  buildLexiconEntryKey,
  extractPrimaryDStrong,
  normalizeStepStrongCode
} from "./identity.js";
import { stripLexiconHtml } from "./frenchValidation.js";

export const FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION =
  "lexicon-v3-french-entity-mentions@1" as const;
export const FRENCH_ENTITY_MENTIONS_POLICY_VERSION =
  "lexicon-v3-french-entity-mentions-policy@4" as const;

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const SUPPORTED_CANONICAL_ENTITY_SCHEMA_VERSION =
  "lexicon-v3-french-canonical-entity@1";
const SUPPORTED_CANONICAL_POLICY_SCHEMA_VERSION =
  FRENCH_CANONICAL_ENTRY_NAME_POLICY_SCHEMA_VERSION;
const SUPPORTED_CANONICAL_POLICY_VERSION =
  FRENCH_ENTITY_CANONICALIZATION_POLICY_VERSION;
const NAME_LIKE_TREATMENTS = new Set<
  FrenchEntityMentionCanonicalPolicy["treatment"]
>([
  "canonical-name",
  "alternate-name",
  "unregistered-proper-name",
  "gentilic",
  "title-or-epithet",
  "compound-name"
]);
const NON_ENTITY_TREATMENTS = new Set<
  FrenchEntityMentionCanonicalPolicy["treatment"]
>(["etymological-or-common-gloss"]);
const CITED_STEP_PATTERN =
  /(?<![\p{L}\p{N}])([GH])(\d{1,5})([A-Za-z]?)(?:_([A-Za-z]))?(?:\/([A-Za-z])(?:_([A-Za-z]))?)?(?![\p{L}\p{N}])/gu;
const CONTAINS_CITED_STEP_PATTERN =
  /(?<![\p{L}\p{N}])[GH]\d{1,5}[A-Za-z]?(?:_[A-Za-z])?(?![\p{L}\p{N}])/u;

export type FrenchEntityMentionResolution =
  | "exact"
  | "contextual"
  | "ambiguous"
  | "non-entity"
  | "quarantined";

export interface FrenchEntityMentionEnglishParentHashes {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  gloss: FrenchEntityMentionEnglishFieldParentHash;
  meaning: FrenchEntityMentionEnglishFieldParentHash;
  lineageHash: string;
}

export interface FrenchEntityMentionEnglishFieldParentHash {
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
}

/**
 * Exact STEP identity projected from the promoted English core. No classical
 * Strong or sibling identity is accepted by this contract.
 */
export interface FrenchEntityMentionStepEntry {
  entryKey: string;
  stepEntryId: number;
  identity: {
    stepEntryId: number;
    language: "greek" | "hebrew";
    primaryDStrong: string;
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  englishParentHashes: FrenchEntityMentionEnglishParentHashes;
}

export interface FrenchEntityMentionEntityBinding {
  entityId: number;
  relation:
    | "primary"
    | "alias"
    | "gentilic"
    | "title"
    | "compound"
    | "etymological";
}

/**
 * Structural projection of a sealed canonical entity. Extra proof fields are
 * allowed and remain covered by contentHash; this module does not own the
 * canonicalizer or reinterpret its evidence.
 */
export interface FrenchEntityMentionCanonicalEntity {
  schemaVersion: string;
  policyVersion: string;
  entityId: number;
  primaryFr: string;
  normalizedPrimaryFr: string;
  category: string;
  type: string;
  memberEntryKeys: string[];
  sourceEntityHash: string;
  groupProofHash: string;
  contentHash: string;
}

/**
 * Structural projection of a sealed per-entry naming policy. englishForms is
 * the only authority for uncoded English matching; the STEP gloss is never
 * promoted into an alias implicitly.
 */
export interface FrenchEntityMentionCanonicalPolicy {
  schemaVersion: string;
  policyVersion: string;
  entryKey: string;
  stepEntryId: number;
  identity: FrenchEntityMentionStepEntry["identity"];
  englishParentHashes: FrenchEntityMentionEnglishParentHashes;
  treatment:
    | "canonical-name"
    | "alternate-name"
    | "unregistered-proper-name"
    | "gentilic"
    | "title-or-epithet"
    | "compound-name"
    | "etymological-or-common-gloss"
    | "unresolved";
  entityBindings: FrenchEntityMentionEntityBinding[];
  constraint:
    | "canonical"
    | "derived"
    | "proper-name-without-entity"
    | "lexical-translation"
    | "blocked";
  primaryFr: string | null;
  derivedFr: string | null;
  englishForms: string[];
  allowedFrenchForms: string[];
  classificationProof: object;
  contentHash: string;
}

export interface FrenchEntityMentionEnglishMeaning {
  sourceEntryKey: string;
  meaning: string;
  meaningHtml: string;
  meaningParentContentHash: string;
  meaningValueTextHash: string;
  meaningValueHtmlHash: string | null;
}

export interface RequiredFrenchEntityMention {
  mentionId: string;
  sourceEntryKey: string;
  segmentId: string;
  sourceSurface: string;
  citedStrong: string | null;
  targetEntryKey: string | null;
  targetEntityIds: number[];
  allowedFrenchForms: string[];
  resolution: FrenchEntityMentionResolution;
  contentHash: string;
}

export interface FrenchEntityMentionsArtifact {
  schemaVersion: typeof FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_ENTITY_MENTIONS_POLICY_VERSION;
  inputHashes: {
    stepEntries: string;
    canonicalEntities: string;
    canonicalPolicies: string;
    englishMeanings: string;
  };
  requiredEntityMentions: RequiredFrenchEntityMention[];
  blockingMentionIds: string[];
  contentHash: string;
}

export interface BuildFrenchEntityMentionsInput {
  stepEntries: readonly FrenchEntityMentionStepEntry[];
  canonicalEntities: readonly FrenchEntityMentionCanonicalEntity[];
  canonicalPolicies: readonly FrenchEntityMentionCanonicalPolicy[];
  englishMeanings: readonly FrenchEntityMentionEnglishMeaning[];
  quarantinedEntryKeys?: readonly string[];
}

export function finalizeFrenchEntityMentionsArtifact(input: {
  inputHashes: FrenchEntityMentionsArtifact["inputHashes"];
  requiredEntityMentions: RequiredFrenchEntityMention[];
}): FrenchEntityMentionsArtifact {
  const blockingMentionIds = input.requiredEntityMentions
    .filter(
      (mention) =>
        mention.resolution === "ambiguous" ||
        mention.resolution === "contextual"
    )
    .map((mention) => mention.mentionId);
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTIONS_POLICY_VERSION,
    inputHashes: input.inputHashes,
    requiredEntityMentions: input.requiredEntityMentions,
    blockingMentionIds
  };
  const artifact = {
    ...withoutHash,
    contentHash: hashFrenchInternalJson(withoutHash)
  };
  assertFrenchEntityMentionsArtifact(artifact);
  return artifact;
}

interface VisibleSegment {
  id: string;
  start: number;
  end: number;
}

interface VisibleMeaning {
  text: string;
  segments: VisibleSegment[];
}

interface ResolutionOutcome {
  targetEntryKey: string | null;
  targetEntityIds: number[];
  allowedFrenchForms: string[];
  resolution: FrenchEntityMentionResolution;
}

interface InternalMentionCandidate extends ResolutionOutcome {
  start: number;
  end: number;
  segmentId: string;
  sourceSurface: string;
  citedStrong: string | null;
}

interface AliasMatch {
  start: number;
  end: number;
  sourceSurface: string;
  policies: FrenchEntityMentionCanonicalPolicy[];
  forcedAmbiguous: boolean;
}

interface CitedStepMatch {
  start: number;
  end: number;
  sourceSurface: string;
  citedStrong: string;
}

interface AliasMatcher {
  ordinal: number;
  pattern: RegExp;
  policies: FrenchEntityMentionCanonicalPolicy[];
  anchor: string | null;
}

interface AliasMatcherIndex {
  fallback: AliasMatcher[];
  byAnchor: Map<string, AliasMatcher[]>;
}

/**
 * Extracts content-addressed translation constraints from sealed English
 * meanings. Exact cited codes resolve only through primaryDStrong. Uncoded
 * names use reviewed englishForms and longest-match selection.
 */
export function buildFrenchEntityMentions(
  input: BuildFrenchEntityMentionsInput
): FrenchEntityMentionsArtifact {
  const context = validateAndIndexInputs(input);
  const internal: Array<InternalMentionCandidate & { sourceEntryKey: string }> =
    [];

  for (const meaning of sortedBy(
    input.englishMeanings,
    (item) => item.sourceEntryKey
  )) {
    const sourceEntry = context.entriesByKey.get(meaning.sourceEntryKey);
    if (!sourceEntry) {
      throw new Error(
        `french-entity-mention-meaning-entry-missing:${meaning.sourceEntryKey}`
      );
    }
    assertMeaningLineage(meaning, sourceEntry);
    const visible = buildVisibleMeaning(meaning);
    const aliases = selectMaximumAliasMatches(
      visible.text,
      context.aliasMatcherIndex
    );
    const codes = extractCitedStepMatches(visible.text);
    const codeCandidates = codes.flatMap((code) => {
      const outcome = resolveCitedStep(
        code.citedStrong,
        context.entriesByPrimary,
        context.policiesByEntryKey,
        context.quarantinedEntryKeys
      );
      if (outcome === null) return [];
      return [
        {
          ...outcome,
          start: code.start,
          end: code.end,
          segmentId: segmentIdForRange(visible.segments, code.start, code.end),
          sourceSurface: code.sourceSurface,
          citedStrong: code.citedStrong
        } satisfies InternalMentionCandidate
      ];
    });
    const aliasCandidates = aliases.map((alias) => ({
      ...resolveAliasPolicies(alias.policies, alias.forcedAmbiguous),
      start: alias.start,
      end: alias.end,
      segmentId: segmentIdForRange(visible.segments, alias.start, alias.end),
      sourceSurface: alias.sourceSurface,
      citedStrong: null
    }));

    const consumedAliases = new Set<number>();
    for (const code of codeCandidates) {
      const compatibleAliases = aliasCandidates
        .map((alias, index) => ({ alias, index }))
        .filter(
          ({ alias }) =>
            outcomesAreCompatible(alias, code) &&
            isAdjacentCitation(visible.text, alias, code)
        );
      if (compatibleAliases.length === 1) {
        const { alias, index } = compatibleAliases[0]!;
        consumedAliases.add(index);
        internal.push({
          ...code,
          sourceEntryKey: meaning.sourceEntryKey,
          start: alias.start,
          end: alias.end,
          segmentId: alias.segmentId,
          sourceSurface: alias.sourceSurface
        });
      } else {
        // A bare STEP code is protected source content, not an instruction to
        // insert the French name of the referenced entity. Keep its exact
        // target identity for audit lineage while removing every translation
        // form and classifying the surface itself as non-entity. An adjacent,
        // compatible English alias above remains the only cited entity case.
        internal.push({
          ...code,
          sourceEntryKey: meaning.sourceEntryKey,
          targetEntityIds: [],
          allowedFrenchForms: [],
          resolution: "non-entity"
        });
      }
    }
    aliasCandidates.forEach((alias, index) => {
      if (!consumedAliases.has(index)) {
        internal.push({ ...alias, sourceEntryKey: meaning.sourceEntryKey });
      }
    });
  }

  const distinct = uniqueInternalMentions(
    requireContextualReviewForUncitedAliases(internal)
  ).sort(compareInternalMention);
  const requiredEntityMentions = distinct.map((candidate) => {
    const anchor = {
      schemaVersion: FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION,
      policyVersion: FRENCH_ENTITY_MENTIONS_POLICY_VERSION,
      sourceEntryKey: candidate.sourceEntryKey,
      segmentId: candidate.segmentId,
      sourceStart: candidate.start,
      sourceEnd: candidate.end,
      sourceSurface: candidate.sourceSurface,
      citedStrong: candidate.citedStrong,
      targetEntryKey: candidate.targetEntryKey,
      targetEntityIds: candidate.targetEntityIds,
      allowedFrenchForms: candidate.allowedFrenchForms,
      resolution: candidate.resolution
    };
    const mentionId = `entity-mention:${hashFrenchInternalJson(anchor)}`;
    const withoutHash = {
      mentionId,
      sourceEntryKey: candidate.sourceEntryKey,
      segmentId: candidate.segmentId,
      sourceSurface: candidate.sourceSurface,
      citedStrong: candidate.citedStrong,
      targetEntryKey: candidate.targetEntryKey,
      targetEntityIds: candidate.targetEntityIds,
      allowedFrenchForms: candidate.allowedFrenchForms,
      resolution: candidate.resolution
    };
    return {
      ...withoutHash,
      contentHash: hashFrenchInternalJson(withoutHash)
    } satisfies RequiredFrenchEntityMention;
  });
  const blockingMentionIds = requiredEntityMentions
    .filter(
      (mention) =>
        mention.resolution === "ambiguous" ||
        mention.resolution === "contextual"
    )
    .map((mention) => mention.mentionId);
  const sortedEntries = sortedBy(input.stepEntries, (entry) => entry.entryKey);
  const sortedEntities = [...input.canonicalEntities].sort(
    (left, right) => left.entityId - right.entityId
  );
  const sortedPolicies = sortedBy(
    input.canonicalPolicies,
    (policy) => policy.entryKey
  );
  const sortedMeanings = sortedBy(
    input.englishMeanings,
    (meaning) => meaning.sourceEntryKey
  );
  const withoutHash = {
    schemaVersion: FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION,
    policyVersion: FRENCH_ENTITY_MENTIONS_POLICY_VERSION,
    inputHashes: {
      stepEntries: hashFrenchInternalJson(sortedEntries),
      canonicalEntities: hashFrenchInternalJson(sortedEntities),
      canonicalPolicies: hashFrenchInternalJson({
        policies: sortedPolicies,
        quarantinedEntryKeys: uniqueSortedStrings(
          input.quarantinedEntryKeys ?? []
        )
      }),
      englishMeanings: hashFrenchInternalJson(sortedMeanings)
    },
    requiredEntityMentions,
    blockingMentionIds
  };
  const artifact: FrenchEntityMentionsArtifact = {
    ...withoutHash,
    contentHash: hashFrenchInternalJson(withoutHash)
  };
  assertFrenchEntityMentionsArtifact(artifact);
  return artifact;
}

/** Throws when an unresolved mention would otherwise reach translation. */
export function assertFrenchEntityMentionsPublishable(
  artifact: FrenchEntityMentionsArtifact
): void {
  assertFrenchEntityMentionsArtifact(artifact);
  if (artifact.blockingMentionIds.length > 0) {
    throw new Error(
      `french-entity-mentions-blocked:${artifact.blockingMentionIds.join(",")}`
    );
  }
}

/**
 * Verifies hashes, ordering and the closed mention schema. Passing sourceInput
 * additionally replays extraction and catches any source/policy drift.
 */
export function assertFrenchEntityMentionsArtifact(
  value: unknown,
  sourceInput?: BuildFrenchEntityMentionsInput
): asserts value is FrenchEntityMentionsArtifact {
  if (!isObject(value)) throw new Error("french-entity-mentions-invalid");
  assertExactKeys(value, [
    "schemaVersion",
    "policyVersion",
    "inputHashes",
    "requiredEntityMentions",
    "blockingMentionIds",
    "contentHash"
  ]);
  const artifact = value as unknown as FrenchEntityMentionsArtifact;
  if (
    artifact.schemaVersion !== FRENCH_ENTITY_MENTIONS_SCHEMA_VERSION ||
    artifact.policyVersion !== FRENCH_ENTITY_MENTIONS_POLICY_VERSION ||
    !isObject(artifact.inputHashes) ||
    !Array.isArray(artifact.requiredEntityMentions) ||
    !Array.isArray(artifact.blockingMentionIds) ||
    !SHA256_PATTERN.test(artifact.contentHash)
  ) {
    throw new Error("french-entity-mentions-invalid-contract");
  }
  assertExactKeys(artifact.inputHashes as unknown as Record<string, unknown>, [
    "stepEntries",
    "canonicalEntities",
    "canonicalPolicies",
    "englishMeanings"
  ]);
  if (
    !Object.values(artifact.inputHashes).every(
      (digest) => typeof digest === "string" && SHA256_PATTERN.test(digest)
    )
  ) {
    throw new Error("french-entity-mentions-invalid-input-hash");
  }

  const mentionIds = new Set<string>();
  for (const mention of artifact.requiredEntityMentions) {
    assertRequiredEntityMention(mention);
    if (mentionIds.has(mention.mentionId)) {
      throw new Error(`french-entity-mention-duplicate:${mention.mentionId}`);
    }
    mentionIds.add(mention.mentionId);
  }
  const expectedBlocking = artifact.requiredEntityMentions
    .filter(
      (mention) =>
        mention.resolution === "ambiguous" ||
        mention.resolution === "contextual"
    )
    .map((mention) => mention.mentionId);
  if (
    canonicalFrenchInternalJson(expectedBlocking) !==
    canonicalFrenchInternalJson(artifact.blockingMentionIds)
  ) {
    throw new Error("french-entity-mentions-blocking-list-mismatch");
  }
  const { contentHash: _contentHash, ...content } = artifact;
  void _contentHash;
  if (hashFrenchInternalJson(content) !== artifact.contentHash) {
    throw new Error("french-entity-mentions-content-hash-mismatch");
  }
  if (sourceInput) {
    const rebuilt = buildFrenchEntityMentions(sourceInput);
    if (
      canonicalFrenchInternalJson(rebuilt) !==
      canonicalFrenchInternalJson(artifact)
    ) {
      throw new Error("french-entity-mentions-replay-mismatch");
    }
  }
}

function validateAndIndexInputs(input: BuildFrenchEntityMentionsInput): {
  entriesByKey: Map<string, FrenchEntityMentionStepEntry>;
  entriesByPrimary: Map<string, FrenchEntityMentionStepEntry>;
  policiesByEntryKey: Map<string, FrenchEntityMentionCanonicalPolicy>;
  aliasMatcherIndex: AliasMatcherIndex;
  quarantinedEntryKeys: Set<string>;
} {
  if (
    !Array.isArray(input.stepEntries) ||
    !Array.isArray(input.canonicalEntities) ||
    !Array.isArray(input.canonicalPolicies) ||
    !Array.isArray(input.englishMeanings) ||
    (input.quarantinedEntryKeys !== undefined &&
      !Array.isArray(input.quarantinedEntryKeys))
  ) {
    throw new Error("french-entity-mentions-input-invalid");
  }
  const entriesByKey = new Map<string, FrenchEntityMentionStepEntry>();
  const entriesByPrimary = new Map<string, FrenchEntityMentionStepEntry>();
  let releaseKey: string | null = null;
  let releaseSnapshot: string | null = null;
  for (const entry of input.stepEntries) {
    assertExactStepEntry(entry);
    if (entriesByKey.has(entry.entryKey)) {
      throw new Error(
        `french-entity-mention-duplicate-entry:${entry.entryKey}`
      );
    }
    if (entriesByPrimary.has(entry.identity.primaryDStrong)) {
      throw new Error(
        `french-entity-mention-duplicate-primary:${entry.identity.primaryDStrong}`
      );
    }
    releaseKey ??= entry.englishParentHashes.releaseKey;
    releaseSnapshot ??= entry.englishParentHashes.releaseSnapshotFingerprint;
    if (
      entry.englishParentHashes.releaseKey !== releaseKey ||
      entry.englishParentHashes.releaseSnapshotFingerprint !== releaseSnapshot
    ) {
      throw new Error("french-entity-mention-mixed-english-release");
    }
    entriesByKey.set(entry.entryKey, entry);
    entriesByPrimary.set(entry.identity.primaryDStrong, entry);
  }

  const entitiesById = new Map<number, FrenchEntityMentionCanonicalEntity>();
  for (const entity of input.canonicalEntities) {
    assertSealedCanonicalEntity(entity);
    if (entitiesById.has(entity.entityId)) {
      throw new Error(
        `french-entity-mention-duplicate-entity:${entity.entityId}`
      );
    }
    entitiesById.set(entity.entityId, entity);
  }

  const policiesByEntryKey = new Map<
    string,
    FrenchEntityMentionCanonicalPolicy
  >();
  for (const policy of input.canonicalPolicies) {
    assertSealedCanonicalPolicy(policy);
    const entry = entriesByKey.get(policy.entryKey);
    if (!entry) {
      throw new Error(
        `french-entity-mention-policy-entry-missing:${policy.entryKey}`
      );
    }
    if (policiesByEntryKey.has(policy.entryKey)) {
      throw new Error(
        `french-entity-mention-duplicate-policy:${policy.entryKey}`
      );
    }
    if (
      policy.stepEntryId !== entry.stepEntryId ||
      canonicalFrenchInternalJson(policy.identity) !==
        canonicalFrenchInternalJson(entry.identity) ||
      canonicalFrenchInternalJson(policy.englishParentHashes) !==
        canonicalFrenchInternalJson(entry.englishParentHashes)
    ) {
      throw new Error(
        `french-entity-mention-policy-lineage-mismatch:${policy.entryKey}`
      );
    }
    for (const binding of policy.entityBindings) {
      const entity = entitiesById.get(binding.entityId);
      if (!entity || !entity.memberEntryKeys.includes(policy.entryKey)) {
        throw new Error(
          `french-entity-mention-binding-membership-mismatch:${policy.entryKey}:${binding.entityId}`
        );
      }
    }
    policiesByEntryKey.set(policy.entryKey, policy);
  }
  const quarantinedEntryKeys = new Set(
    uniqueSortedStrings(input.quarantinedEntryKeys ?? [])
  );
  for (const entryKey of quarantinedEntryKeys) {
    if (!entriesByKey.has(entryKey) || policiesByEntryKey.has(entryKey)) {
      throw new Error(`french-entity-mention-invalid-quarantine:${entryKey}`);
    }
  }
  const seenMeanings = new Set<string>();
  for (const meaning of input.englishMeanings) {
    if (seenMeanings.has(meaning.sourceEntryKey)) {
      throw new Error(
        `french-entity-mention-duplicate-meaning:${meaning.sourceEntryKey}`
      );
    }
    const entry = entriesByKey.get(meaning.sourceEntryKey);
    if (!entry) {
      throw new Error(
        `french-entity-mention-meaning-entry-missing:${meaning.sourceEntryKey}`
      );
    }
    assertMeaningLineage(meaning, entry);
    seenMeanings.add(meaning.sourceEntryKey);
  }

  const matchablePolicies = [...policiesByEntryKey.values()].filter(
    (policy) =>
      NAME_LIKE_TREATMENTS.has(policy.treatment) &&
      policy.constraint !== "blocked" &&
      policy.englishForms.length > 0
  );
  return {
    entriesByKey,
    entriesByPrimary,
    policiesByEntryKey,
    aliasMatcherIndex: compileAliasMatcherIndex(matchablePolicies),
    quarantinedEntryKeys
  };
}

function assertExactStepEntry(entry: FrenchEntityMentionStepEntry): void {
  if (
    !isObject(entry) ||
    !Number.isInteger(entry.stepEntryId) ||
    entry.stepEntryId < 1 ||
    !isObject(entry.identity) ||
    !isObject(entry.englishParentHashes)
  ) {
    throw new Error("french-entity-mention-invalid-step-entry");
  }
  const primary = extractPrimaryDStrong(entry.identity.dStrong);
  let expectedEntryKey = "";
  try {
    expectedEntryKey = buildLexiconEntryKey(
      entry.identity.language,
      entry.identity.dStrong
    );
  } catch {
    throw new Error(
      `french-entity-mention-invalid-step-identity:${entry.entryKey}`
    );
  }
  const expectedPrefix = entry.identity.language === "greek" ? "G" : "H";
  if (
    primary !== entry.identity.primaryDStrong ||
    entry.identity.stepEntryId !== entry.stepEntryId ||
    expectedEntryKey !== entry.entryKey ||
    !entry.identity.primaryDStrong.startsWith(expectedPrefix) ||
    typeof entry.identity.morph !== "string" ||
    !nonEmptyStrings([
      entry.identity.eStrong,
      entry.identity.dStrong,
      entry.identity.uStrong
    ])
  ) {
    throw new Error(
      `french-entity-mention-invalid-step-identity:${entry.entryKey}`
    );
  }
  assertEnglishParentHashes(entry.englishParentHashes, entry.entryKey);
}

function assertEnglishParentHashes(
  hashes: FrenchEntityMentionEnglishParentHashes,
  entryKey: string
): void {
  if (
    !nonEmptyStrings([hashes.releaseKey]) ||
    !SHA256_PATTERN.test(hashes.releaseSnapshotFingerprint) ||
    !isObject(hashes.gloss) ||
    !isObject(hashes.meaning) ||
    !validEnglishFieldParent(hashes.gloss) ||
    !validEnglishFieldParent(hashes.meaning) ||
    hashes.gloss.valueHtmlHash !== null ||
    !SHA256_PATTERN.test(hashes.lineageHash)
  ) {
    throw new Error(`french-entity-mention-invalid-english-parent:${entryKey}`);
  }
  const { lineageHash, ...lineage } = hashes;
  if (hashFrenchInternalJson(lineage) !== lineageHash) {
    throw new Error(
      `french-entity-mention-english-lineage-hash-mismatch:${entryKey}`
    );
  }
}

function validEnglishFieldParent(
  parent: FrenchEntityMentionEnglishFieldParentHash
): boolean {
  return (
    Number.isInteger(parent.fieldVersionId) &&
    parent.fieldVersionId > 0 &&
    SHA256_PATTERN.test(parent.contentHash) &&
    SHA256_PATTERN.test(parent.valueTextHash) &&
    (parent.valueHtmlHash === null || SHA256_PATTERN.test(parent.valueHtmlHash))
  );
}

function assertSealedCanonicalEntity(
  entity: FrenchEntityMentionCanonicalEntity
): void {
  if (
    !isObject(entity) ||
    entity.schemaVersion !== SUPPORTED_CANONICAL_ENTITY_SCHEMA_VERSION ||
    entity.policyVersion !== SUPPORTED_CANONICAL_POLICY_VERSION ||
    !nonEmptyStrings([entity.primaryFr, entity.normalizedPrimaryFr]) ||
    typeof entity.category !== "string" ||
    typeof entity.type !== "string" ||
    !Number.isInteger(entity.entityId) ||
    entity.entityId < 1 ||
    !Array.isArray(entity.memberEntryKeys) ||
    entity.memberEntryKeys.length === 0 ||
    !isSortedUniqueStrings(entity.memberEntryKeys) ||
    !SHA256_PATTERN.test(entity.sourceEntityHash) ||
    !SHA256_PATTERN.test(entity.groupProofHash) ||
    !SHA256_PATTERN.test(entity.contentHash) ||
    normalizeFrenchSurface(entity.primaryFr) !== entity.normalizedPrimaryFr
  ) {
    throw new Error(
      `french-entity-mention-invalid-canonical-entity:${String(entity.entityId)}`
    );
  }
  assertSealedContentHash(
    entity,
    `french-entity-mention-entity-hash-mismatch:${entity.entityId}`
  );
}

function assertSealedCanonicalPolicy(
  policy: FrenchEntityMentionCanonicalPolicy
): void {
  if (
    !isObject(policy) ||
    policy.schemaVersion !== SUPPORTED_CANONICAL_POLICY_SCHEMA_VERSION ||
    policy.policyVersion !== SUPPORTED_CANONICAL_POLICY_VERSION ||
    !Number.isInteger(policy.stepEntryId) ||
    policy.stepEntryId < 1 ||
    !isObject(policy.identity) ||
    !isObject(policy.englishParentHashes) ||
    !isObject(policy.classificationProof) ||
    !Array.isArray(policy.entityBindings) ||
    !Array.isArray(policy.englishForms) ||
    !Array.isArray(policy.allowedFrenchForms) ||
    !isSortedUniqueStrings(policy.englishForms) ||
    !isSortedUniqueStrings(policy.allowedFrenchForms) ||
    !SHA256_PATTERN.test(policy.contentHash)
  ) {
    throw new Error(
      `french-entity-mention-invalid-canonical-policy:${policy.entryKey}`
    );
  }
  assertEnglishParentHashes(policy.englishParentHashes, policy.entryKey);
  if (!isFrenchEntityNameTreatment(policy.treatment)) {
    throw new Error(
      `french-entity-mention-invalid-policy-treatment:${policy.entryKey}`
    );
  }
  if (!isFrenchEntityNameConstraint(policy.constraint)) {
    throw new Error(
      `french-entity-mention-invalid-policy-constraint:${policy.entryKey}`
    );
  }
  if (policy.treatment === "unresolved" || policy.constraint === "blocked") {
    throw new Error(
      `french-entity-mention-unresolved-policy:${policy.entryKey}`
    );
  }
  const contract = frenchEntityPolicyContractForTreatment(policy.treatment);
  if (!contract || policy.constraint !== contract.constraint) {
    throw new Error(
      `french-entity-mention-invalid-policy-constraint:${policy.entryKey}`
    );
  }
  const bindings: number[] = [];
  for (const binding of policy.entityBindings) {
    const relationAllowed =
      policy.treatment === "canonical-name"
        ? binding.relation === "primary" ||
          binding.relation === "alias" ||
          binding.relation === "compound"
        : binding.relation === contract.relation;
    if (
      !isObject(binding) ||
      !Number.isInteger(binding.entityId) ||
      binding.entityId < 1 ||
      !isFrenchEntityBindingRelation(binding.relation)
    ) {
      throw new Error(
        `french-entity-mention-invalid-policy-bindings:${policy.entryKey}`
      );
    }
    if (!relationAllowed) {
      throw new Error(
        `french-entity-mention-invalid-policy-relation:${policy.entryKey}:${binding.relation}`
      );
    }
    bindings.push(binding.entityId);
  }
  if (new Set(bindings).size !== bindings.length) {
    throw new Error(
      `french-entity-mention-invalid-policy-bindings:${policy.entryKey}`
    );
  }
  const nameLike = NAME_LIKE_TREATMENTS.has(policy.treatment);
  const nonEntity = NON_ENTITY_TREATMENTS.has(policy.treatment);
  if (nameLike) {
    const unboundNameForm =
      policy.entityBindings.length === 0 &&
      ((policy.treatment === "unregistered-proper-name" &&
        policy.constraint === "proper-name-without-entity") ||
        (new Set([
          "alternate-name",
          "gentilic",
          "title-or-epithet",
          "compound-name"
        ]).has(policy.treatment) &&
          policy.constraint === "derived"));
    const primaryBindingCount = policy.entityBindings.filter(
      (binding) => binding.relation === "primary"
    ).length;
    const selectedFrenchForm =
      contract.constraint === "canonical" ? policy.primaryFr : policy.derivedFr;
    const unusedFrenchForm =
      contract.constraint === "canonical" ? policy.derivedFr : policy.primaryFr;
    if (
      (policy.entityBindings.length === 0 && !unboundNameForm) ||
      (policy.treatment === "canonical-name" && primaryBindingCount !== 1) ||
      (policy.treatment === "unregistered-proper-name" && !unboundNameForm) ||
      typeof selectedFrenchForm !== "string" ||
      !selectedFrenchForm.trim() ||
      unusedFrenchForm !== null ||
      policy.englishForms.length === 0 ||
      policy.allowedFrenchForms.length === 0
    ) {
      throw new Error(
        `french-entity-mention-incomplete-name-policy:${policy.entryKey}`
      );
    }
    const allowed = new Set(
      policy.allowedFrenchForms.map(normalizeFrenchSurface)
    );
    if (!allowed.has(normalizeFrenchSurface(selectedFrenchForm))) {
      throw new Error(
        `french-entity-mention-policy-form-mismatch:${policy.entryKey}`
      );
    }
  } else if (
    nonEntity &&
    (policy.primaryFr !== null ||
      !policy.derivedFr?.trim() ||
      policy.englishForms.length !== 0 ||
      !policy.allowedFrenchForms.some(
        (form) =>
          normalizeFrenchSurface(form) ===
          normalizeFrenchSurface(policy.derivedFr ?? "")
      ))
  ) {
    throw new Error(
      `french-entity-mention-invalid-non-entity-policy:${policy.entryKey}`
    );
  } else if (!nonEntity) {
    throw new Error(
      `french-entity-mention-invalid-policy-treatment:${policy.entryKey}`
    );
  }
  const selectedFrenchForm =
    contract.constraint === "canonical" ? policy.primaryFr : policy.derivedFr;
  const normativeFrenchForms = selectedFrenchForm?.trim()
    ? canonicalFrenchEntityPolicyForms(policy.treatment, selectedFrenchForm)
    : [];
  if (
    canonicalFrenchInternalJson(policy.allowedFrenchForms) !==
    canonicalFrenchInternalJson(normativeFrenchForms)
  ) {
    throw new Error(
      `french-entity-mention-noncanonical-french-forms:${policy.entryKey}`
    );
  }
  for (const form of policy.englishForms) {
    if (!isSafeEnglishEntityForm(form)) {
      throw new Error(
        `french-entity-mention-unsafe-english-form:${policy.entryKey}`
      );
    }
  }
  for (const form of policy.allowedFrenchForms) {
    if (!normalizeFrenchSurface(form)) {
      throw new Error(
        `french-entity-mention-empty-french-form:${policy.entryKey}`
      );
    }
  }
  assertSealedContentHash(
    policy,
    `french-entity-mention-policy-hash-mismatch:${policy.entryKey}`
  );
}

function assertSealedContentHash(
  record: object & { contentHash: string },
  error: string
): void {
  const { contentHash, ...content } = record as Record<string, unknown> & {
    contentHash: string;
  };
  if (hashFrenchInternalJson(content) !== contentHash) {
    throw new Error(error);
  }
}

function assertMeaningLineage(
  meaning: FrenchEntityMentionEnglishMeaning,
  entry: FrenchEntityMentionStepEntry
): void {
  if (
    meaning.meaningParentContentHash !==
      entry.englishParentHashes.meaning.contentHash ||
    meaning.meaningValueTextHash !==
      entry.englishParentHashes.meaning.valueTextHash ||
    meaning.meaningValueHtmlHash !==
      entry.englishParentHashes.meaning.valueHtmlHash ||
    sha256(meaning.meaning) !== meaning.meaningValueTextHash ||
    (meaning.meaningValueHtmlHash === null
      ? meaning.meaningHtml !== meaning.meaning
      : sha256(meaning.meaningHtml) !== meaning.meaningValueHtmlHash)
  ) {
    throw new Error(
      `french-entity-mention-meaning-lineage-mismatch:${meaning.sourceEntryKey}`
    );
  }
  const htmlText = normalizeMeaningText(stripLexiconHtml(meaning.meaningHtml));
  if (htmlText !== normalizeMeaningText(meaning.meaning)) {
    throw new Error(
      `french-entity-mention-meaning-html-mismatch:${meaning.sourceEntryKey}`
    );
  }
}

function buildVisibleMeaning(
  meaning: FrenchEntityMentionEnglishMeaning
): VisibleMeaning {
  if (meaning.meaningValueHtmlHash === null) {
    return {
      text: meaning.meaning,
      segments: [{ id: "t0", start: 0, end: meaning.meaning.length }]
    };
  }
  const template = buildFrenchHtmlTemplate(meaning.meaningHtml);
  const segments: VisibleSegment[] = [];
  let text = "";
  for (const token of template.tokens) {
    if (token.kind === "tag") {
      if (
        ["<br>", "<lb>", "</p>"].includes(token.value) &&
        text.length > 0 &&
        !/\s$/u.test(text)
      ) {
        text += " ";
      }
      continue;
    }
    const piece = token.sourceText
      ? `${token.prefixWhitespace}${token.sourceText}${token.suffixWhitespace}`
      : token.prefixWhitespace || token.suffixWhitespace;
    const start = text.length;
    text += piece;
    segments.push({ id: token.id, start, end: text.length });
  }
  return { text, segments };
}

function selectMaximumAliasMatches(
  text: string,
  index: AliasMatcherIndex
): AliasMatch[] {
  const bySpanAndSurface = new Map<string, AliasMatch>();
  for (const matcher of selectAliasMatchersForText(text, index)) {
    matcher.pattern.lastIndex = 0;
    for (const match of text.matchAll(matcher.pattern)) {
      const sourceSurface = match[0];
      const start = match.index;
      const end = start + sourceSurface.length;
      const key = `${start}:${end}:${sourceSurface.normalize("NFC").toLocaleLowerCase("en")}`;
      const existing = bySpanAndSurface.get(key);
      if (existing) {
        for (const policy of matcher.policies) {
          if (
            !existing.policies.some((item) => item.entryKey === policy.entryKey)
          ) {
            existing.policies.push(policy);
          }
        }
      } else {
        bySpanAndSurface.set(key, {
          start,
          end,
          sourceSurface,
          policies: [...matcher.policies],
          forcedAmbiguous: false
        });
      }
    }
  }
  const matches = [...bySpanAndSurface.values()].sort(
    (left, right) =>
      left.start - right.start ||
      right.end - right.start - (left.end - left.start) ||
      compareText(left.sourceSurface, right.sourceSurface)
  );
  const groups: AliasMatch[][] = [];
  for (const match of matches) {
    const group = groups.at(-1);
    const groupEnd = group
      ? Math.max(...group.map((item) => item.end))
      : Number.NEGATIVE_INFINITY;
    if (!group || match.start >= groupEnd) groups.push([match]);
    else group.push(match);
  }
  return groups.map((group) => {
    const maximumLength = Math.max(
      ...group.map((match) => match.end - match.start)
    );
    const maximum = group.filter(
      (match) => match.end - match.start === maximumLength
    );
    const distinctSpans = new Set(
      maximum.map((match) => `${match.start}:${match.end}`)
    );
    if (distinctSpans.size === 1) {
      const first = maximum[0]!;
      return {
        ...first,
        policies: uniquePolicies(maximum.flatMap((match) => match.policies)),
        forcedAmbiguous: false
      };
    }
    const start = Math.min(...maximum.map((match) => match.start));
    const end = Math.max(...maximum.map((match) => match.end));
    return {
      start,
      end,
      sourceSurface: text.slice(start, end),
      policies: uniquePolicies(maximum.flatMap((match) => match.policies)),
      forcedAmbiguous: true
    };
  });
}

function compileAliasMatcherIndex(
  policies: readonly FrenchEntityMentionCanonicalPolicy[]
): AliasMatcherIndex {
  const matcherByPattern = new Map<
    string,
    {
      ordinal: number;
      form: string;
      policies: FrenchEntityMentionCanonicalPolicy[];
      anchors: string[];
    }
  >();
  let ordinal = 0;
  for (const policy of policies) {
    for (const form of policy.englishForms) {
      const source = englishFormPattern(form);
      const existing = matcherByPattern.get(source);
      if (existing) {
        if (
          !existing.policies.some((item) => item.entryKey === policy.entryKey)
        ) {
          existing.policies.push(policy);
        }
        continue;
      }
      matcherByPattern.set(source, {
        ordinal,
        form,
        policies: [policy],
        anchors: safeAsciiTrigrams(form)
      });
      ordinal += 1;
    }
  }
  const anchorFrequency = new Map<string, number>();
  for (const matcher of matcherByPattern.values()) {
    for (const anchor of matcher.anchors) {
      anchorFrequency.set(anchor, (anchorFrequency.get(anchor) ?? 0) + 1);
    }
  }
  const fallback: AliasMatcher[] = [];
  const byAnchor = new Map<string, AliasMatcher[]>();
  for (const [source, candidate] of matcherByPattern) {
    const anchor =
      [...candidate.anchors].sort(
        (left, right) =>
          (anchorFrequency.get(left) ?? 0) -
            (anchorFrequency.get(right) ?? 0) || compareText(left, right)
      )[0] ?? null;
    const matcher: AliasMatcher = {
      ordinal: candidate.ordinal,
      pattern: new RegExp(
        `(?<![\\p{L}\\p{N}])${source}(?![\\p{L}\\p{N}])`,
        "giu"
      ),
      policies: candidate.policies,
      anchor
    };
    if (anchor === null) fallback.push(matcher);
    else {
      const bucket = byAnchor.get(anchor) ?? [];
      bucket.push(matcher);
      byAnchor.set(anchor, bucket);
    }
  }
  return { fallback, byAnchor };
}

function selectAliasMatchersForText(
  text: string,
  index: AliasMatcherIndex
): AliasMatcher[] {
  const selected = new Map<number, AliasMatcher>(
    index.fallback.map((matcher) => [matcher.ordinal, matcher])
  );
  for (const anchor of safeAsciiTrigrams(text)) {
    for (const matcher of index.byAnchor.get(anchor) ?? []) {
      selected.set(matcher.ordinal, matcher);
    }
  }
  return [...selected.values()].sort(
    (left, right) => left.ordinal - right.ordinal
  );
}

function safeAsciiTrigrams(value: string): string[] {
  const normalized = value.normalize("NFC").toLocaleLowerCase("en");
  const result = new Set<string>();
  for (const match of normalized.matchAll(/(?=([a-jl-rt-z0-9]{3}))/gu)) {
    result.add(match[1]!);
  }
  return [...result].sort(compareText);
}

function extractCitedStepMatches(text: string): CitedStepMatch[] {
  const result: CitedStepMatch[] = [];
  for (const match of text.matchAll(CITED_STEP_PATTERN)) {
    const prefix = match[1] ?? "";
    const digits = match[2] ?? "";
    const firstSuffix = match[3] ?? "";
    const firstVariant = match[4] ? `_${match[4]}` : "";
    const first = normalizeStepStrongCode(
      `${prefix}${digits}${firstSuffix}${firstVariant}`
    );
    if (!first) continue;
    const start = match.index;
    const sourceSurface = match[0];
    const end = start + sourceSurface.length;
    result.push({ start, end, sourceSurface, citedStrong: first });
    if (match[5]) {
      const secondVariant = match[6] ? `_${match[6]}` : "";
      const second = normalizeStepStrongCode(
        `${prefix}${digits}${match[5]}${secondVariant}`
      );
      if (second) {
        result.push({ start, end, sourceSurface, citedStrong: second });
      }
    }
  }
  return result;
}

function resolveCitedStep(
  citedStrong: string,
  entriesByPrimary: Map<string, FrenchEntityMentionStepEntry>,
  policiesByEntryKey: Map<string, FrenchEntityMentionCanonicalPolicy>,
  quarantinedEntryKeys: ReadonlySet<string>
): ResolutionOutcome | null {
  const entry = entriesByPrimary.get(citedStrong);
  if (!entry) {
    // STEP meanings also cite unsuffixed/classical Strong numbers for which
    // this release only contains one or more suffixed STEP entries. The code
    // remains protected literal source content, but it is not an exact STEP
    // identity and therefore cannot authorize an entity translation or a
    // guessed sibling fallback.
    return null;
  }
  const policy = policiesByEntryKey.get(entry.entryKey);
  if (policy) return resolveSinglePolicy(policy);
  if (quarantinedEntryKeys.has(entry.entryKey)) {
    return {
      targetEntryKey: entry.entryKey,
      targetEntityIds: [],
      allowedFrenchForms: [],
      resolution: "quarantined"
    };
  }
  if (classifyFrenchEditorialPos(entry.identity.morph) === "proper-name") {
    return {
      targetEntryKey: entry.entryKey,
      targetEntityIds: [],
      allowedFrenchForms: [],
      resolution: "ambiguous"
    };
  }
  return null;
}

function resolveSinglePolicy(
  policy: FrenchEntityMentionCanonicalPolicy
): ResolutionOutcome {
  if (
    NON_ENTITY_TREATMENTS.has(policy.treatment) &&
    policy.constraint === "lexical-translation"
  ) {
    return {
      targetEntryKey: policy.entryKey,
      targetEntityIds: [],
      allowedFrenchForms: [],
      resolution: "non-entity"
    };
  }
  if (
    NAME_LIKE_TREATMENTS.has(policy.treatment) &&
    policy.entityBindings.length === 0 &&
    policy.allowedFrenchForms.length > 0
  ) {
    return {
      targetEntryKey: policy.entryKey,
      targetEntityIds: [],
      allowedFrenchForms: uniqueSortedStrings(policy.allowedFrenchForms),
      resolution: "exact"
    };
  }
  if (
    policy.treatment === "unresolved" ||
    policy.constraint === "blocked" ||
    policy.entityBindings.length === 0 ||
    policy.allowedFrenchForms.length === 0
  ) {
    return {
      targetEntryKey: policy.entryKey,
      targetEntityIds: uniqueSortedNumbers(
        policy.entityBindings.map((binding) => binding.entityId)
      ),
      allowedFrenchForms: uniqueSortedStrings(policy.allowedFrenchForms),
      resolution: "ambiguous"
    };
  }
  return {
    targetEntryKey: policy.entryKey,
    targetEntityIds: uniqueSortedNumbers(
      policy.entityBindings.map((binding) => binding.entityId)
    ),
    allowedFrenchForms: uniqueSortedStrings(policy.allowedFrenchForms),
    resolution: "exact"
  };
}

function resolveAliasPolicies(
  policies: readonly FrenchEntityMentionCanonicalPolicy[],
  forcedAmbiguous: boolean
): ResolutionOutcome {
  const exactOutcomes = policies.map(resolveSinglePolicy);
  const byTranslationConstraint = new Map<string, ResolutionOutcome[]>();
  for (const outcome of exactOutcomes) {
    const key = canonicalFrenchInternalJson({
      targetEntityIds: outcome.targetEntityIds,
      allowedFrenchForms: outcome.allowedFrenchForms,
      resolution: outcome.resolution
    });
    const values = byTranslationConstraint.get(key) ?? [];
    values.push(outcome);
    byTranslationConstraint.set(key, values);
  }
  if (!forcedAmbiguous && byTranslationConstraint.size === 1) {
    const outcomes = [...byTranslationConstraint.values()][0]!;
    const entryKeys = uniqueSortedStrings(
      outcomes.flatMap((outcome) =>
        outcome.targetEntryKey ? [outcome.targetEntryKey] : []
      )
    );
    return {
      ...outcomes[0]!,
      targetEntryKey: entryKeys.length === 1 ? entryKeys[0]! : null
    };
  }
  if (
    !forcedAmbiguous &&
    exactOutcomes.length > 0 &&
    exactOutcomes.every((outcome) => outcome.resolution === "exact")
  ) {
    // Several people, places or STEP siblings may legitimately share the
    // same English surface. Identity remains plural, but translation is
    // deterministic whenever every possible policy authorizes at least one
    // common French form. Only translation ambiguity is blocking here.
    const commonNormalizedForms = exactOutcomes.slice(1).reduce(
      (common, outcome) => {
        const current = new Set(
          outcome.allowedFrenchForms.map(normalizeFrenchSurface)
        );
        return new Set([...common].filter((form) => current.has(form)));
      },
      new Set(exactOutcomes[0]!.allowedFrenchForms.map(normalizeFrenchSurface))
    );
    if (commonNormalizedForms.size > 0) {
      const allowedFrenchForms = uniqueSortedStrings(
        exactOutcomes
          .flatMap((outcome) => outcome.allowedFrenchForms)
          .filter((form) =>
            commonNormalizedForms.has(normalizeFrenchSurface(form))
          )
      );
      const entryKeys = uniqueSortedStrings(
        exactOutcomes.flatMap((outcome) =>
          outcome.targetEntryKey ? [outcome.targetEntryKey] : []
        )
      );
      return {
        targetEntryKey: entryKeys.length === 1 ? entryKeys[0]! : null,
        targetEntityIds: uniqueSortedNumbers(
          exactOutcomes.flatMap((outcome) => outcome.targetEntityIds)
        ),
        allowedFrenchForms,
        resolution: "exact"
      };
    }
    const allowedFrenchForms = uniqueSortedStrings(
      exactOutcomes.flatMap((outcome) => outcome.allowedFrenchForms)
    );
    if (allowedFrenchForms.length > 0) {
      return {
        targetEntryKey: null,
        targetEntityIds: uniqueSortedNumbers(
          exactOutcomes.flatMap((outcome) => outcome.targetEntityIds)
        ),
        allowedFrenchForms,
        resolution: "contextual"
      };
    }
  }
  return {
    targetEntryKey: null,
    targetEntityIds: uniqueSortedNumbers(
      exactOutcomes.flatMap((outcome) => outcome.targetEntityIds)
    ),
    allowedFrenchForms: uniqueSortedStrings(
      exactOutcomes.flatMap((outcome) => outcome.allowedFrenchForms)
    ),
    resolution: "ambiguous"
  };
}

function outcomesAreCompatible(
  left: ResolutionOutcome,
  right: ResolutionOutcome
): boolean {
  if (
    left.resolution === "exact" &&
    right.resolution === "exact" &&
    canonicalFrenchInternalJson(left.targetEntityIds) ===
      canonicalFrenchInternalJson(right.targetEntityIds) &&
    left.allowedFrenchForms.some((form) =>
      right.allowedFrenchForms.some(
        (other) =>
          normalizeFrenchSurface(form) === normalizeFrenchSurface(other)
      )
    )
  ) {
    return true;
  }
  if (left.resolution !== "contextual" || right.resolution !== "exact") {
    return false;
  }
  const possibleEntityIds = new Set(left.targetEntityIds);
  const entityCompatible = right.targetEntityIds.every((entityId) =>
    possibleEntityIds.has(entityId)
  );
  const formCompatible = right.allowedFrenchForms.some((form) =>
    left.allowedFrenchForms.some(
      (other) => normalizeFrenchSurface(form) === normalizeFrenchSurface(other)
    )
  );
  return entityCompatible && formCompatible;
}

function isAdjacentCitation(
  text: string,
  left: Pick<InternalMentionCandidate, "start" | "end">,
  right: Pick<InternalMentionCandidate, "start" | "end">
): boolean {
  if (rangesOverlap(left.start, left.end, right.start, right.end)) return false;
  const from = Math.min(left.end, right.end);
  const to = Math.max(left.start, right.start);
  if (to - from > 48) return false;
  return /^[\s()[\]{},;:="'’/\\+–—-]*$/u.test(text.slice(from, to));
}

function segmentIdForRange(
  segments: readonly VisibleSegment[],
  start: number,
  end: number
): string {
  const ids = segments
    .filter((segment) => rangesOverlap(segment.start, segment.end, start, end))
    .map((segment) => segment.id);
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    throw new Error(`french-entity-mention-segment-not-found:${start}:${end}`);
  }
  return unique.join("+");
}

function uniqueInternalMentions(
  mentions: Array<InternalMentionCandidate & { sourceEntryKey: string }>
): Array<InternalMentionCandidate & { sourceEntryKey: string }> {
  const result = new Map<
    string,
    InternalMentionCandidate & { sourceEntryKey: string }
  >();
  for (const mention of mentions) {
    const key = canonicalFrenchInternalJson(mention);
    if (!result.has(key)) result.set(key, mention);
  }
  return [...result.values()];
}

/**
 * English dictionary prose is not a named-entity corpus. Capitalization, a
 * unique alias and a unique canonical policy are candidate-generation facts,
 * not contextual proof that the occurrence denotes that entity. Every
 * uncited alias therefore requires independent context resolution. Exact
 * adjacent STEP citations remain exact because they bind an explicit STEP
 * identity rather than inferring one from the surface alone.
 */
function requireContextualReviewForUncitedAliases(
  mentions: Array<InternalMentionCandidate & { sourceEntryKey: string }>
): Array<InternalMentionCandidate & { sourceEntryKey: string }> {
  return mentions.map((mention) => {
    if (mention.citedStrong !== null || mention.resolution !== "exact") {
      return mention;
    }
    return {
      ...mention,
      targetEntryKey: null,
      resolution: "contextual"
    };
  });
}

function compareInternalMention(
  left: InternalMentionCandidate & { sourceEntryKey: string },
  right: InternalMentionCandidate & { sourceEntryKey: string }
): number {
  return (
    compareText(left.sourceEntryKey, right.sourceEntryKey) ||
    left.start - right.start ||
    left.end - right.end ||
    compareText(left.citedStrong ?? "", right.citedStrong ?? "") ||
    compareText(left.targetEntryKey ?? "", right.targetEntryKey ?? "") ||
    compareText(left.resolution, right.resolution)
  );
}

function assertRequiredEntityMention(
  mention: RequiredFrenchEntityMention
): void {
  if (!isObject(mention)) {
    throw new Error("french-entity-mention-invalid-record");
  }
  assertExactKeys(mention as unknown as Record<string, unknown>, [
    "mentionId",
    "sourceEntryKey",
    "segmentId",
    "sourceSurface",
    "citedStrong",
    "targetEntryKey",
    "targetEntityIds",
    "allowedFrenchForms",
    "resolution",
    "contentHash"
  ]);
  if (
    !/^entity-mention:[a-f0-9]{64}$/u.test(mention.mentionId) ||
    !nonEmptyStrings([
      mention.sourceEntryKey,
      mention.segmentId,
      mention.sourceSurface
    ]) ||
    (mention.citedStrong !== null &&
      normalizeStepStrongCode(mention.citedStrong) !== mention.citedStrong) ||
    (mention.targetEntryKey !== null && !mention.targetEntryKey.trim()) ||
    !Array.isArray(mention.targetEntityIds) ||
    !Array.isArray(mention.allowedFrenchForms) ||
    !isSortedUniqueNumbers(mention.targetEntityIds) ||
    !isSortedUniqueStrings(mention.allowedFrenchForms) ||
    !["exact", "contextual", "ambiguous", "non-entity", "quarantined"].includes(
      mention.resolution
    ) ||
    !SHA256_PATTERN.test(mention.contentHash)
  ) {
    throw new Error(`french-entity-mention-invalid:${mention.mentionId}`);
  }
  if (
    mention.resolution === "non-entity" &&
    (mention.targetEntityIds.length !== 0 ||
      mention.allowedFrenchForms.length !== 0)
  ) {
    throw new Error(
      `french-entity-mention-invalid-non-entity:${mention.mentionId}`
    );
  }
  if (
    mention.resolution === "quarantined" &&
    (mention.targetEntityIds.length !== 0 ||
      mention.allowedFrenchForms.length !== 0 ||
      (mention.targetEntryKey === null && mention.citedStrong !== null))
  ) {
    throw new Error(
      `french-entity-mention-invalid-quarantined:${mention.mentionId}`
    );
  }
  if (
    mention.resolution === "exact" &&
    (mention.allowedFrenchForms.length === 0 ||
      (mention.targetEntryKey === null && mention.citedStrong !== null))
  ) {
    throw new Error(
      `french-entity-mention-invalid-exact:${mention.mentionId}:${mention.sourceEntryKey}:${mention.citedStrong ?? "uncited"}:${mention.targetEntryKey ?? "no-target"}:${mention.targetEntityIds.length}:${mention.allowedFrenchForms.length}`
    );
  }
  if (
    mention.resolution === "contextual" &&
    (mention.citedStrong !== null ||
      mention.targetEntryKey !== null ||
      mention.allowedFrenchForms.length < 1)
  ) {
    throw new Error(
      `french-entity-mention-invalid-contextual:${mention.mentionId}`
    );
  }
  const { contentHash: _contentHash, ...content } = mention;
  void _contentHash;
  if (hashFrenchInternalJson(content) !== mention.contentHash) {
    throw new Error(
      `french-entity-mention-record-hash-mismatch:${mention.mentionId}`
    );
  }
}

function englishFormPattern(form: string): string {
  return escapeRegExp(form.trim())
    .replace(/\s+/gu, "\\s+")
    .replace(/[’']/gu, "[’']")
    .replace(/[-‐‑‒–—]/gu, "[-‐‑‒–—]");
}

function isSafeEnglishEntityForm(value: string): boolean {
  const normalized = value.normalize("NFC").trim();
  const letters = normalized.match(/\p{L}/gu)?.length ?? 0;
  return (
    normalized === value &&
    letters >= 2 &&
    !/[<>\r\n]/u.test(normalized) &&
    !CONTAINS_CITED_STEP_PATTERN.test(normalized)
  );
}

function normalizeFrenchSurface(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[’']/gu, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function normalizeMeaningText(value: string): string {
  return value
    .normalize("NFC")
    .replace(/&apos;/giu, "'")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?%)\]])/gu, "$1")
    .replace(/([([])\s+/gu, "$1")
    .trim();
}

function uniquePolicies(
  policies: readonly FrenchEntityMentionCanonicalPolicy[]
): FrenchEntityMentionCanonicalPolicy[] {
  return [
    ...new Map(policies.map((policy) => [policy.entryKey, policy])).values()
  ].sort((left, right) => compareText(left.entryKey, right.entryKey));
}

function uniqueSortedStrings(values: readonly string[]): string[] {
  return [...new Set(values)].sort(compareText);
}

function uniqueSortedNumbers(values: readonly number[]): number[] {
  return [...new Set(values)].sort((left, right) => left - right);
}

function isSortedUniqueStrings(values: readonly string[]): boolean {
  return (
    values.every((value) => typeof value === "string" && value.trim()) &&
    canonicalFrenchInternalJson(values) ===
      canonicalFrenchInternalJson(uniqueSortedStrings(values))
  );
}

function isSortedUniqueNumbers(values: readonly number[]): boolean {
  return (
    values.every((value) => Number.isInteger(value) && value > 0) &&
    canonicalFrenchInternalJson(values) ===
      canonicalFrenchInternalJson(uniqueSortedNumbers(values))
  );
}

function sortedBy<T>(values: readonly T[], key: (value: T) => string): T[] {
  return [...values].sort((left, right) => compareText(key(left), key(right)));
}

function rangesOverlap(
  leftStart: number,
  leftEnd: number,
  rightStart: number,
  rightEnd: number
): boolean {
  return leftStart < rightEnd && rightStart < leftEnd;
}

function nonEmptyStrings(values: readonly unknown[]): boolean {
  return values.every(
    (value) => typeof value === "string" && value.trim().length > 0
  );
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function assertExactKeys(
  value: Record<string, unknown>,
  expected: readonly string[]
): void {
  const actual = Object.keys(value).sort(compareText);
  const wanted = [...expected].sort(compareText);
  if (
    canonicalFrenchInternalJson(actual) !== canonicalFrenchInternalJson(wanted)
  ) {
    throw new Error("french-entity-mentions-unexpected-keys");
  }
}
