import { createHash } from "node:crypto";

import {
  HEBREW_IDENTITY_CORRECTIONS,
  HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
} from "./hebrewIdentityCorrections.js";
import {
  buildFrenchHtmlTemplate,
  FRENCH_HTML_RENDERER_VERSION,
  FRENCH_HTML_TEMPLATE_SCHEMA_VERSION,
  frenchRenderedHtmlSkeleton,
  verifyFrenchHtmlTemplate
} from "./frenchHtmlRenderer.js";
import {
  type LexiconV3FrenchPacket,
  validateFrenchPacket
} from "./frenchPackets.js";
import type { FrenchReuseRecord } from "./frenchReuseManifest.js";
import {
  classifyFrenchEditorialPos,
  normalizeFrenchEvidence
} from "./frenchEditorialPolicy.js";
import {
  containsEquivalentBibleReference,
  stripLexiconHtml,
  validateLexiconHtmlPair
} from "./frenchValidation.js";

export const FRENCH_CANDIDATE_AUDIT_RECORD_SCHEMA_VERSION =
  "lexicon-v3-french-candidate-audit-record@1" as const;
export const FRENCH_CANDIDATE_AUDIT_SUMMARY_SCHEMA_VERSION =
  "lexicon-v3-french-candidate-audit-summary@1" as const;
export const FRENCH_CANDIDATE_AUDIT_POLICY_VERSION =
  "lexicon-v3-french-candidate-audit-policy@2" as const;

export type FrenchCandidateAuditStatus = "green" | "yellow" | "red";
export type FrenchCandidateAuditField =
  | "gloss"
  | "meaning"
  | "meaningHtml"
  | "pair"
  | "identity";
export type FrenchCandidateAuditImpact = "info" | "yellow" | "red";

export interface FrenchCandidateAuditReason {
  code: string;
  impact: FrenchCandidateAuditImpact;
  fields: FrenchCandidateAuditField[];
  details?: Record<string, unknown>;
}

export interface FrenchCandidateEntityRecord {
  schemaVersion: "lexicon-v3-french-entity-registry@1";
  entryKey: string;
  stepEntryId: number;
  status: FrenchCandidateAuditStatus;
  canonicalFr: string | null;
  contentHash: string;
}

export interface FrenchCandidateAuditRecord {
  schemaVersion: typeof FRENCH_CANDIDATE_AUDIT_RECORD_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_CANDIDATE_AUDIT_POLICY_VERSION;
  entryKey: string;
  stepEntryId: number;
  packetHash: string;
  englishHash: string;
  reuseRecordDigest: string;
  status: FrenchCandidateAuditStatus;
  fieldStatus: {
    gloss: FrenchCandidateAuditStatus;
    meaning: FrenchCandidateAuditStatus;
    meaningHtml: FrenchCandidateAuditStatus;
    pair: FrenchCandidateAuditStatus;
  };
  disposition:
    | "canonical-name-gloss-only"
    | "independent-candidates-review-required"
    | "reject-coupled-candidate";
  autoPromotableFields: Array<"gloss">;
  candidate: {
    trust: "untrusted-candidate";
    source: string;
    sourceHash: string;
    candidateHash: string;
    glossHash: string;
    meaningHash: string;
    meaningHtmlHash: string;
    lengths: { gloss: number; meaning: number; meaningHtml: number };
    byteIdenticalToEnglish: {
      gloss: boolean;
      meaning: boolean;
      meaningHtml: boolean;
    };
  };
  lineage: {
    reuseMeaningCohort: FrenchReuseRecord["meaningCohort"];
    glossReviewSeed: boolean;
    meaningReviewSeed: boolean;
    packetIdentityState: "exact-current" | "sealed-historical-before";
    canonicalIdentitySource: "reuse-promoted-release";
    identityCorrectionKey: string | null;
  };
  html: {
    rendererVersion: typeof FRENCH_HTML_RENDERER_VERSION;
    templateSchemaVersion: typeof FRENCH_HTML_TEMPLATE_SCHEMA_VERSION;
    sourceTemplateHash: string;
    sourceHtmlHash: string;
    sourceSkeletonHash: string;
    candidateSkeletonHash: string | null;
    sourceTagCount: number;
    candidateTagCount: number | null;
    translatableSegmentCount: number;
    sourceNormalizationCount: number;
    candidateParseError: string | null;
    skeletonExact: boolean;
    plainHtmlExact: boolean;
    plainHtmlTokenEquivalent: boolean;
  };
  protectedContent: {
    strongCodes: { required: string[]; missing: string[] };
    references: { required: string[]; missing: string[] };
    originalTokens: { required: string[]; missing: string[] };
  };
  language: {
    englishResidues: string[];
    translationArtifacts: string[];
    typographyIssues: string[];
  };
  properName: {
    detected: boolean;
    entityStatus: FrenchCandidateAuditStatus | null;
    canonicalFr: string | null;
    glossMatchesCanonical: boolean;
    canonicalGlossGreen: boolean;
  };
  reasons: FrenchCandidateAuditReason[];
  auditHash: string;
}

export interface FrenchCandidateAuditArtifact {
  path: string;
  sha256: string;
  bytes: number;
  records?: number;
}

