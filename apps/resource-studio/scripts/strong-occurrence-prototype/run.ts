import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  extractGoldCarrierPlacements,
  scoreCarrierAwareVerse,
  type CarrierPlacement
} from "../../src/evaluateStrongGold.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../strong-arbitration-benchmark/reader-text.js";
import {
  applyChoices,
  type Case,
  type Request,
  type Result
} from "../strong-arbitration-benchmark/core.js";
import {
  carrierKey,
  sha,
  GOLDS,
  type BaselineVerse,
  type EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import {
  makeUnits,
  parseSourceRow,
  validateRelation,
  type SourceRow
} from "./model.js";
import { owners, replay, span } from "./replay.js";
import { identityEvidence, readIdentityEvidence } from "./identity-evidence.js";

const root = path.resolve(process.argv[2]);
const output = path.resolve(process.argv[3]);
assert(root !== output);
const inputs: Record<string, string> = {};
async function read(file: string, hash?: string) {
  const content = await readFile(file, "utf8");
  if (hash) assert.equal(sha(content), hash, `input-drift:${file}`);
  inputs[file] = sha(content);
  return content;
}
const manifest = JSON.parse(await read(path.join(root, "manifest.json")));
const frozen = (file: string) =>
  read(path.join(root, file), manifest.files[file]);
const rows: Array<{ gold: string; verse: EvalVerse; baseline: BaselineVerse }> =
  JSON.parse(await frozen("verses.json"));
const cases: Case[] = JSON.parse(await frozen("cases.json"));
const requests: Request[] = (await frozen("requests.jsonl"))
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
const requestMap = new Map(requests.map((r) => [r.id, r]));
const meta = JSON.parse(await read(path.join(root, "jev-base.meta.json")));
const results: Result[] = (
  await read(path.join(root, "jev-base.jsonl"), meta.outputSha256)
)
  .trim()
  .split("\n")
  .map((l) => JSON.parse(l));
assert.equal(results.length, cases.length * 3);
assert.equal(new Set(results.map((r) => r.id)).size, results.length);
for (const r of results) {
  const request = requestMap.get(r.id);
  assert(request);
  assert.equal(r.requestSha256, sha(JSON.stringify(request)));
  if (r.status === "ok") {
    assert(r.choice && request.questions.placement.criteria[r.choice]);
    assert(
      Number.isFinite(r.probability) &&
        r.probability! >= 0 &&
        r.probability! <= 1
    );
  }
}
const resultMap = new Map(results.map((r) => [r.id, r]));
// Verify the entire frozen input chain, not only copied cases and predictions.
for (const [file, hash] of Object.entries(manifest.inputs))
  await read(path.join(manifest.sourceRoot, file), hash as string);
const plan = JSON.parse(
  await read(path.join(manifest.sourceRoot, "plan.json"))
);
assert.equal(plan.textPolicy, "exclude-publisher-notes-v1");
assert.equal(
  sha(
    await readFile(
      new URL("../strong-arbitration-benchmark/reader-text.ts", import.meta.url)
    )
  ),
  plan.readerTextSha256
);
const reserve = new Set<string>(plan.reserveRefs);
assert.equal(reserve.size, 100);
assert(rows.every((r) => !reserve.has(r.verse.ref)));
assert(
  cases.every((c) =>
    rows.some((r) => r.gold === c.gold && r.verse.ref === c.ref)
  )
);
const requiredIds = new Set(
  rows.flatMap((r) => r.verse.source.map((s) => s.sourceIdentity!))
);
const sourceRows = new Map<string, SourceRow>();
for (const source of plan.sources as Array<{ file: string; sha256: string }>) {
  const lines = (await read(source.file, source.sha256)).split(/\r?\n/u);
  for (const [i, line] of lines.entries()) {
    const row = parseSourceRow(line, source.file, i + 1);
    if (!row || !requiredIds.has(row.id)) continue;
    assert(!sourceRows.has(row.id), `duplicate-source-row:${row.id}`);
    sourceRows.set(row.id, row);
  }
}
assert.equal(sourceRows.size, requiredIds.size);
const withUnits = rows.map((r) => ({
  ...r,
  units: makeUnits(r.verse, sourceRows),
  cases: cases.filter((c) => c.gold === r.gold && c.ref === r.verse.ref)
}));
const lexiconFile = "data/external/stepbible/TBESG.txt";
const lexiconIdentityIndex = readIdentityEvidence(
  await read(lexiconFile),
  lexiconFile
);
const identityAudits = withUnits
  .filter((r) => r.gold === "Sg1910")
  .map((r) => ({
    ref: r.verse.ref,
    identities: identityEvidence(r.units, lexiconIdentityIndex)
  }));
const threshold = 0.95;
const predictions = withUnits.map((r) => {
  const before = JSON.stringify([r.baseline, r.cases, r.units]);
  const guard = replay(
    r.baseline,
    r.cases,
    resultMap,
    r.units,
    "guard",
    threshold
  );
  const primary = replay(
    r.baseline,
    r.cases,
    resultMap,
    r.units,
    "source-primary",
    threshold
  );
  for (const relation of [...guard.relations, ...primary.relations])
    validateRelation(relation, r.units, r.verse.words.length);
  // A second replay must be byte-identical and may not mutate the inputs.
  assert.deepEqual(
    guard,
    replay(r.baseline, r.cases, resultMap, r.units, "guard", threshold)
  );
  assert.deepEqual(
    primary,
    replay(r.baseline, r.cases, resultMap, r.units, "source-primary", threshold)
  );
  assert.equal(JSON.stringify([r.baseline, r.cases, r.units]), before);
  return {
    gold: r.gold,
    ref: r.verse.ref,
    split: r.verse.split,
    archive: applyChoices(r.baseline, r.cases, resultMap, "context", threshold),
    guard,
    primary
  };
});
const codeHashes: Record<string, string> = {};
for (const file of ["model.ts", "replay.ts", "run.ts", "identity-evidence.ts"])
  codeHashes[file] = sha(await readFile(new URL(`./${file}`, import.meta.url)));
codeHashes["archive-core.ts"] = sha(
  await readFile(
    new URL("../strong-arbitration-benchmark/core.ts", import.meta.url)
  )
);
assert.equal(codeHashes["archive-core.ts"], manifest.sourceSha256["core.ts"]);
// Freeze predictions BEFORE reading labels. Existing test chapters are exploratory,
// and the threshold is inherited, not tuned in this experiment.
await mkdir(output, { recursive: false });
const save = async (file: string, value: unknown) => {
  const text = JSON.stringify(value, null, 2) + "\n";
  await writeFile(path.join(output, file), text, { flag: "wx" });
  return sha(text);
};
const predictionsSha256 = await save("predictions.json", predictions);
await save(
  "source-units.json",
  withUnits
    .filter((r) => r.gold === "Sg1910")
    .map((r) => ({ ref: r.verse.ref, units: r.units }))
);
await save("manifest.json", {
  version: "physical-occurrences-v1",
  inputs,
  codeHashes,
  threshold,
  predictionsSha256,
  freshModelCalls: 0,
  reservedPassages: reserve.size,
  protocol:
    "Post-hoc exploratory replay on the existing 240 references / 720 edition texts; no new blind test. Guard defers unresolved display identity; primary chooses the source code and deduplicates identical existing carriers. No probability pooling. Reserve excluded."
});
await save("identity-evidence.json", identityAudits);

// Labels enter only the assessment below. The legacy exact metric is unchanged.
const labels = new Map<string, Record<string, CarrierPlacement[]>>();
for (const gold of GOLDS) {
  const csvPath = `data/strongs/${gold}.csv`;
  await read(
    csvPath,
    plan.manifests.find((m: { gold: string }) => m.gold === gold).goldSha256
  );
  const csv = buildStrongVerseMap(await readStrongCsv(csvPath));
  const expected = JSON.parse(
    await read(path.join(manifest.sourceRoot, gold, "expected.json"))
  );
  for (const r of rows.filter((r) => r.gold === gold))
    assert.deepEqual(
      expected[r.verse.ref],
      extractGoldCarrierPlacements(
        withoutPublisherNotes(csv.get(r.verse.ref)!.row.text)
      )
    );
  labels.set(gold, expected);
}
function visibleKeys(ps: CarrierPlacement[]) {
  return ps.filter((p) => p.kind !== "empty").map(carrierKey);
}
function counts(keys: string[]) {
  const result = new Map<string, number>();
  for (const key of keys) result.set(key, (result.get(key) ?? 0) + 1);
  return result;
}
const modes = ["baseline", "archive", "guard", "primary"] as const;
const audits: unknown[] = [];
const summary = ["calibration", "test"].map((split) => ({
  split,
  modes: modes.map((mode) => {
    let tp = 0,
      fp = 0,
      fn = 0,
      addedOrMoved = 0,
      correct = 0,
      deletions = 0,
      incorrectDeletions = 0,
      lostCorrectCarriers = 0;
    const events: Record<string, number> = {};
    for (const [i, row] of withUnits.entries()) {
      if (row.verse.split !== split) continue;
      const out =
        mode === "baseline"
          ? { placements: row.baseline.placements, events: [] }
          : predictions[i][mode];
      const expected = labels.get(row.gold)![row.verse.ref];
      const expectedKeys = counts(visibleKeys(expected));
      const beforeKeys = counts(visibleKeys(row.baseline.placements));
      const afterKeys = counts(visibleKeys(out.placements));
      const metric = scoreCarrierAwareVerse(
        row.verse.ref,
        out.placements,
        expected
      ).visibleCarrierExact;
      tp += metric.truePositive;
      fp += metric.falsePositive;
      fn += metric.falseNegative;
      for (const [key, n] of expectedKeys)
        lostCorrectCarriers += Math.max(
          0,
          Math.min(n, beforeKeys.get(key) ?? 0) -
            Math.min(n, afterKeys.get(key) ?? 0)
        );
      const added = out.placements.filter(
        (p) =>
          p.kind !== "empty" &&
          !row.baseline.placements.some(
            (b) => b.id === p.id && carrierKey(b) === carrierKey(p)
          )
      );
      const deleted = row.baseline.placements.filter(
        (p) => p.kind !== "empty" && !out.placements.some((a) => a.id === p.id)
      );
      addedOrMoved += added.length;
      correct += added.filter((p) => expectedKeys.has(carrierKey(p))).length;
      deletions += deleted.length;
      incorrectDeletions += deleted.filter((p) =>
        expectedKeys.has(carrierKey(p))
      ).length;
      if (mode === "guard" || mode === "primary")
        for (const event of predictions[i][mode].events)
          events[event.kind] = (events[event.kind] ?? 0) + 1;
      if (added.length || deleted.length)
        audits.push({
          mode,
          split,
          gold: row.gold,
          ref: row.verse.ref,
          text: row.verse.text,
          added: added.map((p) => ({
            ...p,
            correct: expectedKeys.has(carrierKey(p))
          })),
          deleted: deleted.map((p) => ({
            ...p,
            matchedLegacyGold: expectedKeys.has(carrierKey(p))
          }))
        });
    }
    return {
      mode,
      metrics: {
        tp,
        fp,
        fn,
        precision: tp / (tp + fp),
        recall: tp / (tp + fn),
        f1: (2 * tp) / (2 * tp + fp + fn)
      },
      edits: {
        addedOrMoved,
        correct,
        precision: addedOrMoved ? correct / addedOrMoved : null,
        deletions,
        incorrectDeletions,
        lostCorrectCarriers
      },
      events
    };
  })
}));
const structureCounts: Record<string, number> = {};
const distinctUnits = withUnits
  .filter((r) => r.gold === "Sg1910")
  .flatMap((r) => r.units);
for (const u of distinctUnits)
  structureCounts[u.structure] = (structureCounts[u.structure] ?? 0) + 1;
const ownership = withUnits.flatMap((r) =>
  r.units
    .filter((u) => u.logicalStrong.length > 1)
    .map((u) => {
      const placed = owners(u, r.baseline.placements);
      return {
        gold: r.gold,
        ref: r.verse.ref,
        unitId: u.id,
        structure: u.structure,
        strong: u.logicalStrong,
        visibleOwners: placed,
        identicalCarrier:
          placed.length > 1 && new Set(placed.map(span)).size === 1,
        logicalWithoutVisibleCarrier: u.occurrenceIds.filter(
          (id) => !placed.some((p) => p.originalOccurrenceId === id)
        ),
        sampledMissing: r.cases
          .filter(
            (c) =>
              c.category === "missing" &&
              u.occurrenceIds.includes(c.occurrenceId)
          )
          .map((c) => c.id)
      };
    })
);
const diagnostic = {
  identityEvidenceCounts: identityAudits
    .flatMap((r) => r.identities)
    .reduce<Record<string, number>>((counts, item) => {
      counts[item.status] = (counts[item.status] ?? 0) + 1;
      return counts;
    }, {}),
  distinctPhysicalRows: sourceRows.size,
  logicalOccurrencesPerEdition: withUnits[0]
    ? rows
        .filter((r) => r.gold === "Sg1910")
        .reduce((n, r) => n + r.verse.source.length, 0)
    : 0,
  structureCounts,
  multiIdentityPhysicalRows: distinctUnits.filter(
    (u) => u.logicalStrong.length > 1
  ).length,
  editionGroups: ownership.length,
  groupsWithMultipleVisibleOwners: ownership.filter(
    (g) => g.visibleOwners.length > 1
  ).length,
  groupsWithIdenticalVisibleCarriers: ownership.filter(
    (g) => g.identicalCarrier
  ).length,
  missingLogicalIdentitiesOnAlreadyPlacedUnits: ownership
    .filter((g) => g.visibleOwners.length)
    .reduce((n, g) => n + g.logicalWithoutVisibleCarrier.length, 0),
  eligibleMissingLogicalIdentitiesOnAlreadyPlacedUnits: ownership
    .filter(
      (g) => g.visibleOwners.length && g.structure === "single-row-alternatives"
    )
    .reduce((n, g) => n + g.logicalWithoutVisibleCarrier.length, 0),
  sampledMissingOnAlreadyPlacedUnits: ownership
    .filter((g) => g.visibleOwners.length)
    .reduce((n, g) => n + g.sampledMissing.length, 0),
  sampledEligibleMissingOnAlreadyPlacedUnits: ownership
    .filter(
      (g) => g.visibleOwners.length && g.structure === "single-row-alternatives"
    )
    .reduce((n, g) => n + g.sampledMissing.length, 0)
};
await save("ownership-audit.json", ownership);
await save("changes.json", audits);
await save("summary.json", {
  threshold,
  freshModelCalls: 0,
  reservedPassages: 100,
  diagnostic,
  splits: summary
});
await save("label-verification.json", {
  files: Object.fromEntries(
    Object.entries(inputs).filter(
      ([file]) =>
        file.includes("expected.json") || file.includes("data/strongs/")
    )
  )
});
console.log(JSON.stringify({ output, diagnostic, splits: summary }, null, 2));
