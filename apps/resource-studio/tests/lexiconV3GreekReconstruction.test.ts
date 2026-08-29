import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  GREEK_RECONSTRUCTION_REGISTRY_DIGEST,
  GREEK_RECONSTRUCTION_RULES,
  PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G0001H_PERSEUS_ARTIFACT_PATH,
  PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST,
  PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_PATH,
  PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST,
  PINNED_G0567_FORM_ALIAS,
  PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA,
  applyProvenGreekReconstruction,
  digestGreekReconstructionOutput,
  digestGreekReconstructionRegistry,
  digestGreekReconstructionSourceRecord,
  getGreekReconstructionRule,
  proveGreekReconstruction,
  verifyGreekReconstructionRegistry,
  verifyPinnedG0001HPerseusArtifact,
  verifyPinnedG20464InternalAdjudicationArtifact,
  type GreekReconstructionProofInput,
  type GreekReconstructionRule
} from "../src/lexiconV3/greekReconstruction.js";

const EXPECTED_RULE_DIGESTS = {
  G0001H: "c15cb7ae521d8483dc90adca168a572bb4d0b32334788107824a3bcbb29f83aa",
  G0567: "a1fb3b62d48ef2090d035330036b73830672912d4f4421073c9a4cf1873f000e",
  G1489: "baf6e1741a88d815271d4ed7b4c019c5c2ea7fe9d74cda5db9139b6a682db769",
  G1490: "3880f18fe45032596fd70dfc69f50eb32e9154200f48bdbf0670069ec1d39284",
  G1503: "5e06ac44900d5465848727e6bfbb8e668f12f88a9ec12bbb029f35208e8ae2b1",
  G1507: "2a5f288f309076a64b9b594d8d5c317be3f22c489c23afe5f5d8b43871049688",
  G1970: "2e361abdc34c845e7a1bb34f2bb3c4b307f1942a45732eb94b2d9862a9b3db05",
  G2199H: "ea2584847b21eea5d28257715df249d887366c684970754574857e67a68d83a9",
  G2424K: "72a8333ffa87c08d024f6f35180eca657f9fafe7fd54cf8c2f924237216639d4",
  G2501O: "bfde028ffad8a2da7ed9d493c962fd5b3db68911a472f30b6269e29e55fea07a",
  G4245G: "516c8804fba99a3d77fa16ab5f949ec92472b75906974d8727b095b41ec9fd83",
  G5441: "7d1bacab5c7ac19b492734f5ecf2460bb7c5176072f123dbf5c8bf5bcf73eaff",
  G6087: "ec374561593b9c56bac26ec8a44aff04c4173e4c531176605f0d6f383365e6d9",
  G6243: "5b4024e9c5d3e54043cc4b49d9c08cce20de320a1b9df337a62ad17d41e522f5",
  G8216: "4b8ba3d9d320e183995f412e7466499bc83d9d738fc78bad81c97d0c1bd654de",
  G20014: "29687ba0f7f38a6e88c4e80aed90331ed0d1657fc6abd77425f7ca1b5ff02110",
  G20128: "804003ed02828194ee5b21886af61f0a6c6680b2de2cd184faf2bba73ebd81b4",
  G20209: "0102283c746e00d72c3e7c785ab8e229c3a0397d85e28efcc8221c1bc47dc84b",
  G20278: "12418231b9560ad3df05782ae243d6bcaf31aaf0ba5787cb18d8647eaf060d99",
  G20394: "a0babc11ad594adfd4bbcdf2720c9aebf2a1a1c57a09cb7d296c04c4bc3ff491",
  G20464: "c32cbec6dc1639b769ecd07a3f761dccb42a91e603fa4171c7f3af6fe88718a5",
  G20467: "d402de6eb54bea2816b406c8ceac7b47fa798da87d1c320ad59c11fbc400c955",
  G20490: "178651e515148791bf413780f87081c6bd38451b5287e6de32aa406d5db211f5",
  G20583: "98d0faee3bdebb98f51a3ab2c89281399ba5271679ee589e32e25ec4e28e1941",
  G20654: "bae53f5e5f2bb2b61fcb584cfc5de63b669758b9fa537fe13c13aa14b98dee8b",
  G20665: "9c2d28a1f3475c2a186fc2020462689fe1b1b82fd4adb084bbdef268fb2b6375",
  G20765: "1daeefcc97bc052d146243d8e5c757425f92c6df8f42207e76cbb0e1d4731405",
  G20937: "eacd7da4687e20c0026013e4201c6790fe523a8c13cdb735e3d56d4aba61b1f5",
  G21057: "d595bc2b56605848cf3bb561bea52211fdedb0d14e426d0ea8dc91ff7d051e40",
  G21118: "daf10b769a0ada7357bf26def3b190c73b970e7344c7c1f9bbe9d01015baa719",
  G21241: "311e87a7bdc2d9e7159cc5cb4b8efe39c7ee41e9be85f5eb11402b792daae557",
  G21273: "f75eba3ab207c8e9e21b0c46422438b3311343bc2a9d13e0d4efec2feb889148"
} as const;