export interface FrenchCandidateAuditSummary {
  schemaVersion: typeof FRENCH_CANDIDATE_AUDIT_SUMMARY_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_CANDIDATE_AUDIT_POLICY_VERSION;
  generatedAt: string;
  rendererVersion: typeof FRENCH_HTML_RENDERER_VERSION;
  expectedEntries: number;
  release: {
    releaseKey: string;
    releaseSnapshotFingerprint: string;
    reuseManifestDigest: string;
    hebrewIdentityCorrectionsDigest: string;
  };
  sourcePaths: {
    packets: string;
    packetSummary: string;
    reuseRecords: string;
    reuseSummary: string;
    entityRegistry: string;
    entitySummary: string;
  };
  sourceDigests: Record<
    | "packets"
    | "packetSummary"
    | "reuseRecords"
    | "reuseSummary"
    | "entityRegistry"
    | "entitySummary",
    string
  >;
  counts: {
    records: number;
    status: Record<FrenchCandidateAuditStatus, number>;
    fieldStatus: Record<
      "gloss" | "meaning" | "meaningHtml" | "pair",
      Record<FrenchCandidateAuditStatus, number>
    >;
    dispositions: Record<FrenchCandidateAuditRecord["disposition"], number>;
    properNames: number;
    canonicalNameGlossGreen: number;
    pairTextHtmlDivergence: number;
    htmlSkeletonMismatch: number;
    protectedContentFailure: number;
    englishResidue: number;
    translationArtifact: number;
    sealedIdentityCorrections: number;
    sourceHtmlNormalizations: number;
    sourceTranslatableSegments: number;
  };
  reasonCounts: Record<string, number>;
  recordsLogicalDigest: string;
  artifacts: {
    records: FrenchCandidateAuditArtifact;
    report: FrenchCandidateAuditArtifact;
  };
  summaryDigest: string;
}

export interface BuildFrenchCandidateAuditRecordInput {
  packet: LexiconV3FrenchPacket;
  reuse: FrenchReuseRecord;
  entity: FrenchCandidateEntityRecord | null;
}

const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const ENGLISH_RESIDUE_PATTERN =
  /(?<![\p{L}\p{M}\p{N}_])(?:and|chiefly|compare|corresponding|derived|especially|except|figuratively|hence|meaning|metaphorically|namely|outside|perhaps|possibly|probably|properly|spelling|therefore|the|uncertain|usually|whereas|which|without|within)(?![\p{L}\p{M}\p{N}_])/giu;

/** Stable, locale-independent serialization used by audit records and summaries. */
export function canonicalFrenchCandidateAuditJson(value: unknown): string {
  if (value === null) return "null";
  if (value === undefined) return "null";
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value))
      throw new Error("candidate-audit-non-finite-number");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalFrenchCandidateAuditJson).join(",")}]`;
  }
  if (typeof value !== "object") {
    throw new Error("candidate-audit-unsupported-value");
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map(
      (key) =>
        `${JSON.stringify(key)}:${canonicalFrenchCandidateAuditJson(object[key])}`
    )
    .join(",")}}`;
}

export function hashFrenchCandidateAudit(value: unknown): string {
  return sha256(canonicalFrenchCandidateAuditJson(value));
}

export function frenchCandidateAuditRecordHash(
  record:
    | FrenchCandidateAuditRecord
    | Omit<FrenchCandidateAuditRecord, "auditHash">
): string {
  const { auditHash: _auditHash, ...content } =
    record as FrenchCandidateAuditRecord;
  void _auditHash;
  return hashFrenchCandidateAudit(content);
}

export function frenchCandidateAuditSummaryHash(
  summary:
    | FrenchCandidateAuditSummary
    | Omit<FrenchCandidateAuditSummary, "summaryDigest">
): string {
  const { summaryDigest: _summaryDigest, ...content } =
    summary as FrenchCandidateAuditSummary;
  void _summaryDigest;
  return hashFrenchCandidateAudit(content);
}

export function assertFrenchCandidateCorrectionRegistry(): void {
  if (
    hashFrenchCandidateAudit(HEBREW_IDENTITY_CORRECTIONS) !==
    HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
  ) {
    throw new Error(
      "french-candidate-hebrew-correction-registry-digest-invalid"
    );
  }
}

