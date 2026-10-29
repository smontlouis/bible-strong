import assert from "node:assert/strict";
import test from "node:test";

import {
  backdropsNamed,
  entityBackdropHash,
  entityBackdropKey,
  entityBackdropUrl,
  entityCardCatalog,
  type SourceEntityCard
} from "../src/entityCards.js";
import type { EntityImageCatalog } from "../src/entityImages.js";

const text = (name: string, title: string) => ({
  name,
  fullName: name,
  title,
  chaptersLabel: "1 S 16–17",
  era: "Juges et royauté",
  roles: [],
  series: [],
  meaning: "",
  firstMention: "Ruth 4:17",
  brief: "",
  typeLine: "Humain — Roi"
});

const david = (
  overrides: Partial<SourceEntityCard> = {}
): SourceEntityCard => ({
  id: "David@Rut.4.17-Rev",
  entity: "David@Rut.4.17-Rev",
  stage: null,
  image: "david-1",
  scene: false,
  backdrop: "paturages",
  fadeTop: true,
  family: "human",
  era: "Juges et royauté",
  series: [{ title: "Les rois d’Israël uni", rank: 2, total: 3 }],
  original: "דָּוִד",
  script: "he",
  transliteration: "Dâvid",
  strong: "H1732",
  chapterCount: 259,
  stageIndex: 0,
  stageCount: 4,
  text: {
    fr: text("David", "Le berger de Bethléhem"),
    en: text("David", "The shepherd of Bethlehem")
  },
  line: {
    kind: "citation",
    fr: "Tu marches contre moi avec l’épée.",
    en: "You come against me with sword.",
    ref: "1Sam.17.45",
    refEn: "1Sam.17.45",
    reference: { fr: "1 S 17.45", en: "1 Sam 17:45" },
    speaker: null,
    source: { fr: "1 S 17.45", en: "1 Sam 17:45" },
    reviewed: true
  },
  ...overrides
});

const portraits: EntityImageCatalog = {
  version: 3,
  entities: {
    "David@Rut.4.17-Rev": {
      hash: "aaaaaaaaaaaa",
      stages: [
        {
          key: "roi",
          label: { fr: "Le roi", en: "The king" },
          hash: "bbbbbbbbbbbb",
          ranges: []
        }
      ]
    }
  },
  series: [],
  roles: {}
};

test("a backdrop is stored under its key and the hash of its painting", () => {
  assert.equal(
    entityBackdropKey("paturages", "0123456789ab"),
    "entity-cards/backdrops/paturages/0123456789ab/w768.webp"
  );
  assert.equal(
    entityBackdropUrl("paturages", "0123456789ab"),
    "https://media.bible-strong.app/entity-cards/backdrops/paturages/0123456789ab/w768.webp"
  );
  const first = entityBackdropHash(new Uint8Array([1, 2, 3]));
  assert.match(first, /^[0-9a-f]{12}$/u);
  assert.notEqual(entityBackdropHash(new Uint8Array([1, 2, 4])), first);
});

test("a card is published without its working fields, with the backdrops it names", () => {
  const catalog = entityCardCatalog(
    [
      david(),
      david({
        id: "David@Rut.4.17-Rev~roi",
        stage: "roi",
        backdrop: "salle-trone",
        stageIndex: 2
      })
    ],
    portraits,
    { paturages: "111111111111", "salle-trone": "222222222222" }
  );
  assert.equal(catalog.version, 1);
  assert.deepEqual(catalog.backdrops, {
    paturages: { hash: "111111111111" },
    "salle-trone": { hash: "222222222222" }
  });
  const [card] = catalog.cards;
  assert.equal("image" in card, false);
  assert.equal("reviewed" in card.line, false);
  assert.deepEqual(card.line.text, {
    fr: "Tu marches contre moi avec l’épée.",
    en: "You come against me with sword."
  });
  assert.deepEqual(card.series, [{ rank: 2, total: 3 }]);
  assert.equal(card.fadeTop, true);
});

test("a scene keeps its whole painting and names no backdrop", () => {
  const catalog = entityCardCatalog(
    [david({ scene: true, backdrop: null, fadeTop: false })],
    portraits,
    {}
  );
  assert.equal(catalog.cards[0].backdrop, null);
  assert.deepEqual(catalog.backdrops, {});
});

test("nothing is published while one card is not ready", () => {
  const notReady = [
    david({ line: { ...david().line!, reviewed: false } }),
    david({ id: "David@Rut.4.17-Rev~berger", stage: "berger" }),
    david({ id: "Goliath@1Sa.17.4-1Ch", entity: "Goliath@1Sa.17.4-1Ch" }),
    david({
      id: "David@Rut.4.17-Rev~roi",
      stage: "roi",
      backdrop: "nulle-part"
    }),
    david({
      id: "David@Rut.4.17-Rev~roi",
      stage: "roi",
      line: { ...david().line!, en: "x".repeat(121) }
    })
  ];
  assert.throws(
    () => entityCardCatalog(notReady, portraits, { paturages: "111111111111" }),
    (error: Error) =>
      [
        "sentence not reviewed",
        "no portrait of the stage berger",
        "Goliath@1Sa.17.4-1Ch: no portrait on the media host",
        "backdrop nulle-part is not painted",
        "en sentence is 121 characters",
        "twice in the catalog"
      ].every((problem) => error.message.includes(problem))
  );
});

test("each backdrop is named once, scenes aside", () => {
  assert.deepEqual(
    backdropsNamed([
      david(),
      david({ id: "x" }),
      david({ id: "y", backdrop: "grotte" }),
      david({ id: "z", scene: true, backdrop: null })
    ]),
    ["grotte", "paturages"]
  );
});
