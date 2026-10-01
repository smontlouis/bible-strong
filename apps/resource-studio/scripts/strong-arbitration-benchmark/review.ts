/** Structural checks only: a valid review is not a claim of semantic correctness. */
export interface SemanticReview {
  status: "unreviewed" | "in-progress" | "complete";
  reviewer: string | null;
  sourcesConsulted: string[];
  groups: Array<{
    id: string;
    sourceOccurrenceIds: string[];
    targetWordIndices: number[];
    certainty: "sure" | "possible";
    relation: "lexical" | "grammatical" | "idiomatic";
    carrierOptions: Array<{ occurrenceId: string; tokenIndices: number[] }>;
    rationale: string;
  }>;
  absent: Array<{ occurrenceId: string; rationale: string }>;
  uncertain: Array<{ occurrenceId: string; rationale: string }>;
  problems: Array<{
    kind: "source-edition" | "text-contamination" | "tokenization" | "other";
    detail: string;
  }>;
}
export function validateReview(
  sourceIds: string[],
  wordCount: number,
  review: SemanticReview
): void {
  function require(ok: unknown, message: string): asserts ok {
    if (!ok) throw new Error(message);
  }
  const ids = new Set(sourceIds),
    groups = new Set<string>(),
    linked = new Set<string>();
  require(ids.size === sourceIds.length, "duplicate-source-id");
  require(["unreviewed", "in-progress", "complete"].includes(
    review.status
  ), "invalid-status");
  const validTokens = (values: number[]) =>
    values.length > 0 &&
    new Set(values).size === values.length &&
    values.every((i) => Number.isInteger(i) && i >= 0 && i < wordCount);
  for (const group of review.groups) {
    require(group.id && !groups.has(group.id), "duplicate-or-empty-group-id");
    groups.add(group.id);
    require(group.sourceOccurrenceIds.length > 0 &&
      new Set(group.sourceOccurrenceIds).size ===
        group.sourceOccurrenceIds.length &&
      group.sourceOccurrenceIds.every((id) =>
        ids.has(id)
      ), "unknown-or-duplicate-group-source");
    require(validTokens(group.targetWordIndices), "invalid-group-tokens");
    require(["sure", "possible"].includes(group.certainty) &&
      ["lexical", "grammatical", "idiomatic"].includes(
        group.relation
      ), "invalid-group-class");
    require(group.rationale.trim(), "missing-rationale");
    group.sourceOccurrenceIds.forEach((id) => linked.add(id));
    for (const carrier of group.carrierOptions)
      require(group.sourceOccurrenceIds.includes(carrier.occurrenceId) &&
        validTokens(carrier.tokenIndices) &&
        carrier.tokenIndices.every((i) =>
          group.targetWordIndices.includes(i)
        ), "carrier-outside-group");
  }
  const dispositions = new Set<string>();
  for (const entry of [...review.absent, ...review.uncertain]) {
    require(ids.has(entry.occurrenceId), "unknown-disposition-source");
    require(!linked.has(entry.occurrenceId) &&
      !dispositions.has(entry.occurrenceId), "contradictory-disposition");
    require(entry.rationale.trim(), "missing-rationale");
    dispositions.add(entry.occurrenceId);
  }
  for (const problem of review.problems)
    require([
      "source-edition",
      "text-contamination",
      "tokenization",
      "other"
    ].includes(problem.kind) && problem.detail.trim(), "invalid-problem");
  if (review.status === "unreviewed")
    require(!review.groups.length &&
      !review.absent.length &&
      !review.uncertain.length, "unreviewed-has-annotations");
  if (review.status === "complete") {
    require(review.reviewer?.trim(), "missing-reviewer");
    require([...ids].every(
      (id) => linked.has(id) || dispositions.has(id)
    ), "incomplete-source-coverage");
  }
}
