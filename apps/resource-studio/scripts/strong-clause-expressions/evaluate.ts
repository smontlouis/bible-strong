import { VARIANTS } from "./variants.js";
/** Evaluator process: predictions have already been frozen and written. */
import assert from "node:assert/strict";
import path from "node:path";
import { raw, save } from "../strong-surface-recovery/io.js";
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
const [rootArg, edition, scenario, split] = process.argv.slice(2),
  root = path.resolve(rootArg);
const prepared = JSON.parse(
  (await raw(path.join(root, "prepared-inputs.json"))).toString()
);
const baseline: Prediction[] = JSON.parse(
  (
    await raw(
      path.join(
        root,
        `predictions/baseline/${edition}-${scenario}/${split}.json`
      )
    )
  ).toString()
);
let gold: GoldVerse[];
if (["SG21", "NEG"].includes(edition)) {
  const f = `evaluator-only/${edition}-${split}.gold.json`,
    b = await raw(path.join(root, f));
  assert.equal(sha(b), prepared.files[f]);
  gold = JSON.parse(b.toString());
} else {
  const refs = new Set(baseline.map((v) => v.ref));
  gold = (
    await readStrongCsv(
      path.join(
        root,
        `environments/target-excluded/data/strongs/${edition}.csv`
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
          id: String(i)
        })),
        diagnostics: []
      };
    });
}
const byRef = new Map(gold.map((g) => [g.ref, g]));
const baselineByRef = new Map(baseline.map((v) => [v.ref, v]));
const baselineScores = new Map(
  baseline.map((p) => [p.ref, scoreVerse(p, byRef.get(p.ref)!)])
);
const requested = process.argv[6]?.split(",");
for (const variant of ["baseline", ...Object.keys(VARIANTS)]) {
  if (requested && !requested.includes(variant)) continue;
  const baselineBytes = await raw(
    path.join(root, `predictions/baseline/${edition}-${scenario}/${split}.json`)
  );
  const sparse: { baselineSha256: string; replacements: Prediction[] } =
    variant === "baseline"
      ? { baselineSha256: sha(baselineBytes), replacements: [] }
      : JSON.parse(
          (
            await raw(
              path.join(
                root,
                `predictions/${variant}/${edition}-${scenario}/${split}.json`
              )
            )
          ).toString()
        );
  assert.equal(sparse.baselineSha256, sha(baselineBytes));
  assert.equal(
    sparse.replacements.length,
    new Set(sparse.replacements.map((v) => v.ref)).size
  );
  assert(sparse.replacements.every((v) => baselineByRef.has(v.ref)));
  const replacements = new Map(sparse.replacements.map((v) => [v.ref, v]));
  const predictions: Prediction[] = baseline.map(
    (v) => replacements.get(v.ref) ?? v
  );
  const scores = predictions.map((p) => {
    const before = baselineByRef.get(p.ref)!;
    assert.equal(p.text, before.text);
    assert.deepEqual(
      p.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong]),
      before.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong])
    );
    for (const existing of before.placements)
      assert.deepEqual(
        p.placements.find((x) => x.id === existing.id),
        existing,
        "prior-carrier-drift"
      );
    for (const u of before.units.filter((u) => u.state !== "unresolved"))
      assert.deepEqual(
        p.units.find((x) => x.sourceUnitId === u.sourceUnitId),
        u,
        "prior-relation-drift"
      );
    return scoreVerse(p, byRef.get(p.ref)!);
  });
  const summary = aggregate(scores);
  const changed = scores.filter(
    (s) =>
      s.metrics.exact.predicted !==
      baselineScores.get(s.ref)!.metrics.exact.predicted
  );
  const detail = {
    edition,
    scenario,
    split,
    variant,
    summary,
    changed: changed.map((s) => ({
      ref: s.ref,
      before: baselineScores.get(s.ref)!.metrics.exact,
      after: s.metrics.exact,
      unmatchedPredicted: s.unmatchedPredicted,
      unmatchedExpected: s.unmatchedExpected
    }))
  };
  await save(
    path.join(
      root,
      `evaluation/${variant}/${edition}-${scenario}/${split}.json`
    ),
    detail
  );
  await save(
    path.join(
      root,
      `evaluation/${variant}/${edition}-${scenario}/${split}-scores.json`
    ),
    scores,
    true
  );
  console.log(
    JSON.stringify({
      edition,
      scenario,
      split,
      variant,
      ...summary.metrics.exact,
      changedVerses: changed.length
    })
  );
}
