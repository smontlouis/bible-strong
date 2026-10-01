import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  excludedReferenceNamesForGold,
  extractGoldCarrierPlacements
} from "../../src/evaluateStrongGold.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import {
  intersectAnchors,
  resolveOccurrence,
  sourceNeighborAnchor,
  witnessNeighborAnchor,
  type AnchorProposal,
  type ResolutionCarrier,
  type ResolutionUnit,
  type ResolutionWitness
} from "../../src/strongResolution.js";
import { withoutPublisherNotes } from "../strong-arbitration-benchmark/reader-text.js";
import {
  sha,
  GOLDS,
  type BaselineVerse,
  type EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import type { SourceUnit } from "../strong-occurrence-prototype/model.js";

const archive = path.resolve(process.argv[2]);
const modelRoot = path.resolve(process.argv[3]);
const output = path.resolve(process.argv[4]);
const inputHashes: Record<string, string> = {};
async function read(file: string, expected?: string) {
  const content = await readFile(file, "utf8");
  const hash = sha(content);
  if (expected) assert.equal(hash, expected, `input-drift:${file}`);
  inputHashes[file] = hash;
  return content;
}
const manifest = JSON.parse(await read(path.join(archive, "manifest.json")));
const rows: Array<{ gold: string; verse: EvalVerse; baseline: BaselineVerse }> =
  JSON.parse(
    await read(path.join(archive, "verses.json"), manifest.files["verses.json"])
  );
const plan = JSON.parse(
  await read(
    path.join(manifest.sourceRoot, "plan.json"),
    manifest.inputs["plan.json"]
  )
);
const models: Array<{ ref: string; units: SourceUnit[] }> = JSON.parse(
  await read(path.join(modelRoot, "source-units.json"))
);
const reserve = new Set<string>(plan.reserveRefs);
assert.equal(reserve.size, 100);
assert.equal(rows.length, 720);
assert(rows.every((r) => !reserve.has(r.verse.ref)));
for (const input of plan.sources as Array<{ file: string; sha256: string }>)
  await read(input.file, input.sha256);
const witnessRows = new Map<
  string,
  Map<string, { wordCount: number; placements: ResolutionCarrier[] }>
>();
for (const gold of GOLDS) {
  const file = `data/strongs/${gold}.csv`;
  await read(
    file,
    plan.manifests.find((m: { gold: string }) => m.gold === gold).goldSha256
  );
  const csv = buildStrongVerseMap(await readStrongCsv(file));
  witnessRows.set(
    gold,
    new Map(
      rows
        .filter((r) => r.gold === gold)
        .map((r) => [
          r.verse.ref,
          {
            wordCount: r.verse.words.length,
            placements: extractGoldCarrierPlacements(
              withoutPublisherNotes(csv.get(r.verse.ref)!.row.text)
            ).map((p, i) => ({ ...p, id: `${gold}:${r.verse.ref}:${i}` }))
          }
        ])
    )
  );
}

function ratioAnchor(
  strong: string,
  witnesses: ResolutionWitness[],
  ref: string,
  wordCount: number
) {
  const familyRatios = new Map<string, { leading: boolean; ratio: number }>();
  for (const w of witnesses) {
    const found = w.placements.filter((p) => p.strong === strong);
    if (
      found.length !== 1 ||
      found[0].kind !== "empty" ||
      familyRatios.has(w.family)
    )
      continue;
    const n = witnessRows.get(w.name)!.get(ref)!.wordCount;
    familyRatios.set(w.family, {
      leading: found[0].insertAfterWordIndex! < 0,
      ratio: n <= 1 ? 0 : found[0].insertAfterWordIndex! / (n - 1)
    });
  }
  const values = [...familyRatios.values()];
  if (!values.length) return undefined;
  return values.every((v) => v.leading)
    ? -1
    : Math.min(
        wordCount - 1,
        Math.max(
          -1,
          Math.round(
            (values.reduce((n, v) => n + v.ratio, 0) / values.length) *
              (wordCount - 1)
          )
        )
      );
}
const uncertainIdentity = (): AnchorProposal => ({
  status: "unresolved",
  method: "witness-neighbors",
  neighbors: [],
  families: [],
  reasons: ["unresolved-tagging-or-occurrence-correspondence"]
});

// Predict from other editorial families only. The evaluated family is never passed
// to a resolver or anchoring function. No independent semantic reviews exist yet.
const predictions = rows.map((row) => {
  const excluded = excludedReferenceNamesForGold(
    row.gold as (typeof GOLDS)[number],
    false
  );
  const witnesses: ResolutionWitness[] = GOLDS.filter(
    (g) => !excluded.includes(g)
  ).map((gold) => ({
    name: gold,
    family: gold === "Sg1910" ? gold : "Darby-family",
    placements: witnessRows.get(gold)!.get(row.verse.ref)!.placements
  }));
  assert(
    witnesses.every((w) => !excluded.includes(w.name as (typeof GOLDS)[number]))
  );
  const model = models.find((m) => m.ref === row.verse.ref)!;
  assert(model);
  const units: ResolutionUnit[] = model.units.map((u) => ({
    id: u.id,
    occurrenceIds: u.occurrenceIds,
    strong: u.logicalStrong,
    readingUnresolved: u.structure === "variant-conditioned",
    sourceEvidenceSha256: sha(JSON.stringify(u.row))
  }));
  assert.deepEqual(
    units.flatMap((u) => u.occurrenceIds),
    row.verse.source.map((s) => s.occurrenceId)
  );
  const before = JSON.stringify(row.baseline.placements);
  const dispositions = units.map((unit) => {
    const source = sourceNeighborAnchor(
      unit,
      units,
      row.baseline.placements,
      row.verse.words.length
    );
    const identifiable =
      !unit.readingUnresolved &&
      unit.strong.length === 1 &&
      units.filter((u) => u.strong.includes(unit.strong[0])).length === 1;
    const neighbor = identifiable
      ? witnessNeighborAnchor(
          unit.strong[0],
          witnesses,
          row.baseline.placements,
          row.verse.words.length
        )
      : uncertainIdentity();
    const combined = intersectAnchors([neighbor, source]);
    const input = {
      ref: row.verse.ref,
      text: row.verse.text,
      wordCount: row.verse.words.length,
      unit,
      placements: row.baseline.placements,
      witnesses,
      anchor: combined
    };
    const resolution = resolveOccurrence(input);
    assert.deepEqual(resolution, resolveOccurrence(input));
    const existingVisible = row.baseline.placements.some(
      (p) =>
        p.kind !== "empty" &&
        p.originalOccurrenceId &&
        unit.occurrenceIds.includes(p.originalOccurrenceId)
    );
    const nominatedEmpty =
      identifiable &&
      !existingVisible &&
      witnesses.some((w) => {
        const same = w.placements.filter((p) => p.strong === unit.strong[0]);
        return same.length === 1 && same[0].kind === "empty";
      });
    return {
      unit,
      resolution,
      nominatedEmpty,
      anchors: {
        ratio: identifiable
          ? ratioAnchor(
              unit.strong[0],
              witnesses,
              row.verse.ref,
              row.verse.words.length
            )
          : undefined,
        neighbor,
        source,
        combined
      }
    };
  });
  assert.equal(JSON.stringify(row.baseline.placements), before);
  return {
    gold: row.gold,
    ref: row.verse.ref,
    split: row.verse.split,
    text: row.verse.text,
    words: row.verse.words,
    witnessNames: witnesses.map((w) => w.name),
    excludedFamilies: excluded,
    dispositions,
    fullyReviewedTranslation: dispositions.every(
      (d) => d.resolution.assurance === "reviewed"
    ),
    operationallyCovered: dispositions.every(
      (d) => d.resolution.state !== "unresolved"
    )
  };
});

await mkdir(path.dirname(output), { recursive: true });
await mkdir(output, { recursive: false });
async function save(file: string, value: unknown) {
  const content = JSON.stringify(value, null, 2) + "\n";
  await writeFile(path.join(output, file), content, { flag: "wx" });
  return sha(content);
}
const predictionsSha256 = await save("predictions.json", predictions);
const codeHashes = Object.fromEntries(
  await Promise.all(
    ["../../src/strongResolution.ts", "./run.ts"].map(async (f) => [
      f,
      sha(await readFile(new URL(f, import.meta.url)))
    ])
  )
);
await save("manifest.json", {
  inputHashes,
  codeHashes,
  predictionsSha256,
  hypotheses: [
    "separate-absence-from-anchor-evidence",
    "witness-neighbor-anchors",
    "source-order-cross-check"
  ],
  modelCalls: 0,
  reservedPassages: 100,
  reviewedSemanticDecisions: 0,
  protocol:
    "Exploratory existing-corpus evaluation. Target and sister edition labels excluded from every prediction. Predictions frozen before target scoring. Witness tags measure editorial agreement, not established semantic absence. No automatic carrier changes."
});

// Target labels are used only below, after freezing all decisions and proposals.
const evaluated = predictions.flatMap((row) =>
  row.dispositions.map((d) => {
    const target = witnessRows
      .get(row.gold)!
      .get(row.ref)!
      .placements.filter((p) => d.unit.strong.includes(p.strong));
    const targetLabel =
      d.unit.strong.length === 1 &&
      row.dispositions.filter((x) => x.unit.strong.includes(d.unit.strong[0]))
        .length === 1 &&
      target.length === 1
        ? target[0]
        : undefined;
    return {
      gold: row.gold,
      ref: row.ref,
      split: row.split,
      ...d,
      targetLabel
    };
  })
);
function anchorScores(cases: typeof evaluated) {
  return ["ratio", "neighbor", "source", "combined"].map((method) => {
    let eligibleEmpty = 0,
      proposed = 0,
      exact = 0,
      contradictedVisible = 0,
      unlabeled = 0,
      proposedIntervals = 0,
      expectedAnchorInInterval = 0,
      totalIntervalWidth = 0;
    for (const c of cases.filter((c) => c.nominatedEmpty)) {
      const anchor = c.anchors[method as keyof typeof c.anchors];
      const after =
        typeof anchor === "number" ? anchor : anchor?.insertAfterWordIndex;
      if (!c.targetLabel) {
        unlabeled++;
        continue;
      }
      if (c.targetLabel.kind !== "empty") {
        if (after !== undefined) contradictedVisible++;
        continue;
      }
      eligibleEmpty++;
      const interval =
        typeof anchor === "number" ? [anchor, anchor] : anchor?.interval;
      if (interval) {
        proposedIntervals++;
        totalIntervalWidth += interval[1] - interval[0] + 1;
        expectedAnchorInInterval += Number(
          c.targetLabel.insertAfterWordIndex! >= interval[0] &&
            c.targetLabel.insertAfterWordIndex! <= interval[1]
        );
      }
      if (after !== undefined) {
        proposed++;
        exact += Number(after === c.targetLabel.insertAfterWordIndex);
      }
    }
    return {
      method,
      eligibleEmpty,
      proposed,
      exact,
      exactRate: proposed ? exact / proposed : null,
      contradictedVisible,
      unlabeled,
      proposedIntervals,
      expectedAnchorInInterval,
      meanIntervalWidth: proposedIntervals
        ? totalIntervalWidth / proposedIntervals
        : null
    };
  });
}
const countBy = (values: string[]) =>
  values.reduce<Record<string, number>>((out, key) => {
    out[key] = (out[key] ?? 0) + 1;
    return out;
  }, {});
const summary = {
  texts: predictions.length,
  sourceUnitsAcrossEditions: evaluated.length,
  modelCalls: 0,
  reservedPassages: 100,
  states: countBy(
    evaluated.map((c) => `${c.resolution.state}:${c.resolution.assurance}`)
  ),
  fullyReviewedVerses: predictions.filter((r) => r.fullyReviewedTranslation)
    .length,
  operationallyCoveredVerses: predictions.filter((r) => r.operationallyCovered)
    .length,
  nominatedEmpty: evaluated.filter((c) => c.nominatedEmpty).length,
  nominationTargetLabels: countBy(
    evaluated
      .filter((c) => c.nominatedEmpty)
      .map((c) =>
        c.targetLabel
          ? c.targetLabel.kind === "empty"
            ? "explicit-empty"
            : "visible"
          : "unscorable"
      )
  ),
  nominationsByIndependentFamilyCount: countBy(
    evaluated
      .filter((c) => c.nominatedEmpty)
      .map((c) => String(c.resolution.emptyWitnessFamilies.length))
  ),
  anchorEvaluation: ["calibration", "test"].map((split) => ({
    split,
    results: anchorScores(evaluated.filter((c) => c.split === split))
  })),
  unresolvedReasons: countBy(
    evaluated
      .filter((c) => c.resolution.state === "unresolved")
      .flatMap((c) => c.resolution.reasons)
  ),
  policy:
    "No automatic empty certification or new default anchoring policy. Existing visible carriers and rendered empties unchanged."
};
await save("summary.json", summary);
await save(
  "empty-proposals-for-audit.json",
  evaluated.filter((c) => c.nominatedEmpty)
);
console.log(JSON.stringify(summary, null, 2));