export function buildFrenchCandidateAuditRecord(
  input: BuildFrenchCandidateAuditRecordInput
): FrenchCandidateAuditRecord {
  const { packet, reuse, entity } = input;
  const packetIssues = validateFrenchPacket(packet);
  if (packetIssues.length > 0) {
    throw new Error(
      `french-candidate-packet-invalid:${packet.entryKey}:${packetIssues.join(",")}`
    );
  }
  if (
    packet.entryKey !== reuse.entryKey ||
    packet.identity.stepEntryId !== reuse.stepEntryId
  ) {
    throw new Error(`french-candidate-reuse-join-mismatch:${packet.entryKey}`);
  }
  const candidate = packet.evidence.existingFrench;
  if (!candidate) {
    throw new Error(
      `french-candidate-existing-french-missing:${packet.entryKey}`
    );
  }
  if (candidate.trust !== "untrusted-candidate") {
    throw new Error(`french-candidate-trust-escalation:${packet.entryKey}`);
  }
  assertCandidateHashes(packet, reuse);
  const identity = assertPacketReuseIdentity(packet, reuse);

  const sourceTemplate = buildFrenchHtmlTemplate(packet.english.meaningHtml);
  const sourceTemplateIssues = verifyFrenchHtmlTemplate(
    sourceTemplate,
    packet.english.meaningHtml
  );
  if (sourceTemplateIssues.length > 0) {
    throw new Error(
      `french-candidate-source-template-invalid:${packet.entryKey}:${sourceTemplateIssues.join(",")}`
    );
  }
  const sourceSkeleton = sourceTemplate.tokens.flatMap((token) =>
    token.kind === "tag" ? [token.value] : []
  );

  const reasons: FrenchCandidateAuditReason[] = [];
  const addReason = (
    code: string,
    impact: FrenchCandidateAuditImpact,
    fields: FrenchCandidateAuditField[],
    details?: Record<string, unknown>
  ): void => {
    reasons.push({
      code,
      impact,
      fields: [...new Set(fields)].sort(),
      ...(details ? { details } : {})
    });
  };

  for (const [field, value] of [
    ["gloss", candidate.gloss],
    ["meaning", candidate.meaning],
    ["meaningHtml", candidate.meaningHtml]
  ] as const) {
    if (!value.trim()) addReason(`empty-${field}`, "red", [field]);
  }

  let candidateSkeleton: string[] | null = null;
  let candidateParseError: string | null = null;
  try {
    candidateSkeleton = frenchRenderedHtmlSkeleton(candidate.meaningHtml);
  } catch (error) {
    candidateParseError =
      error instanceof Error ? error.message : String(error);
    addReason("candidate-html-unparseable", "red", ["meaningHtml", "pair"], {
      error: candidateParseError
    });
  }
  const skeletonExact =
    candidateSkeleton !== null &&
    canonicalFrenchCandidateAuditJson(candidateSkeleton) ===
      canonicalFrenchCandidateAuditJson(sourceSkeleton);
  if (candidateSkeleton !== null && !skeletonExact) {
    addReason("html-source-skeleton-mismatch", "red", ["meaningHtml", "pair"], {
      sourceTagCount: sourceSkeleton.length,
      candidateTagCount: candidateSkeleton.length
    });
  }

  for (const issue of validateLexiconHtmlPair(
    candidate.meaning,
    candidate.meaningHtml
  )) {
    addReason(
      issue.code,
      issue.severity === "blocking" ? "red" : "yellow",
      issue.code === "meaning-text-html-divergence"
        ? ["meaning", "meaningHtml", "pair"]
        : ["meaningHtml", "pair"]
    );
  }
  const visibleHtml = stripLexiconHtml(candidate.meaningHtml);
  const plainHtmlExact =
    normalizeComparable(candidate.meaning) === normalizeComparable(visibleHtml);
  const plainHtmlTokenEquivalent =
    normalizeVisibleTokens(candidate.meaning) ===
    normalizeVisibleTokens(visibleHtml);
  if (!plainHtmlExact && plainHtmlTokenEquivalent) {
    addReason("meaning-text-html-punctuation-divergence", "yellow", ["pair"]);
  }

  const missingStrong = packet.protectedContent.strongCodes.filter(
    (value) => !containsNormalized(candidate.meaningHtml, value)
  );
  const missingReferences = packet.protectedContent.references.filter(
    (value) => !containsEquivalentBibleReference(candidate.meaningHtml, value)
  );
  const missingOriginal = packet.protectedContent.originalTokens.filter(
    (value) => !containsNormalized(candidate.meaningHtml, value)
  );
  if (missingStrong.length > 0) {
    addReason("protected-strong-code-missing", "red", ["meaningHtml", "pair"], {
      missing: missingStrong
    });
  }
  if (missingReferences.length > 0) {
    addReason(
      "protected-bible-reference-missing",
      "red",
      ["meaningHtml", "pair"],
      {
        missing: missingReferences
      }
    );
  }
  if (missingOriginal.length > 0) {
    addReason(
      "protected-original-token-missing",
      "red",
      ["meaningHtml", "pair"],
      {
        missing: missingOriginal
      }
    );
  }

  const englishResidueIssues = detectEnglishResidues({
    gloss: candidate.gloss,
    meaning: candidate.meaning,
    meaningHtml: visibleHtml
  });
  const englishResidues = uniqueSorted(
    englishResidueIssues.flatMap((issue) => issue.matches)
  );
  for (const issue of englishResidueIssues) {
    addReason("residual-english", "red", issue.fields, {
      matches: issue.matches
    });
  }

  const artifactIssues = detectTranslationArtifacts(
    candidate.gloss,
    candidate.meaning,
    candidate.meaningHtml
  );
  for (const artifact of artifactIssues) {
    addReason(artifact.code, "red", artifact.fields);
  }
  const artifacts = uniqueSorted(
    artifactIssues.map((artifact) => artifact.code)
  );
  const typographyIssues = detectTypographyIssues(candidate);
  for (const issue of typographyIssues) {
    addReason(issue.code, "yellow", issue.fields);
  }

  if (candidate.gloss.trim().length > 140) {
    addReason("gloss-too-long", "yellow", ["gloss"]);
  }
  if (/[.!?;:]$/u.test(candidate.gloss.trim())) {
    addReason("gloss-terminal-punctuation", "yellow", ["gloss"]);
  }
  if (
    /^to\s+/iu.test(packet.english.gloss) &&
    /^pour\s+/iu.test(candidate.gloss.trim())
  ) {
    addReason("verb-gloss-not-infinitive", "yellow", ["gloss"]);
  }

  const byteIdentical = {
    gloss: candidate.gloss === packet.english.gloss,
    meaning: candidate.meaning === packet.english.meaning,
    meaningHtml: candidate.meaningHtml === packet.english.meaningHtml
  };
  const properNameDetected =
    entity !== null ||
    classifyFrenchEditorialPos(reuse.identity.morph) === "proper-name";
  if (byteIdentical.gloss && !properNameDetected) {
    addReason("gloss-byte-identical-to-english-non-name", "yellow", ["gloss"]);
  }
  if (byteIdentical.meaning) {
    addReason("meaning-byte-identical-to-english", "red", ["meaning"]);
  }
  if (byteIdentical.meaningHtml) {
    addReason("meaning-html-byte-identical-to-english", "red", [
      "meaningHtml",
      "pair"
    ]);
  }

  if (reuse.meaningCohort !== "unchanged") {
    addReason(
      `reuse-parent-${reuse.meaningCohort.replaceAll("_", "-")}`,
      "yellow",
      ["meaning", "meaningHtml", "pair"]
    );
  }
  if (reuse.glossReviewSeed) {
    addReason("reuse-gloss-review-seed", "yellow", ["gloss"]);
  }
  if (reuse.meaningReviewSeed) {
    addReason("reuse-meaning-review-seed", "yellow", [
      "meaning",
      "meaningHtml"
    ]);
  }
  for (const flag of reuse.glossRiskFlags) {
    if (flag === "hebrew-identity-correction") continue;
    const impact: FrenchCandidateAuditImpact =
      flag === "legacy-french-known-false-friend" ? "red" : "yellow";
    addReason(`reuse-${flag}`, impact, ["gloss"]);
  }
  if (identity.state === "sealed-historical-before") {
    addReason("sealed-hebrew-identity-correction", "info", ["identity"], {
      correctionKey: identity.correctionKey
    });
  }

  const canonicalFr = entity?.canonicalFr ?? null;
  const glossMatchesCanonical =
    entity?.status === "green" &&
    Boolean(canonicalFr) &&
    normalizeFrenchEvidence(candidate.gloss) ===
      normalizeFrenchEvidence(canonicalFr!);
  if (entity?.status === "green" && !glossMatchesCanonical) {
    addReason("green-entity-canonical-gloss-mismatch", "red", ["gloss"], {
      canonicalFr
    });
  } else if (properNameDetected && entity?.status !== "green") {
    addReason(
      "proper-name-without-green-canonical-entity",
      "yellow",
      ["gloss"],
      {
        entityStatus: entity?.status ?? null
      }
    );
  } else if (glossMatchesCanonical) {
    addReason("canonical-proper-name-attested", "info", ["gloss"]);
  }

  const normalizedReasons = normalizeReasons(reasons);
  const fieldStatus = {
    gloss: fieldStatusFromReasons("gloss", normalizedReasons),
    meaning: fieldStatusFromReasons("meaning", normalizedReasons),
    meaningHtml: fieldStatusFromReasons("meaningHtml", normalizedReasons),
    pair:
      skeletonExact && plainHtmlExact
        ? fieldStatusFromReasons("pair", normalizedReasons, "green")
        : fieldStatusFromReasons("pair", normalizedReasons)
  };
  if (glossMatchesCanonical && fieldStatus.gloss !== "red") {
    // The entity registry is stronger than historical gloss heuristics: an
    // exact, independently attested canonical name may be reused as a gloss
    // even when the unrelated historical meaning still needs review.
    fieldStatus.gloss = "green";
  }
  const hasRed = normalizedReasons.some((reason) => reason.impact === "red");
  const hasYellow = normalizedReasons.some(
    (reason) => reason.impact === "yellow"
  );
  const status: FrenchCandidateAuditStatus = hasRed
    ? "red"
    : glossMatchesCanonical && !hasYellow && fieldStatus.pair === "green"
      ? "green"
      : "yellow";
  if (status === "yellow" && !hasYellow) {
    normalizedReasons.push({
      code: "deterministic-checks-pass-semantic-review-required",
      impact: "yellow",
      fields: ["gloss", "meaning", "meaningHtml"]
    });
  }
  normalizedReasons.sort(compareReasons);

  const autoPromotableFields: Array<"gloss"> =
    fieldStatus.gloss === "green" && glossMatchesCanonical ? ["gloss"] : [];
  const disposition: FrenchCandidateAuditRecord["disposition"] =
    autoPromotableFields.length === 1
      ? "canonical-name-gloss-only"
      : hasRed
        ? "reject-coupled-candidate"
        : "independent-candidates-review-required";

  const content: Omit<FrenchCandidateAuditRecord, "auditHash"> = {
    schemaVersion: FRENCH_CANDIDATE_AUDIT_RECORD_SCHEMA_VERSION,
    policyVersion: FRENCH_CANDIDATE_AUDIT_POLICY_VERSION,
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    reuseRecordDigest: reuse.recordDigest,
    status,
    fieldStatus,
    disposition,
    autoPromotableFields,
    candidate: {
      trust: "untrusted-candidate",
      source: candidate.source,
      sourceHash: candidate.sourceHash,
      candidateHash: hashFrenchCandidateAudit({
        gloss: candidate.gloss,
        meaning: candidate.meaning,
        meaningHtml: candidate.meaningHtml
      }),
      glossHash: sha256(candidate.gloss),
      meaningHash: sha256(candidate.meaning),
      meaningHtmlHash: sha256(candidate.meaningHtml),
      lengths: {
        gloss: candidate.gloss.length,
        meaning: candidate.meaning.length,
        meaningHtml: candidate.meaningHtml.length
      },
      byteIdenticalToEnglish: byteIdentical
    },
    lineage: {
      reuseMeaningCohort: reuse.meaningCohort,
      glossReviewSeed: reuse.glossReviewSeed,
      meaningReviewSeed: reuse.meaningReviewSeed,
      packetIdentityState: identity.state,
      canonicalIdentitySource: "reuse-promoted-release",
      identityCorrectionKey: identity.correctionKey
    },
    html: {
      rendererVersion: FRENCH_HTML_RENDERER_VERSION,
      templateSchemaVersion: FRENCH_HTML_TEMPLATE_SCHEMA_VERSION,
      sourceTemplateHash: sourceTemplate.templateHash,
      sourceHtmlHash: sourceTemplate.sourceHtmlHash,
      sourceSkeletonHash: hashFrenchCandidateAudit(sourceSkeleton),
      candidateSkeletonHash:
        candidateSkeleton === null
          ? null
          : hashFrenchCandidateAudit(candidateSkeleton),
      sourceTagCount: sourceSkeleton.length,
      candidateTagCount: candidateSkeleton?.length ?? null,
      translatableSegmentCount: sourceTemplate.tokens.filter(
        (token) => token.kind === "text" && token.translatable
      ).length,
      sourceNormalizationCount: sourceTemplate.sourceNormalizations.length,
      candidateParseError,
      skeletonExact,
      plainHtmlExact,
      plainHtmlTokenEquivalent
    },
    protectedContent: {
      strongCodes: {
        required: uniqueSorted(packet.protectedContent.strongCodes),
        missing: uniqueSorted(missingStrong)
      },
      references: {
        required: uniqueSorted(packet.protectedContent.references),
        missing: uniqueSorted(missingReferences)
      },
      originalTokens: {
        required: uniqueSorted(packet.protectedContent.originalTokens),
        missing: uniqueSorted(missingOriginal)
      }
    },
    language: {
      englishResidues,
      translationArtifacts: artifacts,
      typographyIssues: typographyIssues.map((issue) => issue.code)
    },
    properName: {
      detected: properNameDetected,
      entityStatus: entity?.status ?? null,
      canonicalFr,
      glossMatchesCanonical,
      canonicalGlossGreen:
        fieldStatus.gloss === "green" && glossMatchesCanonical
    },
    reasons: normalizedReasons
  };
  return { ...content, auditHash: frenchCandidateAuditRecordHash(content) };
}

