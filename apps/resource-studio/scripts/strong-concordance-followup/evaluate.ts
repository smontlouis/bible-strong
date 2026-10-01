/** Evaluation process only. No label is passed to the predictor. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import {
  sha,
  type GoldVerse,
  type Prediction,
  type Plan
} from "../strong-concordance-night/contract.js";
import { scoreVerse, aggregate } from "../strong-concordance-night/score.js";
import { scoreConjoinIdentity } from "./identity.js";
import type { SourceRow } from "../../src/strongSourceUnits.js";

const [rootArg, edition, scenario, split, variant] = process.argv.slice(2);
assert(rootArg && ["development", "test"].includes(split));
const root = path.resolve(rootArg);
const preparedContent = await readFile(
  path.join(root, "prepared-inputs.json"),
  "utf8"
);
const prepared = JSON.parse(preparedContent);
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "followup-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `frozen-code-drift:${file}`);
  assert.equal(sha(preparedContent), freeze.preparedInputsSha256);
  assert.equal(
    sha(await readFile(path.join(root, "plan.json"))),
    freeze.planSha256
  );
}
const directory = path.join(
  root,
  "followup",
  `${edition}-${scenario}-${split}-${variant}`
);
const content = await readFile(
  path.join(directory, "predictions.json"),
  "utf8"
);
const receipt = JSON.parse(
  await readFile(path.join(directory, "receipt.json"), "utf8")
);
assert.equal(sha(content), receipt.predictionsSha256);
const sourceContent = await readFile(
  path.join(root, receipt.sourceRowsFile),
  "utf8"
);
assert.equal(sha(sourceContent), receipt.sourceRowsFileSha256);
const sourceRows = new Map<string, SourceRow>(JSON.parse(sourceContent));
const predictions: Prediction[] = JSON.parse(content);
const rawContent = await readFile(
  path.join(
    root,
    "baseline",
    `${edition}-${scenario}-${split}`,
    "predictions.json"
  ),
  "utf8"
);
assert.equal(
  sha(rawContent),
  receipt.canonicalBaselineSha256,
  "identity-basis-drift"
);
const raw: Prediction[] = JSON.parse(rawContent);
const rawByRef = new Map(raw.map((v) => [v.ref, v]));
let gold: GoldVerse[];
if (["SG21", "NEG"].includes(edition)) {
  const file = path.join(
    root,
    "evaluator-only",
    `${edition}-${split}.gold.json`
  );
  const text = await readFile(file, "utf8");
  assert.equal(
    sha(text),
    prepared.files[path.relative(root, file)],
    "target-label-drift"
  );
  gold = JSON.parse(text);
} else {
  const refs = new Set(predictions.map((v) => v.ref));
  const file = path.join(
    root,
    "environments/target-excluded/data/strongs",
    `${edition}.csv`
  );
  assert.equal(
    sha(await readFile(file)),
    prepared.files[path.relative(root, file)],
    "local-gold-drift"
  );
  gold = (await readStrongCsv(file))
    .filter((r) => refs.has(`${r.bookId}.${r.chapter}.${r.verse}`))
    .map((r) => {
      const tagged = withoutPublisherNotes(r.text);
      return {
        ref: `${r.bookId}.${r.chapter}.${r.verse}`,
        text: stripTags(tagged).replace(/◎/gu, "").replace(/\s+/gu, " ").trim(),
        placements: extractGoldCarrierPlacements(tagged).map((p, i) => ({
          ...p,
          id: `csv:${i}`
        })),
        diagnostics: []
      };
    });
}
assert.equal(gold.length, predictions.length);
const goldByRef = new Map(gold.map((g) => [g.ref, g]));
const rows = predictions
  .filter((v) => !goldByRef.get(v.ref)!.diagnostics.length)
  .map((v) => {
    const initial = rawByRef.get(v.ref)!;
    const oldFlags = new Map(
      initial.units.map((u) => [u.sourceUnitId, u.source.readingUnresolved])
    );
    // Identity eligibility and difficulty strata are fixed from the original
    // source interpretation. A recovery must not make its own denominator easier.
    const fixedEligibility = {
      ...v,
      units: v.units.map((u) => ({
        ...u,
        source: {
          ...u.source,
          readingUnresolved: oldFlags.get(u.sourceUnitId)!
        }
      }))
    };
    const scored = scoreVerse(fixedEligibility, goldByRef.get(v.ref)!);
    const conjoin = scoreConjoinIdentity(
      initial,
      v,
      goldByRef.get(v.ref)!,
      sourceRows
    );
    scored.metrics.conjoinIdentityExact = conjoin.metric;
    return {
      ...scored,
      conjoinComparableOwners: conjoin.comparableSourceOwners,
      conjoinCorrectCarriers: conjoin.matchedCarriers
    };
  });
const plan: Plan = JSON.parse(
  await readFile(path.join(root, "plan.json"), "utf8")
);
const testament = (ref: string) =>
  BOOK_IDS.indexOf(ref.split(".")[0] as never) < 39 ? "OT" : "NT";
const genre = (ref: string) =>
  plan.chapters.find((c) => c.ref === ref.split(".").slice(0, 2).join("."))!
    .genre;
const report = {
  edition,
  scenario,
  split,
  variant,
  predictionsSha256: sha(content),
  identityEligibility: "fixed-from-sealed-canonical-baseline-for-all-policies",
  total: aggregate(rows),
  excludedNonComparable: gold
    .filter((g) => g.diagnostics.length)
    .map((g) => ({ ref: g.ref, reasons: g.diagnostics })),
  byTestament: Object.fromEntries(
    ["OT", "NT"].map((t) => [
      t,
      aggregate(rows.filter((r) => testament(r.ref) === t))
    ])
  ),
  byGenre: Object.fromEntries(
    [...new Set(rows.map((r) => genre(r.ref)))].map((g) => [
      g,
      aggregate(rows.filter((r) => genre(r.ref) === g))
    ])
  ),
  byDifficulty: Object.fromEntries(
    [...new Set(rows.flatMap((r) => r.difficulties))].map((d) => [
      d,
      aggregate(rows.filter((r) => r.difficulties.includes(d)))
    ])
  )
};
const output = path.join(
  root,
  "evaluation-followup",
  `${edition}-${scenario}-${split}-${variant}`
);
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "summary.json"),
  JSON.stringify(report, null, 2) + "\n"
);
await writeFile(path.join(output, "verses.json"), JSON.stringify(rows) + "\n");
console.log(
  JSON.stringify({ edition, scenario, split, variant, ...report.total })
);
