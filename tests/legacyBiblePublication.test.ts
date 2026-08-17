import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import { buildCanonicalBibleFromLegacy } from "../src/legacyBiblePublication.js";
import { getOrdinaryBibleCanon } from "../src/packageOrdinaryBiblePublications.js";
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

  it("catalogs every ordinary Bible identity exactly once", async () => {
    const config = JSON.parse(
      await readFile("config/ordinary-bible-publications.json", "utf8")
    ) as {
      bibles: Array<{
        id: string;
        attribution: string;
        publicOnline?: boolean;
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
    assert.deepEqual(
      config.bibles
        .filter((bible) => bible.publicOnline === true)
        .map((bible) => bible.id)
        .sort(),
      [
        "ASV",
        "BHG",
        "BSB",
        "DARBY",
        "DBY",
        "FMAR",
        "LAU",
        "LSG",
        "OST",
        "RV1895",
        "RWEBSTER",
        "VUL"
      ]
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