test("pins exactly thirty-two immutable, versioned Greek reconstruction rules", () => {
  assert.deepEqual(
    [...GREEK_RECONSTRUCTION_RULES.values()].map((rule) => rule.code),
    [
      "G0001H",
      "G0567",
      "G1489",
      "G1490",
      "G1503",
      "G1507",
      "G1970",
      "G2199H",
      "G2424K",
      "G2501O",
      "G4245G",
      "G5441",
      "G6087",
      "G6243",
      "G8216",
      "G20014",
      "G20128",
      "G20209",
      "G20278",
      "G20394",
      "G20464",
      "G20467",
      "G20490",
      "G20583",
      "G20654",
      "G20665",
      "G20765",
      "G20937",
      "G21057",
      "G21118",
      "G21241",
      "G21273"
    ]
  );
  assert.equal(GREEK_RECONSTRUCTION_RULES.size, 32);
  assert.equal("set" in GREEK_RECONSTRUCTION_RULES, false);
  assert.equal(
    digestGreekReconstructionRegistry(),
    GREEK_RECONSTRUCTION_REGISTRY_DIGEST
  );
  assert.deepEqual(verifyGreekReconstructionRegistry(), []);

  for (const rule of GREEK_RECONSTRUCTION_RULES.values()) {
    assert.equal(rule.schemaVersion, "lexicon-v3-greek-reconstruction@1");
    assert.equal(Object.isFrozen(rule), true);
    assert.equal(Object.isFrozen(rule.sourceSnapshots), true);
    assert.equal(Object.isFrozen(rule.witnesses), true);
    assert.equal(Object.isFrozen(rule.output), true);
    assert.equal(Object.isFrozen(rule.identityPatch), true);
    assert.equal(rule.ruleDigest, EXPECTED_RULE_DIGESTS[rule.code]);
    assert.equal(
      digestGreekReconstructionOutput(rule.output),
      rule.output.expectedDigest
    );
  }
});

test("approves every reconstruction only with its complete pinned evidence", () => {
  for (const rule of GREEK_RECONSTRUCTION_RULES.values()) {
    const proof = proveGreekReconstruction(rule.entryKey, validInput(rule));

    assert.equal(proof.approved, true, rule.entryKey);
    assert.deepEqual(proof.reasonCodes, ["greek-reconstruction-approved"]);
    assert.deepEqual(proof.output, rule.output);
    assert.deepEqual(proof.identityPatch, rule.identityPatch);
    assert.equal(proof.ruleDigest, rule.ruleDigest);
    assert.match(proof.proofDigest, /^[0-9a-f]{64}$/u);
  }
});

test("fails closed for a changed source record, snapshot, witness, or count", () => {
  const rule = requiredRule("G1489");

  const changedRecord = proveGreekReconstruction("G1489", {
    ...validInput(rule),
    sourceRecordDigest: "0".repeat(64)
  });
  assertRejected(
    changedRecord,
    "greek-reconstruction-source-record-digest-mismatch"
  );

  const missingSource = validInput(rule);
  deleteRecordKey(missingSource.sourceDigests, "TFLSJ");
  assertRejected(
    proveGreekReconstruction("G1489", missingSource),
    "greek-reconstruction-source-digest-set-mismatch"
  );

  const changedSource = validInput(rule);
  changedSource.sourceDigests.TFLSJ = "1".repeat(64);
  assertRejected(
    proveGreekReconstruction("G1489", changedSource),
    "greek-reconstruction-source-digest-mismatch"
  );

  const extraWitness = validInput(rule);
  extraWitness.witnessDigests["unregistered.witness"] = "2".repeat(64);
  assertRejected(
    proveGreekReconstruction("G1489", extraWitness),
    "greek-reconstruction-witness-digest-set-mismatch"
  );

  const changedWitness = validInput(rule);
  changedWitness.witnessDigests["TAGNT.G1489.adjacent-groups"] = "3".repeat(64);
  const changedWitnessProof = proveGreekReconstruction("G1489", changedWitness);
  assertRejected(
    changedWitnessProof,
    "greek-reconstruction-witness-digest-mismatch"
  );

  const changedCount = proveGreekReconstruction("G1489", {
    ...validInput(rule),
    occurrenceCount: 4
  });
  assertRejected(
    changedCount,
    "greek-reconstruction-occurrence-count-mismatch"
  );

  assert.equal(changedWitnessProof.output, null);
  assert.equal(changedWitnessProof.identityPatch, null);
});

test("requires explicit legacy absence for G6087", () => {
  const rule = requiredRule("G6087");
  const accepted = proveGreekReconstruction("G6087", validInput(rule));
  assert.equal(accepted.approved, true);

  const omitted = validInput(rule);
  deleteRecordKey(omitted.witnessDigests, "legacy.G6087.absent");
  assertRejected(
    proveGreekReconstruction("G6087", omitted),
    "greek-reconstruction-witness-digest-set-mismatch"
  );

  const replacedWithRow = validInput(rule);
  replacedWithRow.witnessDigests["legacy.G6087.absent"] = "4".repeat(64);
  assertRejected(
    proveGreekReconstruction("G6087", replacedWithRow),
    "greek-reconstruction-witness-digest-mismatch"
  );
});

test("does not expose output for an unknown rule", () => {
  const proof = proveGreekReconstruction("G9999", {
    sourceRecordDigest: "0".repeat(64),
    sourceDigests: {},
    witnessDigests: {}
  });

  assert.equal(proof.approved, false);
  assert.equal(proof.ruleId, null);
  assert.equal(proof.output, null);
  assert.equal(proof.identityPatch, null);
  assert.ok(proof.reasonCodes.includes("greek-reconstruction-unknown-rule"));
});

test("produces order-independent proof digests", () => {
  const rule = requiredRule("G1490");
  const forward = validInput(rule);
  const reversed = {
    ...forward,
    sourceDigests: reverseRecord(forward.sourceDigests),
    witnessDigests: reverseRecord(forward.witnessDigests)
  };

  const left = proveGreekReconstruction("G1490", forward);
  const right = proveGreekReconstruction("greek:G1490", reversed);
  assert.equal(left.approved, true);
  assert.equal(right.approved, true);
  assert.equal(left.proofDigest, right.proofDigest);
});

