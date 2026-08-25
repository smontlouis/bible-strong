import assert from "node:assert/strict";
import test from "node:test";

import { alignCompleteVerse } from "../src/completeAlignment.js";
import { alignReaderVerse } from "../src/readerAlignment.js";
import {
  buildTargetVerseBlock,
  projectBlockReferences,
  projectVerseBlockAlignment,
  VerseBlockProjectionError
} from "../src/verseBlockAlignment.js";
import { type BibleVerse } from "../src/bibleJson.js";
import { type OriginalVerse } from "../src/originalSource.js";
import { buildStrongVerseMap } from "../src/strongCsv.js";

test("projects block word and empty occurrences to native verse indexes", () => {
  const verses = [
    verse(5, "Allez vers les brebis"),
    verse(6, "perdues Israël")
  ];
  const original = originalVerse([
    token("o1", "G0001", "brebis"),
    token("o2", "G0002", "perdues"),
    token("o3", "G0003", "technique")
  ]);
  const { targetText } = buildTargetVerseBlock(verses);
  const reader = alignReaderVerse({ targetText, references: [] });
  const complete = alignCompleteVerse({
    targetText,
    references: [],
    original,
    translationLexicon: {
      exact: new Map([
        ["G0001", new Map([["brebis", candidate("G0001", "brebis")]])],
        ["G0002", new Map([["perdues", candidate("G0002", "perdues")]])]
      ]),
      stem: new Map()
    }
  });
  const projected = projectVerseBlockAlignment({
    targetVerses: verses,
    reader,
    complete,
    original
  });

  assert.deepEqual([...projected[0]!.complete.wordAssignments.keys()], [3]);
  assert.deepEqual([...projected[1]!.complete.wordAssignments.keys()], [0]);
  assert.deepEqual(
    projected.map((item) => item.original?.tokens.map((value) => value.id)),
    [["o1"], ["o2", "o3"]]
  );
  assert.equal(
    projected[1]!.complete.emptyAssignments[0]!.insertAfterWordIndex,
    0
  );
});

test("fails closed when a reader phrase crosses a native verse boundary", () => {
  const verses = [verse(5, "vers les"), verse(6, "brebis perdues")];
  const { targetText } = buildTargetVerseBlock(verses);
  const reader = alignReaderVerse({ targetText, references: [] });
  reader.phraseAssignments.push({
    strong: ["G1"],
    confidence: 0.9,
    method: "learned-phrase",
    source: "test",
    startWordIndex: 1,
    endWordIndex: 2,
    originalConfirmed: true
  });
  const complete = alignCompleteVerse({ targetText, references: [] });

  assert.throws(
    () =>
      projectVerseBlockAlignment({ targetVerses: verses, reader, complete }),
    (error: unknown) => {
      assert.ok(error instanceof VerseBlockProjectionError);
      assert.equal(error.code, "cross-target-phrase");
      return true;
    }
  );
});

test("co-locates several Strong identities carried by one physical STEP token", () => {
  const verses = [verse(7, "alpha"), verse(8, "beta")];
  const original = originalVerse([
    {
      ...token("shared", "G0001", "alpha"),
      strong: ["G0001", "G0002"],
      sourceStrong: ["G0001A", "G0002A"]
    }
  ]);
  const { targetText } = buildTargetVerseBlock(verses);
  const reader = alignReaderVerse({ targetText, references: [] });
  const complete = alignCompleteVerse({
    targetText,
    references: [],
    original,
    translationLexicon: {
      exact: new Map([
        ["G0001", new Map([["alpha", candidate("G0001", "alpha")]])],
        ["G0002", new Map([["beta", candidate("G0002", "beta")]])]
      ]),
      stem: new Map()
    }
  });
  const projected = projectVerseBlockAlignment({
    targetVerses: verses,
    reader,
    complete,
    original
  });

  assert.deepEqual(projected[0]!.complete.wordAssignments.get(0)?.strong, [
    "G0001",
    "G0002"
  ]);
  assert.equal(projected[1]!.complete.wordAssignments.size, 0);
  assert.deepEqual(projected[0]!.original?.tokens[0]?.strong, [
    "G0001",
    "G0002"
  ]);
  assert.equal(projected[1]!.original, undefined);
});

test("partitions a witness-only Strong by visible source-token position", () => {
  const verses = [verse(5, "premier texte"), verse(6, "second témoin")];
  const { targetText } = buildTargetVerseBlock(verses);
  const reader = alignReaderVerse({ targetText, references: [] });
  const complete = alignCompleteVerse({ targetText, references: [] });
  const projected = projectVerseBlockAlignment({
    targetVerses: verses,
    reader,
    complete
  });
  const reference = buildStrongVerseMap([
    {
      bookId: "Matt",
      chapter: 10,
      verse: 5,
      text: 'premier texte second <w strong="G3756">témoin</w>'
    }
  ]).get("Matt.10.5")!;
  const references = projectBlockReferences({
    references: [{ name: "Sg1910", verse: reference }],
    projected
  });

  assert.equal(references[0]![0]!.verse?.row.text, "");
  assert.equal(references[1]![0]!.verse?.row.text, '<w strong="G3756"></w>');
});

function verse(number: number, text: string): BibleVerse {
  return {
    bookNumber: "40",
    bookId: "Matt",
    chapter: 10,
    verse: number,
    text
  };
}

function token(id: string, strong: string, gloss: string) {
  return {
    id,
    text: gloss,
    strong: [strong],
    sourceStrong: [strong],
    gloss,
    lemma: gloss,
    pos: "N",
    morph: ""
  };
}

function candidate(strong: string, normalized: string) {
  return {
    strong,
    normalized,
    score: 1,
    source: "test",
    method: "learned-translation" as const
  };
}

function originalVerse(tokens: ReturnType<typeof token>[]): OriginalVerse {
  return {
    bookId: "Matt",
    chapter: 10,
    verse: 5,
    tokens,
    strongSet: new Set(tokens.flatMap((value) => value.strong))
  };
}
