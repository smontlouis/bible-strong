import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { scoreCarrierAwareVerse } from "../../src/evaluateStrongGold.js";
import {
  hash,
  placementKey,
  requestFor,
  type BenchmarkCase,
  type BenchmarkVerse,
  type Dataset
} from "./prepare.js";

interface Result {
  id: string;
  requestSha256?: string;
  status: string;
  choice?: string;
  probability?: number;
  probabilities?: Record<string, number>;
  elapsedMs?: number;
  reason?: string;
  raw?: {
    usage?: { inputTokens?: number; input_tokens?: number };
    providerMetadata?: {
      gateway?: { cost?: string; routing?: { finalProvider?: string } };
    };
  };
}
const THRESHOLDS = [0, 0.5, 0.7, 0.8, 0.9, 0.95, 0.98, 0.99, 1];
export function expectedChoice(c: BenchmarkCase): string | undefined {
  if (!c.uniqueOccurrence) return undefined;
  const expected = c.expected[0];
  if (expected.kind === "empty") return "NONE";
  return (
    c.choices.find(
      (choice) =>
        choice.placement &&
        placementKey(choice.placement) === placementKey(expected)
    )?.key ?? "UNSURE"
  );
}
export function applyChoices(
  verse: BenchmarkVerse,
  cases: BenchmarkCase[],
  results: Map<string, Result>,
  threshold: number
) {
  let predicted = [...verse.baseline];
  const counts = {
    applied: 0,
    retained: 0,
    abstained: 0,
    blocked: 0,
    removed: 0
  };
  const ordered = [...cases].sort(
    (a, b) =>
      (results.get(b.id)?.probability ?? 0) -
        (results.get(a.id)?.probability ?? 0) || a.id.localeCompare(b.id)
  );
  for (const c of ordered) {
    const result = results.get(c.id);
    if (
      result?.status !== "ok" ||
      result.choice === "UNSURE" ||
      (result.probability ?? 0) < threshold
    ) {
      counts.abstained++;
      continue;
    }
    const choice = c.choices.find((o) => o.key === result.choice);
    if (!choice) throw new Error("result-choice-outside-dataset");
    if (choice.key === "NONE") {
      const prior = predicted.find((p) => p.id === c.annotationId);
      if (prior && prior.kind !== "empty") {
        predicted = predicted.filter((p) => p.id !== c.annotationId);
        counts.removed++;
      } else counts.retained++;
      continue;
    }
    const proposed = choice.placement!;
    if (c.baseline && placementKey(c.baseline) === placementKey(proposed)) {
      counts.retained++;
      continue;
    }
    // Do not introduce a duplicate occurrence or new stacking on an occupied span.
    const conflicts = predicted.some(
      (p) =>
        p.id !== c.annotationId &&
        p.kind !== "empty" &&
        p.startWordIndex! <= proposed.endWordIndex! &&
        proposed.startWordIndex! <= p.endWordIndex!
    );
    if (conflicts) {
      counts.blocked++;
      continue;
    }
    predicted = predicted.filter((p) => p.id !== c.annotationId);
    predicted.push({ ...proposed, id: c.annotationId });
    counts.applied++;
  }
  return { predicted, counts };
}
function decisionMetrics(
  cases: BenchmarkCase[],
  results: Map<string, Result>,
  threshold: number
) {
  const labeled = cases.filter(
    (c) => expectedChoice(c) !== undefined && results.get(c.id)?.status === "ok"
  );
  const selected = labeled.filter(
    (c) =>
      results.get(c.id)!.choice !== "UNSURE" &&
      results.get(c.id)!.probability! >= threshold
  );
  const correct = selected.filter(
    (c) => expectedChoice(c) === results.get(c.id)!.choice
  ).length;
  const visible = selected.filter((c) => results.get(c.id)!.choice !== "NONE");
  const visibleCorrect = visible.filter(
    (c) => expectedChoice(c) === results.get(c.id)!.choice
  ).length;
  const calibration = Array.from({ length: 10 }, (_, index) => {
    const items = labeled.filter((c) => {
      const r = results.get(c.id)!;
      return (
        r.choice !== "UNSURE" &&
        Math.min(9, Math.floor(r.probability! * 10)) === index
      );
    });
    const meanProbability =
      items.reduce((s, c) => s + results.get(c.id)!.probability!, 0) /
      (items.length || 1);
    const accuracy =
      items.filter((c) => expectedChoice(c) === results.get(c.id)!.choice)
        .length / (items.length || 1);
    return { from: index / 10, n: items.length, meanProbability, accuracy };
  });
  return {
    labeled: labeled.length,
    selected: selected.length,
    correct,
    precision: selected.length ? correct / selected.length : null,
    coverage: selected.length / (labeled.length || 1),
    visible: visible.length,
    visibleCorrect,
    visiblePrecision: visible.length ? visibleCorrect / visible.length : null,
    ece:
      calibration.reduce(
        (sum, b) => sum + b.n * Math.abs(b.meanProbability - b.accuracy),
        0
      ) / (calibration.reduce((s, b) => s + b.n, 0) || 1),
    calibration
  };
}
function totals(
  verses: BenchmarkVerse[],
  cases: BenchmarkCase[],
  results: Map<string, Result>,
  threshold: number
) {
  let tp = 0,
    fp = 0,
    fn = 0;
  let fullTp = 0,
    fullFp = 0,
    fullFn = 0;
  const counts = {
    applied: 0,
    retained: 0,
    abstained: 0,
    blocked: 0,
    removed: 0
  };
  for (const v of verses) {
    const outcome = applyChoices(
      v,
      cases.filter((c) => c.gold === v.gold && c.ref === v.ref),
      results,
      threshold
    );
    for (const key of Object.keys(counts) as Array<keyof typeof counts>)
      counts[key] += outcome.counts[key];
    const score = scoreCarrierAwareVerse(v.ref, outcome.predicted, v.expected);
    tp += score.visibleCarrierExact.truePositive;
    fp += score.visibleCarrierExact.falsePositive;
    fn += score.visibleCarrierExact.falseNegative;
    fullTp += score.carrierExact.truePositive;
    fullFp += score.carrierExact.falsePositive;
    fullFn += score.carrierExact.falseNegative;
  }
  const metric = (a: number, b: number, c: number) => ({
    tp: a,
    fp: b,
    fn: c,
    precision: a / (a + b || 1),
    recall: a / (a + c || 1),
    f1: (2 * a) / (2 * a + b + c || 1)
  });
  return {
    verseCount: verses.length,
    visible: metric(tp, fp, fn),
    allCarriers: metric(fullTp, fullFp, fullFn),
    edits: counts
  };
}
async function readResults(file: string): Promise<Map<string, Result>> {
  try {
    const values: Result[] = (await readFile(file, "utf8"))
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((l) => JSON.parse(l));
    if (new Set(values.map((r) => r.id)).size !== values.length)
      throw new Error("duplicate-result-id");
    return new Map(values.map((r) => [r.id, r]));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return new Map();
    throw error;
  }
}
const pct = (n: number | null) =>
  n === null ? "—" : `${(n * 100).toFixed(2)} %`;
