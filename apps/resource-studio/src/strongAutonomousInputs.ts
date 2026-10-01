import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ALL_BOOK_IDS } from "./books.js";

export async function prepareAutonomousInput(bible: string, root: string) {
  const legacy = `data/bibles/bible-${bible}.json`;
  // These current local publications restore the truncated BFC Psalms and
  // preserve the native 73-book canon. The historical inputs remain untouched.
  const canonical = `outputs/releases/ordinary-bible-publications-2026-10-01/${bible}/canonical/bible-${bible}.json`;
  const useCanonical = ["bfc", "frc97", "nfc"].includes(bible);
  const source = useCanonical ? canonical : legacy;
  assert(existsSync(source), `missing-complete-input:${bible}:${source}`);
  const content = await readFile(source, "utf8"),
    sourceSha256 = createHash("sha256").update(content).digest("hex");
  let verses: Record<string, Record<string, Record<string, string>>>;
  if (useCanonical) {
    const doc = JSON.parse(content);
    assert.equal(doc.format, "bible-strong-canonical-bible");
    assert.equal(doc.schemaVersion, 4);
    assert.equal(doc.applicationVersionId, bible.toUpperCase());
    verses = {};
    let count = 0;
    for (const [book, chapters] of Object.entries(
      doc.verses as Record<
        string,
        Record<string, Record<string, { text: string }>>
      >
    )) {
      assert(ALL_BOOK_IDS[Number(book) - 1], `unsupported-native-book:${book}`);
      verses[book] = {};
      for (const [chapter, items] of Object.entries(chapters)) {
        verses[book][chapter] = {};
        for (const [v, row] of Object.entries(items)) {
          assert.equal(typeof row.text, "string");
          verses[book][chapter][v] = row.text;
          count++;
        }
      }
    }
    assert.equal(count, doc.verseCount);
    assert.equal(Object.keys(verses).length, 73);
    assert.equal(Object.keys(verses["19"]).length, 150, "truncated-psalter");
  } else verses = JSON.parse(content);
  const inputPath = path.join(root, "inputs", `bible-${bible}.json`);
  await mkdir(path.dirname(inputPath), { recursive: true });
  const prepared = JSON.stringify(verses) + "\n",
    preparedSha256 = createHash("sha256").update(prepared).digest("hex");
  if (existsSync(inputPath))
    assert.equal(
      await readFile(inputPath, "utf8"),
      prepared,
      "autonomous-input-changed-use-new-root"
    );
  else await writeFile(inputPath, prepared, { flag: "wx" });
  const provenance = {
    bible,
    source,
    sourceSha256,
    inputPath,
    preparedSha256,
    canon: useCanonical ? "catholic-73" : "protestant-66",
    transformation: useCanonical
      ? "Extract exact verse text; presentation, headings and notes remain in the linked canonical publication."
      : "Serialize the unchanged local Bible text."
  };
  const receipt = path.join(root, "inputs", `${bible}-provenance.json`);
  if (!existsSync(receipt))
    await writeFile(receipt, JSON.stringify(provenance, null, 2) + "\n", {
      flag: "wx"
    });
  return provenance;
}
