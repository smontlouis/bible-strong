import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildLexicalCandidateReport,
  lexicalAutoSafePlacements
} from "../src/lexicalCandidateReport.js";
import { type StrongTranslationCandidate } from "../src/translationLexicon.js";

test("builds lexical candidates for advanced empty Strong annotations", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const kaikkipath = path.join(dir, "kaikki.jsonl");
  const jdmCache = path.join(dir, "jdm");

  await mkdir(jdmCache, { recursive: true });
  writeFileSync(ledgerPath, JSON.stringify(fakeLedger(), null, 2));
  writeFileSync(
    kaikkipath,
    [
      kaikkiEntry(
        "amassent",
        "verb",
        [],
        ["third-person plural of amasser"],
        ["amasser"]
      ),
      kaikkiEntry("amasser", "verb", ["amassent"], ["to gather up"]),
      kaikkiEntry("donne", "verb", [], ["form of donner"], ["donner"]),
      kaikkiEntry("donner", "verb", ["donne"], ["to give"]),
      kaikkiEntry("produire", "verb", ["produisent"], ["to produce, to yield"]),
      kaikkientry("portent", "verb", [], ["form of porter"], ["porter"]),
      kaikkientry("porter", "verb", ["portent"], ["to support, to bear"])
    ].join("\n")
  );
  await writeJdm(jdmCache, "donner", [
    ["produire", 517],
    ["porter", 404]
  ]);
  await writeJdm(jdmCache, "porter", [["produire", 272]]);

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    kaikkiPath: kaikkipath,
    jdmCacheDir: jdmCache,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: dictionaryCandidates()
  });

  assert.equal(report.metrics.emptyAnnotations, 3);
  assert.equal(report.metrics.emptyWithCandidates, 3);
  assertTopCandidate(report, "Gen.1.9", "H6960", "amassent");
  assertTopCandidate(report, "Gen.1.11", "H1876", "donne");
  assertTopCandidate(report, "Gen.1.12", "H6213", "portent");
});

test("uses conservative Strong dictionary stems as direct lexical evidence", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.5.1",
            "Voici le livre de la généalogie d’Adam.",
            [
              token(0, "Voici"),
              token(1, "le"),
              token(2, "livre"),
              token(3, "de"),
              token(4, "la"),
              token(5, "généalogie"),
              token(6, "d’Adam")
            ],
            empty("Gen.5.1:0:H8435", "H8435", "descendants", 2)
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.5.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H8435", "genealog", 0.5)]
  });

  const item = report.items.find(
    (candidate) => candidate.ref === "Gen.5.1" && candidate.strong === "H8435"
  );
  const topCandidate = item?.candidates[0];
  assert.equal(topCandidate?.normalized, "genealogie");
  assert.equal(topCandidate?.evidence[0]?.source, "seed-stem");
});

test("promotes French auxiliary plus participle as an auto-safe verb phrase", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.2.8",
            "Il y mit l’homme qu’il avait façonné.",
            [
              token(0, "Il"),
              token(1, "y"),
              token(2, "mit"),
              token(3, "l’homme"),
              token(4, "qu’il"),
              token(5, "avait"),
              token(6, "façonné")
            ],
            empty("Gen.2.8:0:H3335", "H3335", "he had formed", 3, "HVqp3ms")
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.2.8",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H3335", "faconne", 1)]
  });

  const placement = lexicalAutoSafePlacements(report).find(
    (candidate) => candidate.item.annotationId === "Gen.2.8:0:H3335"
  );
  assert.equal(placement?.candidate.target, "phrase");
  assert.equal(placement?.candidate.normalized, "avait faconne");
  assert.equal(
    placement?.candidate.evidence.some(
      (evidence) => evidence.source === "french-auxiliary-phrase"
    ),
    true
  );
});

test("allows numeric Strong components on occupied compound numbers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.5.15",
            "Mahalaléel vécut soixante-cinq ans.",
            [
              token(0, "Mahalaléel"),
              token(1, "vécut"),
              token(2, "soixante-cinq"),
              token(3, "ans")
            ],
            [
              word("Gen.5.15:0:H8346", "H8346", "sixty", 2),
              empty("Gen.5.15:1:H2568", "H2568", "five", 1, "HAcbsa")
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.5.15",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H2568", "cinq", 0.5)]
  });

  const item = report.items.find(
    (candidate) => candidate.ref === "Gen.5.15" && candidate.strong === "H2568"
  );
  const topCandidate = item?.candidates[0];
  assert.equal(topCandidate?.normalized, "soixante-cinq");
  assert.equal(topCandidate?.occupied, true);
  assert.equal(topCandidate?.confidence, "high");
  assert.equal(topCandidate?.evidence[0]?.source, "number-component");
  assert.equal(report.metrics.autoSafeItems, 1);
});