test("repairs G5441 identity only after a proof bound to the exact source row", () => {
  const source = {
    language: "greek" as const,
    eStrong: "G5441",
    dStrong: "G5441 =",
    uStrong: "G5441",
    original: "φυλακτήριος",
    transliteration: "phulaktērios",
    morph: "G:N-M",
    gloss: "guard",
    meaning:
      "<b>φύλαξ</b>, -ακος, ὁ<br /> (φυλάσσω), [in LXX for שָׁמַר, צוּר;] <br /><b>a guard, keeper</b>: Act.5:23 12:6, 19.†<br /> (AS)",
    classicTransliteration: "phulax",
    pronunciation: "foo'-lax"
  };
  const rule = requiredRule("G5441");

  assert.equal(
    digestGreekReconstructionSourceRecord(source),
    rule.expectedSourceRecordDigest
  );
  const proof = proveGreekReconstruction("G5441", validInput(rule));
  const repaired = applyProvenGreekReconstruction(source, proof);

  assert.ok(repaired);
  assert.equal(repaired.original, "φύλαξ");
  assert.equal(repaired.transliteration, "phulax");
  assert.equal(repaired.classicTransliteration, "phulax");
  assert.equal(repaired.pronunciation, "foo'-lax");
  assert.equal(repaired.gloss, "guard; keeper");
  assert.equal(
    repaired.meaning,
    "φύλαξ, -ακος, ὁ, a guard or keeper (Acts 5:23; 12:6, 19)."
  );

  assert.equal(
    applyProvenGreekReconstruction({ ...source, original: "changed" }, proof),
    null
  );
});

test("reconstructs G0567 only as the pinned middle-voice form alias", () => {
  const source = {
    language: "greek" as const,
    eStrong: "G0567",
    dStrong: "G0567 = a Form of",
    uStrong: "G0568",
    original: "ἀπέχομαι",
    transliteration: "apechomai",
    morph: "G:V",
    gloss: "to refrain/",
    meaning: "refrain, receive/be far, keep away from",
    classicTransliteration: "",
    pronunciation: "ap-ekh'-om-ahee"
  };
  const rule = requiredRule("G0567");

  assert.equal(rule.classification, "source-reconciled-form-alias");
  assert.equal(rule.expectedOccurrenceCount, 6);
  assert.equal(
    digestGreekReconstructionSourceRecord(source),
    rule.expectedSourceRecordDigest
  );
  assert.equal(
    rule.witnesses.find(
      (witness) => witness.id === "TAGNT.G0567.alternate-alias-corpus"
    )?.expectedDigest,
    PINNED_G0567_FORM_ALIAS.occurrenceCorpusDigest
  );

  const proof = proveGreekReconstruction("G0567", validInput(rule));
  const repaired = applyProvenGreekReconstruction(source, proof);
  assert.ok(repaired);
  assert.equal(repaired.eStrong, source.eStrong);
  assert.equal(repaired.dStrong, source.dStrong);
  assert.equal(repaired.uStrong, source.uStrong);
  assert.equal(repaired.original, source.original);
  assert.equal(repaired.transliteration, source.transliteration);
  assert.equal(repaired.gloss, "to abstain");
  assert.equal(
    repaired.meaning,
    "<b>ἀπέχομαι</b>, a middle-voice form of <b>ἀπέχω</b>: <b>to keep oneself away from</b> something; <b>to abstain</b> or <b>refrain</b>. In the New Testament, with the genitive: Acts 15:29; 1 Tim. 4:3; 1 Pet. 2:11; with <b>ἀπό</b>: Acts 15:20; 1 Thess. 4:3; 5:22."
  );
  assert.doesNotMatch(
    repaired.meaning,
    /have in full|receive|be distant|enough/iu
  );

  const forgedAlias = validInput(rule);
  forgedAlias.witnessDigests["TAGNT.G0567.alternate-alias-corpus"] = "0".repeat(
    64
  );
  assertRejected(
    proveGreekReconstruction("G0567", forgedAlias),
    "greek-reconstruction-witness-digest-mismatch"
  );
});

test("reconciles G8216 as circumflex mother-vocative without fusing the acute homograph", () => {
  const source = {
    language: "greek" as const,
    eStrong: "G8216",
    dStrong: "G8216 =",
    uStrong: "G8216",
    original: "μᾶ",
    transliteration: "ma",
    morph: "",
    gloss: "by!",
    meaning:
      "shortened doric form for μάτηρ, μᾶ γᾶ for μῆτερ γῆ, (Aeschulus Tragicus); μᾶ, πόθεν ἅνθρωπος; (Theocritus Poeta Bucolicus) (ML)",
    classicTransliteration: "",
    pronunciation: ""
  };
  const rule = requiredRule("G8216");

  assert.equal(
    rule.classification,
    "source-reconciled-homograph/accent-confusion"
  );
  assert.equal(rule.expectedOccurrenceCount, 0);
  assert.equal(
    digestGreekReconstructionSourceRecord(source),
    rule.expectedSourceRecordDigest
  );
  assert.equal(
    rule.witnesses.find(
      (witness) => witness.id === "TAGNT.G8216.zero-exact-occurrence-corpus"
    )?.expectedDigest,
    PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G8216
  );

  const proof = proveGreekReconstruction("G8216", validInput(rule));
  const repaired = applyProvenGreekReconstruction(source, proof);
  assert.ok(repaired);
  assert.equal(repaired.eStrong, "G8216");
  assert.equal(repaired.dStrong, "G8216 =");
  assert.equal(repaired.uStrong, "G8216");
  assert.equal(repaired.original, "μᾶ");
  assert.equal(repaired.gloss, "mother!");
  assert.equal(
    repaired.meaning,
    "<b>μᾶ</b>, a shortened Doric vocative of <b>μάτηρ</b> (“mother”), used in direct address; e.g. <b>μᾶ γᾶ</b>, “Mother Earth,” for <b>μῆτερ γῆ</b>."
  );
  assert.doesNotMatch(repaired.meaning, /yea by/iu);

  const acuteHomograph = { ...source, original: "μά" };
  assert.equal(applyProvenGreekReconstruction(acuteHomograph, proof), null);
  const changedFragment = validInput(rule);
  changedFragment.witnessDigests["TFLSJ.G3483.mu-acute-oath-fragment"] =
    "0".repeat(64);
  assertRejected(
    proveGreekReconstruction("G8216", changedFragment),
    "greek-reconstruction-witness-digest-mismatch"
  );
  assertRejected(
    proveGreekReconstruction("G8216", {
      ...validInput(rule),
      occurrenceCount: 1
    }),
    "greek-reconstruction-occurrence-count-mismatch"
  );
});

