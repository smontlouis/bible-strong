import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  attestEnglishSemanticGloss,
  buildEnglishSemanticGlossSourceLines,
  ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST,
  ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES,
  EXPECTED_ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST,
  PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES,
  validateEnglishSemanticGlossAttestationEnvelope,
  validateEnglishSemanticGlossAttestationEvidence,
  validateEnglishSemanticGlossRuleProofs,
  type EnglishSemanticGlossAttestationContext,
  type EnglishSemanticGlossSourceFamily
} from "../src/lexiconV3/englishSemanticGlossAttestations.js";
import {
  applyEnglishExactRepairs,
  ENGLISH_EXACT_REPAIR_RULES,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  validateEnglishExactOccurrenceEvidence,
  validateEnglishSemanticGlossEvidence,
  type EnglishEvidenceSourceDigests,
  type EnglishLexiconEntry
} from "../src/lexiconV3/evidence.js";
import { readStepOriginalTokens } from "../src/stepOriginals.js";

const SOURCE_DATABASE = resolve(
  "data/dictionaries/strong_lexicon.full.production.sqlite"
);
const SOURCE_PATHS: Readonly<Record<EnglishSemanticGlossSourceFamily, string>> =
  {
    TBESG: resolve("data/external/stepbible/TBESG.txt"),
    TFLSJ: resolve("data/external/stepbible/TFLSJ.txt")
  };
const SOURCE_BUFFERS: Readonly<
  Record<EnglishSemanticGlossSourceFamily, Buffer>
> = {
  TBESG: readFileSync(SOURCE_PATHS.TBESG),
  TFLSJ: readFileSync(SOURCE_PATHS.TFLSJ)
};

const SOURCE_LINES = Object.fromEntries(
  [...ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()].flatMap((rule) =>
    rule.witnesses.map((witness) => [
      witness.locator,
      readExactSourceLine(witness.sourceFamily, witness.locator)
    ])
  )
);
const CONTEXT: EnglishSemanticGlossAttestationContext = {
  databaseDigest: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.database,
  sourceDigests: {
    TBESG: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TBESG,
    TFLSJ: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TFLSJ
  },
  sourceLines: SOURCE_LINES
};

test("builds the sealed source-line context from the pinned STEP texts", () => {
  assert.deepEqual(
    buildEnglishSemanticGlossSourceLines({
      TBESG: SOURCE_BUFFERS.TBESG.toString("utf8"),
      TFLSJ: SOURCE_BUFFERS.TFLSJ.toString("utf8")
    }),
    SOURCE_LINES
  );
});

test("pins all semantic-gloss attestations and their exact source snapshots", () => {
  assert.equal(ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.size, 56);
  assert.equal(
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST,
    EXPECTED_ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST
  );
  assert.equal(
    [...ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()].reduce(
      (total, rule) => total + rule.witnesses.length,
      0
    ),
    88
  );
  assert.equal(
    [...ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()].reduce(
      (total, rule) => total + rule.semanticProofs.length,
      0
    ),
    84
  );
  assert.equal(
    sha256(SOURCE_BUFFERS.TBESG),
    PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TBESG
  );
  assert.equal(
    sha256(SOURCE_BUFFERS.TFLSJ),
    PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TFLSJ
  );
  for (const rule of ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()) {
    assert.equal(rule.expectedExactOccurrenceCount, 0, rule.entryKey);
    assert.ok(rule.confidence >= 0.79 && rule.confidence <= 1, rule.entryKey);
    assert.equal(
      rule.witnesses.filter((witness) => witness.role === "target-source-row")
        .length,
      1,
      rule.entryKey
    );
    const target = rule.witnesses.find(
      (witness) => witness.role === "target-source-row"
    )!;
    assert.equal(target.semanticAuthority, false, rule.entryKey);
    assert.ok(
      target.fragments.every(
        (fragment) => !fragment.exactFragment.includes(rule.expectedGloss)
      ),
      `${rule.entryKey}:target-gloss-leaked-into-identity-proof`
    );
    assert.ok(rule.semanticProofs.length > 0, rule.entryKey);
    assert.ok(
      rule.semanticProofs.every(
        (proof) =>
          proof.kind === "target-meaning-fragment" ||
          (proof.kind === "independent-witness-fragment" &&
            proof.locator !== target.locator)
      ),
      `${rule.entryKey}:circular-proof`
    );
    assert.ok(rule.rationale.length > 30, rule.entryKey);
    assert.ok(rule.semanticBridge.length >= 20, rule.entryKey);
  }
  assert.equal(
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.has("greek:G20128"),
    false
  );
  assert.equal(
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.has("greek:G20490"),
    false
  );
  const g20727 = ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get("greek:G20727");
  assert.ok(g20727);
  assert.equal(g20727.expectedGloss, "isn't it?");
  assert.equal(g20727.expectedExactOccurrenceCount, 0);
  assert.equal(
    g20727.expectedSourceRecordDigest,
    "23dcadaa6f1c149e999ab45a0dc653c29de6d4989be9556d5dfdb9dea4782071"
  );
  assert.deepEqual(
    g20727.witnesses.map((item) => [item.id, item.sourceFamily, item.locator]),
    [
      ["TBESG.G20727.target-row", "TBESG", "TBESG:10356@4626355"],
      ["TBESG.G3378.parallel-combination", "TBESG", "TBESG:3491@2162433"],
      ["TFLSJ.G3378.affirmative-question", "TFLSJ", "TFLSJ:3464@12898375"]
    ]
  );
});

