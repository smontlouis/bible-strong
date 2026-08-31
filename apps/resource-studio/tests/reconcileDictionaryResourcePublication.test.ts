import assert from "node:assert/strict";
import { test } from "node:test";

import { publicationId } from "../src/reconcileResourcePublicationSet.js";

test("projects each dictionary work to its own mobile catalog identity", () => {
  assert.equal(
    publicationId({ kind: "dictionary", resourceId: "WESTPHAL", language: "fr" }),
    "database:WESTPHAL:fr"
  );
  assert.equal(
    publicationId({ kind: "dictionary", resourceId: "BOST", language: "fr" }),
    "database:BOST:fr"
  );
});
