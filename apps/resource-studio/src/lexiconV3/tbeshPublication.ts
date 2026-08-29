import type {
  HebrewEnglishCandidateMethod,
  HebrewEnglishCandidateStatus
} from "./hebrewEnglish.js";
import {
  hasMeaningfulTbeshHtml,
  parseTbeshMeaning,
  type TbeshMeaningSections
} from "./tbeshMeaning.js";
import type { TbeshSectionLedgerCategory } from "./tbeshSectionLedger.js";

export type TbeshPublicationAction =
  | "raw_combined"
  | "step_specific_only"
  | "legacy_general_only"
  | "exact_companion"
  | "editorial_reconstruction"
  | "blocked";

export type TbeshPublicationContentSource =
  | "tbesh_raw"
  | "tbesh_step_specific"
  | "tbesh_legacy_general"
  | "hebrew_english_exact_companion"
  | "lexicon_v3_hebrew_adjudication";

export type TbeshPublicationLedgerCategory =
  | TbeshSectionLedgerCategory
  | "unreviewed"
  | null;

export type TbeshExactCompanionMethod = Extract<
  HebrewEnglishCandidateMethod,
  | "tipnr-exact-dstrong"
  | "open-scriptures-augmented-exact"
  | "open-scriptures-lexical-exact"
  | "hebrew-strong-exact"
>;

export interface TbeshExactCompanionProof {
  status: HebrewEnglishCandidateStatus;
  method: HebrewEnglishCandidateMethod;
  meaningHtml: string;
  /** Must be established by the caller; method names never imply proof. */
  exactCompanionProven?: boolean;
  /** Required in addition to explicit proof for a TIPNR identity. */
  exactTipnrTahotReferenceIntersection?: boolean;
}

export interface DecideTbeshPublicationInput {
  sections: TbeshMeaningSections;
  properName: boolean;
  ledgerCategory: TbeshPublicationLedgerCategory;
  rawAssessmentStatus?: HebrewEnglishCandidateStatus;
  /**
   * A separately sealed proof that the complete TBESH value is semantically
   * appropriate for this exact dStrong. A mere source-priority decision or a
   * lexical token mismatch is not such a proof.
   */
  canonicalRawProof?:
    | "direct_semantic_support"
    | "sealed_semantic_adjudication";
  /** A sealed fail-closed decision from the canonical policy. */
  canonicalBlockProof?: "fail_closed";
  /**
   * Exact content selected by the separately sealed canonical policy. The
   * selector verifies that source-backed sections and companions are copied
   * byte-for-byte; only an editorial reconstruction may introduce new HTML.
   */
  canonicalSelection?: {
    action: Exclude<TbeshPublicationAction, "raw_combined" | "blocked">;
    html: string;
    proof: "sealed_semantic_adjudication";
  };
  /** Caller-owned proof that the text before `§` belongs to this exact dStrong. */
  stepSpecificScopeProven?: boolean;
  companion?: TbeshExactCompanionProof | null;
}

export type TbeshPublicationReasonCode =
  | "tbesh-publish-both-sections"
  | "tbesh-publish-specific-section"
  | "tbesh-publish-verified-legacy-context"
  | "tbesh-publish-foreign-sibling-specific-section"
  | "tbesh-replace-source-conflict-with-exact-companion"
  | "tbesh-replace-proper-legacy-with-exact-companion"
  | "tbesh-replace-proper-unsectioned-with-exact-companion"
  | "tbesh-replace-foreign-sibling-with-exact-companion"
  | "tbesh-replace-unvalidated-raw-with-exact-companion"
  | "tbesh-replace-unvalidated-unsectioned-with-exact-companion"
  | "tbesh-publish-unsectioned-raw"
  | "tbesh-publish-canonical-raw-direct-semantic-support"
  | "tbesh-publish-canonical-raw-sealed-semantic-adjudication"
  | "tbesh-publish-proper-exact-specific-section"
  | "tbesh-publish-canonical-step-specific-sealed-adjudication"
  | "tbesh-publish-canonical-legacy-general-sealed-adjudication"
  | "tbesh-publish-canonical-exact-companion-sealed-adjudication"
  | "tbesh-publish-canonical-editorial-reconstruction-sealed-adjudication"
  | "tbesh-block-canonical-policy"
  | "tbesh-block-canonical-selection-empty"
  | "tbesh-block-canonical-selection-source-mismatch"
  | "tbesh-block-proper-unsectioned-without-exact-companion"
  | "tbesh-block-unvalidated-unsectioned-without-exact-companion"
  | "tbesh-block-empty-sectioned-meaning"
  | "tbesh-block-not-sectioned"
  | "tbesh-block-multiple-section-separators"
  | "tbesh-block-inconsistent-sections"
  | "tbesh-block-unreviewed-lexical-section"
  | "tbesh-block-empty-tail-ledger-inconsistent"
  | "tbesh-block-source-conflict-without-exact-companion"
  | "tbesh-block-proper-legacy-without-exact-companion"
  | "tbesh-block-foreign-sibling-without-publishable-content"
  | "tbesh-step-specific-scope-not-proven"
  | "tbesh-exact-companion-missing"
  | "tbesh-exact-companion-not-explicitly-proven"
  | "tbesh-exact-companion-status-not-validated"
  | "tbesh-exact-companion-method-not-allowed"
  | "tbesh-exact-companion-html-empty"
  | "tbesh-exact-tipnr-tahot-intersection-missing";

