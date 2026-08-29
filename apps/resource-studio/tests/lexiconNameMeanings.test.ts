import assert from "node:assert/strict";
import test from "node:test";

import {
  parseStepCompiledNameMeanings,
  stripNameMeaningHtml
} from "../src/lexiconNameMeanings.js";

test("extracts explicit Hebrew name meanings", () => {
  const meanings = parseStepCompiledNameMeanings({
    greek: "",
    hebrew: `$=H7586G=שאול\n@STEP_Type= king\n@NameMeans= Saul or Shaul = "desired"\n@StepEtym= asked`
  });
  assert.deepEqual(
    meanings.map(({ stepCode, sourceField, sourceText }) => ({
      stepCode,
      sourceField,
      sourceText
    })),
    [
      {
        stepCode: "H7586G",
        sourceField: "NameMeans",
        sourceText: 'Saul or Shaul = "desired"'
      }
    ]
  );
});

test("keeps Greek named-entity meanings and rejects ordinary definitions", () => {
  const meanings = parseStepCompiledNameMeanings({
    hebrew: "",
    greek: [
      "$=G4569G=σαυλος",
      "@STEP_Type= man",
      '@MounceShortDef= Saul, "asked for" <i>possibly</i> "dedicated to God"',
      "$=G4570=σβεννυμι",
      "@STEP_Type= verb",
      "@MounceShortDef= to extinguish, quench, snuff out",
      "$=G3323=μεσσιας",
      "@STEP_Type= title",
      '@MounceShortDef= Messiah, Anointed One; "anointed"'
    ].join("\n")
  });
  assert.equal(meanings.length, 1);
  assert.equal(meanings[0]?.stepCode, "G4569G");
  assert.equal(meanings[0]?.sourceField, "MounceShortDef");
});

test("strips the supported STEP inline HTML", () => {
  assert.equal(
    stripNameMeaningHtml(
      'Saul, "asked for" <i>possibly</i> "dedicated to God"'
    ),
    'Saul, "asked for" possibly "dedicated to God"'
  );
});
