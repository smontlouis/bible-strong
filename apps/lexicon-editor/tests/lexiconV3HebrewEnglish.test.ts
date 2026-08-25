import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import {
  assertOpenScripturesSourceDigest,
  assertHebrewEnglishArtifactMatchesSources,
  assertPinnedHebrewEnglishArtifactSummary,
  buildHebrewEnglishArtifact,
  disambiguateExactTipnrEntities,
  OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST,
  parseHebrewEnglishCandidateLine,
  verifyHebrewEnglishCandidate,
  verifyHebrewEnglishArtifact
} from "../src/lexiconV3/hebrewEnglish.js";

test("disambiguates a duplicated exact dStrong only by a unique exact alias", () => {
  const entities = [
    { entityId: 1, nameDisplayName: "father of Gibeon" },
    { entityId: 2, nameDisplayName: "Gibeon" }
  ];

  assert.deepEqual(
    disambiguateExactTipnrEntities("Gibeon", entities).map(
      (entity) => entity.entityId
    ),
    [2]
  );
  assert.deepEqual(
    disambiguateExactTipnrEntities("unmatched", entities).map(
      (entity) => entity.entityId
    ),
    [1, 2]
  );
  assert.equal(
    disambiguateExactTipnrEntities("Abaddon", [
      { entityId: 3, nameDisplayName: "Abaddon" },
      { entityId: 4, nameDisplayName: "Abaddon" }
    ]).length,
    2
  );
});

const PRODUCTION_HEBREW_OPTIONS = {
  lexiconDbPath: "data/dictionaries/strong_lexicon.full.production.sqlite",
  entitiesDbPath: "data/entities/bible_entities.production.sqlite",
  hebrewStrongPath:
    "data/external/openscriptures-hebrew-lexicon/HebrewStrong.xml",
  augIndexPath: "data/external/openscriptures-hebrew-lexicon/AugIndex.xml",
  lexicalIndexPath:
    "data/external/openscriptures-hebrew-lexicon/LexicalIndex.xml",
  brownDriverBriggsPath:
    "data/external/openscriptures-hebrew-lexicon/BrownDriverBriggs.xml"
} as const;

