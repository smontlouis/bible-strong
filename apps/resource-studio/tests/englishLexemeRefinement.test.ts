import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  ENGLISH_LEXEME_REFINEMENT_POLICY,
  refineEnglishBibleLexemes
} from "../src/englishLexemeRefinement.js";

test("refines English POS from entities, divine identities and exact consensus", async () => {
  const root = await mkdtemp(path.join(tmpdir(), "english-lexeme-refinement-"));
  const entityPath = path.join(root, "entities.sqlite");
  const runtimePath = path.join(root, "runtime.sqlite");
  const firstPath = path.join(root, "first.sqlite");
  const secondPath = path.join(root, "second.sqlite");
  createEntityDatabase(entityPath);
  createRuntimeDatabase(runtimePath);
  const firstVerseTexts = createBibleDatabase(firstPath, [
    {
      surface: "David",
      lemma: "david",
      pos: "verb",
      codes: [[0, "H1732"]],
      token: 1
    },
    {
      surface: "God",
      lemma: "god",
      pos: "verb",
      codes: [
        [0, "H430"],
        [2, "H430G"]
      ],
      token: 2
    },
    {
      surface: "gods",
      lemma: "god",
      pos: "verb",
      codes: [
        [0, "H430"],
        [2, "H430G"]
      ],
      token: 2
    },
    {
      surface: "Jehovah",
      lemma: "jehovah",
      pos: "verb",
      codes: [[0, "H3071"]],
      token: 3
    },
    {
      surface: "Jehovah",
      lemma: "jehovah",
      pos: "verb",
      codes: [],
      token: null
    },
    ...Array.from({ length: 4 }, () => ({
      surface: "work",
      lemma: "work",
      pos: "verb",
      codes: [[0, "H5647"]] as Array<[number, string]>,
      token: 4
    })),
    {
      surface: "love",
      lemma: "love",
      pos: "noun",
      codes: [[0, "H157"]] as Array<[number, string]>,
      token: null
    }
  ]);
  const secondVerseTexts = createBibleDatabase(secondPath, [
    ...Array.from({ length: 5 }, () => ({
      surface: "work",
      lemma: "work",
      pos: "verb",
      codes: [[0, "H5647"]] as Array<[number, string]>,
      token: 4
    })),
    {
      surface: "work",
      lemma: "work",
      pos: "noun",
      codes: [[0, "H5647"]] as Array<[number, string]>,
      token: 4
    }
  ]);

  const result = refineEnglishBibleLexemes({
    bibles: [
      {
        applicationVersionId: "FIRST",
        sqlitePath: firstPath,
        verseTexts: firstVerseTexts
      },
      {
        applicationVersionId: "SECOND",
        sqlitePath: secondPath,
        verseTexts: secondVerseTexts
      }
    ],
    entityDatabasePath: entityPath,
    stepRuntimePath: runtimePath
  });

  assert.equal(result.policy, ENGLISH_LEXEME_REFINEMENT_POLICY);
  assert.ok(result.decisionCount > 0);
  assert.equal(readPos(firstPath, "david"), "name");
  assert.equal(readPosAtVerse(firstPath, 2), "name");
  assert.equal(readPosAtVerse(firstPath, 3), "noun");
  assert.equal(readPos(firstPath, "jehovah"), "name");
  assert.equal(readPos(firstPath, "love"), "noun");
  assert.equal(readPosAtVerse(secondPath, 1), "verb");
  assert.equal(readPosAtVerse(secondPath, 6), "noun");
  assert.equal(result.bibles[0]!.correctionsByMethod["curated-override"], 1);
  assert.deepEqual(
    result.bibles.map(({ remainingCanaries }) => remainingCanaries),
    [
      {
        h0430gVerb: 0,
        h0430gCommonNotNoun: 0,
        h0430gDivineNotName: 0,
        jehovahNotName: 0,
        capitalizedEntityVerb: 0,
        knownLowercaseName: 0,
        indeterminate: 0
      },
      {
        h0430gVerb: 0,
        h0430gCommonNotNoun: 0,
        h0430gDivineNotName: 0,
        jehovahNotName: 0,
        capitalizedEntityVerb: 0,
        knownLowercaseName: 0,
        indeterminate: 0
      }
    ]
  );
  assert.equal(
    readMetadata(firstPath, "englishLexemeRefinementPolicy"),
    ENGLISH_LEXEME_REFINEMENT_POLICY
  );
  assert.match(
    readMetadata(firstPath, "englishLexemeRefinementDecisionDigest"),
    /^[a-f0-9]{64}$/u
  );
  assert.throws(
    () =>
      refineEnglishBibleLexemes({
        bibles: [
          {
            applicationVersionId: "FIRST",
            sqlitePath: firstPath,
            verseTexts: firstVerseTexts
          }
        ],
        entityDatabasePath: entityPath,
        stepRuntimePath: runtimePath
      }),
    /english-lexeme-refinement-already-applied/u
  );
});

