/** Read a few already-known development examples from the prior generated ledger. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { reconstructionFromLedger } from "../../src/strongConcordanceGeneration.js";
import type { StrongLedgerVerse } from "../../src/strongLedger.js";
import { sha } from "../strong-concordance-night/contract.js";
import { save } from "../strong-surface-recovery/io.js";
const root = path.resolve(process.argv[2]);
const origin = JSON.parse(
  await readFile(path.join(root, "baseline-origin.json"), "utf8")
);
const prepared = JSON.parse(
  await readFile(path.join(root, "prepared-inputs.json"), "utf8")
);
const refs = ["1John.1.8", "1Kgs.8.21", "Num.16.35", "Acts.1.1"];
for (const [edition, bible] of [
  ["SG21", "s21"],
  ["NEG", "neg79"]
]) {
  const file = path.join(
    origin.experiment,
    `full/generated/${bible}/bible-${bible}-strong.sqlite`
  );
  const db = new DatabaseSync(file, { readOnly: true });
  const rows = refs.flatMap((ref) =>
    db.prepare("select * from verses where bible=? and ref=?").all(bible, ref)
  );
  assert.equal(rows.length, refs.length);
  const verses: StrongLedgerVerse[] = rows.map((row) => {
    const bookId = BOOK_IDS.find((b) => b === row.book_id);
    assert(bookId);
    const text = (name: string) => {
      assert.equal(typeof row[name], "string");
      return String(row[name]);
    };
    return {
      ref: text("ref"),
      bookId,
      chapter: Number(row.chapter),
      verse: Number(row.verse),
      text: text("text"),
      tokens: JSON.parse(text("tokens_json")),
      annotations: JSON.parse(text("annotations_json")),
      inventories: JSON.parse(text("inventories_json")),
      metrics: JSON.parse(text("metrics_json")),
      resolution: JSON.parse(text("resolution_json")),
      views: {
        readerHtml: text("reader_html"),
        advancedHtml: text("advanced_html"),
        debugHtml: text("debug_html")
      }
    };
  });
  db.close();
  const predictions = verses.map(reconstructionFromLedger),
    name = `predictions/baseline/${edition}-target-excluded/canary.json`;
  await save(path.join(root, name), predictions, true);
  prepared.files[name] = sha(JSON.stringify(predictions) + "\n");
  await save(path.join(root, `canary-${edition}-origin.json`), {
    refs,
    source: file,
    sourceType: "previous-target-blind-generated-predictions",
    independentEvaluation: false,
    targetGoldAnnotationsRead: false
  });
}
await save(path.join(root, "prepared-inputs.json"), prepared);
console.log(
  "Four known development canaries prepared per edition; generated Bibles read-only."
);
