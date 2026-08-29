import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyEnglishCanonicalResourceRepairs,
  ENGLISH_CANONICAL_RESOURCE_REPAIR_RULES
} from "../src/lexiconV3/englishCanonicalResourceRepairs.js";

const DATABASE = "data/dictionaries/strong_lexicon.full.production.sqlite";
const DATABASE_DIGEST =
  "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8";
const TFLSJ_DIGEST =
  "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691";

test("corrects all six pinned Illiad typos in the selected G2046 TFLSJ notice", () => {
  assert.equal(ENGLISH_CANONICAL_RESOURCE_REPAIR_RULES.size, 1);
  const database = new DatabaseSync(DATABASE, { readOnly: true });
  try {
    const row = database
      .prepare(
        `select lr.source, lr.kind, lr.contentHtml
         from LexiconResources lr
         join StepEntries se on se.id = lr.stepEntryId
         where se.language = 'greek' and se.eStrong = 'G2046'
           and lr.source = 'TFLSJ'`
      )
      .get() as {
      source: string;
      kind: string;
      contentHtml: string;
    };
    assert.equal(count(row.contentHtml, "Illiad"), 6);
    const repaired = applyEnglishCanonicalResourceRepairs({
      entryKey: "greek:G2046",
      databaseDigest: DATABASE_DIGEST,
      sourceSnapshotDigest: TFLSJ_DIGEST,
      ...row
    });
    assert.ok(repaired);
    assert.equal(repaired.replacementCount, 6);
    assert.equal(count(repaired.contentHtml, "Illiad"), 0);
    assert.equal(count(repaired.contentHtml, "Iliad"), 6);
    assert.equal(
      repaired.repairedContentDigest,
      "9d4a6dd162e44bf5645bd129d5b0459478296b6f5107ae28216e9bbc92591694"
    );

    assert.throws(
      () =>
        applyEnglishCanonicalResourceRepairs({
          entryKey: "greek:G2046",
          databaseDigest: DATABASE_DIGEST,
          sourceSnapshotDigest: TFLSJ_DIGEST,
          ...row,
          contentHtml: `${row.contentHtml} `
        }),
      /english-canonical-resource-repair-content-drift:greek:G2046/u
    );
  } finally {
    database.close();
  }
});

test("leaves an unregistered canonical resource outside the repair layer", () => {
  assert.equal(
    applyEnglishCanonicalResourceRepairs({
      entryKey: "greek:G0001",
      databaseDigest: "drift-does-not-matter-for-unregistered-rows",
      sourceSnapshotDigest: "",
      source: "TFLSJ",
      kind: "classical_full",
      contentHtml: "Illiad"
    }),
    null
  );
});

function count(value: string, token: string): number {
  return value.split(token).length - 1;
}
