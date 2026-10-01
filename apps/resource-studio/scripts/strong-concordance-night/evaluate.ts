/** Evaluator-only process. Baselines are sealed before reading target labels. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { sha, type GoldVerse, type Plan, type Prediction } from "./contract.js";
import { aggregate, scoreVerse } from "./score.js";

const [rootArg, edition, scenario, split, variant = "baseline"] =
  process.argv.slice(2);
const root = path.resolve(rootArg);
assert(["development", "test"].includes(split));
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "rule-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `rule-drift:${file}`);
  assert.equal(
    sha(await readFile(path.join(root, "plan.json"))),
    freeze.planSha256
  );
  assert.equal(
    sha(await readFile(path.join(root, "prepared-inputs.json"))),
    freeze.preparedInputsSha256
  );
}
const dir = path.join(
  root,
  variant === "baseline" ? "baseline" : "variants",
  `${edition}-${scenario}-${split}${variant === "baseline" ? "" : `-${variant}`}`
);
const raw = await readFile(path.join(dir, "predictions.json"), "utf8");
const receipt = JSON.parse(
  await readFile(path.join(dir, "receipt.json"), "utf8")
);
assert.equal(sha(raw), receipt.predictionsSha256, "prediction-seal-drift");
const predictions: Prediction[] = JSON.parse(raw);
const plan: Plan = JSON.parse(
  await readFile(path.join(root, "plan.json"), "utf8")
);
let gold: GoldVerse[];
if (["SG21", "NEG"].includes(edition))
  gold = JSON.parse(
    await readFile(
      path.join(root, "evaluator-only", `${edition}-${split}.gold.json`),
      "utf8"
    )
  );
else {
  const refs = new Set(predictions.map((p) => p.ref));
  gold = (await readStrongCsv(`data/strongs/${edition}.csv`))
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
const byRef = new Map(gold.map((g) => [g.ref, g]));
const invalid = gold.filter((g) => g.diagnostics.length);
const rows = predictions
  .filter((p) => !byRef.get(p.ref)!.diagnostics.length)
  .map((p) => scoreVerse(p, byRef.get(p.ref)!));
const testament = (ref: string) =>
  BOOK_IDS.indexOf(ref.split(".")[0] as never) < 39 ? "OT" : "NT";
const genre = (ref: string) =>
  plan.chapters.find((c) => c.ref === ref.split(".").slice(0, 2).join("."))!
    .genre;
const summary = {
  edition,
  scenario,
  split,
  variant,
  predictionsSha256: sha(raw),
  excludedNonComparable: invalid.map((g) => ({
    ref: g.ref,
    reasons: g.diagnostics
  })),
  total: aggregate(rows),
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
  "evaluation",
  `${edition}-${scenario}-${split}-${variant}`
);
await mkdir(output, { recursive: true });
await writeFile(
  path.join(output, "summary.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
await writeFile(path.join(output, "verses.json"), JSON.stringify(rows) + "\n");
console.log(
  JSON.stringify({ edition, scenario, split, variant, ...summary.total })
);
