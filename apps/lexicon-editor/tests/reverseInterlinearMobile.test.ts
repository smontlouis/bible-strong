import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { DatabaseSync } from "node:sqlite";

import {
  augmentStrongBibleWithReverseInterlinear,
  loadReverseInterlinearStepIndex
} from "../src/reverseInterlinearMobile.js";

test("enriches only semantic carriers when an English source overtags H3117", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "reverse-enriched-"));
  try {
    const runtimePath = path.join(directory, "runtime.sqlite");
    const ledgerPath = path.join(directory, "ledger.sqlite");
    const mobilePath = path.join(directory, "mobile.sqlite");
    createStepRuntime(runtimePath);
    createStepLedger(ledgerPath);
    createMobileBible(mobilePath);

    const step = loadReverseInterlinearStepIndex({
      ledgerPath,
      runtimePath,
      runtimeSha256: "runtime-sha",
      textRevision: "step-test",
      textSha256: "text-sha"
    });
    const result = augmentStrongBibleWithReverseInterlinear({
      sqlitePath: mobilePath,
      step
    });

    const database = new DatabaseSync(mobilePath, { readOnly: true });
    try {
      const dStrongCarriers = database
        .prepare(
          `SELECT w.ordinal, l.lemma, c.kind, c.code
             FROM WordSpans w
             JOIN FrenchLexemes l ON l.id=w.lexemeId
             JOIN WordStrongCodes x
               ON x.verseId=w.verseId AND x.ordinal=w.ordinal
             JOIN StrongCodes c ON c.id=x.codeId
            WHERE c.kind=2 AND c.code='H3117G'
            ORDER BY w.ordinal`
        )
        .all()
        .map((row) => ({ ...row }));
      assert.deepEqual(dStrongCarriers, [
        { ordinal: 1, lemma: "day", kind: 2, code: "H3117G" },
        { ordinal: 4, lemma: "day", kind: 2, code: "H3117G" }
      ]);
      assert.deepEqual(
        database
          .prepare(
            `SELECT ordinal, stepTokenId
               FROM WordSpans WHERE stepTokenId IS NOT NULL
              ORDER BY ordinal`
          )
          .all()
          .map((row) => ({ ...row })),
        [
          { ordinal: 1, stepTokenId: 1 },
          { ordinal: 4, stepTokenId: 2 }
        ]
      );
      const counts = database
        .prepare(
          `SELECT c.kind, count(*) AS links
             FROM StrongCodes c
             JOIN WordStrongCodes x ON x.codeId=c.id
            GROUP BY c.kind ORDER BY c.kind`
        )
        .all()
        .map((row) => ({ ...row }));
      assert.deepEqual(counts, [
        { kind: 0, links: 5 },
        { kind: 1, links: 2 },
        { kind: 2, links: 2 },
        { kind: 3, links: 2 }
      ]);
      assert.equal(result.metrics.semanticCarrierTargetCount, 2);
      assert.equal(result.metrics.enrichedIdentityCount, 6);
      assert.equal(
        Number(
          (
            database
              .prepare(
                `SELECT value FROM ResourceMetadata WHERE key='identityCount'`
              )
              .get() as { value: string }
          ).value
        ),
        11
      );
    } finally {
      database.close();
    }

    const ambiguousPath = path.join(directory, "ambiguous.sqlite");
    createAmbiguousMobileBible(ambiguousPath);
    augmentStrongBibleWithReverseInterlinear({
      sqlitePath: ambiguousPath,
      step,
      carrierPolicy: "semantic-over-tagged"
    });
    const ambiguous = new DatabaseSync(ambiguousPath, { readOnly: true });
    try {
      assert.equal(
        (
          ambiguous
            .prepare(
              `SELECT count(*) AS count
                 FROM WordStrongCodes x
                 JOIN StrongCodes c ON c.id=x.codeId
                WHERE c.kind=2`
            )
            .get() as { count: number }
        ).count,
        0
      );
    } finally {
      ambiguous.close();
    }

    const sanitizedPath = path.join(directory, "sanitized.sqlite");
    createMobileBible(sanitizedPath);
    const sanitizedResult = augmentStrongBibleWithReverseInterlinear({
      sqlitePath: sanitizedPath,
      step,
      carrierPolicy: "semantic-over-tagged",
      sanitizeClassicalStrong: true
    });
    assert.deepEqual(
      sanitizedResult.sanitizationAudit && {
        sourceCount: sanitizedResult.sanitizationAudit.sourceCount,
        alignedKeptCount:
          sanitizedResult.sanitizationAudit.alignedKeptCount,
        lexicalKeptCount:
          sanitizedResult.sanitizationAudit.lexicalKeptCount,
        suppressedCount: sanitizedResult.sanitizationAudit.suppressedCount,
        suppressedFunctionCount:
          sanitizedResult.sanitizationAudit.suppressedFunctionCount,
        suppressedMismatchCount:
          sanitizedResult.sanitizationAudit.suppressedMismatchCount
      },
      {
        sourceCount: 5,
        alignedKeptCount: 2,
        lexicalKeptCount: 0,
        suppressedCount: 3,
        suppressedFunctionCount: 3,
        suppressedMismatchCount: 0
      }
    );
    const sanitized = new DatabaseSync(sanitizedPath, { readOnly: true });
    try {
      assert.deepEqual(
        sanitized
          .prepare(
            `SELECT w.ordinal, l.lemma
               FROM WordStrongCodes x
               JOIN StrongCodes c ON c.id=x.codeId
               JOIN WordSpans w
                 ON w.verseId=x.verseId AND w.ordinal=x.ordinal
               JOIN FrenchLexemes l ON l.id=w.lexemeId
              WHERE c.kind=0 AND c.code='H3117'
              ORDER BY w.ordinal`
          )
          .all()
          .map((row) => ({ ...row })),
        [
          { ordinal: 1, lemma: "day" },
          { ordinal: 4, lemma: "day" }
        ]
      );
    } finally {
      sanitized.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

function createStepRuntime(filePath: string): void {
  const database = new DatabaseSync(filePath);
  try {
    database.exec(`
      CREATE TABLE Verses(id INTEGER PRIMARY KEY, ref TEXT NOT NULL);
      CREATE TABLE Tokens(
        id INTEGER PRIMARY KEY,
        verseId INTEGER NOT NULL,
        readingOrdinal INTEGER NOT NULL
      );
      CREATE TABLE Lemmas(id INTEGER PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE Glosses(id INTEGER PRIMARY KEY, text TEXT NOT NULL);
      CREATE TABLE Segments(
        id INTEGER PRIMARY KEY,
        tokenId INTEGER NOT NULL,
        ordinal INTEGER NOT NULL,
        lemmaId INTEGER NOT NULL,
        glossId INTEGER NOT NULL
      );
      INSERT INTO Verses VALUES(1, 'Gen.1.1');
      INSERT INTO Tokens VALUES(1, 1, 0), (2, 1, 1);
      INSERT INTO Lemmas VALUES(1, 'יוֹם');
      INSERT INTO Glosses VALUES(1, 'day');
      INSERT INTO Segments VALUES(1, 1, 0, 1, 1), (2, 2, 0, 1, 1);
    `);
  } finally {
    database.close();
  }
}

function createStepLedger(filePath: string): void {
  const database = new DatabaseSync(filePath);
  try {
    database.exec(`
      CREATE TABLE Verses(id INTEGER PRIMARY KEY, ref TEXT NOT NULL);
      CREATE TABLE Tokens(
        id TEXT PRIMARY KEY,
        verseId INTEGER NOT NULL,
        alternateRefs TEXT NOT NULL,
        readingOrdinal INTEGER NOT NULL,
        isCanonical INTEGER NOT NULL
      );
      CREATE TABLE StrongCodes(
        id INTEGER PRIMARY KEY,
        kind INTEGER NOT NULL,
        code TEXT NOT NULL
      );
      CREATE TABLE SegmentStrongCodes(
        tokenId TEXT,
        segmentOrdinal INTEGER,
        codeId INTEGER
      );
      INSERT INTO Verses VALUES(1, 'Gen.1.1');
      INSERT INTO Tokens VALUES
        ('t1', 1, '[]', 0, 1),
        ('t2', 1, '[]', 1, 1);
      INSERT INTO StrongCodes VALUES
        (1, 0, 'H3117'),
        (2, 1, 'H3117a'),
        (3, 2, 'H3117G'),
        (4, 3, 'H3117U');
      INSERT INTO SegmentStrongCodes VALUES
        ('t1', 0, 1), ('t1', 0, 2), ('t1', 0, 3), ('t1', 0, 4),
        ('t2', 0, 1), ('t2', 0, 2), ('t2', 0, 3), ('t2', 0, 4);
    `);
  } finally {
    database.close();
  }
}

function createMobileBible(filePath: string): void {
  const database = new DatabaseSync(filePath);
  try {
    database.exec(`
      PRAGMA foreign_keys=ON;
      CREATE TABLE ResourceMetadata(
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      ) WITHOUT ROWID;
      CREATE TABLE Verses(
        id INTEGER PRIMARY KEY,
        bookOrder INTEGER NOT NULL,
        chapter INTEGER NOT NULL,
        verse INTEGER NOT NULL
      );
      CREATE TABLE FrenchLexemes(
        id INTEGER PRIMARY KEY,
        lemma TEXT NOT NULL,
        partOfSpeech TEXT NOT NULL
      );
      CREATE TABLE WordSpans(
        verseId INTEGER NOT NULL REFERENCES Verses(id),
        ordinal INTEGER NOT NULL,
        startOffset INTEGER NOT NULL,
        length INTEGER NOT NULL,
        isAligned INTEGER NOT NULL,
        openOrder INTEGER NOT NULL,
        closeOrder INTEGER NOT NULL,
        lexemeId INTEGER REFERENCES FrenchLexemes(id),
        PRIMARY KEY(verseId, ordinal)
      ) WITHOUT ROWID;
      CREATE TABLE StrongCodes(
        id INTEGER PRIMARY KEY,
        kind INTEGER NOT NULL,
        code TEXT NOT NULL,
        UNIQUE(kind, code)
      );
      CREATE TABLE WordStrongCodes(
        verseId INTEGER NOT NULL,
        ordinal INTEGER NOT NULL,
        identityOrder INTEGER NOT NULL,
        codeId INTEGER NOT NULL REFERENCES StrongCodes(id),
        PRIMARY KEY(verseId, ordinal, identityOrder),
        FOREIGN KEY(verseId, ordinal) REFERENCES WordSpans(verseId, ordinal)
      ) WITHOUT ROWID;
      INSERT INTO ResourceMetadata VALUES
        ('strongRevision', 'base-revision'),
        ('identityCount', '5');
      INSERT INTO Verses VALUES(1, 1, 1, 1);
      INSERT INTO FrenchLexemes VALUES
        (1, 'the', 'determiner'),
        (2, 'day', 'noun'),
        (3, 'he', 'pronoun');
      INSERT INTO StrongCodes VALUES(1, 0, 'H3117');
      INSERT INTO WordSpans VALUES
        (1, 0, 0, 3, 1, 0, 1, 1),
        (1, 1, 4, 3, 1, 2, 3, 2),
        (1, 2, 8, 3, 1, 4, 5, 1),
        (1, 3, 12, 2, 1, 6, 7, 3),
        (1, 4, 15, 3, 1, 8, 9, 2);
      INSERT INTO WordStrongCodes VALUES
        (1, 0, 0, 1),
        (1, 1, 0, 1),
        (1, 2, 0, 1),
        (1, 3, 0, 1),
        (1, 4, 0, 1);
    `);
  } finally {
    database.close();
  }
}

function createAmbiguousMobileBible(filePath: string): void {
  createMobileBible(filePath);
  const database = new DatabaseSync(filePath);
  try {
    database.exec(`
      DELETE FROM WordStrongCodes WHERE ordinal >= 2;
      DELETE FROM WordSpans WHERE ordinal >= 2;
      UPDATE ResourceMetadata SET value='2' WHERE key='identityCount';
    `);
  } finally {
    database.close();
  }
}
