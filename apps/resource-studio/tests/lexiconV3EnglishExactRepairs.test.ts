import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  applyEnglishExactRepairs,
  ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST,
  ENGLISH_EXACT_REPAIR_RULES,
  EXPECTED_ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  validateEnglishExactFieldRepairEvidence,
  type EnglishExactRepairContext,
  type EnglishExactRepairEntry
} from "../src/lexiconV3/englishExactRepairs.js";
import {
  auditEnglishEvidenceEntry,
  buildEnglishEvidenceContext,
  type EnglishEvidenceSourceDigests,
  type EnglishLexiconEntry
} from "../src/lexiconV3/evidence.js";
import { validateEnglishAuditFieldRepairValues } from "../scripts/buildLexiconV3Authoring.js";
import { selectCanonicalEnglish } from "../scripts/buildLexiconV3FrenchPackets.js";

const SOURCE_DATABASE = resolve(
  "data/dictionaries/strong_lexicon.full.production.sqlite"
);
const CONTEXT: EnglishExactRepairContext = {
  databaseDigest: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
  sourceDigests: {
    TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
    TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
    TIPNR: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR
  }
};

test("pins a complete, immutable-by-digest registry of exact English repairs", () => {
  assert.equal(ENGLISH_EXACT_REPAIR_RULES.size, 171);
  assert.equal(
    ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST,
    EXPECTED_ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST
  );
  assert.equal(
    [...ENGLISH_EXACT_REPAIR_RULES.values()].reduce(
      (total, rule) => total + rule.changes.length,
      0
    ),
    192
  );
  assert.equal(
    [...ENGLISH_EXACT_REPAIR_RULES.values()].reduce(
      (total, rule) =>
        total +
        rule.changes.filter((change) => change.field === "morph").length,
      0
    ),
    16
  );
  assert.equal(
    [...ENGLISH_EXACT_REPAIR_RULES.values()].filter(
      (rule) => rule.sourceFamily === "TBESH"
    ).length,
    14
  );
  assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("greek:G20128"), false);
  assert.equal(ENGLISH_EXACT_REPAIR_RULES.has("greek:G20490"), false);
  const g21230 = ENGLISH_EXACT_REPAIR_RULES.get("greek:G21230");
  assert.ok(g21230);
  assert.equal(g21230.changes[0]?.repairedValue, "to fry in a pan");
  assert.equal(
    g21230.changes[0]?.method,
    "exact-same-family-companion-recovery"
  );
  assert.equal(g21230.externalWitnesses?.length, 2);
  const g20727 = ENGLISH_EXACT_REPAIR_RULES.get("greek:G20727");
  assert.ok(g20727);
  assert.deepEqual(
    g20727.changes.map((item) => ({
      field: item.field,
      sourceValue: item.sourceValue,
      repairedValue: item.repairedValue,
      method: item.method
    })),
    [
      {
        field: "morph",
        sourceValue: "",
        repairedValue: "G:PRT-N + G:PRT-N",
        method: "exact-morphological-classification"
      },
      {
        field: "meaning",
        sourceValue: g20727.changes[1]?.sourceValue,
        repairedValue: g20727.changes[1]?.repairedValue,
        method: "exact-orthographic-correction"
      }
    ]
  );
  assert.match(g20727.changes[1]?.sourceValue ?? "", /Herdotus Historicus/u);
  assert.match(g20727.changes[1]?.repairedValue ?? "", /Herodotus Historicus/u);
  assert.doesNotMatch(
    g20727.changes[1]?.repairedValue ?? "",
    /Herdotus Historicus/u
  );
  assert.equal(
    g20727.expectedSourceRecordDigest,
    "28b716dffe623e43c665f0247938c4e04337f5751e70e157ca93c3b6f63d0c1a"
  );
});

