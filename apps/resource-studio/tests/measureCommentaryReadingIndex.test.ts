import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { measureCommentaryReadingIndex } from "../src/measureCommentaryReadingIndex.js";

test("measures real SQLite chapter payloads without modifying the input artifact", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "commentary-measure-fixture-")
  );
  const input = path.join(directory, "source.sqlite");
  try {
    const database = new DatabaseSync(input);
    database.exec(`CREATE TABLE RESOURCE_METADATA(resource_id TEXT, language TEXT, revision TEXT);
      INSERT INTO RESOURCE_METADATA VALUES ('barnes', 'fr', 'fixture');
      CREATE TABLE COMMENTAIRES(id TEXT, commentaires TEXT);`);
    const insert = database.prepare("INSERT INTO COMMENTAIRES VALUES (?, ?)");
    insert.run("1-1", JSON.stringify({ 1: "<p>Commentaire.</p>" }));
    insert.run(
      "1-2",
      JSON.stringify({
        1: `<p>${"Texte long ".repeat(100)}</p>`,
        2: "<p>Autre section</p>"
      })
    );
    database.close();
    const before = await readFile(input);
    const report = await measureCommentaryReadingIndex(input);
    assert.equal(report.chapters, 2);
    assert.equal(report.sections, 3);
    assert.equal(report.worst[0]?.chapter, 2);
    assert.ok(report.addedBytes > 0);
    assert.ok(report.worst[0]!.bytes > report.worst[0]!.gzipBytes);
    assert.match(
      JSON.stringify(report.queryPlan),
      /COMMENTARY_READING_CHAPTER/
    );
    assert.deepEqual(await readFile(input), before);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
