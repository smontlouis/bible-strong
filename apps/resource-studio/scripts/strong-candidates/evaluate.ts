/** Post-generation evaluator. Target labels never enter the generation environment. */
import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  canonicalCarrier,
  type CanonicalVerseResolution
} from "../../src/strongCanonicalResolution.js";
import type { StrongLedgerAnnotation } from "../../src/strongLedger.js";
import { tokenizeText } from "../../src/tokenize.js";
import {
  carrierKey,
  sha,
  type GoldVerse,
  type Prediction
} from "../strong-concordance-night/contract.js";
import { matching, metric } from "../strong-concordance-night/score.js";

const [rootArg, previousArg, edition] = process.argv.slice(2);
assert(rootArg && previousArg && ["neg79", "s21"].includes(edition));
const root = path.resolve(rootArg),
  previous = path.resolve(previousArg);
const external = edition === "s21" ? "SG21" : "NEG";
const prepared = JSON.parse(
  await readFile(path.join(previous, "prepared-inputs.json"), "utf8")
);
const db = new DatabaseSync(
  path.join(root, "generated", edition, `bible-${edition}-strong.sqlite`),
  { readOnly: true }
);
const get = db.prepare(
  "SELECT text,tokens_json,annotations_json,resolution_json FROM verses WHERE bible=? AND ref=?"
);
const results = [];
for (const split of ["development", "test"]) {
  const file = `evaluator-only/${external}-${split}.gold.json`;
  const contents = await readFile(path.join(previous, file), "utf8");
  assert.equal(sha(contents), prepared.files[file], "evaluation-label-drift");
  const gold: GoldVerse[] = JSON.parse(contents);
  const comparable = [],
    excluded = [];
  let predicted = 0,
    expected = 0,
    tp = 0;
  for (const g of gold) {
    const row = get.get(edition, g.ref) as Record<string, string> | undefined;
    if (!row) {
      excluded.push({ ref: g.ref, reason: "missing-native-coordinate" });
      continue;
    }
    const nativeWords: string[] = JSON.parse(row.tokens_json).map(
      (w: { text: string }) => w.text
    );
    const goldWords = tokenizeText(g.text)
      .filter((t) => t.kind === "word")
      .map((t) => t.text);
    // Offset comparison requires the same token sequence. Only typographic
    // apostrophes and case are normalized, never accents or lexical forms.
    const norm = (s: string) =>
      s.normalize("NFC").replaceAll("’", "'").toLowerCase();
    if (
      JSON.stringify(nativeWords.map(norm)) !==
      JSON.stringify(goldWords.map(norm))
    ) {
      excluded.push({
        ref: g.ref,
        reason: "different-native-and-external-token-sequence",
        nativeText: row.text,
        externalText: g.text
      });
      continue;
    }
    const r = JSON.parse(row.resolution_json) as CanonicalVerseResolution;
    const p: Prediction = {
      ref: g.ref,
      text: row.text,
      words: nativeWords,
      units: r.decisions,
      issues: r.issues,
      unownedAnnotationIds: r.unownedAnnotationIds,
      placements: (JSON.parse(row.annotations_json) as StrongLedgerAnnotation[])
        .filter((a) => a.visibility === "reader")
        .flatMap((a) => {
          const c = canonicalCarrier(a);
          return c ? [c] : [];
        })
    };
    const pairs = matching(
      p.placements,
      g.placements,
      (a, b) => carrierKey(a) === carrierKey(b)
    );
    const matched = new Set(pairs.map((x) => x.predicted));
    predicted += p.placements.length;
    expected += g.placements.length;
    tp += pairs.length;
    comparable.push({
      ref: g.ref,
      text: row.text,
      exact: metric(p.placements.length, g.placements.length, pairs.length),
      disagreements: p.placements.filter((_, i) => !matched.has(i)),
      gold: g.placements,
      normalization:
        row.text.replace(/\s+/gu, " ").trim() === g.text
          ? "exact-text"
          : "same-token-sequence-case-and-apostrophes"
    });
  }
  results.push({
    split,
    examinedVerses: gold.length,
    comparableVerses: comparable.length,
    excluded,
    exact: metric(predicted, expected, tp),
    verses: comparable
  });
}
db.close();
const out = path.join(root, "evaluation");
await mkdir(out, { recursive: true });
await writeFile(
  path.join(out, `${edition}.json`),
  JSON.stringify(
    {
      edition,
      status: "diagnostic-on-consumed-external-chapters",
      fullBibleAccuracyClaim: false,
      targetLabelsUsedForPrediction: false,
      results
    },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify(
    results.map(({ split, examinedVerses, comparableVerses, exact }) => ({
      edition,
      split,
      examinedVerses,
      comparableVerses,
      exact
    }))
  )
);
