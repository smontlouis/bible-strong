import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  buildFrenchLemmaPilot,
  queryFrenchLemmaStats
} from "../src/frenchLemmaPilot.js";
import { compileStrongBibleJsonlToSqlite } from "../src/strongBibleSqlite.js";

test("enriches any generated Bible with conservative French lemma decisions", async (t) => {
  const directory = await mkdtemp(path.join(tmpdir(), "french-lemma-pilot-"));
  t.after(async () => rm(directory, { recursive: true, force: true }));
  const inputPath = path.join(directory, "lsg.jsonl");
  const sourceDatabase = path.join(directory, "lsg.sqlite");
  const kaikkiJsonl = path.join(directory, "kaikki.jsonl");
  const outputDatabase = path.join(directory, "lsg-lemmas.sqlite");
  const reportPath = path.join(directory, "report.json");
  const words = [
    "Parabole",
    "parabole",
    "paraboles",
    "Inconnu",
    "",
    "habitées"
  ];

  await writeFile(
    inputPath,
    `${words
      .map((word, index) =>
        JSON.stringify({
          ref: `Gen.1.${index + 1}`,
          version: "FMAR",
          book: 1,
          bookId: "Gen",
          chapter: 1,
          verse: index + 1,
          text: `<w strong="${word === "habitées" ? "H0002" : "H0001"}">${word}</w>`
        })
      )
      .join("\n")}\n`,
    "utf8"
  );
  await writeFile(
    kaikkiJsonl,
    [
      {
        word: "parabole",
        lang_code: "fr",
        pos: "noun",
        senses: [{ glosses: ["a story"] }]
      },
      {
        word: "paraboles",
        lang_code: "fr",
        pos: "noun",
        senses: [{ form_of: [{ word: "parabole" }] }]
      },
      {
        word: "paraboles",
        lang_code: "fr",
        pos: "verb",
        senses: [{ form_of: [{ word: "paraboler" }] }]
      },
      {
        word: "habitées",
        lang_code: "fr",
        pos: "verb",
        senses: [{ form_of: [{ word: "habité" }] }]
      },
      {
        word: "habité",
        lang_code: "fr",
        pos: "verb",
        senses: [{ form_of: [{ word: "habiter" }] }]
      },
      {
        word: "habiter",
        lang_code: "fr",
        pos: "verb",
        senses: [{ glosses: ["to inhabit"] }]
      }
    ]
      .map((entry) => JSON.stringify(entry))
      .join("\n"),
    "utf8"
  );
  await compileStrongBibleJsonlToSqlite({
    inputPath,
    outputPath: sourceDatabase,
    datasetId: "FMAR",
    expectedVersion: "FMAR"
  });

  const report = await buildFrenchLemmaPilot({
    sourceDatabase,
    kaikkiJsonl,
    outputDatabase,
    reportPath
  });

  assert.equal(report.spanCount, 6);
  assert.equal(report.resolvedUniqueCount, 3);
  assert.equal(report.resolvedStrongContextCount, 1);
  assert.equal(report.unavailableCount, 1);
  assert.equal(report.emptySpanCount, 1);
  assert.equal(report.integrityCheck, "ok");

  const database = new DatabaseSync(outputDatabase, { readOnly: true });
  const metadata = Object.fromEntries(
    (
      database
        .prepare("SELECT key, value FROM ResourceMetadata")
        .all() as Array<{
        key: string;
        value: string;
      }>
    ).map(({ key, value }) => [key, value])
  );
  const rows = database
    .prepare(
      `
      SELECT substr(v.canonicalText, o.startOffset + 1, o.length) AS surface,
             o.lemmaMethod, l.lemma, l.partOfSpeech
      FROM WordSpans o
      JOIN Verses v ON v.id=o.verseId
      LEFT JOIN FrenchLexemes l ON l.id=o.lexemeId
      ORDER BY o.verseId
    `
    )
    .all()
    .map((row) => ({ ...row }));
  database.close();
  assert.equal(metadata.lexemeAssignmentCount, "4");
  assert.equal(metadata.lexemeCount, "2");
  assert.equal(metadata.lemmaDatasetVersion, report.version);
  assert.deepEqual(rows, [
    {
      surface: "Parabole",
      lemmaMethod: 1,
      lemma: "parabole",
      partOfSpeech: "noun"
    },
    {
      surface: "parabole",
      lemmaMethod: 1,
      lemma: "parabole",
      partOfSpeech: "noun"
    },
    {
      surface: "paraboles",
      lemmaMethod: 2,
      lemma: "parabole",
      partOfSpeech: "noun"
    },
    {
      surface: "Inconnu",
      lemmaMethod: 4,
      lemma: null,
      partOfSpeech: null
    },
    {
      surface: "",
      lemmaMethod: 0,
      lemma: null,
      partOfSpeech: null
    },
    {
      surface: "habitées",
      lemmaMethod: 1,
      lemma: "habiter",
      partOfSpeech: "verb"
    }
  ]);

  assert.deepEqual(
    queryFrenchLemmaStats({
      sqlitePath: outputDatabase,
      kind: "strong",
      code: "H0001"
    }),
    {
      matchedCode: "H0001",
      matchedKind: "strong",
      total: 5,
      resolved: 3,
      unresolvedAmbiguous: 0,
      unavailable: 1,
      lemmas: [{ lemma: "parabole", partOfSpeech: "noun", occurrences: 3 }]
    }
  );
});
