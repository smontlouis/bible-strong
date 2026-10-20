import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { liftCanonicalHeadingNotes } from "../src/canonicalHeadingNotes.js";
import {
  liftHeadingNotes,
  projectEnglishStrongMobileJsonl,
  projectSwordOsisMarkup
} from "../src/projectEnglishStrongMobileJsonl.js";
import { enrichEnglishStrongMarkup } from "../src/englishStrongLemmas.js";
import { parseStrongBibleMarkup } from "../src/strongBibleSqlite.js";

function canonicalTextAndNoteOffsets(source: string): {
  text: string;
  noteOffsets: number[];
} {
  const parsed = parseStrongBibleMarkup(projectSwordOsisMarkup(source).text);
  return {
    text: parsed.canonicalText,
    noteOffsets: parsed.notes.map(({ offset }) => offset)
  };
}

test("projects SWORD OSIS into supported canonical markup without losing notes", () => {
  const result = projectSwordOsisMarkup(
    '<title type="section">The Creation</title>' +
      '<div sID="p1" type="x-p"/>' +
      '<q who="Jesus"><w lemma="strong:G25 lemma.TR:ηγαπησεν">loved</w>' +
      '<transChange type="added">the</transChange> world</q>' +
      '<note n="a">Heb. <rdg type="x-literal">reading</rdg> ' +
      '<w lemma="strong:H1">word</w> ' +
      '<reference osisRef="Gen.1.1">Gen 1:1</reference></note>' +
      '<div eID="p1" type="x-p"/>'
  );

  assert.equal(
    result.text,
    '<p><red who="Jesus"><w strong="G25">loved</w>' +
      '<i type="added" data-osis-tag="transChange">the</i> world</red>' +
      '<note n="a">Heb. <i type="x-literal" data-osis-tag="rdg">reading</i> ' +
      'word <ref id="Gen.1.1" data-osis-tag="reference">Gen 1:1</ref></note></p>'
  );
  assert.equal(result.redLetterSpanCount, 1);
  assert.equal(result.noteCount, 1);
  assert.equal(result.strongOccurrenceCount, 1);
});

test("removes only technical whitespace outside visible verse text", () => {
  const result = projectSwordOsisMarkup(
    ' <title type="section">Heading</title> ' +
      '<note n="a">note</note> <w lemma="strong:H1"> In text </w> ' +
      '<milestone type="x-p"/> '
  );
  assert.equal(
    result.text,
    '<note n="a">note</note><w strong="H1">In text</w><p></p>'
  );
});

test("keeps words apart when a Darby note sits between them without whitespace", () => {
  // CrossWire Darby 2.0, Gen 1:1, byte-for-byte.
  const source =
    '<w lemma="strong:H430">In</w> <w lemma="strong:H853">the</w> ' +
    '<w lemma="strong:H7225">beginning</w><note placement="foot">' +
    '<reference type="annotateRef">1.1 </reference>' +
    '<w lemma="strong:H430">Elohim</w></note><w lemma="strong:H430">God</w> ' +
    '<w lemma="strong:H1254">created</w> <w lemma="strong:H853">the</w> ' +
    '<w lemma="strong:H8064">heavens</w> <w lemma="strong:H430">and</w> ' +
    '<w lemma="strong:H853">the</w> <w lemma="strong:H776">earth</w>. ';
  const projection = projectSwordOsisMarkup(source);
  assert.match(
    projection.text,
    /<w strong="H7225">beginning<\/w> <note placement="foot">.*<\/note><w strong="H430">God<\/w>/u
  );
  assert.equal(projection.restoredSeparatorCount, 1);
  assert.deepEqual(canonicalTextAndNoteOffsets(source), {
    text: "In the beginning God created the heavens and the earth.",
    noteOffsets: ["In the beginning ".length]
  });
});

test("restores note separators after closing punctuation, quotes and spaced dashes", () => {
  const note = '<note placement="foot">Elohim</note>';
  for (const [source, expected] of [
    [
      `midst of the garden,${note}God has said`,
      "midst of the garden, God has said"
    ],
    [
      `What is this [that]${note}God has done`,
      "What is this [that] God has done"
    ],
    [
      `into the web.${note}Then she tightened`,
      "into the web. Then she tightened"
    ],
    [
      `I serve my fathers'${note}God, believing`,
      "I serve my fathers' God, believing"
    ],
    [
      `to meet me, —${note}God shall let me see`,
      "to meet me, — God shall let me see"
    ],
    [`In the${note}<w lemma="strong:H7225">beginning</w>`, "In the beginning"],
    [`And${note}${note}God said`, "And God said"]
  ] as const) {
    assert.equal(canonicalTextAndNoteOffsets(source).text, expected, source);
  }
});

