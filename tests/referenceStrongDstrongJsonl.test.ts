import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { enrichStrongTextWithDstrong } from "../src/referenceStrongDstrongJsonl.js";
import type {
  StepLexicalIdentity,
  StepLexicalIdentityIndex
} from "../src/stepLexicalIdentity.js";
import { readStepLexicalIdentityIndex } from "../src/stepLexicalIdentity.js";
import type { StepStrongCandidates } from "../src/stepOriginals.js";

test("adds compact dstrong only for safely distinguished STEP values", () => {
  const verseIndex = new Map<string, StepStrongCandidates>([
    ["H0430", candidates(["H0430"])],
    ["H6960", candidates(["H6960B"])],
    ["H0776", candidates(["H0776G", "H0776H"])],
    ["H9999", candidates(["H9999A", "H9999B", "H9999B"])]
  ]);
  const text =
    '<p><divineName><w strong="H0430">Dieu</w></divineName> ' +
    '<w strong="H6960">rassemble</w> ' +
    '<w strong="H0776">terre</w> et <w strong="H0776">pays</w> ' +
    '<w strong="H9999">ambigu</w>.</p>';

  const result = enrichStrongTextWithDstrong({ text, verseIndex });

  assert.equal(
    result.text,
    '<p><divineName><w strong="H0430">Dieu</w></divineName> ' +
      '<w strong="H6960" dstrong="H6960B">rassemble</w> ' +
      '<w strong="H0776" dstrong="H0776G">terre</w> et ' +
      '<w strong="H0776" dstrong="H0776H">pays</w> ' +
      '<w strong="H9999">ambigu</w>.</p>'
  );
  assert.equal(result.metrics.taggedTokenCount, 5);
  assert.equal(result.metrics.enrichedTagCount, 3);
  assert.equal(result.metrics.distinguishedStrongCount, 3);
  assert.equal(result.metrics.resolvedTokenCount, 4);
  assert.equal(result.metrics.ambiguousTokenCount, 1);
  assert.equal(result.metrics.unchangedClassicalStrongCount, 1);
});

test("keeps unresolved and missing-verse tags byte-identical", () => {
  const text = '<p><w class="x" strong="G0001">mot</w></p>';
  const result = enrichStrongTextWithDstrong({
    text,
    verseIndex: undefined
  });

  assert.equal(result.text, text);
  assert.equal(result.metrics.missingVerseTokenCount, 1);
  assert.equal(result.metrics.enrichedTagCount, 0);
});

test("replaces a previous compact dstrong value idempotently", () => {
  const text = '<w strong="G2424" dstrong="G2424A">Jésus</w>';
  const result = enrichStrongTextWithDstrong({
    text,
    verseIndex: new Map([["G2424", candidates(["G2424G"])]])
  });

  assert.equal(result.text, '<w strong="G2424" dstrong="G2424G">Jésus</w>');
});

test("keeps a STEP extended alias as the compact lexical target", () => {
  const result = enrichStrongTextWithDstrong({
    text: '<w strong="H2896">bon</w>',
    identityIndex: identities([
      ["H2895", { dStrong: "H2895", eStrong: "H2895", uStrong: ["H2895"] }]
    ]),
    verseIndex: new Map([["H2896", candidates(["H2895"])]])
  });

  assert.equal(result.text, '<w strong="H2896" estrong="H2895">bon</w>');
});

test("keeps compact eStrong, dStrong and uStrong identities when useful", () => {
  const result = enrichStrongTextWithDstrong({
    text:
      '<w strong="H2896">agréable</w> ' +
      '<w strong="G2424">Jésus</w> <w strong="G1138">David</w>',
    identityIndex: identities([
      ["H2896A", { dStrong: "H2896A", eStrong: "H2896a", uStrong: ["H2896A"] }],
      ["G2424G", { dStrong: "G2424G", eStrong: "G2424", uStrong: ["G2424G"] }],
      ["G1138", { dStrong: "G1138", eStrong: "G1138", uStrong: ["H1732"] }]
    ]),
    verseIndex: new Map([
      ["H2896", candidates(["H2896A"])],
      ["G2424", candidates(["G2424G"])],
      ["G1138", candidates(["G1138"])]
    ])
  });

  assert.equal(
    result.text,
    '<w strong="H2896" estrong="H2896a" dstrong="H2896A">agréable</w> ' +
      '<w strong="G2424" dstrong="G2424G">Jésus</w> ' +
      '<w strong="G1138" ustrong="H1732">David</w>'
  );
});

test("reads exact case-sensitive STEP lexical identities", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "step-identities-"));
  const filePath = path.join(directory, "TBESH.txt");
  await writeFile(
    filePath,
    [
      "eStrong#\tdStrong\tuStrong",
      "H2896a\tH2896A =\tH2896A",
      "H0001\tH0001H = a Part of\tH2438H, H0022G"
    ].join("\n"),
    "utf8"
  );

  try {
    const index = await readStepLexicalIdentityIndex([filePath]);
    assert.deepEqual(index.get("H2896A"), {
      dStrong: "H2896A",
      eStrong: "H2896a",
      uStrong: ["H2896A"]
    });
    assert.deepEqual(index.get("H0001H")?.uStrong, ["H2438H", "H0022G"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function candidates(occurrences: string[]): StepStrongCandidates {
  return { unique: new Set(occurrences), occurrences };
}

function identities(
  entries: Array<[string, StepLexicalIdentity]>
): StepLexicalIdentityIndex {
  return new Map(entries);
}