test("replays every semantic-gloss attestation against SQLite and exact STEP lines", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const readEntry = database.prepare(`
      SELECT language, eStrong, dStrong, uStrong, original, transliteration,
             morph, gloss, meaning
      FROM StepEntries
      WHERE language = 'greek' AND dStrong LIKE ?
    `);
    for (const rule of ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()) {
      const code = rule.entryKey.slice("greek:".length);
      const rows = readEntry.all(`${code} %`) as unknown as
        | EnglishExactRepairEntry[]
        | undefined;
      assert.equal(rows?.length, 1, rule.entryKey);
      const sourceEntry = rows![0]!;
      const exactRepair = ENGLISH_EXACT_REPAIR_RULES.has(rule.entryKey)
        ? applyEnglishExactRepairs(sourceEntry, {
            databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
            sourceDigests: {
              TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
              TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH
            }
          })
        : null;
      const entry = exactRepair?.entry ?? sourceEntry;
      const before = { ...entry };
      const evidence = attestEnglishSemanticGloss(entry, CONTEXT);
      assert.ok(evidence, rule.entryKey);
      assert.equal(evidence.gloss, rule.expectedGloss, rule.entryKey);
      assert.equal(evidence.expectedExactOccurrenceCount, 0, rule.entryKey);
      assert.deepEqual(
        { ...entry },
        before,
        `${rule.entryKey}:content-mutated`
      );
      assert.deepEqual(
        validateEnglishSemanticGlossAttestationEvidence({
          entry,
          evidence,
          context: CONTEXT
        }),
        [],
        rule.entryKey
      );
      assert.deepEqual(
        validateEnglishSemanticGlossAttestationEnvelope({
          entry,
          evidence,
          context: {
            databaseDigest: CONTEXT.databaseDigest,
            sourceDigests: CONTEXT.sourceDigests,
            exactOccurrenceCount: 0
          }
        }),
        [],
        `${rule.entryKey}:envelope`
      );
    }
  } finally {
    database.close();
  }
});

test("fails semantic-gloss attestations closed on snapshot, row, line, or proof drift", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const entry = database
      .prepare(
        `SELECT language, eStrong, dStrong, uStrong, original,
                transliteration, morph, gloss, meaning
         FROM StepEntries
         WHERE language = 'greek' AND dStrong LIKE 'G20159 %'`
      )
      .get() as unknown as EnglishExactRepairEntry;
    const exact = attestEnglishSemanticGloss(entry, CONTEXT);
    assert.ok(exact);

    assert.throws(
      () =>
        attestEnglishSemanticGloss(entry, {
          ...CONTEXT,
          databaseDigest: "0".repeat(64)
        }),
      /english-semantic-gloss-database-drift:greek:G20159/u
    );
    assert.throws(
      () =>
        attestEnglishSemanticGloss(entry, {
          ...CONTEXT,
          sourceDigests: { ...CONTEXT.sourceDigests, TFLSJ: "0".repeat(64) }
        }),
      /english-semantic-gloss-proof-source-drift:.*TFLSJ/u
    );
    assert.throws(
      () =>
        attestEnglishSemanticGloss(
          { ...entry, meaning: `${entry.meaning} drift` },
          CONTEXT
        ),
      /english-semantic-gloss-row-drift:greek:G20159/u
    );

    const targetLocator =
      ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get("greek:G20159")!
        .witnesses[0]!.locator;
    assert.throws(
      () =>
        attestEnglishSemanticGloss(entry, {
          ...CONTEXT,
          sourceLines: {
            ...CONTEXT.sourceLines,
            [targetLocator]: `${CONTEXT.sourceLines[targetLocator]} drift`
          }
        }),
      /english-semantic-gloss-witness-drift:greek:G20159/u
    );

    assert.deepEqual(
      validateEnglishSemanticGlossAttestationEvidence({
        entry,
        evidence: { ...exact, attestationDigest: "0".repeat(64) },
        context: CONTEXT
      }),
      ["english-semantic-gloss-attestation-evidence-replay-mismatch"]
    );
  } finally {
    database.close();
  }
});