test("builds free Hebrew English candidates without reading STEP meaning", () => {
  const fixture = createFixture();
  try {
    const first = buildHebrewEnglishArtifact(fixture.options);
    const database = new DatabaseSync(fixture.lexiconDb);
    database.exec(
      "UPDATE StepEntries SET meaning = '<b>restricted replacement that must never be read</b>'"
    );
    database.close();
    const second = buildHebrewEnglishArtifact(fixture.options);

    assert.deepEqual(second.records, first.records);
    assert.deepEqual(second.summary, first.summary);
    assert.equal(second.jsonl, first.jsonl);
    assert.doesNotMatch(first.jsonl, /forbidden TBESH/i);
    assert.doesNotMatch(first.jsonl, /restricted replacement/i);

    const lexical = byKey(first, "hebrew:H0001G");
    assert.equal(lexical.method, "hebrew-strong-substep-anchor");
    assert.equal(lexical.status, "review_needed");
    assert.equal(lexical.fieldAssessments.gloss.status, "review_needed");
    assert.ok(
      lexical.fieldAssessments.gloss.issueCodes.includes(
        "hebrew-open-gloss-support-missing"
      )
    );
    assert.ok(
      lexical.issues.includes("step-subsense-specificity-review-required")
    );
    assert.equal(lexical.mapping.classicalStrong, "H1");
    assert.deepEqual(lexical.mapping.lexicalIndexIds, ["aac"]);
    assert.match(lexical.english.meaningHtml, /primitive word/);
    assert.match(lexical.english.meaningHtml, /STEP sense/);
    assert.doesNotMatch(lexical.english.meaningHtml, /<script>/i);
    assert.match(lexical.english.meaningHtml, /&lt;script&gt;/);

    const relation = byKey(first, "hebrew:H0047H");
    assert.equal(relation.status, "review_needed");
    assert.ok(
      relation.issues.includes("step-subsense-specificity-review-required")
    );
    const component = byKey(first, "hebrew:H0001H");
    assert.equal(component.method, "tipnr-exact-dstrong");
    assert.equal(component.status, "review_needed");
    assert.equal(component.fieldAssessments.gloss.status, "review_needed");
    assert.ok(
      component.fieldAssessments.gloss.issueCodes.includes(
        "tipnr-gloss-non-proper-link-not-lexical-definition"
      )
    );
    assert.ok(
      component.issues.includes(
        "tipnr-non-proper-entity-link-not-lexical-definition"
      )
    );
    assert.match(component.english.meaningHtml, /Huram\/-abi/u);
    const ambiguous = byKey(first, "hebrew:H0011");
    assert.equal(ambiguous.status, "source_issue");
    assert.equal(ambiguous.fieldAssessments.gloss.status, "source_issue");
    assert.equal(ambiguous.english.meaningHtml, "");
    assert.ok(ambiguous.issues.includes("tipnr-exact-dstrong-ambiguous"));
    const augmentedA = byKey(first, "hebrew:H0122A");
    const augmentedB = byKey(first, "hebrew:H0122B");
    assert.equal(augmentedA.method, "open-scriptures-augmented-exact");
    assert.equal(augmentedB.method, "open-scriptures-augmented-exact");
    assert.equal(augmentedA.status, "validated");
    assert.equal(augmentedB.status, "validated");
    assert.equal(augmentedA.fieldAssessments.gloss.status, "validated");
    assert.equal(
      augmentedA.fieldAssessments.gloss.method,
      "open-scriptures-lexical-definition"
    );
    assert.equal(augmentedB.fieldAssessments.gloss.status, "review_needed");
    assert.ok(
      augmentedB.fieldAssessments.gloss.issueCodes.includes(
        "step-gloss-open-definition-mismatch"
      )
    );
    const augmentedBdb = byKey(first, "hebrew:H0122C");
    assert.equal(augmentedBdb.fieldAssessments.gloss.status, "validated");
    assert.equal(
      augmentedBdb.fieldAssessments.gloss.method,
      "open-scriptures-bdb-definition"
    );
    assert.deepEqual(augmentedA.mapping.lexicalIndexIds, ["afc"]);
    assert.deepEqual(augmentedB.mapping.lexicalIndexIds, ["aez"]);
    assert.deepEqual(augmentedA.mapping.sourceIdentity.augmentedLexical, {
      augmentedStrong: "H122a",
      lexicalIndexId: "afc",
      mappingUnique: true,
      originalFormExact: true,
      partOfSpeechExact: true
    });
    assert.match(augmentedA.english.meaningHtml, /definition:<\/strong> red/i);
    assert.match(augmentedB.english.meaningHtml, /definition:<\/strong> rosy/i);
    const transitive = byKey(first, "hebrew:H0153");
    assert.equal(transitive.status, "validated");
    assert.deepEqual(transitive.mapping.relationPath, [
      "H153",
      "H1872",
      "H2220"
    ]);
    assert.deepEqual(transitive.mapping.relationPaths, [
      ["H153", "H1872", "H2220"]
    ]);
    assert.match(transitive.english.meaningHtml, /H153 → H1872 → H2220/u);
    assert.deepEqual(
      transitive.provenance
        .filter((item) => item.source === "OpenScriptures-HebrewStrong")
        .map((item) => item.recordId)
        .sort(),
      ["H153", "H1872", "H2220"]
    );
    const conflict = byKey(first, "hebrew:H0431");
    assert.equal(conflict.status, "source_issue");
    assert.ok(conflict.issues.includes("step-open-source-relation-conflict"));
    const mixedPath = byKey(first, "hebrew:H0321");
    assert.equal(mixedPath.status, "validated");
    assert.deepEqual(mixedPath.mapping.relationPath, ["H321", "H317", "H312"]);
    assert.deepEqual(mixedPath.mapping.relationPaths, [
      ["H321", "H317", "H312"]
    ]);
    assert.ok(
      mixedPath.provenance.some(
        (item) =>
          item.source === "STEP-relation-graph" && item.recordId === "11"
      )
    );
    const repairedEntityType = byKey(first, "hebrew:H0381");
    assert.equal(repairedEntityType.status, "review_needed");
    assert.equal(
      repairedEntityType.fieldAssessments.gloss.status,
      "review_needed"
    );
    assert.ok(
      repairedEntityType.fieldAssessments.gloss.issueCodes.includes(
        "step-gloss-open-definition-mismatch"
      )
    );
    assert.equal(
      repairedEntityType.fieldAssessments.meaning.status,
      "review_needed"
    );
    assert.equal(repairedEntityType.method, "open-scriptures-lexical-exact");
    assert.ok(
      repairedEntityType.issues.includes("step-open-source-relation-unverified")
    );
    assert.deepEqual(repairedEntityType.mapping.relationPath, []);
    assert.match(repairedEntityType.english.meaningHtml, /valiant man/i);
    assert.doesNotMatch(repairedEntityType.english.meaningHtml, /Ishchail/i);
    const incompleteCombination = byKey(first, "hebrew:H0383");
    assert.equal(incompleteCombination.status, "review_needed");
    assert.ok(
      incompleteCombination.issues.includes(
        "step-open-source-relation-unverified"
      )
    );
    assert.deepEqual(incompleteCombination.mapping.relationPath, []);
    assert.deepEqual(incompleteCombination.mapping.relationPaths, []);
    const branchedCombination = byKey(first, "hebrew:H4078");
    assert.equal(branchedCombination.status, "validated");
    assert.deepEqual(branchedCombination.mapping.relationPath, []);
    assert.deepEqual(branchedCombination.mapping.relationPaths, [
      ["H4078", "H1767"],
      ["H4078", "H4100"]
    ]);
    assert.match(
      branchedCombination.english.meaningHtml,
      /H4078 → H1767; H4078 → H4100/u
    );
    assert.doesNotMatch(
      branchedCombination.english.meaningHtml,
      /H4078 → H1767 → H4100/u
    );
    assert.deepEqual(
      branchedCombination.provenance
        .filter((item) => item.source === "OpenScriptures-HebrewStrong")
        .map((item) => item.recordId)
        .sort(),
      ["H1767", "H4078", "H4100"]
    );
    const broadAramaicRelation = byKey(first, "hebrew:H0384");
    assert.equal(broadAramaicRelation.status, "review_needed");
    assert.ok(
      broadAramaicRelation.issues.includes(
        "step-open-source-relation-unverified"
      )
    );
    assert.ok(
      !broadAramaicRelation.issues.includes(
        "step-open-source-relation-conflict"
      )
    );
    const exactSpelling = byKey(first, "hebrew:H0862A");
    assert.equal(exactSpelling.status, "validated");
    assert.ok(
      !exactSpelling.issues.includes("step-open-source-relation-unverified")
    );
    assert.deepEqual(exactSpelling.mapping.relationPaths, [["H862A", "H862B"]]);
    assert.ok(
      exactSpelling.provenance.some(
        (item) =>
          item.source === "OpenScriptures-LexicalIndex" &&
          item.recordId === "bid"
      )
    );

    const exactAramaic = byKey(first, "hebrew:H0744");
    assert.equal(exactAramaic.status, "validated");
    assert.deepEqual(exactAramaic.mapping.relationPaths, [["H744", "H738B"]]);

    const orderedCombination = byKey(first, "hebrew:H0834B");
    assert.equal(orderedCombination.status, "validated");
    assert.deepEqual(orderedCombination.mapping.relationPaths, [
      ["H834B", "H9003"],
      ["H834B", "H834A"]
    ]);
    assert.match(
      orderedCombination.english.meaningHtml,
      /H834B → H9003; H834B → H834A/u
    );
    const orderedTechnicalCombination = byKey(first, "hebrew:H7945");
    assert.equal(orderedTechnicalCombination.status, "validated");
    assert.deepEqual(orderedTechnicalCombination.mapping.relationPaths, [
      ["H7945", "H9007"],
      ["H7945", "H9005"]
    ]);

    for (const key of [
      "hebrew:H0745",
      "hebrew:H0834C",
      "hebrew:H8501",
      "hebrew:H8568"
    ]) {
      const mismatch = byKey(first, key);
      assert.equal(mismatch.status, "review_needed");
      assert.ok(mismatch.issues.includes("step-gloss-open-source-mismatch"));
      assert.ok(
        !mismatch.issues.includes("step-open-source-relation-unverified")
      );
    }
    assert.deepEqual(byKey(first, "hebrew:H0834C").mapping.relationPaths, [
      ["H834C", "H9006"],
      ["H834C", "H834A"]
    ]);

    for (const key of [
      "hebrew:H9003",
      "hebrew:H9005",
      "hebrew:H9006",
      "hebrew:H9007"
    ]) {
      const technical = byKey(first, key);
      assert.equal(technical.status, "source_issue");
      assert.equal(technical.fieldAssessments.gloss.status, "source_issue");
      assert.equal(technical.english.meaningHtml, "");
      assert.ok(
        technical.issues.includes("technical-morpheme-no-lexical-content")
      );
      assert.ok(
        !technical.issues.includes("step-subsense-specificity-review-required")
      );
      assert.ok(
        !technical.issues.includes("step-relation-or-subsense-review-required")
      );
    }
    const wrongEntityType = byKey(first, "hebrew:H0382");
    assert.equal(wrongEntityType.status, "source_issue");
    assert.ok(
      wrongEntityType.issues.includes(
        "strong-proper-name-common-lexeme-mismatch"
      )
    );
    const underscoreSuffix = byKey(first, "hebrew:H0600_b");
    assert.equal(underscoreSuffix.entryKey, "hebrew:H0600_b");
    assert.ok(
      underscoreSuffix.issues.includes(
        "step-subsense-specificity-review-required"
      )
    );
    const underscoreLeakProbe = byKey(first, "hebrew:H0500");
    assert.equal(underscoreLeakProbe.status, "review_needed");
    assert.deepEqual(underscoreLeakProbe.mapping.relationPaths, []);
    assert.ok(
      underscoreLeakProbe.issues.includes(
        "step-open-source-relation-unverified"
      )
    );
    verifyHebrewEnglishArtifact(first.jsonl, first.summary);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("TIPNR joins are exact and preserve case-sensitive sub-STEP identities", () => {
  const fixture = createFixture();
  try {
    const artifact = buildHebrewEnglishArtifact(fixture.options);
    const upper = byKey(artifact, "hebrew:H2148V");
    const lower = byKey(artifact, "hebrew:H2148v");

    assert.notEqual(upper.entryKey, lower.entryKey);
    assert.equal(upper.method, "tipnr-exact-dstrong");
    assert.equal(lower.method, "tipnr-exact-dstrong");
    assert.equal(upper.status, "validated");
    assert.equal(lower.status, "validated");
    assert.equal(upper.fieldAssessments.gloss.status, "validated");
    assert.equal(lower.fieldAssessments.gloss.status, "validated");
    assert.equal(upper.fieldAssessments.gloss.method, "tipnr-exact-alias");
    assert.deepEqual(upper.mapping.tipnrEntityIds, [101]);
    assert.deepEqual(lower.mapping.tipnrEntityIds, [102]);
    assert.deepEqual(upper.mapping.sourceIdentity.tipnr, {
      entityId: 101,
      entityUnique: true
    });
    assert.match(upper.english.meaningHtml, /descendant of Perez/i);
    assert.match(lower.english.meaningHtml, /post-exilic prophet/i);
    assert.doesNotMatch(upper.english.meaningHtml, /post-exilic prophet/i);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("rejects falsified record and pinned-source digests", () => {
  const fixture = createFixture();
  try {
    const artifact = buildHebrewEnglishArtifact(fixture.options);
    const original = artifact.records[0]!;
    const falsified = {
      ...original,
      english: { ...original.english, gloss: "falsified" }
    };
    assert.throws(
      () => verifyHebrewEnglishCandidate(falsified),
      /record-digest-mismatch/
    );
    assert.throws(
      () => parseHebrewEnglishCandidateLine(JSON.stringify(falsified)),
      /record-digest-mismatch/
    );
    assert.throws(
      () => assertOpenScripturesSourceDigest("HebrewStrong.xml", "tampered"),
      /source-digest-mismatch/
    );
    const pinnedSummary = structuredClone(artifact.summary);
    pinnedSummary.openScripturesRevision =
      OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.revision;
    Object.assign(
      pinnedSummary.sourceDigests,
      OPEN_SCRIPTURES_HEBREW_ARTIFACT_MANIFEST.sourceDigests
    );
    assert.doesNotThrow(() =>
      assertPinnedHebrewEnglishArtifactSummary(pinnedSummary)
    );
    for (const source of [
      "lexiconAllowedColumns",
      "tipnrAllowedColumns",
      "tipnrEntityRefs"
    ] as const) {
      const changed = structuredClone(pinnedSummary);
      changed.sourceDigests[source] = "0".repeat(64);
      assert.throws(
        () => assertPinnedHebrewEnglishArtifactSummary(changed),
        new RegExp(`unpinned-source-digest:${source}`)
      );
    }
    const changedTipnrSource = structuredClone(pinnedSummary);
    changedTipnrSource.sourceDigests.tipnrSourceFiles["TIPNR.txt"] = "0".repeat(
      64
    );
    assert.throws(
      () => assertPinnedHebrewEnglishArtifactSummary(changedTipnrSource),
      /unpinned-source-digest:tipnrSourceFiles/
    );
    assert.throws(
      () =>
        verifyHebrewEnglishCandidate({
          ...original,
          fieldAssessments: undefined
        } as never),
      /field-assessment-missing/
    );
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
});

test(
  "rejects a self-consistent forged artifact against the exact source rebuild",
  {
    skip: !Object.values(PRODUCTION_HEBREW_OPTIONS).every((path) =>
      existsSync(path)
    )
  },
  () => {
    const artifact = buildHebrewEnglishArtifact(PRODUCTION_HEBREW_OPTIONS);
    const records = structuredClone(artifact.records);
    const forged = records[0]!;
    forged.english.gloss = "self-consistent forged gloss";
    const payload = { ...forged } as Partial<typeof forged>;
    delete payload.recordDigest;
    forged.recordDigest = testSha256(testCanonicalJson(payload));
    const jsonl = `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
    const summary = structuredClone(artifact.summary);
    summary.recordsDigest = testSha256(
      testCanonicalJson(records.map((record) => record.recordDigest))
    );
    summary.outputDigest = testSha256(jsonl);

    assert.doesNotThrow(() => verifyHebrewEnglishArtifact(jsonl, summary));
    assert.throws(
      () =>
        assertHebrewEnglishArtifactMatchesSources(
          { records, jsonl, summary },
          PRODUCTION_HEBREW_OPTIONS
        ),
      /artifact-source-rebuild-mismatch/u
    );
  }
);

function testSha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function testCanonicalJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(testCanonicalJson).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${testCanonicalJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function byKey(
  artifact: ReturnType<typeof buildHebrewEnglishArtifact>,
  entryKey: string
) {
  const record = artifact.records.find((item) => item.entryKey === entryKey);
  assert.ok(record, `missing ${entryKey}`);
  return record;
}

function createFixture() {
  const root = mkdtempSync(join(tmpdir(), "lexicon-v3-hebrew-english-"));
  const lexiconDb = join(root, "lexicon.sqlite");
  const entitiesDb = join(root, "entities.sqlite");
  const hebrewStrongPath = join(root, "HebrewStrong.xml");
  const lexicalIndexPath = join(root, "LexicalIndex.xml");
  const brownDriverBriggsPath = join(root, "BrownDriverBriggs.xml");
  const augIndexPath = join(root, "AugIndex.xml");

  const lexicon = new DatabaseSync(lexiconDb);
  lexicon.exec(`
    CREATE TABLE StepEntries (
      id INTEGER PRIMARY KEY,
      language TEXT NOT NULL,
      baseCode INTEGER NOT NULL,
      eStrong TEXT NOT NULL,
      dStrong TEXT NOT NULL,
      uStrong TEXT NOT NULL,
      original TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      morph TEXT NOT NULL,
      gloss TEXT NOT NULL,
      meaning TEXT NOT NULL
    );
  `);
  const insertStep = lexicon.prepare(`
    INSERT INTO StepEntries
      (id, language, baseCode, eStrong, dStrong, uStrong, original,
       transliteration, morph, gloss, meaning)
    VALUES (?, 'hebrew', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  insertStep.run(
    1,
    1,
    "H0001",
    "H0001G =",
    "H0001G",
    "אָב",
    "ab",
    "H:N-M",
    "father <script>alert(1)</script>",
    "forbidden TBESH meaning one"
  );
  insertStep.run(
    2,
    47,
    "H0047",
    "H0047H = a Meaning of",
    "H0047G",
    "אַבִּיר",
    "abbir",
    "H:A-M",
    "mighty: stallion",
    "forbidden TBESH meaning two"
  );
  insertStep.run(
    3,
    2148,
    "H2148a",
    "H2148V =",
    "H2148V",
    "זְכַרְיָהוּ",
    "Zekaryahu",
    "N:N-M-P",
    "Zechariah",
    "forbidden TBESH meaning three"
  );
  insertStep.run(
    4,
    2148,
    "H2148a",
    "H2148v =",
    "H2148v",
    "זְכַרְיָהוּ",
    "Zekaryahu",
    "N:N-M-P",
    "Zechariah",
    "forbidden TBESH meaning four"
  );
  insertStep.run(
    5,
    1,
    "H0001",
    "H0001H = a Part of",
    "H2438H",
    "אָב",
    "ab",
    "H:N-M",
    "(Huram)-abi",
    "forbidden TBESH meaning five"
  );
  insertStep.run(
    6,
    11,
    "H0011",
    "H0011 =",
    "H0011",
    "אֲבַדּוֹן",
    "abaddon",
    "N:N-M-P",
    "Abaddon",
    "forbidden TBESH meaning six"
  );
  insertStep.run(
    7,
    122,
    "H0122a",
    "H0122A =",
    "H0122A",
    "אָדֹם",
    "a.dom",
    "H:A",
    "red",
    "forbidden TBESH meaning seven"
  );
  insertStep.run(
    8,
    122,
    "H0122b",
    "H0122B =",
    "H0122B",
    "אֱדֹם",
    "e.dom",
    "H:N-M",
    "red stuff",
    "forbidden TBESH meaning eight"
  );
  insertStep.run(
    9,
    153,
    "H0153",
    "H0153 = in Aramaic of",
    "H2220",
    "אֶדְרָע",
    "edra",
    "A:N-F",
    "force",
    "forbidden TBESH meaning nine"
  );
  insertStep.run(
    10,
    431,
    "H0431",
    "H0431 = in Aramaic of",
    "H0480",
    "אֲלוּ",
    "alu",
    "A:Intj",
    "behold",
    "forbidden TBESH meaning ten"
  );
  insertStep.run(
    11,
    317,
    "H0317",
    "H0317 = in Aramaic of",
    "H0312",
    "אָחֳרָן",
    "ochoran",
    "A:A",
    "another",
    "forbidden TBESH meaning eleven"
  );
  insertStep.run(
    12,
    321,
    "H0321",
    "H0321 = in Aramaic of",
    "H0312",
    "אָחֳרֵין",
    "ochoreyn",
    "A:A",
    "another",
    "forbidden TBESH meaning twelve"
  );
  insertStep.run(
    13,
    381,
    "H0381",
    "H0381 = combination of",
    "H0376G, H2428G",
    "אִישׁ־חַיִל",
    "ish-chayil",
    "H:N-M",
    "hero",
    "forbidden TBESH meaning thirteen"
  );
  insertStep.run(
    14,
    382,
    "H0382",
    "H0382 =",
    "H0382",
    "אִישׁ־טוֹב",
    "ish-tob",
    "H:N-M",
    "good man",
    "forbidden TBESH meaning fourteen"
  );
  insertStep.run(
    15,
    383,
    "H0383",
    "H0383 = combination of",
    "H0376, H2428",
    "חַיִל",
    "chayil",
    "H:N-M",
    "combined strength",
    "forbidden TBESH meaning fifteen"
  );
  insertStep.run(
    16,
    384,
    "H0384",
    "H0384 = in Aramaic of",
    "H0385G",
    "אִישׁ",
    "ish",
    "A:N-M",
    "man",
    "forbidden TBESH meaning sixteen"
  );
  insertStep.run(
    17,
    4078,
    "H4078",
    "H4078 = combination of",
    "H1767 (H4100+H1767)",
    "מַדַּי",
    "madday",
    "H:N",
    "sufficiency",
    "forbidden TBESH meaning seventeen"
  );
  insertStep.run(
    18,
    376,
    "H0376",
    "H0376G =",
    "H0376G",
    "אִישׁ",
    "ish",
    "H:N-M",
    "man",
    "forbidden component root"
  );
  insertStep.run(
    19,
    376,
    "H0376",
    "H0376H = a Meaning of",
    "H0376G",
    "אִישׁ",
    "ish",
    "H:N-M",
    "man: husband",
    "forbidden component sibling"
  );
  insertStep.run(
    20,
    2428,
    "H2428",
    "H2428G =",
    "H2428G",
    "חַיִל",
    "chayil",
    "H:N-M",
    "strength",
    "forbidden component root"
  );
  insertStep.run(
    21,
    2428,
    "H2428",
    "H2428H = a Meaning of",
    "H2428G",
    "חַיִל",
    "chayil",
    "H:N-M",
    "strength: rich",
    "forbidden component sibling"
  );
  insertStep.run(
    22,
    862,
    "H0862a",
    "H0862A = a Spelling of",
    "H0862B",
    "אַתּוּק",
    "attuq",
    "H:N-M",
    "gallery",
    "forbidden exact spelling source"
  );
  insertStep.run(
    23,
    862,
    "H0862b",
    "H0862B =",
    "H0862B",
    "אַתִּיק",
    "attiq",
    "H:N-M",
    "gallery",
    "forbidden exact spelling target"
  );
  insertStep.run(
    24,
    738,
    "H0738b",
    "H0738B =",
    "H0738B",
    "אַרְיֵה",
    "aryeh",
    "H:N-M",
    "lion",
    "forbidden exact Hebrew target"
  );
  insertStep.run(
    25,
    744,
    "H0744",
    "H0744 = in Aramaic of",
    "H0738B",
    "אַרְיֵה",
    "aryeh",
    "A:N-M",
    "lion",
    "forbidden exact Aramaic source"
  );
  insertStep.run(
    26,
    834,
    "H0834a",
    "H0834A =",
    "H0834A",
    "אֲשֶׁר",
    "asher",
    "H:RelP",
    "which",
    "forbidden exact relative target"
  );
  insertStep.run(
    27,
    834,
    "H0834b",
    "H0834B = combination of",
    "H0834A (H9003+H0834A)",
    "בַאֲשֶׁר",
    "baasher",
    "H:Prep+H:RelP",
    "in which",
    "forbidden exact combination source"
  );
  insertStep.run(
    28,
    9003,
    "H9003",
    "H9003 =",
    "H9003",
    "/ב",
    "b",
    "Prefix",
    "in/on/with",
    "forbidden technical morpheme"
  );
  insertStep.run(
    29,
    9005,
    "H9005",
    "H9005 =",
    "H9005",
    "/ל",
    "l",
    "Prefix",
    "to/for",
    "forbidden technical morpheme"
  );
  insertStep.run(
    30,
    9007,
    "H9007",
    "H9007 =",
    "H9007",
    "/שׁ",
    "s",
    "Prefix",
    "which/that",
    "forbidden technical morpheme"
  );
  insertStep.run(
    31,
    7945,
    "H7945",
    "H7945 = combination of",
    "H9007 (H9007+H9005)",
    "שֶׁל",
    "shel",
    "H:RelP",
    "which",
    "forbidden technical combination source"
  );
  insertStep.run(
    32,
    8496,
    "H8496",
    "H8496 =",
    "H8496",
    "תֹּךְ",
    "tokh",
    "H:N-M",
    "oppression",
    "forbidden mismatch target"
  );
  insertStep.run(
    33,
    8501,
    "H8501",
    "H8501 = a Spelling of",
    "H8496",
    "תָּכָךְ",
    "takhakh",
    "H:N-M",
    "deceitful",
    "forbidden mismatch source"
  );
  insertStep.run(
    34,
    8568,
    "H8568",
    "H8568 = a Spelling of",
    "H8577A",
    "תַּנָּה",
    "tannah",
    "H:N-M",
    "dragon",
    "forbidden mismatch source"
  );
  insertStep.run(
    35,
    8577,
    "H8577a",
    "H8577A =",
    "H8577A",
    "תַּן",
    "tan",
    "H:N-M",
    "jackal",
    "forbidden mismatch target"
  );
  insertStep.run(
    36,
    745,
    "H0745",
    "H0745 = in Aramaic of",
    "H0738B",
    "אַרְיֵה",
    "aryeh",
    "A:N-M",
    "tiger",
    "forbidden mismatched Aramaic gloss"
  );
  insertStep.run(
    37,
    834,
    "H0834c",
    "H0834C = combination of",
    "H0834A (H9006+H0834A)",
    "מֵאֲשֶׁר",
    "measher",
    "H:Prep+H:RelP",
    "whence",
    "forbidden mismatched combination gloss"
  );
  insertStep.run(
    38,
    9006,
    "H9006",
    "H9006 =",
    "H9006",
    "/מ",
    "m",
    "Prefix",
    "from",
    "forbidden technical morpheme"
  );
  insertStep.run(
    39,
    600,
    "H0600",
    "H0600_b = a Meaning of",
    "H0700",
    "אָב",
    "underscore-suffix",
    "H:N-M",
    "underscore sense",
    "forbidden underscore suffix"
  );
  insertStep.run(
    40,
    500,
    "H0500",
    "H0500 = a Meaning of",
    "H0700",
    "אָב",
    "underscore-leak-probe",
    "H:N-M",
    "probe",
    "forbidden underscore leak probe"
  );
  insertStep.run(
    41,
    122,
    "H0122c",
    "H0122C =",
    "H0122C",
    "אָדֹם",
    "a.dom-c",
    "H:N-M",
    "red stuff",
    "forbidden exact BDB definition"
  );
  lexicon.close();

  const entities = new DatabaseSync(entitiesDb);
  entities.exec(`
    CREATE TABLE Entities (
      id INTEGER PRIMARY KEY,
      displayName TEXT NOT NULL,
      brief TEXT NOT NULL,
      shortDescription TEXT NOT NULL
    );
    CREATE TABLE EntityNames (
      entityId INTEGER NOT NULL,
      dStrong TEXT NOT NULL,
      displayName TEXT NOT NULL
    );
    CREATE TABLE EntityRefs (
      entityId INTEGER NOT NULL,
      book TEXT NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      suffix TEXT NOT NULL,
      refText TEXT NOT NULL
    );
    CREATE TABLE EntityMeta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    INSERT INTO EntityMeta VALUES
      ('sourceDigests',
       '{"TIPNR.txt":"${"1".repeat(64)}","tipnr-json/people.json":"${"2".repeat(64)}","tipnr-json/places.json":"${"3".repeat(64)}"}');
    INSERT INTO Entities VALUES
      (101, 'Zechariah', 'Descendant of Perez',
       'Zechariah was a descendant of Perez who lived in Jerusalem.'),
      (102, 'Zechariah', 'Post-exilic prophet',
       'Zechariah was the post-exilic prophet who wrote the book bearing his name.'),
      (103, 'Hiram', 'A craftsman from Tyre',
       'Hiram was commissioned for the temple furnishings.'),
      (104, 'Abaddon place', 'Realm of destruction',
       'A Hebrew term for the realm of destruction.'),
      (105, 'Abaddon angel', 'Angel of the abyss',
       'The angel associated with the abyss.');
    INSERT INTO EntityNames VALUES
      (101, 'H2148V', 'Zechariah'),
      (102, 'H2148v', 'Zechariah'),
      (103, 'H0001H', 'Huram/-abi'),
      (104, 'H0011', 'Abaddon'),
      (105, 'H0011', 'Abaddon');
  `);
  entities.close();

  writeFileSync(
    hebrewStrongPath,
    `<?xml version="1.0"?>
     <lexicon>
       <entry id="H1"><source>a primitive word;</source><meaning>a <def>father</def> &lt;danger&gt;</meaning><usage>father, chief.</usage></entry>
       <entry id="H47"><source>from H46;</source><meaning><def>mighty</def></meaning><usage>angel, bull, strong.</usage></entry>
       <entry id="H122"><source>from H119;</source><meaning><def>rosy</def></meaning><usage>red.</usage></entry>
       <entry id="H153"><source>an orthographical variation for <w src="H1872">1872</w>;</source><meaning><def>arm</def>, figuratively power</meaning><usage>force.</usage></entry>
       <entry id="H1872"><source>corresponding to <w src="H2220">2220</w>;</source><meaning><def>arm</def></meaning><usage>arm.</usage></entry>
       <entry id="H2220"><source>from H2232;</source><meaning><def>arm</def>, figuratively force</meaning><usage>arm, strength.</usage></entry>
       <entry id="H431"><source>probably prolonged from <w src="H412">412</w>;</source><meaning><def>lo!</def></meaning><usage>behold.</usage></entry>
       <entry id="H412"><source>corresponding to H411;</source><meaning><def>these</def></meaning><usage>these.</usage></entry>
       <entry id="H317"><source>of uncertain origin;</source><meaning><def>another</def></meaning><usage>other.</usage></entry>
       <entry id="H321"><source>the same as <w src="H317">317</w>;</source><meaning><def>another</def></meaning><usage>other.</usage></entry>
       <entry id="H312"><source>a primitive word;</source><meaning><def>another</def></meaning><usage>other.</usage></entry>
       <entry id="H381"><w pos="n-m" xml:lang="x-pn">אִישׁ־חַיִל</w><source>from <w src="H376">376</w> and <w src="H2428">2428</w>;</source><meaning><def>Ishchail</def>, an Israelite</meaning><usage>a valiant man.</usage></entry>
       <entry id="H382"><w pos="n-m" xml:lang="x-pn">אִישׁ־טוֹב</w><source>from H376 and H2896;</source><meaning><def>Ish-tob</def>, a person</meaning><usage>Ish-tob.</usage></entry>
       <entry id="H383"><source>from H2428;</source><meaning><def>combined strength</def></meaning><usage>strength.</usage></entry>
       <entry id="H384"><source>corresponding to H385;</source><meaning><def>man</def></meaning><usage>man.</usage></entry>
       <entry id="H385"><source>a primitive word;</source><meaning><def>man</def></meaning><usage>man.</usage></entry>
       <entry id="H744"><w pos="n-m" xml:lang="arc">אַרְיֵה</w><source>(Aramaic) corresponding to <w src="H738">738</w></source><meaning><def>lion</def></meaning><usage>lion.</usage></entry>
       <entry id="H745"><w pos="n-m" xml:lang="arc">אַרְיֵה</w><source>(Aramaic) corresponding to <w src="H738">738</w></source><meaning><def>lion</def></meaning><usage>lion.</usage></entry>
       <entry id="H1767"><source>of uncertain derivation;</source><meaning><def>enough</def></meaning><usage>sufficiently.</usage></entry>
       <entry id="H4078"><source>from <w src="H4100">4100</w> and <w src="H1767">1767</w>;</source><meaning><def>sufficiently</def></meaning><usage>sufficiently.</usage></entry>
       <entry id="H4100"><source>a primitive particle;</source><meaning><def>what?</def></meaning><usage>what.</usage></entry>
       <entry id="H500"><source>from <w src="H600">600</w>;</source><meaning><def>probe</def></meaning><usage>probe.</usage></entry>
       <entry id="H600"><source>a primitive word;</source><meaning><def>underscore sense</def></meaning><usage>underscore.</usage></entry>
       <entry id="H700"><source>a primitive word;</source><meaning><def>target</def></meaning><usage>target.</usage></entry>
     </lexicon>`
  );
  writeFileSync(
    lexicalIndexPath,
    `<?xml version="1.0"?>
     <index>
       <entry id="aac"><xref bdb="a.ae.ab" strong="1"/></entry>
       <entry id="abc"><xref bdb="a.bb.cc" strong="47"/></entry>
       <entry id="afc"><w xlit="a.dom">אָדֹם</w><pos>A</pos><def>red</def><xref bdb="a.bd.ac" strong="122" aug="a"/></entry>
       <entry id="aez"><w xlit="e.dom">אֱדֹם</w><pos>N</pos><def>rosy</def><xref bdb="a.bd.ae" strong="122" aug="b"/></entry>
       <entry id="afe"><w xlit="a.dom-c">אָדֹם</w><pos>N</pos><def>pigment</def><xref bdb="a.bd.af" strong="122" aug="c"/></entry>
       <entry id="app"><w xlit="ish-chayil">אִישׁ־חַיִל</w><pos>N</pos><def>a valiant man</def><xref bdb="a.da.ab" strong="381"/></entry>
       <entry id="man"><w>אִישׁ</w><pos>N</pos><def>man</def><xref bdb="a.man" strong="376"/></entry>
       <entry id="str"><w>חַיִל</w><pos>N</pos><def>strength</def><xref bdb="a.str" strong="2428"/></entry>
       <entry id="bia"><w>אַתּוּק</w><pos>N</pos><def>gallery</def><xref bdb="a.gallery" strong="862" aug="a"/><etym type="sub">bid</etym></entry>
       <entry id="bid"><w>אַתִּיק</w><pos>N</pos><def>gallery</def><xref bdb="a.gallery" strong="862" aug="b"/></entry>
       <entry id="bdk"><w>אַרְיֵה</w><pos>N</pos><def>lion</def><xref bdb="a.lion" strong="738" aug="b"/></entry>
       <entry id="obt"><w>אַרְיֵה</w><pos>N</pos><def>lion</def><xref bdb="x.lion" strong="744"/></entry>
       <entry id="obu"><w>אַרְיֵה</w><pos>N</pos><def>lion</def><xref bdb="x.lion" strong="745"/></entry>
       <entry id="bgz"><w>אֲשֶׁר</w><pos>Pr</pos><def>which</def><xref bdb="a.which" strong="834" aug="a"/></entry>
       <entry id="bjl"><w>בַאֲשֶׁר</w><pos>R</pos><def>in which</def><xref bdb="a.inwhich" strong="834" aug="b"/></entry>
       <entry id="gjb"><w>מֵאֲשֶׁר</w><pos>R</pos><def>who</def><xref bdb="a.whence" strong="834" aug="c"/></entry>
       <entry id="mur"><w>שֶׁל</w><pos>Pr</pos><def>which</def><xref bdb="a.relative" strong="7945"/></entry>
       <entry id="nrt"><w>תֹּךְ</w><pos>N</pos><def>injury</def><xref bdb="w.injury" strong="8496"/></entry>
       <entry id="nry"><w>תָּכָךְ</w><pos>N</pos><def>injury</def><xref bdb="w.injury" strong="8501"/></entry>
       <entry id="num"><w>תַּנָּה</w><pos>N</pos><def>jackal</def><xref bdb="w.jackal" strong="8568"/></entry>
       <entry id="nul"><w>תַּן</w><pos>N</pos><def>jackal</def><xref bdb="w.jackal" strong="8577" aug="a"/></entry>
     </index>`
  );
  writeFileSync(
    augIndexPath,
    `<?xml version="1.0"?><index>
      <w aug="122a">afc</w><w aug="122b">aez</w><w aug="122c">afe</w>
      <w aug="738b">bdk</w>
      <w aug="834a">bgz</w><w aug="834b">bjl</w><w aug="834c">gjb</w>
      <w aug="862a">bia</w><w aug="862b">bid</w>
      <w aug="8577a">nul</w>
    </index>`
  );
  writeFileSync(
    brownDriverBriggsPath,
    `<?xml version="1.0"?><lexicon>
      <entry id="a.ae.ab"><w>אָב</w> father.</entry>
      <entry id="a.bb.cc"><w>אַבִּיר</w> mighty.</entry>
      <entry id="a.bd.ac"><w>אָדֹם</w> <pos>adj.</pos> red.</entry>
      <entry id="a.bd.ae"><w>אֱדֹם</w> <pos>n.m.</pos> red stuff appears only in prose.</entry>
      <entry id="a.bd.af"><w>אָדֹם</w> <pos>n.m.</pos> <def>red</def>, <def>stuff</def>.</entry>
      <entry id="a.da.ab"><w>אִישׁ־חַיִל</w> a valiant man.</entry>
      <entry id="a.man"><w>אִישׁ</w> man.</entry>
      <entry id="a.str"><w>חַיִל</w> strength.</entry>
      <entry id="a.gallery"><w>אַתִּיק</w> gallery.</entry>
      <entry id="a.lion"><w>אַרְיֵה</w> lion.</entry>
      <entry id="x.lion"><w>אַרְיֵה</w> lion.</entry>
      <entry id="a.which"><w>אֲשֶׁר</w> which.</entry>
      <entry id="a.inwhich"><w>בַאֲשֶׁר</w> in which.</entry>
      <entry id="a.whence"><w>מֵאֲשֶׁר</w> whence.</entry>
      <entry id="a.relative"><w>שֶׁל</w> which.</entry>
      <entry id="w.injury"><w>תֹּךְ</w> injury, oppression.</entry>
      <entry id="w.jackal"><w>תַּן</w> jackal.</entry>
    </lexicon>`
  );

  return {
    root,
    lexiconDb,
    options: {
      lexiconDbPath: lexiconDb,
      entitiesDbPath: entitiesDb,
      hebrewStrongPath,
      augIndexPath,
      lexicalIndexPath,
      brownDriverBriggsPath,
      openScripturesRevision: "fixture",
      verifyPinnedSources: false
    }
  };
}
