export type ViewId = "viewer" | "workflow" | "lexicon" | "review";
export type ReaderMode = "normal" | "advanced" | "debug";

export interface StrongLedger {
  bible: string;
  generatedAt: string;
  scope: string;
  split?: boolean;
  verseFiles?: Array<{ bookId: string; path: string; verses: number }>;
  metrics: StrongLedgerMetrics;
  verses: StrongVerse[];
}

export interface StrongLedgerMetrics {
  verseCount: number;
  wordCount: number;
  referenceStrongOccurrenceCount: number;
  referenceStrongCarrierCount: number;
  originalStrongOccurrenceCount: number;
  originalStrongCarrierCount: number;
  emptyStrongCount: number;
  placementRiskCount: number;
  readerVisibleStrongCount: number;
  advancedStrongCount: number;
  referenceStrongCarrierCoverage: number;
  originalStrongCarrierRate: number;
  placementQuality: number;
  books?: Record<string, StrongBookMetrics>;
}

export interface StrongBookMetrics extends StrongLedgerMetrics {
  bookId: string;
}

export interface StrongVerse {
  ref: string;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
  tokens: Array<{ wordIndex: number; text: string; normalized: string }>;
  annotations: StrongAnnotation[];
  views: {
    readerHtml: string;
    advancedHtml: string;
    debugHtml: string;
  };
  metrics: StrongLedgerMetrics;
}

export interface LexicalCandidateReport {
  bible: string;
  generatedAt: string;
  inputPath: string;
  scope: string;
  items: LexicalAuditItem[];
}

export interface LexicalAuditItem {
  annotationId: string;
  auditKind: "empty" | "relocation" | string;
  ref: string;
  text: string;
  strong: string;
  sourceStrong?: string;
  insertAfterWordIndex?: number;
  currentTarget?: {
    wordIndex: number;
    text: string;
  };
  groupAutoSafe?: {
    assignedWordIndex: number;
    assignedText: string;
  };
  candidates: LexicalCandidate[];
}

export interface LexicalCandidate {
  target: "word" | "phrase" | string;
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  text: string;
  normalized: string;
  lemma?: string;
  score: number;
  confidence: "high" | "medium" | "low" | string;
  occupied?: boolean;
  evidence: Array<{
    source: string;
    detail?: string;
  }>;
}

export interface StrongAnnotation {
  id: string;
  strong: string;
  visibility: "reader" | "advanced" | "hidden" | "pending" | "rejected";
  placement: string;
  source: string;
  confidence: number;
  reason: string;
  diagnostics?: string[];
  wordIndex?: number;
  startWordIndex?: number;
  endWordIndex?: number;
  insertAfterWordIndex?: number;
  normalizedWord?: string;
  normalizedPhrase?: string;
  originalGloss?: string;
  sourceStrong?: string;
  step?: Array<{
    source: string;
    classicalStrong: string;
    dStrong: string;
    tokenIndex: number;
    type: string;
    surface: string;
    transliteration: string;
    gloss: string;
    morphology: string;
  }>;
}

export interface ReviewFile {
  bible: string;
  generatedAt: string;
  diagnosticsPath: string;
  decisionsPath: string;
  items: ReviewItem[];
}

export interface ReviewItem {
  id?: string;
  ref: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  strong: string;
  llmDecision?: string;
  decision?: "pending" | "accept" | "reject" | "review";
  targetWordIndex?: number;
  targetNormalized?: string;
  targetText?: string;
  llmReason?: string;
  reviewerNote?: string;
  text?: string;
  verseText?: string;
  context?: string;
  candidates?: unknown[];
  reviewSource?: string;
  [key: string]: unknown;
}

export interface LexiconRow {
  id: number;
  language: string;
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  classicTransliteration: string;
  pronunciation: string;
  morph: string;
  glossEn: string;
  meaningEn: string;
  glossFr: string;
  meaningSimpleFr: string;
  meaningHtmlFr: string;
}

export interface LexiconEntryPayload {
  entry: LexiconRow;
  resources: Array<{
    source: string;
    kind: string;
    contentHtml: string;
    contentHtmlFr: string;
    contentTextFr: string;
  }>;
}
