import assert from "node:assert/strict";
import test from "node:test";

import {
  buildFrenchHtmlTemplate,
  frenchRenderedHtmlSkeleton,
  frenchSourceHtmlSkeleton,
  renderFrenchHtmlTemplate,
  verifyFrenchHtmlTemplate
} from "../src/lexiconV3/frenchHtmlRenderer.js";

test("reconstructs French HTML locally from translated text slots", () => {
  const source = "<b>alpha</b>, the first letter<br />perhaps intensive";
  const template = buildFrenchHtmlTemplate(source);
  assert.deepEqual(verifyFrenchHtmlTemplate(template, source), []);
  assert.deepEqual(
    template.tokens.flatMap((token) =>
      token.kind === "text" && token.translatable
        ? [[token.id, token.sourceText]]
        : []
    ),
    [
      ["t0", "alpha"],
      ["t1", ", the first letter"],
      ["t2", "perhaps intensive"]
    ]
  );

  const rendered = renderFrenchHtmlTemplate(template, [
    { id: "t0", text: "alpha" },
    { id: "t1", text: ", la première lettre" },
    { id: "t2", text: "peut-être intensif" }
  ]);
  assert.equal(
    rendered.meaningHtmlFr,
    "<b>alpha</b>, la première lettre<br>peut-être intensif"
  );
  assert.equal(
    rendered.meaningFr,
    "alpha , la première lettre peut-être intensif"
  );
});

test("repairs the one known unmatched STEP ref close deterministically", () => {
  const template = buildFrenchHtmlTemplate(
    "John 11:37ff</ref>; metaphorically"
  );
  assert.deepEqual(
    frenchSourceHtmlSkeleton("John 11:37ff</ref>; metaphorically"),
    []
  );
  assert.deepEqual(template.sourceNormalizations, [
    {
      tokenIndex: 1,
      sourceToken: "</ref>",
      renderedToken: null,
      reasons: ["drop-unmatched-step-ref-close"]
    }
  ]);
});

test("refuses missing, duplicate and unknown translated slots", () => {
  const template = buildFrenchHtmlTemplate("one <i>two</i>");
  assert.throws(
    () => renderFrenchHtmlTemplate(template, [{ id: "t0", text: "un" }]),
    /missing-french-html-segment:t1/u
  );
  assert.throws(
    () =>
      renderFrenchHtmlTemplate(template, [
        { id: "t0", text: "un" },
        { id: "t1", text: "deux" },
        { id: "t1", text: "deux" }
      ]),
    /duplicate-french-html-segment:t1/u
  );
  assert.throws(
    () =>
      renderFrenchHtmlTemplate(template, [
        { id: "t0", text: "un" },
        { id: "t1", text: "deux" },
        { id: "t9", text: "inconnu" }
      ]),
    /unknown-french-html-segment:t9/u
  );
});

test("normalizes the closed STEP legacy markup set before agents see it", () => {
  const source =
    "<re><author>Thuc.</author> <date>4th c.</date></re> <a href=\"javascript:void(0)\">reference</a> <ref='Tim.4.8'>Tim 4:8</ref>";
  assert.deepEqual(frenchSourceHtmlSkeleton(source), [
    "<span>",
    "<span>",
    "</span>",
    "<span>",
    "</span>",
    "</span>",
    "<span>",
    "</span>",
    "<ref>",
    "</ref>"
  ]);
  const template = buildFrenchHtmlTemplate(source);
  assert.equal(template.sourceNormalizations.length, 9);
  assert.ok(
    template.sourceNormalizations.some((normalization) =>
      normalization.reasons.includes("strip-step-source-attributes")
    )
  );
  assert.doesNotMatch(
    template.tokens
      .map((token) => (token.kind === "tag" ? token.value : ""))
      .join(""),
    /javascript|href|author|date|<re>/iu
  );
});

test("compares locally normalized STEP source tags with canonical rendered spans directionally", () => {
  const source =
    "<re><Level2><b>lemma</b></Level2> <date>4th c.</date> <author>Thuc.</author></re>";
  const rendered =
    "<span><span><b>lemme</b></span> <span>IVe s.</span> <span>Thuc.</span></span>";

  assert.deepEqual(
    frenchRenderedHtmlSkeleton(rendered),
    frenchSourceHtmlSkeleton(source)
  );
  for (const unsafeRendered of [
    "<re>texte</re>",
    "<Level2>texte</Level2>",
    "<date>texte</date>",
    "<author>texte</author>",
    '<span class="source">texte</span>',
    "<unknown>texte</unknown>"
  ]) {
    assert.throws(
      () => frenchRenderedHtmlSkeleton(unsafeRendered),
      /unsafe-rendered-html/u,
      unsafeRendered
    );
  }
});

test("rejects unsafe or malformed source HTML before agents see it", () => {
  assert.throws(
    () => buildFrenchHtmlTemplate('<span class="x">text</span>'),
    /unsafe-source-html-token/u
  );
  assert.throws(
    () => buildFrenchHtmlTemplate("<b>text</i>"),
    /invalid-source-html-nesting/u
  );
  assert.throws(
    () => buildFrenchHtmlTemplate("<script>text</script>"),
    /unsafe-source-html-tag/u
  );
});

test("escapes translated text while preserving Greek and Hebrew", () => {
  const template = buildFrenchHtmlTemplate("λόγος &amp; דָּבָר");
  const result = renderFrenchHtmlTemplate(template, [
    { id: "t0", text: "λόγος & דָּבָר <mot>" }
  ]);
  assert.equal(result.meaningHtmlFr, "λόγος &amp; דָּבָר &lt;mot&gt;");
  assert.equal(result.meaningFr, "λόγος & דָּבָר <mot>");
});
