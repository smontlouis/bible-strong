import type { LexiconV3FrenchPacket } from "./frenchPackets.js";
import { validateFrenchPacket } from "./frenchPackets.js";
import {
  attestEnglishSemanticTerminalPunctuation,
  type EnglishSemanticPunctuationEvidence
} from "./englishSemanticPunctuation.js";
import {
  type LexiconGlossGateStatus,
  lintLexiconGloss
} from "./lexiconGlossQuality.js";

export const FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION =
  "lexicon-v3-french-pretranslation-audit@2" as const;
export const FRENCH_PRETRANSLATION_POLICY_VERSION =
  "lexicon-v3-french-pretranslation-policy@2" as const;

export type FrenchPretranslationGateStatus =
  | "ready"
  | "review_needed"
  | "source_issue";

export interface FrenchPretranslationIssue {
  code: string;
  status: Exclude<FrenchPretranslationGateStatus, "ready">;
  field:
    | "packet"
    | "english.status"
    | "english.gloss"
    | "english.meaning"
    | "identity";
  message: string;
}

export interface FrenchPretranslationStepFamilyMember {
  entryKey: string;
  stepEntryId: number;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  englishGloss: string;
  englishHash: string;
  occurrenceGlossCount: number;
  occurrenceSources: string[];
}

export interface FrenchPretranslationSourceRepairContext {
  contentPreserved: true;
  familyKey: string;
  familyMembers: FrenchPretranslationStepFamilyMember[];
  currentOccurrenceAttestation: "present-in-packet" | "not-attested-in-packet";
  requiredProofs: [
    "exact-step-family",
    "exact-original-occurrence-attestation",
    "canonical-parent-sense",
    "authorized-english-repair-source"
  ];
}

export interface FrenchPretranslationAuditContext {
  familyMembers?: readonly FrenchPretranslationStepFamilyMember[];
}

export interface FrenchPretranslationAuditRecord {
  schemaVersion: typeof FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION;
  policyVersion: typeof FRENCH_PRETRANSLATION_POLICY_VERSION;
  entryKey: string;
  packetHash: string;
  englishHash: string;
  englishStatus: LexiconV3FrenchPacket["english"]["status"];
  gateStatus: FrenchPretranslationGateStatus;
  translationAllowed: boolean;
  autoPublicationAllowed: boolean;
  exactStepIdentity: {
    eStrong: string;
    dStrong: string;
    uStrong: string;
    isSubStep: boolean;
  };
  englishGlossPunctuationAttestation: EnglishSemanticPunctuationEvidence | null;
  issues: FrenchPretranslationIssue[];
  sourceRepairContext: FrenchPretranslationSourceRepairContext | null;
}

/**
 * Audits the exact packet which would be translated. No source field is
 * changed: the derived gate status is an additional, auditable decision.
 */
