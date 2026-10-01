/** Evaluate archived predictions; labels are first consumed here, never in run.py. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import {
  scoreCarrierAwareVerse,
  extractGoldCarrierPlacements,
  type CarrierPlacement
} from "../../src/evaluateStrongGold.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import {
  applyHybrid,
  POLICIES,
  project,
  type Links,
  type Policy
} from "./engine.js";
import {
  candidateSpan,
  carrierKey,
  GOLDS,
  sha,
  spanKey,
  type BaselineVerse,
  type EvalVerse
} from "./shared.js";

const root = path.resolve(process.argv[2]);
const plan = JSON.parse(await readFile(path.join(root, "plan.json"), "utf8"));
const policyText = await readFile(
  new URL("./policy.json", import.meta.url),
  "utf8"
);
const policy = JSON.parse(policyText);
assert.deepEqual(policy.hybridPolicies, [...POLICIES]);
interface Row {
  gold: string;
  verse: EvalVerse;
  baseline: BaselineVerse;
  expected: CarrierPlacement[];
  results: Record<string, Links[]>;
}
const rows: Row[] = [];
const execution: unknown[] = [];
for (const gold of GOLDS) {
  const dir = path.join(root, gold);
  const goldPath = `data/strongs/${gold}.csv`;
  assert.equal(
    sha(await readFile(goldPath)),
    plan.manifests.find((m: { gold: string }) => m.gold === gold).goldSha256
  );
  const goldRows = buildStrongVerseMap(await readStrongCsv(goldPath));
  const evalText = await readFile(path.join(dir, "eval-input.json"), "utf8");
  assert.equal(
    sha(evalText),
    plan.manifests.find((m: { gold: string }) => m.gold === gold).inputs[
      "eval-input.json"
    ]
  );
  const evaluation: EvalVerse[] = JSON.parse(evalText);
  const expected: Record<string, CarrierPlacement[]> = JSON.parse(
    await readFile(path.join(dir, "expected.json"), "utf8")
  );
  const baseline: BaselineVerse[] = JSON.parse(
    await readFile(path.join(dir, "baseline.json"), "utf8")
  ).verses;
  const runs: Record<string, Links[]> = {};
  for (const representation of policy.representations as string[]) {
    const model = path.join(dir, "eflomal", representation);
    const text = await readFile(path.join(model, "predictions.jsonl"), "utf8");
    const metadata = JSON.parse(
      await readFile(path.join(model, "predictions.meta.json"), "utf8")
    );
    const config = JSON.parse(
      await readFile(path.join(model, "predictions.config.json"), "utf8")
    );
    assert.equal(sha(text), metadata.sha256);
    assert.equal(
      config.identity.planSha256,
      sha(await readFile(path.join(root, "plan.json")))
    );
    assert.equal(config.isolatedPerVerse, true);
    runs[representation] = text
      .trim()
      .split("\n")
      .map((line) => JSON.parse(line));
    assert.equal(runs[representation].length, evaluation.length * 3);
    assert.equal(
      new Set(runs[representation].map((r) => `${r.ref}:${r.seed}`)).size,
      evaluation.length * 3
    );
    assert(
      runs[representation].every(
        (r) =>
          evaluation.some((v) => v.ref === r.ref) &&
          [17, 29, 43].includes(r.seed)
      )
    );
    execution.push({
      gold,
      representation,
      training: JSON.parse(
        await readFile(path.join(model, "training.json"), "utf8")
      ),
      inference: metadata
    });
  }
  for (const verse of evaluation) {
    assert.deepEqual(
      expected[verse.ref],
      extractGoldCarrierPlacements(goldRows.get(verse.ref)!.row.text)
    );
    const b = baseline.find((v) => v.ref === verse.ref)!;
    assert(b);
    assert.deepEqual(
      [...b.original].sort(),
      [...verse.strong].sort(),
      `source-inventory-drift:${gold}:${verse.ref}`
    );
    rows.push({
      gold,
      verse,
      baseline: b,
      expected: expected[verse.ref],
      results: Object.fromEntries(
        Object.entries(runs).map(([name, values]) => [
          name,
          values.filter((v) => v.ref === verse.ref)
        ])
      )
    });
  }
}

function metrics(tp: number, fp: number, fn: number) {
  return {
    tp,
    fp,
    fn,
    precision: tp / (tp + fp || 1),
    recall: tp / (tp + fn || 1),
    f1: (2 * tp) / (2 * tp + fp + fn || 1)
  };
}
function score(subset: Row[], predict: (r: Row) => CarrierPlacement[]) {
  let tp = 0,
    fp = 0,
    fn = 0;
  for (const r of subset) {
    const s = scoreCarrierAwareVerse(
      r.verse.ref,
      predict(r),
      r.expected
    ).visibleCarrierExact;
    tp += s.truePositive;
    fp += s.falsePositive;
    fn += s.falseNegative;
  }
  return metrics(tp, fp, fn);
}
const base = (r: Row) => r.baseline.placements;
const seeds = [17, 29, 43];
function hybrid(subset: Row[], representation: string, name: Policy) {
  const outcomes = subset.map((r) => ({
    row: r,
    outcome: applyHybrid(r.verse, r.baseline, r.results[representation], name)
  }));
  let changed = 0,
    correct = 0;
  const counts: Record<string, number> = {};
  const examples: unknown[] = [];
  for (const { row: r, outcome } of outcomes) {
    changed += outcome.changed.length;
    for (const [k, v] of Object.entries(outcome.counts))
      counts[k] = (counts[k] ?? 0) + v;
    const preserved = outcome.placements.filter(
      (p) => !outcome.changed.some((c) => c.id === p.id)
    );
    const final = scoreCarrierAwareVerse(
      r.verse.ref,
      outcome.placements,
      r.expected
    ).visibleCarrierExact;
    const kept = scoreCarrierAwareVerse(
      r.verse.ref,
      preserved,
      r.expected
    ).visibleCarrierExact;
    correct += final.truePositive - kept.truePositive;
    for (const p of outcome.changed)
      examples.push({
        gold: r.gold,
        ref: r.verse.ref,
        strong: p.strong,
        before: r.baseline.placements.find((b) => b.id === p.id),
        after: p,
        expected: r.expected.filter((e) => e.strong === p.strong),
        text: r.verse.text,
        source: r.verse.source.filter((s) => s.strong === p.strong)
      });
  }
  const after = score(
    subset,
    (r) => outcomes.find((o) => o.row === r)!.outcome.placements
  );
  const before = score(subset, base);
  return {
    representation,
    policy: name,
    metrics: after,
    edits: {
      changed,
      correct,
      precision: changed ? correct / changed : null,
      tpGain: after.tp - before.tp,
      fpChange: after.fp - before.fp,
      ...counts
    },
    examples
  };
}
function candidateCoverage(subset: Row[]) {
  const buckets: Record<
    string,
    {
      cases: number;
      covered: Record<string, number>;
      candidates: Record<string, number>;
    }
  > = {};
  for (const r of subset) {
    for (const p of r.expected.filter((p) => p.kind !== "empty")) {
      if (
        r.expected.filter((e) => e.strong === p.strong).length !== 1 ||
        r.verse.source.filter((s) => s.strong === p.strong).length !== 1
      )
        continue;
      const current = r.baseline.placements.filter(
        (b) => b.strong === p.strong && b.kind !== "empty"
      );
      const already = current.some((b) => carrierKey(b) === carrierKey(p));
      const category = already
        ? "already-correct"
        : current.length
          ? "misplaced"
          : "missing";
      const sets: Record<string, Set<string>> = {};
      for (const limit of policy.candidateLimits as number[])
        sets[`lexical-${limit}`] = new Set([
          ...current.map((b) => spanKey(b.startWordIndex!, b.endWordIndex!)),
          ...r.baseline.items
            .filter((i) => i.strong === p.strong)
            .flatMap((i) => i.candidates.slice(0, limit).map(candidateSpan))
        ]);
      for (const representation of policy.representations as string[]) {
        const additions = [
          ...project(
            r.verse,
            r.results[representation].find((run) => run.seed === 17)!,
            "union"
          ).placements.values()
        ]
          .filter((a) => a.strong === p.strong)
          .map((a) => spanKey(a.startWordIndex!, a.endWordIndex!));
        sets[`lexical-5+${representation}`] = new Set([
          ...sets["lexical-5"],
          ...additions
        ]);
        sets[`lexical-100+${representation}`] = new Set([
          ...sets["lexical-100"],
          ...additions
        ]);
      }
      const combined = new Set([
        ...sets["lexical-100+strong"],
        ...sets["lexical-100+surface"]
      ]);
      sets["lexical-100+both"] = combined;
      for (const bucket of [
        "all",
        category,
        ...(already ? [] : ["unresolved"])
      ]) {
        const b = (buckets[bucket] ??= {
          cases: 0,
          covered: {},
          candidates: {}
        });
        b.cases++;
        for (const [name, set] of Object.entries(sets)) {
          b.covered[name] =
            (b.covered[name] ?? 0) +
            Number(set.has(spanKey(p.startWordIndex!, p.endWordIndex!)));
          b.candidates[name] = (b.candidates[name] ?? 0) + set.size;
        }
      }
    }
  }
  return buckets;
}

const calibration = rows.filter((r) => r.verse.split === "calibration");
const test = rows.filter((r) => r.verse.split === "test");
const calibrationResults = (policy.representations as string[]).flatMap(
  (representation) =>
    POLICIES.map((name) => hybrid(calibration, representation, name))
);
const selection = policy.calibrationSelection;
const qualifying = calibrationResults
  .filter(
    (r) =>
      r.edits.changed >= selection.minimumChangedPlacements &&
      (r.edits.precision ?? 0) >=
        selection.minimumObservedChangedPlacementPrecision &&
      r.edits.fpChange <= selection.maximumFalsePositiveIncrease
  )
  .sort(
    (a, b) =>
      b.edits.tpGain - a.edits.tpGain ||
      a.metrics.fp - b.metrics.fp ||
      `${a.representation}:${a.policy}`.localeCompare(
        `${b.representation}:${b.policy}`
      )
  );
const chosen = qualifying[0];
function summarizeHybrid(r: ReturnType<typeof hybrid>) {
  return {
    representation: r.representation,
    policy: r.policy,
    metrics: r.metrics,
    edits: r.edits
  };
}
// Selection is complete before any test policy is scored.
const selectionText =
  JSON.stringify(
    {
      policySha256: sha(policyText),
      selected: chosen
        ? `${chosen.representation}:${chosen.policy}`
        : "baseline",
      calibration: calibrationResults.map(summarizeHybrid)
    },
    null,
    2
  ) + "\n";
const selectionPath = path.join(root, "calibration-selection.json");
if (existsSync(selectionPath))
  assert.equal(
    await readFile(selectionPath, "utf8"),
    selectionText,
    "selection-policy-drift-use-new-campaign"
  );
else await writeFile(selectionPath, selectionText, { flag: "wx" });
const testResults = (policy.representations as string[]).flatMap(
  (representation) => POLICIES.map((name) => hybrid(test, representation, name))
);
const standalone = (policy.representations as string[]).flatMap(
  (representation) =>
    ["intersection", "union"].map((direction) => ({
      representation,
      direction,
      ...score(test, (r) => [
        ...project(
          r.verse,
          r.results[representation].find((run) => run.seed === 17)!,
          direction as "intersection" | "union"
        ).placements.values()
      ])
    }))
);
const baseline = score(test, base);
let baselineErrors = 0,
  reviewableErrors = 0;
for (const r of test) {
  const expected = new Map<string, number>();
  for (const p of r.expected.filter((p) => p.kind !== "empty"))
    expected.set(carrierKey(p), (expected.get(carrierKey(p)) ?? 0) + 1);
  for (const p of r.baseline.placements.filter((p) => p.kind !== "empty")) {
    const key = carrierKey(p);
    if ((expected.get(key) ?? 0) > 0) expected.set(key, expected.get(key)! - 1);
    else {
      baselineErrors++;
      if (r.baseline.items.some((i) => i.annotationId === p.id))
        reviewableErrors++;
    }
  }
}
assert.equal(baselineErrors, baseline.fp);
const stability = (policy.representations as string[]).map((representation) => {
  let compared = 0,
    changed = 0;
  for (const r of test) {
    const projections = seeds.map(
      (seed) =>
        project(
          r.verse,
          r.results[representation].find((p) => p.seed === seed)!,
          "intersection"
        ).placements
    );
    for (let i = 0; i < r.verse.source.length; i++) {
      compared++;
      if (
        new Set(
          projections.map((m) => (m.has(i) ? carrierKey(m.get(i)!) : "abstain"))
        ).size > 1
      )
        changed++;
    }
  }
  return {
    representation,
    sourceOccurrences: compared,
    varyingCarrierAcrossSeeds: changed
  };
});
const selectedTest = chosen
  ? testResults.find(
      (r) =>
        r.representation === chosen.representation && r.policy === chosen.policy
    )!
  : undefined;
const summary = {
  version: "alignment-v1-report",
  policySha256: sha(policyText),
  scope: {
    texts: rows.length,
    passages: new Set(rows.map((r) => r.verse.ref)).size,
    calibrationTexts: calibration.length,
    testTexts: test.length
  },
  baseline,
  standalone,
  calibration: calibrationResults.map(summarizeHybrid),
  selectedPolicy: chosen
    ? `${chosen.representation}:${chosen.policy}`
    : "baseline",
  selectedTest: selectedTest
    ? { metrics: selectedTest.metrics, edits: selectedTest.edits }
    : { metrics: baseline },
  testHybrids: testResults.map(summarizeHybrid),
  candidateCoverage: candidateCoverage(test),
  reviewScope: { baselineErrors, reviewableErrors },
  stability,
  baselineByGold: GOLDS.map((gold) => ({
    gold,
    ...score(
      test.filter((r) => r.gold === gold),
      base
    )
  })),
  baselineByTestament: ["OT", "NT"].map((testament) => ({
    testament,
    ...score(
      test.filter(
        (r) =>
          (BOOK_IDS.indexOf(
            r.verse.ref.split(".")[0] as (typeof BOOK_IDS)[number]
          ) < 39
            ? "OT"
            : "NT") === testament
      ),
      base
    )
  })),
  execution,
  limitations: [
    "Agreement with legacy CSV carriers, not human-validated semantics",
    "Same strict legacy dictionary fixture as previous benchmark",
    "Amalgamated STEP inventory, not a single manuscript edition",
    "Correlated editions are not independent samples",
    "100 reserved passages not scored",
    "No production application"
  ]
};
await writeFile(
  path.join(root, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
await writeFile(
  path.join(root, "changes-for-audit.json"),
  JSON.stringify(
    testResults.map((r) => ({
      representation: r.representation,
      policy: r.policy,
      changes: r.examples
    })),
    null,
    2
  ) + "\n"
);
// Blind packet has only source and target. It deliberately omits CSV/model/baseline labels.
const blind = [...rows]
  .sort((a, b) =>
    sha(`${a.gold}:${a.verse.ref}`).localeCompare(
      sha(`${b.gold}:${b.verse.ref}`)
    )
  )
  .filter(
    (r, i, all) => all.findIndex((p) => p.verse.ref === r.verse.ref) === i
  )
  .slice(0, 60)
  .map((r) => ({
    id: `${r.gold}:${r.verse.ref}`,
    gold: r.gold,
    ref: r.verse.ref,
    text: r.verse.text,
    words: r.verse.words.map((text, index) => ({ index, text })),
    source: r.verse.source,
    annotation: {
      status: "unreviewed",
      sure: [],
      possible: [],
      absent: [],
      uncertain: [],
      notes: ""
    }
  }));
await writeFile(
  path.join(root, "blind-review.json"),
  JSON.stringify(blind, null, 2) + "\n"
);
const pct = (n: number) => `${(100 * n).toFixed(2)} %`;
const tableRow = (name: string, m: ReturnType<typeof metrics>) =>
  `| ${name} | ${pct(m.precision)} | ${pct(m.recall)} | ${pct(m.f1)} |`;
const lines = [
  "# Eflomal local — campagne v1",
  "",
  "Mesure de conformité aux balises CSV ; aucune validation philologique ni application en production.",
  "",
  `${rows.length} textes, ${summary.scope.passages} passages : ${calibration.length} textes de calibration et ${test.length} de test.`,
  "",
  "## Reconstruction visible — test",
  "",
  "| Variante | Précision | Rappel | F1 |",
  "| --- | ---: | ---: | ---: |",
  tableRow("Moteur actuel", baseline),
  ...standalone.map((r) =>
    tableRow(`Eflomal ${r.representation}/${r.direction}`, r)
  ),
  ...testResults.map((r) =>
    tableRow(`Moteur + ${r.representation}/${r.policy}`, r.metrics)
  ),
  "",
  `Politique sélectionnée uniquement sur calibration : **${summary.selectedPolicy}**.`,
  "",
  "## Corrections proposées — calibration",
  "",
  "| Représentation / politique | Modifications | Conformes | Précision | Gain TP | Variation FP |",
  "| --- | ---: | ---: | ---: | ---: | ---: |",
  ...calibrationResults.map(
    (r) =>
      `| ${r.representation}/${r.policy} | ${r.edits.changed} | ${r.edits.correct} | ${pct(r.edits.precision ?? 0)} | ${r.edits.tpGain} | ${r.edits.fpChange} |`
  ),
  "",
  "## Couverture de candidats sur les cas non résolus — test",
  "",
  "Cas avec une occurrence source et une annotation attendue uniques ; la cible correcte est absente du placement initial.",
  "",
  "| Candidats | Cible disponible | Cas | Nombre moyen de choix |",
  "| --- | ---: | ---: | ---: |"
];
const coverage = summary.candidateCoverage.unresolved;
for (const name of Object.keys(coverage.covered))
  lines.push(
    `| ${name} | ${coverage.covered[name]} (${pct(coverage.covered[name] / coverage.cases)}) | ${coverage.cases} | ${(coverage.candidates[name] / coverage.cases).toFixed(2)} |`
  );
lines.push(
  "",
  `La revue élargie couvre ${reviewableErrors}/${baselineErrors} placements initiaux non conformes.`,
  "",
  "Les résultats des autres politiques sont descriptifs ; ils ne servent pas à rechoisir une politique sur le test.",
  "",
  "Les détails, changements, répétitions et empreintes sont dans summary.json, changes-for-audit.json et les répertoires eflomal. Le paquet blind-review.json reste à annoter ; il ne constitue pas une référence sémantique validée."
);
await writeFile(path.join(root, "report.md"), lines.join("\n") + "\n");
console.log(
  JSON.stringify(
    {
      scope: summary.scope,
      baseline,
      standalone,
      selectedPolicy: summary.selectedPolicy,
      selectedTest: summary.selectedTest,
      candidateCoverage: summary.candidateCoverage.unresolved,
      reviewScope: summary.reviewScope,
      stability
    },
    null,
    2
  )
);