test("decomposes French teen and quatre-vingt compound numbers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.5.17",
            "Il vécut quatre-vingt-quinze ans, puis douze ans.",
            [
              token(0, "Il"),
              token(1, "vécut"),
              token(2, "quatre-vingt-quinze"),
              token(3, "ans"),
              token(4, "puis"),
              token(5, "douze"),
              token(6, "ans")
            ],
            [
              word(
                "Gen.5.17:0:H8084",
                "H8084",
                "eighty",
                2,
                "HAcbsa",
                "quatre-vingt-quinze"
              ),
              empty("Gen.5.17:1:H2568", "H2568", "five", 1, "HAcbsa"),
              empty("Gen.5.17:2:H6240", "H6240", "ten", 4, "HAcbsa"),
              empty("Gen.5.17:3:H8147", "H8147", "two", 4, "HAcbsa")
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.5.17",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [
      candidate("H3382", "jared", 0.5),
      candidate("H4968", "mathusala", 0.5)
    ]
  });

  assert.equal(
    topCandidateFor(report, "Gen.5.17", "H2568")?.normalized,
    "quatre-vingt-quinze"
  );
  assert.equal(
    topCandidateFor(report, "Gen.5.17", "H6240")?.normalized,
    "douze"
  );
  assert.equal(
    topCandidateFor(report, "Gen.5.17", "H8147")?.normalized,
    "douze"
  );
});

test("matches STEP proper names across French transliteration drift", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.5.21",
            "Il engendra Yéred et Mathusalem.",
            [
              token(0, "Il"),
              token(1, "engendra"),
              token(2, "Yéred"),
              token(3, "et"),
              token(4, "Mathusalem")
            ],
            [
              empty("Gen.5.21:0:H3382", "H3382", "Jared", 1, "HNpm", "Ya.red"),
              empty(
                "Gen.5.21:1:H4968",
                "H4968",
                "Methuselah",
                3,
                "HNpm",
                "me.tu.Sha.lach"
              )
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.5.21",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [
      candidate("H3382", "jared", 0.5),
      candidate("H4968", "mathusala", 0.5)
    ]
  });

  assert.equal(
    topCandidateFor(report, "Gen.5.21", "H3382")?.normalized,
    "yered"
  );
  assert.equal(
    topCandidateFor(report, "Gen.5.21", "H4968")?.normalized,
    "mathusalem"
  );
  assert.equal(report.metrics.autoSafeItems, 2);
});

test("resolves repeated lexical empty Strong codes across repeated French carriers", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const kaikkipath = path.join(dir, "kaikki.jsonl");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.2.4",
            "Voilà la généalogie du ciel et de la terre, quand ils furent créés. Au jour où le Seigneur Dieu fit la terre et le ciel.",
            [
              token(0, "Voilà"),
              token(1, "la"),
              token(2, "généalogie"),
              token(3, "du"),
              token(4, "ciel"),
              token(5, "et"),
              token(6, "de"),
              token(7, "la"),
              token(8, "terre"),
              token(9, "quand"),
              token(10, "ils"),
              token(11, "furent"),
              token(12, "créés"),
              token(13, "Au"),
              token(14, "jour"),
              token(15, "où"),
              token(16, "le"),
              token(17, "Seigneur"),
              token(18, "Dieu"),
              token(19, "fit"),
              token(20, "la"),
              token(21, "terre"),
              token(22, "et"),
              token(23, "le"),
              token(24, "ciel")
            ],
            [
              empty("Gen.2.4:0:H8064", "H8064", "the heavens", 1),
              empty("Gen.2.4:1:H8064", "H8064", "and heaven", 21)
            ]
          )
        ]
      },
      null,
      2
    )
  );
  writeFileSync(kaikkipath, kaikkiEntry("ciel", "noun", [], ["heaven", "sky"]));

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.2.4",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    kaikkiPath: kaikkipath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H8064", "ciel", 0.5)]
  });

  const placements = lexicalAutoSafePlacements(report).filter(
    (candidate) => candidate.item.strong === "H8064"
  );
  assert.deepEqual(
    placements.map((placement) => placement.candidate.wordIndex),
    [4, 24]
  );
  assert.equal(report.metrics.groupAutoSafeItems, 2);
});

