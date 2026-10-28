import assert from "node:assert/strict";
import test from "node:test";

import {
  centredSquare,
  entityImageHash,
  entityImageCatalog,
  entityImageKey,
  entityImageUrl,
  type EntityCatalogData,
  missingPlaceholders,
  parseEntityImageSelection,
  parsePlaceholderName
} from "../src/entityImages.js";

test("a portrait is stored under its unique name and the hash of its original", () => {
  assert.equal(
    entityImageKey("King's_Highway@Num.20.17-", "0123456789ab", 256),
    "entity-images/King's_Highway@Num.20.17-/0123456789ab/w256.webp"
  );
  assert.equal(
    entityImageUrl("King's_Highway@Num.20.17-", "0123456789ab", 768),
    "https://media.bible-strong.app/entity-images/King's_Highway%40Num.20.17-/0123456789ab/w768.webp"
  );
});

test("another original gives another address", () => {
  const first = entityImageHash(new Uint8Array([1, 2, 3]));
  assert.match(first, /^[0-9a-f]{12}$/u);
  assert.equal(entityImageHash(new Uint8Array([1, 2, 3])), first);
  assert.notEqual(entityImageHash(new Uint8Array([1, 2, 4])), first);
});

test("a selection separates portraits, stages and placeholders", () => {
  const selection = parseEntityImageSelection({
    "Paul@Act.7.58-2Pe": "paul.png",
    "Paul@Act.7.58-2Pe#saul": "saul.png",
    "placeholder:female:3": "clay-female-3.png"
  });
  assert.deepEqual(selection.portraits, [
    { uniqueName: "Paul@Act.7.58-2Pe", source: "paul.png" },
    { uniqueName: "Paul@Act.7.58-2Pe", stage: "saul", source: "saul.png" }
  ]);
  assert.deepEqual(selection.placeholders, [
    { key: "female", index: 3, source: "clay-female-3.png" }
  ]);
});

test("a selection refuses what the bucket or the application cannot hold", () => {
  assert.throws(
    () => parseEntityImageSelection({ "placeholder:dragon:1": "x.png" }),
    /UNKNOWN_PLACEHOLDER/u
  );
  assert.throws(
    () => parseEntityImageSelection({ "placeholder:male:6": "x.png" }),
    /UNKNOWN_PLACEHOLDER/u
  );
  assert.throws(
    () => parseEntityImageSelection({ "a/b@Gen.1.1": "x.png" }),
    /INVALID_NAME/u
  );
  assert.throws(
    () => parseEntityImageSelection({ "Paul@Act.7.58-2Pe": "" }),
    /SOURCE_MISSING/u
  );
});

test("the application needs five placeholders for people and groups, one for the other keys", () => {
  assert.equal(parsePlaceholderName("placeholder:female:5")?.key, "female");
  assert.equal(parsePlaceholderName("placeholder:star:1")?.key, "star");
  assert.equal(parsePlaceholderName("placeholder:star:2"), undefined);
  const missing = missingPlaceholders([
    { key: "male", index: 1, source: "m.png" }
  ]);
  assert.equal(missing.length, 22);
  assert.ok(!missing.includes("male-1.webp"));
  assert.ok(missing.includes("group-5.webp"));
  assert.ok(missing.includes("star-1.webp"));
  assert.ok(!missing.includes("star-2.webp"));
});

const DATA: EntityCatalogData = {
  entities: {
    "David@Rut.4.17-Rev": {
      title: { fr: "Le berger de Bethléhem", en: "The shepherd of Bethlehem" },
      roles: ["roi"],
      stages: [
        {
          key: "guerrier",
          label: { fr: "Le chef en fuite", en: "The leader on the run" },
          ranges: [{ book: 9, from: 18, to: 31 }]
        },
        {
          key: "vieux",
          label: { fr: "La fin du règne", en: "The end of the reign" },
          ranges: [{ book: 11, from: 1, to: 2 }]
        }
      ]
    }
  },
  series: [
    {
      id: "rois-unis",
      title: { fr: "Les rois d'Israël uni", en: "The kings of united Israel" },
      members: ["Saul@1Sa.9.2-Act", "David@Rut.4.17-Rev"]
    }
  ],
  roles: { roi: { fr: "Roi", en: "King" } }
};

