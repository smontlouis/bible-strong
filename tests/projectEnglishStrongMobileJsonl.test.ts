import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import {
  projectEnglishStrongMobileJsonl,
  projectSwordOsisMarkup
} from "../src/projectEnglishStrongMobileJsonl.js";
import { enrichEnglishStrongMarkup } from "../src/englishStrongLemmas.js";

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
