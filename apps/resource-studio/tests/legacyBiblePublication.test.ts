import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  buildCanonicalBibleFromLegacy,
  hashHeadingText
} from "../src/legacyBiblePublication.js";
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

  it("applies a reviewed heading repair and tags its references", () => {
    const scope = "Ch. 1 to 15:21. (Ge 15:13, 14. Ps 105:23-39; 106:7-12.)";
    const repair = {
      op: "retype" as const,
      ref: "2-1-1",
      level: "h2" as const,
      expect: hashHeadingText(scope),
      kind: "parallel" as const,
      type: "scope",
      references: [
        { text: "Ge 15:13, 14", osisRef: "Gen.15.13-Gen.15.14" },
        { text: "Ps 105:23-39", osisRef: "Ps.105.23-Ps.105.39" },
        { text: "106:7-12", osisRef: "Ps.106.7-Ps.106.12" }
      ],
      evidence: "fixture"
    };
    const build = (pericopeRepairs: (typeof repair)[]) =>
      buildCanonicalBibleFromLegacy({
        versionId: "TEST",
        sourceVersion: "fixture",
        sourceSha256: "a".repeat(64),
        bible: { 2: { 1: { 1: "Text" } } },
        pericope: {
          2: { 1: { 1: { h1: "Major", h2: scope, h3: "Section" } } }
        },
        pericopeRepairs
      });

    const headings = build([repair]).verses["2"]?.["1"]?.["1"]?.headings;
    assert.deepEqual(headings?.[1], {
      offset: 0,
      order: 1,
      kind: "parallel",
      type: "scope",
      text: scope,
      markup:
        '<h2>Ch. 1 to 15:21. (<reference osisRef="Gen.15.13-Gen.15.14">Ge 15:13, 14</reference>. ' +
        '<reference osisRef="Ps.105.23-Ps.105.39">Ps 105:23-39</reference>; ' +
        '<reference osisRef="Ps.106.7-Ps.106.12">106:7-12</reference>.)</h2>'
    });
    assert.equal(headings?.[0]?.kind, "pericope");
    assert.equal(headings?.[2]?.kind, "pericope");

    assert.throws(
      () => build([{ ...repair, expect: "0".repeat(16) }]),
      /legacy-pericope-repair-anchor-mismatch:2-1-1:h2/u
    );
    assert.throws(
      () => build([{ ...repair, level: "h4" }]),
      /legacy-pericope-repair-unused:2-1-1:h4/u
    );
    assert.throws(
      () =>
        build([
          {
            ...repair,
            references: [{ text: "Ex 1:1", osisRef: "Exod.1.1" }]
          }
        ]),
      /legacy-pericope-repair-reference-missing:Ex 1:1/u
    );
  });

  it("lifts the notes a heading was flattened with into notes of their verses", () => {
    // Title, a note naming verse 3, the rest of the title, then a note holding two.
    const heading =
      "Who sang#3.3 Heb spoke. to the Lord, at last \u00a0?#tn First.sn Second.";
    const firstNote = heading.indexOf("#3.3");
    const secondNote = heading.indexOf("#tn");
    const build = (remove: Array<[number, number]>) =>
      buildCanonicalBibleFromLegacy({
        versionId: "TEST",
        sourceVersion: "fixture",
        sourceSha256: "a".repeat(64),
        bible: { 19: { 3: { 1: "First", 2: "Second", 3: "Third" } } },
        pericope: { 19: { 3: { 1: { h3: heading } } } },
        redWords: { "19-3-1": [{ start: 0, end: 0 }] },
        pericopeRepairs: [
          {
            op: "notes",
            ref: "19-3-1",
            level: "h3",
            expect: hashHeadingText(heading),
            remove,
            notes: [
              { at: [firstNote + 5, firstNote + 15], verse: "3" },
              { at: [secondNote + 4, secondNote + 10], verse: "1" },
              { at: [secondNote + 13, heading.length], verse: "1" }
            ],
            provider: { url: "fixture", sha256: "b".repeat(64) },
            evidence: "fixture"
          }
        ]
      });

    const publication = build([
      [firstNote, firstNote + 15],
      [secondNote, heading.length]
    ]);
    const verses = publication.verses["19"]!["3"]!;
    assert.deepEqual(verses["1"]!.headings[0], {
      offset: 0,
      order: 0,
      kind: "pericope",
      type: "section",
      text: "Who sang to the Lord, at last\u00a0?",
      markup: "<h3>Who sang to the Lord, at last\u00a0?</h3>"
    });
    // After the words of Jesus opening there, before the first word.
    assert.deepEqual(verses["1"]!.notes, [
      { offset: 0, order: 1, kind: "note", markup: "<note>First.</note>" },
      { offset: 0, order: 2, kind: "note", markup: "<note>Second.</note>" }
    ]);
    assert.deepEqual(verses["3"]!.notes, [
      { offset: 0, order: 0, kind: "note", markup: "<note>Heb spoke.</note>" }
    ]);
    assert.equal(publication.noteCount, 3);
    assert.equal(verifyCanonicalBiblePublication(publication).verseCount, 3);

    assert.throws(
      () => build([[secondNote, heading.length]]),
      /legacy-pericope-repair-span-invalid:19-3-1:h3/u
    );
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
