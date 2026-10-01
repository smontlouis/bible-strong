import assert from "node:assert/strict";
import test from "node:test";
import {
  findLostLineBreaks,
  mapSpanAcrossLineBreaks,
  restoreLineBreaks
} from "../scripts/neg79-line-breaks/lineBreaks.js";

// Invented wording reproducing the joins of the converted source.
const GLUED =
  "Il dit à ses amis:Écoutez ma voix!Amis du roi, écoutez,Et voyez le cielEt la mer… Ah!quel jour.\n";

test("lost line breaks are restored after punctuation and between glued words", () => {
  const { breaks, unrepaired } = findLostLineBreaks(GLUED);
  assert.deepEqual(
    breaks.map(({ rule }) => rule),
    [
      "punctuation-capital",
      "punctuation-capital",
      "punctuation-capital",
      "word-capital",
      "punctuation-lower"
    ]
  );
  assert.deepEqual(unrepaired, []);
  assert.equal(
    restoreLineBreaks(GLUED, breaks),
    "Il dit à ses amis:\n Écoutez ma voix!\n Amis du roi, écoutez,\n Et voyez le ciel\n Et la mer… Ah!\n quel jour.\n"
  );
});

test("ordinary typography is left untouched", () => {
  for (const text of [
    "L'Éternel parla à Moïse et à Aaron.\n",
    "l’Éternel, Jésus-Christ, J.-C., «Vous êtes» (Ainsi) [Selon].\n",
    "Le roi MANÉ, MANÉ, et David.\n"
  ])
    assert.deepEqual(findLostLineBreaks(text), { breaks: [], unrepaired: [] });
});

test("joins that are not line ends are reported, not repaired", () => {
  const opening = findLostLineBreaks(
    "Il est dit dans le livre: …Ville en paix.\n"
  );
  assert.deepEqual(opening.breaks, []);
  assert.deepEqual(opening.unrepaired, [
    { offset: 27, reason: "punctuation-after-space" }
  ]);
  const typo = findLostLineBreaks("L ‘Eternel exauça le roi.\n");
  assert.deepEqual(typo.breaks, []);
  assert.deepEqual(typo.unrepaired, [
    { offset: 3, reason: "other-glued-capital" }
  ]);
});

test("spans keep their words when separators are inserted at their edges", () => {
  const text = "Il dit:Venez à moi!Et il partit.";
  const { breaks } = findLostLineBreaks(text);
  const restored = restoreLineBreaks(text, breaks);
  // « Venez à moi! » starts and ends on a restored line break.
  const [start, end] = mapSpanAcrossLineBreaks([7, 19], breaks);
  assert.equal(restored.slice(start, end), "Venez à moi!");
  // A span crossing a break keeps the separator inside.
  const [wideStart, wideEnd] = mapSpanAcrossLineBreaks([3, 21], breaks);
  assert.equal(restored.slice(wideStart, wideEnd), "dit:\n Venez à moi!\n Et");
});
