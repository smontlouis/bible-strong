import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import {
  buildLexicalCandidateReport,
  createLexicalCandidateSourceCache,
  isAutoSafeCandidate,
  lexicalAutoSafePlacements,
  writeLexicalCandidateReport,
  type LexicalCandidateItem,
  type LexicalCandidateReport
} from "../src/lexicalCandidateReport.js";
import { type StrongLedgerVerse } from "../src/strongLedger.js";
import { type StrongTranslationCandidate } from "../src/translationLexicon.js";

test("streams a lexical report to valid equivalent JSON", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "lexical-report-stream-"));
  const report: LexicalCandidateReport = {
    bible: "fixture",
    generatedAt: "2026-07-10T00:00:00.000Z",
    inputPath: "fixture.sqlite",
    scope: "all",
    sources: { strongDictionary: true, rezoJdmFetch: false },
    metrics: {
      verses: 1,
      auditItems: 1,
      emptyAnnotations: 1,
      readerEmptyAnnotations: 0,
      advancedEmptyAnnotations: 1,
      relocationAnnotations: 0,
      itemsWithCandidates: 0,
      emptyWithCandidates: 0,
      relocationWithCandidates: 0,
      candidateCount: 0,
      highConfidenceCandidates: 0,
      mediumConfidenceCandidates: 0,
      lowConfidenceCandidates: 0,
      occupiedCandidates: 0,
      openCandidates: 0,
      reviewableCandidates: 0,
      autoSafeCandidates: 0,
      autoSafeItems: 0,
      groupAutoSafeItems: 0,
      ambiguousHighItems: 0,
      openHighItems: 0,
      relocationBetterOpenItems: 0,
      evidenceSourceCounts: {}
    },
    items: [
      {
        auditKind: "empty",
        annotationId: "fixture-annotation",
        ref: "Gen.1.1",
        text: "Au commencement",
        strong: "H7225",
        insertAfterWordIndex: -1,
        stepGlosses: [],
        dictionaryTerms: [],
        inferredTerms: [],
        candidates: []
      }
    ]
  };

  const paths = await writeLexicalCandidateReport(report, directory);
  assert.deepEqual(JSON.parse(await readFile(paths.jsonPath, "utf8")), report);
});

test("keeps dictionary seeds isolated by exact STEP sub-entry", async () => {
  const report = await buildLexicalCandidateReport({
    bible: "fixture",
    inputDir: ".",
    outputDir: ".",
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 10,
    ledger: {
      verses: [
        verse(
          "Acts.1.1",
          "Il voit et sait.",
          [token(0, "Il"), token(1, "voit"), token(2, "et"), token(3, "sait")],
          empty("Acts.1.1:0:G1492", "G1492", "to know", 0, "", "", "G1492H")
        )
      ]
    },
    dictionaryCandidates: [
      candidate("G1492", "voir", 0.5, { stepStrong: "G1492G" }),
      candidate("G1492", "savoir", 0.5, { stepStrong: "G1492H" })
    ]
  });

  assert.deepEqual(report.items[0]?.dictionaryTerms, ["savoir"]);
});

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
  const kaikkiDerived = topCandidateFor(report, "Gen.1.9", "H6960");
  assert.equal(
    kaikkiDerived?.evidence.find((evidence) => evidence.source === "seed-term")
      ?.reviewOnly,
    true
  );
  assert.equal(
    kaikkiDerived?.evidence.find((evidence) => evidence.source === "seed-term")
      ?.provenanceRoot,
    "kaikki"
  );
  assert.equal(
    lexicalAutoSafePlacements(report).some(
      (placement) => placement.item.strong === "H6960"
    ),
    false
  );
});

