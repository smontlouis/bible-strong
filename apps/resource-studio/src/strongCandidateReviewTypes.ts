/** Preview-only status. Missing review data never means zero uncertainty. */
export type CandidateReviewReason =
  "predicate" | "reading" | "correspondence" | "group" | "alignment";
export type CandidateVerseReview =
  | { available: false }
  | {
      available: true;
      sourceUnits: number;
      visible: number;
      establishedEmpty: number;
      unresolved: number;
      issues: number;
      items: Array<{
        sourceUnitId: string;
        strong: string[];
        source: string;
        reason: CandidateReviewReason;
      }>;
    };
