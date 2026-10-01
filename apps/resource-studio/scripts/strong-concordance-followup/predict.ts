/** Prediction process. Reads only sealed masked baselines and allowlisted sources. */
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { extractGoldCarrierPlacements } from "../../src/strongCarriers.js";
import {
  learnWitnessDisplayHeads,
  type PhraseHeadEvidence,
  type refineStrongReconstruction
} from "../../src/strongConcordanceRefinement.js";
import { refineConcordanceFollowup } from "../../src/strongConcordanceFollowup.js";
import { parseSourceRow, type SourceRow } from "../../src/strongSourceUnits.js";
import {
  sha,
  words,
  type Prediction
} from "../strong-concordance-night/contract.js";
import { followupPolicy } from "./policy.js";

const [rootArg, edition, scenario, split, variant] = process.argv.slice(2);
assert(rootArg && ["development", "test"].includes(split));
const root = path.resolve(rootArg);
const policy = followupPolicy(variant, edition);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
if (split === "test") {
  const freeze = JSON.parse(
    await readFile(path.join(root, "followup-freeze.json"), "utf8")
  );
  for (const [file, hash] of Object.entries(freeze.code))
    assert.equal(sha(await readFile(file)), hash, `rule-drift:${file}`);
  assert.equal(
    sha(await readFile(path.join(root, "prepared-inputs.json"))),
    freeze.preparedInputsSha256
  );
  assert.equal(
    sha(await readFile(path.join(root, "plan.json"))),
    freeze.planSha256
  );
}
globalThis.fetch = async () => {
  throw new Error("remote-access-forbidden-during-prediction");
};
const env = path.join(root, "environments", scenario);
const allow = JSON.parse(
  await readFile(path.join(env, "allowed-inputs.json"), "utf8")
);
const expected =
  scenario === "target-excluded"
    ? ["Sg1910", "Darby", "DarbyR"]
    : scenario === "control-darby"
      ? ["Sg1910"]
      : ["Darby", "DarbyR"];
assert.deepEqual(allow.references, expected);
assert(!allow.references.includes(edition), "target-reference-leak");
assert(
  !["Darby", "DarbyR"].includes(edition) ||
    allow.references.every((n: string) => n === "Sg1910"),
  "correlated-family-leak"
);
const hashes: Record<string, string> = {};
for (const file of allow.files as string[]) {
  const abs = path.join(env, file);
  hashes[file] = sha(await readFile(abs));
  assert.equal(
    hashes[file],
    prepared.files[path.relative(root, abs)],
    `input-drift:${file}`
  );
}
const base = path.join(root, "baseline", `${edition}-${scenario}-${split}`);
const content = await readFile(path.join(base, "predictions.json"), "utf8");
const rawReceipt = JSON.parse(
  await readFile(path.join(base, "receipt.json"), "utf8")
);
assert.equal(sha(content), rawReceipt.predictionsSha256);
assert.deepEqual(rawReceipt.references, expected);
const input: Prediction[] = JSON.parse(content);
const sourceRows = new Map<string, SourceRow>();
const sourceFiles = new Map<string, string[]>();
for (const v of input)
  for (const u of v.units) {
    const file = u.source.file;
    assert(
      file && u.source.line && allow.files.includes(file),
      `source-not-allowlisted:${u.sourceUnitId}`
    );
    if (!sourceFiles.has(file))
      sourceFiles.set(
        file,
        (await readFile(path.join(env, file), "utf8")).split(/\r?\n/u)
      );
    const row = parseSourceRow(
      sourceFiles.get(file)![u.source.line - 1],
      file,
      u.source.line
    );
    assert(row, `unparsed-source:${u.sourceUnitId}`);
    // The canonical generator disambiguates duplicate physical identities. Its
    // saved hash binds that exact identity to this actual file and line.
    row.id = u.sourceUnitId;
    assert.equal(
      sha(JSON.stringify(row)),
      u.source.evidenceSha256,
      `source-evidence-drift:${u.sourceUnitId}`
    );
    sourceRows.set(row.id, row);
  }
sourceFiles.clear();
const sourceCache = path.join(
  root,
  "derived-blind",
  `source-rows-${sha(content)}.json`
);
const sourceContent = JSON.stringify([...sourceRows]) + "\n";
await mkdir(path.dirname(sourceCache), { recursive: true });
if (existsSync(sourceCache))
  assert.equal(
    await readFile(sourceCache, "utf8"),
    sourceContent,
    "source-cache-drift"
  );