test("reuses cached lexical sources across repeated report builds", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-cache-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const kaikkipath = path.join(dir, "kaikki.jsonl");
  const openOfficePath = path.join(dir, "thes.dat");

  writeFileSync(ledgerPath, JSON.stringify(fakeLedger(), null, 2));
  writeFileSync(
    kaikkipath,
    [
      kaikkiEntry("donne", "verb", [], ["form of donner"], ["donner"]),
      kaikkiEntry("donner", "verb", ["donne"], ["to give"])
    ].join("\n")
  );
  writeFileSync(openOfficePath, "UTF-8\ndonner|1\n|produire\n");

  const sourceCache = createLexicalCandidateSourceCache(dictionaryCandidates());
  const options = {
    bible: "nbs",
    onlyRef: "Gen.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    kaikkiPath: kaikkipath,
    openOfficePath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    sourceCache
  };

  const first = await buildLexicalCandidateReport(options);
  const second = await buildLexicalCandidateReport(options);

  assert.equal(sourceCache.kaikki.size, 1);
  assert.equal(sourceCache.synonymSources.size, 1);
  assert.deepEqual(second.metrics, first.metrics);
  assert.deepEqual(second.items, first.items);
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

test("caps synonym-only candidates below high confidence", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const openOfficePath = path.join(dir, "thes.dat");
  const wolfPath = path.join(dir, "wolf.xml");

  writeFileSync(openOfficePath, "UTF-8\nenfant|1\n|petit\n");
  writeFileSync(
    wolfPath,
    "<WOLF><SYNSET><LITERAL>enfant</LITERAL><LITERAL>petit</LITERAL></SYNSET></WOLF>"
  );
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
            "Test.1.1",
            "Le petit arrive.",
            [token(0, "Le"), token(1, "petit"), token(2, "arrive")],
            empty("Test.1.1:0:H0001", "H0001", "child", 0)
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Test.1.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    openOfficePath,
    wolfPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H0001", "enfant", 0.5)]
  });

  const item = report.items.find(
    (candidate) => candidate.ref === "Test.1.1" && candidate.strong === "H0001"
  );
  const topCandidate = item?.candidates[0];
  assert.equal(topCandidate?.normalized, "petit");
  assert.equal(topCandidate?.score, 0.93);
  assert.equal(topCandidate?.confidence, "medium");
  assert.deepEqual(
    topCandidate?.evidence.map((evidence) => evidence.source),
    ["openoffice-synonyms", "wolf"]
  );
  assert.equal(report.metrics.highConfidenceCandidates, 0);
  assert.equal(report.metrics.mediumConfidenceCandidates, 1);
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

test("ignores synonym-only outside competitors for strong auxiliary phrases", () => {
  const item: LexicalCandidateItem = {
    auditKind: "empty",
    annotationId: "Rom.4.14:22:G2758",
    ref: "Rom.4.14",
    text: "la foi est vidée de son sens et la promesse est réduite à rien.",
    strong: "G2758",
    insertAfterWordIndex: 10,
    stepGlosses: ["has been made void"],
    dictionaryTerms: ["vider"],
    inferredTerms: [],
    candidates: [
      lexicalCandidate({
        target: "phrase",
        wordIndex: 3,
        startWordIndex: 3,
        endWordIndex: 4,
        text: "est vidée",
        normalized: "est videe",
        lemma: "etre vide",
        score: 1,
        evidenceSources: ["french-auxiliary-phrase", "seed-term"]
      }),
      lexicalCandidate({
        wordIndex: 4,
        text: "vidée",
        normalized: "videe",
        lemma: "vide",
        score: 1,
        evidenceSources: ["seed-term"]
      }),
      lexicalCandidate({
        wordIndex: 11,
        text: "rien",
        normalized: "rien",
        lemma: "rien",
        score: 0.92,
        evidenceSources: ["openoffice-synonyms", "wolf"]
      })
    ]
  };

  assert.equal(isAutoSafeCandidate(item, item.candidates[0]!), true);
});

test("keeps auxiliary phrases in review when a direct outside competitor exists", () => {
  const item: LexicalCandidateItem = {
    auditKind: "empty",
    annotationId: "Rom.4.14:22:G2758",
    ref: "Rom.4.14",
    text: "la foi est vidée de son sens et la promesse est réduite à rien.",
    strong: "G2758",
    insertAfterWordIndex: 10,
    stepGlosses: ["has been made void"],
    dictionaryTerms: ["vider"],
    inferredTerms: [],
    candidates: [
      lexicalCandidate({
        target: "phrase",
        wordIndex: 3,
        startWordIndex: 3,
        endWordIndex: 4,
        text: "est vidée",
        normalized: "est videe",
        lemma: "etre vide",
        score: 1,
        evidenceSources: ["french-auxiliary-phrase", "seed-term"]
      }),
      lexicalCandidate({
        wordIndex: 11,
        text: "réduite",
        normalized: "reduite",
        lemma: "reduire",
        score: 1,
        evidenceSources: ["seed-term"]
      })
    ]
  };

  assert.equal(isAutoSafeCandidate(item, item.candidates[0]!), false);
});