test("applies the four supplemental editorial reconstructions only to their exact unsuffixed STEP rows", () => {
  const cases = [
    {
      code: "G20014",
      source: sourceEntry(
        "G20014",
        "G20014 =",
        "G20014",
        "ἄγυια",
        "aguia",
        "",
        "city",
        "<b>ἀγυιά</b>, see: ἀγορά, [in LXX: 3Ma.1:20 4:3 *]. <br /> (AS)"
      ),
      morph: "",
      gloss: "street",
      meaning:
        "<b>a street</b>; compare ἀγορά (G0058). In the LXX: 3Ma.1:20; 4:3."
    },
    {
      code: "G20278",
      source: sourceEntry(
        "G20278",
        "G20278 =",
        "G20278",
        "ἐγκαταλοχίζω",
        "egkatalochizō",
        "G:V",
        "to divide into teams",
        "courses"
      ),
      morph: "G:V",
      gloss: "to divide into companies",
      meaning:
        "<b>ἐγκαταλοχίζω</b>: <b>to divide or organise into companies</b>."
    },
    {
      code: "G20464",
      source: sourceEntry(
        "G20464",
        "G20464 =",
        "G20464",
        "ἐσσήν",
        "essēn",
        "",
        "[hudot ]ōšen",
        "[hudot ]ōšen"
      ),
      morph: "G:N-M",
      gloss: "king bee; priest of Artemis at Ephesus",
      meaning:
        "<b>ἐσσήν</b>: the <b>king bee</b>; also a title of the priest of Artemis at Ephesus."
    },
    {
      code: "G21273",
      source: sourceEntry(
        "G21273",
        "G21273 =",
        "G21273",
        "ὑπεράγω",
        "huperagō",
        "G:V",
        "to exalt",
        "excessive"
      ),
      morph: "G:V",
      gloss: "to lead or carry over or beyond; to exalt",
      meaning:
        "<b>ὑπεράγω</b>: <b>to lead or carry over or beyond</b>; figuratively, <b>to exalt</b>."
    }
  ] as const;

  for (const item of cases) {
    const rule = requiredRule(item.code);
    assert.equal(rule.expectedOccurrenceCount, 0);
    assert.equal(
      digestGreekReconstructionSourceRecord(item.source),
      rule.expectedSourceRecordDigest
    );
    assert.equal(
      rule.witnesses.find(
        (witness) =>
          witness.id === `TAGNT.${item.code}.zero-exact-occurrence-corpus`
      )?.expectedDigest,
      PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA[item.code]
    );

    const proof = proveGreekReconstruction(item.code, validInput(rule));
    const repaired = applyProvenGreekReconstruction(item.source, proof);
    assert.ok(repaired);
    assert.equal(repaired.eStrong, item.source.eStrong);
    assert.equal(repaired.dStrong, item.source.dStrong);
    assert.equal(repaired.uStrong, item.source.uStrong);
    assert.equal(repaired.original, item.source.original);
    assert.equal(repaired.transliteration, item.source.transliteration);
    assert.equal(repaired.morph, item.morph);
    assert.equal(repaired.gloss, item.gloss);
    assert.equal(repaired.meaning, item.meaning);

    assert.equal(
      applyProvenGreekReconstruction(
        { ...item.source, dStrong: `${item.code} = a Form of` },
        proof
      ),
      null
    );
    const missingCorpus = validInput(rule);
    deleteRecordKey(
      missingCorpus.witnessDigests,
      `TAGNT.${item.code}.zero-exact-occurrence-corpus`
    );
    assertRejected(
      proveGreekReconstruction(item.code, missingCorpus),
      "greek-reconstruction-witness-digest-set-mismatch"
    );
  }

  const g20464 = requiredRule("G20464");
  const missingArtifactFile = validInput(g20464);
  deleteRecordKey(
    missingArtifactFile.sourceDigests,
    "internal-adjudication.G20464.artifact-file"
  );
  assertRejected(
    proveGreekReconstruction("G20464", missingArtifactFile),
    "greek-reconstruction-source-digest-set-mismatch"
  );
});