async function main() {
  const root = path.resolve(process.argv[2]);
  const datasets: Dataset[] = [];
  for (const gold of ["Sg1910", "Darby", "DarbyR"]) {
    try {
      datasets.push(
        JSON.parse(
          await readFile(path.join(root, gold, "dataset.json"), "utf8")
        )
      );
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  }
  const cases = datasets.flatMap((d) => d.cases);
  const verses = datasets.flatMap((d) => d.verses);
  const base = Object.fromEntries(
    await Promise.all(
      ["laya", "jev"].map(async (name) => [
        name,
        await readResults(path.join(root, "results", `${name}-base.jsonl`))
      ])
    )
  );
  for (const c of cases) {
    for (const name of ["laya", "jev"]) {
      const r = base[name].get(c.id);
      if (r && r.requestSha256 !== hash(JSON.stringify(requestFor(c)))) {
        throw new Error(`result-request-mismatch:${name}:${c.id}`);
      }
    }
  }
  const pairedCases = cases.filter(
    (c) =>
      base.laya.get(c.id)?.status === "ok" &&
      base.jev.get(c.id)?.status === "ok"
  );
  const testCases = pairedCases.filter((c) => c.split === "test");
  const testVerses = verses.filter((v) => v.split === "test");
  const calibrationCases = pairedCases.filter((c) => c.split === "calibration");
  const baseline = totals(testVerses, [], new Map(), 2);
  const summaries: Record<string, unknown> = {};
  const lines = [
    "# Comparatif Strong : Laya et JEV",
    "",
    "Benchmark exploratoire, sans application en production.",
    "",
    `Sources : ${datasets.map((d) => d.metadata.gold).join(", ")}. ${verses.length} textes de versets (${new Set(verses.map((v) => v.ref)).size} références bibliques distinctes) ; ${cases.length} décisions proposées ; ${pairedCases.length} réponses communes exploitables.`,
    `${testCases.length} décisions test et ${calibrationCases.length} de calibration, séparées par chapitre biblique. Les mêmes chapitres restent dans le même groupe entre éditions.`,
    "",
    "## Reconstruction des placements visibles — test",
    "",
    "Les décisions simulées conservent le moteur initial en cas d'abstention. Les nouveaux chevauchements sont bloqués. NONE retire un placement visible, sans inventer d'ancrage vide. Les occurrences STEP restent hors de cette projection de lecture.",
    "",
    "| Variante | Précision | Rappel | F1 | Placements ajoutés/déplacés | Retirés | Bloqués |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    `| Moteur seul | ${pct(baseline.visible.precision)} | ${pct(baseline.visible.recall)} | ${pct(baseline.visible.f1)} | 0 | 0 | 0 |`
  ];
  const decisionLines = [
    "",
    "## Choix sur les occurrences évaluables sans ambiguïté",
    "",
    "Sous-ensemble avec une seule occurrence de ce Strong dans STEP et dans la référence. Une bonne réponse absente de la liste attend UNSURE ; les Strong absents de la référence ne sont pas assimilés à NONE. Les probabilités ci-dessous sont celles du choix, pas le champ confidence des fournisseurs.",
    "",
    "| Modèle/seuil | Décisions prises | Correctes | Précision | Couverture | Placements visibles corrects |",
    "| --- | ---: | ---: | ---: | ---: | ---: |"
  ];
  const operationalLines: string[] = ["", "## Exécution et stabilité", ""];
  for (const name of ["laya", "jev"]) {
    const results = base[name];
    const calibration = THRESHOLDS.map((threshold) => ({
      threshold,
      ...decisionMetrics(calibrationCases, results, threshold)
    }));
    const selected =
      calibration.find((m) => m.selected >= 30 && (m.precision ?? 0) >= 0.98)
        ?.threshold ?? null;
    const thresholds = [
      ...new Set([0, 0.9, 0.95, 0.99, ...(selected === null ? [] : [selected])])
    ];
    const test = thresholds.map((threshold) => ({
      threshold,
      decisions: decisionMetrics(testCases, results, threshold),
      pipeline: totals(testVerses, testCases, results, threshold)
    }));
    for (const row of test) {
      const m = row.pipeline;
      lines.push(
        `| ${name} ≥ ${row.threshold} | ${pct(m.visible.precision)} | ${pct(m.visible.recall)} | ${pct(m.visible.f1)} | ${m.edits.applied} | ${m.edits.removed} | ${m.edits.blocked} |`
      );
      const d = row.decisions;
      decisionLines.push(
        `| ${name} ≥ ${row.threshold} | ${d.selected}/${d.labeled} | ${d.correct} | ${pct(d.precision)} | ${pct(d.coverage)} | ${d.visibleCorrect}/${d.visible} |`
      );
    }
    const rows = [...results.values()];
    const successful = rows.filter((r) => r.status === "ok");
    const latencies = successful.map((r) => r.elapsedMs!).sort((a, b) => a - b);
    const stability: Record<string, unknown> = {};
    for (const variant of ["reverse", "repeat"]) {
      const altered = await readResults(
        path.join(root, "results", `${name}-${variant}.jsonl`)
      );
      const comparable = [...altered.values()].filter(
        (r) => r.status === "ok" && results.get(r.id)?.status === "ok"
      );
      stability[variant] = {
        n: comparable.length,
        changedChoices: comparable.filter(
          (r) => r.choice !== results.get(r.id)!.choice
        ).length,
        maxProbabilityChange: Math.max(
          0,
          ...comparable.flatMap((r) =>
            Object.entries(r.probabilities!).map(([k, p]) =>
              Math.abs(p - results.get(r.id)!.probabilities![k])
            )
          )
        )
      };
    }
    const operational = {
      success: successful.length,
      errors: rows.filter((r) => r.status === "error"),
      excluded: rows.filter((r) => r.status === "excluded"),
      medianMs: latencies[Math.floor(latencies.length / 2)],
      p95Ms:
        latencies[
          Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))
        ],
      inputTokens: successful.reduce(
        (s, r) =>
          s + (r.raw?.usage?.inputTokens ?? r.raw?.usage?.input_tokens ?? 0),
        0
      ),
      reportedCostUsd: rows.reduce(
        (s, r) => s + Number(r.raw?.providerMetadata?.gateway?.cost ?? 0),
        0
      ),
      providers: [
        ...new Set(
          successful
            .map(
              (r) => r.raw?.providerMetadata?.gateway?.routing?.finalProvider
            )
            .filter(Boolean)
        )
      ]
    };
    summaries[name] = {
      calibrationThreshold: selected,
      calibration,
      test,
      operational,
      stability,
      byGold: datasets.map((d) => ({
        gold: d.metadata.gold,
        baseline: totals(
          d.verses.filter((v) => v.split === "test"),
          [],
          new Map(),
          2
        ),
        threshold95: totals(
          d.verses.filter((v) => v.split === "test"),
          testCases.filter((c) => c.gold === d.metadata.gold),
          results,
          0.95
        )
      }))
    };
    operationalLines.push(
      "",
      `${name} : seuil retenu sur calibration = ${selected ?? "aucun (objectif : au moins 30 décisions et 98 % de précision observée)"}.`,
      `Latence médiane ${operational.medianMs?.toFixed(1)} ms ; p95 ${operational.p95Ms?.toFixed(1)} ms ; coût rapporté ${operational.reportedCostUsd.toFixed(6)} USD.`,
      `Stabilité : ${JSON.stringify(stability)}.`,
      ""
    );
  }
  const labeled = testCases.filter((c) => expectedChoice(c) !== undefined);
  const comparisons = {
    layaOnlyCorrect: 0,
    jevOnlyCorrect: 0,
    bothCorrect: 0,
    bothWrong: 0,
    agree: 0,
    agreeWrong: 0
  };
  for (const c of labeled) {
    const a = base.laya.get(c.id)!.choice,
      b = base.jev.get(c.id)!.choice,
      expected = expectedChoice(c);
    const ac = a === expected,
      bc = b === expected;
    if (ac && bc) comparisons.bothCorrect++;
    else if (ac) comparisons.layaOnlyCorrect++;
    else if (bc) comparisons.jevOnlyCorrect++;
    else comparisons.bothWrong++;
    if (a === b) {
      comparisons.agree++;
      if (!ac) comparisons.agreeWrong++;
    }
  }
  const candidateCoverage = labeled.filter(
    (c) => c.expected[0].kind !== "empty"
  );
  const errors = labeled.filter(
    (c) =>
      base.laya.get(c.id)!.choice !== expectedChoice(c) ||
      base.jev.get(c.id)!.choice !== expectedChoice(c)
  );
  lines.push(
    ...decisionLines,
    ...operationalLines,
    "",
    "## Comparaison appariée",
    "",
    JSON.stringify(comparisons),
    "",
    `Bonne cible visible disponible : ${candidateCoverage.filter((c) => expectedChoice(c) !== "UNSURE").length}/${candidateCoverage.length}.`,
    "",
    "## Limites",
    "",
    "- Le générateur avec son dictionnaire par défaut échoue actuellement sur unattested-v3-carrier-database. Cette expérience emploie explicitement le dictionnaire bilingue legacy indiqué dans les métadonnées, qui passe le lecteur strict. Elle ne valide pas le pointeur de production.",
    "- Les résultats portent sur les candidats résiduels du moteur, après exclusions de famille éditoriale ; ils ne mesurent pas une génération autonome par les modèles.",
    "- Darby et DarbyR sont corrélées. Les différences de conventions éditoriales et de texte source peuvent expliquer une partie des désaccords avec la référence.",
    "- Les seuils sont exploratoires. La calibration et le test sont séparés ; 98 % observés sur un petit groupe ne prouvent pas 98 % en production.",
    "- La stabilité et les latences concernent cette machine et ces requêtes. Les deux moteurs reçoivent les mêmes textes sans troncature ; les exclusions sont comptées pour les deux.",
    "- Les résultats détaillés et requêtes restent dans outputs/ ; aucun placement de production n'a été appliqué.",
    ""
  );
  await writeFile(
    path.join(root, "summary.json"),
    JSON.stringify(
      {
        cases: cases.length,
        paired: pairedCases.length,
        testCases: testCases.length,
        calibrationCases: calibrationCases.length,
        baseline,
        summaries,
        comparisons,
        metadata: datasets.map((d) => d.metadata)
      },
      null,
      2
    )
  );
  await writeFile(path.join(root, "report.md"), lines.join("\n"));
  await writeFile(
    path.join(root, "disagreements.json"),
    JSON.stringify(
      errors.map((c) => ({
        ...c,
        expectedChoice: expectedChoice(c),
        laya: base.laya.get(c.id),
        jev: base.jev.get(c.id)
      })),
      null,
      2
    )
  );
  console.log(
    JSON.stringify({
      root,
      cases: cases.length,
      paired: pairedCases.length,
      comparisons
    })
  );
}
if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