export interface TbeshPublicationContent {
  html: string;
  source: TbeshPublicationContentSource;
}

export interface TbeshQuarantinedPart {
  part: "raw_combined" | "legacy_general";
  html: string;
  reasonCode: TbeshPublicationReasonCode;
}

export interface TbeshPublicationDecision {
  action: TbeshPublicationAction;
  content: TbeshPublicationContent | null;
  /** Always preserves the original TBESH value, even when it is replaced. */
  rawProvenanceHtml: string;
  quarantinedParts: TbeshQuarantinedPart[];
  reasonCodes: TbeshPublicationReasonCode[];
}

const EXACT_COMPANION_METHODS = new Set<HebrewEnglishCandidateMethod>([
  "tipnr-exact-dstrong",
  "open-scriptures-augmented-exact",
  "open-scriptures-lexical-exact",
  "hebrew-strong-exact"
]);

/**
 * Selects publication content for an already parsed TBESH meaning. Unsectioned
 * raw content is retained when validated; otherwise an explicitly proven exact
 * companion may replace it. The selector never infers proof from a method
 * label. Anything outside the enumerated safe cases is quarantined.
 */
export function decideTbeshPublication(
  input: DecideTbeshPublicationInput
): TbeshPublicationDecision {
  if (input.canonicalBlockProof) {
    return blocked(input.sections, ["tbesh-block-canonical-policy"]);
  }
  if (input.canonicalSelection) {
    return canonicalSelection(input);
  }
  if (!input.sections.hasSectionSeparator) {
    if (input.canonicalRawProof) {
      return canonicalRaw(input.sections, input.canonicalRawProof);
    }
    if (input.properName) {
      return exactCompanionOrBlocked(
        input,
        "tbesh-replace-proper-unsectioned-with-exact-companion",
        "tbesh-block-proper-unsectioned-without-exact-companion"
      );
    }
    if (
      input.rawAssessmentStatus &&
      input.rawAssessmentStatus !== "validated"
    ) {
      return exactCompanionOrBlocked(
        input,
        "tbesh-replace-unvalidated-unsectioned-with-exact-companion",
        "tbesh-block-unvalidated-unsectioned-without-exact-companion"
      );
    }
    return raw(input.sections, "tbesh-publish-unsectioned-raw");
  }
  const structuralIssue = structuralBlockReason(input.sections);
  if (structuralIssue) return blocked(input.sections, [structuralIssue]);

  if (input.sections.classification === "empty") {
    return blocked(input.sections, ["tbesh-block-empty-sectioned-meaning"]);
  }

  if (!input.properName) {
    if (input.ledgerCategory === "source_conflict") {
      return exactCompanionOrBlocked(
        input,
        "tbesh-replace-source-conflict-with-exact-companion",
        "tbesh-block-source-conflict-without-exact-companion"
      );
    }
    if (input.ledgerCategory === "foreign_sibling") {
      if (
        hasMeaningfulTbeshHtml(input.sections.stepSpecificHtml) &&
        input.stepSpecificScopeProven === true
      ) {
        return specific(
          input.sections,
          "tbesh-publish-foreign-sibling-specific-section"
        );
      }
      return exactCompanionOrBlocked(
        input,
        "tbesh-replace-foreign-sibling-with-exact-companion",
        "tbesh-block-foreign-sibling-without-publishable-content"
      );
    }
    if (
      input.ledgerCategory === "unreviewed" ||
      input.ledgerCategory === null
    ) {
      return blocked(input.sections, [
        "tbesh-block-unreviewed-lexical-section"
      ]);
    }
    if (
      input.ledgerCategory === "empty_tail" &&
      input.sections.classification !== "specific_only"
    ) {
      return blocked(input.sections, [
        "tbesh-block-empty-tail-ledger-inconsistent"
      ]);
    }
  }

  // Conflict ledgers above deliberately take precedence. Outside a proven
  // conflict, a sealed semantic proof restores the complete STEP/TBESH value,
  // including the `§` delimiter and both explicitly scoped sections.
  if (input.canonicalRawProof) {
    return canonicalRaw(input.sections, input.canonicalRawProof);
  }

  // Proper-name notices often carry a STEP-specific entity section followed
  // by family context. Only the exactly scoped specific section is automatic;
  // the combined raw notice is never inferred safe merely from its shape.
  if (input.properName) {
    if (
      hasMeaningfulTbeshHtml(input.sections.stepSpecificHtml) &&
      input.stepSpecificScopeProven === true
    ) {
      return specific(
        input.sections,
        "tbesh-publish-proper-exact-specific-section"
      );
    }
    return exactCompanionOrBlocked(
      input,
      "tbesh-replace-proper-legacy-with-exact-companion",
      "tbesh-block-proper-legacy-without-exact-companion"
    );
  }

  if (input.sections.classification === "specific_only") {
    if (input.stepSpecificScopeProven !== true) {
      return blocked(input.sections, ["tbesh-step-specific-scope-not-proven"]);
    }
    return specific(input.sections, "tbesh-publish-specific-section");
  }

  if (input.sections.classification === "legacy_only") {
    return raw(input.sections, "tbesh-publish-verified-legacy-context");
  }

  if (
    input.rawAssessmentStatus &&
    input.rawAssessmentStatus !== "validated" &&
    exactCompanionProofIssues(input.companion).length === 0
  ) {
    return exactCompanion(
      input,
      "tbesh-replace-unvalidated-raw-with-exact-companion"
    );
  }

  return raw(input.sections, "tbesh-publish-both-sections");
}