test("applies the fifteen exact lexical reconstructions atomically without changing STEP identity", () => {
  const cases = [
    {
      code: "G1503",
      source: sourceEntry(
        "G1503",
        "G1503 =",
        "G1503",
        "εἴκω",
        "eikō",
        "G:V",
        "to resemble",
        "<b>εἴκω</b> (obsolete pres.), see: ἔοικα <note>Transcriber note: This form does not occur in Abbott-Smith. It should be on p. 158.</note>.<br /> (AS)",
        "",
        "i'-ko"
      ),
      morph: "G:V"
    },
    {
      code: "G1507",
      source: sourceEntry(
        "G1507",
        "G1507 = a Spelling of",
        "G1667",
        "εἱλίσσω",
        "ehilissō",
        "G:V",
        "to roll up",
        "<b>εἱλίσσω</b>, see: ἑλέσσω <note>Transcriber: Is this word in Abbott-Smith?.</note><br /> (AS)",
        "heilissō",
        "hi-lis'-so"
      ),
      morph: "G:V"
    },
    {
      code: "G1970",
      source: sourceEntry(
        "G1970",
        "G1970 = a Combination of",
        "G4155 (G1909+G4155)",
        "ἐπιπνίγω",
        "epipnigō",
        "G:V",
        "to choke",
        "- to throttle upon, i.e. (figuratively) overgrowhoke, stifle",
        "",
        "ep-ee-pnee'-go"
      ),
      morph: "G:V"
    },
    {
      code: "G6243",
      source: sourceEntry(
        "G6243",
        "G6243 =",
        "G6243",
        "ἀλσώδης",
        "alsōdēs",
        "G:N-N",
        "a woods",
        "a woods"
      ),
      morph: "G:A"
    },
    {
      code: "G20128",
      source: sourceEntry(
        "G20128",
        "G20128 =",
        "G20128",
        "ἀπότομος",
        "apotomos",
        "G:N",
        "precisely",
        "1. <b>cut off, abrupt, precipitous </b>, (Herdotus Historicus); ἀπότομον ὤρουσεν εἰς ἀνάγκαν, <i>metaphorically</i> from one who comes suddenly <b>to the edge of a cliff </b>, (Sophocles Tragicus) <br />2. <i>metaphorically</i> <b>severe, relentless </b>, (Euripides) (ML)"
      ),
      morph: "G:A"
    },
    {
      code: "G20209",
      source: sourceEntry(
        "G20209",
        "G20209 =",
        "G20209",
        "δεκάταρχος",
        "dekatarchos",
        "",
        "head of a",
        "head of a"
      ),
      morph: "G:N-M"
    },
    {
      code: "G20394",
      source: sourceEntry(
        "G20394",
        "G20394 =",
        "G20394",
        "ἐξισάζω",
        "exisazō",
        "G:V",
        "to equate",
        "in R."
      ),
      morph: "G:V"
    },
    {
      code: "G20467",
      source: sourceEntry(
        "G20467",
        "G20467 =",
        "G20467",
        "εὐαγής",
        "euagēs",
        "",
        "rūgio",
        "rūgio"
      ),
      morph: "G:A"
    },
    {
      code: "G20490",
      source: sourceEntry(
        "G20490",
        "G20490 = a Form of",
        "G2198",
        "ζῶ",
        "zō",
        "",
        "life",
        "spring, spring"
      ),
      morph: "G:V"
    },
    {
      code: "G20583",
      source: sourceEntry(
        "G20583",
        "G20583 =",
        "G20583",
        "κατερευνάω",
        "katereunaō",
        "G:V",
        "to dīrīmat",
        "dīrīmat"
      ),
      morph: "G:V"
    },
    {
      code: "G20654",
      source: sourceEntry(
        "G20654",
        "G20654 =",
        "G20654",
        "μαδών",
        "madōn",
        "",
        "íš mādhón",
        "íš mādhón"
      ),
      morph: ""
    },
    {
      code: "G20937",
      source: sourceEntry(
        "G20937",
        "G20937 =",
        "G20937",
        "περιβώμιος",
        "peribōmios",
        "",
        "space round a",
        "space round a"
      ),
      morph: "G:A"
    },
    {
      code: "G21057",
      source: sourceEntry(
        "G21057",
        "G21057 =",
        "G21057",
        "πρόσχεσις",
        "proschesis",
        "",
        "obtutus)",
        "obtutus)"
      ),
      morph: "G:N-F"
    },
    {
      code: "G21118",
      source: sourceEntry(
        "G21118",
        "G21118 =",
        "G21118",
        "σπλαγχνοφάγος",
        "splagchnophagos",
        "",
        "eating the",
        "eating the"
      ),
      morph: "G:A"
    },
    {
      code: "G21241",
      source: sourceEntry(
        "G21241",
        "G21241 =",
        "G21241",
        "τοπαρχία",
        "toparchia",
        "",
        "district governed by a",
        "district governed by a"
      ),
      morph: "G:N-F"
    }
  ] as const;
  const expectedOutputs = {
    G1503: {
      gloss: "to resemble",
      meaning:
        "<b>εἴκω</b> (chiefly in the perfect <b>ἔοικα</b>, with present force): <b>to be like</b> or <b>resemble</b>."
    },
    G1507: {
      gloss: "to roll up",
      meaning:
        "<b>εἱλίσσω</b>, a spelling variant of <b>ἑλίσσω</b> (G1667): <b>to roll</b>, <b>wind round</b>, or <b>roll up</b>."
    },
    G1970: {
      gloss: "to choke",
      meaning:
        "<b>ἐπιπνίγω</b>: <b>to choke</b> or <b>stifle</b>; figuratively, <b>to overgrow and choke</b>."
    },
    G6243: {
      gloss: "wooded",
      meaning: "<b>ἀλσώδης</b>: <b>wooded</b> or <b>full of groves</b>."
    },
    G20128: {
      gloss: "abrupt, precipitous; severe, relentless",
      meaning:
        "<b>ἀπότομος</b>: <b>cut off</b>, <b>abrupt</b>, or <b>precipitous</b>; metaphorically, <b>severe</b> or <b>relentless</b>."
    },
    G20209: {
      gloss: "commander of ten",
      meaning: "<b>δεκάταρχος</b>: <b>a commander or leader of ten</b>."
    },
    G20394: {
      gloss: "to equate",
      meaning: "<b>ἐξισάζω</b>: <b>to make equal</b> or <b>equate</b>."
    },
    G20467: {
      gloss: "pure",
      meaning:
        "<b>εὐαγής</b>: <b>pure</b>, especially in relation to sacred rites."
    },
    G20490: {
      gloss: "to live",
      meaning:
        "<b>ζῶ</b>, a contracted form of <b>ζάω</b>: <b>to live</b>; of persons, animals, and plants; figuratively, <b>to be alive or vigorous</b>. See G2198."
    },
    G20583: {
      gloss: "to search thoroughly",
      meaning:
        "<b>κατερευνάω</b>: <b>to search thoroughly</b> or <b>investigate closely</b>."
    },
    G20654: {
      gloss: "a man of strife",
      meaning:
        "<b>μαδών</b>, corresponding to Hebrew <b>אִישׁ מָדוֹן</b>: <b>a man of strife</b> or <b>a contentious person</b>."
    },
    G20937: {
      gloss: "space around an altar",
      meaning:
        "<b>περιβώμιος</b>: <b>around an altar</b>; substantivally, <b>the space around an altar</b>."
    },
    G21057: {
      gloss: "attention",
      meaning:
        "<b>πρόσχεσις</b>: <b>attention</b>, the directing of the mind or gaze toward something."
    },
    G21118: {
      gloss: "eating the entrails",
      meaning:
        "<b>σπλαγχνοφάγος</b>: <b>eating the inward parts or entrails</b>."
    },
    G21241: {
      gloss: "district governed by a toparch",
      meaning:
        "<b>τοπαρχία</b>: <b>a district governed by a toparch</b>; in Egypt, an administrative subdivision of a nome."
    }
  } as const;

  for (const item of cases) {
    const rule = requiredRule(item.code);
    assert.equal(
      digestGreekReconstructionSourceRecord(item.source),
      rule.expectedSourceRecordDigest,
      item.code
    );
    const proof = proveGreekReconstruction(item.code, validInput(rule));
    const repaired = applyProvenGreekReconstruction(item.source, proof);
    assert.ok(repaired, item.code);
    assert.equal(repaired.eStrong, item.source.eStrong, item.code);
    assert.equal(repaired.dStrong, item.source.dStrong, item.code);
    assert.equal(repaired.uStrong, item.source.uStrong, item.code);
    assert.equal(repaired.original, item.source.original, item.code);
    assert.equal(
      repaired.transliteration,
      item.source.transliteration,
      item.code
    );
    assert.equal(
      repaired.classicTransliteration,
      item.source.classicTransliteration,
      item.code
    );
    assert.equal(repaired.pronunciation, item.source.pronunciation, item.code);
    assert.equal(repaired.gloss, expectedOutputs[item.code].gloss, item.code);
    assert.equal(
      repaired.meaning,
      expectedOutputs[item.code].meaning,
      item.code
    );
    assert.equal(
      rule.output.gloss,
      expectedOutputs[item.code].gloss,
      item.code
    );
    assert.equal(
      rule.output.meaning,
      expectedOutputs[item.code].meaning,
      item.code
    );
    assert.equal(repaired.morph, item.morph, item.code);

    assert.equal(
      applyProvenGreekReconstruction(
        { ...item.source, gloss: `${item.source.gloss} changed` },
        proof
      ),
      null,
      item.code
    );
    const changedWitness = validInput(rule);
    changedWitness.witnessDigests[rule.witnesses[0]!.id] = "0".repeat(64);
    assertRejected(
      proveGreekReconstruction(item.code, changedWitness),
      "greek-reconstruction-witness-digest-mismatch"
    );
    assertRejected(
      proveGreekReconstruction(item.code, {
        ...validInput(rule),
        occurrenceCount: rule.expectedOccurrenceCount === 0 ? 1 : 0
      }),
      "greek-reconstruction-occurrence-count-mismatch"
    );
  }

  assert.equal(
    requiredRule("G20654").classification,
    "editorial_reconstruction"
  );
  assert.equal(
    requiredRule("G21057").classification,
    "editorial_reconstruction"
  );
  assert.equal(requiredRule("G20490").output.gloss, "to live");
  assert.equal(requiredRule("G20490").identityPatch.morph, "G:V");
  assert.match(requiredRule("G20490").output.meaning, /See G2198\.$/u);
  assert.notEqual(requiredRule("G20128").identityPatch.morph, "G:N");
});

