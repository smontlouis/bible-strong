/** Rebuild French training/evaluation from the same frozen chapter split, excluding publisher notes. */
import assert from "node:assert/strict";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { readStrongCsv, referenceKey } from "../../src/strongCsv.js";
import { extractGoldCarrierPlacements } from "../../src/evaluateStrongGold.js";
import { normalizeWord, stripTags, tokenizeText } from "../../src/tokenize.js";
import {
  GOLDS,
  sha,
  type EvalVerse
} from "../strong-alignment-benchmark/shared.js";
import { withoutPublisherNotes } from "./reader-text.js";

const sourceRoot = path.resolve(process.argv[2]),
  root = path.resolve(process.argv[3]);
await mkdir(path.dirname(root), { recursive: true });
await mkdir(root, { recursive: false });
const originalText = await readFile(path.join(sourceRoot, "plan.json"), "utf8"),
  plan = JSON.parse(originalText);
const audits = [];
for (const gold of GOLDS) {
  const oldDir = path.join(sourceRoot, gold),
    dir = path.join(root, gold);
  await mkdir(dir);
  const manifest = plan.manifests.find(
    (m: { gold: string }) => m.gold === gold
  );
  assert.equal(
    sha(await readFile(`data/strongs/${gold}.csv`)),
    manifest.goldSha256
  );
  const csv = await readStrongCsv(`data/strongs/${gold}.csv`);
  const raw = new Map(
    csv.map((r) => [referenceKey(r.bookId, r.chapter, r.verse), r.text])
  );
  const cleaned = new Map(
    [...raw].map(([ref, text]) => [ref, withoutPublisherNotes(text)])
  );
  const textFor = (ref: string) => stripTags(cleaned.get(ref)!);
  const tokensFor = (ref: string) =>
    tokenizeText(textFor(ref)).filter((t) => t.kind === "word");
  const trainRefs: string[] = JSON.parse(
    await readFile(path.join(oldDir, "train-refs.json"), "utf8")
  );
  for (const file of [
    "train.strong.txt",
    "train.surface.txt",
    "train-refs.json"
  ]) {
    const input = await readFile(path.join(oldDir, file));
    if (manifest.inputs[file]) assert.equal(sha(input), manifest.inputs[file]);
    await copyFile(path.join(oldDir, file), path.join(dir, file));
  }
  const train =
    trainRefs
      .map((ref) =>
        tokensFor(ref)
          .map((w) => w.normalized || normalizeWord(w.text))
          .join(" ")
      )
      .join("\n") + "\n";
  assert(
    train
      .trim()
      .split("\n")
      .every((l) => l.length > 0),
    "empty-training-verse-after-cleanup"
  );
  await writeFile(path.join(dir, "train.fr.txt"), train, { flag: "wx" });
  const oldEvalText = await readFile(
    path.join(oldDir, "eval-input.json"),
    "utf8"
  );
  assert.equal(sha(oldEvalText), manifest.inputs["eval-input.json"]);
  const oldEval: EvalVerse[] = JSON.parse(oldEvalText);
  const evaluation = oldEval.map((v) => ({
    ...v,
    text: textFor(v.ref),
    words: tokensFor(v.ref).map((w) => w.text),
    normalized: tokensFor(v.ref).map((w) => w.normalized)
  }));
  await writeFile(
    path.join(dir, "eval-input.json"),
    JSON.stringify(evaluation, null, 2) + "\n",
    { flag: "wx" }
  );
  await writeFile(
    path.join(dir, "expected.json"),
    JSON.stringify(
      Object.fromEntries(
        evaluation.map((v) => [
          v.ref,
          extractGoldCarrierPlacements(cleaned.get(v.ref)!)
        ])
      ),
      null,
      2
    ) + "\n",
    { flag: "wx" }
  );
  for (const file of ["train.fr.txt", "eval-input.json", "expected.json"])
    manifest.inputs[file] = sha(await readFile(path.join(dir, file)));
  audits.push({
    gold,
    trainingVerses: trainRefs.length,
    trainingTextsChanged: trainRefs.filter(
      (ref) => raw.get(ref) !== cleaned.get(ref)
    ).length,
    evaluationTextsChanged: evaluation.filter(
      (v, i) => v.text !== oldEval[i].text
    ).length,
    issues: evaluation.flatMap((v, i) =>
      v.text !== oldEval[i].text
        ? [
            {
              ref: v.ref,
              split: v.split,
              before: oldEval[i].text,
              after: v.text,
              oldWordCount: oldEval[i].words.length,
              newWordCount: v.words.length
            }
          ]
        : []
    )
  });
}
plan.version = "strong-alignment-reader-text-v2";
plan.createdAt = new Date().toISOString();
plan.textPolicy = "exclude-publisher-notes-v1";
plan.derivation = {
  sourceRoot,
  sourcePlanSha256: sha(originalText),
  sameChapterSplits: true,
  sameSourceSequences: true
};
plan.sourceSha256 = sha(await readFile(new URL(import.meta.url)));
plan.readerTextSha256 = sha(
  await readFile(new URL("./reader-text.ts", import.meta.url))
);
await writeFile(
  path.join(root, "plan.json"),
  JSON.stringify(plan, null, 2) + "\n",
  { flag: "wx" }
);
await writeFile(
  path.join(root, "text-cleanup.json"),
  JSON.stringify(audits, null, 2) + "\n",
  { flag: "wx" }
);
console.log(
  JSON.stringify(
    audits.map((a) => ({
      gold: a.gold,
      trainingVerses: a.trainingVerses,
      trainingTextsChanged: a.trainingTextsChanged,
      evaluationTextsChanged: a.evaluationTextsChanged
    })),
    null,
    2
  )
);