test("moves all twenty-nine rejected polysenses into exact gloss repairs", () => {
  const expectedGlosses: Readonly<Record<string, string>> = {
    G20045: "to mutilate; cut off extremities",
    G20063: "retreat, withdrawal",
    G20166: "improvised, off-hand",
    G20202: "finger-sheath",
    G20281: "to arrange in a place",
    G20353: "as far as possible",
    G20435: "to annoy, offend",
    G20567: "raid, inroad",
    G20574: "to cover with mail",
    G20595: "branding iron",
    G20617: "hidden, concealed",
    G20655: "barley cake",
    G20685: "renowned, glorious",
    G20747: "memorable, worth remembering",
    G20806: "to adulterate",
    G20819: "household, menial",
    G20911: "to creep in",
    G20993: "buckle, brooch",
    G21019: "to do beforehand",
    G21091: "pen, fold; shrine",
    G21136: "mouth, entrance",
    G21157: "to found or colonize jointly",
    G21180: "to agree; consider together",
    G21202: "system, composite whole",
    G21211: "in heaps",
    G21228: "implement, vessel",
    G21242: "to wage war from strong positions",
    G21268: "wood-cutting; woodcutter",
    G21307: "to treat humanely"
  };
  assert.equal(Object.keys(expectedGlosses).length, 29);
  for (const [code, expectedGloss] of Object.entries(expectedGlosses)) {
    const repairRule = ENGLISH_EXACT_REPAIR_RULES.get(`greek:${code}`);
    assert.ok(repairRule, code);
    const glossChange = repairRule.changes.find(
      (change) => change.field === "gloss"
    );
    assert.equal(glossChange?.repairedValue, expectedGloss, code);
    assert.ok(
      (glossChange?.support.length ?? 0) > 0 ||
        (repairRule.externalWitnesses?.length ?? 0) > 0,
      `${code}:missing-exact-support`
    );
  }
});

test("repairs G20354 only through the pinned offline Perseus artifact", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const entry = database
      .prepare(
        `SELECT language, eStrong, dStrong, uStrong, original,
                transliteration, morph, gloss, meaning
         FROM StepEntries
         WHERE language = 'greek' AND eStrong = 'G20354'`
      )
      .get() as unknown as EnglishExactRepairEntry;
    const exact = applyEnglishExactRepairs(entry, CONTEXT);
    assert.ok(exact);
    assert.equal(exact.entry.gloss, "to alter; passive participle: a sodomite");
    assert.equal(
      exact.entry.meaning,
      "<b>to alter</b> in the active voice (Aristotle, <i>Physiognomonica</i> 806a13); in the passive participle, substantivally, <b>a sodomite</b> (LXX 3 Kings 22:47; Aquila, Genesis 38:21)."
    );
    assert.deepEqual(
      exact.repairs.map((repair) => [repair.field, repair.method]),
      [
        ["gloss", "exact-pinned-external-lexicon-recovery"],
        ["meaning", "exact-pinned-external-lexicon-recovery"]
      ]
    );
    assert.throws(
      () =>
        applyEnglishExactRepairs(entry, {
          ...CONTEXT,
          g20354PerseusArtifact: {}
        }),
      /english-exact-repair-external-artifact-drift:greek:G20354/u
    );
    assert.throws(
      () =>
        applyEnglishExactRepairs(entry, {
          ...CONTEXT,
          g20354PerseusArtifactFile: `${readFileSync(
            resolve("src/lexiconV3/sources/perseus-lsj-g20354-n35193.json"),
            "utf8"
          )}\n`
        }),
      /english-exact-repair-external-artifact-file-drift:greek:G20354/u
    );
  } finally {
    database.close();
  }
});

