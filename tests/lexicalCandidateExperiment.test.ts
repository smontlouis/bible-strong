import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { applyLexicalCandidateExperiment } from "../src/lexicalCandidateExperiment.js";

test("lexical experiment does not stack new candidates on the same word", async () => {
  const dir = mkdtempSync(path.join(tmpdir(), "lexical-experiment-"));
  const ledgerPath = path.join(dir, "ledger.json");
  const candidatesPath = path.join(dir, "candidates.json");

  writeFileSync(ledgerPath, JSON.stringify(fakeLedger(), null, 2));
  writeFileSync(candidatesPath, JSON.stringify(fakeReport(), null, 2));

  const result = await applyLexicalCandidateExperiment({
    bible: "nbs",
    ledgerPath,
    candidatesPath,
    outputPath: path.join(dir, "experiment.json"),
    minScore: 0.72,
    confidence: "high",
    allowOccupied: false
  });

  const verse = result.ledger.verses[0];
  const experimental = verse.annotations.filter(
    (annotation) => annotation.experiment?.type === "lexical-candidate"
  );

  assert.equal(result.placed, 1);
  assert.equal(experimental.length, 1);
  assert.equal(experimental[0]?.strong, "H0001");
  assert.equal(verse.metrics.lexicalExperimentPlacedCount, 1);
  assert.equal(verse.metrics.lexicalExperimentOccupiedCount, 0);
  assert.equal(
    countMatches(verse.views.readerHtml, 'data-experiment="lexical-candidate"'),
    1
  );
  assert.match(verse.views.readerHtml, /strong="H0001"/);
  assert.doesNotMatch(verse.views.readerHtml, /<w strong="H0001a"/);
  assert.match(verse.views.readerHtml, /data-source-strong="H0001a"/);
  assert.match(verse.views.readerHtml, /data-step-strong="H0001B"/);
});

function fakeLedger() {
  return {
    bible: "nbs",
    generatedAt: "2026-06-24T00:00:00.000Z",
    inputPath: "test",
    scope: "Gen.1",
    split: false,
    method: "test",
    translationProfile: "formal",
    references: [],
    originalSources: [],
    outputPaths: {},
    metrics: {},
    verses: [
      {
        ref: "Gen.1.1",
        bookId: "Gen",
        chapter: 1,
        verse: 1,
        text: "Le mot cible.",
        tokens: [token(0, "Le"), token(1, "mot"), token(2, "cible")],
        annotations: [
          empty("Gen.1.1:0:H0001", "H0001", "H0001a", "H0001B"),
          empty("Gen.1.1:1:H0002", "H0002")
        ],
        inventories: {
          references: { Sg1910: ["H0001", "H0002"] },
          original: ["H0001", "H0002"],
          reader: [],
          advanced: ["H0001", "H0002"]
        },
        metrics: {},
        views: {
          readerHtml: "Le mot cible.",
          advancedHtml: "Le mot cible.",
          debugHtml: "Le mot cible."
        }
      }
    ]
  };
}

function fakeReport() {
  return {
    bible: "nbs",
    generatedAt: "2026-06-24T00:00:00.000Z",
    inputPath: "test",
    scope: "Gen.1",
    sources: {
      strongDictionary: true,
      rezoJdmFetch: false
    },
    metrics: {
      verses: 1,
      emptyAnnotations: 2,
      emptyWithCandidates: 2,
      candidateCount: 2,
      highConfidenceCandidates: 2
    },
    items: [candidateItem("H0001"), candidateItem("H0002")]
  };
}

function candidateItem(strong: string) {
  return {
    ref: "Gen.1.1",
    text: "Le mot cible.",
    strong,
    insertAfterWordIndex: 0,
    stepGlosses: ["target"],
    dictionaryTerms: ["cible"],
    inferredTerms: [],
    candidates: [
      {
        wordIndex: 2,
        text: "cible",
        normalized: "cible",
        lemma: "cible",
        score: 1,
        confidence: "high",
        occupied: false,
        evidence: [{ source: "test", detail: "test", weight: 1 }]
      }
    ]
  };
}

function token(wordIndex: number, text: string) {
  return {
    wordIndex,
    text,
    normalized: text.toLocaleLowerCase("fr-FR")
  };
}

function empty(
  id: string,
  strong: string,
  sourceStrong?: string,
  dStrong?: string
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
    insertAfterWordIndex: 0,
    lexiconLookup: true,
    sourceStrong,
    step: dStrong
      ? [
          {
            source: "TAHOT",
            classicalStrong: strong,
            dStrong,
            tokenIndex: 1,
            type: "L",
            surface: "",
            transliteration: "",
            gloss: "target",
            morphology: "",
            editions: ""
          }
        ]
      : []
  };
}

function countMatches(text: string, needle: string): number {
  return text.split(needle).length - 1;
}
