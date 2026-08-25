import type { HebrewEnglishCandidate } from "./hebrewEnglish.js";
import { extractPrimaryDStrong } from "./identity.js";
import {
  normalizeExactDStrong,
  normalizeStepOrOsisVerseReference,
  type TbeshExactDStrongOccurrence,
  type TbeshReferenceInput
} from "./tbeshScopeProof.js";

export type HebrewPublicationProofIssue =
  | "hebrew-publication-augmented-lexical-index-id-mismatch"
  | "hebrew-publication-augmented-strong-invalid"
  | "hebrew-publication-augmented-strong-mismatch"
  | "hebrew-publication-augmented-strong-missing"
  | "hebrew-publication-candidate-dstrong-invalid"
  | "hebrew-publication-candidate-not-validated"
  | "hebrew-publication-exact-occurrence-count-invalid"
  | "hebrew-publication-exact-occurrence-dstrong-invalid"
  | "hebrew-publication-exact-occurrence-missing"
  | "hebrew-publication-exact-occurrence-reference-invalid"
  | "hebrew-publication-lexical-index-id-ambiguous"
  | "hebrew-publication-lexical-index-id-invalid"
  | "hebrew-publication-lexical-index-id-missing"
  | "hebrew-publication-meaning-empty"
  | "hebrew-publication-meaning-not-validated"
  | "hebrew-publication-method-unsupported"
  | "hebrew-publication-source-identity-missing"
  | "hebrew-publication-source-index-mismatch"
  | "hebrew-publication-source-index-not-unique"
  | "hebrew-publication-source-original-mismatch"
  | "hebrew-publication-source-pos-mismatch"
  | "hebrew-publication-source-record-mismatch"
  | "hebrew-publication-source-record-not-unique"
  | "hebrew-publication-primary-dstrong-invalid"
  | "hebrew-publication-primary-dstrong-mismatch"
  | "hebrew-publication-tipnr-entity-ambiguous"
  | "hebrew-publication-tipnr-entity-id-invalid"
  | "hebrew-publication-tipnr-entity-missing"
  | "hebrew-publication-tipnr-occurrence-outside-entity"
  | "hebrew-publication-tipnr-reference-invalid"
  | "hebrew-publication-tipnr-references-missing";

export interface HebrewEnglishPublicationProofInput {
  candidate: HebrewEnglishCandidate;
  primaryDStrong: string;
  tahotOccurrences: readonly TbeshExactDStrongOccurrence[];
}

export interface HebrewEnglishPublicationProof {
  proven: boolean;
  issueCodes: HebrewPublicationProofIssue[];
  method: HebrewEnglishCandidate["method"];
  normalizedPrimaryDStrong: string | null;
  normalizedCandidateDStrong: string | null;
  facts: {
    meaningHasContent: boolean;
    meaningValidated: boolean;
    candidateValidated: boolean;
    exactCandidateIdentity: boolean;
    exactOccurrenceCount: number;
    tipnrEntityId: number | null;
    tipnrReferencesValid: boolean;
    exactOccurrenceIntersectsTipnr: boolean;
    lexicalIndexId: string | null;
    augmentedStrong: string | null;
    augmentedStrongExact: boolean;
    exactSourceIdentity: boolean;
    sourceRecordId: string | null;
  };
  references: {
    tipnrEntity: string[];
    exactTahotOccurrences: string[];
  };
}

export type HebrewGlossPublicationProofIssue =
  | "hebrew-gloss-publication-candidate-dstrong-mismatch"
  | "hebrew-gloss-publication-empty"
  | "hebrew-gloss-publication-evidence-missing"
  | "hebrew-gloss-publication-method-unsupported"
  | "hebrew-gloss-publication-source-identity-missing"
  | "hebrew-gloss-publication-source-identity-unproven"
  | "hebrew-gloss-publication-source-text-mismatch"
  | "hebrew-gloss-publication-tipnr-entity-unproven"
  | "hebrew-gloss-publication-tipnr-reference-invalid"
  | "hebrew-gloss-publication-tipnr-reference-missing"
  | "hebrew-gloss-publication-tipnr-tahot-intersection-missing";

export interface HebrewEnglishGlossPublicationProof {
  proven: boolean;
  issueCodes: HebrewGlossPublicationProofIssue[];
  method: "tipnr-exact-alias" | "hebrew-strong-meaning" | "unsupported";
  sourceRecordId: string | null;
  references: {
    tipnrEntity: string[];
    exactTahotOccurrences: string[];
  };
}

