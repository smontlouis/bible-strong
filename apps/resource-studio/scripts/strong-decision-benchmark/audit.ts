/** Read-only, gold-informed diagnostics. Oracle results are NOT model results. */
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { scoreCarrierAwareVerse } from "../../src/evaluateStrongGold.js";
import { applyChoices, expectedChoice } from "./report.js";
import {
  hash,
  placementKey,
  requestFor,
  type BenchmarkVerse,
  type Dataset
} from "./prepare.js";

const root = path.resolve(process.argv[2]);
const datasets: Dataset[] = await Promise.all(
  ["Sg1910", "Darby", "DarbyR"].map(async (gold) =>
    JSON.parse(await readFile(path.join(root, gold, "dataset.json"), "utf8"))
  )
);
type Result =
  Parameters<typeof applyChoices>[2] extends Map<string, infer R> ? R : never;
async function resultsFor(provider: string) {
  const text = await readFile(
    path.join(root, "results", `${provider}-base.jsonl`),
    "utf8"
  );
  const rows: Result[] = text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length);
  return new Map(rows.map((r) => [r.id, r]));
}
const jev = await resultsFor("jev");
const laya = await resultsFor("laya");
const allCases = datasets.flatMap((d) => d.cases);
for (const c of allCases) {
  for (const results of [jev, laya]) {
    assert.equal(
      results.get(c.id)?.requestSha256,
      hash(JSON.stringify(requestFor(c)))
    );
  }
}
const cases = allCases.filter(
  (c) =>
    c.split === "test" &&
    jev.get(c.id)?.status === "ok" &&
    laya.get(c.id)?.status === "ok"
);
const verses = datasets
  .flatMap((d) => d.verses)
  .filter((v) => v.split === "test");
const labeled = cases.filter((c) => expectedChoice(c) !== undefined);
const visibleLabeled = labeled.filter((c) => c.expected[0].kind !== "empty");
const oracle = new Map(
  cases.map((c) => [
    c.id,
    {
      id: c.id,
      status: "ok",
      choice: expectedChoice(c) ?? "UNSURE",
      probability: 1
    }
  ])
);

function aggregate(predictions: Map<string, BenchmarkVerse["baseline"]>) {
  const metrics = {
    exact: { tp: 0, fp: 0, fn: 0 },
    overlap: { tp: 0, fp: 0, fn: 0 }
  };
  for (const v of verses) {
    const visible = v.expected.filter((p) => p.kind !== "empty");
    const predicted = predictions
      .get(`${v.gold}:${v.ref}`)!
      .filter((p) => p.kind !== "empty");
    const score = scoreCarrierAwareVerse(v.ref, predicted, visible);
    for (const [key, value] of [
      ["exact", score.carrierExact],
      ["overlap", score.carrierOverlap]
    ] as const) {
      metrics[key].tp += value.truePositive;
      metrics[key].fp += value.falsePositive;
      metrics[key].fn += value.falseNegative;
    }
  }
  return Object.fromEntries(
    Object.entries(metrics).map(([key, m]) => [
      key,
      {
        ...m,
        precision: m.tp / (m.tp + m.fp),
        recall: m.tp / (m.tp + m.fn),
        f1: (2 * m.tp) / (2 * m.tp + m.fp + m.fn)
      }
    ])
  );
}

const baseline = new Map(verses.map((v) => [`${v.gold}:${v.ref}`, v.baseline]));
const oraclePredictions = new Map<string, BenchmarkVerse["baseline"]>();
const oracleCounts = {
  applied: 0,
  retained: 0,
  abstained: 0,
  blocked: 0,
  removed: 0
};
const blockedOracle: Array<{
  id: string;
  gold: string;
  ref: string;
  strong: string;
  expected: unknown;
  conflicts: unknown;
}> = [];
let goldVisible = 0,
  goldPhrases = 0,
  goldOverlappingOccurrences = 0;
let baselineFalsePositives = 0,
  falsePositivesWithSelectedReviewCase = 0;
