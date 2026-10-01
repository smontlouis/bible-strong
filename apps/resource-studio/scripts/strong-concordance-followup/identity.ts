/** Evaluator-only identity metric. Eligibility depends on immutable source/gold
 * ordinal pairs, never the candidate's reading flags or successful placements. */
import { sourceConjoinHead } from "../../src/strongConcordanceFollowup.js";
import type { SourceRow } from "../../src/strongSourceUnits.js";
import {
  carrierKey,
  type GoldVerse,
  type Prediction,
  type Placement
} from "../strong-concordance-night/contract.js";
import { matching, metric } from "../strong-concordance-night/score.js";

export function scoreConjoinIdentity(
  raw: Prediction,
  prediction: Prediction,
  gold: GoldVerse,
  rows: ReadonlyMap<string, SourceRow>
) {
  const expected: Placement[] = [];
  for (const unit of raw.units) {
    const row = rows.get(unit.sourceUnitId);
    if (
      !row ||
      unit.source.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.occurrenceIds.length !== 1 ||
      !/^T-/u.test(unit.source.morphology)
    )
      continue;
    const link = sourceConjoinHead(row);
    if (!link) continue;
    const at = (index: number) =>
      raw.units.filter((u) => {
        const r = rows.get(u.sourceUnitId);
        return r?.reference === row.reference && r.tokenIndex === index;
      });
    if (at(row.tokenIndex).length !== 1) continue;
    const heads = at(link.index);
    if (heads.length !== 1) continue;
    const head = heads[0];
    if (
      head.source.readingUnresolved ||
      head.strong.length !== 1 ||
      head.occurrenceIds.length !== 1 ||
      head.strong[0] !== link.strong
    )
      continue;
    if (
      raw.units.filter((u) => u.strong.includes(link.strong)).length !== 1 ||
      gold.placements.filter((p) => p.strong === link.strong).length !== 1
    )
      continue;
    // The unique lexical head is a second ordinal/code landmark. A bare match
    // on a frequent article code is not enough to assume CTB and STEP numbering.
    if (!gold.placements.some((p) => p.id === `${link.index}/${link.strong}`))
      continue;
    const target = gold.placements.find(
      (p) => p.id === `${row.tokenIndex}/${unit.strong[0]}`
    );
    if (target)
      expected.push({ ...target, originalOccurrenceId: unit.occurrenceIds[0] });
  }
  const owners = new Set(expected.map((p) => p.originalOccurrenceId));
  const predicted = prediction.placements.filter(
    (p) => p.originalOccurrenceId && owners.has(p.originalOccurrenceId)
  );
  const matched = matching(
    predicted,
    expected,
    (a, b) =>
      a.originalOccurrenceId === b.originalOccurrenceId &&
      carrierKey(a) === carrierKey(b)
  );
  return {
    metric: metric(predicted.length, expected.length, matched.length),
    comparableSourceOwners: [...owners],
    matchedCarriers: matched.map((pair) => predicted[pair.predicted])
  };
}