export function auditFrenchPretranslationPacket(
  packet: LexiconV3FrenchPacket,
  context: FrenchPretranslationAuditContext = {}
): FrenchPretranslationAuditRecord {
  const issues: FrenchPretranslationIssue[] = [];
  const isSubStep = isExactSubStep(packet);
  const englishGlossPunctuationAttestation =
    attestEnglishSemanticTerminalPunctuation({
      language: packet.identity.language,
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      original: packet.identity.original,
      transliteration: packet.identity.transliteration,
      morph: packet.identity.morph,
      gloss: packet.english.gloss,
      meaning: packet.english.meaningHtml
    });

  for (const code of validateFrenchPacket(packet)) {
    issues.push({
      code: `invalid-packet:${code}`,
      status: "source_issue",
      field: "packet",
      message: "The French translation packet is structurally invalid."
    });
  }

  if (packet.english.status === "source_issue") {
    issues.push({
      code: "english-status-source-issue",
      status: "source_issue",
      field: "english.status",
      message: "The authoritative English entry already has a source issue."
    });
  } else if (packet.english.status === "review_needed") {
    issues.push({
      code: "english-status-review-needed",
      status: "review_needed",
      field: "english.status",
      message: "The authoritative English entry still requires review."
    });
  }

  for (const code of packet.english.issues) {
    issues.push({
      code: `english-declared-issue:${code}`,
      status:
        packet.english.status === "source_issue"
          ? "source_issue"
          : "review_needed",
      field: "english.status",
      message: "The English source carries an unresolved declared issue."
    });
  }

  const glossIssues = lintLexiconGloss({
    language: "en",
    gloss: packet.english.gloss,
    morph: packet.identity.morph,
    ...(englishGlossPunctuationAttestation
      ? {
          semanticTerminalPunctuation:
            englishGlossPunctuationAttestation.punctuation
        }
      : {})
  });
  for (const issue of glossIssues) {
    issues.push({
      ...issue,
      field: "english.gloss"
    });
  }

  for (const issue of lintEnglishMeaning(packet.english.meaning)) {
    issues.push(issue);
  }

  const relation = exactStepRelation(packet.identity.dStrong);
  if (
    /^(?:a\s+)?form\s+of$/iu.test(relation) &&
    (!packet.identity.uStrong.trim() ||
      packet.identity.uStrong.trim() === packet.identity.eStrong.trim())
  ) {
    issues.push({
      code: "step-form-relation-target-missing",
      status: "source_issue",
      field: "identity",
      message:
        "The exact STEP form relation has no distinct unified target identity."
    });
  }

  if (
    isSubStep &&
    issues.some(
      (issue) =>
        issue.field === "english.gloss" && issue.status === "source_issue"
    )
  ) {
    issues.push({
      code: "step-subentry-english-gloss-incomplete",
      status: "source_issue",
      field: "identity",
      message:
        "The English gloss attached to this exact STEP/sub-STEP identity is incomplete."
    });
  }

  const uniqueIssues = uniquePretranslationIssues(issues);
  const gateStatus = highestGateStatus(
    uniqueIssues.map((issue) => issue.status)
  );
  const familyMembers = normalizeFamilyMembers([
    ...(context.familyMembers ?? []),
    frenchPretranslationStepFamilyMember(packet)
  ]);
  return {
    schemaVersion: FRENCH_PRETRANSLATION_AUDIT_SCHEMA_VERSION,
    policyVersion: FRENCH_PRETRANSLATION_POLICY_VERSION,
    entryKey: packet.entryKey,
    packetHash: packet.packetHash,
    englishHash: packet.english.contentHash,
    englishStatus: packet.english.status,
    gateStatus,
    translationAllowed: gateStatus !== "source_issue",
    autoPublicationAllowed: gateStatus === "ready",
    exactStepIdentity: {
      eStrong: packet.identity.eStrong,
      dStrong: packet.identity.dStrong,
      uStrong: packet.identity.uStrong,
      isSubStep
    },
    englishGlossPunctuationAttestation,
    issues: uniqueIssues,
    sourceRepairContext:
      gateStatus === "source_issue"
        ? {
            contentPreserved: true,
            familyKey: frenchPretranslationFamilyKey(packet),
            familyMembers,
            currentOccurrenceAttestation:
              packet.evidence.occurrenceGlosses.length > 0
                ? "present-in-packet"
                : "not-attested-in-packet",
            requiredProofs: [
              "exact-step-family",
              "exact-original-occurrence-attestation",
              "canonical-parent-sense",
              "authorized-english-repair-source"
            ]
          }
        : null
  };
}

export function frenchPretranslationFamilyKey(
  packet: LexiconV3FrenchPacket
): string {
  return packet.identity.uStrong.trim() || packet.identity.eStrong.trim();
}

export function frenchPretranslationStepFamilyMember(
  packet: LexiconV3FrenchPacket
): FrenchPretranslationStepFamilyMember {
  return {
    entryKey: packet.entryKey,
    stepEntryId: packet.identity.stepEntryId,
    eStrong: packet.identity.eStrong,
    dStrong: packet.identity.dStrong,
    uStrong: packet.identity.uStrong,
    original: packet.identity.original,
    transliteration: packet.identity.transliteration,
    morph: packet.identity.morph,
    englishGloss: packet.english.gloss,
    englishHash: packet.english.contentHash,
    occurrenceGlossCount: packet.evidence.occurrenceGlosses.reduce(
      (total, occurrence) => total + occurrence.count,
      0
    ),
    occurrenceSources: [
      ...new Set(
        packet.evidence.occurrenceGlosses.map((occurrence) => occurrence.source)
      )
    ].sort()
  };
}