function canonicalSelection(
  input: DecideTbeshPublicationInput
): TbeshPublicationDecision {
  const selection = input.canonicalSelection!;
  if (!hasMeaningfulTbeshHtml(selection.html)) {
    return blocked(input.sections, ["tbesh-block-canonical-selection-empty"]);
  }
  const expectedHtml =
    selection.action === "step_specific_only"
      ? input.sections.stepSpecificHtml
      : selection.action === "legacy_general_only"
        ? input.sections.legacyGeneralHtml
        : selection.action === "exact_companion"
          ? input.companion?.meaningHtml
          : selection.html;
  if (selection.html !== expectedHtml) {
    return blocked(input.sections, [
      "tbesh-block-canonical-selection-source-mismatch"
    ]);
  }

  const reasonCode: TbeshPublicationReasonCode =
    selection.action === "step_specific_only"
      ? "tbesh-publish-canonical-step-specific-sealed-adjudication"
      : selection.action === "legacy_general_only"
        ? "tbesh-publish-canonical-legacy-general-sealed-adjudication"
        : selection.action === "exact_companion"
          ? "tbesh-publish-canonical-exact-companion-sealed-adjudication"
          : "tbesh-publish-canonical-editorial-reconstruction-sealed-adjudication";
  const source: TbeshPublicationContentSource =
    selection.action === "step_specific_only"
      ? "tbesh_step_specific"
      : selection.action === "legacy_general_only"
        ? "tbesh_legacy_general"
        : selection.action === "exact_companion"
          ? "hebrew_english_exact_companion"
          : "lexicon_v3_hebrew_adjudication";
  const retainedRawPart =
    selection.action === "step_specific_only" &&
    hasMeaningfulTbeshHtml(input.sections.legacyGeneralHtml)
      ? {
          part: "legacy_general" as const,
          html: input.sections.legacyGeneralHtml,
          reasonCode
        }
      : {
          part: "raw_combined" as const,
          html: input.sections.rawHtml,
          reasonCode
        };
  return {
    action: selection.action,
    content: { html: selection.html, source },
    rawProvenanceHtml: input.sections.rawHtml,
    quarantinedParts: [retainedRawPart],
    reasonCodes: [reasonCode]
  };
}

function canonicalRaw(
  sections: TbeshMeaningSections,
  proof: NonNullable<DecideTbeshPublicationInput["canonicalRawProof"]>
): TbeshPublicationDecision {
  return raw(
    sections,
    proof === "direct_semantic_support"
      ? "tbesh-publish-canonical-raw-direct-semantic-support"
      : "tbesh-publish-canonical-raw-sealed-semantic-adjudication"
  );
}

