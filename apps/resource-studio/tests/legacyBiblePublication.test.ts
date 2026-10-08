import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { buildCanonicalBibleFromLegacy } from "../src/legacyBiblePublication.js";
import {
  getOrdinaryBibleCanon,
  parseOrdinaryBiblePublicationArgs
} from "../src/packageOrdinaryBiblePublications.js";
import { verifyCanonicalBiblePublication } from "../src/strongBibleMobilePublication.js";

describe("ordinary Bible publication", () => {
  it("turns legacy headings and word-index red ranges into canonical presentation", () => {
    const publication = buildCanonicalBibleFromLegacy({
      versionId: "TEST",
      sourceVersion: "fixture",
      sourceSha256: "a".repeat(64),
      bible: { 40: { 1: { 1: "One two three four" } } },
      pericope: { 40: { 1: { 1: { h1: "Major", h3: "Section" } } } },
      redWords: { "40-1-1": [{ start: 1, end: 2 }] }
    });

    assert.deepEqual(publication.verses["40"]?.["1"]?.["1"], {
      text: "One two three four",
      startTags: [],
      layout: [
        { offset: 4, order: 0, type: "open", tag: "wj" },
        { offset: 13, order: 1, type: "close", tag: "wj" }
      ],
      notes: [],
      headings: [
        {
          offset: 0,
          order: 0,
          kind: "pericope",
          type: "majorSection",
          text: "Major",
          markup: "<h1>Major</h1>"
        },
        {
          offset: 0,
          order: 1,
          kind: "pericope",
          type: "section",
          text: "Section",
          markup: "<h3>Section</h3>"
        }
      ]
    });
    assert.equal(verifyCanonicalBiblePublication(publication).verseCount, 1);
  });

  it("publishes a block of combined verses under its first verse number", () => {
    const publication = buildCanonicalBibleFromLegacy({
      versionId: "TEST",
      sourceVersion: "fixture",
      sourceSha256: "a".repeat(64),
      // Legacy sources file a combined block after the numbered verses.
      bible: {
        1: { 14: { 5: "Fifth", 6: "Sixth", "1+GEN": "First to fourth" } },
        13: { 8: { 7: "Seventh", "8+1CH": "Eighth to eleventh" } }
      },
      pericope: { 1: { 14: { 1: { h3: "Heading" } } } }
    });

    assert.deepEqual(Object.keys(publication.verses["1"]!["14"]!), [
      "1",
      "5",
      "6"
    ]);
    assert.equal(
      publication.verses["1"]?.["14"]?.["1"]?.text,
      "First to fourth"
    );
    assert.equal(
      publication.verses["1"]?.["14"]?.["1"]?.headings[0]?.text,
      "Heading"
    );
    assert.equal(
      publication.verses["13"]?.["8"]?.["8"]?.text,
      "Eighth to eleventh"
    );
    assert.equal(publication.verseCount, 5);
    assert.equal(verifyCanonicalBiblePublication(publication).verseCount, 5);
  });

  it("fails on a key it cannot publish instead of skipping it", () => {
    const build = (bible: unknown) =>
      buildCanonicalBibleFromLegacy({
        versionId: "TEST",
        sourceVersion: "fixture",
        sourceSha256: "a".repeat(64),
        bible
      });

    assert.throws(
      () => build({ 1: { 14: { 5: "Fifth", "1-4": "First to fourth" } } }),
      /legacy-bible-verse-key-unsupported:1:14:1-4/u
    );
    // The book code of a combined block must name the book it is filed in.
    assert.throws(
      () => build({ 1: { 14: { "1+EXO": "First to fourth" } } }),
      /legacy-bible-verse-key-unsupported:1:14:1\+EXO/u
    );
    assert.throws(
      () => build({ 1: { 14: { 1: "First", "1+GEN": "First to fourth" } } }),
      /legacy-bible-verse-duplicate:1:14:1\+GEN/u
    );
    assert.throws(
      () => build({ 1: { intro: { 1: "Introduction" } } }),
      /legacy-bible-chapter-key-unsupported:1:intro/u
    );
    assert.throws(
      () => build({ metadata: { 1: { 1: "Text" } } }),
      /legacy-bible-book-key-unsupported:metadata/u
    );
  });

  it("catalogs every ordinary Bible identity exactly once", async () => {
    const config = JSON.parse(
      await readFile("config/ordinary-bible-publications.json", "utf8")
    ) as {
      bibles: Array<{
        id: string;
        attribution: string;
        publicOnline: boolean;
      }>;
    };
    const required = JSON.parse(
      await readFile("config/mobile-resource-required-ids.json", "utf8")
    ) as {
      resourceIds: string[];
    };
    const expected = required.resourceIds
      .filter((id) => id.startsWith("bible:"))
      .map((id) => id.slice(6))
      .sort();
    const actual = config.bibles.map((bible) => bible.id).sort();

    assert.equal(config.bibles.length, 47);
    assert.equal(new Set(actual).size, 47);
    assert.deepEqual(actual, expected);
    assert.ok(config.bibles.every((bible) => bible.attribution.length > 0));
    assert.ok(
      config.bibles.every((bible) => typeof bible.publicOnline === "boolean")
    );
  });

  it("accepts one version and local source overrides for an incremental publication", () => {
    assert.deepEqual(
      parseOrdinaryBiblePublicationArgs([
        "--generated-at",
        "2026-08-19T21:00:00.000Z",
        "--version",
        "lsg",
        "--source-overrides",
        "/candidate/source-overrides.json",
        "--output",
        "/candidate/ordinary"
      ]),
      {
        generatedAt: "2026-08-19T21:00:00.000Z",
        outputDir: "/candidate/ordinary",
        sourceOverridesPath: "/candidate/source-overrides.json",
        versionIds: ["LSG"]
      }
    );
    assert.deepEqual(
      parseOrdinaryBiblePublicationArgs([
        "--generated-at",
        "2026-08-19T21:00:00.000Z",
        "--version",
        "easy,nlt"
      ]).versionIds,
      ["EASY", "NLT"]
    );
    assert.throws(
      () =>
        parseOrdinaryBiblePublicationArgs([
          "--generated-at",
          "2026-08-19T21:00:00.000Z",
          "--versoin",
          "LSG"
        ]),
      /ordinary-bible-publications-cli-option-unknown/u
    );
  });

  it("uses the app's canonical versification identities for every known exception", async () => {
    assert.equal(
      getOrdinaryBibleCanon("LSG").versification,
      "bible-strong-default"
    );
    assert.equal(
      getOrdinaryBibleCanon("BFC").versification,
      "bible-strong-default"
    );
    assert.equal(
      getOrdinaryBibleCanon("BCC1923").versification,
      "bible-strong-catholic-extended-esther-daniel"
    );
    assert.equal(
      getOrdinaryBibleCanon("LAU").versification,
      "bible-strong-french-4-chapter-joel"
    );
    assert.equal(
      getOrdinaryBibleCanon("LXX").versification,
      "theotex-septuagint"
    );
    assert.equal(
      getOrdinaryBibleCanon("VUL").versification,
      "clementine-vulgate"
    );

    const lsg = JSON.parse(
      await readFile("config/resource-publications/lsg.json", "utf8")
    ) as { versification: string };
    assert.equal(lsg.versification, getOrdinaryBibleCanon("LSG").versification);
  });
});
