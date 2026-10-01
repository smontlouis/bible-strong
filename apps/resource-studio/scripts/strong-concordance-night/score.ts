import assert from "node:assert/strict";
import {
  carrierKey,
  indices,
  type GoldVerse,
  type Placement,
  type Prediction
} from "./contract.js";

export function matching(
  left: Placement[],
  right: Placement[],
  compatible: (a: Placement, b: Placement) => boolean
) {
  const owner = new Map<number, number>();
  function visit(i: number, seen: Set<number>): boolean {
    for (let j = 0; j < right.length; j++) {
      if (seen.has(j) || !compatible(left[i], right[j])) continue;
      seen.add(j);
      if (!owner.has(j) || visit(owner.get(j)!, seen)) {
        owner.set(j, i);
        return true;
      }
    }
    return false;
  }
  left.forEach((_, i) => visit(i, new Set()));
  return [...owner].map(([gold, predicted]) => ({ gold, predicted }));
}
export function metric(predicted: number, expected: number, tp: number) {
  return {
    predicted,
    expected,
    tp,
    fp: predicted - tp,
    fn: expected - tp,
    precision: predicted ? tp / predicted : 0,
    recall: expected ? tp / expected : 0,
    f1: predicted + expected ? (2 * tp) / (predicted + expected) : 0
  };
}
const sameStrong = (a: Placement, b: Placement) => a.strong === b.strong;
const exact = (a: Placement, b: Placement) => carrierKey(a) === carrierKey(b);
const visible = (a: Placement) => a.kind !== "empty";
const overlap = (a: Placement, b: Placement) =>
  sameStrong(a, b) &&
  (visible(a) && visible(b)
    ? indices(a).some((i) => indices(b).includes(i))
    : exact(a, b));
const visibility = (a: Placement, b: Placement) =>
  sameStrong(a, b) && visible(a) === visible(b);

