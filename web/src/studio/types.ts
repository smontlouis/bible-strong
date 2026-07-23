export type ViewId = "viewer" | "jsonl" | "workflow" | "lexicon" | "review";
export type ReaderMode = "normal" | "advanced" | "debug";

export type JsonlBibleId =
  | "OST"
  | "FMAR"
  | "NVS78P"
  | "NEG79"
  | "NBS"
  | "DBY"
  | "DBYR"
  | "LSG";

export interface JsonlBibleVerse {
  ref: string;
  version: string;
  book: number;
  bookId: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface JsonlBibleCatalogVersion {
  id: JsonlBibleId;
  label: string;
  shortLabel: string;
  sourceVersion: string;
  available: boolean;
  path: string;
  sizeBytes: number;
  sha256?: string;
  verseCount: number;
  taggedTokenCount?: number;
  enrichedTagCount?: number;
  books: Array<{ bookId: string; chapters: number[]; verseCount: number }>;
}

export interface JsonlBibleCatalog {
  generatedAt: string;
  versions: JsonlBibleCatalogVersion[];
  books: Array<{ bookId: string; chapters: number[] }>;
}

export interface JsonlBibleChapter {
  bookId: string;
  chapter: number;
  versions: Array<{
    id: JsonlBibleId;
    label: string;
    shortLabel: string;
    sourceVersion: string;
    verses: JsonlBibleVerse[];
  }>;
}

export interface StrongLedger {
  bible: string;
  generatedAt: string;
  scope: string;
  apiBacked?: boolean;
  books?: StrongBookOutline[];
  split?: boolean;
  verseFiles?: Array<{ bookId: string; path: string; verses: number }>;
  metrics: StrongLedgerMetrics;
  verses: StrongVerse[];
}

export interface StrongBookOutline {
  bookId: string;
  chapters: number[];
  verseCount: number;
  metrics: StrongBookMetrics;
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
  referenceSupport?: string[];
  profile?: string;
  originalOccurrenceId?: string;
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

export type StrongReviewBucket =
  | "actionable"
  | "needs-witness-review"
  | "accepted-safe"
  | "drifted"
  | "planned"
  | "quarantined";

export interface StrongReviewSummary {
  generatedAt: string;
  bible: string;
  production: {
    eligible: number;
    consensusFiltered: number;
  };
  quarantine: {
    total: number;
    legacySingleModel: number;
    unverifiedSemanticRefill: number;
  };
  drift: {
    invalidProduction: number;
    invalidTotal: number;
  };
  decisions: {
    total: number;
    uniqueCandidates: number;
    acceptedSafe: number;
    needsWitnessReview: number;
    rejectedRisky: number;
  };
  plan: {
    available: boolean;
    tasks: number;
    items: number;
    models: string[];
    adaptiveSecondModel: boolean;
    generatedAt?: string;
  };
}

export interface StrongReviewPriority {
  tier: "p0" | "p1" | "p2" | "p3";
  score: number;
  reasons: string[];
}

export interface StrongReviewDashboardItem {
  id: string;
  kind: string;
  ref: string;
  strong: string[];
  status: string;
  productionState: string;
  target?:
    | string
    | {
        type?: string;
        label?: string;
        wordIndex?: number;
        startWordIndex?: number;
        endWordIndex?: number;
        normalized?: string;
      };
  source?: string;
  reason: string;
  confidence?: number;
  model?: string;
  models?: string[];
  stage?: string;
  exactWitnessFamilies?: string[];
  directDeterministicSupport?: boolean;
  evidence?: string[];
  priority: StrongReviewPriority;
  taskId?: string;
}

export interface StrongReviewItemsPage {
  generatedAt: string;
  bible: string;
  bucket: StrongReviewBucket;
  total: number;
  limit: number;
  offset: number;
  items: StrongReviewDashboardItem[];
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

export interface LexiconMetadata {
  database: string;
  legacyDatabase: string | null;
  releaseKey: string | null;
  profile: string;
  generatedAt: string | null;
  entries: number;
  translationsFr: number;
  legacyEntries: number;
  resourcesIncluded: boolean;
  resourceEntries: number;
  relationEntries: number;
  morphologyTranslations: number;
  occurrenceDatabase: string | null;
  occurrenceCount: number;
  tipnrDatabase: string | null;
  tipnrEntities: number;
  tipnrPlaces: number;
}

export interface TipnrEntityContext {
  id: number;
  uniqueName: string;
  uStrong: string;
  category: string;
  type: string;
  displayNameEn: string;
  displayNameFr: string;
  descriptionEn: string;
  descriptionFr: string;
  summaryHtmlEn: string;
  summaryHtmlFr: string;
  briefestEn: string;
  briefestFr: string;
  briefEn: string;
  briefFr: string;
  shortDescriptionEn: string;
  shortDescriptionFr: string;
  articleHtmlEn: string;
  articleHtmlFr: string;
  openBibleName: string | null;
  googleMapUrl: string | null;
  palopenmapsUrl: string | null;
  latitude: number | null;
  longitude: number | null;
  area: string | null;
  referenceCount: number;
  relationCount: number;
  references: Array<{
    book: string;
    chapter: number;
    verse: number;
    suffix: string;
    refText: string;
  }>;
  relations: Array<{
    relation: string;
    certainty: string;
    toEntityId: number | null;
    toUniqueName: string;
    uStrong: string | null;
    displayNameEn: string | null;
    displayNameFr: string | null;
    category: string | null;
  }>;
  matchKind: "uStrong-exact" | "classical-strong-fallback";
  matchedStrong: string;
}

export interface LexiconRelation {
  id: number;
  toStepEntryId: number | null;
  toStepCode: string;
  groupKind: "identity" | "subentry" | "family";
  relationKind: string;
  labelEn: string;
  labelFr: string;
  source: string;
  language: string | null;
  eStrong: string | null;
  uStrong: string | null;
  original: string | null;
  transliteration: string | null;
  glossEn: string | null;
  glossFr: string | null;
}

export interface LexiconMorphology {
  code: string;
  normalizedCode: string;
  language: string;
  scope: string;
  meaningEn: string;
  descriptionEn: string;
  meaningFr: string | null;
  descriptionFr: string | null;
}

export interface LexiconOccurrenceStats {
  identityKind: "step" | "classical";
  strongCode: string;
  totalCount: number;
  oldTestamentCount: number;
  newTestamentCount: number;
  verseCount: number;
  morphologyCount: number;
  surfaceCount: number;
  firstRef: string;
}

export interface LexiconOccurrences {
  scope: "step" | "classical-fallback";
  exactStats: LexiconOccurrenceStats | null;
  classicalStats: LexiconOccurrenceStats | null;
  samples: Array<{
    ref: string;
    source: "TAHOT" | "TAGNT";
    surface: string;
    transliteration: string;
    gloss: string;
    morphology: string;
    editions: string;
    stepCode: string;
    baseStrong: string;
  }>;
  forms: Array<{
    code: string;
    count: number;
    exampleSurface: string;
    meaningEn?: string;
    descriptionEn?: string;
    meaningFr?: string | null;
    descriptionFr?: string | null;
  }>;
}

export interface LexiconEntryPayload {
  entry: LexiconRow;
  identity: {
    stepCode: string;
    rawDStrong: string;
    relationKind: string | null;
    relatedStepCode: string | null;
    relationLabelEn: string | null;
    relationLabelFr: string | null;
  } | null;
  legacy: {
    strong: string;
    scope: "classical-strong";
    code: number;
    word: string;
    phonetic: string;
    original: string;
    originHtml: string;
    type: string;
    lsg: string;
    definitionHtml: string;
  } | null;
  resources: Array<{
    source: string;
    kind: string;
    contentHtml: string;
    contentHtmlFr: string;
    contentTextFr: string;
  }>;
  tipnrEntities: TipnrEntityContext[];
  relations: LexiconRelation[];
  morphology: LexiconMorphology[];
  occurrences: LexiconOccurrences | null;
}
