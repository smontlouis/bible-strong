import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  classifyTflsjAvailability,
  containsLsjAbsenceMarker
} from "../src/stepLexiconResourceAvailability.js";

const TFLSJ_PATH = path.resolve("data/external/stepbible/TFLSJ.txt");

test("classifies English and French LSJ absence variants", () => {
  for (const marker of [
    "From Abbott-Smith. LSJ has no entry",
    "LSJ contains no entry",
    "LSJ does not contain an entry",
    "D’après Abbott-Smith. Le LSJ ne contient aucune entrée",
    "D’après Abbott-Smith. Le LSJ ne comporte aucune entrée",
    "Le LSJ n’a pas d’entrée"
  ]) {
    assert.equal(containsLsjAbsenceMarker(marker), true, marker);
    assert.equal(
      classifyTflsjAvailability(marker),
      "abbott_smith_fallback",
      marker
    );
  }

  assert.equal(
    classifyTflsjAvailability(
      "<b>ἄλφα</b>, τό, <i>indeclinable</i>; classical references."
    ),
    "lsj_article"
  );
});

test("the pinned TFLSJ snapshot identifies G2321 structurally and keeps real LSJ rows", () => {
  const lines = readFileSync(TFLSJ_PATH, "utf8")
    .replace(/^\uFEFF/u, "")
    .split(/\r?\n/u)
    .filter((line) => /^G\d{4,5}[A-Za-z]?\t/u.test(line));
  const rows = lines.map((line) => {
    const fields = line.split("\t");
    return {
      eStrong: fields[0],
      contentHtml: fields.slice(7).join("\t")
    };
  });
  const placeholders = rows.filter(
    (row) =>
      classifyTflsjAvailability(row.contentHtml) === "abbott_smith_fallback"
  );

  assert.equal(rows.length, 5709);
  assert.equal(placeholders.length, 539);
  assert.ok(placeholders.some((row) => row.eStrong === "G2321"));
  assert.ok(
    rows.some(
      (row) =>
        row.eStrong === "G0001" &&
        classifyTflsjAvailability(row.contentHtml) === "lsj_article"
    )
  );
});

test("STEP dictionary generation keeps G2321 core data and emits no TFLSJ placeholder", async () => {
  const directory = await mkdtemp(
    path.join(tmpdir(), "step-lexicon-availability-")
  );
  const outputPath = path.join(directory, "strong_lexicon.sqlite");
  try {
    execFileSync(
      "npx",
      ["tsx", "scripts/importStepBibleDictionaries.ts", "--output", outputPath],
      {
        cwd: path.resolve("."),
        encoding: "utf8",
        stdio: "pipe"
      }
    );

    const database = new DatabaseSync(outputPath, { readOnly: true });
    try {
      const g2321 = database
        .prepare(
          `SELECT id,original,meaning
             FROM StepEntries
            WHERE language='greek' AND baseCode=2321`
        )
        .get() as { id: number; original: string; meaning: string };
      assert.equal(g2321.id, 2380);
      assert.match(g2321.original, /Θε/u);
      assert.match(g2321.meaning, /Theophilus/u);
      assert.equal(
        Number(
          (
            database
              .prepare(
                `SELECT count(*) AS count
                   FROM LexiconResources
                  WHERE stepEntryId=? AND source='TFLSJ'`
              )
              .get(g2321.id) as { count: number }
          ).count
        ),
        0
      );

      const resources = database
        .prepare(
          `SELECT id,stepEntryId,contentHtml
             FROM LexiconResources
            WHERE source='TFLSJ'
            ORDER BY id`
        )
        .all() as Array<{
        id: number;
        stepEntryId: number;
        contentHtml: string;
      }>;
      assert.equal(resources.length, 5170);
      assert.equal(
        resources.filter((row) => containsLsjAbsenceMarker(row.contentHtml))
          .length,
        0
      );
      assert.equal(
        resources.every((row) => row.id === row.stepEntryId),
        true
      );
      assert.ok(
        resources.some(
          (row) =>
            row.id === 1 &&
            row.stepEntryId === 1 &&
            row.contentHtml.includes("ἄλφα")
        )
      );
    } finally {
      database.close();
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
