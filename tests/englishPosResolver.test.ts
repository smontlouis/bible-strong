import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeEnglishSpan,
  dictionaryCandidates,
  isCapitalizedLemmaHead,
  resolveEnglishPartOfSpeech,
  tokenizeEnglishWords
} from "../src/englishPosResolver.js";

test("WordNet exposes the possible English content POS", () => {
  assert.deepEqual(dictionaryCandidates("river", "river"), ["noun"]);
  assert.deepEqual(dictionaryCandidates("gods", "god"), ["noun"]);
  assert.deepEqual(dictionaryCandidates("judge", "judge"), ["noun", "verb"]);
  assert.deepEqual(dictionaryCandidates("great", "great"), ["adj", "noun"]);
  assert.ok(dictionaryCandidates("highest", "highest").includes("adj"));
});

test("context disambiguates common noun and verb uses", () => {
  const nounText = "The judge answered the people.";
  const nounOffset = nounText.indexOf("judge");
  const noun = resolveEnglishPartOfSpeech({
    verseText: nounText,
    startOffset: nounOffset,
    length: "judge".length,
    lemma: "judge",
    currentPartOfSpeech: "verb",
    sourcePartOfSpeech: "noun"
  });
  assert.equal(noun.partOfSpeech, "noun");
  assert.equal(noun.method, "dictionary-context");

  const verbText = "They shall judge the people.";
  const verbOffset = verbText.indexOf("judge");
  const verb = resolveEnglishPartOfSpeech({
    verseText: verbText,
    startOffset: verbOffset,
    length: "judge".length,
    lemma: "judge",
    currentPartOfSpeech: "noun",
    sourcePartOfSpeech: "verb"
  });
  assert.equal(verb.partOfSpeech, "verb");
  assert.equal(verb.method, "dictionary-context");
});

test("closed classes are not overwritten by WordNet lexical homonyms", () => {
  const but = resolveEnglishPartOfSpeech({
    verseText: "But God spoke.",
    startOffset: 0,
    length: 3,
    lemma: "but",
    currentPartOfSpeech: "conj"
  });
  assert.equal(but.partOfSpeech, "conj");
  assert.equal(but.lowMargin, false);

  const are = resolveEnglishPartOfSpeech({
    verseText: "They are ready.",
    startOffset: 5,
    length: 3,
    lemma: "be",
    currentPartOfSpeech: "verb"
  });
  assert.ok(are.candidates.includes("verb"));
  assert.equal(are.partOfSpeech, "verb");

  const why = resolveEnglishPartOfSpeech({
    verseText: "Why do you ask?",
    startOffset: 0,
    length: 3,
    lemma: "why",
    currentPartOfSpeech: "adv"
  });
  assert.equal(why.partOfSpeech, "adv");
});

test("capitalized proper-name nouns stay names while Behold can become a verb", () => {
  const jesus = resolveEnglishPartOfSpeech({
    verseText: "Jesus spoke.",
    startOffset: 0,
    length: 5,
    lemma: "jesus",
    currentPartOfSpeech: "name"
  });
  assert.equal(jesus.partOfSpeech, "name");

  const behold = resolveEnglishPartOfSpeech({
    verseText: "Behold, I come.",
    startOffset: 0,
    length: 6,
    lemma: "behold",
    currentPartOfSpeech: "name"
  });
  assert.equal(behold.partOfSpeech, "verb");

  const commonMan = resolveEnglishPartOfSpeech({
    verseText: "the man spoke",
    startOffset: 4,
    length: 3,
    lemma: "man",
    currentPartOfSpeech: "name",
    sourcePartOfSpeech: "noun"
  });
  assert.equal(commonMan.partOfSpeech, "noun");

  const translatedCommonMan = resolveEnglishPartOfSpeech({
    verseText: "man became a living soul",
    startOffset: 0,
    length: 3,
    lemma: "man",
    currentPartOfSpeech: "name",
    sourcePartOfSpeech: "name"
  });
  assert.equal(translatedCommonMan.partOfSpeech, "noun");
});

test("surface analysis distinguishes God from common gods", () => {
  const divineText = "And God said, Let there be light.";
  const divine = analyzeEnglishSpan({
    verseText: divineText,
    startOffset: divineText.indexOf("God"),
    length: 3,
    lemma: "god"
  });
  assert.equal(isCapitalizedLemmaHead(divine, "god"), true);

  const commonText = "Thou shalt have no other gods before me.";
  const common = analyzeEnglishSpan({
    verseText: commonText,
    startOffset: commonText.indexOf("gods"),
    length: 4,
    lemma: "god"
  });
  assert.equal(isCapitalizedLemmaHead(common, "god"), false);
  assert.deepEqual(common.candidates, ["noun"]);
});

test("tokenization excludes typographic dashes and apostrophes at word edges", () => {
  assert.deepEqual(
    tokenizeEnglishWords("Lord--for God’ Menē’--God").map(({ value }) => value),
    ["Lord", "for", "God", "Menē", "God"]
  );
});

test("the exact span recovers a word from canonical text with missing spaces", () => {
  const analysis = analyzeEnglishSpan({
    verseText: "WithGodis wisdom.",
    startOffset: 4,
    length: 3,
    lemma: "god"
  });
  assert.equal(analysis.head?.value, "God");
  assert.equal(isCapitalizedLemmaHead(analysis, "god"), true);
});

test("a dictionary/tagger conflict retains a concrete POS for audit", () => {
  const text = "They entered the walled city.";
  const resolution = resolveEnglishPartOfSpeech({
    verseText: text,
    startOffset: text.indexOf("walled"),
    length: 6,
    lemma: "walled",
    currentPartOfSpeech: "noun"
  });
  assert.equal(resolution.partOfSpeech, "noun");
  assert.equal(resolution.lowMargin, true);
});

test("lowercase archaic false names always receive a concrete fallback", () => {
  const saith = resolveEnglishPartOfSpeech({
    verseText: "he saith unto them",
    startOffset: 3,
    length: 5,
    lemma: "saith",
    currentPartOfSpeech: "name",
    sourcePartOfSpeech: "noun"
  });
  assert.equal(saith.partOfSpeech, "verb");

  const unto = resolveEnglishPartOfSpeech({
    verseText: "he saith unto them",
    startOffset: 9,
    length: 4,
    lemma: "unto",
    currentPartOfSpeech: "name"
  });
  assert.equal(unto.partOfSpeech, "prep");

  const possessive = resolveEnglishPartOfSpeech({
    verseText: "Noah’s house",
    startOffset: 0,
    length: 6,
    lemma: "s",
    currentPartOfSpeech: "name"
  });
  assert.equal(possessive.partOfSpeech, "particle");
});

test("capitalized hyphenated entities retain a name POS", () => {
  const text = "They returned to Kiriath-jearim.";
  const resolution = resolveEnglishPartOfSpeech({
    verseText: text,
    startOffset: text.indexOf("Kiriath-jearim"),
    length: "Kiriath-jearim".length,
    lemma: "jearim",
    currentPartOfSpeech: "name"
  });
  assert.equal(isCapitalizedLemmaHead(resolution, "jearim"), true);
  assert.equal(resolution.partOfSpeech, "name");
});