test("reconstructs G20665 as manticore from the exact STEP etymon and pinned Kaikki witness", () => {
  const source = sourceEntry(
    "G20665",
    "G20665 =",
    "G20665",
    "μαρτιχόρας",
    "martichoras",
    "",
    "mard-khwār",
    "mard-khwār"
  );
  const rule = requiredRule("G20665");
  assert.equal(
    digestGreekReconstructionSourceRecord(source),
    rule.expectedSourceRecordDigest
  );
  assert.equal(rule.classification, "editorial_reconstruction");
  assert.equal(rule.identityPatch.morph, "G:N-M");
  const proof = proveGreekReconstruction("G20665", validInput(rule));
  assert.equal(proof.approved, true);
  const repaired = applyProvenGreekReconstruction(source, proof);
  assert.ok(repaired);
  assert.equal(repaired.gloss, "manticore");
  assert.equal(
    repaired.meaning,
    "<b>μαρτιχόρας</b>: the <b>manticore</b>, a mythical man-eating creature."
  );
  assert.equal(repaired.morph, "G:N-M");

  const kaikki = readFileSync(
    new URL(
      "../data/external/french-lexical/kaikki/kaikki.org-dictionary-French.jsonl",
      import.meta.url
    )
  );
  const byteOffset = 8_480_400;
  const lf = kaikki.indexOf(0x0a, byteOffset);
  const exactLine = kaikki.subarray(byteOffset, lf === -1 ? undefined : lf);
  assert.equal(
    createHash("sha256").update(exactLine).digest("hex"),
    "b23c381205de2af0dcc10db9b192df444a5ec4f8f99b3baa6cfb0f971d10ff57"
  );
  assert.match(exactLine.toString("utf8"), /"word": "manticore"/u);
  assert.match(exactLine.toString("utf8"), /"Mythological creatures"/u);
});