test("relocates numeric components from a simple number to a later compound number", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.4.24",
            "Si Caïn doit être vengé sept fois, Lémek le sera soixante-dix-sept fois !",
            [
              token(0, "Si"),
              token(1, "Caïn"),
              token(2, "doit"),
              token(3, "être"),
              token(4, "vengé"),
              token(5, "sept"),
              token(6, "fois"),
              token(7, "Lémek"),
              token(8, "le"),
              token(9, "sera"),
              token(10, "soixante-dix-sept"),
              token(11, "fois")
            ],
            [
              word(
                "Gen.4.24:0:H7659",
                "H7659",
                "sevenfold",
                5,
                "HAcfda",
                "sept"
              ),
              word(
                "Gen.4.24:1:H7651",
                "H7651",
                "and/ seven",
                5,
                "HC/Acbsa",
                "sept"
              ),
              word(
                "Gen.4.24:2:H7657",
                "H7657",
                "seventy",
                10,
                "HAcmpa",
                "soixante-dix-sept"
              )
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.4.24",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H7651", "sept", 0.5)]
  });

  const item = report.items.find(
    (candidate) => candidate.ref === "Gen.4.24" && candidate.strong === "H7651"
  );
  assert.equal(item?.currentTarget?.normalized, "sept");
  assert.equal(item?.candidates[0]?.normalized, "sept");

  const placement = lexicalAutoSafePlacements(report).find(
    (candidate) => candidate.item.annotationId === "Gen.4.24:1:H7651"
  );
  assert.equal(placement?.candidate.normalized, "soixante-dix-sept");
  assert.equal(placement?.kind, "auto-safe");
});

test("places duplicate numeric empties on the richer compound carrier", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.5.27",
            "Mathusalem fut de neuf cent soixante-neuf ans.",
            [
              token(0, "Mathusalem"),
              token(1, "fut"),
              token(2, "de"),
              token(3, "neuf"),
              token(4, "cent"),
              token(5, "soixante-neuf"),
              token(6, "ans")
            ],
            [
              word("Gen.5.27:0:H8672", "H8672", "nine", 3, "HAcbsa", "neuf"),
              word("Gen.5.27:1:H3967", "H3967", "hundred", 4, "HAcbsa"),
              word(
                "Gen.5.27:2:H8346",
                "H8346",
                "sixty",
                5,
                "HAcbsa",
                "soixante-neuf"
              ),
              empty("Gen.5.27:3:H8672", "H8672", "nine", 5, "HAcbsa")
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.5.27",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H8672", "neuf", 0.5)]
  });

  const placement = lexicalAutoSafePlacements(report).find(
    (candidate) => candidate.item.annotationId === "Gen.5.27:3:H8672"
  );
  assert.equal(placement?.candidate.normalized, "soixante-neuf");
  assert.equal(placement?.kind, "auto-safe");
});

test("keeps numeric components on richer compound numbers after relocation", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");

  writeFileSync(
    ledgerPath,
    JSON.stringify(
      {
        bible: "nbs",
        generatedAt: "2026-06-24T00:00:00.000Z",
        split: false,
        metrics: {},
        verses: [
          verse(
            "Gen.4.24",
            "Si Caïn doit être vengé sept fois, Lémek le sera soixante-dix-sept fois !",
            [
              token(0, "Si"),
              token(1, "Caïn"),
              token(2, "doit"),
              token(3, "être"),
              token(4, "vengé"),
              token(5, "sept"),
              token(6, "fois"),
              token(7, "Lémek"),
              token(8, "le"),
              token(9, "sera"),
              token(10, "soixante-dix-sept"),
              token(11, "fois")
            ],
            [
              word(
                "Gen.4.24:0:H7659",
                "H7659",
                "sevenfold",
                5,
                "HAcfda",
                "sept"
              ),
              word(
                "Gen.4.24:1:H7651",
                "H7651",
                "and/ seven",
                10,
                "HC/Acbsa",
                "soixante-dix-sept"
              ),
              word(
                "Gen.4.24:2:H7657",
                "H7657",
                "seventy",
                10,
                "HAcmpa",
                "soixante-dix-sept"
              )
            ]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Gen.4.24",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H7651", "sept", 0.5)]
  });

  const placement = lexicalAutoSafePlacements(report).find(
    (candidate) => candidate.item.annotationId === "Gen.4.24:1:H7651"
  );
  assert.equal(placement, undefined);
});

function assertTopCandidate(
  report: Awaited<ReturnType<typeof buildLexicalCandidateReport>>,
  ref: string,
  strong: string,
  normalized: string
): void {
  assert.equal(topCandidateFor(report, ref, strong)?.normalized, normalized);
}

function topCandidateFor(
  report: Awaited<ReturnType<typeof buildLexicalCandidateReport>>,
  ref: string,
  strong: string
) {
  const item = report.items.find(
    (candidate) => candidate.ref === ref && candidate.strong === strong
  );
  return item?.candidates[0];
}

function dictionaryCandidates(): StrongTranslationCandidate[] {
  return [
    candidate("H6960", "rassembler", 0.5),
    candidate("H1876", "germer", 0.5),
    candidate("H1876", "pousser", 0.3),
    candidate("H6213", "produire", 0.5)
  ];
}