export function assertFrenchCandidateAuditRecords(
  records: readonly FrenchCandidateAuditRecord[],
  expectedEntries?: number
): void {
  if (expectedEntries !== undefined && records.length !== expectedEntries) {
    throw new Error(
      `french-candidate-audit-record-count:${records.length}:${expectedEntries}`
    );
  }
  const keys = new Set<string>();
  const ids = new Set<number>();
  let previousKey = "";
  for (const record of records) {
    if (record.schemaVersion !== FRENCH_CANDIDATE_AUDIT_RECORD_SCHEMA_VERSION) {
      throw new Error(
        `french-candidate-audit-record-schema:${record.entryKey}`
      );
    }
    if (record.policyVersion !== FRENCH_CANDIDATE_AUDIT_POLICY_VERSION) {
      throw new Error(
        `french-candidate-audit-record-policy:${record.entryKey}`
      );
    }
    if (keys.has(record.entryKey) || ids.has(record.stepEntryId)) {
      throw new Error(
        `french-candidate-audit-record-duplicate:${record.entryKey}`
      );
    }
    if (previousKey && previousKey.localeCompare(record.entryKey) >= 0) {
      throw new Error("french-candidate-audit-record-order");
    }
    if (
      !SHA256_PATTERN.test(record.auditHash) ||
      frenchCandidateAuditRecordHash(record) !== record.auditHash
    ) {
      throw new Error(`french-candidate-audit-record-hash:${record.entryKey}`);
    }
    if (
      record.autoPromotableFields.length > 0 &&
      (!record.properName.canonicalGlossGreen ||
        canonicalFrenchCandidateAuditJson(record.autoPromotableFields) !==
          canonicalFrenchCandidateAuditJson(["gloss"]))
    ) {
      throw new Error(
        `french-candidate-audit-invalid-promotion:${record.entryKey}`
      );
    }
    keys.add(record.entryKey);
    ids.add(record.stepEntryId);
    previousKey = record.entryKey;
  }
}