test("reconstructs G20765 editorially from its exact G3448 plant-shoot witness without a STEP relation", () => {
  const source = {
    language: "greek" as const,
    eStrong: "G20765",
    dStrong: "G20765 =",
    uStrong: "G20765",
    original: "μόσχευμα",
    transliteration: "moscheuma",
    morph: "",
    gloss: "PLond.ined.",
    meaning: "PLond.ined.",
    classicTransliteration: "",
    pronunciation: ""
  };
  const rule = requiredRule("G20765");

  assert.equal(rule.classification, "editorial-morphological-reconstruction");
  assert.equal(rule.expectedOccurrenceCount, 0);
  assert.equal(
    digestGreekReconstructionSourceRecord(source),
    rule.expectedSourceRecordDigest
  );
  assert.equal(
    rule.witnesses.find(
      (witness) => witness.id === "TAGNT.G20765.zero-exact-occurrence-corpus"
    )?.expectedDigest,
    PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20765
  );

  const proof = proveGreekReconstruction("G20765", validInput(rule));
  const repaired = applyProvenGreekReconstruction(source, proof);
  assert.ok(repaired);
  assert.equal(repaired.eStrong, source.eStrong);
  assert.equal(repaired.dStrong, source.dStrong);
  assert.equal(repaired.uStrong, source.uStrong);
  assert.equal(repaired.original, source.original);
  assert.equal(repaired.transliteration, source.transliteration);
  assert.equal(repaired.gloss, "a plant cutting");
  assert.equal(
    repaired.meaning,
    "<b>μόσχευμα</b>, a young shoot or plant cutting; a scion. The STEP source cites an unpublished London papyrus (<i>P.Lond. ined.</i>)."
  );
  assert.doesNotMatch(repaired.dStrong, /G3448/u);
  assert.doesNotMatch(repaired.uStrong, /G3448/u);

  const forgedRelation = { ...source, dStrong: "G20765 = a Form of G3448" };
  assert.equal(applyProvenGreekReconstruction(forgedRelation, proof), null);
  const changedBaseFragment = validInput(rule);
  changedBaseFragment.witnessDigests["TBESG.G3448.young-shoot-fragment"] =
    "1".repeat(64);
  assertRejected(
    proveGreekReconstruction("G20765", changedBaseFragment),
    "greek-reconstruction-witness-digest-mismatch"
  );
  const changedRawRow = validInput(rule);
  changedRawRow.witnessDigests["TBESG.G20765.raw-row"] = "2".repeat(64);
  assertRejected(
    proveGreekReconstruction("G20765", changedRawRow),
    "greek-reconstruction-witness-digest-mismatch"
  );
  assertRejected(
    proveGreekReconstruction("G20765", {
      ...validInput(rule),
      occurrenceCount: 1
    }),
    "greek-reconstruction-occurrence-count-mismatch"
  );
});

test("pins the three required identity corrections", () => {
  assert.deepEqual(requiredRule("G0001H").identityPatch, {
    pronunciation: ""
  });
  assert.deepEqual(requiredRule("G2199H").identityPatch, {
    original: "",
    transliteration: "",
    classicTransliteration: "",
    pronunciation: "",
    morph: ""
  });
  assert.deepEqual(requiredRule("G5441").identityPatch, {
    original: "φύλαξ",
    transliteration: "phulax"
  });
});

test("verifies the pinned CC BY-SA Perseus source artifact and detects tampering", () => {
  const artifact = readPinnedPerseusArtifact();
  const verification = verifyPinnedG0001HPerseusArtifact(artifact);

  assert.equal(PINNED_G0001H_PERSEUS_ARTIFACT_PATH.endsWith(".json"), true);
  assert.equal(verification.valid, true);
  assert.deepEqual(verification.reasonCodes, ["perseus-artifact-verified"]);
  assert.equal(
    verification.artifactDigest,
    PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST
  );
  assert.equal(
    verification.payloadDigest,
    PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST
  );
  assert.equal(asRecord(asRecord(artifact).license).spdx, "CC-BY-SA-4.0");
  assert.equal(
    asRecord(asRecord(artifact).source).commit,
    "b5e707bdda2d6c8e0bb6c29657454996b4fb04d7"
  );

  const changedCommit = structuredClone(artifact);
  asRecord(asRecord(changedCommit).source).commit = "0".repeat(40);
  assertArtifactRejected(changedCommit, "perseus-artifact-source-mismatch");

  const changedPayload = structuredClone(artifact);
  asRecord(asRecord(changedPayload).payload).headword = "ἔα";
  assertArtifactRejected(
    changedPayload,
    "perseus-artifact-payload-digest-mismatch"
  );

  const changedLicense = structuredClone(artifact);
  asRecord(asRecord(changedLicense).license).spdx = "unknown";
  assertArtifactRejected(changedLicense, "perseus-artifact-license-mismatch");
});