test("the catalog joins the pictures' hashes to the titles, stages, series and roles", () => {
  const catalog = entityImageCatalog(
    [
      { uniqueName: "b@x", hash: "2" },
      { uniqueName: "David@Rut.4.17-Rev", hash: "d" },
      { uniqueName: "David@Rut.4.17-Rev", stage: "vieux", hash: "dv" },
      { uniqueName: "David@Rut.4.17-Rev", stage: "guerrier", hash: "dg" }
    ],
    DATA
  );
  assert.equal(catalog.version, 3);
  assert.deepEqual(Object.keys(catalog.entities), [
    "David@Rut.4.17-Rev",
    "b@x"
  ]);
  assert.deepEqual(catalog.entities["b@x"], { hash: "2" });
  assert.equal(
    catalog.entities["David@Rut.4.17-Rev"]?.title?.en,
    "The shepherd of Bethlehem"
  );
  assert.deepEqual(
    catalog.entities["David@Rut.4.17-Rev"]?.stages?.map((stage) => [
      stage.key,
      stage.hash
    ]),
    [
      ["guerrier", "dg"],
      ["vieux", "dv"]
    ]
  );
  assert.equal(catalog.series[0]?.members.length, 2);
});

test("the catalog refuses a stage without its picture, a picture without its stage, and overlapping stages", () => {
  const david = { uniqueName: "David@Rut.4.17-Rev", hash: "d" };
  assert.throws(
    () =>
      entityImageCatalog(
        [
          david,
          { uniqueName: "David@Rut.4.17-Rev", stage: "vieux", hash: "v" }
        ],
        DATA
      ),
    /STAGE_PICTURE_MISSING/u
  );
  assert.throws(
    () =>
      entityImageCatalog(
        [
          { uniqueName: "b@x", hash: "2" },
          { uniqueName: "b@x", stage: "jeune", hash: "j" }
        ],
        DATA
      ),
    /STAGE_WITHOUT_DATA/u
  );
  const overlapping: EntityCatalogData = {
    ...DATA,
    entities: {
      "Naaman@2Ki.5.1-Luk": {
        stages: [
          {
            key: "a",
            label: { fr: "A", en: "A" },
            ranges: [{ book: 12, from: 5, to: 5, fromVerse: 1, toVerse: 14 }]
          },
          {
            key: "b",
            label: { fr: "B", en: "B" },
            ranges: [{ book: 12, from: 5, to: 5, fromVerse: 14, toVerse: 19 }]
          }
        ]
      }
    }
  };
  const naaman = [
    { uniqueName: "Naaman@2Ki.5.1-Luk", hash: "n" },
    { uniqueName: "Naaman@2Ki.5.1-Luk", stage: "a", hash: "na" },
    { uniqueName: "Naaman@2Ki.5.1-Luk", stage: "b", hash: "nb" }
  ];
  assert.throws(
    () => entityImageCatalog(naaman, overlapping),
    /STAGES_OVERLAP/u
  );
  overlapping.entities["Naaman@2Ki.5.1-Luk"]!.stages![1]!.ranges[0]!.fromVerse =
    15;
  assert.equal(
    entityImageCatalog(naaman, overlapping).entities["Naaman@2Ki.5.1-Luk"]
      ?.stages?.length,
    2
  );
});

test("the catalog refuses a text missing in one language", () => {
  const untranslated = {
    ...DATA,
    roles: { roi: { fr: "Roi", en: "" } }
  };
  assert.throws(
    () =>
      entityImageCatalog(
        [
          { uniqueName: "David@Rut.4.17-Rev", hash: "d" },
          { uniqueName: "David@Rut.4.17-Rev", stage: "vieux", hash: "dv" },
          { uniqueName: "David@Rut.4.17-Rev", stage: "guerrier", hash: "dg" }
        ],
        untranslated
      ),
    /TEXT_MISSING: roi/u
  );
});

test("an avatar shows the centred square of a picture", () => {
  assert.deepEqual(centredSquare(1254, 1254), { x: 0, y: 0, side: 1254 });
  assert.deepEqual(centredSquare(1600, 900), { x: 350, y: 0, side: 900 });
  assert.deepEqual(centredSquare(900, 1601), { x: 0, y: 350, side: 900 });
});