function structuralBlockReason(
  sections: TbeshMeaningSections
): TbeshPublicationReasonCode | null {
  if (sections.sectionSeparatorCount !== 1) {
    return "tbesh-block-multiple-section-separators";
  }
  const parsed = parseTbeshMeaning(sections.rawHtml);
  if (
    parsed.stepSpecificHtml !== sections.stepSpecificHtml ||
    parsed.legacyGeneralHtml !== sections.legacyGeneralHtml ||
    parsed.classification !== sections.classification ||
    parsed.hasSectionSeparator !== sections.hasSectionSeparator ||
    parsed.sectionSeparatorCount !== sections.sectionSeparatorCount
  ) {
    return "tbesh-block-inconsistent-sections";
  }
  return null;
}

function exactCompanionOrBlocked(
  input: DecideTbeshPublicationInput,
  successReason: TbeshPublicationReasonCode,
  blockReason: TbeshPublicationReasonCode
): TbeshPublicationDecision {
  const proofIssues = exactCompanionProofIssues(input.companion);
  if (proofIssues.length > 0) {
    return blocked(input.sections, [blockReason, ...proofIssues]);
  }
  return exactCompanion(input, successReason);
}

function exactCompanion(
  input: DecideTbeshPublicationInput,
  successReason: TbeshPublicationReasonCode
): TbeshPublicationDecision {
  return {
    action: "exact_companion",
    content: {
      html: input.companion!.meaningHtml,
      source: "hebrew_english_exact_companion"
    },
    rawProvenanceHtml: input.sections.rawHtml,
    quarantinedParts: [
      {
        part: "raw_combined",
        html: input.sections.rawHtml,
        reasonCode: successReason
      }
    ],
    reasonCodes: [successReason]
  };
}

function exactCompanionProofIssues(
  companion: TbeshExactCompanionProof | null | undefined
): TbeshPublicationReasonCode[] {
  if (!companion) return ["tbesh-exact-companion-missing"];
  const issues: TbeshPublicationReasonCode[] = [];
  if (companion.exactCompanionProven !== true) {
    issues.push("tbesh-exact-companion-not-explicitly-proven");
  }
  if (companion.status !== "validated") {
    issues.push("tbesh-exact-companion-status-not-validated");
  }
  if (!EXACT_COMPANION_METHODS.has(companion.method)) {
    issues.push("tbesh-exact-companion-method-not-allowed");
  }
  if (!hasMeaningfulTbeshHtml(companion.meaningHtml)) {
    issues.push("tbesh-exact-companion-html-empty");
  }
  if (
    companion.method === "tipnr-exact-dstrong" &&
    companion.exactTipnrTahotReferenceIntersection !== true
  ) {
    issues.push("tbesh-exact-tipnr-tahot-intersection-missing");
  }
  return issues;
}

function raw(
  sections: TbeshMeaningSections,
  reasonCode: TbeshPublicationReasonCode
): TbeshPublicationDecision {
  return {
    action: "raw_combined",
    content: { html: sections.rawHtml, source: "tbesh_raw" },
    rawProvenanceHtml: sections.rawHtml,
    quarantinedParts: [],
    reasonCodes: [reasonCode]
  };
}

function specific(
  sections: TbeshMeaningSections,
  reasonCode: TbeshPublicationReasonCode
): TbeshPublicationDecision {
  const quarantinedParts: TbeshQuarantinedPart[] = hasMeaningfulTbeshHtml(
    sections.legacyGeneralHtml
  )
    ? [
        {
          part: "legacy_general",
          html: sections.legacyGeneralHtml,
          reasonCode
        }
      ]
    : [];
  return {
    action: "step_specific_only",
    content: {
      html: sections.stepSpecificHtml,
      source: "tbesh_step_specific"
    },
    rawProvenanceHtml: sections.rawHtml,
    quarantinedParts,
    reasonCodes: [reasonCode]
  };
}

function blocked(
  sections: TbeshMeaningSections,
  reasonCodes: TbeshPublicationReasonCode[]
): TbeshPublicationDecision {
  return {
    action: "blocked",
    content: null,
    rawProvenanceHtml: sections.rawHtml,
    quarantinedParts: [
      {
        part: "raw_combined",
        html: sections.rawHtml,
        reasonCode: reasonCodes[0]!
      }
    ],
    reasonCodes
  };
}