test("verifies the real G20464 adjudication file, its two judgments, and its local proof limit", () => {
  const artifactUrl = new URL(
    `../${PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_PATH}`,
    import.meta.url
  );
  const rawArtifact = readFileSync(artifactUrl);
  const artifact = JSON.parse(rawArtifact.toString("utf8")) as unknown;
  const verification = verifyPinnedG20464InternalAdjudicationArtifact(artifact);

  assert.equal(verification.valid, true);
  assert.deepEqual(verification.reasonCodes, ["g20464-adjudication-verified"]);
  assert.equal(
    verification.artifactDigest,
    PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST
  );
  assert.equal(
    verification.payloadDigest,
    PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST
  );
  assert.equal(
    createHash("sha256").update(rawArtifact).digest("hex"),
    PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST
  );
  const judgments = asRecord(artifact).judgments;
  assert.ok(Array.isArray(judgments));
  assert.equal(judgments.length, 2);
  assert.equal(
    asRecord(asRecord(artifact).consensus).independenceLimit,
    "Independence is procedural: two separate checked-in reports and review roles; the reports do not provide cryptographic reviewer or model identities and are not two external lexical attestations."
  );
  assert.match(
    String(asRecord(asRecord(artifact).localProofBoundary).limit),
    /do not locally attest/iu
  );

  const changedJudgment = structuredClone(artifact);
  const changedJudgments = asRecord(changedJudgment).judgments;
  assert.ok(Array.isArray(changedJudgments));
  asRecord(changedJudgments[0]).gloss = "tampered";
  assertG20464ArtifactRejected(
    changedJudgment,
    "g20464-adjudication-judgments-mismatch"
  );

  const widenedLocalClaim = structuredClone(artifact);
  asRecord(asRecord(widenedLocalClaim).localProofBoundary).limit =
    "Local STEP proves every reconstructed sense.";
  assertG20464ArtifactRejected(
    widenedLocalClaim,
    "g20464-adjudication-local-proof-boundary-mismatch"
  );
});

test("prevents in-memory mutation of rule policy and output", () => {
  const rule = requiredRule("G0001H");
  assert.equal(Reflect.set(rule.output, "gloss", "tampered"), false);
  assert.equal(
    Reflect.set(rule.identityPatch, "pronunciation", "alpha"),
    false
  );
  assert.equal(rule.output.gloss, "ah!");
  assert.deepEqual(verifyGreekReconstructionRegistry(), []);
});

function requiredRule(code: string): GreekReconstructionRule {
  const rule = getGreekReconstructionRule(code);
  assert.ok(rule, `missing Greek reconstruction rule ${code}`);
  return rule;
}

function sourceEntry(
  eStrong: string,
  dStrong: string,
  uStrong: string,
  original: string,
  transliteration: string,
  morph: string,
  gloss: string,
  meaning: string,
  classicTransliteration = "",
  pronunciation = ""
) {
  return {
    language: "greek" as const,
    eStrong,
    dStrong,
    uStrong,
    original,
    transliteration,
    morph,
    gloss,
    meaning,
    classicTransliteration,
    pronunciation
  };
}

function validInput(
  rule: GreekReconstructionRule
): GreekReconstructionProofInput & {
  sourceDigests: Record<string, string>;
  witnessDigests: Record<string, string | null>;
} {
  const result = {
    sourceRecordDigest: rule.expectedSourceRecordDigest,
    sourceDigests: Object.fromEntries(
      rule.sourceSnapshots.map((source) => [source.id, source.sha256])
    ),
    witnessDigests: Object.fromEntries(
      rule.witnesses.map((witness) => [witness.id, witness.expectedDigest])
    )
  } as GreekReconstructionProofInput & {
    sourceDigests: Record<string, string>;
    witnessDigests: Record<string, string | null>;
  };
  if (rule.expectedOccurrenceCount !== null) {
    result.occurrenceCount = rule.expectedOccurrenceCount;
  }
  return result;
}

function assertRejected(
  proof: ReturnType<typeof proveGreekReconstruction>,
  reason: (typeof proof.reasonCodes)[number]
): void {
  assert.equal(proof.approved, false);
  assert.equal(proof.output, null);
  assert.equal(proof.identityPatch, null);
  assert.ok(proof.reasonCodes.includes(reason), proof.reasonCodes.join(", "));
}

function assertArtifactRejected(
  artifact: unknown,
  reason: ReturnType<
    typeof verifyPinnedG0001HPerseusArtifact
  >["reasonCodes"][number]
): void {
  const verification = verifyPinnedG0001HPerseusArtifact(artifact);
  assert.equal(verification.valid, false);
  assert.ok(
    verification.reasonCodes.includes(reason),
    verification.reasonCodes.join(", ")
  );
}

function assertG20464ArtifactRejected(
  artifact: unknown,
  reason: ReturnType<
    typeof verifyPinnedG20464InternalAdjudicationArtifact
  >["reasonCodes"][number]
): void {
  const verification = verifyPinnedG20464InternalAdjudicationArtifact(artifact);
  assert.equal(verification.valid, false);
  assert.ok(
    verification.reasonCodes.includes(reason),
    verification.reasonCodes.join(", ")
  );
}

function readPinnedPerseusArtifact(): unknown {
  return JSON.parse(
    readFileSync(
      new URL(`../${PINNED_G0001H_PERSEUS_ARTIFACT_PATH}`, import.meta.url),
      "utf8"
    )
  );
}

function reverseRecord<T>(
  value: Readonly<Record<string, T>>
): Record<string, T> {
  return Object.fromEntries(Object.entries(value).reverse());
}

function deleteRecordKey<T>(
  record: Readonly<Record<string, T>>,
  key: string
): void {
  delete (record as Record<string, T>)[key];
}

function asRecord(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return value as Record<string, unknown>;
}