function candidate(
  strong: string,
  normalized: string,
  score: number
): StrongTranslationCandidate {
  return {
    strong,
    normalized,
    score,
    source: "test",
    method: "dictionary-fr-exact"
  };
}

function fakeLedger() {
  return {
    bible: "nbs",
    generatedAt: "2026-06-24T00:00:00.000Z",
    split: false,
    metrics: {},
    verses: [
      verse(
        "Gen.1.9",
        "Que les eaux s’amassent.",
        [
          token(0, "Que"),
          token(1, "les"),
          token(2, "eaux"),
          token(3, "s’amassent")
        ],
        empty("Gen.1.9:0:H6960", "H6960", "let them gather", 0)
      ),
      verse(
        "Gen.1.11",
        "Que la terre donne de la verdure.",
        [
          token(0, "Que"),
          token(1, "la"),
          token(2, "terre"),
          token(3, "donne"),
          token(4, "de"),
          token(5, "la"),
          token(6, "verdure")
        ],
        empty("Gen.1.11:0:H1876", "H1876", "let her produce", 0)
      ),
      verse(
        "Gen.1.12",
        "Des arbres portent du fruit.",
        [
          token(0, "Des"),
          token(1, "arbres"),
          token(2, "portent"),
          token(3, "du"),
          token(4, "fruit")
        ],
        empty("Gen.1.12:0:H6213", "H6213", "bearing", 1)
      )
    ]
  };
}

function verse(
  ref: string,
  text: string,
  tokens: Array<{ wordIndex: number; text: string; normalized: string }>,
  annotation: unknown | unknown[]
) {
  const [bookId, chapter, verseNumber] = ref.split(".");
  return {
    ref,
    bookId,
    chapter: Number(chapter),
    verse: Number(verseNumber),
    text,
    tokens,
    annotations: Array.isArray(annotation) ? annotation : [annotation],
    inventories: { references: {}, original: [] },
    metrics: {},
    views: {}
  };
}

function token(wordIndex: number, text: string) {
  return {
    wordIndex,
    text,
    normalized: text
      .toLocaleLowerCase("fr-FR")
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/^s[’'](.+)$/u, "$1")
  };
}

function word(
  id: string,
  strong: string,
  gloss: string,
  wordIndex: number,
  morphology = "",
  normalizedWord = ""
) {
  return {
    id,
    strong,
    visibility: "reader",
    placement: "word",
    source: "reference-transfer",
    confidence: 0.8,
    reason: "test",
    diagnostics: [],
    wordIndex,
    normalizedWord,
    lexiconLookup: true,
    step: [
      {
        source: "TAHOT",
        classicalStrong: strong,
        dStrong: strong,
        tokenIndex: 1,
        type: "L",
        surface: "",
        transliteration: "",
        gloss,
        morphology,
        editions: ""
      }
    ]
  };
}

function empty(
  id: string,
  strong: string,
  gloss: string,
  insertAfterWordIndex: number,
  morphology = "",
  transliteration = ""
) {
  return {
    id,
    strong,
    visibility: "advanced",
    placement: "empty",
    source: "original-complete",
    confidence: 0.35,
    reason: "test",
    diagnostics: ["empty-original"],
    insertAfterWordIndex,
    lexiconLookup: true,
    step: [
      {
        source: "TAHOT",
        classicalStrong: strong,
        dStrong: strong,
        tokenIndex: 1,
        type: "L",
        surface: "",
        transliteration,
        gloss,
        morphology,
        editions: ""
      }
    ]
  };
}

function kaikkiEntry(
  word: string,
  pos: string,
  forms: string[],
  glosses: string[],
  formOf: string[] = []
): string {
  return JSON.stringify({
    word,
    lang_code: "fr",
    pos,
    forms: forms.map((form) => ({ form, source: "conjugation" })),
    senses: [
      {
        glosses,
        form_of: formOf.map((lemma) => ({ word: lemma }))
      }
    ]
  });
}

const kaikkientry = kaikkiEntry;

async function writeJdm(
  dir: string,
  term: string,
  synonyms: Array<[string, number]>
): Promise<void> {
  const nodes = [{ id: 1, name: term }];
  const relations = synonyms.map(([name, weight], index) => {
    nodes.push({ id: index + 2, name });
    return {
      id: index + 10,
      node1: 1,
      node2: index + 2,
      type: 5,
      w: weight
    };
  });

  await writeFile(
    path.join(dir, `jdm-${encodeURIComponent(term)}.json`),
    JSON.stringify({ request: { node1: term }, nodes, relations }),
    "utf8"
  );
}