export type StepTechnicalMarkerProofIssue =
  | "step-technical-marker-base-code-invalid"
  | "step-technical-marker-dstrong-mismatch"
  | "step-technical-marker-estrong-mismatch"
  | "step-technical-marker-gloss-empty"
  | "step-technical-marker-meaning-empty"
  | "step-technical-marker-morph-empty"
  | "step-technical-marker-original-empty"
  | "step-technical-marker-ustrong-mismatch";

export interface StepTechnicalMarkerProofInput {
  baseCode: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  morph: string;
  gloss: string;
  meaningHtml: string;
}

export interface StepTechnicalMarkerProof {
  proven: boolean;
  issueCodes: StepTechnicalMarkerProofIssue[];
  normalizedDStrong: string | null;
  expectedDStrong: string | null;
}

/**
 * Proves that an independently built English candidate is exact enough to
 * replace a TBESH notice. OpenScriptures lexical sources prove identity via
 * their pinned record, form, POS, and unique index. TIPNR remains deliberately
 * stricter and additionally requires an EntityRefs/TAHOT verse intersection.
 */
export function proveHebrewEnglishPublicationCandidate(
  input: HebrewEnglishPublicationProofInput
): HebrewEnglishPublicationProof {
  const issues = new Set<HebrewPublicationProofIssue>();
  const { candidate } = input;

  const meaningHasContent = hasVisibleMeaningContent(
    candidate.english?.meaningHtml
  );
  if (!meaningHasContent) issues.add("hebrew-publication-meaning-empty");

  const meaningValidated =
    candidate.fieldAssessments?.meaning?.status === "validated";
  if (!meaningValidated) {
    issues.add("hebrew-publication-meaning-not-validated");
  }
  const candidateValidated = candidate.status === "validated";
  if (!candidateValidated) {
    issues.add("hebrew-publication-candidate-not-validated");
  }

  const normalizedPrimaryDStrong = normalizeExactDStrong(input.primaryDStrong);
  if (!normalizedPrimaryDStrong) {
    issues.add("hebrew-publication-primary-dstrong-invalid");
  }
  const candidatePrimaryDStrong = extractPrimaryDStrong(
    candidate.identity?.dStrong ?? ""
  );
  const normalizedCandidateDStrong = candidatePrimaryDStrong
    ? normalizeExactDStrong(candidatePrimaryDStrong)
    : null;
  if (!normalizedCandidateDStrong) {
    issues.add("hebrew-publication-candidate-dstrong-invalid");
  }
  const exactCandidateIdentity = Boolean(
    normalizedPrimaryDStrong &&
    normalizedCandidateDStrong &&
    normalizedPrimaryDStrong === normalizedCandidateDStrong
  );
  if (
    normalizedPrimaryDStrong &&
    normalizedCandidateDStrong &&
    !exactCandidateIdentity
  ) {
    issues.add("hebrew-publication-primary-dstrong-mismatch");
  }
  const sourcePrimaryDStrong = normalizeExactDStrong(
    candidate.mapping?.sourceIdentity?.primaryDStrong ?? ""
  );
  if (!sourcePrimaryDStrong) {
    issues.add("hebrew-publication-source-identity-missing");
  } else if (sourcePrimaryDStrong !== normalizedPrimaryDStrong) {
    issues.add("hebrew-publication-source-record-mismatch");
  }

  const occurrenceEvidence = collectExactOccurrences(
    normalizedPrimaryDStrong,
    input.tahotOccurrences
  );
  const exactOccurrenceCount = occurrenceEvidence.count;
  const exactOccurrenceReferences = occurrenceEvidence.references;
  let tipnrEntityId: number | null = null;
  let tipnrReferences: NormalizedReferences = {
    values: [],
    invalidCount: 0
  };
  let tipnrReferencesValid = false;
  let exactOccurrenceIntersectsTipnr = false;
  let lexicalIndexId: string | null = null;
  let normalizedAugmentedStrong: string | null = null;
  let augmentedStrongExact = false;
  let exactSourceIdentity = false;
  let sourceRecordId: string | null = null;

  if (!isSupportedMethod(candidate.method)) {
    issues.add("hebrew-publication-method-unsupported");
  } else if (candidate.method === "tipnr-exact-dstrong") {
    if (occurrenceEvidence.invalidDStrongCount > 0) {
      issues.add("hebrew-publication-exact-occurrence-dstrong-invalid");
    }
    if (occurrenceEvidence.invalidCountCount > 0) {
      issues.add("hebrew-publication-exact-occurrence-count-invalid");
    }
    if (exactOccurrenceCount === 0) {
      issues.add("hebrew-publication-exact-occurrence-missing");
    }

    const entityIds = Array.isArray(candidate.mapping?.tipnrEntityIds)
      ? candidate.mapping.tipnrEntityIds
      : [];
    const invalidEntityIds = entityIds.filter(
      (id) => !Number.isSafeInteger(id) || id < 1
    );
    if (invalidEntityIds.length > 0) {
      issues.add("hebrew-publication-tipnr-entity-id-invalid");
    }
    if (entityIds.length === 0) {
      issues.add("hebrew-publication-tipnr-entity-missing");
    } else if (entityIds.length > 1) {
      issues.add("hebrew-publication-tipnr-entity-ambiguous");
    } else if (invalidEntityIds.length === 0) {
      tipnrEntityId = entityIds[0] ?? null;
    }

    const entityReferenceInput = Array.isArray(
      candidate.mapping?.tipnrEntityReferences
    )
      ? candidate.mapping.tipnrEntityReferences
      : [];
    tipnrReferences = normalizeReferences(entityReferenceInput);
    if (tipnrReferences.invalidCount > 0) {
      issues.add("hebrew-publication-tipnr-reference-invalid");
    }
    if (tipnrReferences.values.length === 0) {
      issues.add("hebrew-publication-tipnr-references-missing");
    }
    tipnrReferencesValid =
      tipnrReferences.invalidCount === 0 && tipnrReferences.values.length > 0;
    if (exactOccurrenceReferences.invalidCount > 0) {
      issues.add("hebrew-publication-exact-occurrence-reference-invalid");
    }
    const entityReferenceSet = new Set(tipnrReferences.values);
    exactOccurrenceIntersectsTipnr =
      exactOccurrenceReferences.invalidCount === 0 &&
      exactOccurrenceReferences.values.some((reference) =>
        entityReferenceSet.has(reference)
      );
    if (exactOccurrenceCount > 0 && !exactOccurrenceIntersectsTipnr) {
      issues.add("hebrew-publication-tipnr-occurrence-outside-entity");
    }
    const source = candidate.mapping?.sourceIdentity?.tipnr;
    sourceRecordId = source?.entityId ? String(source.entityId) : null;
    if (!source) {
      issues.add("hebrew-publication-source-identity-missing");
    } else if (!source.entityUnique || source.entityId !== tipnrEntityId) {
      issues.add("hebrew-publication-source-record-not-unique");
    }
    exactSourceIdentity = Boolean(
      exactCandidateIdentity &&
      source?.entityUnique &&
      source.entityId === tipnrEntityId &&
      tipnrReferencesValid &&
      exactOccurrenceIntersectsTipnr
    );
  } else if (candidate.method === "open-scriptures-augmented-exact") {
    lexicalIndexId = exactLexicalIndexId(
      candidate.mapping?.lexicalIndexIds,
      issues
    );
    const augmentedStrong = candidate.mapping?.augmentedStrong;
    if (!augmentedStrong) {
      issues.add("hebrew-publication-augmented-strong-missing");
    } else {
      normalizedAugmentedStrong = normalizeAugmentedStrong(augmentedStrong);
      if (
        !normalizedAugmentedStrong ||
        augmentedStrong !== normalizedAugmentedStrong
      ) {
        issues.add("hebrew-publication-augmented-strong-invalid");
      }
    }
    const expectedAugmentedStrong = normalizeAugmentedStrong(
      candidate.identity?.eStrong ?? ""
    );
    augmentedStrongExact = Boolean(
      normalizedAugmentedStrong &&
      expectedAugmentedStrong &&
      normalizedAugmentedStrong === expectedAugmentedStrong
    );
    if (normalizedAugmentedStrong && !augmentedStrongExact) {
      issues.add("hebrew-publication-augmented-strong-mismatch");
    }
    if (
      !lexicalIndexId ||
      candidate.mapping?.augmentedLexicalIndexId !== lexicalIndexId
    ) {
      issues.add("hebrew-publication-augmented-lexical-index-id-mismatch");
    }
    const source = candidate.mapping?.sourceIdentity?.augmentedLexical;
    sourceRecordId = source?.lexicalIndexId ?? null;
    exactSourceIdentity = proveIndexedSourceIdentity(
      source,
      lexicalIndexId,
      issues
    );
    if (
      source &&
      (source.augmentedStrong !== normalizedAugmentedStrong ||
        source.lexicalIndexId !== candidate.mapping.augmentedLexicalIndexId)
    ) {
      issues.add("hebrew-publication-source-record-mismatch");
      exactSourceIdentity = false;
    }
  } else if (candidate.method === "open-scriptures-lexical-exact") {
    lexicalIndexId = exactLexicalIndexId(
      candidate.mapping?.lexicalIndexIds,
      issues
    );
    const source = candidate.mapping?.sourceIdentity?.classicalLexical;
    sourceRecordId = source?.lexicalIndexId ?? null;
    exactSourceIdentity = proveIndexedSourceIdentity(
      source
        ? {
            lexicalIndexId: source.lexicalIndexId,
            mappingUnique: source.matchCount === 1,
            originalFormExact: source.originalFormExact,
            partOfSpeechExact: source.partOfSpeechExact
          }
        : null,
      lexicalIndexId,
      issues
    );
  } else {
    const source = candidate.mapping?.sourceIdentity?.hebrewStrong;
    sourceRecordId = source?.strongId ?? null;
    if (!source) {
      issues.add("hebrew-publication-source-identity-missing");
    } else {
      if (!source.recordUnique) {
        issues.add("hebrew-publication-source-record-not-unique");
      }
      if (!source.primaryDStrongExact) {
        issues.add("hebrew-publication-source-record-mismatch");
      }
      if (!source.originalFormExact) {
        issues.add("hebrew-publication-source-original-mismatch");
      }
      if (!source.partOfSpeechExact) {
        issues.add("hebrew-publication-source-pos-mismatch");
      }
      const normalizedStrongId = normalizeExactDStrong(source.strongId);
      const normalizedClassicalStrong = normalizeExactDStrong(
        candidate.mapping?.classicalStrong ?? ""
      );
      if (
        !normalizedStrongId ||
        normalizedStrongId !== normalizedClassicalStrong ||
        normalizedStrongId !== normalizedPrimaryDStrong
      ) {
        issues.add("hebrew-publication-source-record-mismatch");
      }
      exactSourceIdentity = Boolean(
        source.recordUnique &&
        source.primaryDStrongExact &&
        source.originalFormExact &&
        source.partOfSpeechExact &&
        normalizedStrongId &&
        normalizedStrongId === normalizedClassicalStrong &&
        normalizedStrongId === normalizedPrimaryDStrong
      );
    }
  }

  const issueCodes = [...issues].sort();
  return {
    proven: issueCodes.length === 0,
    issueCodes,
    method: candidate.method,
    normalizedPrimaryDStrong,
    normalizedCandidateDStrong,
    facts: {
      meaningHasContent,
      meaningValidated,
      candidateValidated,
      exactCandidateIdentity,
      exactOccurrenceCount,
      tipnrEntityId,
      tipnrReferencesValid,
      exactOccurrenceIntersectsTipnr,
      lexicalIndexId,
      augmentedStrong: normalizedAugmentedStrong,
      augmentedStrongExact,
      exactSourceIdentity,
      sourceRecordId
    },
    references: {
      tipnrEntity: tipnrReferences.values,
      exactTahotOccurrences: exactOccurrenceReferences.values
    }
  };
}