export function buildFrenchCandidateAuditCounts(
  records: readonly FrenchCandidateAuditRecord[]
): Pick<FrenchCandidateAuditSummary, "counts" | "reasonCounts"> {
  const status = statusCounts();
  const fieldStatus = {
    gloss: statusCounts(),
    meaning: statusCounts(),
    meaningHtml: statusCounts(),
    pair: statusCounts()
  };
  const dispositions: FrenchCandidateAuditSummary["counts"]["dispositions"] = {
    "canonical-name-gloss-only": 0,
    "independent-candidates-review-required": 0,
    "reject-coupled-candidate": 0
  };
  const reasonCounts: Record<string, number> = {};
  let properNames = 0;
  let canonicalNameGlossGreen = 0;
  let pairTextHtmlDivergence = 0;
  let htmlSkeletonMismatch = 0;
  let protectedContentFailure = 0;
  let englishResidue = 0;
  let translationArtifact = 0;
  let sealedIdentityCorrections = 0;
  let sourceHtmlNormalizations = 0;
  let sourceTranslatableSegments = 0;
  for (const record of records) {
    status[record.status] += 1;
    for (const field of Object.keys(fieldStatus) as Array<
      keyof typeof fieldStatus
    >) {
      fieldStatus[field][record.fieldStatus[field]] += 1;
    }
    dispositions[record.disposition] += 1;
    if (record.properName.detected) properNames += 1;
    if (record.properName.canonicalGlossGreen) canonicalNameGlossGreen += 1;
    if (!record.html.plainHtmlTokenEquivalent) pairTextHtmlDivergence += 1;
    if (!record.html.skeletonExact) htmlSkeletonMismatch += 1;
    if (
      record.protectedContent.strongCodes.missing.length > 0 ||
      record.protectedContent.references.missing.length > 0 ||
      record.protectedContent.originalTokens.missing.length > 0
    ) {
      protectedContentFailure += 1;
    }
    if (record.language.englishResidues.length > 0) englishResidue += 1;
    if (record.language.translationArtifacts.length > 0)
      translationArtifact += 1;
    if (record.lineage.packetIdentityState === "sealed-historical-before") {
      sealedIdentityCorrections += 1;
    }
    sourceHtmlNormalizations += record.html.sourceNormalizationCount;
    sourceTranslatableSegments += record.html.translatableSegmentCount;
    for (const reason of record.reasons) increment(reasonCounts, reason.code);
  }
  return {
    counts: {
      records: records.length,
      status,
      fieldStatus,
      dispositions,
      properNames,
      canonicalNameGlossGreen,
      pairTextHtmlDivergence,
      htmlSkeletonMismatch,
      protectedContentFailure,
      englishResidue,
      translationArtifact,
      sealedIdentityCorrections,
      sourceHtmlNormalizations,
      sourceTranslatableSegments
    },
    reasonCounts: sortRecord(reasonCounts)
  };
}

