import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyAbbottSmithDefinition,
  comparableSourceValue,
  containsLsjAbsenceText,
  parseStepGreekLexicon,
  selectGreekMeaning,
  sourceValuesEquivalent,
  stripLsjAbsenceTail
} from "../src/greekLexiconReorganization.js";

test("parses STEP blocks and retains exact field line provenance", () => {
  const entries = parseStepGreekLexicon(`\uFEFF$=G0002=aaron====
@dStrNo=\tG0002
@StepGloss=\tAaron
@ShortDef=\tAaron was Moses' older brother.
@AS_Def=\t<b>Ἀαρών</b>, Aaron.
$=G0058=agora====
@dStrNo=\tG0058
@StepGloss=\tmarketplace
@MounceShortDef=\tmarketplace (as a center of social life)
`);

  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.code, "G0002");
  assert.equal(entries[0]?.fields.ShortDef, "Aaron was Moses' older brother.");
  assert.equal(entries[0]?.fieldLines.ShortDef, 4);
  assert.equal(entries[1]?.sourceLine, 6);
});

test("selects an entity ShortDef only when it explicitly identifies the entry gloss", () => {
  const [aaron, abba] = parseStepGreekLexicon(`$=G0002=aaron====
@STEP_Article=\tAaron@Exo.4.14-Heb
@StepGloss=\tAaron
@ShortDef=\tAaron was Moses' older brother and Israel's first high priest.
@MounceShortDef=\tAaron (referring to both the person and his priesthood)
$=G0005=abba====
@STEP_Article=\tLORD@Gen.1.1-Rev
@StepGloss=\tAbba
@ShortDef=\tThroughout the Bible, God is referred to by various names.
@MounceShortDef=\tAramaic for "father"
`);

  assert.deepEqual(selectGreekMeaning(aaron!), {
    code: "G0002",
    meaningHtml:
      "Aaron was Moses' older brother and Israel's first high priest.",
    meaningText:
      "Aaron was Moses' older brother and Israel's first high priest.",
    source: "TIPNR_SHORT",
    sourceField: "ShortDef",
    sourceLine: 4,
    rule: "entity-short-explicitly-names-gloss"
  });
  assert.equal(selectGreekMeaning(abba!)?.meaningText, 'Aramaic for "father"');
  assert.equal(selectGreekMeaning(abba!)?.source, "MOUNCE_SHORT");
});

test("classifies classical, dStrong and extended short fields without calling all of them Mounce", () => {
  const entries = parseStepGreekLexicon(`$=G0058=agora====
@MounceShortDef=\tmarketplace
$=G0032H=messenger====
@MounceShortDef=\tmessenger
$=G9829=heliopolis====
@MounceShortDef=\tHeliopolis
`);

  assert.equal(selectGreekMeaning(entries[0]!)?.source, "MOUNCE_SHORT");
  assert.equal(selectGreekMeaning(entries[1]!)?.source, "STEP_DSTRONG_SHORT");
  assert.equal(selectGreekMeaning(entries[2]!)?.source, "STEP_EXTENDED_SHORT");
});

test("uses deterministic fallbacks and never invents a synthesis", () => {
  const entries = parseStepGreekLexicon(`$=G0001G=alpha====
@StepGloss=\tAlpha
@ShortDef=\tAlpha is the first letter.
$=G7000=extended====
@StepGloss=\textended
@MounceMedDef=\tAn extended STEP definition.
$=G7001=gloss====
@StepGloss=\tlast resort
`);

  assert.equal(selectGreekMeaning(entries[0]!)?.source, "TIPNR_SHORT_FALLBACK");
  assert.equal(
    selectGreekMeaning(entries[1]!)?.source,
    "STEP_EXTENDED_MEDIUM_FALLBACK"
  );
  assert.equal(selectGreekMeaning(entries[2]!)?.source, "STEP_GLOSS_FALLBACK");
});

test("distinguishes Abbott-Smith from LSJ fillers stored in AS_Def", () => {
  assert.equal(
    classifyAbbottSmithDefinition("<b>ἀγορά</b>, a marketplace"),
    "abbott_smith"
  );
  assert.equal(
    classifyAbbottSmithDefinition("<b>ἀγραυλέω</b>, live outside [From FLSJ]"),
    "lsj_fallback"
  );
  assert.equal(classifyAbbottSmithDefinition(""), "missing");
});

test("matches exact source parents across formatting and provenance labels", () => {
  const source =
    "<b>Ἀαρών</b> (Heb. אַהֲרוֹן), <BR /> <b>Aaron</b>: <ref='Luk.1.5'>Luk.1:5</ref>.";
  const imported =
    "<b>Ἀαρών</b> (Heb. אַהֲרוֹן), <br /> <b>Aaron</b>: Luk.1:5. <br /> (AS)";

  assert.equal(sourceValuesEquivalent(source, imported), true);
  assert.equal(
    sourceValuesEquivalent(source, imported.replace("Aaron", "Abel")),
    false
  );
  assert.equal(
    comparableSourceValue("<b>word</b>"),
    comparableSourceValue("word")
  );
});

test("recognizes and removes English and French LSJ absence tails", () => {
  assert.equal(
    containsLsjAbsenceText(
      "(D’après Abbott-Smith. Le LSJ ne contient aucune entrée)"
    ),
    true
  );
  assert.equal(
    stripLsjAbsenceTail("<b>Aaron</b>. (From Abbott-Smith. LSJ has no entry)"),
    "<b>Aaron</b>."
  );
  assert.equal(
    stripLsjAbsenceTail(
      "<b>Aaron</b>. (D’après Abbott-Smith. Le LSJ ne contient aucune entrée)"
    ),
    "<b>Aaron</b>."
  );
});