/**
 * Independently closes only the two high-confidence gloss cases for which the
 * companion artifact carries exact, source-attested text: an exact TIPNR alias
 * with the same strict EntityRefs/TAHOT gate as a notice, or complete token
 * coverage by the exact HebrewStrong meaning record.
 */
export function proveHebrewEnglishGlossCandidate(input: {
  candidate: HebrewEnglishCandidate;
  primaryDStrong: string;
  tahotOccurrences: readonly TbeshExactDStrongOccurrence[];
}): HebrewEnglishGlossPublicationProof {
  const issues = new Set<HebrewGlossPublicationProofIssue>();
  const { candidate } = input;
  const gloss = candidate.english?.gloss?.trim() ?? "";
  if (!gloss) issues.add("hebrew-gloss-publication-empty");

  const normalizedPrimary = normalizeExactDStrong(input.primaryDStrong);
  const candidatePrimary = extractPrimaryDStrong(
    candidate.identity?.dStrong ?? ""
  );
  const normalizedCandidate = candidatePrimary
    ? normalizeExactDStrong(candidatePrimary)
    : null;
  const sourcePrimary = normalizeExactDStrong(
    candidate.mapping?.sourceIdentity?.primaryDStrong ?? ""
  );
  if (
    !normalizedPrimary ||
    normalizedCandidate !== normalizedPrimary ||
    sourcePrimary !== normalizedPrimary
  ) {
    issues.add("hebrew-gloss-publication-candidate-dstrong-mismatch");
  }

  const assessment = candidate.fieldAssessments?.gloss;
  let method: HebrewEnglishGlossPublicationProof["method"] = "unsupported";
  let sourceRecordId: string | null = null;
  let tipnrReferences: NormalizedReferences = {
    values: [],
    invalidCount: 0
  };
  let occurrenceReferences: NormalizedReferences = {
    values: [],
    invalidCount: 0
  };

  if (
    candidate.method === "tipnr-exact-dstrong" &&
    assessment?.method === "tipnr-exact-alias"
  ) {
    method = "tipnr-exact-alias";
    const entityIds = candidate.mapping?.tipnrEntityIds ?? [];
    const source = candidate.mapping?.sourceIdentity?.tipnr;
    const entityId = entityIds.length === 1 ? entityIds[0]! : null;
    sourceRecordId = entityId ? String(entityId) : null;
    if (!entityId || !source?.entityUnique || source.entityId !== entityId) {
      issues.add("hebrew-gloss-publication-tipnr-entity-unproven");
    }
    const exactAliasEvidence = assessment.evidence.filter(
      (evidence) =>
        evidence.source === "STEPBible-TIPNR" &&
        evidence.matchKind === "exact-alias" &&
        evidence.recordId.endsWith(`:entity:${entityId ?? ""}`) &&
        normalizeExactEnglishText(evidence.matchedText) ===
          normalizeExactEnglishText(gloss)
    );
    if (exactAliasEvidence.length !== 1) {
      issues.add("hebrew-gloss-publication-evidence-missing");
    }

    tipnrReferences = normalizeReferences(
      candidate.mapping?.tipnrEntityReferences ?? []
    );
    if (tipnrReferences.invalidCount > 0) {
      issues.add("hebrew-gloss-publication-tipnr-reference-invalid");
    }
    if (tipnrReferences.values.length === 0) {
      issues.add("hebrew-gloss-publication-tipnr-reference-missing");
    }
    const occurrences = collectExactOccurrences(
      normalizedPrimary,
      input.tahotOccurrences
    );
    occurrenceReferences = occurrences.references;
    if (
      occurrences.invalidDStrongCount > 0 ||
      occurrences.invalidCountCount > 0 ||
      occurrenceReferences.invalidCount > 0
    ) {
      issues.add("hebrew-gloss-publication-tipnr-reference-invalid");
    }
    const entityReferenceSet = new Set(tipnrReferences.values);
    if (
      occurrences.count === 0 ||
      !occurrenceReferences.values.some((reference) =>
        entityReferenceSet.has(reference)
      )
    ) {
      issues.add("hebrew-gloss-publication-tipnr-tahot-intersection-missing");
    }
  } else if (
    assessment?.method === "hebrew-strong-meaning" &&
    assessment.tier === "candidate_high"
  ) {
    method = "hebrew-strong-meaning";
    const source = candidate.mapping?.sourceIdentity?.hebrewStrong;
    sourceRecordId = source?.strongId ?? null;
    if (!source) {
      issues.add("hebrew-gloss-publication-source-identity-missing");
    } else {
      const normalizedStrongId = normalizeExactDStrong(source.strongId);
      const normalizedClassical = normalizeExactDStrong(
        candidate.mapping?.classicalStrong ?? ""
      );
      if (
        !source.recordUnique ||
        !source.primaryDStrongExact ||
        !source.originalFormExact ||
        !source.partOfSpeechExact ||
        normalizedStrongId !== normalizedPrimary ||
        normalizedClassical !== normalizedPrimary
      ) {
        issues.add("hebrew-gloss-publication-source-identity-unproven");
      }
    }
    const strongEvidence = assessment.evidence.filter(
      (evidence) =>
        evidence.source === "OpenScriptures-HebrewStrong" &&
        evidence.recordId === sourceRecordId &&
        evidence.matchKind === "exact-strong-meaning"
    );
    if (strongEvidence.length !== 1) {
      issues.add("hebrew-gloss-publication-evidence-missing");
    } else {
      const glossTokens = normalizedEnglishContentTokens(gloss);
      const sourceTokens = new Set(
        normalizedEnglishContentTokens(strongEvidence[0]!.matchedText)
      );
      if (
        glossTokens.length === 0 ||
        !glossTokens.every((token) => sourceTokens.has(token))
      ) {
        issues.add("hebrew-gloss-publication-source-text-mismatch");
      }
    }
  } else {
    issues.add("hebrew-gloss-publication-method-unsupported");
  }

  const issueCodes = [...issues].sort();
  return {
    proven: issueCodes.length === 0,
    issueCodes,
    method,
    sourceRecordId,
    references: {
      tipnrEntity: tipnrReferences.values,
      exactTahotOccurrences: occurrenceReferences.values
    }
  };
}