export function renderFrenchCandidateAuditRecords(
  records: readonly FrenchCandidateAuditRecord[]
): string {
  return `${records.map(canonicalFrenchCandidateAuditJson).join("\n")}\n`;
}

export function assertFrenchCandidateAuditSummary(
  summary: FrenchCandidateAuditSummary,
  records: readonly FrenchCandidateAuditRecord[],
  recordsText: string,
  reportText: string
): void {
  if (summary.schemaVersion !== FRENCH_CANDIDATE_AUDIT_SUMMARY_SCHEMA_VERSION) {
    throw new Error("french-candidate-audit-summary-schema");
  }
  if (summary.policyVersion !== FRENCH_CANDIDATE_AUDIT_POLICY_VERSION) {
    throw new Error("french-candidate-audit-summary-policy");
  }
  assertFrenchCandidateAuditRecords(records, summary.expectedEntries);
  const recomputed = buildFrenchCandidateAuditCounts(records);
  if (
    canonicalFrenchCandidateAuditJson(recomputed) !==
    canonicalFrenchCandidateAuditJson({
      counts: summary.counts,
      reasonCounts: summary.reasonCounts
    })
  ) {
    throw new Error("french-candidate-audit-summary-counts");
  }
  if (
    summary.artifacts.records.sha256 !== sha256(recordsText) ||
    summary.artifacts.records.bytes !== Buffer.byteLength(recordsText) ||
    summary.artifacts.records.records !== records.length
  ) {
    throw new Error("french-candidate-audit-record-artifact");
  }
  if (
    summary.artifacts.report.sha256 !== sha256(reportText) ||
    summary.artifacts.report.bytes !== Buffer.byteLength(reportText)
  ) {
    throw new Error("french-candidate-audit-report-artifact");
  }
  const logicalDigest = hashFrenchCandidateAudit(
    records.map((record) => ({
      entryKey: record.entryKey,
      auditHash: record.auditHash
    }))
  );
  if (summary.recordsLogicalDigest !== logicalDigest) {
    throw new Error("french-candidate-audit-records-logical-digest");
  }
  if (frenchCandidateAuditSummaryHash(summary) !== summary.summaryDigest) {
    throw new Error("french-candidate-audit-summary-digest");
  }
}