test("replays every external exact-repair witness against its pinned STEP line", () => {
  const sourceByFamily = {
    TBESG: readFileSync(resolve("data/external/stepbible/TBESG.txt")),
    TBESH: readFileSync(resolve("data/external/stepbible/TBESH.txt")),
    TIPNR: readFileSync(
      resolve("data/external/stepbible/tipnr-json/people.json")
    )
  } as const;

  for (const repairRule of ENGLISH_EXACT_REPAIR_RULES.values()) {
    for (const witness of repairRule.externalWitnesses ?? []) {
      const locator = /^(TBESG|TBESH|TIPNR):(\d+)@(\d+)$/u.exec(
        witness.locator
      );
      assert.ok(locator, `${repairRule.entryKey}:${witness.locator}`);
      assert.equal(locator[1], witness.sourceFamily);
      const expectedLineNumber = Number(locator[2]);
      const byteOffset = Number(locator[3]);
      const source = sourceByFamily[witness.sourceFamily];
      assert.ok(Number.isSafeInteger(byteOffset) && byteOffset >= 0);
      const actualLineNumber = source
        .subarray(0, byteOffset)
        .reduce((count, byte) => {
          return count + (byte === 0x0a ? 1 : 0);
        }, 1);
      assert.equal(actualLineNumber, expectedLineNumber, witness.locator);
      const lineEnd = source.indexOf(0x0a, byteOffset);
      assert.notEqual(lineEnd, -1, witness.locator);
      const line = source.subarray(byteOffset, lineEnd);
      assert.equal(
        createHash("sha256").update(line).digest("hex"),
        witness.expectedLineDigest,
        witness.locator
      );
      const text = line.toString("utf8");
      for (const fragment of witness.exactFragments) {
        assert.ok(text.includes(fragment), `${witness.locator}:${fragment}`);
      }
    }
  }
});

test("pins all nineteen semantic-audit corrections to their approved English values", () => {
  const expectedGlosses: Readonly<Record<string, string>> = {
    G20079: "unconquered, unconquerable",
    G20100: "unerring",
    G20158: "unhonoured, despised; unvalued, unassessed",
    G20169: "tale, narrative",
    G20200: "weeping, wailing, groaning, howling; mourning, lamentation",
    G20295: "cast out; outcast",
    G20440: "confusedly, promiscuously; pell-mell",
    G20523: "peculiar nature, property",
    G20805: "intellectual",
    G20936: "famous; notorious, scandalous",
    G20990: "knavish trick",
    G21014: "foremost fighter, champion; defender",
    G21111: "pointed stake",
    G21115: "lewdness, wantonness; riot, luxury",
    G21188: "to agree with; to advocate, help",
    G21222: "bringing to completion; accomplishing",
    G21315: "loving one's life; cowardly, faint-hearted",
    G21328: "natural, not artificial",
    G21343: "to cast in a mould; to cast metal"
  };
  assert.equal(Object.keys(expectedGlosses).length, 19);
  for (const [code, expectedGloss] of Object.entries(expectedGlosses)) {
    const repairRule = ENGLISH_EXACT_REPAIR_RULES.get(`greek:${code}`);
    assert.ok(repairRule, code);
    const glossChange = repairRule.changes.find(
      (change) => change.field === "gloss"
    );
    assert.equal(glossChange?.repairedValue, expectedGloss, code);
    assert.ok(glossChange && glossChange.support.length > 0, code);
  }
  const g20200Meaning = ENGLISH_EXACT_REPAIR_RULES.get(
    "greek:G20200"
  )!.changes.find((change) => change.field === "meaning");
  assert.equal(
    g20200Meaning?.repairedValue,
    "<b>weeping, wailing, groaning, howling, mourning, lamentation</b>, attested in Homer (8th/7th c. BC) and <i>Tragica Adespota</i> (variant dates) (ML)"
  );
  assert.equal(
    g20200Meaning?.repairedValueDigest,
    "3b9dddef306e711f0d5f75821e18d128032b3c22361ca7861d31bf4cf1947102"
  );
});

