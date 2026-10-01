import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtemp, readFile, rm, writeFile, access } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  correspondenceText,
  extractLegacyBody,
  hash,
  reconcileParagraph
} from "./egw-french-recovery.mjs";
import { prepareEgwFrenchRecovery } from "./prepare-egw-french-recovery.mjs";

const legacy = (body) =>
  `<p data-para-id="84.85"><span class="egw_content" data-translate="ignored">${body}</span><span class="egw_refcode">PP 36.2</span></p>`;
const published = (body) =>
  `<h3>Patriarchs and Prophets</h3><h4>The Creation</h4><p><strong>PP 36.2</strong></p><span>${body}</span><p><a class="external-source" href="https://text.egwwritings.org/read/84.85">View in context</a></p>`;
const sourceBody = "God's love brings peace to the heart.";
const frenchBody = "L’amour de Dieu apporte la paix dans le cœur.";
const source = {
  content_html: legacy(sourceBody),
  source_sha256: "legacy-source"
};
const document = { id: "84.85", content: published(sourceBody) };
const variant = (body, occurrences = 1) => ({
  content_html: legacy(body),
  french_sha256: hash(body),
  occurrences
});

test("extracts nested prose without legacy metadata or citation furniture", () => {
  assert.equal(
    extractLegacyBody(legacy("One <span>nested <em>word</em></span>.")),
    "One <span>nested <em>word</em></span>."
  );
  assert.throws(
    () => extractLegacyBody('<span class="egw_content">broken'),
    /body-invalid/u
  );
  assert.throws(
    () => extractLegacyBody(legacy("A") + legacy("B")),
    /multiple-bodies/u
  );
});

test("correspondence accepts typography but preserves meaningful source changes", () => {
  assert.equal(
    correspondenceText("God&apos;s &ldquo;love&rdquo;"),
    correspondenceText("God’s “love”")
  );
  assert.notEqual(
    correspondenceText("God saves."),
    correspondenceText("God never saves.")
  );
  assert.notEqual(
    correspondenceText("John 3:16"),
    correspondenceText("John 3:17")
  );
  assert.equal(
    correspondenceText("<a>John 3:16</a>, <a>17</a>."),
    correspondenceText("John 3:16, 17.")
  );
  assert.equal(
    correspondenceText("<strong>Heading</strong>—text"),
    correspondenceText("<strong>Heading—</strong>text")
  );
  assert.equal(
    reconcileParagraph({
      document: {
        ...document,
        content: published("God’s love brings peace to the heart.")
      },
      historical: source,
      variants: [variant(frenchBody)]
    }).status,
    "recovered"
  );
  assert.equal(
    reconcileParagraph({
      document: {
        ...document,
        content: published("God's love never brings peace to the heart.")
      },
      historical: source,
      variants: [variant(frenchBody)]
    }).reason,
    "source-changed"
  );
});

test("variants use reproducible frequency and keep genuine ties for review", () => {
  const v = [
    variant(frenchBody, 8),
    variant("L'amour divin donne la paix au cœur.", 2)
  ];
  const result = reconcileParagraph({
    document,
    historical: source,
    variants: v
  });
  assert.equal(result.selectedFrenchSha256, v[0].french_sha256);
  assert.equal(result.selection, "most-used-eligible-historical-text");
  assert.equal(
    reconcileParagraph({
      document,
      historical: source,
      variants: [v[0], { ...v[1], occurrences: 8 }]
    }).reason,
    "tied-variants"
  );
});

test("copied English, changed destinations and unsafe translations are quarantined", () => {
  assert.equal(
    reconcileParagraph({
      document,
      historical: source,
      variants: [variant(sourceBody, 99)]
    }).reason,
    "translation-quality"
  );
  const a = '<a href="/en/book/1965.1">John 3:16</a>';
  const changed = '<a href="/en/book/1965.2">Jean 3:16</a>';
  const result = reconcileParagraph({
    document: { ...document, content: published(a) },
    historical: { ...source, content_html: legacy(a) },
    variants: [variant(changed)]
  });
  assert.deepEqual(result.rejected[0].issues, ["source-links-changed"]);
  assert.equal(
    reconcileParagraph({
      document,
      historical: source,
      variants: [variant(frenchBody + "<script>alert(1)</script>")]
    }).status,
    "review"
  );
});

test("missing data stays missing; unexpected published shapes require review", () => {
  assert.equal(
    reconcileParagraph({ document, variants: [] }).reason,
    "absent-from-legacy"
  );
  assert.equal(
    reconcileParagraph({ document, historical: source, variants: [] }).reason,
    "not-translated"
  );
  assert.equal(
    reconcileParagraph({
      document: { id: "x", content: "unknown" },
      variants: []
    }).reason,
    "published-structure"
  );
});

