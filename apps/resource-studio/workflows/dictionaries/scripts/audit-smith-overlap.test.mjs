import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  computeSmithOverlap,
  normalizeSmithHeadword,
  parseSmithImp
} from "./audit-smith-overlap.mjs";

describe("audit Smith / Easton", () => {
  it("parse les notices IMP et conserve les homonymes", () => {
    assert.deepEqual(parseSmithImp("$$$AB\nFirst\n$$$AB\nSecond\n"), [
      { word: "AB", definition: "First" },
      { word: "AB", definition: "Second" }
    ]);
  });

  it("normalise les variantes typographiques des intitulés", () => {
    assert.equal(normalizeSmithHeadword("  Aaron’s-Rod  "), "aaron s rod");
    assert.equal(normalizeSmithHeadword("ÉPHOD & URIM"), "ephod and urim");
  });

  it("distingue les recouvrements Easton des recouvrements Webster", () => {
    const overlap = computeSmithOverlap({
      smithEntries: [
        { word: "Aaron", definition: "A son of Amram and brother of Moses." },
        { word: "Love", definition: "Love is affection." },
        { word: "ATONEMENT, THE DAY OF", definition: "A feast." },
        { word: "Zuzim", definition: "An ancient people." }
      ],
      existingEntries: [
        {
          word: "Aaron",
          definition:
            "<p><strong>Aaron - (Easton's Bible Dictionary)</strong></p><p>A son of Amram and brother of Moses.</p>"
        },
        {
          word: "Love",
          definition:
            "<p><strong>Love - (Webster's 1828 Dictionary)</strong></p><p>Affection.</p>"
        },
        { word: "Day of Atonement", definition: "<p>A feast.</p>" }
      ]
    });
    assert.equal(overlap.exactHeadwordMatches, 2);
    assert.equal(overlap.matchesWithEaston, 1);
    assert.equal(overlap.matchesWithWebsterOnly, 1);
    assert.equal(overlap.variantHeadwordMatches, 1);
    assert.deepEqual(overlap.variantMatches, [
      {
        word: "ATONEMENT, THE DAY OF",
        existingWord: "Day of Atonement"
      }
    ]);
    assert.deepEqual(overlap.uniqueToSmith, ["Zuzim"]);
  });
});
