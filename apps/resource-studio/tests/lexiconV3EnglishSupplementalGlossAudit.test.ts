import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  digestEnglishExactRepairSourceRecord,
  ENGLISH_EXACT_REPAIR_RULES,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import { ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES } from "../src/lexiconV3/englishSemanticGlossAttestations.js";
import {
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG,
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_RULES,
  buildEnglishSupplementalGlossAuditWitnessContext,
  EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
  EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_DIGEST,
  PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES,
  replayEnglishSupplementalGlossAuditWitnesses,
  type EnglishSupplementalGlossAuditRule
} from "../src/lexiconV3/englishSupplementalGlossAudit.js";
import { readStepOriginalTokens } from "../src/stepOriginals.js";

const SOURCE_DATABASE = resolve(
  "data/dictionaries/strong_lexicon.full.production.sqlite"
);
const SOURCE_PATHS = {
  TBESG: resolve("data/external/stepbible/TBESG.txt"),
  TFLSJ: resolve("data/external/stepbible/TFLSJ.txt")
} as const;
const SOURCE_BUFFERS = {
  TBESG: readFileSync(SOURCE_PATHS.TBESG),
  TFLSJ: readFileSync(SOURCE_PATHS.TFLSJ)
} as const;
const SOURCE_TEXTS = {
  TBESG: SOURCE_BUFFERS.TBESG.toString("utf8"),
  TFLSJ: SOURCE_BUFFERS.TFLSJ.toString("utf8")
} as const;

test("pins complete ordered coverage for all 132 audited supplemental gloss gaps", () => {
  assert.equal(
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.expectedEntryCount,
    132
  );
  assert.equal(ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries.length, 132);
  assert.equal(ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_RULES.size, 132);
  assert.deepEqual(
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.batches.map(
      (batch) => batch.expectedEntryKeys.length
    ),
    [44, 44, 44]
  );
  assert.equal(
    ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
    EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST
  );
  assert.equal(
    sha256(readFileSync(SOURCE_DATABASE)),
    PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES.database
  );
  assert.equal(
    sha256(SOURCE_BUFFERS.TBESG),
    PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES.TBESG
  );
  assert.equal(
    sha256(SOURCE_BUFFERS.TFLSJ),
    PINNED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_SOURCES.TFLSJ
  );
});

test("replays every catalog row and exact witness against the pinned local sources", () => {
  const witnessContext =
    buildEnglishSupplementalGlossAuditWitnessContext(SOURCE_TEXTS);
  assert.deepEqual(
    {
      entryCount: witnessContext.entryCount,
      witnessCount: witnessContext.witnessCount,
      uniqueLocatorCount: witnessContext.uniqueLocatorCount,
      fragmentCount: witnessContext.fragmentCount
    },
    {
      entryCount: 132,
      witnessCount: 207,
      uniqueLocatorCount: 205,
      fragmentCount: 528
    }
  );
  assert.equal(
    witnessContext.replayDigest,
    EXPECTED_ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_WITNESS_REPLAY_DIGEST
  );
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const readEntry = database.prepare(`
      SELECT language, eStrong, dStrong, uStrong, original, transliteration,
             morph, gloss, meaning
      FROM StepEntries
      WHERE language = 'greek' AND dStrong = ?
    `);
    for (const rule of ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries) {
      const entry = readEntry.get(rule.identity.dStrong) as unknown as
        | EnglishExactRepairEntry
        | undefined;
      assert.ok(entry, rule.entryKey);
      assert.equal(
        digestEnglishExactRepairSourceRecord(entry),
        rule.sourceRecordDigest,
        `${rule.entryKey}:source-record`
      );
      assert.equal(entry.gloss, rule.rawGloss, `${rule.entryKey}:gloss`);
      assert.equal(entry.meaning, rule.rawMeaning, `${rule.entryKey}:meaning`);
      if (rule.classification === "EXACT_REPAIR") {
        assert.ok(ENGLISH_EXACT_REPAIR_RULES.has(rule.entryKey), rule.entryKey);
      }
      if (rule.classification === "VALID_POLYSENSE") {
        if (rule.proposedMorph === rule.identity.morph) {
          assert.equal(
            Number(
              ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.has(rule.entryKey)
            ) + Number(ENGLISH_EXACT_REPAIR_RULES.has(rule.entryKey)),
            1,
            `${rule.entryKey}:must-resolve-to-exactly-one-final-policy`
          );
        } else {
          assert.ok(
            ENGLISH_EXACT_REPAIR_RULES.has(rule.entryKey),
            `${rule.entryKey}:morph-repair`
          );
        }
      }
    }
  } finally {
    database.close();
  }
});

