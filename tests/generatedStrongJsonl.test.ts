import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  enrichGeneratedHtml,
  enrichGeneratedReaderHtml,
  minifyGeneratedHtml,
  minifyGeneratedReaderHtml,
  stripCompactStepIdentityAttributes,
  writeGeneratedStrongJsonl
} from "../src/generatedStrongJsonl";
import { type StepLexicalIdentityIndex } from "../src/stepLexicalIdentity";
import { type StrongLedgerAnnotation } from "../src/strongLedger";

function annotation(
  overrides: Partial<StrongLedgerAnnotation> = {}
): StrongLedgerAnnotation {
  return {
    id: "Gen.1.1:0:H1254",
    strong: "H1254",
    visibility: "reader",
    placement: "word",
    source: "reference-transfer",
    confidence: 0.99,
    reason: "exact occurrence",
    diagnostics: [],
    wordIndex: 3,
    normalizedWord: "crea",
    originalOccurrenceId: "TAHOT.Gen.1.1.2.L.main:0",
    sourceStrong: "H1254A",
    step: [
      {
        source: "TAHOT",
        classicalStrong: "H1254",
        dStrong: "H1254A",
        tokenIndex: 2,
        type: "L",
        surface: "bara",
        transliteration: "bara",
        gloss: "created",
        morphology: "HVqp3ms",
        editions: ""
      }
    ],
    ...overrides
  };
}

function identityIndex(): StepLexicalIdentityIndex {
  return new Map([
    [
      "H1254A",
      {
        dStrong: "H1254A",
        eStrong: "H1254a",
        uStrong: ["H90001"]
      }
    ]
  ]);
}

test("uses exact occurrence evidence and strips authoring attributes", () => {
  const html =
    '<divineName>Éternel</divineName> <w strong="H1254" data-word-index="3" data-target="word" data-source="reference-transfer">créa</w><note>n</note>';
  const result = enrichGeneratedReaderHtml({
    html,
    annotations: [annotation()],
    identityIndex: identityIndex()
  });
  assert.equal(
    result.text,
    '<divineName>Éternel</divineName> <w strong="H1254" estrong="H1254a" dstrong="H1254A" ustrong="H90001">créa</w><note>n</note>'
  );
  assert.equal(result.metrics.enrichedTagCount, 1);
  assert.equal(result.metrics.exactOccurrenceTagCount, 1);
  assert.equal(result.metrics.strippedAuthoringAttributeCount, 3);
  assert.equal(
    stripCompactStepIdentityAttributes(result.text),
    minifyGeneratedReaderHtml(html)
  );
});

test("never guesses a STEP identity without exact occurrence evidence", () => {
  const html =
    '<w strong="H1254" data-word-index="3" data-target="word">créa</w>';
  const result = enrichGeneratedReaderHtml({
    html,
    annotations: [annotation({ originalOccurrenceId: undefined })],
    identityIndex: identityIndex()
  });
  assert.equal(result.text, '<w strong="H1254">créa</w>');
  assert.equal(result.metrics.unresolvedTagCount, 1);
  assert.equal(result.metrics.enrichedTagCount, 0);
});

test("matches exact empty carriers without changing surrounding markup", () => {
  const html =
    '<p>texte<w strong="H1254" data-target="empty" data-insert-after-word-index="6" data-empty="true"></w></p>';
  const result = enrichGeneratedReaderHtml({
    html,
    annotations: [
      annotation({
        placement: "empty",
        wordIndex: undefined,
        insertAfterWordIndex: 6
      })
    ],
    identityIndex: identityIndex()
  });
  assert.equal(
    result.text,
    '<p>texte<w strong="H1254" estrong="H1254a" dstrong="H1254A" ustrong="H90001"></w></p>'
  );
});

test("enriches exact advanced occurrences in permissive mode", () => {
  const advanced = annotation({
    visibility: "advanced",
    placement: "word",
    wordIndex: 1,
    normalizedWord: "seigneur"
  });
  const result = enrichGeneratedHtml({
    html: '<w strong="H1254" data-word-index="1" data-target="word">Seigneur</w>',
    annotations: [advanced],
    identityIndex: identityIndex(),
    view: "permissive"
  });

  assert.equal(
    result.text,
    '<w strong="H1254" estrong="H1254a" dstrong="H1254A" ustrong="H90001">Seigneur</w>'
  );
  assert.equal(result.metrics.exactOccurrenceTagCount, 1);
  assert.equal(result.metrics.missingAnnotationTagCount, 0);
});

test("deduplicates repeated Strong values only in permissive mode", () => {
  const html =
    '<w strong="H1254 H1254" data-word-index="3" data-target="word">créa</w>';
  const annotations = [
    annotation(),
    annotation({ id: "Gen.1.1:1:H1254", visibility: "advanced" })
  ];
  const result = enrichGeneratedHtml({
    html,
    annotations,
    identityIndex: identityIndex(),
    view: "permissive"
  });

  assert.equal(
    result.text,
    '<w strong="H1254" estrong="H1254a" dstrong="H1254A" ustrong="H90001">créa</w>'
  );
  assert.equal(result.metrics.deduplicatedStrongValueCount, 1);
  assert.equal(
    minifyGeneratedHtml(html, "permissive"),
    '<w strong="H1254">créa</w>'
  );
  assert.equal(
    minifyGeneratedHtml(html, "reader"),
    '<w strong="H1254 H1254">créa</w>'
  );
});

