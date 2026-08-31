import assert from "node:assert/strict";
import { test } from "node:test";

import {
  materializeCommentaryBibleLinks,
  sanitizeCommentaryPublicationHtml
} from "../src/commentaryPublicationHtml.js";

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

test("unwraps malformed CrossWire titles and removes unavailable figures", () => {
  assert.equal(
    sanitizeCommentaryPublicationHtml(
      '<h4> <title type="x-ms">SERMONS DE SAINT AUGUSTIN <figure size="span" src="Images/tiffany.jpg">Portrait</figure></h4><p>Le commentaire demeure.</p>'
    ),
    "<h4> SERMONS DE SAINT AUGUSTIN </h4><p>Le commentaire demeure.</p>"
  );
});

test("removes remote advertising and decorative images", () => {
  assert.equal(
    sanitizeCommentaryPublicationHtml(
      '<p>Avant <img src="http://www.studylight.info/ad.gif" alt="Sponsor a child today!"> après.</p>'
    ),
    "<p>Avant après.</p>"
  );
});

test("preserves autonomous OSIS links while sanitizing publication HTML", () => {
  assert.equal(
    sanitizeCommentaryPublicationHtml(
      '<p><a class="bible-ref" href="bible://John.3.16" data-osis="John.3.16">Jean 3:16</a></p>'
    ),
    '<p><a class="bible-ref" href="bible://John.3.16" data-osis="John.3.16">Jean 3:16</a></p>'
  );
});