function createBibleDatabase(
  outputPath: string,
  rows: Array<{
    surface: string;
    lemma: string;
    pos: string;
    codes: Array<[number, string]>;
    token: number | null;
  }>
): ReadonlyMap<string, string> {
  const database = new DatabaseSync(outputPath);
  database.exec(`
    PRAGMA foreign_keys=ON;
    CREATE TABLE ResourceMetadata (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    ) WITHOUT ROWID;
    CREATE TABLE Verses (
      id INTEGER PRIMARY KEY,
      bookOrder INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      UNIQUE(bookOrder, chapter, verse)
    );
    CREATE TABLE FrenchLexemes (
      id INTEGER PRIMARY KEY,
      lemma TEXT NOT NULL,
      partOfSpeech TEXT NOT NULL,
      UNIQUE(lemma, partOfSpeech)
    );
    CREATE TABLE WordSpans (
      verseId INTEGER NOT NULL REFERENCES Verses(id),
      ordinal INTEGER NOT NULL,
      startOffset INTEGER NOT NULL,
      length INTEGER NOT NULL,
      stepTokenId INTEGER,
      lexemeId INTEGER NOT NULL REFERENCES FrenchLexemes(id),
      PRIMARY KEY(verseId, ordinal)
    ) WITHOUT ROWID;
    CREATE TABLE StrongCodes (
      id INTEGER PRIMARY KEY,
      kind INTEGER NOT NULL,
      code TEXT NOT NULL,
      UNIQUE(kind, code)
    );
    CREATE TABLE WordStrongCodes (
      verseId INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      identityOrder INTEGER NOT NULL,
      codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
      PRIMARY KEY(verseId, ordinal, identityOrder),
      FOREIGN KEY(verseId, ordinal) REFERENCES WordSpans(verseId, ordinal)
    ) WITHOUT ROWID;
    INSERT INTO ResourceMetadata(key,value)
    VALUES ('strongRevision','${"a".repeat(64)}');
  `);
  const insertVerse = database.prepare(
    `INSERT INTO Verses(id,bookOrder,chapter,verse) VALUES (?,?,1,?)`
  );
  const insertLexeme = database.prepare(
    `INSERT OR IGNORE INTO FrenchLexemes(lemma,partOfSpeech) VALUES (?,?)`
  );
  const selectLexeme = database.prepare(
    `SELECT id FROM FrenchLexemes WHERE lemma=? AND partOfSpeech=?`
  );
  const insertSpan = database.prepare(
    `INSERT INTO WordSpans(
       verseId,ordinal,startOffset,length,stepTokenId,lexemeId
     ) VALUES (?,0,0,?,?,?)`
  );
  const insertCode = database.prepare(
    `INSERT OR IGNORE INTO StrongCodes(kind,code) VALUES (?,?)`
  );
  const selectCode = database.prepare(
    `SELECT id FROM StrongCodes WHERE kind=? AND code=?`
  );
  const insertLink = database.prepare(
    `INSERT INTO WordStrongCodes(verseId,ordinal,identityOrder,codeId)
     VALUES (?,0,?,?)`
  );
  const verseTexts = new Map<string, string>();
  for (const [index, row] of rows.entries()) {
    const id = index + 1;
    insertVerse.run(id, 1, id);
    insertLexeme.run(row.lemma, row.pos);
    const lexeme = selectLexeme.get(row.lemma, row.pos) as { id: number };
    insertSpan.run(id, row.surface.length, row.token, lexeme.id);
    verseTexts.set(`1:1:${id}`, row.surface);
    for (const [identityOrder, [kind, code]] of row.codes.entries()) {
      insertCode.run(kind, code);
      const strong = selectCode.get(kind, code) as { id: number };
      insertLink.run(id, identityOrder, strong.id);
    }
  }
  database.close();
  return verseTexts;
}

