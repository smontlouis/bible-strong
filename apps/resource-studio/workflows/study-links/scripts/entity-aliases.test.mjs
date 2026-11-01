import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildAliasIndex,
  cleanSurface,
  collectEntitySpellings,
  isCutFromCompound,
  keepSpelling,
  nameKey,
  spanStrongBases,
  strongBase
} from "./entity-aliases.mjs";

describe("entity spellings", () => {
  it("keeps the name of a span and drops the sentence around it", () => {
    assert.equal(cleanSurface("of Reuben"), "Reuben");
    assert.equal(cleanSurface("Now Abraham"), "Abraham");
    assert.equal(cleanSurface("Let not Hezekiah"), "Hezekiah");
    assert.equal(cleanSurface("d’Isaï"), "Isaï");
    assert.equal(cleanSurface("Jesus’"), "Jesus");
    assert.equal(cleanSurface("Il"), null);
    assert.equal(cleanSurface("and he"), null);
  });

  it("gives one key to the spellings of a compound name", () => {
    assert.equal(nameKey("Ben-Hadad"), nameKey("Benhadad"));
    assert.equal(nameKey("Moïse"), "moise");
    assert.equal(nameKey("Paul's"), "paul");
  });

  it("reads the bases of padded and disambiguated Strong codes", () => {
    assert.equal(strongBase("H0775"), "H775");
    assert.equal(strongBase("H6215G"), "H6215");
    assert.deepEqual(spanStrongBases("strong:H3290 ustrong:H3478"), [
      "H3478",
      "H3290"
    ]);
  });

  it("reaches an entity through the unified Strong of another name", () => {
    const spellings = collectEntitySpellings({
      spans: [
        { verseKey: "1-25-26", surface: "Jacob", ids: "strong:H3290 ustrong:H3478" },
        { verseKey: "1-25-26", surface: "Esau", ids: "strong:H6215" }
      ],
      entitiesByVerse: new Map([["1-25-26", new Set([1, 2])]]),
      strongByEntity: new Map([
        [1, "H3478"],
        [2, "H6215"]
      ])
    });
    assert.deepEqual([...spellings.get(1)], [["Jacob", 1]]);
    assert.deepEqual([...spellings.get(2)], [["Esau", 1]]);
  });

  it("ignores a span outside the references of the entity", () => {
    const spellings = collectEntitySpellings({
      spans: [{ verseKey: "1-1-1", surface: "Jacob", ids: "ustrong:H3478" }],
      entitiesByVerse: new Map(),
      strongByEntity: new Map([[1, "H3478"]])
    });
    assert.equal(spellings.size, 0);
  });

  it("keeps a rare spelling only when it is a real share", () => {
    assert.equal(keepSpelling({ count: 1, total: 1 }), true);
    assert.equal(keepSpelling({ count: 321, total: 2600 }), true);
    assert.equal(keepSpelling({ count: 1, total: 400 }), false);
    assert.equal(keepSpelling({ count: 1, total: 7 }), false);
    assert.equal(keepSpelling({ count: 5, total: 888 }), true);
  });

  it("refuses a spelling cut out of a compound name", () => {
    assert.equal(isCutFromCompound("Jair", ["Havvoth-jair", "Havvoth-Jaïr"]), true);
    assert.equal(isCutFromCompound("Havvoth-jair", ["Havvoth-jair"]), false);
    assert.equal(isCutFromCompound("Jacob", ["Israel", "Israël"]), false);
  });

  it("refuses another entity's name when it is a slip of the tagging", () => {
    const entities = [
      { id: 1, uniqueName: "Saul@1Sa.9.2-Act", nameEn: "Saul", nameFr: "Saül" },
      { id: 2, uniqueName: "David@Rut.4.17-Rev", nameEn: "David", nameFr: "David" },
      { id: 3, uniqueName: "Paul@Act.7.58-2Pe", nameEn: "Paul", nameFr: "Paul" }
    ];
    const { entitiesByAlias } = buildAliasIndex({
      entities,
      spellingsByBible: {
        lsg: new Map([
          [1, new Map([["Saül", 365], ["David", 3]])],
          [3, new Map([["Paul", 164], ["Saul", 23]])]
        ])
      }
    });
    assert.deepEqual([...entitiesByAlias.get("david")], [2]);
    assert.deepEqual([...entitiesByAlias.get("saul")].sort(), [1, 3]);
  });

  it("refuses a spelling the source conflates", () => {
    const { entitiesByAlias } = buildAliasIndex({
      entities: [{ id: 1, uniqueName: "Satan@Deu.13.13-Rev", nameEn: "Satan", nameFr: "Satan" }],
      spellingsByBible: { kjv: new Map([[1, new Map([["Satan", 61], ["Belial", 17]])]]) },
      rejectedSpellings: { "Satan@Deu.13.13-Rev": ["Belial"] }
    });
    assert.equal(entitiesByAlias.has("belial"), false);
  });

  it("gives a derived entity its display name only", () => {
    const { entitiesByAlias } = buildAliasIndex({
      entities: [
        { id: 1, uniqueName: "Peter@Mat.4.18-2Pe", nameEn: "Peter", nameFr: "Pierre" },
        {
          id: 2,
          uniqueName: "motherInLaw_of_Peter@Mat.8.14-Luk",
          nameEn: "mother-in-law of Peter",
          nameFr: "belle-mère de Pierre"
        }
      ],
      spellingsByBible: {
        kjv: new Map([
          [1, new Map([["Peter", 100]])],
          [2, new Map([["Peter", 3]])]
        ])
      }
    });
    assert.deepEqual([...entitiesByAlias.get("peter")], [1]);
  });

  it("indexes display names and spellings under one alias", () => {
    const { entitiesByAlias, aliasesByEntity } = buildAliasIndex({
      entities: [{ id: 1, nameEn: "Israel", nameFr: "Israël" }],
      spellingsByBible: { kjv: new Map([[1, new Map([["Jacob", 321]])]]) }
    });
    assert.deepEqual([...entitiesByAlias.get("jacob")], [1]);
    assert.deepEqual([...aliasesByEntity.get(1).get("israel").sources], [
      "display-en",
      "display-fr"
    ]);
  });
});