test("prefers an auxiliary phrase when it contains the only competing auto-safe word", () => {
  const item: LexicalCandidateItem = {
    auditKind: "relocation",
    annotationId: "John.2.22:0:G1453",
    ref: "John.2.22",
    text: "Quand donc il fut réveillé d’entre les morts.",
    strong: "G1453",
    currentTarget: {
      wordIndex: 6,
      text: "d’entre",
      normalized: "entre",
      otherStrong: ["G1537"]
    },
    stepGlosses: ["He was raised up"],
    dictionaryTerms: ["réveiller"],
    inferredTerms: [],
    candidates: [
      lexicalCandidate({
        target: "phrase",
        wordIndex: 4,
        startWordIndex: 4,
        endWordIndex: 5,
        text: "fut réveillé",
        normalized: "fut reveille",
        lemma: "etre reveiller",
        score: 1,
        evidenceSources: ["french-auxiliary-phrase", "seed-term"]
      }),
      lexicalCandidate({
        wordIndex: 5,
        text: "réveillé",
        normalized: "reveille",
        lemma: "reveiller",
        score: 1,
        evidenceSources: ["seed-term", "openoffice-synonyms"]
      })
    ]
  };

  const placements = lexicalAutoSafePlacements({
    items: [item]
  } as never);

  assert.equal(placements.length, 1);
  assert.equal(placements[0]?.candidate.target, "phrase");
  assert.equal(placements[0]?.candidate.text, "fut réveillé");
});

test("keeps generic direct candidates in review when a high-scoring synonym competitor exists", () => {
  const item: LexicalCandidateItem = {
    auditKind: "empty",
    annotationId: "Test.1.1:0:H0001",
    ref: "Test.1.1",
    text: "Le petit enfant arrive.",
    strong: "H0001",
    insertAfterWordIndex: 0,
    stepGlosses: ["child"],
    dictionaryTerms: ["enfant"],
    inferredTerms: [],
    candidates: [
      lexicalCandidate({
        wordIndex: 2,
        text: "enfant",
        normalized: "enfant",
        lemma: "enfant",
        score: 1,
        evidenceSources: ["seed-term"]
      }),
      lexicalCandidate({
        wordIndex: 1,
        text: "petit",
        normalized: "petit",
        lemma: "petit",
        score: 0.93,
        confidence: "medium",
        evidenceSources: ["openoffice-synonyms", "wolf"]
      })
    ]
  };

  assert.equal(isAutoSafeCandidate(item, item.candidates[0]!), false);
});

test("never auto-safes a generic carrier even with independent evidence", () => {
  const item: LexicalCandidateItem = {
    auditKind: "empty",
    annotationId: "Test.1.1:0:H0001",
    ref: "Test.1.1",
    text: "Il est là.",
    strong: "H0001",
    insertAfterWordIndex: 1,
    stepGlosses: ["be"],
    dictionaryTerms: ["etre"],
    inferredTerms: [],
    candidates: [
      {
        ...lexicalCandidate({
          wordIndex: 1,
          text: "est",
          normalized: "est",
          lemma: "etre",
          score: 1,
          evidenceSources: ["seed-term", "kaikki-gloss"]
        }),
        evidence: [
          {
            source: "seed-term",
            provenanceRoot: "strong-dictionary",
            detail: "dictionary evidence",
            weight: 0.5
          },
          {
            source: "kaikki-gloss",
            provenanceRoot: "kaikki",
            detail: "Kaikki evidence",
            weight: 0.3
          }
        ]
      }
    ]
  };

  assert.equal(isAutoSafeCandidate(item, item.candidates[0]!), false);
});

test("does not count a Kaikki-derived seed and Kaikki gloss as two sources", () => {
  const item: LexicalCandidateItem = {
    auditKind: "empty",
    annotationId: "Test.1.1:0:H0001",
    ref: "Test.1.1",
    text: "Il rassemble.",
    strong: "H0001",
    insertAfterWordIndex: 1,
    stepGlosses: ["gather"],
    dictionaryTerms: [],
    inferredTerms: ["rassembler"],
    candidates: [
      {
        ...lexicalCandidate({
          wordIndex: 1,
          text: "rassemble",
          normalized: "rassemble",
          lemma: "rassembler",
          score: 0.95,
          evidenceSources: ["seed-term", "kaikki-gloss"]
        }),
        evidence: [
          {
            source: "seed-term",
            provenanceRoot: "kaikki",
            reviewOnly: true,
            detail: "inferred from Kaikki reverse gloss",
            weight: 0.42
          },
          {
            source: "kaikki-gloss",
            provenanceRoot: "kaikki",
            detail: "same Kaikki gloss data",
            weight: 0.3
          }
        ]
      }
    ]
  };

  assert.equal(isAutoSafeCandidate(item, item.candidates[0]!), false);
});

