import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { writeReferenceStrongJsonl } from "../src/referenceStrongJsonl.js";

test("writes lossless one-verse-per-line Strong JSONL", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "reference-strong-jsonl-")
  );
  const inputPath = path.join(directory, "Sample.csv");
  const outputPath = path.join(directory, "sample.jsonl");
  const texts = [
    '<p>Au <w strong="H7225">commencement</w> <divineName><w strong="H0430">Dieu</w></divineName>.</p>',
    '<p><w strong="G0976">Livre</w><note n="a">note <i>intacte</i></note> <w strong="G1078"></w>.</p>'
  ];
  await writeFile(
    inputPath,
    `book_id\tnum_chapter\tnum_verse\ttext\nGen\t1\t1\t${texts[0]}\nMatt\t1\t1\t${texts[1]}\n`,
    "utf8"
  );

  try {
    const result = await writeReferenceStrongJsonl({
      inputPath,
      outputPath,
      version: "SAMPLE"
    });
    const records = (await readFile(outputPath, "utf8"))
      .trimEnd()
      .split("\n")
      .map((line) => JSON.parse(line));

    assert.equal(result.verseCount, 2);
    assert.equal(result.strongTagCount, 4);
    assert.equal(result.artifactSha256.length, 64);
    assert.deepEqual(
      records.map(({ ref, book, bookId, text }) => ({
        ref,
        book,
        bookId,
        text
      })),
      [
        { ref: "Gen.1.1", book: 1, bookId: "Gen", text: texts[0] },
        { ref: "Matt.1.1", book: 40, bookId: "Matt", text: texts[1] }
      ]
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
