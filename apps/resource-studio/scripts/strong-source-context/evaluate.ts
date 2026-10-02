/** Evaluator only: labels never enter a prediction call. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { scoreVerse, aggregate } from "../strong-concordance-night/score.js";
import {
  sha,
  type Prediction,
  type GoldVerse
} from "../strong-concordance-night/contract.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
const [rootArg, edition, scenario, split, variant] = process.argv.slice(2),
  root = path.resolve(rootArg);
if (split === "test")
  assert(
    (await import("node:fs")).existsSync(
      path.join(root, "candidate-freeze.json")
    ),
    "freeze-required-before-reserve"
  );
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
const predictions: Prediction[] = JSON.parse(
  await readFile(
    path.join(
      root,
      "predictions",
      variant,
      `${edition}-${scenario}`,
      `${split}.json`
    ),
    "utf8"
  )
);
let gold: GoldVerse[];
if (["SG21", "NEG"].includes(edition)) {
  const f = `evaluator-only/${edition}-${split}.gold.json`,
    bytes = await readFile(path.join(root, f));
  assert.equal(sha(bytes), prepared.files[f]);
  gold = JSON.parse(bytes.toString());
} else {
  const refs = new Set(predictions.map((v) => v.ref));
  gold = (
    await readStrongCsv(
      path.join(
        root,
        "environments/target-excluded/data/strongs",
        `${edition}.csv`
      )
    )
  )
    .filter((r) => refs.has(`${r.bookId}.${r.chapter}.${r.verse}`))
    .map((r) => {
      const markup = withoutPublisherNotes(r.text);
      return {
        ref: `${r.bookId}.${r.chapter}.${r.verse}`,
        text: stripTags(markup).replace(/◎/gu, "").replace(/\s+/gu, " ").trim(),
        placements: extractGoldCarrierPlacements(markup).map((p, i) => ({
          ...p,
          id: `${i}`
        })),
        diagnostics: []
      };
    });
}
const baseline: Prediction[] = JSON.parse(
  await readFile(
    path.join(
      root,
      "predictions/baseline",
      `${edition}-${scenario}`,
      `${split}.json`
    ),
    "utf8"
  )
);
const baselineByRef = new Map(baseline.map((v) => [v.ref, v]));
const byRef = new Map(gold.map((g) => [g.ref, g]));
const scores = predictions.map((p) => {
  const g = byRef.get(p.ref)!,
    base = baselineByRef.get(p.ref)!,
    result = scoreVerse(p, g);
  // Fix identity eligibility and difficulty to the old model. Newly discovered
  // rows must not improve the score by changing its denominator. Physical file
  // and line identify surviving words even if a newly found collision changes
  // the printable source id.
  const oldByLine = new Map(
    base.units.map((u) => [`${u.source.file}:${u.source.line}`, u])
  );
  const remap = new Map(
    p.units.flatMap((u) => {
      const old = oldByLine.get(`${u.source.file}:${u.source.line}`);
      return u.occurrenceIds.map(
        (id, i) => [id, old?.occurrenceIds[i] ?? id] as const
      );
    })
  );
  const fixed = scoreVerse(
    {
      ...p,
      units: base.units,
      placements: p.placements.map((x) => ({
        ...x,
        originalOccurrenceId: x.originalOccurrenceId
          ? remap.get(x.originalOccurrenceId)
          : undefined
      }))
    },
    g
  );
  result.metrics.identityExact = fixed.metrics.identityExact;
  result.identityComparable = fixed.identityComparable;
  result.difficulties = fixed.difficulties;
  return result;
});
const dir = path.join(root, "evaluation", variant, `${edition}-${scenario}`);
await mkdir(dir, { recursive: true });
await writeFile(
  path.join(dir, `${split}.json`),
  JSON.stringify(
    { edition, scenario, split, variant, summary: aggregate(scores), scores },
    null,
    2
  ) + "\n"
);
console.log(
  JSON.stringify({
    edition,
    scenario,
    split,
    variant,
    summary: aggregate(scores)
  })
);