test("leaves notes alone where the source spacing is already correct", () => {
  const note = '<note placement="foot">x</note>';
  for (const source of [
    `In the beginning ${note}God created`,
    `Then God said, “${note}Let there be light”;`,
    `saying, ‘${note}To your descendants`,
    `two of Jacob’s sons--${note}Simeon and Levi`,
    `of the sanctuary (${note}the shekel`,
    `Most High${note}—`,
    `let there be no escape${note}. Repay her`,
    `life that he lived, ${note}175 years.`,
    `${note}God is not a man`,
    `from the darkness.${note}`
  ]) {
    const projection = projectSwordOsisMarkup(source);
    assert.equal(projection.restoredSeparatorCount, 0, source);
    assert.equal(projection.text, source.trim(), source);
  }
});

test("canonicalizes zero-padded Strong numbers and preserves NASB eStrong suffixes", () => {
  const result = projectSwordOsisMarkup(
    '<w lemma="strong:H03117">day</w> ' +
      '<w lemma="strong:H01254a">created</w>',
    { lowercaseSuffixAsEStrong: true }
  );
  assert.equal(
    result.text,
    '<w strong="H3117">day</w> ' +
      '<w strong="H1254" estrong="H1254a">created</w>'
  );
});

test("keeps note-only omitted verses with an empty canonical text", () => {
  const result = projectSwordOsisMarkup(
    ' <note type="alternate">Some manuscripts insert this verse.</note> '
  );
  assert.equal(
    result.text,
    '<note type="alternate">Some manuscripts insert this verse.</note>'
  );
});

test("adds contextual English lemmas and leaves empty Strong spans unassigned", () => {
  const result = enrichEnglishStrongMarkup(
    '<w strong="H7225">In the beginnings</w> ' +
      '<w strong="H853"></w> <w strong="H1254">were created</w>'
  );
  assert.equal(
    result.text,
    '<w strong="H7225" lemma="beginning" pos="noun">In the beginnings</w> ' +
      '<w strong="H853"></w> ' +
      '<w strong="H1254" lemma="create" pos="verb">were created</w>'
  );
  assert.equal(result.occurrenceCount, 3);
  assert.equal(result.lexemeAssignmentCount, 2);
  assert.equal(result.lexemes.size, 2);
});

test("treats contextual participles and adjectives as nominal heads", () => {
  assert.equal(
    enrichEnglishStrongMarkup(
      '<w strong="H7225">In the beginning</w> ' +
        '<w strong="H410">the living God</w> ' +
        '<w strong="H8415">of the deep</w>'
    ).text,
    '<w strong="H7225" lemma="beginning" pos="noun">In the beginning</w> ' +
      '<w strong="H410" lemma="god" pos="name">the living God</w> ' +
      '<w strong="H8415" lemma="deep" pos="noun">of the deep</w>'
  );
});

test("keeps lexical boundaries when a note separates adjacent Strong words", () => {
  assert.equal(
    enrichEnglishStrongMarkup(
      '<w strong="H7225">beginning</w>' +
        '<note placement="foot">Elohim</note>' +
        '<w strong="H430">God</w>'
    ).text,
    '<w strong="H7225" lemma="begin" pos="verb">beginning</w>' +
      '<note placement="foot">Elohim</note>' +
      '<w strong="H430" lemma="god" pos="name">God</w>'
  );
});