test("keeps prose dictionary seeds visible but review-only", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-review-"));
  const ledgerPath = path.join(dir, "ledger.json");
  writeFileSync(
    ledgerPath,
    JSON.stringify({
      bible: "nbs",
      generatedAt: "2026-07-10T00:00:00.000Z",
      split: false,
      metrics: {},
      verses: [
        verse(
          "Test.1.1",
          "Un résultat majestueux.",
          [token(0, "Un"), token(1, "résultat"), token(2, "majestueux")],
          empty("Test.1.1:0:H0001", "H0001", "glorious", 2)
        )
      ]
    })
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Test.1.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [
      candidate("H0001", "majestueux", 0.3, {
        reviewOnly: true,
        provenanceRoot: "strong-lexicon-sqlite"
      })
    ]
  });

  const top = topCandidateFor(report, "Test.1.1", "H0001");
  assert.equal(top?.normalized, "majestueux");
  assert.equal(top?.evidence[0]?.reviewOnly, true);
  assert.equal(top?.confidence, "medium");
  assert.equal(report.metrics.autoSafeItems, 0);
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

test("keeps French elision prefixes but rejects arbitrary compound-name suffixes", async () => {
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
            "Gen.4.17",
            "D’Hénoch à Beth-El.",
            [token(0, "D’Hénoch"), token(1, "à"), token(2, "Beth-El")],
            [
              empty("Gen.4.17:0:H2585", "H2585", "Enoch", 0, "HNpm"),
              empty("Gen.4.17:1:H0410", "H0410", "El", 1, "HNpm")
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
    onlyRef: "Gen.4.17",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: []
  });

  assert.equal(
    topCandidateFor(report, "Gen.4.17", "H2585")?.normalized,
    "d’henoch"
  );
  assert.equal(topCandidateFor(report, "Gen.4.17", "H0410"), undefined);
});

test("rejects lowercase common words as STEP proper-name carriers", async () => {
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
            "2Sam.2.5",
            "Ils ont enseveli Saül, les gens de Yabesh, et vous.",
            [
              token(0, "Ils"),
              token(1, "ont"),
              token(2, "enseveli"),
              token(3, "Saül"),
              token(4, "les"),
              token(5, "gens"),
              token(6, "de"),
              token(7, "Yabesh"),
              token(8, "et"),
              token(9, "vous")
            ],
            empty("2Sam.2.5:0:H3003", "H3003", "Jabesh", 4, "HNpl")
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "2Sam.2.5",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("H3003", "jabesh", 0.5)]
  });

  const candidates =
    report.items.find(
      (candidate) =>
        candidate.ref === "2Sam.2.5" && candidate.strong === "H3003"
    )?.candidates ?? [];

  assert.equal(
    candidates.some((candidate) => candidate.normalized === "vous"),
    false
  );
  assert.equal(candidates[0]?.normalized, "yabesh");
});

test("auto-safes simple STEP-only proper names", async () => {
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
            "Josh.1.1",
            "Josué, fils de Noun.",
            [
              token(0, "Josué"),
              token(1, "fils"),
              token(2, "de"),
              token(3, "Noun")
            ],
            empty("Josh.1.1:0:H5126", "H5126", "Nun", 3, "HNpm")
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Josh.1.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: []
  });

  const placement = lexicalAutoSafePlacements(report).find(
    (candidate) => candidate.item.annotationId === "Josh.1.1:0:H5126"
  );
  assert.equal(placement?.candidate.normalized, "noun");
  assert.equal(placement?.kind, "auto-safe");
});

test("keeps compound STEP-only proper names in review", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const compoundName = empty(
    "1Chr.3.20:0:H3142",
    "H3142",
    "Jushab-",
    0,
    "HNpm"
  );
  compoundName.step.push({
    ...compoundName.step[0],
    gloss: "Hesed"
  });

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
            "1Chr.3.20",
            "Youshab-Hésed.",
            [token(0, "Youshab-Hésed")],
            compoundName
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "1Chr.3.20",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: []
  });

  assert.equal(
    topCandidateFor(report, "1Chr.3.20", "H3142")?.normalized,
    "youshab-hesed"
  );
  assert.equal(lexicalAutoSafePlacements(report).length, 0);
});