test("requires both the G20727 morph repair and semantic attestation while preserving its exact identity", async () => {
  const tagntPaths = [
    resolve("data/external/stepbible/amalgamated/TAGNT Mat-Jhn.txt"),
    resolve("data/external/stepbible/amalgamated/TAGNT Act-Rev.txt")
  ];
  const tagntBuffers = tagntPaths.map((path) => readFileSync(path));
  const tagntTokens = (
    await Promise.all(tagntPaths.map((path) => readStepOriginalTokens(path)))
  ).flat();
  const exactG20727Tokens = tagntTokens.filter((token) =>
    [...token.strongByBase.values()].some((stepStrongs) =>
      stepStrongs.has("G20727")
    )
  );
  assert.equal(exactG20727Tokens.length, 0);

  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const entry = database
      .prepare(
        `SELECT id AS stepEntryId, baseCode, language, eStrong, dStrong,
                uStrong, original, transliteration, morph, gloss, meaning,
                classicTransliteration, pronunciation
         FROM StepEntries
         WHERE language = 'greek' AND eStrong = 'G20727'`
      )
      .get() as unknown as EnglishLexiconEntry;
    const sourceDigests: EnglishEvidenceSourceDigests = {
      database: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
      TBESG: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TBESG,
      TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
      TFLSJ: PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.TFLSJ,
      TAGNT: {
        "TAGNT Mat-Jhn.txt": sha256(tagntBuffers[0]!),
        "TAGNT Act-Rev.txt": sha256(tagntBuffers[1]!)
      },
      TAHOT: {}
    };
    const context = buildEnglishEvidenceContext({
      entries: [entry],
      tokens: exactG20727Tokens,
      sourceDigests,
      semanticGlossSourceLines: SOURCE_LINES
    });
    const record = auditEnglishEvidenceEntry(entry, [], context);

    assert.equal(record.decision.status, "repaired");
    assert.equal(record.morph, "G:PRT-N + G:PRT-N");
    assert.equal(record.gloss, entry.gloss);
    assert.match(record.meaning, /Herodotus Historicus/u);
    assert.doesNotMatch(record.meaning, /Herdotus Historicus/u);
    for (const field of [
      "eStrong",
      "dStrong",
      "uStrong",
      "original",
      "transliteration"
    ] as const) {
      assert.equal(record[field], entry[field], field);
    }
    assert.deepEqual(record.decision.reasonCodes, [
      "brief-source-accepted",
      "exact-source-field-repair",
      "curated-auto-validated-exact-source-field-repair",
      "semantic-gloss-attestation",
      "curated-auto-validated-semantic-gloss-attestation"
    ]);
    assert.equal(record.evidence.fieldRepairs.length, 2);
    assert.equal(
      record.evidence.fieldRepairs[0]!.sourceRecordDigest,
      "28b716dffe623e43c665f0247938c4e04337f5751e70e157ca93c3b6f63d0c1a"
    );
    assert.equal(
      record.evidence.semanticGlossAttestation?.sourceRecordDigest,
      "23dcadaa6f1c149e999ab45a0dc653c29de6d4989be9556d5dfdb9dea4782071"
    );
    assert.deepEqual(record.evidence.exactOccurrence, {
      source: "TAGNT",
      stepStrong: "G20727",
      count: 0,
      references: [],
      occurrences: [],
      occurrenceCorpusDigest:
        "f278fa5b217244a3c7def1df0e864a05b231fa3bc7ebbe698e539deefb0c88f9"
    });
    assert.deepEqual(validateEnglishExactOccurrenceEvidence(record), []);
    assert.deepEqual(validateEnglishSemanticGlossEvidence(record), []);

    const morphOnlyContext = buildEnglishEvidenceContext({
      entries: [entry],
      tokens: exactG20727Tokens,
      sourceDigests,
      semanticGlossSourceLines: {}
    });
    const morphOnly = auditEnglishEvidenceEntry(entry, [], morphOnlyContext);
    assert.equal(morphOnly.morph, "G:PRT-N + G:PRT-N");
    assert.equal(morphOnly.evidence.fieldRepairs.length, 2);
    assert.equal(morphOnly.evidence.semanticGlossAttestation, null);
    assert.equal(morphOnly.decision.status, "quarantined");
    assert.deepEqual(morphOnly.decision.reasonCodes, [
      "semantic-gloss-attestation-evidence-missing",
      "english-semantic-gloss-attestation-evidence-replay-mismatch"
    ]);
  } finally {
    database.close();
  }
});

