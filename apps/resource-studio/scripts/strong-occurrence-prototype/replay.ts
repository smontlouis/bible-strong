import {
  applyChoices,
  type Case,
  type Placement,
  type Result
} from "../strong-arbitration-benchmark/core.js";
import {
  carrierKey,
  type BaselineVerse
} from "../strong-alignment-benchmark/shared.js";
import type { SourceUnit, TranslationRelation } from "./model.js";

export type Projection = "guard" | "source-primary";
export const span = (p: Placement) =>
  p.kind === "empty"
    ? `empty:${p.insertAfterWordIndex}`
    : `${p.startWordIndex}:${p.endWordIndex}`;
export function owners(unit: SourceUnit, placements: Placement[]) {
  return placements.filter(
    (p) =>
      p.originalOccurrenceId &&
      unit.occurrenceIds.includes(p.originalOccurrenceId) &&
      p.kind !== "empty"
  );
}

/** Label-free replay. Only archived context choices are inputs; no new scoring. */
export function replay(
  baseline: BaselineVerse,
  cases: Case[],
  results: Map<string, Result>,
  units: SourceUnit[],
  projection: Projection,
  threshold = 0.95
) {
  const eligible = units.filter(
    (u) => u.structure === "single-row-alternatives"
  );
  const groupedOccurrences = new Set(eligible.flatMap((u) => u.occurrenceIds));
  const projectedCases = cases.filter(
    (c) => !groupedOccurrences.has(c.occurrenceId)
  );
  const projectedResults = new Map(results);
  const removed: Placement[] = [];
  const relations: TranslationRelation[] = [];
  const events: Array<{
    unitId: string;
    kind: string;
    caseIds: string[];
    placementIds: string[];
  }> = [];
  for (const unit of eligible) {
    const related = cases.filter((c) =>
      unit.occurrenceIds.includes(c.occurrenceId)
    );
    let existing = owners(unit, baseline.placements);
    const event = (kind: string) =>
      events.push({
        unitId: unit.id,
        kind,
        caseIds: related.map((c) => c.id),
        placementIds: existing.map((p) => p.id)
      });
    const primary = unit.taggings[0].codes[0];
    if (existing.length > 1) {
      if (
        projection === "source-primary" &&
        new Set(existing.map(span)).size === 1
      ) {
        const keep = [...existing].sort(
          (a, b) =>
            Number(b.strong === primary) - Number(a.strong === primary) ||
            a.id.localeCompare(b.id)
        )[0];
        removed.push(...existing.filter((p) => p.id !== keep.id));
        event("deduplicated-existing");
        existing = [keep];
      } else {
        event("ambiguous-existing-carriers");
        continue;
      }
    }
    const votes = related.flatMap((c) => {
      const r = results.get(`${c.id}:context`);
      const choice = c.enriched.find((o) => o.key === r?.choice);
      if (
        r?.status !== "ok" ||
        !Number.isFinite(r.probability) ||
        r.probability! < threshold ||
        !choice
      )
        return [];
      return [{ c, r, choice }];
    });
    const visibleVotes = votes.filter((v) => v.choice.placement);
    if (!visibleVotes.length) continue;
    // No confidence pooling: each contributing archived vote passed the fixed threshold.
    if (
      visibleVotes.length !== votes.length ||
      new Set(visibleVotes.map((v) => span({ ...v.choice.placement!, id: "" })))
        .size !== 1
    ) {
      event("conflicting-votes");
      continue;
    }
    const vote = [...visibleVotes].sort(
      (a, b) =>
        Number(b.c.strong === primary) - Number(a.c.strong === primary) ||
        a.c.id.localeCompare(b.c.id)
    )[0];
    const chosen = vote.choice.placement!;
    relations.push({
      sourceUnitIds: [unit.id],
      targetWordIndices: Array.from(
        { length: chosen.endWordIndex! - chosen.startWordIndex! + 1 },
        (_, i) => chosen.startWordIndex! + i
      ),
      status: "proposed",
      evidenceIds: visibleVotes.map((v) => v.r.id)
    });
    if (!existing.length && projection === "guard") {
      event("identity-deferred");
      continue;
    }
    const strong = existing[0]?.strong ?? primary;
    const previous =
      existing[0] ??
      baseline.placements.find(
        (p) =>
          p.strong === strong &&
          p.originalOccurrenceId &&
          unit.occurrenceIds.includes(p.originalOccurrenceId)
      );
    const occurrenceId = unit.members.find(
      (m) => m.strong === strong
    )?.occurrenceId;
    if (!occurrenceId)
      throw new Error(`unmapped-projection:${unit.id}:${strong}`);
    const placement = { ...chosen, strong };
    if (previous && carrierKey(previous) === carrierKey(placement)) {
      event("existing-relation-reused");
      continue;
    }
    const c: Case = {
      ...vote.c,
      id: `physical:${vote.c.gold}:${unit.id}`,
      strong,
      occurrenceId,
      annotationId: previous?.id ?? `physical:${unit.id}:${strong}`,
      baseline: previous,
      lexical: [
        {
          key: vote.choice.key,
          description: vote.choice.description,
          placement
        }
      ],
      enriched: [
        {
          key: vote.choice.key,
          description: vote.choice.description,
          placement
        }
      ]
    };
    projectedCases.push(c);
    projectedResults.set(`${c.id}:context`, {
      ...vote.r,
      id: `${c.id}:context`
    });
    event(existing.length ? "existing-owner-reused" : "projected-primary");
    if (visibleVotes.length > 1) event("agreement-merged");
  }
  const removedIds = new Set(removed.map((p) => p.id));
  const out = applyChoices(
    {
      ...baseline,
      placements: baseline.placements.filter((p) => !removedIds.has(p.id))
    },
    projectedCases,
    projectedResults,
    "context",
    threshold
  );
  return { ...out, removed, relations, events };
}
