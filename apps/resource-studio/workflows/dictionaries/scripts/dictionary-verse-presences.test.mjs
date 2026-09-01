import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildVersePresenceIndex,
  normalizePresenceText
} from "./dictionary-verse-presences.mjs";

const publications = [
  { work: "fr", resourceId: "FR", language: "fr" },
  { work: "en", resourceId: "EN", language: "en" }
];
const entries = new Map([
  [
    "fr",
    [
      { id: 1, word: "Aï" },
      { id: 2, word: "Création" },
      { id: 3, word: "Mer Rouge" },
      { id: 4, word: "Dieu" }
    ]
  ],
  [
    "en",
    [
      { id: 1, word: "Ai" },
      { id: 2, word: "Creation" },
      { id: 3, word: "Red Sea" },
      { id: 4, word: "Chain" }
    ]
  ]
]);

describe("présence exacte des sujets de dictionnaire", () => {
  it("tokenise sans supprimer les accents", () => {
    assert.deepEqual(normalizePresenceText("L’Aï d'autrefois"), [
      "l'aï",
      "d'autrefois"
    ]);
  });

  it("indexe les noms propres et expressions exactes sans dériver les verbes", () => {
    const result = buildVersePresenceIndex({
      publications,
      entries,
      correspondenceIndex: { groups: [] },
      namedSubjects: ["Ai"],
      approvedSingleTokenSubjects: { fr: ["Aï", "Dieu"], en: ["Ai", "God"] },
      bibles: {
        fr: [
          { verseKey: "1-1-1", text: "Paul créa du pain." },
          { verseKey: "6-7-2", text: "Il partit vers Aï et la mer Rouge." },
          { verseKey: "1-2-1", text: "Il parle de la création." },
          { verseKey: "1-3-1", text: "Dieu parla." }
        ],
        en: [
          { verseKey: "6-7-2", text: "He went to Ai by the Red Sea." },
          { verseKey: "1-1-2", text: "He broke the chain." }
        ]
      }
    });
    assert.deepEqual(result.anchorsByWork.get("fr"), [
      { verseKey: "1-3-1", entryId: 4, evidenceKind: "verse-name" },
      { verseKey: "6-7-2", entryId: 1, evidenceKind: "verse-name" },
      { verseKey: "6-7-2", entryId: 3, evidenceKind: "verse-phrase" }
    ]);
    assert.deepEqual(result.anchorsByWork.get("en"), [
      { verseKey: "6-7-2", entryId: 1, evidenceKind: "verse-name" },
      { verseKey: "6-7-2", entryId: 3, evidenceKind: "verse-phrase" }
    ]);
    assert.equal(
      result.anchorsByWork.get("fr").some((anchor) => anchor.entryId === 2),
      false
    );
  });

  it("rejette un alias exact qui désigne plusieurs concepts", () => {
    const result = buildVersePresenceIndex({
      publications: [{ work: "fr", resourceId: "FR", language: "fr" }],
      entries: new Map([
        [
          "fr",
          [
            { id: 1, word: "Maison de Dieu" },
            { id: 2, word: "Maison de Dieu" }
          ]
        ]
      ]),
      correspondenceIndex: { groups: [] },
      namedSubjects: [],
      bibles: { fr: [{ verseKey: "1-1-1", text: "Maison de Dieu" }], en: [] }
    });
    assert.equal(result.anchorsByWork.get("fr").length, 0);
    assert.deepEqual(result.rejectedAliases, [
      { language: "fr", surface: "maison de dieu", reason: "ambiguous-concept" }
    ]);
  });

  it("ne transforme ni un fragment d’alias ni une expression incomplète", () => {
    const result = buildVersePresenceIndex({
      publications: [{ work: "fr", resourceId: "FR", language: "fr" }],
      entries: new Map([
        [
          "fr",
          [
            { id: 1, word: "Crainte de l’Éternel, ou de Dieu" },
            { id: 2, word: "Fils de" }
          ]
        ]
      ]),
      correspondenceIndex: { groups: [] },
      namedSubjects: [],
      bibles: {
        fr: [
          { verseKey: "1-1-1", text: "Il vient de Dieu." },
          { verseKey: "1-1-2", text: "Les fils de Jacob." }
        ],
        en: []
      }
    });
    assert.deepEqual(result.anchorsByWork.get("fr"), []);
  });
});
