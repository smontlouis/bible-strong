import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  CURATED_AUTO_TFLSJ_REPAIRS,
  type EnglishLexiconEntry
} from "../src/lexiconV3/evidence.js";
import { ENGLISH_EXACT_REPAIR_RULES } from "../src/lexiconV3/englishExactRepairs.js";

const DATABASE = "data/dictionaries/strong_lexicon.full.production.sqlite";

test("preserves G2570H as the exact Fair Havens sub-STEP identity", () => {
  const database = new DatabaseSync(DATABASE, { readOnly: true });
  try {
    const entry = getEntry(database, "G2570H =");
    assert.deepEqual(
      pick(entry, [
        "eStrong",
        "dStrong",
        "uStrong",
        "original",
        "morph",
        "gloss"
      ]),
      {
        eStrong: "G2570",
        dStrong: "G2570H =",
        uStrong: "G2570H",
        original: "καλός",
        morph: "N:A--L",
        gloss: "Fair (Havens)"
      }
    );
    assert.match(entry.meaning, /<b>fair, beautiful<\/b>/u);
    assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("greek:G2570H"), false);

    const tagnt = readFileSync(
      "data/external/stepbible/amalgamated/TAGNT Act-Rev.txt",
      "utf8"
    );
    const exactOccurrence = tagnt
      .split("\n")
      .find((line) => line.startsWith("Act.27.8#10="));
    assert.ok(exactOccurrence);
    assert.match(
      exactOccurrence,
      /^Act\.27\.8#10=NKO\tΚαλοὺς \(Kalous\)\tFair\tG2570H=A-APM-L\tκαλός=good/u
    );
  } finally {
    database.close();
  }
});

test("preserves the explicit G4571 form relation while selecting its lemma notice", () => {
  const database = new DatabaseSync(DATABASE, { readOnly: true });
  try {
    const entry = getEntry(database, "G4571 = a Form of");
    assert.deepEqual(
      pick(entry, ["dStrong", "uStrong", "original", "morph", "gloss"]),
      {
        dStrong: "G4571 = a Form of",
        uStrong: "G4771",
        original: "σέ",
        morph: "G:P-2",
        gloss: "you"
      }
    );
    assert.match(entry.meaning, /^<b>αὐτός<\/b>/u);
    const resource = database
      .prepare(
        `select lr.source, lr.kind, lr.contentHtml
         from LexiconResources lr
         where lr.stepEntryId = ? and lr.source = 'TFLSJ'`
      )
      .get(entry.stepEntryId) as
      | { source: string; kind: string; contentHtml: string }
      | undefined;
    assert.ok(resource);
    assert.match(resource.contentHtml, /^<b> σύ<\/b>/u);
    assert.equal(CURATED_AUTO_TFLSJ_REPAIRS.has("greek:G4571"), true);
    assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("greek:G4571"), false);
  } finally {
    database.close();
  }
});

test("does not infer proper-name defects from G9048 N:N or alter H8379's attested homonym", () => {
  const database = new DatabaseSync(DATABASE, { readOnly: true });
  const legacy = new DatabaseSync("data/dictionaries/strong.legacy.sqlite", {
    readOnly: true
  });
  try {
    const g9048 = getEntry(database, "G9048 =");
    assert.deepEqual(pick(g9048, ["original", "morph", "gloss", "meaning"]), {
      original: "σαδημώθ",
      morph: "N:N",
      gloss: "a plain",
      meaning: "a plain"
    });
    assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("greek:G9048"), false);

    const h8379 = getEntry(database, "H8379 =");
    assert.equal(h8379.gloss, "boundary");
    assert.match(h8379.meaning, /^1\) boundary, limit/u);
    const legacyH8379 = legacy
      .prepare("select Definition from Hebreu where Code = 8379")
      .get() as { Definition: string };
    assert.match(legacyH8379.Definition, /frontière, limite/u);
    assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("hebrew:H8379"), false);
  } finally {
    legacy.close();
    database.close();
  }
});

function getEntry(
  database: DatabaseSync,
  dStrong: string
): EnglishLexiconEntry {
  const entry = database
    .prepare("select id as stepEntryId, * from StepEntries where dStrong = ?")
    .get(dStrong) as unknown as EnglishLexiconEntry | undefined;
  assert.ok(entry, dStrong);
  return entry;
}

function pick<T extends object, K extends keyof T>(
  value: T,
  keys: readonly K[]
): Pick<T, K> {
  return Object.fromEntries(keys.map((key) => [key, value[key]])) as Pick<T, K>;
}
