/** Reads only label-free inputs and archived predictions. Never opens expected.json. */
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  GOLDS,
  sha,
  type BaselineVerse,
  type EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import type { Links } from "../strong-alignment-benchmark/engine.js";
import { makeCases, requestFor, VARIANTS, type Case } from "./core.js";

const sourceRoot = path.resolve(process.argv[2]);
const root = path.resolve(process.argv[3]);
const policyText = await readFile(
  new URL("./policy.json", import.meta.url),
  "utf8"
);
const policy = JSON.parse(policyText);
assert.deepEqual(policy.variants, [...VARIANTS]);
await mkdir(path.dirname(root), { recursive: true });
await mkdir(root, { recursive: false });
const inputs: Record<string, string> = {};
async function read(relative: string) {
  const content = await readFile(path.join(sourceRoot, relative), "utf8");
  inputs[relative] = sha(content);
  return content;
}
const plan = JSON.parse(await read("plan.json"));
assert.equal(
  plan.textPolicy,
  "exclude-publisher-notes-v1",
  "clean-reader-text-required; run clean-corpus.ts before arbitration"
);
const cases: Case[] = [];
const pools: unknown[] = [];
const verses: Array<{
  gold: string;
  verse: EvalVerse;
  baseline: BaselineVerse;
}> = [];
for (const gold of GOLDS) {
  const evaluation: EvalVerse[] = JSON.parse(
    await read(`${gold}/eval-input.json`)
  );
  assert.equal(
    inputs[`${gold}/eval-input.json`],
    plan.manifests.find((m: { gold: string }) => m.gold === gold).inputs[
      "eval-input.json"
    ]
  );
  const baseline: BaselineVerse[] = JSON.parse(
    await read(`${gold}/baseline.json`)
  ).verses;
  const predictions: Links[][] = [];
  for (const rep of ["strong", "surface"]) {
    const text = await read(`${gold}/eflomal/${rep}/predictions.jsonl`);
    const meta = JSON.parse(
      await read(`${gold}/eflomal/${rep}/predictions.meta.json`)
    );
    assert.equal(sha(text), meta.sha256);
    predictions.push(
      text
        .trim()
        .split("\n")
        .map((l) => JSON.parse(l))
        .filter((r: Links) => r.seed === 17)
    );
  }
  const available: Case[] = [];
  for (const verse of evaluation) {
    assert(!plan.reserveRefs.includes(verse.ref), "reserved-passage-leak");
    const b = baseline.find((b) => b.ref === verse.ref)!;
    assert(b);
    verses.push({ gold, verse, baseline: b });
    available.push(
      ...makeCases(
        gold,
        verse,
        b,
        predictions.map((r) => {
          const p = r.find((p) => p.ref === verse.ref);
          assert(p);
          return p;
        }),
        policy.sourceNeighborRadius
      )
    );
  }
  for (const split of ["calibration", "test"] as const)
    for (const category of ["existing", "missing"] as const) {
      const pool = available
        .filter((c) => c.split === split && c.category === category)
        .sort((a, b) =>
          sha(`arbitration-v1:${a.id}`).localeCompare(
            sha(`arbitration-v1:${b.id}`)
          )
        );
      assert(
        pool.length >= policy.casesPerEditionSplitCategory,
        "insufficient-stratum"
      );
      cases.push(...pool.slice(0, policy.casesPerEditionSplitCategory));
      pools.push({
        gold,
        split,
        category,
        eligible: pool.length,
        selected: policy.casesPerEditionSplitCategory
      });
    }
}
const requests = cases
  .flatMap((c) => VARIANTS.map((v) => requestFor(c, v)))
  .sort((a, b) => sha(a.id).localeCompare(sha(b.id)));
const files: Record<string, string> = {
  "cases.json": JSON.stringify(cases),
  "verses.json": JSON.stringify(verses),
  "requests.jsonl": requests.map((r) => JSON.stringify(r)).join("\n") + "\n",
  "policy.json": policyText
};
for (const [file, content] of Object.entries(files))
  await writeFile(path.join(root, file), content, { flag: "wx" });
const manifest = {
  version: policy.version,
  createdAt: new Date().toISOString(),
  sourceRoot,
  inputs,
  files: Object.fromEntries(Object.entries(files).map(([f, c]) => [f, sha(c)])),
  sourceSha256: Object.fromEntries(
    await Promise.all(
      ["prepare.ts", "core.ts", "policy.json"].map(async (f) => [
        f,
        sha(await readFile(new URL(`./${f}`, import.meta.url)))
      ])
    )
  ),
  pools,
  cases: cases.length,
  requests: requests.length,
  passages: new Set(cases.map((c) => c.ref)).size,
  maxRequestBytes: Math.max(
    ...requests.map((r) => Buffer.byteLength(JSON.stringify(r)))
  ),
  protocol: policy.testStatus
};
await writeFile(
  path.join(root, "manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
  { flag: "wx" }
);
console.log(
  JSON.stringify(
    {
      cases: manifest.cases,
      requests: manifest.requests,
      passages: manifest.passages,
      maxRequestBytes: manifest.maxRequestBytes,
      pools
    },
    null,
    2
  )
);