test("resolves ambiguous STEP proper-name sequences by source order", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const jamin = empty("1Chr.4.24:0:H3226", "H3226", "Jamin", 3, "HNpm");
  const jarib = empty("1Chr.4.24:1:H3402", "H3402", "Jamin", 4, "HNpm");
  jamin.step.push({ ...jamin.step[0], gloss: "Jarib" });
  jarib.step.push({ ...jarib.step[0], gloss: "Jarib" });

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
            "1Chr.4.24",
            "Fils de Siméon : Nemouel, Yamîn, Yarib, Zérah.",
            [
              token(0, "Fils"),
              token(1, "de"),
              token(2, "Siméon"),
              token(3, "Nemouel"),
              token(4, "Yamîn"),
              token(5, "Yarib"),
              token(6, "Zérah")
            ],
            [jamin, jarib]
          )
        ]
      },
      null,
      2
    )
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "1Chr.4.24",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: []
  });

  const placements = lexicalAutoSafePlacements(report);
  assert.deepEqual(
    placements.map((placement) => [
      placement.item.strong,
      placement.candidate.normalized,
      placement.kind
    ]),
    [
      ["H3226", "yamin", "group-auto-safe"],
      ["H3402", "yarib", "group-auto-safe"]
    ]
  );
  assert.equal(report.metrics.groupAutoSafeItems, 2);
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

test("resolves repeated lexical carriers that appear before empty source anchors", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-candidates-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const kaikkipath = path.join(dir, "kaikki.jsonl");
  const openOfficePath = path.join(dir, "thes.dat");
  const wolfPath = path.join(dir, "wolf.xml");

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
            "Heb.5.1",
            "Tout grand prêtre pris parmi homme est établi pour homme.",
            [
              token(0, "Tout"),
              token(1, "grand"),
              token(2, "prêtre"),
              token(3, "pris"),
              token(4, "parmi"),
              token(5, "les"),
              token(6, "homme"),
              token(7, "est"),
              token(8, "établi"),
              token(9, "pour"),
              token(10, "les"),
              token(11, "homme")
            ],
            [
              empty("Heb.5.1:0:G0444", "G0444", "men", 11),
              empty("Heb.5.1:1:G0444", "G0444", "men", 11)
            ]
          )
        ]
      },
      null,
      2
    )
  );
  writeFileSync(kaikkipath, kaikkiEntry("homme", "noun", [], ["man", "human"]));
  writeFileSync(openOfficePath, "UTF-8\nhomme|1\n|homme\n");
  writeFileSync(
    wolfPath,
    "<WOLF><SYNSET><LITERAL>homme</LITERAL><LITERAL>homme</LITERAL></SYNSET></WOLF>"
  );

  const report = await buildLexicalCandidateReport({
    bible: "nbs",
    onlyRef: "Heb.5.1",
    inputDir: dir,
    outputDir: dir,
    ledgerPath,
    kaikkiPath: kaikkipath,
    openOfficePath,
    wolfPath,
    fetchJdm: false,
    fetchJdmLimit: 0,
    maxCandidatesPerEmpty: 5,
    dictionaryCandidates: [candidate("G0444", "homme", 0.5)]
  });

  const placements = lexicalAutoSafePlacements(report).filter(
    (candidate) => candidate.item.strong === "G0444"
  );
  assert.deepEqual(
    placements.map((placement) => placement.candidate.wordIndex),
    [6, 11]
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

function lexicalCandidate(options: {
  target?: "word" | "phrase";
  wordIndex: number;
  startWordIndex?: number;
  endWordIndex?: number;
  text: string;
  normalized: string;
  lemma: string;
  score: number;
  confidence?: "high" | "medium" | "low";
  occupied?: boolean;
  evidenceSources: string[];
}) {
  return {
    target: options.target ?? "word",
    wordIndex: options.wordIndex,
    startWordIndex: options.startWordIndex,
    endWordIndex: options.endWordIndex,
    text: options.text,
    normalized: options.normalized,
    lemma: options.lemma,
    score: options.score,
    confidence: options.confidence ?? "high",
    occupied: options.occupied ?? false,
    evidence: options.evidenceSources.map((source) => ({
      source,
      detail: `${source} test evidence`,
      weight: 0.4
    }))
  };
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
  score: number,
  options: {
    reviewOnly?: boolean;
    provenanceRoot?: string;
    stepStrong?: string;
  } = {}
): StrongTranslationCandidate {
  return {
    strong,
    stepStrong: options.stepStrong,
    normalized,
    score,
    source: "test",
    provenanceRoot: options.provenanceRoot,
    reviewOnly: options.reviewOnly,
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
): StrongLedgerVerse {
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
  } as unknown as StrongLedgerVerse;
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
  transliteration = "",
  sourceStrong?: string
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
    sourceStrong,
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