const goldOverlapExamples: unknown[] = [];
for (const v of verses) {
  const verseCases = cases.filter((c) => c.gold === v.gold && c.ref === v.ref);
  let predicted = [...v.baseline];
  for (const c of [...verseCases].sort((a, b) => a.id.localeCompare(b.id))) {
    const result = applyChoices({ ...v, baseline: predicted }, [c], oracle, 0);
    if (result.counts.blocked) {
      const target = c.choices.find(
        (o) => o.key === oracle.get(c.id)?.choice
      )!.placement!;
      blockedOracle.push({
        id: c.id,
        gold: c.gold,
        ref: c.ref,
        strong: c.strong,
        expected: target,
        conflicts: predicted
          .filter(
            (p) =>
              p.id !== c.annotationId &&
              p.kind !== "empty" &&
              p.startWordIndex! <= target.endWordIndex! &&
              target.startWordIndex! <= p.endWordIndex!
          )
          .map((p) => ({
            ...p,
            matchesReference: v.expected.some(
              (e) => placementKey(e) === placementKey(p)
            )
          }))
      });
    }
    predicted = result.predicted;
    for (const key of Object.keys(oracleCounts) as Array<
      keyof typeof oracleCounts
    >)
      oracleCounts[key] += result.counts[key];
  }
  assert.deepEqual(predicted, applyChoices(v, verseCases, oracle, 0).predicted);
  oraclePredictions.set(`${v.gold}:${v.ref}`, predicted);
  const expected = v.expected.filter((p) => p.kind !== "empty");
  goldVisible += expected.length;
  goldPhrases += expected.filter((p) => p.kind === "phrase").length;
  const overlapping = expected.filter((p, i) =>
    expected.some(
      (q, j) =>
        i !== j &&
        p.startWordIndex! <= q.endWordIndex! &&
        q.startWordIndex! <= p.endWordIndex!
    )
  );
  goldOverlappingOccurrences += overlapping.length;
  if (overlapping.length && goldOverlapExamples.length < 10)
    goldOverlapExamples.push({
      gold: v.gold,
      ref: v.ref,
      placements: overlapping
    });
  const remaining = new Map<string, number>();
  for (const p of expected)
    remaining.set(placementKey(p), (remaining.get(placementKey(p)) ?? 0) + 1);
  for (const p of v.baseline.filter((p) => p.kind !== "empty")) {
    const key = placementKey(p);
    if ((remaining.get(key) ?? 0) > 0)
      remaining.set(key, remaining.get(key)! - 1);
    else {
      baselineFalsePositives++;
      if (verseCases.some((c) => c.annotationId === p.id))
        falsePositivesWithSelectedReviewCase++;
    }
  }
}
const result = {
  disclaimer:
    "Post-hoc diagnosis of pilot-v1, not a new held-out test. Gold-informed oracle restricted to unique labeled residual cases and existing choices; not a theoretical ceiling or deployable policy. Same legacy dictionary fixture as pilot.",
  scope: {
    verses: verses.length,
    biblicalRefs: new Set(verses.map((v) => v.ref)).size,
    cases: cases.length,
    labeled: labeled.length
  },
  candidateCoverage: {
    visibleLabeled: visibleLabeled.length,
    offered: visibleLabeled.filter((c) => expectedChoice(c) !== "UNSURE")
      .length,
    absent: visibleLabeled.filter((c) => expectedChoice(c) === "UNSURE").length
  },
  gold: {
    visible: goldVisible,
    phrases: goldPhrases,
    overlappingOccurrences: goldOverlappingOccurrences,
    examples: goldOverlapExamples
  },
  baseline: aggregate(baseline),
  reviewScope: {
    baselineFalsePositives,
    falsePositivesWithSelectedReviewCase,
    note: "Selected/capped residual cases only; outside review does not imply the full candidate pool cannot target these errors."
  },
  oracleExistingChoices: {
    metrics: aggregate(oraclePredictions),
    edits: oracleCounts,
    blocked: blockedOracle
  },
  calibrationIllustration: {
    zeroErrors30OneSided95LowerPrecision: Math.pow(0.05, 1 / 30),
    zeroErrorsNeededFor98PercentOneSided95: Math.ceil(
      Math.log(0.05) / Math.log(0.98)
    ),
    assumptions:
      "Fixed policy; independent Bernoulli decisions; NOT applicable directly to correlated editions/chapters or a threshold selected on this sample."
  }
};
assert.equal(baselineFalsePositives, result.baseline.exact.fp);
await writeFile(
  path.join(root, "system-audit.json"),
  JSON.stringify(result, null, 2) + "\n"
);
console.log(
  JSON.stringify(
    {
      ...result,
      gold: { ...result.gold, examples: undefined },
      oracleExistingChoices: {
        ...result.oracleExistingChoices,
        blocked: blockedOracle.length
      }
    },
    null,
    2
  )
);
