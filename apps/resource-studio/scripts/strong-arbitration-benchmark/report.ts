/** Evaluate frozen outputs. Labels are only read here, after request construction and inference. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  extractGoldCarrierPlacements,
  scoreCarrierAwareVerse,
  type CarrierPlacement
} from "../../src/evaluateStrongGold.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "./reader-text.js";
import {
  carrierKey,
  sha,
  GOLDS,
  type BaselineVerse,
  type EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import {
  applyChoices,
  expectedChoice,
  VARIANTS,
  type Case,
  type Request,
  type Result,
  type Variant
} from "./core.js";

const root = path.resolve(process.argv[2]);
const manifest = JSON.parse(
  await readFile(path.join(root, "manifest.json"), "utf8")
);
async function frozen(file: string) {
  const content = await readFile(path.join(root, file), "utf8");
  assert.equal(sha(content), manifest.files[file], `changed-input:${file}`);
  return content;
}
const policyText = await frozen("policy.json"),
  policy = JSON.parse(policyText);
const cases: Case[] = JSON.parse(await frozen("cases.json"));
const inputs: Array<{
  gold: string;
  verse: EvalVerse;
  baseline: BaselineVerse;
}> = JSON.parse(await frozen("verses.json"));
const requests: Request[] = (await frozen("requests.jsonl"))
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const requestMap = new Map(requests.map((r) => [r.id, r]));
assert.equal(requests.length, cases.length * VARIANTS.length);
// Bind imported artifacts to the campaign source as well as frozen local files.
for (const [file, hash] of Object.entries(manifest.inputs))
  assert.equal(
    sha(await readFile(path.join(manifest.sourceRoot, file))),
    hash,
    `source-input-drift:${file}`
  );
for (const file of ["core.ts", "policy.json"])
  assert.equal(
    sha(await readFile(new URL(`./${file}`, import.meta.url))),
    manifest.sourceSha256[file],
    `code-drift:${file}`
  );
const plan = JSON.parse(
  await readFile(path.join(manifest.sourceRoot, "plan.json"), "utf8")
);
if (plan.textPolicy === "exclude-publisher-notes-v1") {
  assert.equal(
    sha(await readFile(new URL("./reader-text.ts", import.meta.url))),
    plan.readerTextSha256
  );
}
const golds = new Map<string, Record<string, CarrierPlacement[]>>();
for (const gold of GOLDS) {
  const text = await readFile(
    path.join(manifest.sourceRoot, gold, "expected.json"),
    "utf8"
  );
  const csvPath = `data/strongs/${gold}.csv`;
  assert.equal(
    sha(await readFile(csvPath)),
    plan.manifests.find((m: { gold: string }) => m.gold === gold).goldSha256
  );
  const csv = buildStrongVerseMap(await readStrongCsv(csvPath));
  const expected: Record<string, CarrierPlacement[]> = JSON.parse(text);
  for (const input of inputs.filter((r) => r.gold === gold)) {
    assert.deepEqual(
      expected[input.verse.ref],
      extractGoldCarrierPlacements(
        plan.textPolicy === "exclude-publisher-notes-v1"
          ? withoutPublisherNotes(csv.get(input.verse.ref)!.row.text)
          : csv.get(input.verse.ref)!.row.text
      )
    );
  }
  golds.set(gold, expected);
}
const rows = inputs.map((r) => ({
  ...r,
  expected: golds.get(r.gold)![r.verse.ref],
  cases: cases.filter((c) => c.gold === r.gold && c.ref === r.verse.ref)
}));
type Row = (typeof rows)[number];
async function outputs(mode: "base" | "repeat" | "reverse") {
  const text = await readFile(path.join(root, `jev-${mode}.jsonl`), "utf8");
  const meta = JSON.parse(
    await readFile(path.join(root, `jev-${mode}.meta.json`), "utf8")
  );
  assert.equal(sha(text), meta.outputSha256);
  assert.equal(
    meta.runnerSha256,
    sha(await readFile(new URL("./run.py", import.meta.url)))
  );
  const data: Result[] = text
    .trim()
    .split("\n")
    .map((l) => JSON.parse(l));
  assert.equal(
    data.length,
    mode === "base" ? requests.length : policy.stabilityCases,
    "incomplete-output"
  );
  assert.equal(new Set(data.map((r) => r.id)).size, data.length);
  for (const r of data) {
    const request = structuredClone(requestMap.get(r.id));
    assert(request);
    if (mode === "reverse")
      request.questions.placement.criteria = Object.fromEntries(
        Object.entries(request.questions.placement.criteria).reverse()
      );
    assert.equal(
      r.requestSha256,
      sha(JSON.stringify(request)),
      `request-drift:${r.id}`
    );
    if (r.status === "ok")
      assert(
        r.choice &&
          request.questions.placement.criteria[r.choice] &&
          Number.isFinite(r.probability)
      );
  }
  return { data, meta };
}
const baseRun = await outputs("base"),
  resultMap = new Map(baseRun.data.map((r) => [r.id, r]));
function metric(tp: number, fp: number, fn: number) {
  return {
    tp,
    fp,
    fn,
    precision: tp / (tp + fp || 1),
    recall: tp / (tp + fn || 1),
    f1: (2 * tp) / (2 * tp + fp + fn || 1)
  };
}
function score(subset: Row[], predictions: (r: Row) => CarrierPlacement[]) {
  let tp = 0,
    fp = 0,
    fn = 0;
  for (const r of subset) {
    const m = scoreCarrierAwareVerse(
      r.verse.ref,
      predictions(r),
      r.expected
    ).visibleCarrierExact;
    tp += m.truePositive;
    fp += m.falsePositive;
    fn += m.falseNegative;
  }
  return metric(tp, fp, fn);
}
function evaluate(subset: Row[], variant: Variant, threshold: number) {
  const outcomes = subset.map((row) => ({
    row,
    out: applyChoices(row.baseline, row.cases, resultMap, variant, threshold)
  }));
  const byRow = new Map(outcomes.map((o) => [o.row, o.out]));
  const before = score(subset, (r) => r.baseline.placements),
    after = score(subset, (r) => byRow.get(r)!.placements);
  let correct = 0,
    harmed = 0,
    additions = 0,
    relocations = 0,
    boundaries = 0;
  const changes = outcomes.flatMap(({ row, out }) =>
    out.changed.map((p) => {
      const c = row.cases.find((c) => c.annotationId === p.id)!;
      const matches = row.expected.filter(
        (e) => e.strong === p.strong && e.kind !== "empty"
      );
      const isCorrect = matches.some((e) => carrierKey(e) === carrierKey(p));
      const oldCorrect =
        !!c.baseline &&
        matches.some((e) => carrierKey(e) === carrierKey(c.baseline!));
      correct += Number(isCorrect);
      harmed += Number(oldCorrect && !isCorrect);
      const kind =
        !c.baseline || c.baseline.kind === "empty"
          ? "addition"
          : matches.some(
                (e) =>
                  c.baseline!.startWordIndex! <= e.endWordIndex! &&
                  e.startWordIndex! <= c.baseline!.endWordIndex!
              )
            ? "overlapping-old-target"
            : "relocation";
      if (kind === "addition") additions++;
      else if (kind === "relocation") relocations++;
      else boundaries++;
      return {
        caseId: c.id,
        gold: row.gold,
        ref: row.verse.ref,
        strong: p.strong,
        text: row.verse.text,
        words: row.verse.words,
        source: row.verse.source[c.sourceIndex],
        previous: c.baseline,
        proposed: p,
        expected: matches,
        isCorrect,
        oldCorrect,
        kind,
        probability: resultMap.get(`${c.id}:${variant}`)!.probability
      };
    })
  );
  return {
    variant,
    threshold,
    metrics: after,
    edits: {
      changed: changes.length,
      correct,
      precision: changes.length ? correct / changes.length : null,
      harmed,
      additions,
      relocations,
      boundaries,
      tpGain: after.tp - before.tp,
      fpChange: after.fp - before.fp,
      blocked: outcomes.reduce((a, o) => a + o.out.blocked, 0),
      abstained: outcomes.reduce((a, o) => a + o.out.abstained, 0)
    },
    changes
  };
}
const compact = (r: ReturnType<typeof evaluate>) => ({
  variant: r.variant,
  threshold: r.threshold,
  metrics: r.metrics,
  edits: r.edits
});
const calibration = rows.filter((r) => r.verse.split === "calibration"),
  testRows = rows.filter((r) => r.verse.split === "test");
const calibrationResults = VARIANTS.flatMap((v) =>
  (policy.thresholds as number[]).map((t) => evaluate(calibration, v, t))
);
const qualified = calibrationResults
  .filter(
    (r) =>
      r.edits.changed >= policy.minimumChangedPlacements &&
      (r.edits.precision ?? 0) >= policy.minimumObservedEditPrecision &&
      r.edits.fpChange <= policy.maximumFalsePositiveIncrease
  )
  .sort(
    (a, b) =>
      b.edits.tpGain - a.edits.tpGain ||
      a.metrics.fp - b.metrics.fp ||
      `${a.variant}:${a.threshold}`.localeCompare(`${b.variant}:${b.threshold}`)
  );
const chosen = qualified[0];
const selection = {
  policySha256: sha(policyText),
  selected: chosen ? `${chosen.variant}:${chosen.threshold}` : "baseline",
  calibration: calibrationResults.map(compact)
};
const selectionText = JSON.stringify(selection, null, 2) + "\n",
  selectionPath = path.join(root, "calibration-selection.json");
if (existsSync(selectionPath))
  assert.equal(
    await readFile(selectionPath, "utf8"),
    selectionText,
    "selection-drift"
  );
else await writeFile(selectionPath, selectionText, { flag: "wx" });
// Test is scored only after persisting the calibration decision.
const testResults = VARIANTS.flatMap((v) =>
  (policy.thresholds as number[]).map((t) => evaluate(testRows, v, t))
);
const testCases = testRows.flatMap((r) => r.cases);
function decisions(variant: Variant, subset: Case[] = testCases) {
  let labeled = 0,
    valid = 0,
    correct = 0,
    visible = 0,
    covered = 0,
    visibleCorrect = 0,
    offeredCorrect = 0,
    unlabeled = 0,
    failures = 0;
  const byCategory: Record<string, { total: number; correct: number }> = {};
  for (const c of subset) {
    const gold = golds.get(c.gold)![c.ref],
      expected = expectedChoice(c, variant, gold),
      r = resultMap.get(`${c.id}:${variant}`)!;
    if (r.status !== "ok") failures++;
    if (expected === null) {
      unlabeled++;
      continue;
    }
    labeled++;
    if (r.status === "ok") valid++;
    const good = r.status === "ok" && r.choice === expected;
    correct += Number(good);
    const category = (byCategory[c.category] ??= { total: 0, correct: 0 });
    category.total++;
    category.correct += Number(good);
    const visibleGold = gold.filter(
      (e) => e.strong === c.strong && e.kind !== "empty"
    );
    if (visibleGold.length === 1) {
      visible++;
      covered += Number(expected !== "UNSURE");
      visibleCorrect += Number(good && expected !== "UNSURE");
      offeredCorrect += Number(good && expected !== "UNSURE");
    }
  }
  return {
    variant,
    total: subset.length,
    labeled,
    valid,
    unlabeled,
    failures,
    correct,
    accuracy: correct / (labeled || 1),
    visible,
    covered,
    candidateRecall: covered / (visible || 1),
    visibleCorrect,
    visibleAccuracy: visibleCorrect / (visible || 1),
    offeredAccuracy: offeredCorrect / (covered || 1),
    byCategory
  };
}
const paired = (
  [
    ["lexical", "enriched"],
    ["enriched", "context"]
  ] as const
).map(([a, b]) => {
  let aOnly = 0,
    bOnly = 0,
    both = 0,
    neither = 0,
    compared = 0;
  for (const c of testCases) {
    const expected = golds.get(c.gold)![c.ref];
    const x = expectedChoice(c, a, expected),
      y = expectedChoice(c, b, expected);
    if (x === null || y === null) continue;
    compared++;
    const ar = resultMap.get(`${c.id}:${a}`)!,
      br = resultMap.get(`${c.id}:${b}`)!;
    const ac = ar.status === "ok" && ar.choice === x,
      bc = br.status === "ok" && br.choice === y;
    if (ac && bc) both++;
    else if (ac) aOnly++;
    else if (bc) bOnly++;
    else neither++;
  }
  return { a, b, compared, aOnly, bOnly, both, neither };
});
const stability = [];
const executions = [baseRun];
for (const mode of ["repeat", "reverse"] as const) {
  const run = await outputs(mode);
  executions.push(run);
  let compared = 0,
    changed = 0;
  for (const r of run.data) {
    const b = resultMap.get(r.id)!;
    if (r.status === "ok" && b.status === "ok") {
      compared++;
      changed += Number(r.choice !== b.choice);
    }
  }
  stability.push({ mode, requested: run.data.length, compared, changed });
}
const latency = baseRun.data
  .filter((r) => r.elapsedMs !== undefined)
  .map((r) => r.elapsedMs!)
  .sort((a, b) => a - b);
const summary = {
  version: policy.version,
  scope: {
    cases: cases.length,
    testCases: testCases.length,
    passages: manifest.passages,
    calibrationTexts: calibration.length,
    testTexts: testRows.length,
    strata: manifest.pools
  },
  baseline: score(testRows, (r) => r.baseline.placements),
  selectedPolicy: selection.selected,
  selectedTest: chosen
    ? compact(
        testResults.find(
          (r) =>
            r.variant === chosen.variant && r.threshold === chosen.threshold
        )!
      )
    : null,
  calibration: selection.calibration,
  testResults: testResults.map(compact),
  decisions: VARIANTS.map((v) => decisions(v)),
  paired,
  stability,
  costUsd: executions
    .flatMap((r) => r.data)
    .reduce(
      (a, r) => a + Number(r.raw?.providerMetadata?.gateway?.cost ?? 0),
      0
    ),
  costRecordsMissing: executions
    .flatMap((r) => r.data)
    .filter((r) => r.raw?.providerMetadata?.gateway?.cost === undefined).length,
  medianLatencyMs: latency[Math.floor(latency.length / 2)],
  maxInputTokens: Math.max(
    ...baseRun.data.map((r) => r.raw?.usage?.inputTokens ?? 0)
  ),
  execution: executions.map((r) => r.meta),
  limitations: [
    policy.testStatus,
    "Stratified sample oversamples missing carriers; not natural corpus prevalence.",
    "Legacy CSV exact carriers are not semantic ground truth.",
    "Repeated source Strong occurrences excluded from arbitration; retained in whole-verse scoring.",
    "NONE preserves baseline. No explicit-absence gold adjudication.",
    "Correlated translations; no independent-observation confidence claim."
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
      variant: r.variant,
      threshold: r.threshold,
      changes: r.changes
    })),
    null,
    2
  ) + "\n"
);
const pct = (n: number | null) =>
  n === null ? "—" : `${(100 * n).toFixed(2)} %`;
const report = `# Arbitrage JEV sur candidats enrichis\n\n${policy.testStatus}\n\nSélection calibration : **${selection.selected}**. ${cases.length} cas, ${testCases.length} de test.\n\n| Variante | Choix conformes / étiquetés | Cible visible offerte | Cible visible correctement choisie |\n|---|---:|---:|---:|\n${summary.decisions.map((d) => `| ${d.variant} | ${d.correct}/${d.labeled} (${pct(d.accuracy)}) | ${d.covered}/${d.visible} | ${d.visibleCorrect}/${d.visible} |`).join("\n")}\n\n| Variante / seuil | P | R | F1 | Modifications conformes | Placements corrects dégradés |\n|---|---:|---:|---:|---:|---:|\n| baseline | ${pct(summary.baseline.precision)} | ${pct(summary.baseline.recall)} | ${pct(summary.baseline.f1)} | — | — |\n${testResults.map((r) => `| ${r.variant} / ${r.threshold} | ${pct(r.metrics.precision)} | ${pct(r.metrics.recall)} | ${pct(r.metrics.f1)} | ${r.edits.correct}/${r.edits.changed} (${pct(r.edits.precision)}) | ${r.edits.harmed} |`).join("\n")}\n\nCoût déclaré : ${summary.costUsd.toFixed(6)} USD. Détails et limites dans summary.json.\n`;
await writeFile(path.join(root, "report.md"), report);
console.log(
  JSON.stringify(
    {
      selected: summary.selectedPolicy,
      baseline: summary.baseline,
      decisions: summary.decisions,
      stability,
      costUsd: summary.costUsd
    },
    null,
    2
  )
);
