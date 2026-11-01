import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildSpanIndex } from "./study-links.mjs";
import {
  chooseTopicTitle,
  isSameName,
  proposeBibleTitle,
  replaceNames
} from "./title-corrections.mjs";

describe("French titles", () => {
  const verses = new Set(["1-21-14"]);

  it("reads the French spelling behind the English word", () => {
    assert.equal(
      proposeBibleTitle({
        names: ["beer sheba"],
        verses,
        englishSpans: buildSpanIndex([
          { verseKey: "1-21-14", surface: "Beer–sheba", ids: "strong:H0884" }
        ]),
        frenchSpans: buildSpanIndex([
          { verseKey: "1-21-14", surface: "de Beer-Schéba", ids: "strong:H0884" }
        ])
      }),
      "Beer-Schéba"
    );
  });

  it("keeps the name of a people", () => {
    assert.equal(
      proposeBibleTitle({
        names: ["canaanites"],
        verses,
        englishSpans: buildSpanIndex([
          { verseKey: "1-21-14", surface: "the Canaanites", ids: "strong:H3669" }
        ]),
        frenchSpans: buildSpanIndex([
          { verseKey: "1-21-14", surface: "Cananéens", ids: "strong:H3669" }
        ])
      }),
      "Cananéens"
    );
  });

  it("proposes nothing when the French word cannot be found", () => {
    assert.equal(
      proposeBibleTitle({
        names: ["salt"],
        verses,
        englishSpans: buildSpanIndex([
          { verseKey: "1-21-14", surface: "salt", ids: "strong:H4417" }
        ]),
        frenchSpans: buildSpanIndex([])
      }),
      null
    );
  });

  it("completes a compound name cut at its hyphen", () => {
    assert.equal(
      chooseTopicTitle({
        topic: { nameEn: "Beer-Sheba" },
        entities: [{ nameEn: "Beersheba", nameFr: "Beer-Schéba" }],
        biblical: "Beer"
      }),
      "Beer-Schéba"
    );
  });

  it("falls back on the entity for a name that looks like a word", () => {
    assert.equal(
      chooseTopicTitle({
        topic: { nameEn: "So" },
        entities: [{ nameEn: "So", nameFr: "So" }],
        biblical: null
      }),
      "So"
    );
  });

  it("does not turn a people into its ancestor", () => {
    assert.equal(
      chooseTopicTitle({
        topic: { nameEn: "Canaanites" },
        entities: [{ nameEn: "Canaan", nameFr: "Canaan" }],
        biblical: null
      }),
      null
    );
  });

  it("keeps the second page of a topic apart from the first", () => {
    assert.equal(
      chooseTopicTitle({
        topic: { nameEn: "Jesus Continued" },
        entities: [{ nameEn: "Jesus", nameFr: "Jésus" }],
        biblical: "Jésus"
      }),
      "Jésus (suite)"
    );
  });

  it("accepts the French spelling of a name", () => {
    assert.equal(isSameName("Beer-Sheba", "Beer-Schéba"), true);
    assert.equal(isSameName("Gershon", "Guerschon"), true);
    assert.equal(isSameName("Coz", "Kots"), true);
    assert.equal(isSameName("Hezekiah", "Ézéchias"), true);
  });

  it("refuses another word of the verse", () => {
    assert.equal(isSameName("Oded", "Obed"), false);
    assert.equal(isSameName("Beno", "Fils"), false);
    assert.equal(isSameName("Cushan", "Éthiopie"), false);
    assert.equal(isSameName("Ramoth-Gilead", "Ramoth"), false);
    assert.equal(isSameName("Shilonite", "Silo"), false);
  });

  it("replaces whole names only", () => {
    assert.equal(
      replaceNames("Ahab et Ahaziah", [{ from: "Ahab", to: "Achab" }]),
      "Achab et Ahaziah"
    );
    assert.equal(
      replaceNames("Ahabite", [{ from: "Ahab", to: "Achab" }]),
      "Ahabite"
    );
  });
});
