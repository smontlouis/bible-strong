import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { createStrongPhraseLexicon } from "../src/phraseTranslationLexicon.js";
import {
  readStrongPhraseLexiconSqlite,
  writeStrongPhraseLexiconSqlite
} from "../src/strongPhraseLexiconStore.js";

test("stores and reads a cached Strong phrase lexicon", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "strong-phrase-lexicon-"));
  const sqlitePath = path.join(dir, "phrase-lexicon.sqlite");
  const lexicon = createStrongPhraseLexicon(
    new Map([
      [
        "H0001",
        [
          {
            strong: "H0001",
            phrase: ["au", "commencement"],
            offset: 1,
            score: 0.91,
            source: "test",
            method: "learned-phrase"
          }
        ]
      ]
    ])
  );

  await writeStrongPhraseLexiconSqlite({
    sqlitePath,
    sourceFingerprint: "fingerprint-a",
    lexicon
  });

  const cached = readStrongPhraseLexiconSqlite({
    sqlitePath,
    sourceFingerprint: "fingerprint-a"
  });
  assert.equal(
    cached?.byStrong.get("H0001")?.[0]?.phrase.join(" "),
    "au commencement"
  );
  assert.equal(cached?.byStrongFirst?.get("H0001")?.get("au")?.length, 1);

  const stale = readStrongPhraseLexiconSqlite({
    sqlitePath,
    sourceFingerprint: "fingerprint-b"
  });
  assert.equal(stale, undefined);
});
