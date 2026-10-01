import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  selectHistoricalVariant,
  normalizeRestoredFrench,
  restoreEgwFrench
} from "./restore-egw-french.mjs";
import { hash, correspondenceText } from "./egw-french-recovery.mjs";
const legacy = (text) =>
  `<p data-refcode="PP 1.1"><span class="egw_content">${text}</span><span class="egw_refcode">PP 1.1</span></p>`;

test("restoration chooses existing variants deterministically, including ties", () => {
  const a = {
    french_sha256: "a",
    occurrences: 2,
    content_html: legacy("Dieu est amour.")
  };
  const b = {
    french_sha256: "b",
    occurrences: 2,
    content_html: legacy("Dieu nous aime.")
  };
  assert.equal(selectHistoricalVariant([b, a]).selected.french_sha256, "a");
  assert.equal(selectHistoricalVariant([a, b]).tied, true);
  assert.equal(
    selectHistoricalVariant([a, { ...b, occurrences: 3 }]).selected
      .french_sha256,
    "b"
  );
  assert.equal(
    selectHistoricalVariant([{ ...a, content_html: legacy("Job 13:15, 16.") }])
      .selected.body,
    "Job 13:15, 16."
  );
});

test("only truly empty prose is excluded, malformed spans still block restoration", () => {
  const empty = {
    french_sha256: "empty",
    content_html: legacy(""),
    occurrences: 1
  };
  assert.equal(selectHistoricalVariant([empty]).selected, null);
  assert.throws(
    () =>
      selectHistoricalVariant([
        { ...empty, content_html: '<span class="egw_content">broken' }
      ]),
    /body-invalid/u
  );
});

test("normalization preserves prose, removes active markup and retains Bible references", () => {
  const result = normalizeRestoredFrench(
    'Dieu nous aime. <a href="/John_3.16">Jean 3:16</a><script>alert(1)</script>'
  );
  assert.deepEqual(
    result.references.map((x) => x.osis),
    ["John.3.16"]
  );
  assert.ok(!result.html.includes("script"));
  assert.equal(correspondenceText(result.html), "Dieu nous aime. Jean 3:16");
  const fallback = normalizeRestoredFrench(
    "Le signe &#60;x&#62; est conservé."
  );
  assert.equal(fallback.plainTextFallback, true);
  assert.equal(correspondenceText(fallback.html), "Le signe <x> est conservé.");
});

test("restores only existing French and reuses it only on historical paragraph associations", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "egw-restore-"));
  try {
    const en = legacy("God loves us.");
    const fr = legacy("Dieu nous aime.");
    const dbPath = path.join(root, "recovered-paragraphs.sqlite");
    const db = new DatabaseSync(dbPath);
    db.exec(`CREATE TABLE source_paragraphs(paragraph_id TEXT,source_sha256 TEXT,content_html TEXT);
      CREATE TABLE french_variants(paragraph_id TEXT,source_sha256 TEXT,french_sha256 TEXT,content_html TEXT,probable_language TEXT);
      CREATE TABLE legacy_associations(paragraph_id TEXT,source_sha256 TEXT,french_sha256 TEXT);`);
    db.prepare("INSERT INTO source_paragraphs VALUES(?,?,?)").run(
      "84.1",
      "source",
      en
    );
    db.prepare("INSERT INTO source_paragraphs VALUES(?,?,?)").run(
      "84.2",
      "missing",
      legacy("Untranslated paragraph.")
    );
    db.prepare("INSERT INTO french_variants VALUES(?,?,?,?,?)").run(
      "84.1",
      "source",
      "french",
      fr,
      "fr"
    );
    db.prepare("INSERT INTO legacy_associations VALUES(?,?,?)").run(
      "84.1",
      "source",
      "french"
    );
    db.close();
    const entry = {
      id: 1,
      type: "egw_comment",
      passage: "1-1-1",
      order: 1,
      paragraphIds: ["84.1", "84.2"],
      resource: { name: "Patriarchs and Prophets" },
      chapterTitle: "Creation",
      content: en,
      sourceSha256: hash(en),
      french: { exists: true, content: fr, sha256: hash(fr) }
    };
    const lines =
      [
        entry,
        {
          ...entry,
          id: 2,
          passage: "1-1-2",
          french: { exists: false, content: "", sha256: null }
        }
      ]
        .map(JSON.stringify)
        .join("\n") + "\n";
    await writeFile(path.join(root, "entries.jsonl"), lines);
    await writeFile(
      path.join(root, "checksums.json"),
      JSON.stringify({
        "entries.jsonl": { sha256: hash(lines) },
        "recovered-paragraphs.sqlite": { sha256: hash(await readFile(dbPath)) }
      })
    );
    const output = path.join(root, "output");
    const summary = await restoreEgwFrench({ recoveryRoot: root, output });
    assert.equal(summary.paragraphs, 1);
    assert.equal(summary.verses, 2);
    assert.equal(summary.newTranslations, 0);
    const corpus = JSON.parse(
      await readFile(path.join(output, "corpus.json"), "utf8")
    );
    assert.deepEqual(corpus.verses, [
      { verseKey: "1-1-1", documentIds: ["84.1"] },
      { verseKey: "1-1-2", documentIds: ["84.1"] }
    ]);
    assert.equal(corpus.documents[0].translation.html, "Dieu nous aime.");
    assert.equal(
      summary.corpusSha256,
      hash(await readFile(path.join(output, "corpus.json")))
    );
    await assert.rejects(
      restoreEgwFrench({ recoveryRoot: root, output }),
      /output-exists/u
    );
    await writeFile(path.join(root, "entries.jsonl"), "tampered");
    await assert.rejects(
      restoreEgwFrench({
        recoveryRoot: root,
        output: path.join(root, "invalid")
      }),
      /input-hash/u
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
