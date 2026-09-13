import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { writeCommentaryReadingIndex } from "../src/commentaryReadingIndex.js";

for (const normalized of [false, true]) {
  test(`packages revision-local reading index from ${normalized ? "normalized" : "legacy"} schema`, () => {
    const database = new DatabaseSync(":memory:");
    try {
      if (normalized) {
        database.exec(`CREATE TABLE COMMENTARY_DOCUMENTS(id TEXT, content TEXT);
          CREATE TABLE COMMENTARY_VERSE_DOCUMENTS(verse_key TEXT, ordinal INTEGER, document_id TEXT);
          INSERT INTO COMMENTARY_DOCUMENTS VALUES ('a', '<p>Shared &amp; short.</p>');
          INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES ('1-1-1', 0, 'a'), ('1-1-2', 0, 'a');`);
      } else {
        database.exec("CREATE TABLE COMMENTAIRES(id TEXT, commentaires TEXT)");
        database.prepare("INSERT INTO COMMENTAIRES VALUES (?, ?)").run(
          "1-1",
          JSON.stringify({
            1: "<p>Shared &amp; short.</p>",
            2: "<p>Shared &amp; short.</p>"
          })
        );
      }
      writeCommentaryReadingIndex(database, {
        resourceId: "barnes",
        language: "fr"
      });
      const rows = database
        .prepare(
          "SELECT id, range_start_verse, range_end_verse, excerpt FROM COMMENTARY_READING_SECTIONS WHERE book=1 AND chapter=1"
        )
        .all();
      assert.equal(rows.length, 1);
      assert.equal(rows[0].id, "barnes-fr-1-1-1-2");
      assert.equal(rows[0].excerpt, "Shared & short.");
      assert.equal(rows[0].range_end_verse, 2);
      assert.ok(
        !database
          .prepare("PRAGMA table_info(COMMENTARY_READING_SECTIONS)")
          .all()
          .some((row) => row.name === "content")
      );
      assert.equal(
        database
          .prepare(
            normalized
              ? "SELECT content FROM COMMENTARY_DOCUMENTS"
              : "SELECT commentaires AS content FROM COMMENTAIRES"
          )
          .get()
          ?.content?.toString()
          .includes("Shared &amp; short."),
        true
      );
    } finally {
      database.close();
    }
  });
}