test("semantic proof decisions are invariant when the target gloss and identity row are removed", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const readEntry = database.prepare(`
      SELECT language, eStrong, dStrong, uStrong, original, transliteration,
             morph, gloss, meaning
      FROM StepEntries
      WHERE language = 'greek' AND dStrong LIKE ?
    `);
    for (const rule of ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.values()) {
      const code = rule.entryKey.slice("greek:".length);
      const sourceEntry = readEntry.get(`${code} %`) as unknown as
        | EnglishExactRepairEntry
        | undefined;
      assert.ok(sourceEntry, rule.entryKey);
      const exact = ENGLISH_EXACT_REPAIR_RULES.has(rule.entryKey)
        ? applyEnglishExactRepairs(sourceEntry, {
            databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
            sourceDigests: {
              TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
              TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH
            }
          })
        : null;
      const entry = exact?.entry ?? sourceEntry;
      const target = rule.witnesses.find(
        (witness) => witness.role === "target-source-row"
      )!;
      const sourceLinesWithoutTarget = { ...CONTEXT.sourceLines };
      delete sourceLinesWithoutTarget[target.locator];
      assert.deepEqual(
        validateEnglishSemanticGlossRuleProofs(
          { ...entry, gloss: "TARGET GLOSS REMOVED" },
          { ...CONTEXT, sourceLines: sourceLinesWithoutTarget }
        ),
        [],
        rule.entryKey
      );
    }
  } finally {
    database.close();
  }
});

test("does not attest an entry outside the exact semantic registry", () => {
  const untouched: EnglishExactRepairEntry = {
    language: "greek",
    eStrong: "G1",
    dStrong: "G1",
    uStrong: "G1",
    original: "ἄλφα",
    transliteration: "alpha",
    morph: "G:N",
    gloss: "alpha",
    meaning: "alpha"
  };
  assert.equal(attestEnglishSemanticGloss(untouched, CONTEXT), null);
});

function readExactSourceLine(
  sourceFamily: EnglishSemanticGlossSourceFamily,
  locator: string
): string {
  const match = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(locator);
  assert.ok(match, locator);
  assert.equal(match[1], sourceFamily, locator);
  const expectedLine = Number(match[2]);
  const byteOffset = Number(match[3]);
  const buffer = SOURCE_BUFFERS[sourceFamily];
  assert.equal(lineNumberAtOffset(buffer, byteOffset), expectedLine, locator);
  const lf = buffer.indexOf(10, byteOffset);
  const physicalEnd = lf === -1 ? buffer.length : lf;
  const contentEnd =
    physicalEnd > byteOffset && buffer[physicalEnd - 1] === 13
      ? physicalEnd - 1
      : physicalEnd;
  return buffer.subarray(byteOffset, contentEnd).toString("utf8");
}

function lineNumberAtOffset(buffer: Buffer, byteOffset: number): number {
  assert.ok(byteOffset >= 0 && byteOffset < buffer.length);
  assert.ok(byteOffset === 0 || buffer[byteOffset - 1] === 10);
  let line = 1;
  for (let index = 0; index < byteOffset; index += 1) {
    if (buffer[index] === 10) line += 1;
  }
  return line;
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}
