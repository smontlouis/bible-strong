import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { readPublishedCommentaryCopy } from "../src/publishedCommentaryCopy.js";

for (const normalized of [false, true]) {
  test(`preserves published ${normalized ? "normalized" : "legacy"} content and provenance byte for byte`, async () => {
    const root = await mkdtemp(path.join(tmpdir(), "published-commentary-"));
    const sqlitePath = path.join(root, "source.sqlite");
    const content =
      '<p class="original">Écrit &amp; conservé.  Deux espaces.</p>';
    try {
      const db = new DatabaseSync(sqlitePath);
      db.exec(
        `CREATE TABLE RESOURCE_METADATA(resource_id TEXT, language TEXT, revision TEXT, source_version TEXT, source_sha256 TEXT);`
      );
      db.prepare("INSERT INTO RESOURCE_METADATA VALUES (?, ?, ?, ?, ?)").run(
        "barnes",
        "fr",
        "original-revision",
        "original-source-version",
        "a".repeat(64)
      );
      if (normalized) {
        db.exec(
          "CREATE TABLE COMMENTARY_DOCUMENTS(id TEXT, content TEXT); CREATE TABLE COMMENTARY_VERSE_DOCUMENTS(verse_key TEXT, document_id TEXT, ordinal INTEGER)"
        );
        db.prepare("INSERT INTO COMMENTARY_DOCUMENTS VALUES (?, ?)").run(
          "exact-document-id",
          content
        );
        db.exec(
          "INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES ('1-1-2', 'exact-document-id', 0), ('1-1-1', 'exact-document-id', 0)"
        );
      } else {
        db.exec("CREATE TABLE COMMENTAIRES(id TEXT, commentaires TEXT)");
        db.prepare("INSERT INTO COMMENTAIRES VALUES (?, ?)").run(
          "1-1",
          JSON.stringify({ 1: content, 2: content })
        );
      }
      db.close();
      const original = await readFile(sqlitePath);
      const input = {
        sqlitePath,
        resourceId: "barnes",
        language: "fr" as const,
        revision: "original-revision",
        contentSha256: createHash("sha256").update(original).digest("hex")
      };
      const canonical = await readPublishedCommentaryCopy(input);
      assert.equal(canonical.sourceVersion, "original-source-version");
      assert.equal(canonical.sourceSha256, "a".repeat(64));
      assert.notEqual(canonical.revision, input.revision);
      assert.equal(
        (await readPublishedCommentaryCopy(input)).revision,
        canonical.revision
      );
      if (canonical.schemaVersion === 2) {
        assert.deepEqual(canonical.documents, [
          { id: "exact-document-id", content }
        ]);
        assert.deepEqual(
          canonical.verses.map((verse) => verse.documentIds),
          [["exact-document-id"], ["exact-document-id"]]
        );
      } else
        assert.deepEqual(
          canonical.verses.map((verse) => verse.content),
          [content, content]
        );
      assert.deepEqual(await readFile(sqlitePath), original);
      await assert.rejects(
        readPublishedCommentaryCopy({ ...input, resourceId: "wrong" }),
        /IDENTITY_MISMATCH/
      );
      await assert.rejects(
        readPublishedCommentaryCopy({
          ...input,
          contentSha256: "0".repeat(64)
        }),
        /CHECKSUM_MISMATCH/
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
}
