import assert from "node:assert/strict";
import test from "node:test";

import {
  type LexiconV3ResourceWitness,
  type LexiconV3SourceEntry
} from "../src/lexiconV3/contracts.js";
import {
  buildLexiconEntryIdentity,
  buildLexiconEntryKey,
  extractPrimaryDStrong
} from "../src/lexiconV3/identity.js";
import {
  auditLexiconV3Source,
  compareLexiconHeadword,
  extractLexiconHeadword
} from "../src/lexiconV3/sourceAudit.js";

test("builds a stable entry key from language and the first dStrong code", () => {
  assert.equal(extractPrimaryDStrong("H0001H = a Part of H2438H"), "H0001H");
  assert.equal(buildLexiconEntryKey("greek", "g1623 ="), "greek:G1623");
  assert.equal(
    buildLexiconEntryIdentity(
      sourceEntry({
        language: "hebrew",
        eStrong: "H0001",
        dStrong: "H0001H = a Part of H2438H",
        uStrong: "H2438H"
      })
    ).entryKey,
    "hebrew:H0001H"
  );
  assert.throws(
    () => buildLexiconEntryKey("hebrew", "G1623 ="),
    /dstrong-language-mismatch/
  );
  assert.equal(buildLexiconEntryKey("hebrew", "H2148V ="), "hebrew:H2148V");
  assert.equal(buildLexiconEntryKey("hebrew", "H2148v ="), "hebrew:H2148v");
});

test("flags G1623 and selects TFLSJ only as a reviewed repair candidate", () => {
  const entry = sourceEntry({
    eStrong: "G1623",
    dStrong: "G1623 =",
    uStrong: "G1623",
    original: "ἕκτος",
    transliteration: "hektos",
    morph: "G:A",
    gloss: "sixth",
    meaning:
      "<b>ἐκτός</b>, <i>adv.</i> outside, beyond; with a genitive, besides or except."
  });
  const tflsj: LexiconV3ResourceWitness = {
    resourceId: 1673,
    source: "TFLSJ",
    kind: "classical_full",
    contentHtml: "<b>ἕκτος</b>, η, ον, (ἕξ) <b>sixth</b>."
  };

  const audit = auditLexiconV3Source(entry, [tflsj]);

  assert.equal(audit.identity.entryKey, "greek:G1623");
  assert.equal(audit.status, "source_issue");
  assert.equal(audit.requiresReview, true);
  assert.equal(audit.meaningHeadword.match, "mismatch");
  assert.equal(audit.resources[0]?.headword.match, "exact");
  assert.equal(audit.glossSupport.meaningSupportsGloss, false);
  assert.deepEqual(audit.glossSupport.supportingResources, ["TFLSJ"]);
  assert.deepEqual(
    audit.findings.map((finding) => finding.code),
    [
      "meaning-headword-mismatch",
      "resource-corroborates-entry",
      "gloss-supported-by-resource-only"
    ]
  );
  assert.deepEqual(audit.selection, {
    strategy: "resource_repair_candidate",
    source: "TFLSJ",
    kind: "classical_full",
    automatic: false,
    reason:
      "The resource is coherent with the entry, but must be reviewed before replacing the STEP meaning."
  });
});

test("does not confuse the G1623 breathing contrast with an accent variant", () => {
  const comparison = compareLexiconHeadword("ἕκτος", "ἐκτός", {
    language: "greek",
    dStrong: "G1623 ="
  });
  assert.equal(comparison.match, "mismatch");

  assert.equal(
    compareLexiconHeadword("δανείζω", "δανίζω", {
      language: "greek",
      dStrong: "G1155 ="
    }).match,
    "orthographic_variant"
  );
});

test("does not confuse a Greek derivational noun with an inflectional variant", () => {
  const comparison = compareLexiconHeadword("πρεσβύτερος", "πρεσβῠτέριον", {
    language: "greek",
    dStrong: "G4245G ="
  });
  assert.equal(comparison.match, "mismatch");
});