/**
 * STEP H9001-H9049 rows are not lexical Strong entries. This gate recognizes
 * only the exact self-anchored technical rows and requires both EN fields and
 * the identifying morphology to be present.
 */
export function proveStepTechnicalMarker(
  input: StepTechnicalMarkerProofInput
): StepTechnicalMarkerProof {
  const issues = new Set<StepTechnicalMarkerProofIssue>();
  const validBaseCode =
    Number.isSafeInteger(input.baseCode) &&
    input.baseCode >= 9001 &&
    input.baseCode <= 9049;
  if (!validBaseCode) {
    issues.add("step-technical-marker-base-code-invalid");
  }
  const expectedCode = validBaseCode ? `H${input.baseCode}` : null;
  const expectedDStrong = expectedCode
    ? normalizeExactDStrong(expectedCode)
    : null;
  const primary = extractPrimaryDStrong(input.dStrong);
  const normalizedDStrong = primary ? normalizeExactDStrong(primary) : null;
  if (
    !expectedDStrong ||
    normalizedDStrong !== expectedDStrong ||
    input.dStrong.trim() !== `${expectedCode} =`
  ) {
    issues.add("step-technical-marker-dstrong-mismatch");
  }
  if (input.eStrong.trim() !== expectedCode) {
    issues.add("step-technical-marker-estrong-mismatch");
  }
  if (input.uStrong.trim() !== expectedCode) {
    issues.add("step-technical-marker-ustrong-mismatch");
  }
  if (!input.original.trim()) {
    issues.add("step-technical-marker-original-empty");
  }
  if (!input.morph.trim()) {
    issues.add("step-technical-marker-morph-empty");
  }
  if (!input.gloss.trim()) {
    issues.add("step-technical-marker-gloss-empty");
  }
  if (!hasVisibleMeaningContent(input.meaningHtml)) {
    issues.add("step-technical-marker-meaning-empty");
  }
  const issueCodes = [...issues].sort();
  return {
    proven: issueCodes.length === 0,
    issueCodes,
    normalizedDStrong,
    expectedDStrong
  };
}