test("projects canonical verses and headings while excluding supplemental books", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "english-strong-jsonl-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const catalogPath = path.join(root, "catalog.json");
  const richRoot = path.join(root, "rich");
  const sourceDir = path.join(richRoot, "test");
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(sourceDir, { recursive: true })
  );
  await writeFile(
    catalogPath,
    `${JSON.stringify({
      format: "bible-strong-sword-source-catalog",
      schemaVersion: 1,
      sources: [
        {
          id: "test",
          applicationVersionId: "TEST",
          datasetId: "TEST",
          moduleName: "Test"
        }
      ]
    })}\n`
  );
  const records = [
    {
      format: "bible-strong-rich-source-jsonl",
      schemaVersion: 1,
      ref: "Gen.1.1",
      version: "Test",
      applicationVersionId: "TEST",
      datasetId: "TEST",
      canon: "protestant-66",
      book: 1,
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      text: '<title type="section">Creation</title><w lemma="strong:H1254">made</w>',
      headings: [
        {
          order: 0,
          type: "section",
          isPericope: true,
          text: "Creation",
          sourceMarkup:
            '<title type="section"><w lemma="strong:H1254">Creation</w></title>'
        }
      ]
    },
    {
      format: "bible-strong-rich-source-jsonl",
      schemaVersion: 1,
      ref: "Tob.1.1",
      version: "Test",
      applicationVersionId: "TEST",
      datasetId: "TEST",
      canon: "supplemental",
      book: 40,
      bookId: "Tob",
      chapter: 1,
      verse: 1,
      text: "supplemental"
    }
  ];
  await writeFile(
    path.join(sourceDir, "bible-test-source-rich.jsonl"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
  const [summary] = await projectEnglishStrongMobileJsonl({
    root,
    catalogPath,
    richSourceRoot: richRoot,
    outputRoot: path.join(root, "output")
  });
  assert.equal(summary?.verseCount, 1);
  assert.equal(summary?.headingCount, 1);
  assert.equal(summary?.pericopeCount, 1);
  assert.equal(summary?.lexemeAssignmentCount, 1);
  assert.equal(summary?.lexemeCount, 1);
  const [line] = (
    await readFile(path.join(root, "output", "bible-test-strong.jsonl"), "utf8")
  )
    .trim()
    .split("\n");
  const verse = JSON.parse(line!);
  assert.equal(
    verse.text,
    '<w strong="H1254" lemma="make" pos="verb">made</w>'
  );
  assert.equal(verse.headings[0].kind, "pericope");
  assert.equal(
    verse.headings[0].markup,
    '<title type="section">Creation</title>'
  );
});

test("projects chapter-prelude section titles and drops chapter labels", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "english-chapter-prelude-"));
  t.after(async () => rm(root, { recursive: true, force: true }));
  const sourceDir = path.join(root, "rich", "test");
  await import("node:fs/promises").then(({ mkdir }) =>
    mkdir(sourceDir, { recursive: true })
  );
  await writeFile(
    path.join(root, "catalog.json"),
    `${JSON.stringify({
      format: "bible-strong-sword-source-catalog",
      schemaVersion: 1,
      sources: [
        {
          id: "test",
          applicationVersionId: "TEST",
          datasetId: "TEST",
          moduleName: "Test"
        }
      ]
    })}\n`
  );
  const verse = (
    ref: string,
    book: number,
    chapter: number,
    fields: Record<string, unknown>
  ) => ({
    format: "bible-strong-rich-source-jsonl",
    schemaVersion: 1,
    ref,
    version: "Test",
    applicationVersionId: "TEST",
    datasetId: "TEST",
    canon: "protestant-66",
    book,
    bookId: ref.split(".")[0],
    chapter,
    verse: 1,
    ...fields
  });
  const records = [
    // NASB: the prelude only carries the chapter number.
    verse("Gen.1.1", 1, 1, {
      chapterPrelude:
        '<chapter osisID="Gen.1" sID="gen2"/><title subType="x-Chapter" type="sub">CHAPTER 1</title> ',
      text: "In the beginning",
      headings: [
        {
          order: 0,
          type: "sub",
          subType: "x-Chapter",
          isPericope: true,
          text: "CHAPTER 1",
          sourceMarkup:
            '<title subType="x-Chapter" type="sub">CHAPTER 1</title>',
          sourceEntry: "chapterPrelude"
        }
      ]
    }),
    // BSB Colossians 2: section title in the prelude, parallel in verse 1.
    verse("Col.2.1", 51, 2, {
      chapterPrelude:
        '<chapter n="2" osisID="Col.2" sID="Col.2"/><div eID="gen9" type="x-p"/> <title>Absent in Body, Present in Spirit</title> ',
      text: '<title type="parallel"> (<reference osisRef="Rev.3.14-Rev.3.22" type="parallel">Revelation 3:14–22</reference>) </title> I want you to know',
      headings: [
        {
          order: 0,
          type: "unspecified",
          isPericope: true,
          text: "Absent in Body, Present in Spirit",
          sourceMarkup: "<title>Absent in Body, Present in Spirit</title>",
          sourceEntry: "chapterPrelude"
        },
        {
          order: 1,
          type: "parallel",
          isPericope: false,
          text: " (Revelation 3:14–22) ",
          sourceMarkup:
            '<title type="parallel"> (<reference osisRef="Rev.3.14-Rev.3.22" type="parallel">Revelation 3:14–22</reference>) </title>'
        }
      ]
    })
  ];
  await writeFile(
    path.join(sourceDir, "bible-test-source-rich.jsonl"),
    `${records.map((record) => JSON.stringify(record)).join("\n")}\n`
  );
  const [summary] = await projectEnglishStrongMobileJsonl({
    root,
    catalogPath: path.join(root, "catalog.json"),
    richSourceRoot: path.join(root, "rich"),
    outputRoot: path.join(root, "output")
  });
  assert.equal(summary?.headingCount, 2);
  assert.equal(summary?.pericopeCount, 1);
  assert.equal(summary?.chapterHeadingCount, 1);
  assert.equal(summary?.droppedChapterLabelCount, 1);
  const [genesis, colossians] = (
    await readFile(path.join(root, "output", "bible-test-strong.jsonl"), "utf8")
  )
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line));
  assert.equal(genesis.text, "In the beginning");
  assert.equal(genesis.headings, undefined);
  assert.equal(colossians.text, "I want you to know");
  assert.deepEqual(
    colossians.headings.map(
      ({
        order,
        kind,
        text
      }: {
        order: number;
        kind: string;
        text: string;
      }) => [order, kind, text]
    ),
    [
      [0, "pericope", "Absent in Body, Present in Spirit"],
      [1, "parallel", " (Revelation 3:14–22) "]
    ]
  );
});

