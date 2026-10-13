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
        /**
         * Where the word probably belongs, among its placed neighbours:
         * `shown` when one of the verse's words already carries it.
         */
        estimate?: {
          basis:
            | "shown"
            | "witnesses"
            | "editorial"
            | "next-source-word"
            | "previous-source-word"
            | "no-placed-neighbor";
          /** The target word the estimate leans on. */
          word?: string;
        };
      }>;
    };
