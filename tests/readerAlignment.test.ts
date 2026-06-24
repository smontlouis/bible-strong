import test from "node:test";
import assert from "node:assert/strict";

import {
  alignReaderVerse,
  renderReaderTaggedText
} from "../src/readerAlignment.js";
import { applyCuratedStrongOverrides } from "../src/curatedStrongOverrides.js";
import { buildStrongPhraseLexicon } from "../src/phraseTranslationLexicon.js";
import { parseStrongTokens } from "../src/strongCsv.js";

test("does not add empty tags only because the original has extra Strong occurrences", () => {
  const result = alignReaderVerse({
    targetText: "Dieu vit.",
    original: {
      strongSet: new Set(["H0430", "H7200", "H0996"]),
      source: "original"
    },
    references: [
      reference("one", '<w strong="H0430">Dieu</w> <w strong="H7200">vit</w>.')
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 0);
  assert.doesNotMatch(renderReaderTaggedText(result), /data-empty="true"/);
});

test("adds editorial empty tags when at least two references agree", () => {
  const result = alignReaderVerse({
    targetText: "Dieu sépara la lumière avec les ténèbres.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "Darby",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> d’<w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "DarbyR",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      )
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 1);
  assert.match(renderReaderTaggedText(result), /data-method="editorial-empty"/);
});

test("requires stronger empty consensus when the reader profile asks for it", () => {
  const result = alignReaderVerse({
    targetText: "Dieu sépara la lumière avec les ténèbres.",
    readerPolicy: {
      maxStrongPerWord: 3,
      minEmptySourceAgreement: 3,
      learnedTranslationMinScore: 0.36,
      learnedFunctionWordMode: "restricted"
    },
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w>.'
      ),
      reference(
        "Darby",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w>.'
      )
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("does not add editorial empty tags when target already has enough occurrences", () => {
  const result = alignReaderVerse({
    targetText: "Dieu sépara avec la lumière et avec les ténèbres.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> <w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      ),
      reference(
        "Darby",
        '<w strong="H0430">Dieu</w> <w strong="H0914">sépara</w><w strong="H0996"></w> la <w strong="H0216">lumière</w> d’<w strong="H0996">avec</w> les <w strong="H2822">ténèbres</w>.'
      )
    ]
  });

  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("can block learned function-word enrichment for semantic profiles", () => {
  const result = alignReaderVerse({
    targetText: "avec",
    references: [],
    readerPolicy: {
      maxStrongPerWord: 2,
      minEmptySourceAgreement: 3,
      learnedTranslationMinScore: 0.36,
      learnedFunctionWordMode: "reference-only"
    },
    translationLexicon: {
      exact: new Map([
        [
          "H0996",
          new Map([
            [
              "avec",
              {
                strong: "H0996",
                normalized: "avec",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ]
      ]),
      stem: new Map()
    },
    original: {
      strongSet: new Set(["H0996"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0996"]),
      tokens: [originalToken("o1", ["H0996"])]
    }
  });

  assert.equal(result.assignments.size, 0);
});

test("enriches reader tags from original and learned exact translations", () => {
  const result = alignReaderVerse({
    targetText: "Dieu créa les cieux.",
    references: [
      reference(
        "Sg1910",
        '<w strong="H0430">Dieu</w> créa les <w strong="H8064">cieux</w>.'
      )
    ],
    translationLexicon: {
      exact: new Map([
        [
          "H8064",
          new Map([
            [
              "cieux",
              {
                strong: "H8064",
                normalized: "cieux",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ]
      ]),
      stem: new Map()
    },
    original: {
      strongSet: new Set(["H0430", "H1254", "H8064"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0430", "H1254", "H8064"]),
      tokens: [
        originalToken("o1", ["H0430"]),
        originalToken("o2", ["H1254"]),
        originalToken("o3", ["H8064"])
      ]
    }
  });

  assert.match(renderReaderTaggedText(result), /cieux<\/w>/);
  assert.match(renderReaderTaggedText(result), /strong="H8064"/);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("does not window-match with too-short stems", () => {
  const result = alignReaderVerse({
    targetText: "Le Seigneur parla.",
    references: [reference("bad-window", '<w strong="H1961">seront</w>.')],
    original: {
      strongSet: new Set(["H1961"]),
      source: "original"
    }
  });

  assert.equal(result.assignments.size, 0);
});

test("does not use hand-coded semantic equivalents", () => {
  const result = alignReaderVerse({
    targetText: "Les humains arrivèrent.",
    references: [],
    translationLexicon: {
      exact: new Map([
        [
          "H0120",
          new Map([
            [
              "hommes",
              {
                strong: "H0120",
                normalized: "hommes",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ],
        [
          "H0376",
          new Map([
            [
              "hommes",
              {
                strong: "H0376",
                normalized: "hommes",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ]
      ]),
      stem: new Map()
    },
    original: {
      strongSet: new Set(["H0120", "H0376"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0120", "H0376"]),
      tokens: [
        originalToken("o1", ["H0120"], "noun"),
        originalToken("o2", ["H0376"], "noun")
      ]
    }
  });

  assert.equal(result.assignments.has(1), false);
});

test("does not relocate to a synonym without direct lexical evidence", () => {
  const result = alignReaderVerse({
    targetText:
      "Voici la généalogie de Noé parmi les générations de son temps.",
    references: [
      reference(
        "Darby",
        'Voici les <w strong="H8435">générations</w> de Noé dans son <w strong="H1755">temps</w>.'
      )
    ],
    translationLexicon: {
      exact: new Map([
        [
          "H8435",
          new Map([
            [
              "generations",
              {
                strong: "H8435",
                normalized: "generations",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ],
        [
          "H1755",
          new Map([
            [
              "temps",
              {
                strong: "H1755",
                normalized: "temps",
                score: 1,
                source: "test",
                method: "learned-translation"
              }
            ]
          ])
        ]
      ]),
      stem: new Map()
    },
    original: {
      strongSet: new Set(["H8435", "H1755"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 6,
      verse: 9,
      strongSet: new Set(["H8435", "H1755"]),
      tokens: [
        originalToken("o1", ["H8435"], "noun"),
        originalToken("o2", ["H1755"], "noun")
      ]
    }
  });

  const rendered = renderReaderTaggedText(result);
  assert.doesNotMatch(rendered, /strong="H8435"[^>]*>généalogie<\/w>/);
  assert.match(rendered, /strong="H8435"[^>]*>générations<\/w>/);
  assert.match(rendered, /strong="H1755"[^>]*>temps<\/w>/);
  assert.doesNotMatch(rendered, /strong="H8435 H1755"[^>]*>généalogie<\/w>/);
});

test("uses original order to split human and male Strong codes when lexical evidence exists", () => {
  const result = alignReaderVerse({
    targetText:
      "Dieu créa les humains à son image ; homme et femme il les créa.",
    references: [
      reference(
        "Sg1910",
        'Dieu créa <w strong="H0120">homme</w> ; <w strong="H2145">homme</w> et <w strong="H5347">femme</w>.'
      ),
      reference(
        "Darby",
        'Dieu créa <w strong="H0120">homme</w> ; <w strong="H2145">mâle</w> et <w strong="H5347">femelle</w>.'
      )
    ],
    translationLexicon: semanticLexicon([
      ["H0120", "humains"],
      ["H0120", "homme"],
      ["H2145", "homme"],
      ["H5347", "femme"]
    ]),
    original: {
      strongSet: new Set(["H0120", "H2145", "H5347"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 27,
      strongSet: new Set(["H0120", "H2145", "H5347"]),
      tokens: [
        originalToken("o1", ["H0120"], "L", "HTd/Ncmsa"),
        originalToken("o2", ["H2145"], "L", "HAamsa"),
        originalToken("o3", ["H5347"], "L", "HNcfsa")
      ]
    }
  });

  const rendered = renderReaderTaggedText(result);
  assert.match(rendered, /strong="H0120"[^>]*>humains<\/w>/);
  assert.match(rendered, /strong="H2145"[^>]*>homme<\/w>/);
  assert.doesNotMatch(rendered, /strong="H0120 H2145"[^>]*>homme<\/w>/);
});

test("prunes duplicate reader placements beyond the verse Strong budget", () => {
  const result = alignReaderVerse({
    targetText: "La terre produisit de la verdure, de l’herbe porteuse.",
    references: [
      reference(
        "Sg1910",
        'La terre produisit de la <w strong="H1877">verdure</w>, de l’<w strong="H6212">herbe</w>.'
      ),
      reference(
        "Darby",
        'La terre produisit de l’<w strong="H1877">herbe</w>, une <w strong="H6212">plante</w>.'
      )
    ],
    translationLexicon: semanticLexicon([
      ["H1877", "herbe"],
      ["H6212", "herbe"]
    ]),
    original: {
      strongSet: new Set(["H1877", "H6212"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 12,
      strongSet: new Set(["H1877", "H6212"]),
      tokens: [
        originalToken("o1", ["H1877"], "noun"),
        originalToken("o2", ["H6212"], "noun")
      ]
    }
  });

  const strongCodes = [...result.assignments.values()].flatMap(
    (assignment) => assignment.strong
  );
  assert.equal(strongCodes.filter((strong) => strong === "H1877").length, 1);
  assert.deepEqual(result.assignments.get(5)?.strong, ["H1877"]);
  assert.deepEqual(result.assignments.get(7)?.strong, ["H6212"]);
});

test("does not cover NBS Genesis 6 semantic carriers without lexical evidence", () => {
  const repentance = alignReaderVerse({
    targetText: "Le Seigneur regretta les humains.",
    references: [],
    translationLexicon: semanticLexicon([
      ["H3068", "eternel"],
      ["H5162", "repentit"],
      ["H0120", "hommes"]
    ]),
    original: {
      strongSet: new Set(["H3068", "H5162", "H0120"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 6,
      verse: 6,
      strongSet: new Set(["H3068", "H5162", "H0120"]),
      tokens: [
        originalToken("o1", ["H3068"], "noun"),
        originalToken("o2", ["H5162"], "verb"),
        originalToken("o3", ["H0120"], "noun")
      ]
    }
  });

  const repentanceRendered = renderReaderTaggedText(repentance);
  assert.doesNotMatch(repentanceRendered, /strong="H3068"/);
  assert.doesNotMatch(repentanceRendered, /strong="H5162"/);
  assert.doesNotMatch(repentanceRendered, /strong="H0120"/);

  const corruption = alignReaderVerse({
    targetText: "Les Nephilim étaient pervertis ; je vais les anéantir.",
    references: [],
    translationLexicon: semanticLexicon([
      ["H5303", "geants"],
      ["H7843", "corrompus"]
    ]),
    original: {
      strongSet: new Set(["H5303", "H7843"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 6,
      verse: 13,
      strongSet: new Set(["H5303", "H7843"]),
      tokens: [
        originalToken("o1", ["H5303"], "noun"),
        originalToken("o2", ["H7843"], "verb"),
        originalToken("o3", ["H7843"], "verb")
      ]
    }
  });

  const corruptionRendered = renderReaderTaggedText(corruption);
  assert.doesNotMatch(corruptionRendered, /strong="H5303"/);
  assert.doesNotMatch(corruptionRendered, /strong="H7843"/);
});

test("does not enrich reader tags from hand-coded original Strong rules", () => {
  const result = alignReaderVerse({
    targetText: "Qu’il y ait de la lumière, et il y eut de la lumière.",
    references: [],
    translationLexicon: { exact: new Map(), stem: new Map() },
    original: {
      strongSet: new Set(["H1961", "H0216"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 3,
      strongSet: new Set(["H1961", "H0216"]),
      tokens: [
        originalToken("o1", ["H1961"]),
        originalToken("o2", ["H0216"]),
        originalToken("o3", ["H1961"])
      ]
    }
  });

  const rendered = renderReaderTaggedText(result);
  assert.doesNotMatch(rendered, /strong="H1961"/);
  assert.equal(result.assignments.size, 0);
  assert.equal(result.emptyStrongOccurrenceCount, 0);
});

test("enriches reader tags with learned multi-word phrase context", () => {
  const result = alignReaderVerse({
    targetText: "Il prit femme.",
    references: [],
    translationLexicon: { exact: new Map(), stem: new Map() },
    phraseLexicon: {
      byStrong: new Map([
        [
          "H0802",
          [
            {
              strong: "H0802",
              phrase: ["prit", "femme"],
              offset: 1,
              score: 1,
              source: "test",
              method: "learned-phrase"
            }
          ]
        ]
      ])
    },
    original: {
      strongSet: new Set(["H0802"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0802"]),
      tokens: [originalToken("o1", ["H0802"])]
    }
  });

  assert.equal(result.assignments.has(2), false);
  assert.deepEqual(result.phraseAssignments[0]?.strong, ["H0802"]);
  assert.equal(result.phraseAssignments[0]?.method, "learned-phrase");
  assert.equal(result.phraseAssignments[0]?.startWordIndex, 1);
  assert.equal(result.phraseAssignments[0]?.endWordIndex, 2);
  assert.match(
    renderReaderTaggedText(result),
    /<w strong="H0802"[^>]*data-target="phrase">prit femme<\/w>/
  );
});

test("learned phrase assignment does not duplicate existing Strong on covered words", () => {
  const result = alignReaderVerse({
    targetText: "Il prit femme.",
    references: [reference("existing", 'Il prit <w strong="H0802">femme</w>.')],
    translationLexicon: { exact: new Map(), stem: new Map() },
    phraseLexicon: {
      byStrong: new Map([
        [
          "H0802",
          [
            {
              strong: "H0802",
              phrase: ["prit", "femme"],
              offset: 1,
              score: 1,
              source: "test",
              method: "learned-phrase"
            }
          ]
        ]
      ])
    },
    original: {
      strongSet: new Set(["H0802"]),
      source: "original"
    },
    originalVerse: {
      bookId: "Gen",
      chapter: 1,
      verse: 1,
      strongSet: new Set(["H0802"]),
      tokens: [originalToken("o1", ["H0802"])]
    }
  });

  assert.equal(result.phraseAssignments.length, 0);
  assert.deepEqual(result.assignments.get(2)?.strong, ["H0802"]);
  assert.equal(result.totalStrongOccurrenceCount, 1);
});

test("learns repeated phrase candidates from Strong references", () => {
  const map = new Map([
    [
      "Gen.1.1",
      {
        row: {
          bookId: "Gen",
          chapter: 1,
          verse: 1,
          text: '<w strong="H3947">prit</w> <w strong="H0802">femme</w>'
        },
        tokens: parseStrongTokens(
          '<w strong="H3947">prit</w> <w strong="H0802">femme</w>'
        )
      }
    ]
  ]);
  const lexicon = buildStrongPhraseLexicon([
    { name: "one", map },
    { name: "two", map }
  ]);

  assert.equal(
    lexicon.byStrong.get("H0802")?.[0]?.phrase.join(" "),
    "prit femme"
  );
});

test("applies reviewed LLM transfer overrides only when the target word still matches", () => {
  const result = alignReaderVerse({
    targetText:
      "La terre était un chaos, elle était vide ; il y avait des ténèbres au-dessus de l’abîme, et le souffle de Dieu tournoyait au-dessus des eaux.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "nbs",
    ref: "Gen.1.2",
    result
  });

  assert.equal(applied, 2);
  assert.deepEqual(result.assignments.get(18)?.strong, ["H7307"]);
  assert.deepEqual(result.assignments.get(21)?.strong, ["H7363"]);
  assert.equal(result.assignments.get(18)?.method, "curated-llm-transfer");
});

test("skips reviewed LLM transfer overrides when token indexes drift", () => {
  const result = alignReaderVerse({
    targetText:
      "La terre était informe et vide ; le souffle puissant de Dieu tournoyait au-dessus des eaux.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "nbs",
    ref: "Gen.1.2",
    result
  });

  assert.equal(applied, 0);
  assert.equal(result.assignments.size, 0);
});

test("applies curated empty Strong overrides without a target word", () => {
  const result = alignReaderVerse({
    targetText: "Dieu vit.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "fixture-empty",
    ref: "Gen.1.4",
    result
  });

  assert.equal(applied, 1);
  assert.equal(result.emptyStrongOccurrenceCount, 1);
  assert.equal(result.totalStrongOccurrenceCount, 1);
  assert.match(renderReaderTaggedText(result), /data-method="curated-empty"/);
  assert.match(renderReaderTaggedText(result), /strong="H0996"/);
});

test("applies curated phrase Strong overrides across multiple target words", () => {
  const result = alignReaderVerse({
    targetText: "Il agit dans la mesure où il parle.",
    references: []
  });

  const applied = applyCuratedStrongOverrides({
    bible: "fixture-phrase",
    ref: "Heb.1.4",
    result
  });

  assert.equal(applied, 1);
  assert.equal(result.phraseAssignments.length, 1);
  assert.equal(result.taggedWordCount, 4);
  assert.equal(result.totalStrongOccurrenceCount, 1);
  assert.match(
    renderReaderTaggedText(result),
    /<w strong="G3745"[^>]*data-target="phrase">dans la mesure où<\/w>/
  );
});

test("applies curated relocation overrides without deleting unrelated Strong", () => {
  const result = alignReaderVerse({
    targetText:
      "Dieu créa les humains à son image : il les créa à l’image de Dieu ; homme et femme il les créa.",
    references: []
  });
  result.assignments.set(14, {
    strong: ["H0120", "H2145"],
    confidence: 0.9,
    source: "test",
    method: "test",
    originalConfirmed: true
  });

  const applied = applyCuratedStrongOverrides({
    bible: "fixture-move",
    ref: "Gen.1.27",
    result
  });

  assert.equal(applied, 1);
  assert.deepEqual(result.assignments.get(3)?.strong, ["H0120"]);
  assert.deepEqual(result.assignments.get(14)?.strong, ["H2145"]);
});

function reference(name: string, text: string) {
  return {
    name,
    verse: {
      row: { bookId: "Gen", chapter: 1, verse: 4, text },
      tokens: parseStrongTokens(text)
    }
  };
}

function semanticLexicon(entries: Array<[string, string]>) {
  const exact = new Map();
  for (const [strong, normalized] of entries) {
    const forms = exact.get(strong) ?? new Map();
    forms.set(normalized, {
      strong,
      normalized,
      score: 1,
      source: "test",
      method: "learned-translation"
    });
    exact.set(strong, forms);
  }

  return {
    exact,
    stem: new Map()
  };
}

function originalToken(id: string, strong: string[], pos = "", morph = "") {
  return {
    id,
    text: "",
    strong,
    gloss: "",
    lemma: "",
    pos,
    morph
  };
}