test("builds a pinned candidate with current passage links and refuses altered input or overwrite", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "egw-french-"));
  try {
    const sourceSqlite = path.join(root, "source.sqlite");
    const db = new DatabaseSync(sourceSqlite);
    db.exec(`CREATE TABLE RESOURCE_METADATA(resource_id TEXT,language TEXT,revision TEXT);
      INSERT INTO RESOURCE_METADATA VALUES('egw-writings','en','fixture-en');
      CREATE TABLE COMMENTARY_DOCUMENTS(id TEXT PRIMARY KEY,content TEXT);
      CREATE TABLE COMMENTARY_VERSE_DOCUMENTS(verse_key TEXT,ordinal INTEGER,document_id TEXT);`);
    db.prepare("INSERT INTO COMMENTARY_DOCUMENTS VALUES(?,?)").run(
      document.id,
      document.content
    );
    db.prepare("INSERT INTO COMMENTARY_DOCUMENTS VALUES(?,?)").run(
      "missing",
      published("The world needs hope.")
    );
    db.prepare("INSERT INTO COMMENTARY_DOCUMENTS VALUES(?,?)").run(
      "new-id",
      document.content
    );
    db.prepare("INSERT INTO COMMENTARY_DOCUMENTS VALUES(?,?)").run(
      "bad-reference",
      published('<a data-osis="John.3.16">John 3:16</a>')
    );
    db.exec(
      "INSERT INTO COMMENTARY_VERSE_DOCUMENTS VALUES('1-1-1',0,'84.85'),('1-1-1',1,'missing')"
    );
    db.close();
    const recoveryFile = path.join(root, "recovered-paragraphs.sqlite");
    const recovery = new DatabaseSync(recoveryFile);
    recovery.exec(`CREATE TABLE source_paragraphs(paragraph_id TEXT,source_sha256 TEXT,content_html TEXT);
      CREATE TABLE french_variants(paragraph_id TEXT,source_sha256 TEXT,french_sha256 TEXT,content_html TEXT);
      CREATE TABLE legacy_associations(paragraph_id TEXT,source_sha256 TEXT,french_sha256 TEXT);`);
    recovery
      .prepare("INSERT INTO source_paragraphs VALUES(?,?,?)")
      .run(document.id, source.source_sha256, source.content_html);
    const v = variant(frenchBody);
    recovery
      .prepare("INSERT INTO french_variants VALUES(?,?,?,?)")
      .run(document.id, source.source_sha256, v.french_sha256, v.content_html);
    recovery
      .prepare("INSERT INTO legacy_associations VALUES(?,?,?)")
      .run(document.id, source.source_sha256, v.french_sha256);
    recovery
      .prepare("INSERT INTO source_paragraphs VALUES(?,?,?)")
      .run(
        "bad-reference",
        "ref-source",
        legacy('<a href="/John_3.16">John 3:16</a>')
      );
    recovery
      .prepare("INSERT INTO french_variants VALUES(?,?,?,?)")
      .run(
        "bad-reference",
        "ref-source",
        "bad-fr",
        legacy('<a href="/John_3.16">Jean 3:17</a>')
      );
    recovery.close();
    const catalogPath = path.join(root, "catalog.json");
    await writeFile(
      catalogPath,
      JSON.stringify({
        resources: {
          "database:egw-writings:en": {
            contentSha256: hash(await readFile(sourceSqlite)),
            resourceRevision: "fixture-en"
          }
        }
      })
    );
    await writeFile(
      path.join(root, "checksums.json"),
      JSON.stringify({
        "recovered-paragraphs.sqlite": {
          sha256: hash(await readFile(recoveryFile))
        }
      })
    );
    const options = {
      sourceSqlite,
      recoveryRoot: root,
      catalogPath,
      output: path.join(root, "candidate")
    };
    const summary = await prepareEgwFrenchRecovery(options);
    assert.equal(summary.recovered, 1);
    assert.equal(summary.missing, 1);
    assert.equal(summary.review, 2);
    assert.equal(summary.reasons["exact-text-other-id"], 1);
    assert.equal(summary.reasons["bible-references-changed"], 1);
    assert.equal(summary.publicationReady, false);
    const candidate = new DatabaseSync(
      path.join(options.output, "egw-french-candidates.sqlite"),
      { readOnly: true }
    );
    assert.equal(
      candidate.prepare("SELECT count(*) AS n FROM PASSAGE_DOCUMENTS").get().n,
      2
    );
    const payload = JSON.parse(
      candidate
        .prepare("SELECT payload FROM PARAGRAPHS WHERE id=?")
        .get(document.id).payload
    );
    assert.equal(payload.translation.provenance.sourceRevision, "fixture-en");
    assert.equal(payload.translation.sha256, hash(payload.translation.html));
    candidate.close();
    await assert.rejects(
      prepareEgwFrenchRecovery(options),
      /output-already-exists/u
    );
    await writeFile(
      catalogPath,
      JSON.stringify({
        resources: { "database:egw-writings:en": { contentSha256: "wrong" } }
      })
    );
    await assert.rejects(
      prepareEgwFrenchRecovery({
        ...options,
        output: path.join(root, "invalid")
      }),
      /source-catalog-sha256-mismatch/u
    );
    await assert.rejects(access(path.join(root, "invalid")));
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
