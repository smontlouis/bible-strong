import assert from "node:assert/strict";
import test from "node:test";

import { projectSdabcContent } from "../src/commentaryPresentation.js";

test("projects a general-only SDABC passage without an EGW heading", () => {
  assert.equal(
    projectSdabcContent([
      { id: "general", layer: "general-commentary", html: "<p>General.</p>" }
    ]),
    "<p>General.</p>"
  );
});

test("keeps the scripture index separate from bilingual SDABC prose", () => {
  const parts = [
    { id: "index", layer: "egw-scripture-index", html: "<p>Index.</p>" },
    { id: "egw", layer: "egw-supplement", html: "<p>EGW.</p>" }
  ];
  assert.equal(
    projectSdabcContent(parts),
    "<br><br><h3>Ellen G. White</h3><br><p>EGW.</p>"
  );
});