function isSupportedMethod(
  method: HebrewEnglishCandidate["method"]
): method is
  | "tipnr-exact-dstrong"
  | "open-scriptures-augmented-exact"
  | "open-scriptures-lexical-exact"
  | "hebrew-strong-exact" {
  return [
    "tipnr-exact-dstrong",
    "open-scriptures-augmented-exact",
    "open-scriptures-lexical-exact",
    "hebrew-strong-exact"
  ].includes(method);
}

function proveIndexedSourceIdentity(
  source:
    | {
        lexicalIndexId: string;
        mappingUnique: boolean;
        originalFormExact: boolean;
        partOfSpeechExact: boolean;
      }
    | null
    | undefined,
  expectedLexicalIndexId: string | null,
  issues: Set<HebrewPublicationProofIssue>
): boolean {
  if (!source) {
    issues.add("hebrew-publication-source-identity-missing");
    return false;
  }
  if (!source.mappingUnique) {
    issues.add("hebrew-publication-source-index-not-unique");
  }
  if (!source.originalFormExact) {
    issues.add("hebrew-publication-source-original-mismatch");
  }
  if (!source.partOfSpeechExact) {
    issues.add("hebrew-publication-source-pos-mismatch");
  }
  if (
    !expectedLexicalIndexId ||
    source.lexicalIndexId !== expectedLexicalIndexId
  ) {
    issues.add("hebrew-publication-source-index-mismatch");
  }
  return Boolean(
    source.mappingUnique &&
    source.originalFormExact &&
    source.partOfSpeechExact &&
    expectedLexicalIndexId &&
    source.lexicalIndexId === expectedLexicalIndexId
  );
}