test("accepts an explicitly derived headword instead of raising a false positive", () => {
  const entry = sourceEntry({
    eStrong: "G1498",
    dStrong: "G1498 = a Form of G1510",
    uStrong: "G1510",
    original: "εἴην",
    transliteration: "eien",
    morph: "G:V",
    gloss: "may be",
    meaning: "<b>εἰμί</b>, to be or exist."
  });

  const audit = auditLexiconV3Source(entry);

  assert.equal(audit.status, "source_ok");
  assert.equal(audit.meaningHeadword.match, "explicit_relation");
  assert.equal(audit.requiresReview, false);
  assert.equal(audit.selection.strategy, "step_primary");
  assert.equal(
    audit.findings.some(
      (finding) => finding.code === "meaning-headword-mismatch"
    ),
    false
  );
  assert.equal(
    audit.findings.some(
      (finding) => finding.code === "meaning-headword-derived"
    ),
    true
  );
});

test("accepts a conservative inflectional headword variant", () => {
  const entry = sourceEntry({
    eStrong: "G0149",
    dStrong: "G0149 =",
    uStrong: "G0149",
    original: "αἰσχρόν",
    transliteration: "aischron",
    morph: "G:A",
    gloss: "shameful",
    meaning: "<b>αἰσχρός</b>, shameful or disgraceful."
  });

  const audit = auditLexiconV3Source(entry);

  assert.equal(audit.status, "source_ok");
  assert.equal(audit.meaningHeadword.match, "morphological_variant");
  assert.equal(audit.selection.strategy, "step_primary");
});

test("keeps a coherent STEP meaning when a secondary resource is suspect", () => {
  const entry = sourceEntry({
    eStrong: "G1622",
    dStrong: "G1622 =",
    uStrong: "G1622",
    original: "ἐκτός",
    transliteration: "ektos",
    morph: "G:Adv",
    gloss: "outside",
    meaning: "<b>ἐκτός</b>, outside, beyond or except."
  });
  const suspectResource: LexiconV3ResourceWitness = {
    source: "SECONDARY",
    kind: "full",
    contentHtml: "<b>ἕκτος</b>, sixth."
  };

  const audit = auditLexiconV3Source(entry, [suspectResource]);

  assert.equal(audit.status, "source_ok");
  assert.equal(audit.requiresReview, false);
  assert.equal(audit.selection.strategy, "step_primary");
  assert.equal(
    audit.findings.some(
      (finding) => finding.code === "resource-headword-mismatch"
    ),
    true
  );
});

test("does not guess a replacement when no coherent resource exists", () => {
  const entry = sourceEntry({
    eStrong: "G2600",
    dStrong: "G2600 =",
    uStrong: "G2600",
    original: "κατάβασις",
    transliteration: "katabasis",
    morph: "G:N-F",
    gloss: "descent",
    meaning: "<b>καταβαρύνω</b>, to burden heavily."
  });

  const audit = auditLexiconV3Source(entry);

  assert.equal(audit.status, "source_issue");
  assert.equal(audit.selection.strategy, "manual_review");
  assert.equal(audit.selection.source, null);
  assert.equal(
    audit.findings.some((finding) => finding.code === "no-coherent-resource"),
    true
  );
});

test("extracts only a leading bold original-language headword", () => {
  assert.equal(
    extractLexiconHeadword("English first; later <b>ἕκτος</b>", "greek"),
    "ἕκτος"
  );
  assert.equal(
    extractLexiconHeadword("No bold headword; later ἕκτος", "greek"),
    null
  );
  assert.equal(
    extractLexiconHeadword("<b>דָּבָר</b>, a word", "hebrew"),
    "דָּבָר"
  );
});

function sourceEntry(
  overrides: Partial<LexiconV3SourceEntry> = {}
): LexiconV3SourceEntry {
  return {
    stepEntryId: 1,
    language: "greek",
    eStrong: "G0001",
    dStrong: "G0001 =",
    uStrong: "G0001",
    original: "ἄλφα",
    transliteration: "alpha",
    morph: "G:N-N",
    gloss: "alpha",
    meaning: "<b>ἄλφα</b>, alpha.",
    ...overrides
  };
}
