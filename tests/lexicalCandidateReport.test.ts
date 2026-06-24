import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { buildLexicalCandidateReport } from "../src/lexicalCandidateReport.js";
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

function assertTopCandidate(
  report: Awaited<ReturnType<typeof buildLexicalCandidateReport>>,
  ref: string,
  strong: string,
  normalized: string
): void {
  const item = report.items.find(
    (candidate) => candidate.ref === ref && candidate.strong === strong
  );
  assert.equal(item?.candidates[0]?.normalized, normalized);
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
  annotation: unknown
) {
  const [bookId, chapter, verseNumber] = ref.split(".");
  return {
    ref,
    bookId,
    chapter: Number(chapter),
    verse: Number(verseNumber),
    text,
    tokens,
    annotations: [annotation],
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

function empty(
  id: string,
  strong: string,
  gloss: string,
  insertAfterWordIndex: number
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
        transliteration: "",
        gloss,
        morphology: "",
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
