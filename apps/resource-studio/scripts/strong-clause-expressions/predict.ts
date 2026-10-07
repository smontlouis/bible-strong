/** Prediction process: no target gold, target editorial lemma or evaluator input. */
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { readFile } from "node:fs/promises";
import readline from "node:readline";
import path from "node:path";
import { raw, save } from "../strong-surface-recovery/io.js";
import { sha, type Prediction } from "../strong-concordance-night/contract.js";
import { readStrongCsv, buildStrongVerseMap } from "../../src/strongCsv.js";
import { concordanceWitness } from "../../src/strongConcordanceGeneration.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import { parseSourceRow, type SourceRow } from "../../src/strongSourceUnits.js";
import {
  alignWitnessClauses,
  clauseNativeRefs,
  type ClauseWitness
} from "../../src/strongClauseAlignment.js";
import {
  createClauseLexicon,
  type MeaningBridge,
  type SemanticLinks
} from "../../src/strongClauseLexicon.js";
import type { FrenchInflectionIndex } from "../../src/strongInflectionEvidence.js";
import { VARIANTS } from "./variants.js";
const [rootArg, edition, scenario, split, requested] = process.argv.slice(2),
  root = path.resolve(rootArg);
assert(["development", "test", "canary", "integration-canary"].includes(split));
const names = requested ? requested.split(",") : Object.keys(VARIANTS);
assert(names.every((n) => n in VARIANTS));
const codeFiles = [
  "src/strongClauseAlignment.ts",
  "src/strongClauseLexicon.ts",
  "scripts/strong-clause-expressions/predict.ts",
  "scripts/strong-clause-expressions/variants.ts"
];
const codeHashes = Object.fromEntries(
  await Promise.all(
    codeFiles.map(async (file) => [file, sha(await readFile(file))])
  )
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
const env = path.join(root, "environments", scenario),
  allow = JSON.parse(
    await readFile(path.join(env, "allowed-inputs.json"), "utf8")
  );
assert(!allow.references.includes(edition), "target-leak");
if (["Darby", "DarbyR"].includes(edition))
  assert.deepEqual(allow.references, ["Sg1910"]);
const inputHashes: Record<string, string> = {};
for (const file of allow.files) {
  const h = sha(await readFile(path.join(env, file)));
  assert.equal(h, prepared.files[path.relative(root, path.join(env, file))]);
  inputHashes[file] = h;
}
const input = `predictions/baseline/${edition}-${scenario}/${split}.json`,
  bytes = await raw(path.join(root, input));
assert.equal(sha(bytes), prepared.files[input]);
const baseline: Prediction[] = JSON.parse(bytes.toString());
async function resource<T>(name: string): Promise<T> {
  const b = await raw(path.join(root, name)),
    h = sha(b);
  assert.equal(
    h,
    prepared.files[name] ??
      JSON.parse(
        await readFile(
          path.join(root, "french-inflections-receipt.json"),
          "utf8"
        )
      ).outputSha256
  );
  inputHashes[name] = h;
  return JSON.parse(b.toString());
}
const inflections = await resource<FrenchInflectionIndex>(
  "french-inflections.json"
);
const semantics = await resource<SemanticLinks>("french-semantic-links.json");
const meanings = await resource<MeaningBridge>(
  "independent-meaning-bridge.json"
);
if (split === "test") {
  const frozen = JSON.parse(
    await readFile(path.join(root, "candidate-freeze.json"), "utf8")
  );
  for (const [file, h] of Object.entries(frozen.code))
    assert.equal(sha(await readFile(file)), h, `frozen-code-drift:${file}`);
  for (const name of [
    "french-inflections.json",
    "french-semantic-links.json",
    "independent-meaning-bridge.json"
  ])
    assert.equal(inputHashes[name], frozen.resources[name]);
}
globalThis.fetch = async () => {
  throw new Error("remote-access-forbidden");
};
const refs = await Promise.all(
  (allow.references as string[]).map(async (name) => ({
    name,
    map: buildStrongVerseMap(
      await readStrongCsv(path.join(env, `data/strongs/${name}.csv`))
    )
  }))
);
const needed = new Map<string, Map<number, Set<string>>>();
for (const verse of baseline)
  for (const u of verse.units) {
    if (!u.source.file || !u.source.line) continue;
    assert(
      allow.files.includes(u.source.file),
      "source-file-outside-allowlist"
    );
    const lines = needed.get(u.source.file) ?? new Map<number, Set<string>>(),
      ids = lines.get(u.source.line) ?? new Set<string>();
    ids.add(u.sourceUnitId);
    lines.set(u.source.line, ids);
    needed.set(u.source.file, lines);
  }
const rows = new Map<string, SourceRow>();
for (const [file, lines] of needed) {
  let line = 0;
  for await (const text of readline.createInterface({
    input: createReadStream(path.join(env, file)),
    crlfDelay: Infinity
  })) {
    line++;
    if (!lines.has(line)) continue;
    const row = parseSourceRow(text, file, line);
    if (row && lines.get(line)!.has(row.id)) rows.set(row.id, row);
  }
}
const lookup = createClauseLexicon({ inflections, semantics, meanings });
const witnessCache = new Map<string, ClauseWitness[]>();
function witnesses(initial: Prediction) {
  const native = clauseNativeRefs(initial);
  const key = native.join("|");
  let result = witnessCache.get(key);
  if (result) return result;
  result = native.flatMap((ref) =>
    refs.flatMap((w) => {
      const v = w.map.get(ref);
      return v
        ? [
            {
              ...concordanceWitness(w.name, v.row.text),
              ref,
              text: stripTags(withoutPublisherNotes(v.row.text))
            }
          ]
        : [];
    })
  );
  witnessCache.set(key, result);
  return result;
}
for (const name of names) {
  const variant = VARIANTS[name],
    replacements: Prediction[] = [],
    changes: unknown[] = [],
    rejected: unknown[] = [];
  for (const initial of baseline) {
    const result = alignWitnessClauses({
      initial,
      witnesses: witnesses(initial),
      policy: variant.policy,
      lexicalProof: (u, t, w) =>
        lookup(u, t, w, variant.level, rows.get(u.sourceUnitId))
    });
    if (result.changes.length) {
      replacements.push(result.prediction);
      changes.push({
        ref: initial.ref,
        text: initial.text,
        changes: result.changes
      });
    }
    if (result.rejected.length)
      rejected.push({ ref: initial.ref, rejected: result.rejected });
  }
  const dir = path.join(root, "predictions", name, `${edition}-${scenario}`);
  await save(
    path.join(dir, `${split}.json`),
    { baselineSha256: sha(bytes), replacements },
    true
  );
  await save(path.join(dir, `${split}-changes.json`), changes, true);
  await save(path.join(dir, `${split}-rejected.json`), rejected, true);
  await save(path.join(dir, `${split}-receipt.json`), {
    edition,
    scenario,
    split,
    variant,
    codeHashes,
    inputs: inputHashes,
    baselineSha256: sha(bytes),
    sourceRowsLoaded: rows.size,
    changedVerses: replacements.length,
    targetAnnotationsRead: false,
    modelCalls: 0
  });
  console.log(
    JSON.stringify({
      edition,
      scenario,
      split,
      variant: name,
      changedVerses: replacements.length,
      newCarriers: replacements.reduce(
        (n, v) =>
          n +
          v.placements.length -
          baseline.find((b) => b.ref === v.ref)!.placements.length,
        0
      )
    })
  );
}
for (const [file, h] of Object.entries(codeHashes))
  assert.equal(sha(await readFile(file)), h, `code-changed-during-run:${file}`);