export function buildFrenchPretranslationFamilyIndex(
  packets: Iterable<LexiconV3FrenchPacket>
): Map<string, FrenchPretranslationStepFamilyMember[]> {
  const index = new Map<string, FrenchPretranslationStepFamilyMember[]>();
  for (const packet of packets) {
    const key = frenchPretranslationFamilyKey(packet);
    const members = index.get(key) ?? [];
    members.push(frenchPretranslationStepFamilyMember(packet));
    index.set(key, members);
  }
  for (const [key, members] of index) {
    index.set(key, normalizeFamilyMembers(members));
  }
  return index;
}

export function assertFrenchPacketTranslatable(
  packet: LexiconV3FrenchPacket
): FrenchPretranslationAuditRecord {
  const audit = auditFrenchPretranslationPacket(packet);
  if (!audit.translationAllowed) {
    throw new Error(
      `french-pretranslation-source-issue:${packet.entryKey}:${audit.issues
        .filter((issue) => issue.status === "source_issue")
        .map((issue) => issue.code)
        .join(",")}`
    );
  }
  return audit;
}

function lintEnglishMeaning(value: string): FrenchPretranslationIssue[] {
  const meaning = value.normalize("NFKC").trim();
  if (!meaning) {
    return [
      {
        code: "english-meaning-empty",
        status: "source_issue",
        field: "english.meaning",
        message: "The English notice is empty."
      }
    ];
  }
  if (/\/\s*$/u.test(meaning)) {
    return [
      {
        code: "english-meaning-trailing-slash",
        status: "source_issue",
        field: "english.meaning",
        message: "The English notice ends with an unfinished slash alternative."
      }
    ];
  }
  if (/[([{«“]\s*$/u.test(meaning) || /\b(?:and|or)\s*$/iu.test(meaning)) {
    return [
      {
        code: "english-meaning-obvious-fragment",
        status: "source_issue",
        field: "english.meaning",
        message: "The English notice is manifestly unfinished."
      }
    ];
  }
  return [];
}

function isExactSubStep(packet: LexiconV3FrenchPacket): boolean {
  const dStrongCode = /^\s*([GH]\d{4,5}[A-Za-z]*)/u.exec(
    packet.identity.dStrong
  )?.[1];
  return Boolean(
    (dStrongCode && dStrongCode !== packet.identity.eStrong) ||
    exactStepRelation(packet.identity.dStrong)
  );
}

function exactStepRelation(dStrong: string): string {
  return dStrong.split("=", 2)[1]?.trim() ?? "";
}

function highestGateStatus(
  statuses: readonly LexiconGlossGateStatus[]
): FrenchPretranslationGateStatus {
  if (statuses.includes("source_issue")) return "source_issue";
  if (statuses.includes("review_needed")) return "review_needed";
  return "ready";
}

function uniquePretranslationIssues(
  issues: readonly FrenchPretranslationIssue[]
): FrenchPretranslationIssue[] {
  const byKey = new Map<string, FrenchPretranslationIssue>();
  for (const issue of issues) {
    byKey.set(`${issue.field}:${issue.code}`, issue);
  }
  return [...byKey.values()].sort((left, right) =>
    `${left.field}:${left.code}`.localeCompare(`${right.field}:${right.code}`)
  );
}

function normalizeFamilyMembers(
  members: readonly FrenchPretranslationStepFamilyMember[]
): FrenchPretranslationStepFamilyMember[] {
  const byEntry = new Map<string, FrenchPretranslationStepFamilyMember>();
  for (const member of members) byEntry.set(member.entryKey, member);
  return [...byEntry.values()].sort(
    (left, right) =>
      left.stepEntryId - right.stepEntryId ||
      left.entryKey.localeCompare(right.entryKey)
  );
}
