import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  CONCORDANCE_ORIGIN,
  USER_AGENT,
  acquireChapters,
  sealAcquisition
} from "./acquire.js";
import { buildPlan, type ExperimentPlan } from "./plan.js";
import { policyFromLabels, predict, predictionCodeHashes } from "./predict.js";
import { SCORE_VERSION, readRun, scoreRun } from "./score.js";
import {
  categoryCounts,
  markdownTable,
  readReports,
  summaryRow
} from "./report.js";
import { buildReviewPackets } from "./review.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import type { OccurrenceRecord } from "./score.js";
import {
  compareWitnessSnapshot,
  editorialTextProximity,
  referenceTransferability
} from "./provenance.js";
import {
  ACQUISITION_ROOT,
  OUT_ROOT,
  fileSha256,
  readJson,
  sha256,
  stableStringify,
  writeJsonOnce,
  writeTextOnce
} from "./shared.js";

const USAGE = `Usage (from apps/resource-studio):
  tsx scripts/strong-concordance-rebuild/run.ts plan --seed <text> --prior <file>... --consulted <Chapter,...> --forced-development <Chapter,...>
  tsx scripts/strong-concordance-rebuild/run.ts acquire --editions SG21,NEG --splits development,test [--extra Edition:Chapter,...] [--delay-ms 6000]
  tsx scripts/strong-concordance-rebuild/run.ts seal-acquisition --output <file>
  tsx scripts/strong-concordance-rebuild/run.ts acquire-witness --edition Sg1910|Darby|DarbyR --chapters-from <export.csv> --root <dir> [--delay-ms 6000]
  tsx scripts/strong-concordance-rebuild/run.ts predict --edition SG21 --scenario target-excluded --split development [--chapters A.1,B.2] [--policy ABCD] [--profile s21] [--output-dir <dir>]
  tsx scripts/strong-concordance-rebuild/run.ts freeze --policy ABCD --acquisition-seal <file> --evidence <file> --output <file>
  tsx scripts/strong-concordance-rebuild/run.ts score --run <prediction-dir> [--freeze <file>] [--output-dir <dir>]
  tsx scripts/strong-concordance-rebuild/run.ts provenance --split development --output <file>
  tsx scripts/strong-concordance-rebuild/run.ts report --split development --output-dir <dir>
  tsx scripts/strong-concordance-rebuild/run.ts sample --run <prediction-dir> --per-category 8 --output <file>
`;

const EVALUATOR_CODE = [
  "scripts/strong-concordance-rebuild/score.ts",
  "scripts/strong-concordance-rebuild/gold.ts",
  "scripts/strong-concordance-rebuild/concordanceHtml.ts",
  "scripts/strong-concordance-rebuild/acquire.ts"
];

interface FreezeRecord {
  frozenAt: string;
  policy: Record<string, boolean | undefined>;
  predictionCode: Record<string, string>;
  evaluatorCode: Record<string, string>;
  planSha256: string;
  acquisitionSeal: { path: string; sha256: string };
  /** Initial-engine test predictions sealed before any change, scored as the baseline. */
  baselineRuns: Record<string, string>;
  /** Development results that justified the frozen policy. */
  developmentEvidence: string | null;
}

function flagValues(args: string[], name: string): string[] {
  const values: string[] = [];
  for (let index = 0; index < args.length; index += 1)
    if (args[index] === name && args[index + 1] !== undefined)
      values.push(args[index + 1]!);
  return values;
}

function flagValue(args: string[], name: string): string | undefined {
  return flagValues(args, name).at(-1);
}

const [command, ...args] = process.argv.slice(2);

/** Reusable witnesses only: their pages may feed predictions, never a target's. */
const REUSABLE_WITNESSES = new Set(["Sg1910", "Darby", "DarbyR"]);

