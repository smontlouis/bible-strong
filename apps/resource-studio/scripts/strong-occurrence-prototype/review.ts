import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  sha,
  type EvalVerse,
  type BaselineVerse
} from "../strong-alignment-benchmark/shared.js";
import {
  validateRelation,
  type SourceUnit,
  type TranslationRelation
} from "./model.js";

const root = path.resolve(process.argv[2]);
const frozen = path.resolve(process.argv[3]);
const notesText = await readFile(
  new URL("./review-notes.json", import.meta.url),
  "utf8"
);
const notes: Array<{
  gold: string;
  ref: string;
  category: string;
  focusStrong: string[];
  relations: TranslationRelation[];
  assessment: string;
}> = JSON.parse(notesText);
assert.equal(notes.length, 15);
assert.equal(new Set(notes.map((n) => n.ref)).size, 15);
const rows: Array<{ gold: string; verse: EvalVerse; baseline: BaselineVerse }> =
  JSON.parse(await readFile(path.join(frozen, "verses.json"), "utf8"));
const model: Array<{ ref: string; units: SourceUnit[] }> = JSON.parse(
  await readFile(path.join(root, "source-units.json"), "utf8")
);
const manifest = JSON.parse(
  await readFile(path.join(root, "manifest.json"), "utf8")
);
assert.equal(
  sha(await readFile(path.join(frozen, "verses.json"))),
  manifest.inputs[path.join(frozen, "verses.json")]
);
const review = notes.map((note) => {
  const row = rows.find(
    (r) => r.gold === note.gold && r.verse.ref === note.ref
  );
  const units = model.find((r) => r.ref === note.ref)?.units;
  assert(row && units);
  for (const relation of note.relations) {
    assert(relation.status === "proposed" || relation.status === "unresolved");
    validateRelation(relation, units, row.verse.words.length);
  }
  return {
    ...note,
    reviewer: "assistant",
    status: "inspected-not-independent-gold",
    text: row.verse.text,
    words: row.verse.words,
    source: units.filter((u) =>
      u.logicalStrong.some((s) => note.focusStrong.includes(s))
    ),
    baseline: row.baseline.placements.filter((p) =>
      note.focusStrong.includes(p.strong)
    )
  };
});
await writeFile(
  path.join(root, "review-15.json"),
  JSON.stringify(
    {
      protocol:
        "Targeted post-hoc assistant inspection. Proposals are not adjudicated gold, never used to change the legacy scores. No reserved passage.",
      notesSha256: sha(notesText),
      review
    },
    null,
    2
  ) + "\n",
  { flag: "wx" }
);
console.log(
  "15 targeted inspections saved; no independently reviewed semantic labels."
);
