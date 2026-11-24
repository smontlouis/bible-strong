import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  borrowNeighbourPictures,
  chooseChapterPlaces,
  chooseChapterScenes,
  parseTipnrPlaces
} from "../src/bibleAudioPlaces.ts";

const tipnr = [
  "Eden@Gen.2.8-Jol=H5731B\t\t\t\t\t\tPlace",
  "– Named\tEden@Gen.2.8-Jol\tH5731B\tEden\turl\tGen.2.8; Gen.2.10; Gen.2.15; Gen.3.23; Isa.51.3",
  "Eden@2Ch.29.12=H5731A\tMan\t\t\t\t\tMale",
  "– Named\tEden@2Ch.29.12\tH5731A\tEden\turl\t2Ch.29.12",
  "Assyria@Gen.2.14-Zec=H0804\t\t\t\t\t\tPlace",
  "– Named\tAssyria@Gen.2.14-Zec\tH0804\tAssyria\turl\tGen.2.14; Isa.7.17; Isa.7.18; Isa.7.20",
  "Patmos@Rev.1.9=G3963\t\t\t\t\t\tPlace",
  "– Named\tPatmos@Rev.1.9\tG3963\tPatmos\turl\tRev.1.9",
  "Ephesus@Act.18.19-Rev=G2181\t\t\t\t\t\tPlace",
  "– Named\tEphesus@Act.18.19-Rev\tG2181\tEphesus\turl\tAct.18.19; Act.19.1; Rev.1.11; Rev.2.1",
  "– LXX addition\tEdem|Eden@Gen.2.8-Jol\tH5731B\tEdem\turl\tLXX.Gen.46.20"
].join("\n");

describe("parseTipnrPlaces", () => {
  it("keeps the places with the verses that name them", () => {
    const places = parseTipnrPlaces(tipnr);
    assert.deepEqual([...places.keys()].sort(), [
      "Assyria@Gen.2.14-Zec",
      "Eden@Gen.2.8-Jol",
      "Ephesus@Act.18.19-Rev",
      "Patmos@Rev.1.9"
    ]);
    assert.equal(places.get("Eden@Gen.2.8-Jol")?.length, 5);
  });
});

describe("chooseChapterPlaces", () => {
  const places = parseTipnrPlaces(tipnr);
  const painted = new Set(places.keys());

  it("takes the place named most often in the chapter", () => {
    assert.equal(
      chooseChapterPlaces(places, painted)["1:2"],
      "Eden@Gen.2.8-Jol"
    );
  });

  it("takes the place named first on a tie, whatever its fame", () => {
    assert.equal(
      chooseChapterPlaces(places, painted)["66:1"],
      "Patmos@Rev.1.9"
    );
  });

  it("only counts the places with a portrait", () => {
    const chosen = chooseChapterPlaces(
      places,
      new Set(["Assyria@Gen.2.14-Zec"])
    );
    assert.equal(chosen["1:2"], "Assyria@Gen.2.14-Zec");
    assert.equal(chosen["66:1"], undefined);
  });

  it("follows the overrides, and refuses a place without a portrait", () => {
    const chosen = chooseChapterPlaces(places, painted, {
      "23:7": "Assyria@Gen.2.14-Zec",
      "1:3": null
    });
    assert.equal(chosen["23:7"], "Assyria@Gen.2.14-Zec");
    assert.equal(chosen["1:3"], undefined);
    assert.throws(() =>
      chooseChapterPlaces(places, painted, { "1:1": "Rome@Jhn.11.48-Phm" })
    );
  });
});

describe("chooseChapterScenes", () => {
  const scenes = [
    { slug: "flood", scriptures: ["1|7:6-12"] },
    { slug: "noah", scriptures: ["1|6:9", "1|7:1", "1|8:20"] },
    { slug: "simeon", scriptures: ["42|2:25-35"] },
    { slug: "jesus", scriptures: ["40|2:1-2", "42|2:7"] }
  ];

  it("takes the scene that tells most of the chapter", () => {
    const chosen = chooseChapterScenes(scenes);
    assert.equal(chosen["1:7"], "flood");
    assert.equal(chosen["1:6"], "noah");
    assert.equal(chosen["42:2"], "simeon");
  });

  it("follows the overrides, and refuses a scene without a painting", () => {
    assert.equal(
      chooseChapterScenes(scenes, { "42:2": "jesus" })["42:2"],
      "jesus"
    );
    assert.throws(() => chooseChapterScenes(scenes, { "1:1": "creation" }));
  });
});

describe("borrowNeighbourPictures", () => {
  it("lends a chapter the nearest picture of its book, within reach", () => {
    const { scenes, places, borrowed } = borrowNeighbourPictures(
      { "1:4": "abel", "1:7": "flood" },
      { "1:2": "Eden@Gen.2.8-Jol" }
    );
    assert.equal(places["1:1"], "Eden@Gen.2.8-Jol");
    assert.equal(places["1:3"], "Eden@Gen.2.8-Jol");
    assert.equal(scenes["1:5"], "abel");
    assert.equal(scenes["1:6"], "flood");
    assert.equal(scenes["1:11"], undefined);
    assert.ok(borrowed >= 4);
  });
});