function createEntityDatabase(outputPath: string): void {
  const database = new DatabaseSync(outputPath);
  database.exec(`
    CREATE TABLE Entities (
      id INTEGER PRIMARY KEY,
      uniqueName TEXT NOT NULL,
      uStrong TEXT NOT NULL,
      displayName TEXT NOT NULL
    );
    CREATE TABLE EntityNames (
      entityId INTEGER NOT NULL,
      dStrong TEXT NOT NULL,
      displayName TEXT NOT NULL
    );
    INSERT INTO Entities(id,uniqueName,uStrong,displayName)
    VALUES (1,'David@Rut.4.17-Rev','H1732','David');
    INSERT INTO EntityNames(entityId,dStrong,displayName)
    VALUES (1,'H1732','David');
  `);
  database.close();
}

function createRuntimeDatabase(outputPath: string): void {
  const database = new DatabaseSync(outputPath);
  database.exec(`
    CREATE TABLE Morphologies (
      id INTEGER PRIMARY KEY,
      code TEXT NOT NULL
    );
    CREATE TABLE Segments (
      tokenId INTEGER NOT NULL,
      ordinal INTEGER NOT NULL,
      morphologyId INTEGER NOT NULL
    );
    INSERT INTO Morphologies(id,code) VALUES
      (1,'HNpmsa'),
      (2,'HNcmpa'),
      (3,'HNpt'),
      (4,'HVqp3ms');
    INSERT INTO Segments(tokenId,ordinal,morphologyId) VALUES
      (1,0,1),
      (2,0,2),
      (3,0,3),
      (4,0,4);
  `);
  database.close();
}

function readPos(databasePath: string, lemma: string): string {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const values = [
    ...database
      .prepare(
        `SELECT DISTINCT l.partOfSpeech
           FROM WordSpans w
           JOIN FrenchLexemes l ON l.id=w.lexemeId
          WHERE l.lemma=?
          ORDER BY l.partOfSpeech`
      )
      .iterate(lemma)
  ] as Array<{ partOfSpeech: string }>;
  database.close();
  assert.equal(values.length, 1);
  return values[0]!.partOfSpeech;
}

function readPosAtVerse(databasePath: string, verse: number): string {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const row = database
    .prepare(
      `SELECT l.partOfSpeech
         FROM WordSpans w
         JOIN Verses v ON v.id=w.verseId
         JOIN FrenchLexemes l ON l.id=w.lexemeId
        WHERE v.bookOrder=1 AND v.chapter=1 AND v.verse=?`
    )
    .get(verse) as { partOfSpeech: string };
  database.close();
  return row.partOfSpeech;
}

function readMetadata(databasePath: string, key: string): string {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  const row = database
    .prepare(`SELECT value FROM ResourceMetadata WHERE key=?`)
    .get(key) as { value: string };
  database.close();
  return row.value;
}