export function scoreVerse(prediction: Prediction, gold: GoldVerse) {
  assert.equal(prediction.ref, gold.ref);
  assert.equal(
    prediction.text.replace(/\s+/gu, " ").trim(),
    gold.text,
    `text-mismatch:${gold.ref}`
  );
  const p = prediction.placements,
    e = gold.placements;
  const metrics = Object.fromEntries(
    Object.entries({ exact, overlap, inventory: sameStrong, visibility }).map(
      ([name, rule]) => [
        name,
        metric(p.length, e.length, matching(p, e, rule).length)
      ]
    )
  );
  for (const [label, test] of [
    ["visibleExact", visible],
    ["emptyAnchor", (a: Placement) => !visible(a)]
  ] as const) {
    const a = p.filter(test),
      b = e.filter(test);
    metrics[label] = metric(a.length, b.length, matching(a, b, exact).length);
  }
  const pe = p.filter((x) => !visible(x)),
    ee = e.filter((x) => !visible(x));
  metrics.emptyClassification = metric(
    pe.length,
    ee.length,
    matching(pe, ee, sameStrong).length
  );
  const byStrong = (xs: Placement[]) =>
    xs.reduce(
      (m, a) => m.set(a.strong, (m.get(a.strong) ?? 0) + 1),
      new Map<string, number>()
    );
  const pm = byStrong(p),
    em = byStrong(e);
  const cardinalityError = [...new Set([...pm.keys(), ...em.keys()])].reduce(
    (n, s) => n + Math.abs((pm.get(s) ?? 0) - (em.get(s) ?? 0)),
    0
  );
  // data-pa ordinals and STEP token numbers are not assumed interchangeable.
  // Score source identity only for verses whose entire tagged reference sequence
  // agrees with the STEP numbers AND Strong identities without collisions.
  const unitAt = new Map<number, Prediction["units"]>();
  for (const u of prediction.units) {
    const n = Number(u.sourceUnitId.match(/\.(\d+)\.[^.]+$/u)?.[1]);
    if (n) unitAt.set(n, [...(unitAt.get(n) ?? []), u]);
  }
  const identityComparable =
    e.length > 0 &&
    e.every((g) => {
      const candidates = unitAt.get(Number(g.id.split("/")[0])) ?? [];
      return (
        candidates.length === 1 &&
        candidates[0].strong.length === 1 &&
        candidates[0].occurrenceIds.length === 1 &&
        candidates[0].strong.includes(g.strong) &&
        !candidates[0].source.readingUnresolved
      );
    });
  const identityGold = identityComparable
    ? e.map((g) => ({
        ...g,
        originalOccurrenceId: unitAt.get(Number(g.id.split("/")[0]))![0]
          .occurrenceIds[0]
      }))
    : [];
  const identityPredicted = identityComparable
    ? p.filter((a) => a.originalOccurrenceId)
    : [];
  metrics.identityExact = metric(
    identityPredicted.length,
    identityGold.length,
    matching(
      identityPredicted,
      identityGold,
      (a, b) => a.originalOccurrenceId === b.originalOccurrenceId && exact(a, b)
    ).length
  );
  const pairs = matching(p, e, exact);
  const pg = new Set(pairs.map((x) => x.predicted)),
    eg = new Set(pairs.map((x) => x.gold));
  return {
    ref: gold.ref,
    metrics,
    cardinalityError,
    exactCardinality: cardinalityError === 0,
    units: prediction.units.length,
    unresolved: prediction.units.filter((u) => u.state === "unresolved").length,
    establishedEmpty: prediction.units.filter((u) => u.state === "empty")
      .length,
    fullyAccounted:
      prediction.units.length > 0 &&
      prediction.units.every((u) => u.state !== "unresolved") &&
      !prediction.issues.length &&
      !prediction.unownedAnnotationIds.length,
    identityComparable,
    unowned: prediction.placements.filter((p) => !p.originalOccurrenceId)
      .length,
    difficulties: [
      ...(e.some((p) => (em.get(p.strong) ?? 0) > 1) ? ["repetitions"] : []),
      ...(e.some((p) => indices(p).length > 1) ? ["expressions"] : []),
      ...(e.some((p) => !visible(p)) ? ["vides"] : []),
      ...(prediction.units.some((u) => u.source.readingUnresolved)
        ? ["variantes-source"]
        : []),
      ...(e.some(
        (p) =>
          indices(p).length &&
          indices(p).length !== p.endWordIndex! - p.startWordIndex! + 1
      )
        ? ["relations-discontinues"]
        : [])
    ],
    unmatchedPredicted: p.filter((_, i) => !pg.has(i)),
    unmatchedExpected: e.filter((_, i) => !eg.has(i))
  };
}

export function aggregate(rows: ReturnType<typeof scoreVerse>[]) {
  const metrics: Record<string, ReturnType<typeof metric>> = {};
  for (const r of rows)
    for (const [key, m] of Object.entries(r.metrics)) {
      const old = metrics[key] ?? metric(0, 0, 0);
      metrics[key] = metric(
        old.predicted + m.predicted,
        old.expected + m.expected,
        old.tp + m.tp
      );
    }
  const units = rows.reduce((n, r) => n + r.units, 0);
  const unresolved = rows.reduce((n, r) => n + r.unresolved, 0);
  return {
    verses: rows.length,
    metrics,
    units,
    unresolved,
    uncertaintyRate: units ? unresolved / units : 1,
    establishedEmpty: rows.reduce((n, r) => n + r.establishedEmpty, 0),
    unownedPredictions: rows.reduce((n, r) => n + r.unowned, 0),
    fullyAccountedVerses: rows.filter((r) => r.fullyAccounted).length,
    identityComparableVerses: rows.filter((r) => r.identityComparable).length,
    cardinalityError: rows.reduce((n, r) => n + r.cardinalityError, 0),
    exactCardinalityVerses: rows.filter((r) => r.exactCardinality).length
  };
}