test("replays every exact repair against its pinned STEP source row", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const readEntry = database.prepare(`
      SELECT language, eStrong, dStrong, uStrong, original, transliteration,
             morph, gloss, meaning
      FROM StepEntries
      WHERE language = ? AND dStrong LIKE ?
    `);
    for (const rule of ENGLISH_EXACT_REPAIR_RULES.values()) {
      const [language, dStrong] = rule.entryKey.split(":") as [
        EnglishExactRepairEntry["language"],
        string
      ];
      const rows = readEntry.all(language, `${dStrong} %`) as unknown as
        | EnglishExactRepairEntry[]
        | undefined;
      assert.equal(rows?.length, 1, rule.entryKey);
      const sourceEntry = rows![0]!;
      const result = applyEnglishExactRepairs(sourceEntry, CONTEXT);
      assert.ok(result, rule.entryKey);
      assert.equal(result.repairs.length, rule.changes.length, rule.entryKey);

      for (const identityField of [
        "language",
        "eStrong",
        "dStrong",
        "uStrong",
        "original",
        "transliteration"
      ] as const) {
        assert.equal(
          result.entry[identityField],
          sourceEntry[identityField],
          `${rule.entryKey}:${identityField}`
        );
      }
      const morphChange = rule.changes.find(
        (change) => change.field === "morph"
      );
      assert.equal(
        result.entry.morph,
        morphChange?.repairedValue ?? sourceEntry.morph,
        `${rule.entryKey}:morph`
      );
      for (const repair of result.repairs) {
        assert.equal(
          result.entry[repair.field],
          repair.repairedValue,
          `${rule.entryKey}:${repair.field}`
        );
        assert.deepEqual(
          validateEnglishExactFieldRepairEvidence({
            sourceEntry,
            repairedEntry: result.entry,
            repair,
            context: CONTEXT
          }),
          [],
          `${rule.entryKey}:${repair.field}`
        );
      }
    }
  } finally {
    database.close();
  }
});

test("fails exact repairs closed on source, row, or proof drift", () => {
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const sourceEntry = database
      .prepare(
        `
        SELECT language, eStrong, dStrong, uStrong, original, transliteration,
               morph, gloss, meaning
        FROM StepEntries
        WHERE language = 'greek' AND dStrong LIKE 'G4662 %'
      `
      )
      .get() as unknown as EnglishExactRepairEntry;
    const exact = applyEnglishExactRepairs(sourceEntry, CONTEXT);
    assert.ok(exact);

    assert.throws(
      () =>
        applyEnglishExactRepairs(sourceEntry, {
          ...CONTEXT,
          databaseDigest: "0".repeat(64)
        }),
      /english-exact-repair-database-drift:greek:G4662/u
    );
    assert.throws(
      () =>
        applyEnglishExactRepairs(sourceEntry, {
          ...CONTEXT,
          sourceDigests: { ...CONTEXT.sourceDigests, TBESG: "0".repeat(64) }
        }),
      /english-exact-repair-source-drift:greek:G4662/u
    );
    assert.throws(
      () =>
        applyEnglishExactRepairs(
          { ...sourceEntry, meaning: "changed" },
          CONTEXT
        ),
      /english-exact-repair-row-drift:greek:G4662/u
    );

    const tamperedRepair = {
      ...exact.repairs[0]!,
      repairedValue: "worm-consumed"
    };
    assert.deepEqual(
      validateEnglishExactFieldRepairEvidence({
        sourceEntry,
        repairedEntry: exact.entry,
        repair: tamperedRepair,
        context: CONTEXT
      }),
      [
        "english-exact-repair-evidence-replay-mismatch",
        "english-exact-repair-published-value-mismatch"
      ]
    );
  } finally {
    database.close();
  }
});

test("does not alter rows outside the exact registry", () => {
  const untouched: EnglishExactRepairEntry = {
    language: "greek",
    eStrong: "G1",
    dStrong: "G1",
    uStrong: "G1",
    original: "ἄλφα",
    transliteration: "alpha",
    morph: "N-PRI",
    gloss: "alpha",
    meaning: "alpha"
  };
  assert.equal(applyEnglishExactRepairs(untouched, CONTEXT), null);
});