test("streams a scoped SQLite ledger into an immutable verified JSONL artifact", async (t) => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "generated-strong-jsonl-")
  );
  t.after(async () => rm(directory, { force: true, recursive: true }));
  const sqlitePath = path.join(directory, "ledger.sqlite");
  const outputPath = path.join(directory, "bible-ost-strong.jsonl");
  const manifestPath = path.join(directory, "manifest.json");
  const database = new DatabaseSync(sqlitePath);
  database.exec(`
    create table metadata (key text primary key, value text not null);
    create table verses (
      bible text not null,
      ref text not null,
      book_id text not null,
      book_order integer not null,
      chapter integer not null,
      verse integer not null,
      text text not null,
      tokens_json text not null,
      annotations_json text not null,
      inventories_json text not null,
      metrics_json text not null,
      reader_html text not null,
      advanced_html text not null,
      debug_html text not null,
      primary key (bible, ref)
    );
  `);
  database.prepare("insert into metadata (key, value) values (?, ?)").run(
    "ledger",
    JSON.stringify({
      bible: "ost",
      inputPath: "data/bibles/bible-ost.json",
      inputFingerprint: "input-fingerprint",
      overrideFingerprint: "override-fingerprint",
      translationProfile: { bible: "ost" },
      metrics: { verseCount: 1 }
    })
  );
  database
    .prepare(
      `insert into verses (
        bible, ref, book_id, book_order, chapter, verse, text,
        tokens_json, annotations_json, inventories_json, metrics_json,
        reader_html, advanced_html, debug_html
      ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      "ost",
      "Gen.1.1",
      "Gen",
      0,
      1,
      1,
      "Au commencement",
      "[]",
      JSON.stringify([annotation()]),
      "{}",
      "{}",
      '<divineName>Éternel</divineName> <w strong="H1254" data-word-index="3" data-target="word">créa</w><note>n</note>',
      "",
      ""
    );
  database.close();

  const failedOutputPath = path.join(directory, "failed.jsonl");
  const failedManifestPath = path.join(directory, "failed-manifest.json");
  await assert.rejects(
    writeGeneratedStrongJsonl({
      bible: "ost",
      version: "OST",
      sqlitePath,
      outputPath: failedOutputPath,
      manifestPath: failedManifestPath,
      identityIndex: identityIndex(),
      identityFiles: [path.join(directory, "missing-step-source.txt")],
      only: "Gen.1"
    }),
    /ENOENT/u
  );
  assert.equal(existsSync(failedOutputPath), false);
  assert.equal(existsSync(failedManifestPath), false);

  const result = await writeGeneratedStrongJsonl({
    bible: "ost",
    version: "OST",
    sqlitePath,
    outputPath,
    manifestPath,
    identityIndex: identityIndex(),
    identityFiles: [],
    only: "Gen.1"
  });

  assert.equal(result.metrics.verseCount, 1);
  assert.equal(result.metrics.enrichedTagCount, 1);
  assert.equal(result.sizeReductionRatio, undefined);
  const lines = (await readFile(outputPath, "utf8")).trimEnd().split("\n");
  assert.equal(lines.length, 1);
  assert.deepEqual(JSON.parse(lines[0] ?? "null"), {
    ref: "Gen.1.1",
    version: "OST",
    book: 1,
    bookId: "Gen",
    chapter: 1,
    verse: 1,
    text: '<divineName>Éternel</divineName> <w strong="H1254" estrong="H1254a" dstrong="H1254A" ustrong="H90001">créa</w><note>n</note>'
  });
  const manifest = JSON.parse(await readFile(manifestPath, "utf8")) as {
    scope: string;
    status: string;
    source: { currentFingerprintGate: string; verseCount: number };
    artifact: { sizeReductionRatio?: number };
    validation: Record<string, boolean>;
  };
  assert.equal(manifest.scope, "Gen.1");
  assert.equal(manifest.status, "validated-scoped-preview");
  assert.equal(
    manifest.source.currentFingerprintGate,
    "not-run-scoped-preview"
  );
  assert.equal(manifest.source.verseCount, 1);
  assert.equal(manifest.artifact.sizeReductionRatio, undefined);
  assert.ok(Object.values(manifest.validation).every(Boolean));

  await assert.rejects(
    writeGeneratedStrongJsonl({
      bible: "ost",
      version: "OST",
      sqlitePath,
      outputPath,
      manifestPath,
      identityIndex: identityIndex(),
      identityFiles: [],
      only: "Gen.1"
    }),
    /generated-jsonl-already-exists/u
  );
});
