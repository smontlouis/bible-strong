import assert from "node:assert/strict";
import test from "node:test";

import {
  enrichStrongTextWithCtbLemmas,
  parseCtbChapterHtml
} from "../src/ctbReferenceLemmas.js";

const HTML = `
<div class="chapter" lang="fr">
  <span class="verse"><sup class="numverse" id="v1"><a href="#v1">1</a> </sup><span class="versetxt"><w data-lm="au[a]">Au</w> <w data-lm="commencement[n]" data-pa="1/h7225" data-ns="7225">commencement</w>, <w data-lm="Dieu[N]" data-pa="3/h0430" data-ns="430">Dieu</w> <w data-lm="créer[v]" data-pa="2/h1254" data-ns="1254">créa</w>.</span></span>
  <span class="verse"><sup class="numverse" id="v2"><a href="#v2">2</a> </sup><span class="versetxt"><w data-lm="du[é]" data-pa="1/g3588+2/g0846" data-ns="3588, 846">du</w> <w data-lm="soi[q]" data-pa="2/h0000" data-ns="0">soi</w> <span class="strong-untranslated"><w data-lm="{entre}[§]" data-pa="3/h0996" data-ns="996">◎</w></span></span></span>
</div>
<div class="clearfix"></div>`;

test("parses CTB French lemmas, parts of speech and Strong groups", () => {
  assert.deepEqual(parseCtbChapterHtml(HTML), {
    "1": [
      {
        lemma: "au",
        partOfSpeech: "a",
        strongs: [],
        surface: "Au"
      },
      {
        lemma: "commencement",
        partOfSpeech: "n",
        strongs: ["H7225"],
        surface: "commencement"
      },
      {
        lemma: "Dieu",
        partOfSpeech: "N",
        strongs: ["H0430"],
        surface: "Dieu"
      },
      {
        lemma: "créer",
        partOfSpeech: "v",
        strongs: ["H1254"],
        surface: "créa"
      }
    ],
    "2": [
      {
        lemma: "du",
        partOfSpeech: "é",
        strongs: ["G3588", "G0846"],
        surface: "du"
      },
      {
        lemma: "soi",
        partOfSpeech: "q",
        strongs: [],
        surface: "soi"
      },
      {
        lemma: "{entre}",
        partOfSpeech: "§",
        strongs: ["H0996"],
        surface: "◎"
      }
    ]
  });
});

test("adds lemma and pos without changing Strong markup or empty carriers", () => {
  const verses = parseCtbChapterHtml(HTML);
  const first = enrichStrongTextWithCtbLemmas({
    ref: "Gen.1.1",
    text:
      'Au <w strong="H7225">commencement</w>, ' +
      '<w strong="H0430">Dieu</w> <w strong="H1254">créa</w>.',
    annotations: verses["1"]!
  });
  assert.equal(first.assignmentCount, 3);
  assert.equal(first.strongAlignmentMismatchCount, 0);
  assert.equal(
    first.text,
    'Au <w strong="H7225" lemma="commencement" pos="n">commencement</w>, ' +
      '<w strong="H0430" lemma="Dieu" pos="N">Dieu</w> ' +
      '<w strong="H1254" lemma="créer" pos="v">créa</w>.'
  );

  const second = enrichStrongTextWithCtbLemmas({
    ref: "Gen.1.2",
    text: '<w strong="G3588 G0846">du</w><w strong="H0996"></w>',
    annotations: verses["2"]!
  });
  assert.equal(
    second.text,
    '<w strong="G3588 G0846" lemma="du" pos="é">du</w>' +
      '<w strong="H0996" lemma="{entre}" pos="§"></w>'
  );
});

test("marks a legacy empty carrier without inventing a visible French lemma", () => {
  const result = enrichStrongTextWithCtbLemmas({
    ref: "Dan.2.30",
    text: '<w strong="H1768"></w>',
    annotations: []
  });
  assert.equal(
    result.text,
    '<w strong="H1768" lemma="{non traduit}" pos="§"></w>'
  );
  assert.equal(result.strongAlignmentMismatchCount, 1);
});

test("does not classify a visible lexical word as untranslated", () => {
  const result = enrichStrongTextWithCtbLemmas({
    ref: "Num.14.10",
    text: '<w strong="H0068">pierres</w>',
    annotations: [
      {
        lemma: "{pierre}",
        partOfSpeech: "§",
        strongs: ["H0068"],
        surface: "◎"
      }
    ],
    fallbackLexeme: () => ({
      lemma: "pierre",
      partOfSpeech: "n",
      strongs: ["H0068"],
      surface: "pierres"
    })
  });
  assert.equal(
    result.text,
    '<w strong="H0068" lemma="pierre" pos="n">pierres</w>'
  );
  assert.equal(result.visibleImplicitCorrectionCount, 1);
});
