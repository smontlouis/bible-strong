import assert from "node:assert/strict";
import test from "node:test";
import { assessSourceReading } from "../src/strongSourceReading.js";
import { parseSourceRow, makeUnits } from "../src/strongSourceUnits.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";

function hebrew(reading: string, meaning = "") {
  return parseSourceRow(
    `Gen.1.1#01=${reading}\tsurface\ttranslit\tgloss\t{H4325}\tHNcmpa\t${meaning}\t\tH4325\t\t\t`,
    "TAHOT fixture.txt",
    1
  )!;
}
function greek(reading: string, meaning = "", primary = "G2090") {
  return parseSourceRow(
    `Luk.1.1#01=${reading}\tsurface\tprepare\t${primary}=V-PAI-1P\tlemma\tNA28+TR\t${meaning}\t\t\t\t#01\t${primary}\t`,
    "TAGNT fixture.txt",
    1
  )!;
}
test("TAHOT lowercase punctuation and combined minor flags preserve lexical reading", () => {
  for (const label of ["L", "L(p)", "L(b+p)", "L(a)(p)"]) {
    const row = hebrew(label),
      before = JSON.stringify(row);
    const result = assessSourceReading(row, "HNcmpa");
    assert.equal(result.lexicalReadingUnresolved, false, label);
    assert.equal(result.rawReading, label);
    assert.equal(JSON.stringify(row), before);
  }
});
test("OT significant, unknown, non-L and contradictory evidence remain unresolved", () => {
  for (const label of ["L(P)", "L(p+H)", "Q(k)", "K", "L(z)", "L("])
    assert.equal(
      assessSourceReading(hebrew(label)).lexicalReadingUnresolved,
      true,
      label
    );
  assert.equal(
    assessSourceReading(hebrew("L(p)", "a meaning variant"))
      .lexicalReadingUnresolved,
    true
  );
});
test("Greek minor inflection may recover the same lexical identity without adjudicating grammar", () => {
  for (const label of ["N(k)O", "NK(o)", "N(k)(o)"]) {
    const result = assessSourceReading(
      greek(label, "alternative form - G2090=V-FAI-1P in: TR"),
      "V-PAI-1P"
    );
    assert.equal(result.classification, "minor-same-lexeme");
    assert.equal(result.grammarAndEditionChoice, "not-adjudicated");
  }
});
test("minor flags do not erase different lemmas, senses, POS, or unparsed descriptions", () => {
  for (const description of [
    "form - G2091=V-FAI-1P",
    "form - G2090=N-NSM",
    "unparsed variant",
    "form - G2090=V-FAI-1P related G2091"
  ])
    assert.equal(
      assessSourceReading(greek("N(k)O", description), "V-PAI-1P")
        .lexicalReadingUnresolved,
      true,
      description
    );
  assert.equal(
    assessSourceReading(
      greek("N(k)O", "form - G2090=V-FAI-1P", "G2090A"),
      "V-PAI-1P"
    ).lexicalReadingUnresolved,
    true
  );
});
test("standalone or missing edition rows and significant Greek variants are not promoted", () => {
  for (const label of [
    "k",
    "no",
    "KO",
    "NO",
    "N(o)",
    "n(k)o",
    "N(K)O",
    "NK(O)",
    "N(k)(k)"
  ])
    assert.equal(
      assessSourceReading(greek(label, "form - G2090=V-FAI-1P"), "V-PAI-1P")
        .lexicalReadingUnresolved,
      true,
      label
    );
});
test("source-unit integration changes interpretation without merging source occurrences", () => {
  const row = hebrew("L(p)");
  const source: OriginalStrongOccurrence[] = [
    {
      occurrenceId: `${row.id}.main:0`,
      tokenId: `${row.id}.main`,
      tokenIndex: 1,
      sourceIdentity: row.id,
      strong: "H4325",
      sourceStrong: "H4325",
      text: row.surface,
      gloss: row.gloss,
      lemma: row.surface,
      morph: "HNcmpa",
      pos: ""
    }
  ];
  const unit = makeUnits({ source }, new Map([[row.id, row]]))[0];
  assert.equal(unit.structure, "single-identity");
  assert.equal(unit.id, row.id);
  assert.deepEqual(unit.occurrenceIds, [source[0].occurrenceId]);
  assert.equal(unit.row.reading, "L(p)");
  assert.equal(unit.readingAssessment?.classification, "minor-same-lexeme");
});
