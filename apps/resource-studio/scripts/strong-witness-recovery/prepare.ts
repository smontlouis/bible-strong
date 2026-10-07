/** Evaluation-side preparation. Predictors receive only masked texts and witnesses. */
import assert from "node:assert/strict";
import { readFile, writeFile, mkdir, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { readStrongCsv } from "../../src/strongCsv.js";
import { withoutPublisherNotes } from "../../src/strongReaderText.js";
import { stripTags } from "../../src/tokenize.js";
import {
  goldVerse,
  sha,
  type RawVerse,
  type GoldVerse,
  type Prediction
} from "../strong-concordance-night/contract.js";
const [rootArg, phase] = process.argv.slice(2),
  root = path.resolve(rootArg);
assert(["development", "test"].includes(phase));
const origin = JSON.parse(
  await readFile(path.join(root, "baseline-origin.json"), "utf8")
);
const old = (origin.developmentSource ?? origin.experiment) as string;
const oldPrepared = JSON.parse(
  await readFile(path.join(old, "prepared-inputs.json"), "utf8")
);
const plan = JSON.parse(await readFile(path.join(root, "plan.json"), "utf8"));
const metadataPath = path.join(root, "prepared-inputs.json");
const prepared = existsSync(metadataPath)
  ? JSON.parse(await readFile(metadataPath, "utf8"))
  : { files: {} };
if (!existsSync(path.join(root, "environments")))
  await symlink(
    path.join(old, "environments"),
    path.join(root, "environments")
  );
for (const [file, hash] of Object.entries(oldPrepared.files))
  if (file.startsWith("environments/")) {
    assert.equal(sha(await readFile(path.join(root, file))), hash);
    prepared.files[file] = hash;
  }
async function save(file: string, value: unknown) {
  const text = JSON.stringify(value, null, 2) + "\n",
    absolute = path.join(root, file);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, text, { flag: "wx" });
  prepared.files[file] = sha(text);
}
for (const edition of ["SG21", "NEG", "Sg1910", "Darby", "DarbyR"]) {
  let targets: Array<{ ref: string; text: string }> = [];
  const gold: GoldVerse[] = [];
  if (phase === "development") {
    for (const split of ["development", "test"]) {
      const file = `masked/${edition}-${split}.json`,
        data = await readFile(path.join(old, file));
      assert.equal(sha(data), oldPrepared.files[file]);
      targets.push(...JSON.parse(data.toString()));
      if (["SG21", "NEG"].includes(edition)) {
        const file = `evaluator-only/${edition}-${split}.gold.json`,
          data = await readFile(path.join(old, file));
        assert.equal(sha(data), oldPrepared.files[file]);
        gold.push(...JSON.parse(data.toString()));
      }
    }
  } else {
    assert(existsSync(path.join(root, "candidate-freeze.json")));
    const chapters: string[] = plan.chapters
      .filter((c: { split: string }) => c.split === "test")
      .map((c: { ref: string }) => c.ref);
    if (["SG21", "NEG"].includes(edition)) {
      for (const chapter of chapters) {
        const file = `evaluator-only/${edition}-${chapter}.json`,
          data = await readFile(path.join(root, file));
        prepared.files[file] = sha(data);
        const parsed: { verses: RawVerse[] } = JSON.parse(data.toString());
        gold.push(...parsed.verses.map((v) => goldVerse(chapter, v)));
      }
      targets = gold.map(({ ref, text }) => ({ ref, text }));
    } else {
      targets = (await readStrongCsv(`data/strongs/${edition}.csv`))
        .filter((r) => chapters.includes(`${r.bookId}.${r.chapter}`))
        .map((r) => ({
          ref: `${r.bookId}.${r.chapter}.${r.verse}`,
          text: stripTags(withoutPublisherNotes(r.text))
            .replace(/◎/gu, "")
            .replace(/\s+/gu, " ")
            .trim()
        }));
    }
  }
  if (gold.length)
    await save(`evaluator-only/${edition}-${phase}.gold.json`, gold);
  await save(`masked/${edition}-${phase}.json`, targets);
  const bible: Record<string, Record<string, Record<string, string>>> = {};
  for (const row of targets) {
    assert(!/data-|<w\b|◎/u.test(row.text));
    const [book, chapter, verse] = row.ref.split(".");
    const n = BOOK_IDS.indexOf(book as (typeof BOOK_IDS)[number]) + 1;
    assert(n > 0);
    ((bible[n] ??= {})[chapter] ??= {})[verse] = row.text;
  }
  await save(`masked/${edition}-${phase}.bible.json`, bible);
}
if (phase === "development")
  for (const [edition, scenario] of [
    ["SG21", "target-excluded"],
    ["NEG", "target-excluded"],
    ["SG21", "family-excluded"],
    ["NEG", "family-excluded"],
    ["Sg1910", "control-segond"],
    ["Darby", "control-darby"],
    ["DarbyR", "control-darby"]
  ]) {
    const baselineVariant = origin.developmentSource ? "baseline" : "candidate";
    const base = path.join(
      old,
      "predictions",
      baselineVariant,
      `${edition}-${scenario}`
    );
    const receipt = existsSync(path.join(base, "receipt.json"))
      ? JSON.parse(await readFile(path.join(base, "receipt.json"), "utf8"))
      : null;
    const predictions: Prediction[] = [];
    for (const split of ["development", "test"]) {
      const bytes = await readFile(path.join(base, `${split}.json`));
      assert.equal(
        sha(bytes),
        oldPrepared.files[
          `predictions/${baselineVariant}/${edition}-${scenario}/${split}.json`
        ] ?? receipt?.predictions[split]
      );
      predictions.push(...JSON.parse(bytes.toString()));
    }
    await save(
      `predictions/baseline/${edition}-${scenario}/development.json`,
      predictions
    );
  }
prepared.planSha256 = sha(await readFile(path.join(root, "plan.json")));
await writeFile(metadataPath, JSON.stringify(prepared, null, 2) + "\n");
console.log(`Prepared ${phase}; labels isolated from predictions.`);