else await writeFile(sourceCache, sourceContent, { flag: "wx" });
const witnesses = await Promise.all(
  expected.map(async (name) => ({
    name,
    family: name === "Sg1910" ? "Segond-family" : "Darby-family",
    map: buildStrongVerseMap(
      (await readStrongCsv(path.join(env, "data/strongs", `${name}.csv`))).map(
        (r) => ({ ...r, text: withoutPublisherNotes(r.text) })
      )
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
const headKey = sha(
  JSON.stringify({
    requests,
    hashes,
    learningCode: sha(await readFile("src/strongConcordanceRefinement.ts"))
  })
);
const cacheFile = path.join(root, "derived-blind", `${headKey}.json`);
let evidence: PhraseHeadEvidence[];
if (existsSync(cacheFile)) {
  const cached = JSON.parse(await readFile(cacheFile, "utf8"));
  assert.equal(cached.key, headKey);
  assert.equal(cached.sha256, sha(JSON.stringify(cached.evidence)));
  evidence = cached.evidence;
} else {
  function* corpus() {
    for (const w of witnesses)
      for (const [ref, verse] of w.map)
        yield {
          ref,
          name: w.name,
          family: w.family,
          words: words(stripTags(verse.row.text)).map((x) => x.text),
          placements: extractGoldCarrierPlacements(verse.row.text)
        };
  }
  evidence = learnWitnessDisplayHeads(requests, corpus());
  await mkdir(path.dirname(cacheFile), { recursive: true });
  await writeFile(
    cacheFile,
    JSON.stringify({
      key: headKey,
      evidence,
      sha256: sha(JSON.stringify(evidence))
    }) + "\n",
    { flag: "wx" }
  );
}
const previousFile = path.join(
  root,
  "previous-code/apps/resource-studio/src/strongConcordanceRefinement.ts"
);
const previous = (await import(pathToFileURL(previousFile).href)) as {
  refineStrongReconstruction: typeof refineStrongReconstruction;
};
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
  const compute = () =>
    variant === "legacy"
      ? {
          prediction: previous.refineStrongReconstruction(
            v,
            refs,
            {
              numeric: true,
              phraseHeads: true,
              accountability: true,
              minimumHeadFamilies: 1
            },
            evidence
          ).prediction,
          changes: [],
          inheritedChanges: []
        }
      : refineConcordanceFollowup({
          initial: v,
          sourceRows,
          witnesses: refs,
          displayEvidence: evidence,
          policy
        });
  const result = compute();
  assert.deepEqual(result, compute(), "nondeterministic-followup");
  assert.equal(result.prediction.text, v.text);
  assert.deepEqual(
    result.prediction.units.map((u) => [
      u.sourceUnitId,
      u.occurrenceIds,
      u.strong
    ]),
    v.units.map((u) => [u.sourceUnitId, u.occurrenceIds, u.strong]),
    "source-inventory-drift"
  );
  return result;
});
const codeFiles = [
  "src/strongSourceReading.ts",
  "src/strongSourceUnits.ts",
  "src/strongCanonicalResolution.ts",
  "src/strongResolutionWorkflow.ts",
  "src/strongResolution.ts",
  "src/strongGrammaticalEmpty.ts",
  "src/strongConcordanceRefinement.ts",
  "src/strongConcordanceFollowup.ts",
  "src/tokenize.ts",
  "src/strongCarriers.ts",
  "scripts/strong-concordance-followup/predict.ts",
  "scripts/strong-concordance-followup/policy.ts"
];
const code = Object.fromEntries(
  await Promise.all(
    codeFiles.map(async (file) => [file, sha(await readFile(file))])
  )
);
const dir = path.join(
  root,
  "followup",
  `${edition}-${scenario}-${split}-${variant}`
);
await mkdir(dir, { recursive: true });
const predictions = JSON.stringify(results.map((r) => r.prediction)) + "\n";
await writeFile(path.join(dir, "predictions.json"), predictions);
await writeFile(
  path.join(dir, "changes.json"),
  JSON.stringify(
    results.map((r) => ({
      ref: r.prediction.ref,
      changes: r.changes,
      inheritedChanges: r.inheritedChanges
    }))
  ) + "\n"
);
await writeFile(
  path.join(dir, "receipt.json"),
  JSON.stringify(
    {
      edition,
      scenario,
      split,
      variant,
      policy,
      comparisonBaseCommit: "068ec210768f591c2a307106f912fd303568ae72",
      canonicalBaselineSha256: sha(content),
      previousRefinementSha256: sha(await readFile(previousFile)),
      predictionsSha256: sha(predictions),
      sourceRowsSha256: sha(JSON.stringify([...sourceRows])),
      sourceRowsFile: path.relative(root, sourceCache),
      sourceRowsFileSha256: sha(sourceContent),
      witnessAndSourceHashes: hashes,
      derivedHeadKey: headKey,
      code,
      targetAnnotationsRead: false,
      remoteAccess: "forbidden"
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
    verses: results.length,
    changes: results.reduce((n, r) => n + r.changes.length, 0),
    sha256: sha(predictions)
  })
);
