import assert from "node:assert/strict";
import { mkdtemp, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  buildKaikkiSqliteIndex,
  readKaikkiSqliteIndex
} from "../src/kaikkiSqliteIndex.js";

test("builds a many-to-many form index and filters generic or diffuse glosses", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kaikki-index-test-"));
  const jsonlPath = path.join(dir, "kaikki.jsonl");
  const sqlitePath = path.join(dir, "kaikki.sqlite");
  const entries = [
    kaikkiEntry("être", ["suis"], ["to exist"]),
    kaikkiEntry("suivre", ["suis"], ["to follow"]),
    kaikkiEntry("rarelemme", [], ["rarebeacon"]),
    kaikkiEntry("sera", [], ["all from thing"], ["être"]),
    ...Array.from({ length: 65 }, (_, index) =>
      kaikkiEntry(`commun${index}`, [], ["commonmarker"])
    )
  ];
  await writeFile(jsonlPath, `${entries.join("\n")}\n`, "utf8");

  await buildKaikkiSqliteIndex({ jsonlPath, sqlitePath });
  const index = readKaikkiSqliteIndex({
    sqlitePath,
    targetWords: new Set(["suis", "sera", "commun0"]),
    englishHints: new Set([
      "exist",
      "follow",
      "rarebeacon",
      "commonmarker",
      "all",
      "from",
      "thing"
    ])
  });

  assert.deepEqual([...(index.formToLemma.get("suis") ?? [])].sort(), [
    "etre",
    "suivre"
  ]);
  assert.deepEqual([...(index.formToLemma.get("sera") ?? [])], ["etre"]);
  assert.deepEqual(
    [...(index.englishGlossToFrench.get("rarebeacon") ?? [])],
    ["rarelemme"]
  );
  assert.equal(index.englishGlossToFrench.has("commonmarker"), false);
  assert.equal(index.englishTokenWeights.has("commonmarker"), false);
  assert.equal(index.englishGlossToFrench.has("all"), false);
  assert.equal(index.englishGlossToFrench.has("from"), false);
  assert.ok((index.englishTokenWeights.get("rarebeacon") ?? 0) > 0.8);

  const db = new DatabaseSync(sqlitePath);
  try {
    const schemaVersion = db
      .prepare("select value from metadata where key = 'schemaVersion'")
      .get() as unknown as { value: string };
    const ambiguousRows = db
      .prepare("select count(*) as count from forms where form = 'suis'")
      .get() as unknown as { count: number };
    assert.equal(schemaVersion.value, "2");
    assert.equal(Number(ambiguousRows.count), 2);
  } finally {
    db.close();
  }
});

test("reads a legacy single-lemma index without requiring an eager migration", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kaikki-legacy-test-"));
  const sqlitePath = path.join(dir, "kaikki.sqlite");
  const db = new DatabaseSync(sqlitePath);
  try {
    db.exec(`
      create table metadata (key text primary key, value text not null);
      create table forms (form text primary key, lemma text not null);
      create table lemma_gloss_tokens (
        lemma text not null,
        token text not null,
        primary key (lemma, token)
      );
      create table english_gloss_to_french (
        token text not null,
        french text not null,
        primary key (token, french)
      );
      insert into metadata values ('entries', '10');
      insert into forms values ('suis', 'etre');
      insert into lemma_gloss_tokens values ('etre', 'exist');
      insert into english_gloss_to_french values ('exist', 'etre');
    `);
  } finally {
    db.close();
  }

  const index = readKaikkiSqliteIndex({
    sqlitePath,
    targetWords: new Set(["suis"]),
    englishHints: new Set(["exist"])
  });

  assert.deepEqual([...(index.formToLemma.get("suis") ?? [])], ["etre"]);
  assert.deepEqual(
    [...(index.englishGlossToFrench.get("exist") ?? [])],
    ["etre"]
  );
});

test("keeps the previous SQLite index intact when an atomic rebuild fails", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "kaikki-atomic-test-"));
  const sqlitePath = path.join(dir, "kaikki.sqlite");
  const db = new DatabaseSync(sqlitePath);
  try {
    db.exec(
      "create table sentinel (value text not null); insert into sentinel values ('old-index');"
    );
  } finally {
    db.close();
  }

  await assert.rejects(
    buildKaikkiSqliteIndex({
      jsonlPath: path.join(dir, "missing.jsonl"),
      sqlitePath
    })
  );

  const preserved = new DatabaseSync(sqlitePath);
  try {
    const row = preserved
      .prepare("select value from sentinel")
      .get() as unknown as {
      value: string;
    };
    assert.equal(row.value, "old-index");
  } finally {
    preserved.close();
  }
  assert.equal(
    (await readdir(dir)).some((name) => name.includes(".tmp-")),
    false
  );
});

function kaikkiEntry(
  word: string,
  forms: string[],
  glosses: string[],
  formOf: string[] = []
): string {
  return JSON.stringify({
    word,
    lang_code: "fr",
    forms: forms.map((form) => ({ form })),
    senses: [
      {
        glosses,
        form_of: formOf.map((lemma) => ({ word: lemma }))
      }
    ]
  });
}