switch (command) {
  case "acquire-witness": {
    // Every chapter of one reusable witness, for its source word positions.
    // Pages live outside the evaluator-only acquisition root.
    const edition = flagValue(args, "--edition");
    const chaptersFrom = flagValue(args, "--chapters-from");
    const root = flagValue(args, "--root");
    if (!edition || !chaptersFrom || !root) throw new Error(USAGE);
    if (!REUSABLE_WITNESSES.has(edition))
      throw new Error(`not-a-reusable-witness:${edition}`);
    if (path.resolve(root).startsWith(path.resolve(OUT_ROOT)))
      throw new Error("witness-pages-must-stay-outside-the-experiment-root");
    const chapters = [
      ...new Set(
        (await readStrongCsv(chaptersFrom)).map(
          (row) => `${row.bookId}.${row.chapter}`
        )
      )
    ];
    const startedAt = new Date().toISOString();
    const result = await acquireChapters({
      requests: chapters.map((chapter) => ({ edition, chapter })),
      root,
      delayMs: Number(flagValue(args, "--delay-ms") ?? 6000),
      log: (line) => console.log(`${new Date().toISOString()} ${line}`)
    });
    const withoutPositions = [...result.fetched, ...result.cached]
      .filter(
        (receipt) => receipt.annotationCounts.wordsWithSourcePosition === 0
      )
      .map((receipt) => receipt.chapter);
    await writeJsonOnce(
      path.join(
        root,
        "runs",
        `${edition}-${startedAt.replace(/[:.]/gu, "-")}.json`
      ),
      {
        edition,
        chaptersFrom,
        startedAt,
        finishedAt: new Date().toISOString(),
        chapters: chapters.length,
        fetched: result.fetched.length,
        cached: result.cached.length,
        failed: result.failed,
        withoutPositions
      }
    );
    console.log(
      JSON.stringify({
        edition,
        chapters: chapters.length,
        fetched: result.fetched.length,
        cached: result.cached.length,
        failed: result.failed.length,
        withoutPositions: withoutPositions.length
      })
    );
    break;
  }
  case "plan": {
    const seed = flagValue(args, "--seed");
    if (!seed) throw new Error(USAGE);
    const plan = await buildPlan({
      chapterSource: "data/bibles/bible-s21.json",
      priorFiles: flagValues(args, "--prior"),
      seed,
      consulted: flagValues(args, "--consulted").flatMap((value) =>
        value.split(",")
      ),
      forcedDevelopment: flagValues(args, "--forced-development").flatMap(
        (value) => value.split(",")
      )
    });
    const output =
      flagValue(args, "--output") ?? path.join(OUT_ROOT, "plan.json");
    await writeJsonOnce(output, plan);
    console.log(
      JSON.stringify(
        {
          output,
          development: plan.development.map((entry) => entry.chapter),
          test: plan.test.map((entry) => entry.chapter),
          developmentVerses: plan.development.reduce(
            (n, entry) => n + entry.verses,
            0
          ),
          testVerses: plan.test.reduce((n, entry) => n + entry.verses, 0)
        },
        null,
        1
      )
    );
    break;
  }
  case "acquire": {
    const plan = await readJson<ExperimentPlan>(
      flagValue(args, "--plan") ?? path.join(OUT_ROOT, "plan.json")
    );
    const editions = (flagValue(args, "--editions") ?? "SG21").split(",");
    const splits = (flagValue(args, "--splits") ?? "development").split(",");
    const chapters = splits.flatMap((split) => {
      if (split !== "development" && split !== "test") throw new Error(USAGE);
      return plan[split].map((entry) => entry.chapter);
    });
    const requests = [
      ...editions.flatMap((edition) =>
        chapters.map((chapter) => ({ edition, chapter }))
      ),
      ...(flagValue(args, "--extra")?.split(",") ?? []).map((item) => {
        const [edition, chapter] = item.split(":");
        if (!edition || !chapter) throw new Error(USAGE);
        return { edition, chapter };
      })
    ];
    const robotsPath = path.join(ACQUISITION_ROOT, "robots.txt");
    if (!existsSync(robotsPath)) {
      const response = await fetch(`${CONCORDANCE_ORIGIN}/robots.txt`, {
        headers: { "User-Agent": USER_AGENT }
      });
      const robots = await response.text();
      await mkdir(ACQUISITION_ROOT, { recursive: true });
      await writeFile(robotsPath, robots, { flag: "wx" });
      await writeJsonOnce(path.join(ACQUISITION_ROOT, "robots.receipt.json"), {
        url: `${CONCORDANCE_ORIGIN}/robots.txt`,
        status: response.status,
        fetchedAt: new Date().toISOString(),
        sha256: sha256(robots),
        rule: "Only chapter pages without query strings are requested; robots.txt disallows /*?* and /*/concordance/?*."
      });
    }
    const startedAt = new Date().toISOString();
    const result = await acquireChapters({
      requests,
      delayMs: Number(flagValue(args, "--delay-ms") ?? 6000),
      log: (line) => console.log(line)
    });
    await writeJsonOnce(
      path.join(
        ACQUISITION_ROOT,
        "runs",
        `${startedAt.replace(/[:.]/gu, "-")}.json`
      ),
      {
        startedAt,
        finishedAt: new Date().toISOString(),
        requests,
        fetched: result.fetched.map(
          (receipt) => `${receipt.edition}:${receipt.chapter}`
        ),
        cached: result.cached.map(
          (receipt) => `${receipt.edition}:${receipt.chapter}`
        ),
        failed: result.failed
      }
    );
    console.log(
      JSON.stringify({
        fetched: result.fetched.length,
        cached: result.cached.length,
        failed: result.failed
      })
    );
    break;
  }
  case "seal-acquisition": {
    const output = flagValue(args, "--output");
    if (!output) throw new Error(USAGE);
    const sealed = await sealAcquisition();
    await writeJsonOnce(output, sealed);
    console.log(
      JSON.stringify({
        output,
        receipts: sealed.receipts.length,
        sha256: sealed.receiptsSha256
      })
    );
    break;
  }
  case "predict": {
    const plan = await readJson<ExperimentPlan>(
      flagValue(args, "--plan") ?? path.join(OUT_ROOT, "plan.json")
    );
    const editionId = flagValue(args, "--edition") as
      "SG21" | "NEG" | "Sg1910" | "Darby" | "DarbyR" | undefined;
    const scenario = flagValue(args, "--scenario") as
      "target-excluded" | "family-excluded" | undefined;
    const split = flagValue(args, "--split");
    if (
      !editionId ||
      !scenario ||
      (split !== "development" && split !== "test")
    )
      throw new Error(USAGE);
    const chapters =
      flagValue(args, "--chapters")?.split(",") ??
      plan[split].map((entry) => entry.chapter);
    const policy = policyFromLabels(
      (flagValue(args, "--policy") ?? "")
        .split("")
        .filter((label) => /[A-Z]/u.test(label))
    );
    const { run, manifest } = await predict({
      editionId,
      scenario,
      split,
      chapters,
      policy,
      profileBible: flagValue(args, "--profile")
    });
    const outputDir =
      flagValue(args, "--output-dir") ??
      path.join(OUT_ROOT, "predictions", run.runId);
    await writeJsonOnce(path.join(outputDir, "predictions.json"), run);
    await writeJsonOnce(path.join(outputDir, "manifest.json"), manifest);
    console.log(
      JSON.stringify({
        outputDir,
        verses: run.verses.length,
        predictionsSha256: manifest.predictionsSha256,
        durationMs: manifest.durationMs
      })
    );
    break;
  }
  case "freeze": {
    const output = flagValue(args, "--output");
    const seal = flagValue(args, "--acquisition-seal");
    if (!output || !seal) throw new Error(USAGE);
    const policy = policyFromLabels(
      (flagValue(args, "--policy") ?? "")
        .split("")
        .filter((label) => /[A-Z]/u.test(label))
    );
    const freeze: FreezeRecord = {
      frozenAt: new Date().toISOString(),
      policy,
      predictionCode: await predictionCodeHashes(),
      evaluatorCode: Object.fromEntries(
        await Promise.all(
          EVALUATOR_CODE.map(
            async (file) => [file, await fileSha256(file)] as const
          )
        )
      ),
      planSha256: await fileSha256(path.join(OUT_ROOT, "plan.json")),
      acquisitionSeal: { path: seal, sha256: await fileSha256(seal) },
      baselineRuns: Object.fromEntries(
        (
          await readJson<{
            runs: Array<{ runId: string; predictionsSha256: string }>;
          }>(path.join(OUT_ROOT, "initial-predictions.json"))
        ).runs
          .filter((entry) => entry.runId.includes("__test__"))
          .map((entry) => [entry.runId, entry.predictionsSha256])
      ),
      developmentEvidence: flagValue(args, "--evidence") ?? null
    };
    await writeJsonOnce(output, freeze);
    console.log(
      JSON.stringify({ output, sha256: sha256(stableStringify(freeze)) })
    );
    break;
  }
  case "score": {
    const runDir = flagValue(args, "--run");
    if (!runDir) throw new Error(USAGE);
    const { run, sha256: expected } = await readRun(runDir);
    if (run.split === "test") {
      // The reserved test is opened only for a run made with frozen rules.
      const freezePath = flagValue(args, "--freeze");
      if (!freezePath) throw new Error("test-split-requires-freeze");
      const freeze = await readJson<FreezeRecord>(freezePath);
      const manifest = await readJson<{ code: Record<string, string> }>(
        path.join(runDir, "manifest.json")
      );
      const baseline = freeze.baselineRuns[run.runId];
      if (baseline !== undefined) {
        if (baseline !== expected)
          throw new Error("baseline-test-run-hash-differs-from-freeze");
      } else {
        if (
          stableStringify(manifest.code) !==
          stableStringify(freeze.predictionCode)
        )
          throw new Error("test-run-code-differs-from-freeze");
        if (stableStringify(run.policy) !== stableStringify(freeze.policy))
          throw new Error("test-run-policy-differs-from-freeze");
      }
      for (const [file, hash] of Object.entries(freeze.evaluatorCode))
        if ((await fileSha256(file)) !== hash)
          throw new Error(`evaluator-code-changed:${file}`);
    }
    const { report, records } = await scoreRun({
      run,
      expectedSha256: expected
    });
    const outputDir =
      flagValue(args, "--output-dir") ??
      path.join(OUT_ROOT, "scores", SCORE_VERSION, run.runId);
    await writeJsonOnce(path.join(outputDir, "report.json"), report);
    await writeTextOnce(
      path.join(outputDir, "occurrences.jsonl"),
      records.map((record) => JSON.stringify(record)).join("\n") + "\n"
    );
    const occ = report.occurrences?.all;
    console.log(
      JSON.stringify({
        runId: run.runId,
        comparableVerses: report.comparableVerses,
        nonComparable: report.nonComparable.length,
        carrierExactF1: report.carrier.all.carrierExact.f1,
        carrierExactP: report.carrier.all.carrierExact.precision,
        carrierExactR: report.carrier.all.carrierExact.recall,
        occurrenceVisibleP: occ?.visiblePrecisionExact,
        occurrenceVisibleR: occ?.visibleRecallExact,
        unresolvedRate: occ?.unresolvedRate,
        fullyAccountedRate: report.accounting.fullyAccountedRate
      })
    );
    break;
  }
  case "provenance": {
    const output = flagValue(args, "--output");
    const split = flagValue(args, "--split") as
      "development" | "test" | undefined;
    if (!output || (split !== "development" && split !== "test"))
      throw new Error(USAGE);
    const plan = await readJson<ExperimentPlan>(
      path.join(OUT_ROOT, "plan.json")
    );
    const chapters = plan[split].map((entry) => entry.chapter);
    const allChapters = [...plan.development, ...plan.test].map(
      (entry) => entry.chapter
    );
    const result = {
      generatedAt: new Date().toISOString(),
      split,
      witnessSnapshots: [
        await compareWitnessSnapshot({
          witness: "Sg1910",
          chapters: ["Exod.10", "Ps.43", "Matt.5", "Rom.1"]
        }),
        await compareWitnessSnapshot({
          witness: "Darby",
          chapters: ["Exod.10", "Matt.5"]
        })
      ],
      textProximity: await editorialTextProximity(allChapters),
      transferability: [
        await referenceTransferability({ edition: "SG21", chapters }),
        await referenceTransferability({ edition: "NEG", chapters })
      ]
    };
    await writeJsonOnce(output, result);
    console.log(JSON.stringify(result, null, 1).slice(0, 6000));
    break;
  }
  case "report": {
    const outputDir = flagValue(args, "--output-dir");
    const split = flagValue(args, "--split");
    if (!outputDir || !split) throw new Error(USAGE);
    const root = path.join(OUT_ROOT, "scores", SCORE_VERSION);
    const reports = (await readReports(root)).filter(
      (report) => report.split === split
    );
    const rows = reports
      .map(summaryRow)
      .sort(
        (left, right) =>
          left.edition.localeCompare(right.edition) ||
          left.scenario.localeCompare(right.scenario) ||
          left.profile.localeCompare(right.profile) ||
          left.policy.localeCompare(right.policy)
      );
    const categories: Record<string, Record<string, number>> = {};
    for (const report of reports) {
      const file = path.join(root, report.runId, "occurrences.jsonl");
      const text = await import("node:fs/promises").then((fs) =>
        fs.readFile(file, "utf8")
      );
      const records = text
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line) as OccurrenceRecord);
      if (records.length) categories[report.runId] = categoryCounts(records);
    }
    await writeJsonOnce(path.join(outputDir, "summary.json"), {
      generatedAt: new Date().toISOString(),
      scoreVersion: SCORE_VERSION,
      split,
      rows,
      categories,
      reports: Object.fromEntries(
        reports.map((report) => [
          report.runId,
          {
            byTestament:
              report.occurrences?.byTestament ?? report.carrier.byTestament,
            byGenre: report.occurrences?.byGenre ?? report.carrier.byGenre,
            byDifficulty: report.occurrences?.byDifficulty ?? null,
            carrierByTestament: report.carrier.byTestament,
            carrierByGenre: report.carrier.byGenre,
            nonComparable: report.nonComparable
          }
        ])
      )
    });
    await writeTextOnce(
      path.join(outputDir, "summary.md"),
      `${markdownTable(rows)}\n`
    );
    console.log(markdownTable(rows));
    break;
  }
  case "sample": {
    const runDir = flagValue(args, "--run");
    const output = flagValue(args, "--output");
    if (!runDir || !output) throw new Error(USAGE);
    const { run } = await readRun(runDir);
    // Test disagreements are only examined after the freeze, to interpret the
    // final result; the engine is no longer changed afterwards.
    if (run.split !== "development") {
      const freezePath = flagValue(args, "--freeze");
      if (!freezePath) throw new Error("review-sample-test-requires-freeze");
      await readJson<FreezeRecord>(freezePath);
    }
    const scoreDir = path.join(OUT_ROOT, "scores", SCORE_VERSION, run.runId);
    const records = (
      await import("node:fs/promises").then((fs) =>
        fs.readFile(path.join(scoreDir, "occurrences.jsonl"), "utf8")
      )
    )
      .split("\n")
      .filter(Boolean)
      .map((line) => JSON.parse(line) as OccurrenceRecord);
    const packets = await buildReviewPackets({
      run,
      records,
      seed: flagValue(args, "--seed") ?? "strong-concordance-review-2026-10-01",
      perCategory: Number(flagValue(args, "--per-category") ?? 8)
    });
    await writeJsonOnce(output, { runId: run.runId, packets });
    console.log(JSON.stringify({ output, packets: packets.length }));
    break;
  }
  default:
    throw new Error(USAGE);
}