function hasVisibleMeaningContent(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const visibleText = value
    .replace(/<!--[\s\S]*?-->/gu, " ")
    .replace(/<[^>]*>/gu, " ")
    .replace(/&(?:#[0-9]+|#x[0-9a-f]+|[a-z][a-z0-9]+);/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return /[\p{L}\p{N}]/u.test(visibleText);
}

function normalizeExactEnglishText(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[’'`]/gu, "")
    .replace(/[^a-z0-9]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function normalizedEnglishContentTokens(value: string): string[] {
  const stopWords = new Set(["a", "an", "be", "of", "the", "to"]);
  const tokens =
    normalizeExactEnglishText(value)
      .match(/[a-z]+/gu)
      ?.map((token) => {
        if (token.length > 4 && token.endsWith("ies")) {
          return `${token.slice(0, -3)}y`;
        }
        if (token.length > 4 && token.endsWith("s") && !token.endsWith("ss")) {
          return token.slice(0, -1);
        }
        return token;
      })
      .filter((token) => token.length >= 2 && !stopWords.has(token)) ?? [];
  return [...new Set(tokens)];
}

function collectExactOccurrences(
  normalizedPrimaryDStrong: string | null,
  occurrences: readonly TbeshExactDStrongOccurrence[]
): {
  count: number;
  invalidDStrongCount: number;
  invalidCountCount: number;
  references: NormalizedReferences;
} {
  let count = 0;
  let invalidDStrongCount = 0;
  let invalidCountCount = 0;
  const references: TbeshReferenceInput[] = [];

  for (const occurrence of occurrences) {
    const normalizedOccurrence = normalizeExactDStrong(occurrence.dStrong);
    if (!normalizedOccurrence) {
      invalidDStrongCount += 1;
      continue;
    }
    if (
      !normalizedPrimaryDStrong ||
      normalizedOccurrence !== normalizedPrimaryDStrong
    ) {
      continue;
    }

    const occurrenceCount = occurrence.count ?? 1;
    if (!Number.isSafeInteger(occurrenceCount) || occurrenceCount < 1) {
      invalidCountCount += 1;
      continue;
    }
    const nextCount = count + occurrenceCount;
    if (!Number.isSafeInteger(nextCount)) {
      invalidCountCount += 1;
      continue;
    }
    count = nextCount;
    references.push(...occurrence.references);
  }

  return {
    count,
    invalidDStrongCount,
    invalidCountCount,
    references: normalizeReferences(references)
  };
}

function exactLexicalIndexId(
  values: readonly string[] | undefined,
  issues: Set<HebrewPublicationProofIssue>
): string | null {
  if (!Array.isArray(values) || values.length === 0) {
    issues.add("hebrew-publication-lexical-index-id-missing");
    return null;
  }
  if (values.length !== 1) {
    issues.add("hebrew-publication-lexical-index-id-ambiguous");
    return null;
  }
  const value = values[0];
  if (typeof value !== "string" || !value.trim() || value !== value.trim()) {
    issues.add("hebrew-publication-lexical-index-id-invalid");
    return null;
  }
  return value;
}

function normalizeAugmentedStrong(value: string): string | null {
  const match = /^H0*(\d{1,5})([a-z])$/u.exec(value.trim());
  if (!match) return null;
  const number = Number.parseInt(match[1] ?? "", 10);
  if (!Number.isSafeInteger(number) || number < 1) return null;
  return `H${number}${match[2]}`;
}

interface NormalizedReferences {
  values: string[];
  invalidCount: number;
}

function normalizeReferences(
  references: readonly TbeshReferenceInput[]
): NormalizedReferences {
  const values = new Set<string>();
  let invalidCount = 0;
  for (const reference of references) {
    const normalized = normalizeStepOrOsisVerseReference(reference);
    if (normalized) values.add(normalized);
    else invalidCount += 1;
  }
  return { values: [...values].sort(), invalidCount };
}
