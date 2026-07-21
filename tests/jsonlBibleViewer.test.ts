import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  getJsonlBibleCatalog,
  getJsonlBibleChapter,
  JsonlBibleViewerError,
  parseJsonlBibleIds
} from "../src/jsonlBibleViewer.js";

const sources = [
  ["outputs/releases/strong-jsonl-permissive/bible-ost-strong.jsonl", "OST"],
  ["outputs/releases/strong-jsonl-permissive/bible-fmar-strong.jsonl", "FMAR"],
  [
    "outputs/releases/strong-jsonl-permissive/bible-nvs78p-strong.jsonl",
    "NVS78P"
  ],
  [
    "outputs/releases/strong-jsonl-permissive/bible-neg79-strong.jsonl",
    "NEG79"
  ],
  ["outputs/releases/strong-jsonl-permissive/bible-nbs-strong.jsonl", "NBS"],
  ["outputs/releases/strong-jsonl/bible-darby-strong.jsonl", "DARBY"],
  ["outputs/releases/strong-jsonl/bible-darbyr-strong.jsonl", "DARBYR"],
  ["outputs/releases/strong-jsonl/bible-sg1910-strong.jsonl", "SG1910"]
] as const;

test("catalogues and reads the eight compact JSONL Bibles by chapter", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "jsonl-bible-viewer-"));
  for (const [relativePath, version] of sources) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(
      filePath,
      [
        verse(version, "Gen.1.1", "Gen", 1, 1, "Au commencement"),
        verse(version, "Gen.1.2", "Gen", 1, 2, "La terre"),
        verse(version, "Gen.2.1", "Gen", 2, 1, "Ainsi furent achevés")
      ].join("\n") + "\n"
    );
  }

  const catalog = await getJsonlBibleCatalog({ root });
  assert.deepEqual(
    catalog.versions.map(({ id, available, verseCount }) => ({
      id,
      available,
      verseCount
    })),
    [
      { id: "OST", available: true, verseCount: 3 },
      { id: "FMAR", available: true, verseCount: 3 },
      { id: "NVS78P", available: true, verseCount: 3 },
      { id: "NEG79", available: true, verseCount: 3 },
      { id: "NBS", available: true, verseCount: 3 },
      { id: "DBY", available: true, verseCount: 3 },
      { id: "DBYR", available: true, verseCount: 3 },
      { id: "LSG", available: true, verseCount: 3 }
    ]
  );
  assert.deepEqual(catalog.books, [{ bookId: "Gen", chapters: [1, 2] }]);

  const chapter = await getJsonlBibleChapter({
    root,
    versions: ["OST", "LSG"],
    bookId: "Gen",
    chapter: 1
  });
  assert.deepEqual(
    chapter.versions.map((version) => [
      version.id,
      version.verses.map((item) => item.ref)
    ]),
    [
      ["OST", ["Gen.1.1", "Gen.1.2"]],
      ["LSG", ["Gen.1.1", "Gen.1.2"]]
    ]
  );
});

test("rejects unknown JSONL Bible aliases", () => {
  assert.deepEqual(parseJsonlBibleIds("ost,dby,ost"), ["OST", "DBY"]);
  assert.throws(
    () => parseJsonlBibleIds("OST,XYZ"),
    (error: unknown) =>
      error instanceof JsonlBibleViewerError &&
      error.code === "invalid-jsonl-bible-version"
  );
});

function verse(
  version: string,
  ref: string,
  bookId: string,
  chapter: number,
  verseNumber: number,
  text: string
): string {
  return JSON.stringify({
    ref,
    version,
    book: 1,
    bookId,
    chapter,
    verse: verseNumber,
    text: `<w strong="H0001">${text}</w>`
  });
}
