import assert from "node:assert/strict";
import path from "node:path";
import { describe, it } from "node:test";

import {
  deriveStrongLexiconModuleRevision,
  validateStrongLexiconResourcePublication
} from "../src/packageStrongLexiconResourcePublications.js";

describe("Strong lexicon Resource publications", () => {
  it("derives each immutable Resource revision from normalized module content", () => {
    const first = deriveStrongLexiconModuleRevision("core", {
      StepEntries: [{ id: 1, gloss: "word" }]
    });
    const reordered = deriveStrongLexiconModuleRevision("core", {
      StepEntries: [{ gloss: "word", id: 1 }]
    });
    const changed = deriveStrongLexiconModuleRevision("core", {
      StepEntries: [{ id: 1, gloss: "speech" }]
    });
    assert.equal(first, reordered);
    assert.notEqual(first, changed);
    assert.match(first, /^strong-lexicon-core-[a-f0-9]{24}$/u);
  });

  it(
    "validates the complete core/resources/entities handoff when real artifacts are supplied",
    { skip: !process.env.STRONG_LEXICON_BUNDLES_ROOT },
    async () => {
      for (const moduleId of ["core", "resources", "entities"] as const) {
        const manifest = await validateStrongLexiconResourcePublication(
          path.join(process.env.STRONG_LEXICON_BUNDLES_ROOT!, moduleId)
        );
        assert.equal(manifest.identity.moduleId, moduleId);
        assert.ok(Object.values(manifest.counts).every((count) => count > 0));
      }
    }
  );
});