test("replays gloss, meaning, and dual-field repairs at the authoring boundary", () => {
  const sourceDigests: EnglishEvidenceSourceDigests = {
    database: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
    TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
    TBESH: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH,
    TFLSJ: "f".repeat(64),
    TAGNT: {},
    TAHOT: {},
    greekReconstruction: {
      witnessCatalog: "0".repeat(64),
      witnessCatalogFile: "0".repeat(64),
      tipnrPeople: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TIPNR,
      legacyDatabase: "0".repeat(64),
      perseusArtifact: "0".repeat(64),
      perseusArtifactFile: "0".repeat(64),
      perseusSourceFile: "0".repeat(64),
      g20464AdjudicationArtifact: "0".repeat(64),
      g20464AdjudicationArtifactFile: "0".repeat(64),
      g20464AdjudicationPayload: "0".repeat(64),
      kaikkiFrench: "0".repeat(64)
    }
  };
  const database = new DatabaseSync(SOURCE_DATABASE, { readOnly: true });
  try {
    const statement = database.prepare(`
      SELECT id AS stepEntryId, baseCode, language, eStrong, dStrong, uStrong,
             original, transliteration, morph, gloss, meaning,
             classicTransliteration, pronunciation
      FROM StepEntries
      WHERE dStrong LIKE ?
    `);
    for (const expected of [
      { key: "G4662", gloss: "worm-eaten", meaning: null },
      { key: "G21230", gloss: null, meaning: "to fry in a pan" },
      {
        key: "G20003",
        gloss: "ill-advised",
        meaning: "ill-advised, inconsiderate."
      },
      {
        key: "G20354",
        gloss: "to alter; passive participle: a sodomite",
        meaning:
          "<b>to alter</b> in the active voice (Aristotle, <i>Physiognomonica</i> 806a13); in the passive participle, substantivally, <b>a sodomite</b> (LXX 3 Kings 22:47; Aquila, Genesis 38:21)."
      },
      {
        key: "H5414H",
        gloss: null,
        meaningIncludes: ": put/set/appoint<br />"
      },
      {
        key: "H3659",
        gloss: null,
        meaning:
          "<p>Jehoiachin, also known as Jeconiah, Coniah, or Shallum, was a king of Judah who reigned for three months before being exiled to Babylon.</p>"
      }
    ]) {
      const entry = statement.get(`${expected.key} %`) as unknown as
        | EnglishLexiconEntry
        | undefined;
      assert.ok(entry, expected.key);
      const context = buildEnglishEvidenceContext({
        entries: [entry],
        tokens: [],
        sourceDigests
      });
      const audit = auditEnglishEvidenceEntry(entry, [], context);
      assert.equal(audit.decision.status, "repaired", expected.key);
      assert.ok(
        audit.decision.reasonCodes.includes(
          "curated-auto-validated-exact-source-field-repair"
        ),
        expected.key
      );
      const values = validateEnglishAuditFieldRepairValues(
        {
          id: entry.stepEntryId,
          ...entry,
          classicTransliteration: entry.classicTransliteration ?? "",
          pronunciation: entry.pronunciation ?? ""
        },
        audit
      );
      if (expected.gloss !== null) {
        assert.equal(values.gloss, expected.gloss, expected.key);
      }
      if (expected.meaning !== null && expected.meaning !== undefined) {
        assert.equal(values.meaning, expected.meaning, expected.key);
      }
      if (expected.meaningIncludes) {
        assert.ok(
          values.meaning.includes(expected.meaningIncludes),
          expected.key
        );
      }
      const selected = selectCanonicalEnglish(audit);
      assert.equal(selected.status, "validated", expected.key);
      assert.deepEqual(
        selected.sources,
        [entry.language === "greek" ? "TBESG" : "TBESH"],
        expected.key
      );
      assert.equal(selected.gloss, values.gloss, expected.key);
      assert.equal(selected.meaningHtml, values.meaning, expected.key);

      const forged = structuredClone(audit);
      forged.evidence.fieldRepairs[0]!.repairDigest = "0".repeat(64);
      assert.throws(
        () =>
          validateEnglishAuditFieldRepairValues(
            {
              id: entry.stepEntryId,
              ...entry,
              classicTransliteration: entry.classicTransliteration ?? "",
              pronunciation: entry.pronunciation ?? ""
            },
            forged
          ),
        /english-audit-field-repair-proof-invalid/u,
        expected.key
      );
    }
  } finally {
    database.close();
  }
});
