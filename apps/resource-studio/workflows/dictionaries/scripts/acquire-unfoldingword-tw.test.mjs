import assert from "node:assert/strict";
import test from "node:test";
import {
  renderTranslationWordsInline,
  renderTranslationWordsMarkdown
} from "./acquire-unfoldingword-tw.mjs";

const titles = new Map([["kt/faith.md", "faith"]]);

test("converts Translation Words internal and Bible links", () => {
  assert.equal(
    renderTranslationWordsInline({
      value:
        "[faith](../kt/faith.md), [Galatians 3:8](rc://en/tn/help/gal/03/08), [OBS](rc://en/tn/help/obs/04/06)",
      currentPath: "names/abraham.md",
      titles
    }),
    '<a class="word" href="faith">faith</a>, <a class="verse" href="Galatians 3:8">Galatians 3:8</a>, OBS'
  );
});

test("renders deterministic safe Markdown without the source title", () => {
  const html = renderTranslationWordsMarkdown({
    markdown: "# faith\n\n## Definition:\n\n* Trust **God**.\n",
    currentPath: "kt/faith.md",
    titles
  });
  assert.equal(
    html,
    "<h3>Definition</h3>\n<ul>\n<li>Trust <strong>God</strong>.</li>\n</ul>"
  );
});