function assertCandidateHashes(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord
): void {
  const candidate = packet.evidence.existingFrench!;
  const mismatches: string[] = [];
  if (
    packet.englishRelease.releaseKey !== reuse.parents.gloss.releaseKey ||
    packet.englishRelease.releaseKey !== reuse.parents.meaning.releaseKey ||
    packet.englishRelease.releaseSnapshotFingerprint !==
      reuse.parents.gloss.releaseSnapshotFingerprint ||
    packet.englishRelease.releaseSnapshotFingerprint !==
      reuse.parents.meaning.releaseSnapshotFingerprint
  ) {
    mismatches.push("english-release");
  }
  for (const field of ["gloss", "meaning"] as const) {
    const packetParent = packet.englishRelease.parents[field];
    const reuseParent = reuse.parents[field];
    if (
      packetParent.entryKey !== reuseParent.entryKey ||
      packetParent.field !== reuseParent.field ||
      packetParent.fieldVersionId !== reuseParent.fieldVersionId ||
      packetParent.contentHash !== reuseParent.contentHash ||
      packetParent.valueTextHash !== reuseParent.valueTextHash ||
      packetParent.valueHtmlHash !== reuseParent.valueHtmlHash ||
      packetParent.state !== reuseParent.state ||
      packetParent.method !== reuseParent.method ||
      packetParent.generator !== reuseParent.generator
    ) {
      mismatches.push(`english-parent-${field}`);
    }
  }
  if (sha256(packet.english.gloss) !== reuse.parents.gloss.valueTextHash) {
    mismatches.push("english-gloss");
  }
  if (sha256(packet.english.meaning) !== reuse.parents.meaning.valueTextHash) {
    mismatches.push("english-meaning");
  }
  if (
    reuse.parents.meaning.valueHtmlHash === null
      ? packet.english.meaningHtml !== packet.english.meaning
      : sha256(packet.english.meaningHtml) !==
        reuse.parents.meaning.valueHtmlHash
  ) {
    mismatches.push("english-meaning-html");
  }
  if (sha256(candidate.gloss) !== reuse.priorFrench.glossHash) {
    mismatches.push("french-gloss");
  }
  if (sha256(candidate.meaning) !== reuse.priorFrench.meaningTextHash) {
    mismatches.push("french-meaning");
  }
  if (sha256(candidate.meaningHtml) !== reuse.priorFrench.meaningHtmlHash) {
    mismatches.push("french-meaning-html");
  }
  if (mismatches.length > 0) {
    throw new Error(
      `french-candidate-reuse-hash-mismatch:${packet.entryKey}:${mismatches.join(",")}`
    );
  }
}

function assertPacketReuseIdentity(
  packet: LexiconV3FrenchPacket,
  reuse: FrenchReuseRecord
): {
  state: "exact-current" | "sealed-historical-before";
  correctionKey: string | null;
} {
  const packetIdentity = identityProjection(packet.identity);
  const reuseIdentity = identityProjection(reuse.identity);
  if (
    canonicalFrenchCandidateAuditJson(packetIdentity) ===
    canonicalFrenchCandidateAuditJson(reuseIdentity)
  ) {
    return { state: "exact-current", correctionKey: null };
  }
  const correction = HEBREW_IDENTITY_CORRECTIONS.find(
    (value) => value.stepEntryId === reuse.stepEntryId
  );
  const key = reuse.entryKey.replace(/^hebrew:/u, "");
  if (
    !correction ||
    correction.key !== key ||
    canonicalFrenchCandidateAuditJson(packetIdentity) !==
      canonicalFrenchCandidateAuditJson(correction.before) ||
    canonicalFrenchCandidateAuditJson(reuseIdentity) !==
      canonicalFrenchCandidateAuditJson(correction.after) ||
    !reuse.highRiskFlags.includes("hebrew-identity-correction")
  ) {
    throw new Error(
      `french-candidate-unsealed-identity-drift:${packet.entryKey}`
    );
  }
  const actuallyChanged = Object.keys(correction.before)
    .filter(
      (field) =>
        correction.before[field as keyof typeof correction.before] !==
        correction.after[field as keyof typeof correction.after]
    )
    .sort();
  if (
    canonicalFrenchCandidateAuditJson(actuallyChanged) !==
    canonicalFrenchCandidateAuditJson([...correction.changedFields].sort())
  ) {
    throw new Error(
      `french-candidate-correction-fields-invalid:${packet.entryKey}`
    );
  }
  return { state: "sealed-historical-before", correctionKey: correction.key };
}

function identityProjection(input: {
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
}): {
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
} {
  return {
    eStrong: input.eStrong,
    dStrong: input.dStrong,
    uStrong: input.uStrong,
    original: input.original,
    transliteration: input.transliteration,
    morph: input.morph
  };
}

function normalizeReasons(
  reasons: readonly FrenchCandidateAuditReason[]
): FrenchCandidateAuditReason[] {
  const byKey = new Map<string, FrenchCandidateAuditReason>();
  for (const reason of reasons) {
    const normalized: FrenchCandidateAuditReason = {
      ...reason,
      fields: [...new Set(reason.fields)].sort()
    };
    const key = canonicalFrenchCandidateAuditJson(normalized);
    if (!byKey.has(key)) byKey.set(key, normalized);
  }
  return [...byKey.values()].sort(compareReasons);
}

function compareReasons(
  left: FrenchCandidateAuditReason,
  right: FrenchCandidateAuditReason
): number {
  return (
    left.code.localeCompare(right.code) ||
    canonicalFrenchCandidateAuditJson(left).localeCompare(
      canonicalFrenchCandidateAuditJson(right)
    )
  );
}

function fieldStatusFromReasons(
  field: FrenchCandidateAuditField,
  reasons: readonly FrenchCandidateAuditReason[],
  clean: FrenchCandidateAuditStatus = "yellow"
): FrenchCandidateAuditStatus {
  const relevant = reasons.filter((reason) => reason.fields.includes(field));
  if (relevant.some((reason) => reason.impact === "red")) return "red";
  if (relevant.some((reason) => reason.impact === "yellow")) return "yellow";
  return clean;
}

