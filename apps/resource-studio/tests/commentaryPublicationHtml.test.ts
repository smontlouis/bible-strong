import assert from "node:assert/strict";
import { test } from "node:test";

import { materializeCommentaryBibleLinks } from "../src/commentaryPublicationHtml.js";

test("materializes normalized commentary references as autonomous OSIS links", () => {
  assert.equal(
    materializeCommentaryBibleLinks({
      html: '<p>See <span class="bible-ref" data-reference-id="r1">Matthew <em>3:13-17</em></span>.</p>',
      references: [{ id: "r1", kind: "bible", osis: "Matt.3.13-Matt.3.17" }]
    }),
    '<p>See <a class="bible-ref" href="bible://Matt.3.13-Matt.3.17" data-osis="Matt.3.13-Matt.3.17">Matthew <em>3:13-17</em></a>.</p>'
  );
});

test("fails packaging when a normalized reference has lost its OSIS metadata", () => {
  assert.throws(
    () =>
      materializeCommentaryBibleLinks({
        html: '<span class="bible-ref" data-reference-id="r7">John 3:16</span>'
      }),
    /commentary-reference-unresolved:r7/u
  );
});
