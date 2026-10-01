import assert from "node:assert/strict";
import { test } from "node:test";
import { createHash } from "node:crypto";
import {
  buildRestoredEgwFrenchCanonical,
  type RestoredEgwCorpus
} from "../src/egwFrenchRestoration.js";
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const html =
  '<span>Dieu nous aime. <span class="bible-ref" data-reference-id="r1">Jean 3:16</span></span>';
const fixture = (): RestoredEgwCorpus => ({
  format: "bible-strong-egw-french-restoration",
  schemaVersion: 1,
  language: "fr",
  sourceSnapshotSha256: "a".repeat(64),
  recoverySqliteSha256: "b".repeat(64),
  documents: [
    {
      id: "84.1",
      bookTitle: "Patriarchs and Prophets",
      sectionTitle: "Creation",
      sourceReference: "PP 1.1",
      contextUrl: "https://text.egwwritings.org/read/84.1",
      translation: {
        language: "fr",
        html,
        sha256: sha(html),
        references: [{ id: "r1", kind: "bible", osis: "John.3.16" }]
      }
    }
  ],
  verses: [{ verseKey: "1-1-1", documentIds: ["84.1"] }]
});

test("packages historical French with its own coverage and French contextual links", () => {
  const result = buildRestoredEgwFrenchCanonical(fixture(), "c".repeat(64));
  assert.equal(result.language, "fr");
  assert.equal(result.resourceId, "egw-writings");
  assert.deepEqual(result.verses, fixture().verses);
  assert.match(result.documents[0].content, /href="bible:\/\/John\.3\.16"/u);
  assert.match(result.documents[0].content, /Lire dans le contexte original/u);
  assert.match(result.revision, /^egw-writings-fr-/u);
  assert.deepEqual(
    result,
    buildRestoredEgwFrenchCanonical(fixture(), "c".repeat(64))
  );
});

test("refuses altered translations, arbitrary context links and invented coverage", () => {
  const changed = fixture();
  changed.documents[0].translation.html = "changed";
  assert.throws(
    () => buildRestoredEgwFrenchCanonical(changed, "c".repeat(64)),
    /translation-invalid/u
  );
  const context = fixture();
  context.documents[0].contextUrl = "https://example.com";
  assert.throws(
    () => buildRestoredEgwFrenchCanonical(context, "c".repeat(64)),
    /context-invalid/u
  );
  const missing = fixture();
  missing.verses[0].documentIds.push("84.2");
  assert.throws(
    () => buildRestoredEgwFrenchCanonical(missing, "c".repeat(64)),
    /reference-missing/u
  );
  const duplicate = fixture();
  duplicate.documents.push(duplicate.documents[0]);
  assert.throws(
    () => buildRestoredEgwFrenchCanonical(duplicate, "c".repeat(64)),
    /document-identity/u
  );
});
