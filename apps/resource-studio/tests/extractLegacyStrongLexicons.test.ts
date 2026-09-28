import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { test } from "node:test";

import {
  extractLegacyStrongLexicons,
  getLegacyStrongFamily
} from "../src/extractLegacyStrongLexicons.js";

test("uses STEP's explicit family instead of stripping suffixes or following uStrong", () => {
  assert.equal(
    getLegacyStrongFamily({
      id: 1,
      language: "greek",
      baseCode: 2495,
      eStrong: "G2495",
      dStrong: "G2491K =",
      uStrong: "G2491K"
    }),
    "G2495"
  );
  assert.equal(
    getLegacyStrongFamily({
      id: 2,
      language: "hebrew",
      baseCode: 1,
      eStrong: "H0001",
      dStrong: "H0001H = a Part of",
      uStrong: "H2438H,"
    }),
    "H0001"
  );
  assert.throws(
    () =>
      getLegacyStrongFamily({
        id: 3,
        language: "hebrew",
        baseCode: 1,
        eStrong: "G0001",
        dStrong: "H0001H =",
        uStrong: "H0001H"
      }),
    /Inconsistent/
  );
});

test("extracts lexical content verbatim, removes Bible/technical content, audits missing matches and preserves suffix case", () => {
  const root = mkdtempSync(path.join(tmpdir(), "legacy-strong-"));
  try {
    const sourcePath = path.join(root, "source.sqlite");
    const source = new DatabaseSync(sourcePath);
    for (const table of ["Grec", "Hebreu"]) {
      source.exec(`CREATE TABLE ${table} (Code INTEGER PRIMARY KEY, Mot TEXT, Phonetique TEXT,
        ${table} TEXT, Origine TEXT, Type TEXT, LSG TEXT, Definition TEXT)`);
      const insert = source.prepare(
        `INSERT INTO ${table} VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      );
      insert.run(
        1,
        "word",
        "phonetic",
        "original",
        "<b>origin</b>",
        "noun",
        "summary",
        "<ol><li>définition</li></ol>"
      );
      insert.run(2, "empty", "", "", "", "", "", "");
      insert.run(0, "marker", "", "", "", "", "", "not a word");
      insert.run(8800, "grammar", "", "", "", "", "", "not lexical");
    }
    source.exec(
      "CREATE TABLE LSGSAT2 (Texte TEXT); INSERT INTO LSGSAT2 VALUES ('Bible content'); CREATE TABLE LSGSNT2 (Texte TEXT)"
    );
    source.close();
    const sourceBefore = readFileSync(sourcePath);
    const stepPath = path.join(root, "step.sqlite");
    const step = new DatabaseSync(stepPath);
    step.exec(`CREATE TABLE StepEntries (id INTEGER, language TEXT, baseCode INTEGER, eStrong TEXT, dStrong TEXT, uStrong TEXT);
      INSERT INTO StepEntries VALUES
        (1, 'greek', 1, 'G0001', 'G0001 =', 'G0001'),
        (2, 'hebrew', 1, 'H0001', 'H0001V =', 'H0001V'),
        (3, 'hebrew', 1, 'H0001', 'H0001v =', 'H0001v'),
        (4, 'greek', 8800, 'G8800', 'G8800 =', 'G8800'),
        (5, 'greek', 2, 'G0002', 'G0002 =', 'G0002'),
        (6, 'hebrew', 3, 'H0003', 'H0003 =', 'H0003');`);
    step.close();
    const output = path.join(root, "extracted");
    const options = {
      french: sourcePath,
      english: sourcePath,
      step: stepPath,
      output
    };
    const report = extractLegacyStrongLexicons(options);
    assert.deepEqual(readFileSync(sourcePath), sourceBefore);
    assert.throws(() => extractLegacyStrongLexicons(options), /already exists/);
    for (const summary of report.summaries) {
      assert.deepEqual(summary.counts, { greek: 2, hebrew: 2 });
      assert.equal(summary.excludedTechnicalEntries, 4);
      assert.equal(summary.linkedStepEntries, 3);
      assert.equal(summary.outsideClassicalRange, 1);
      assert.equal(summary.missingLegacyDefinition, 2);
      const db = new DatabaseSync(path.join(output, summary.artifact), {
        readOnly: true
      });
      try {
        assert.deepEqual(
          db
            .prepare(
              "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
            )
            .all()
            .map((row) => row.name),
          ["ExtractionMetadata", "SimpleStrongEntries", "StepStrongLinks"]
        );
        assert.equal(
          db
            .prepare(
              "SELECT definitionHtml FROM SimpleStrongEntries WHERE classicStrong='G0001'"
            )
            .get()?.definitionHtml,
          "<ol><li>définition</li></ol>"
        );
        assert.deepEqual(
          db
            .prepare(
              "SELECT stepCode FROM StepStrongLinks WHERE classicStrong='H0001' ORDER BY stepEntryId"
            )
            .all()
            .map((row) => row.stepCode),
          ["H0001V", "H0001v"]
        );
        assert.equal(
          db
            .prepare(
              "SELECT count(*) AS n FROM SimpleStrongEntries WHERE code=8800"
            )
            .get()?.n,
          0
        );
        assert.equal(
          db.prepare("PRAGMA integrity_check").get()?.integrity_check,
          "ok"
        );
      } finally {
        db.close();
      }
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