test("a psalm superscription keeps its title and gives its notes to verse 1", () => {
  assert.equal(liftHeadingNotes("<title>A Psalm</title>"), undefined);
  // CrossWire Darby glues the words around its note.
  assert.deepEqual(
    liftHeadingNotes(
      '<title type="psalm">the man of<note placement="foot"><reference type="annotateRef">90.0 </reference>Elohim</note>God.</title>'
    ),
    {
      text: "the man of God.",
      markup: '<title type="psalm">the man of God.</title>',
      notes: [
        '<note placement="foot"><ref type="annotateRef" data-osis-tag="reference">90.0 </ref>Elohim</note>'
      ]
    }
  );

  const publication = {
    applicationVersionId: "TEST",
    textRevision: "test-old",
    textSha256: "old",
    noteCount: 1,
    verses: {
      "19": {
        "6": {
          "1": {
            text: "O LORD",
            startTags: [],
            layout: [{ offset: 0, order: 0, type: "open", tag: "l" }],
            notes: [
              { offset: 2, order: 1, kind: "note", markup: "<note>a</note>" }
            ],
            headings: [
              {
                offset: 0,
                order: 0,
                kind: "heading",
                type: "psalm",
                text: "According to Sheminith.Sheminith is a term. A Psalm.",
                markup:
                  '<title type="psalm">According to Sheminith.<note placement="foot"><hi type="italic">Sheminith</hi> is a term.</note> A Psalm.</title>'
              }
            ]
          }
        }
      }
    }
  } as unknown as Parameters<typeof liftCanonicalHeadingNotes>[0];
  const lifted = liftCanonicalHeadingNotes(publication);
  const verse = lifted.verses["19"]!["6"]!["1"]!;
  assert.equal(verse.headings[0]!.text, "According to Sheminith. A Psalm.");
  assert.deepEqual(verse.notes.at(-1), {
    offset: 0,
    order: 1,
    kind: "note",
    markup:
      '<note placement="foot"><i type="italic" data-osis-tag="hi">Sheminith</i> is a term.</note>'
  });
  assert.equal(lifted.noteCount, 2);
  assert.notEqual(lifted.textRevision, publication.textRevision);
  assert.equal(liftCanonicalHeadingNotes(lifted), lifted);
});
