import assert from "node:assert/strict";
import test from "node:test";

import {
  classifyTbeshMeaningSections,
  countTbeshSectionSeparators,
  hasMeaningfulTbeshHtml,
  hasTbeshSectionSeparator,
  parseTbeshMeaning
} from "../src/lexiconV3/tbeshMeaning.js";

test("splits a literal section marker while preserving the source", () => {
  const rawHtml =
    "  <b>Specific person</b><br><BR /> \n § \t<br/> <i>General family</i>  ";

  assert.deepEqual(parseTbeshMeaning(rawHtml), {
    rawHtml,
    stepSpecificHtml: "  <b>Specific person</b>",
    legacyGeneralHtml: "<i>General family</i>  ",
    hasSectionSeparator: true,
    sectionSeparatorCount: 1,
    classification: "both"
  });
});

test("supports the HTML section entity case-insensitively", () => {
  const rawHtml = "Exact<br />&SECT;<br>Legacy";

  assert.deepEqual(parseTbeshMeaning(rawHtml), {
    rawHtml,
    stepSpecificHtml: "Exact",
    legacyGeneralHtml: "Legacy",
    hasSectionSeparator: true,
    sectionSeparatorCount: 1,
    classification: "both"
  });
  assert.equal(hasTbeshSectionSeparator(rawHtml), true);
});

test("splits only once and preserves later markers in legacy context", () => {
  const parsed = parseTbeshMeaning("Specific § Legacy A &sect; Legacy B");

  assert.equal(parsed.stepSpecificHtml, "Specific");
  assert.equal(parsed.legacyGeneralHtml, "Legacy A &sect; Legacy B");
  assert.equal(parsed.sectionSeparatorCount, 2);
  assert.equal(countTbeshSectionSeparators(parsed.rawHtml), 2);
  assert.equal(parsed.classification, "both");
});

test("keeps unmarked meanings whole and does not trim their HTML", () => {
  const rawHtml = "  <p>A complete STEP meaning</p>  ";

  assert.deepEqual(parseTbeshMeaning(rawHtml), {
    rawHtml,
    stepSpecificHtml: rawHtml,
    legacyGeneralHtml: "",
    hasSectionSeparator: false,
    sectionSeparatorCount: 0,
    classification: "specific_only"
  });
  assert.equal(hasTbeshSectionSeparator(rawHtml), false);
});

test("classifies empty sides using visible content rather than markup", () => {
  assert.equal(
    parseTbeshMeaning("<br> § Legacy").classification,
    "legacy_only"
  );
  assert.equal(
    parseTbeshMeaning("Specific § <br />").classification,
    "specific_only"
  );
  assert.equal(
    parseTbeshMeaning("<!-- note --><br>&sect;&nbsp;<br>").classification,
    "empty"
  );

  assert.equal(classifyTbeshMeaningSections("Specific", "Legacy"), "both");
  assert.equal(
    classifyTbeshMeaningSections("<b></b>", "Legacy"),
    "legacy_only"
  );
  assert.equal(hasMeaningfulTbeshHtml("<p>&#160;\u200b</p>"), false);
  assert.equal(hasMeaningfulTbeshHtml("<p>&amp;</p>"), true);
});

test("does not confuse other entities with the section marker", () => {
  const rawHtml = "Law &amp; grace &#167; context";
  const parsed = parseTbeshMeaning(rawHtml);

  assert.equal(parsed.hasSectionSeparator, false);
  assert.equal(parsed.stepSpecificHtml, rawHtml);
  assert.equal(parsed.legacyGeneralHtml, "");
  assert.equal(parsed.sectionSeparatorCount, 0);
});
