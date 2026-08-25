export type LexiconLanguage = "greek" | "hebrew";

/** Raw STEP entry fields required by the v3 pipeline. */
export interface LexiconV3SourceEntry {
  stepEntryId?: number;
  language: LexiconLanguage;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
}

/** A secondary lexicon witness already linked to the STEP entry. */
export interface LexiconV3ResourceWitness {
  resourceId?: number;
  source: string;
  kind: string;
  contentHtml: string;
}

export interface LexiconV3EntryIdentity {
  entryKey: string;
  language: LexiconLanguage;
  primaryDStrong: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
}

export type LexiconHeadwordMatch =
  | "exact"
  | "orthographic_variant"
  | "morphological_variant"
  | "explicit_relation"
  | "mismatch"
  | "unavailable";

export interface LexiconHeadwordComparison {
  candidate: string | null;
  originals: string[];
  match: LexiconHeadwordMatch;
  /** Compatibility-friendly tri-state projection of match. */
  matches: boolean | null;
  matchedOriginal: string | null;
  /** Human-readable, deterministic reason suitable for review packets. */
  reason: string;
}

export type LexiconSourceAuditFindingCode =
  | "missing-gloss"
  | "missing-meaning"
  | "meaning-headword-mismatch"
  | "meaning-headword-derived"
  | "meaning-headword-variant"
  | "resource-headword-mismatch"
  | "resource-corroborates-entry"
  | "gloss-supported-by-resource-only"
  | "no-coherent-resource";

export interface LexiconSourceAuditFinding {
  code: LexiconSourceAuditFindingCode;
  severity: "info" | "warning" | "error";
  message: string;
  evidence?: Record<string, unknown>;
}

export interface LexiconResourceAudit {
  resource: LexiconV3ResourceWitness;
  headword: LexiconHeadwordComparison;
  supportsGloss: boolean;
}

export interface LexiconGlossSupportAudit {
  contentTerms: string[];
  meaningSupportsGloss: boolean;
  supportingResources: string[];
}

export interface LexiconSourceSelection {
  strategy: "step_primary" | "resource_repair_candidate" | "manual_review";
  source: "STEP" | string | null;
  kind: string | null;
  /** A repair candidate is never automatically publishable. */
  automatic: boolean;
  reason: string;
}

export interface LexiconV3SourceAuditResult {
  identity: LexiconV3EntryIdentity;
  status: "source_ok" | "source_issue" | "invalid_source";
  requiresReview: boolean;
  meaningHeadword: LexiconHeadwordComparison;
  glossSupport: LexiconGlossSupportAudit;
  resources: LexiconResourceAudit[];
  findings: LexiconSourceAuditFinding[];
  selection: LexiconSourceSelection;
}