function detectTranslationArtifacts(
  gloss: string,
  meaning: string,
  meaningHtml: string
): Array<{ code: string; fields: FrenchCandidateAuditField[] }> {
  const issues: Array<{ code: string; fields: FrenchCandidateAuditField[] }> =
    [];
  const fields = [
    { field: "gloss" as const, value: gloss },
    { field: "meaning" as const, value: meaning },
    { field: "meaningHtml" as const, value: meaningHtml }
  ];
  for (const { field, value } of fields) {
    const affected: FrenchCandidateAuditField[] =
      field === "meaningHtml" ? [field, "pair"] : [field];
    if (/\b(?:undefined|null|NaN|\[object Object\])\b/u.test(value)) {
      issues.push({
        code: "translation-placeholder-artifact",
        fields: affected
      });
    }
    if (/\{\{[^}]+\}\}|\$\{[^}]+\}/u.test(value)) {
      issues.push({
        code: "translation-template-placeholder",
        fields: affected
      });
    }
    if (/Ã.|â(?:€™|€œ|€|€“|€”)|�/u.test(value)) {
      issues.push({ code: "translation-mojibake", fields: affected });
    }
    if (/,,|;;|::|,\s*,/u.test(value)) {
      issues.push({
        code: "translation-duplicate-punctuation",
        fields: affected
      });
    }
    if (
      (value.match(/«/gu) ?? []).length !== (value.match(/»/gu) ?? []).length
    ) {
      issues.push({
        code: "translation-unbalanced-french-quotes",
        fields: affected
      });
    }
  }
  if (/«[^»\n]{0,100}\(\s*»|«[^»\n]{0,100}<\/b>\s*»/u.test(meaningHtml)) {
    issues.push({
      code: "translation-misplaced-source-token-quotes",
      fields: ["meaningHtml", "pair"]
    });
  }
  if (/<->/u.test(meaningHtml)) {
    issues.push({
      code: "translation-raw-angle-arrow-in-html",
      fields: ["meaningHtml", "pair"]
    });
  }
  if (/&amp;(?:amp|lt|gt|nbsp|quot);/iu.test(meaningHtml)) {
    issues.push({
      code: "translation-double-encoded-html-entity",
      fields: ["meaningHtml", "pair"]
    });
  }
  return issues.sort(
    (left, right) =>
      left.code.localeCompare(right.code) ||
      canonicalFrenchCandidateAuditJson(left.fields).localeCompare(
        canonicalFrenchCandidateAuditJson(right.fields)
      )
  );
}

function detectEnglishResidues(input: {
  gloss: string;
  meaning: string;
  meaningHtml: string;
}): Array<{
  fields: FrenchCandidateAuditField[];
  matches: string[];
}> {
  const issues: Array<{
    fields: FrenchCandidateAuditField[];
    matches: string[];
  }> = [];
  for (const [field, value] of Object.entries(input) as Array<
    ["gloss" | "meaning" | "meaningHtml", string]
  >) {
    ENGLISH_RESIDUE_PATTERN.lastIndex = 0;
    const matches = uniqueSorted(
      [...value.matchAll(ENGLISH_RESIDUE_PATTERN)].map((match) =>
        (match[0] ?? "").toLocaleLowerCase("en")
      )
    );
    if (matches.length > 0) {
      issues.push({
        fields: field === "meaningHtml" ? [field, "pair"] : [field],
        matches
      });
    }
  }
  return issues;
}

function detectTypographyIssues(candidate: {
  gloss: string;
  meaning: string;
  meaningHtml: string;
}): Array<{ code: string; fields: FrenchCandidateAuditField[] }> {
  const issues: Array<{ code: string; fields: FrenchCandidateAuditField[] }> =
    [];
  for (const [field, value] of [
    ["gloss", candidate.gloss],
    ["meaning", candidate.meaning],
    ["meaningHtml", stripLexiconHtml(candidate.meaningHtml)]
  ] as const) {
    if (value !== value.trim()) {
      issues.push({ code: `${field}-outer-whitespace`, fields: [field] });
    }
    if (/\t| {2,}/u.test(value)) {
      issues.push({
        code: `${field}-repeated-horizontal-space`,
        fields: [field]
      });
    }
    if (/\s+[,.)]/u.test(value)) {
      issues.push({
        code: `${field}-space-before-punctuation`,
        fields: [field]
      });
    }
    if (/['’]\s+|\s+['’]/u.test(value)) {
      issues.push({
        code: `${field}-space-around-apostrophe`,
        fields: [field]
      });
    }
  }
  return issues.sort((left, right) => left.code.localeCompare(right.code));
}

function containsNormalized(haystack: string, needle: string): boolean {
  return haystack.normalize("NFC").includes(needle.normalize("NFC"));
}

function normalizeComparable(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/[\u2018\u2019]/gu, "'")
    .replace(/\s+/gu, " ")
    .replace(/\s+([,.;:!?])/gu, "$1")
    .trim();
}

function normalizeVisibleTokens(value: string): string {
  return (
    value
      .normalize("NFKC")
      .toLocaleLowerCase("fr")
      .match(/[\p{L}\p{N}]+/gu) ?? []
  ).join(" ");
}

function statusCounts(): Record<FrenchCandidateAuditStatus, number> {
  return { green: 0, yellow: 0, red: 0 };
}

function increment(record: Record<string, number>, key: string): void {
  record[key] = (record[key] ?? 0) + 1;
}

function sortRecord(input: Record<string, number>): Record<string, number> {
  return Object.fromEntries(
    Object.entries(input).sort(([left], [right]) => left.localeCompare(right))
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((left, right) =>
    left.localeCompare(right)
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