test("fails closed on supplemental witness line-number drift", () => {
  const [rule, witness] = cloneFirstRuleAndWitness();
  const parsed = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(witness.locator)!;
  witness.locator = `${parsed[1]}:${Number(parsed[2]) + 1}@${parsed[3]}`;
  assert.throws(
    () => replayEnglishSupplementalGlossAuditWitnesses(SOURCE_TEXTS, [rule]),
    /english-supplemental-gloss-audit-witness-line-number-drift/u
  );
});

test("fails closed on supplemental witness byte-offset drift", () => {
  const [rule, witness] = cloneFirstRuleAndWitness();
  const parsed = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(witness.locator)!;
  witness.locator = `${parsed[1]}:${parsed[2]}@${Number(parsed[3]) + 1}`;
  assert.throws(
    () => replayEnglishSupplementalGlossAuditWitnesses(SOURCE_TEXTS, [rule]),
    /english-supplemental-gloss-audit-witness-byte-offset-drift/u
  );
});

test("fails closed on supplemental witness line-digest drift", () => {
  const [rule, witness] = cloneFirstRuleAndWitness();
  witness.expectedLineDigest = "0".repeat(64);
  assert.throws(
    () => replayEnglishSupplementalGlossAuditWitnesses(SOURCE_TEXTS, [rule]),
    /english-supplemental-gloss-audit-witness-line-digest-drift/u
  );
});

test("fails closed on supplemental witness exact-fragment drift", () => {
  const [rule, witness] = cloneFirstRuleAndWitness();
  witness.exactFragments = ["fragment-that-does-not-exist"];
  assert.throws(
    () => replayEnglishSupplementalGlossAuditWitnesses(SOURCE_TEXTS, [rule]),
    /english-supplemental-gloss-audit-witness-fragment-drift/u
  );
});

test("replays the zero exact-TAGNT occurrence boundary for all 132 entries", async () => {
  const counts = new Map<string, number>();
  for (const path of [
    resolve("data/external/stepbible/amalgamated/TAGNT Act-Rev.txt"),
    resolve("data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt")
  ]) {
    for (const token of await readStepOriginalTokens(path)) {
      for (const stepStrongValues of token.strongByBase.values()) {
        for (const stepStrong of stepStrongValues) {
          counts.set(stepStrong, (counts.get(stepStrong) ?? 0) + 1);
        }
      }
    }
  }
  for (const rule of ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries) {
    assert.equal(rule.expectedExactOccurrenceCount, 0, rule.entryKey);
    assert.equal(counts.get(rule.identity.eStrong) ?? 0, 0, rule.entryKey);
  }
});

function cloneFirstRuleAndWitness(): [
  EnglishSupplementalGlossAuditRule,
  {
    sourceFamily: "TBESG" | "TFLSJ";
    role: string;
    locator: string;
    expectedLineDigest: string;
    exactFragments: string[];
  }
] {
  const originalRule = ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries[0]!;
  const witness = {
    ...originalRule.witnesses[0]!,
    exactFragments: [...originalRule.witnesses[0]!.exactFragments]
  };
  const rule = {
    ...originalRule,
    witnesses: [witness]
  } as EnglishSupplementalGlossAuditRule;
  return [rule, witness];
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
