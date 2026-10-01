/** Prediction process: only sealed baseline and allowed witness CSVs are read. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import {
  refineStrongReconstruction,
  learnWitnessDisplayHeads,
  type PhraseHeadEvidence,
  type RefinementPolicy
} from "../../src/strongConcordanceRefinement.js";
import { sha, words, type Prediction } from "./contract.js";

export const policies: Record<string, RefinementPolicy> = {
  numbers: {
    numeric: true,
    phraseHeads: false,
    accountability: false,
    minimumHeadFamilies: 1
  },
  heads: {
    numeric: false,
    phraseHeads: true,
    accountability: false,
    minimumHeadFamilies: 1
  },
  accountable: {
    numeric: false,
    phraseHeads: false,
    accountability: true,
    minimumHeadFamilies: 1
  },
  combined: {
    numeric: true,
    phraseHeads: true,
    accountability: true,
    minimumHeadFamilies: 1
  },
  "carriers-only": {
    numeric: true,
    phraseHeads: true,
    accountability: false,
    minimumHeadFamilies: 1
  },
  "two-family-heads": {
    numeric: true,
    phraseHeads: true,
    accountability: true,
    minimumHeadFamilies: 2
  }
};
const [rootArg, edition, scenario, split, variant] = process.argv.slice(2);
const root = path.resolve(rootArg);
assert(["development", "test"].includes(split));
let policy = policies[variant];
if (variant === "edition-adapted")
  policy = {
    ...policies.combined,
    numeric: edition === "SG21",
    minimumHeadFamilies: edition === "SG21" ? 2 : 1
  };
assert(policy, "unknown-policy");
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "rule-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `rule-drift:${file}`);
}
globalThis.fetch = async () => {
  throw new Error("network-forbidden-in-prediction");
};
const base = path.join(root, "baseline", `${edition}-${scenario}-${split}`);
const content = await readFile(path.join(base, "predictions.json"), "utf8");
const receipt = JSON.parse(
  await readFile(path.join(base, "receipt.json"), "utf8")
);
assert.equal(sha(content), receipt.predictionsSha256);
const input: Prediction[] = JSON.parse(content);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
const code = Object.fromEntries(
  await Promise.all(
    [
      "src/strongConcordanceRefinement.ts",
      "src/tokenize.ts",
      "src/strongCarriers.ts",
      "scripts/strong-concordance-night/refine.ts",
      "scripts/strong-concordance-night/contract.ts"
    ].map(async (file) => [file, sha(await readFile(file))])
  )
);
for (const name of receipt.references as string[]) {
  const file = path.join(
    root,
    "environments",
    scenario,
    "data/strongs",
    `${name}.csv`
  );
  assert.equal(
    sha(await readFile(file)),
    prepared.files[path.relative(root, file)],
    `witness-drift:${name}`
  );
}
const witnesses = await Promise.all(
  (receipt.references as string[]).map(async (name) => ({
    name,
    family: name === "Sg1910" ? "Segond-family" : "Darby-family",
    map: buildStrongVerseMap(
      (
        await readStrongCsv(
          path.join(
            root,
            "environments",
            scenario,
            "data/strongs",
            `${name}.csv`
          )
        )
      ).map((r) => ({ ...r, text: withoutPublisherNotes(r.text) }))
    )
  }))
);
const requests = input.flatMap((v) =>
  v.placements
    .filter((p) => p.kind === "phrase")
    .map((p) => ({
      strong: p.strong,
      phrase: v.words.slice(p.startWordIndex!, p.endWordIndex! + 1)
    }))
);
const cacheKey = sha(
  JSON.stringify({
    requests,
    code,
    inputs: receipt.references.map(
      (name: string) =>
        prepared.files[`environments/${scenario}/data/strongs/${name}.csv`]
    )
  })
);
const cachePath = path.join(root, "derived-blind", `${cacheKey}.json`);
let displayEvidence: PhraseHeadEvidence[] = [];
if (policy.phraseHeads) {
  if (existsSync(cachePath)) {
    const cache = JSON.parse(await readFile(cachePath, "utf8"));
    assert.equal(cache.key, cacheKey);
    assert.equal(cache.sha256, sha(JSON.stringify(cache.evidence)));
    displayEvidence = cache.evidence;
  } else {
    function* corpus() {
      for (const w of witnesses)
        for (const [ref, verse] of w.map)
          yield {
            name: w.name,
            family: w.family,
            ref,
            words: words(stripTags(verse.row.text)).map((x) => x.text),
            placements: extractGoldCarrierPlacements(verse.row.text)
          };
    }
    displayEvidence = learnWitnessDisplayHeads(requests, corpus());
    await mkdir(path.dirname(cachePath), { recursive: true });
    await writeFile(
      cachePath,
      JSON.stringify({
        key: cacheKey,
        code,
        evidence: displayEvidence,
        sha256: sha(JSON.stringify(displayEvidence))
      }) + "\n",
      { flag: "wx" }
    );
  }
}
const results = input.map((v) => {
  const refs = witnesses.flatMap((w) => {
    const row = w.map.get(v.ref);
    return row
      ? [
          {
            name: w.name,
            family: w.family,
            words: words(stripTags(row.row.text)).map((x) => x.text),
            placements: extractGoldCarrierPlacements(row.row.text)
          }
        ]
      : [];
  });
  const result = refineStrongReconstruction(v, refs, policy, displayEvidence);
  assert.deepEqual(
    result,
    refineStrongReconstruction(v, refs, policy, displayEvidence),
    "non-deterministic-refinement"
  );
  assert.equal(result.prediction.text, v.text);
  return result;
});
const output = path.join(
  root,
  "variants",
  `${edition}-${scenario}-${split}-${variant}`
);
await mkdir(output, { recursive: true });
const predictions = JSON.stringify(results.map((r) => r.prediction)) + "\n";
await writeFile(path.join(output, "predictions.json"), predictions);
await writeFile(
  path.join(output, "changes.json"),
  JSON.stringify(
    results.map((r) => ({ ref: r.prediction.ref, changes: r.changes }))
  ) + "\n"
);
await writeFile(
  path.join(output, "receipt.json"),
  JSON.stringify(
    {
      ...receipt,
      variant,
      policy,
      code,
      displayEvidenceSha256: sha(JSON.stringify(displayEvidence)),
      displayEvidenceCacheKey: policy.phraseHeads ? cacheKey : null,
      baselineSha256: sha(content),
      predictionsSha256: sha(predictions)
    },
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
    changes: results.reduce((n, r) => n + r.changes.length, 0),
    sha256: sha(predictions)
  })
);
