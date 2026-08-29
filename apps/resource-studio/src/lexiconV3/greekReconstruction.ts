import { createHash } from "node:crypto";

import { type LexiconV3SourceEntry } from "./contracts.js";
import { extractPrimaryDStrong } from "./identity.js";

export const GREEK_RECONSTRUCTION_SCHEMA_VERSION =
  "lexicon-v3-greek-reconstruction@1" as const;

export const GREEK_RECONSTRUCTION_SOURCE_DIGESTS = Object.freeze({
  stepDatabase:
    "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
  tbesg: "e8f58a8f841f2a338b3df648466a773928127e6080c06d32ee88694fb761facb",
  tbesh: "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
  tflsj: "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691",
  tagntActsRevelation:
    "524e32375361e6d3fa2f7ef00b87605fdc4317a762f395651a05fdc31ad031b7",
  tagntMatthewJohn:
    "ab8eaaeb68e17a1dcfa34e1e9350358f22f03bc2a97244d848750ad81044bc8e",
  tipnrPeople:
    "af26347131e130f5abf060522437f1b03ebf0a9b60338065ce9b4e1e9a8ef4a1",
  legacyDatabase:
    "f5e658e54b4ff89bcbcdfdb899d3f48aec1aab16d0a2c3f5ec856d0d82b2c978",
  perseusLsj:
    "15b1b7ca0a6c88e5a14e97f2339a0c7a7dfae71c028bdfb45fcee04c79a754f7",
  kaikkiFrench:
    "b337fcc95d1fefeeb28164ea9dfec890a282d81b74269f1758de0fe5d0283030"
});

export const PINNED_G0001H_PERSEUS_ARTIFACT_PATH =
  "src/lexiconV3/sources/perseus-lsj-g0001h-n3.json" as const;
export const PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST =
  "04215068163e47a95512bbc7e1bc7e4bb8a959aa388117ca810eafcc66203b8f" as const;
export const PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST =
  "f0ba0f76ab464617d412235905503ada2245ab8359b2b87f1fd48285b29f8dac" as const;
export const PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_PATH =
  "src/lexiconV3/sources/g20464-internal-adjudication.json" as const;
export const PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST =
  "1a3d4e28705249f68c83194bd59f5ce114076bbd98660e9fbe0dc9b0cba9cae7" as const;
export const PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST =
  "2feb9851981c53aefda670849a25ab5df6ac64a89cb513ba342c67f42cdc47af" as const;
export const PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST =
  "b03e9a15dbf4f93b81011346b36b33b5652cb63701c6876b7316a847b81bcb06" as const;

export type GreekReconstructionCode =
  | "G0001H"
  | "G0567"
  | "G1489"
  | "G1490"
  | "G1503"
  | "G1507"
  | "G1970"
  | "G2199H"
  | "G2424K"
  | "G2501O"
  | "G4245G"
  | "G5441"
  | "G6087"
  | "G6243"
  | "G8216"
  | "G20014"
  | "G20128"
  | "G20209"
  | "G20278"
  | "G20394"
  | "G20464"
  | "G20467"
  | "G20490"
  | "G20583"
  | "G20654"
  | "G20665"
  | "G20765"
  | "G20937"
  | "G21057"
  | "G21118"
  | "G21241"
  | "G21273";

export type GreekReconstructionClassification =
  | "composition"
  | "contextual-extraction"
  | "direct-alias-extraction"
  | "direct-source-extraction"
  | "editorial_reconstruction"
  | "entity-template"
  | "identity-repair-exact-extraction"
  | "morphological-reconstruction"
  | "sense-extraction"
  | "editorial-morphological-reconstruction"
  | "source-reconciled-homograph/accent-confusion"
  | "source-reconciled-form-alias"
  | "source-replacement";

export type GreekReconstructionWitnessKind =
  | "alternate-alias-corpus"
  | "cross-reference"
  | "entity-record"
  | "exact-absence-corpus"
  | "exact-occurrence-corpus"
  | "legacy-absence"
  | "legacy-row"
  | "lexicon-slice"
  | "occurrence-corpus"
  | "raw-fragment"
  | "semantic-payload"
  | "source-record";

export interface GreekReconstructionSourceSnapshot {
  id: string;
  sha256: string;
}

export interface GreekReconstructionWitness {
  id: string;
  family:
    | "legacy"
    | "Kaikki"
    | "InternalAdjudication"
    | "Perseus"
    | "STEP"
    | "TAGNT"
    | "TBESG"
    | "TBESH"
    | "TFLSJ"
    | "TIPNR";
  kind: GreekReconstructionWitnessKind;
  locator: string;
  /** `null` is an affirmative, source-snapshot-bound proof of absence. */
  expectedDigest: string | null;
  role:
    | "base-context"
    | "conflicting-base"
    | "corroborating"
    | "negative"
    | "primary";
}

export interface GreekReconstructionOutput {
  gloss: string;
  meaning: string;
  expectedDigest: string;
}

export interface GreekReconstructionIdentityPatch {
  original?: string;
  transliteration?: string;
  classicTransliteration?: string;
  pronunciation?: string;
  morph?: string;
}

export interface GreekReconstructionRuleDefinition {
  schemaVersion: typeof GREEK_RECONSTRUCTION_SCHEMA_VERSION;
  ruleId: string;
  entryKey: `greek:${GreekReconstructionCode}`;
  code: GreekReconstructionCode;
  classification: GreekReconstructionClassification;
  confidence?: number;
  expectedSourceRecordDigest: string;
  sourceSnapshots: readonly GreekReconstructionSourceSnapshot[];
  witnesses: readonly GreekReconstructionWitness[];
  expectedOccurrenceCount: number | null;
  output: GreekReconstructionOutput;
  identityPatch: GreekReconstructionIdentityPatch;
  rationale: string;
}

export interface GreekReconstructionRule extends GreekReconstructionRuleDefinition {
  ruleDigest: string;
}

export interface GreekReconstructionProofInput {
  sourceRecordDigest: string;
  sourceDigests: Readonly<Record<string, string>>;
  witnessDigests: Readonly<Record<string, string | null>>;
  occurrenceCount?: number;
}

export type GreekReconstructionProofReasonCode =
  | "greek-reconstruction-approved"
  | "greek-reconstruction-occurrence-count-mismatch"
  | "greek-reconstruction-output-digest-mismatch"
  | "greek-reconstruction-registry-integrity-invalid"
  | "greek-reconstruction-source-digest-mismatch"
  | "greek-reconstruction-source-digest-set-mismatch"
  | "greek-reconstruction-source-record-digest-invalid"
  | "greek-reconstruction-source-record-digest-mismatch"
  | "greek-reconstruction-unknown-rule"
  | "greek-reconstruction-witness-digest-mismatch"
  | "greek-reconstruction-witness-digest-set-mismatch";

export interface GreekReconstructionProof {
  approved: boolean;
  entryKey: string;
  ruleId: string | null;
  reasonCodes: GreekReconstructionProofReasonCode[];
  sourceRecordDigest: string;
  ruleDigest: string | null;
  output: GreekReconstructionOutput | null;
  identityPatch: GreekReconstructionIdentityPatch | null;
  proofDigest: string;
}

export type PinnedPerseusArtifactReasonCode =
  | "perseus-artifact-digest-mismatch"
  | "perseus-artifact-license-mismatch"
  | "perseus-artifact-malformed"
  | "perseus-artifact-payload-digest-mismatch"
  | "perseus-artifact-payload-malformed"
  | "perseus-artifact-source-mismatch"
  | "perseus-artifact-verified";

export interface PinnedPerseusArtifactVerification {
  valid: boolean;
  reasonCodes: PinnedPerseusArtifactReasonCode[];
  artifactDigest: string;
  payloadDigest: string | null;
}

export type PinnedG20464InternalAdjudicationReasonCode =
  | "g20464-adjudication-artifact-digest-mismatch"
  | "g20464-adjudication-artifact-malformed"
  | "g20464-adjudication-consensus-mismatch"
  | "g20464-adjudication-identity-mismatch"
  | "g20464-adjudication-judgments-mismatch"
  | "g20464-adjudication-local-proof-boundary-mismatch"
  | "g20464-adjudication-payload-digest-mismatch"
  | "g20464-adjudication-payload-malformed"
  | "g20464-adjudication-source-record-mismatch"
  | "g20464-adjudication-verified";

export interface PinnedG20464InternalAdjudicationVerification {
  valid: boolean;
  reasonCodes: PinnedG20464InternalAdjudicationReasonCode[];
  artifactDigest: string;
  payloadDigest: string | null;
}

const SNAPSHOT = GREEK_RECONSTRUCTION_SOURCE_DIGESTS;

/**
 * Semantic trust anchor for the exceptional STEP form alias G0567. The
 * occurrence corpus digest covers all six raw TAGNT alias occurrences,
 * including their native locators, glosses, morphology, primary dStrong,
 * alias Strong, references, and the complete pinned TAGNT source set.
 */
export const PINNED_G0567_FORM_ALIAS = Object.freeze({
  aliasStrong: "G0567",
  primaryDStrong: "G0568",
  uStrong: "G0568",
  relationKind: "form_of" as const,
  occurrenceCount: 6,
  references: Object.freeze([
    "1Pet.2.11",
    "1Thess.4.3",
    "1Thess.5.22",
    "1Tim.4.3",
    "Acts.15.20",
    "Acts.15.29"
  ]),
  morphologyCounts: Object.freeze({
    "V-PMM-2P": 1,
    "V-PMN": 5
  }),
  occurrenceCorpusDigest:
    "236bc7b85683a45f563c3f1c29b8e11ee641ac0b1e6aaf51a9ed9cd7782bd569"
});

/**
 * Empty exact-dStrong corpora are positive evidence, not missing data. These
 * digests bind the Strong identity and the TAGNT channel to an explicitly
 * empty canonical occurrence list. They therefore differ for G8216 and
 * G20765 even though both counts are zero.
 */
export const PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA = Object.freeze({
  G1507: "3ed8b3e6dd5072514b92ff2952193d013661caebbe8dde1bca3631b006d887d0",
  G1970: "c7f33736d2b1116725c6ebb461af4dcdd8cf495c9f66699d38db39e16c83856e",
  G6243: "1371cd306e530e912fa43bb57769cd20d82853b1ac1cabdc531d147a99481b43",
  G8216: "06889d7c68de7bed23dab02a4a38171656defa45bbba45f8702135d449936f85",
  G20014: "c11fee551029e25f841dd2ded667f99b85eba8bb5bf03c9c7adf7abad1505038",
  G20128: "c714894452ee2a8d9b6054dbed4cb9e5a71c04b88dd16f5339c5907b649f6045",
  G20209: "2c27ec1597fefb3e8b76ec5ad0d419e716caff3a475b6391343d6167977fbd62",
  G20278: "a1a01de5e1d2b890215421033c60389695e1515afd0d1b0258e0683f31263588",
  G20394: "3e595434121897e26b13dd85bb78774f79f9f03a224e29615ccb469f33a3eb9b",
  G20464: "ff34149786c31b0c8fea544fc769ab3f9b4124a2dd5759629b3b0d82061a936a",
  G20467: "51553f38871e6508588f1f6a695e94e29332930c1e48724e8154d054e554857f",
  G20490: "2dbe5579dd44c0b31afc907774882ebfb68a2dec34f9c6e1b9c61f20254168fc",
  G20583: "4550895c7b4ec0cf08a2ad87f2c17e6060410e4ae4027dd97b97c2be594b4fc8",
  G20654: "593b798d471d6a550ed3d0ae31a8d55ed5609aa10ced652fd776203fca35af6c",
  G20665: "e07024783222ca7f4b8f390dc7e26f5018234160e4d2c2ad045aed4f9f41ce4a",
  G20765: "7e5d2c34968773c22ecb99091729410f9c74bc5352ed1866a492da7230d7b083",
  G20937: "9475151827db1c8f4bc33394d45e4c1b45247ab12cb6c67ad69a009b84a32162",
  G21057: "a640b162dbd50626af79d01a9bdb2e12c28189368d7115093193606c0b7dba92",
  G21118: "a1151fe2622a89663c54ed87c69ab21d68055d7dbc41aa2632559ef3847d208b",
  G21241: "4866788afe43df65b5dd8bfa069b40793c1452af60e3f82455931c1fafbbd8e5",
  G21273: "492e0bce3e6b0807c3b98b5e1904732ec41f221eafe920673c11c8ce8084e848"
});

const RULE_DEFINITIONS: readonly GreekReconstructionRuleDefinition[] = [
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G0001H@1",
    entryKey: "greek:G0001H",
    code: "G0001H",
    classification: "source-replacement",
    expectedSourceRecordDigest:
      "59c788e6ce46d5750ba5de1a62a637a382d1ade7893ee343f571a1b86b683332",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("perseus.lsj", SNAPSHOT.perseusLsj),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "perseus.lsj.n3.fragment",
        "Perseus",
        "raw-fragment",
        "grc.lsj.perseus-eng1.xml#entryFree[id=n3]",
        "c6db2a6fa2024976aae6b3e197dc9fde9865fc7f0168bd796100a8e1a4ddf420",
        "primary"
      ),
      witness(
        "perseus.lsj.n3.semantic-payload",
        "Perseus",
        "semantic-payload",
        "urn:cite2:scaife-viewer:dictionaries.v1:lsj-n3",
        PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST,
        "primary"
      ),
      witness(
        "legacy.G0001",
        "legacy",
        "legacy-row",
        "strong:G0001",
        "948b6fe5b62204221f3936cb2857589a84b711c974111956a3e0b61cc73aa2a6",
        "conflicting-base"
      )
    ],
    expectedOccurrenceCount: null,
    output: output(
      "ah!",
      "ἆ, an exclamation expressing emotions such as pity, envy, or contempt, and also used in reproofs or warnings; it may stand with an adjective, alone, or doubled.",
      "1b16d2dbd483f47b2b043bb6c7df4558338178ba6b2ac2c436878938de02f92a"
    ),
    identityPatch: { pronunciation: "" },
    rationale:
      "The local notices are attached to another headword; pinned LSJ n3 identifies ἆ and the copied Alpha pronunciation is cleared."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G0567@1",
    entryKey: "greek:G0567",
    code: "G0567",
    classification: "source-reconciled-form-alias",
    expectedSourceRecordDigest:
      "1a35f9a91542f53d8936166f26aa5e1d6c253ee5e7020a2dd7fce7eb7a4ffd91",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation)
    ],
    witnesses: [
      witness(
        "TBESG.G0567.raw-row",
        "TBESG",
        "raw-fragment",
        "exact LF-delimited TBESG line beginning G0567\\t",
        "fc4bf85ca9f133db7505567ac2db47464090440f5c11e44af3ff1cedcffdb0c9",
        "primary"
      ),
      witness(
        "TBESG.G0568.middle-segment",
        "TBESG",
        "lexicon-slice",
        "G0568 substring from Mid., <b>to abstain</b>: through .†",
        "a377a35237b6e9a6adb6648f900cfe988f92e5056be56b35557f415bc0ae6b4d",
        "primary"
      ),
      witness(
        "TFLSJ.G0567.middle-segment",
        "TFLSJ",
        "lexicon-slice",
        "G0567 substring from middle section II through before section III",
        "3621c32f409fe03dd4b190aee524281c654bb17d572612cc5348a0b7c8d73095",
        "corroborating"
      ),
      witness(
        "TAGNT.G0567.alternate-alias-corpus",
        "TAGNT",
        "alternate-alias-corpus",
        "six exact alternate-Strong G0567 aliases whose primary dStrong is G0568",
        PINNED_G0567_FORM_ALIAS.occurrenceCorpusDigest,
        "primary"
      )
    ],
    expectedOccurrenceCount: PINNED_G0567_FORM_ALIAS.occurrenceCount,
    output: output(
      "to abstain",
      "<b>ἀπέχομαι</b>, a middle-voice form of <b>ἀπέχω</b>: <b>to keep oneself away from</b> something; <b>to abstain</b> or <b>refrain</b>. In the New Testament, with the genitive: Acts 15:29; 1 Tim. 4:3; 1 Pet. 2:11; with <b>ἀπό</b>: Acts 15:20; 1 Thess. 4:3; 5:22.",
      "712eabbef66f790d5b9ec9dac8aa98bb7e0df60113942825cb9023dc609b42ab"
    ),
    identityPatch: {},
    rationale:
      "STEP declares G0567 as a form of G0568, and exactly six middle-voice TAGNT tokens carry G0567 only in Alternate Strong while retaining G0568 as their primary dStrong. The reconstructed notice publishes only that attested middle-voice abstain/refrain sense."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G1489@1",
    entryKey: "greek:G1489",
    code: "G1489",
    classification: "composition",
    expectedSourceRecordDigest:
      "02b6931232cad86ff140393bc6b709c3fa04fad71d7fc6c4bfaf5ae8cb40f6e9",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TFLSJ.G1489.slice",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ εἴγε / εἴ γε conditional slice",
        "be91509027cfcecb4270e9e5bf0aa983f89e03cc57824f376dd5628ffe927b74",
        "primary"
      ),
      witness(
        "TAGNT.G1489.adjacent-groups",
        "TAGNT",
        "occurrence-corpus",
        "five exact adjacent εἰ + γε groups",
        "2e042777da6015c768b71494c594dcbac5037c2d0398b24437fb7acea635ce14",
        "primary"
      ),
      witness(
        "legacy.G1489",
        "legacy",
        "legacy-row",
        "strong:G1489",
        "4460a5e592fdff3b309ba2269ce36d742c7298ba1e9a74d9e920eca81ba5d0a5",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 5,
    output: output(
      "if indeed",
      "εἴγε (also written εἴ γε), a conditional expression meaning “if indeed” or “if really,” with γε adding emphasis to the condition.",
      "341a313b51e113d99f0e0ffcbacd134f373f6be0726a2f71f8fb9c1e9b29b225"
    ),
    identityPatch: {},
    rationale:
      "The notice is reconstructed from the exact TFLSJ slice and all five compositional TAGNT occurrences; the unrelated sense ‘otherwise’ is removed."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G1490@1",
    entryKey: "greek:G1490",
    code: "G1490",
    classification: "composition",
    expectedSourceRecordDigest:
      "df4713252dfc614313c5ba86c263fe7a4fbd05ad2c8fc4fc64db13764a0e4bcf",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TFLSJ.G1490.slice",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ εἰ δὲ μή(γε) conditional slice",
        "b5e3d540c40d2944e0109708c867d0499d8606fae0d4dfe9e222cc9a9c186154",
        "primary"
      ),
      witness(
        "TAGNT.G1490.sequences",
        "TAGNT",
        "occurrence-corpus",
        "fourteen exact εἰ δὲ μή(γε) sequences",
        "e836c47138e442dbb67f3ec3d499fe65e3e232e23083cf98d4f0b04141e59c4c",
        "primary"
      ),
      witness(
        "legacy.G1490",
        "legacy",
        "legacy-row",
        "strong:G1490",
        "1152fc194e5f71728689ae8dc49d004ee38d30005f04c238a0bddefed20cd3ef",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 14,
    output: output(
      "but if not; otherwise",
      "εἰ δὲ μή(γε), a conditional expression meaning “but if not” or “otherwise”; final γε, when present, adds emphasis.",
      "5b5e1a16f91b238d6a63b91b39c9d0a2423b6b3575a8efe4594838983cdb79e9"
    ),
    identityPatch: {},
    rationale:
      "The notice is reconstructed from the exact TFLSJ phrase and fourteen exact compositional TAGNT sequences."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G1503@1",
    entryKey: "greek:G1503",
    code: "G1503",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "72594030a1d7236aef99b3ab1b68e5a5bccd0f7f476787e94c6d489fc6f6acb6",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G1503.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 1643, byte 927352; exact UTF-8 row without LF",
        "16a5f6bc6b552f238e42638539bea719c7982fc234fcb597a1f271150526c90b",
        "primary"
      ),
      witness(
        "TFLSJ.G1503.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 1616, byte 5255292; exact UTF-8 row without LF",
        "e3096a938b55f306273f36a3d0c817f02071355ff1a95b41a3c59c3368cc53f2",
        "corroborating"
      ),
      witness(
        "TAGNT.G1503.exact-occurrence-corpus",
        "TAGNT",
        "exact-occurrence-corpus",
        "Jas.1.6#10 and Jas.1.23#11 exact G1503 tokens across the pinned TAGNT corpus",
        "aa4c140f4a6ce2ee2e62555ad7ab7a7b8fbbf176f02168145672502fd2d105e6",
        "primary"
      )
    ],
    expectedOccurrenceCount: 2,
    output: output(
      "to resemble",
      "<b>εἴκω</b> (chiefly in the perfect <b>ἔοικα</b>, with present force): <b>to be like</b> or <b>resemble</b>.",
      "ee877254f1bc97eabb24a39b34815051f9ec7c4ee797a8dcd14f515cd97d3997"
    ),
    identityPatch: {},
    rationale:
      "The exact TBESG and TFLSJ notices, together with both exact TAGNT occurrences, support the present-force meaning while preserving the STEP headword and identity."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G1507@1",
    entryKey: "greek:G1507",
    code: "G1507",
    classification: "direct-alias-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "bd3482ca11924f8ad7f5b18478750d6125ab91bd7b1bae4e8c18128f34b00e9e",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G1507.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 1647, byte 929823; exact UTF-8 row without LF",
        "9bd4f16c0f91033cca617878105561918ea280f7a1e3473dac958226c396b03b",
        "primary"
      ),
      witness(
        "TFLSJ.G1507.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 1620, byte 5279488; exact UTF-8 row without LF",
        "04e3e4222222a6e5e445d81f9630c3da64981f43d08f1b9338f1516100936454",
        "primary"
      ),
      witness(
        "TAGNT.G1507.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G1507 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G1507,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to roll up",
      "<b>εἱλίσσω</b>, a spelling variant of <b>ἑλίσσω</b> (G1667): <b>to roll</b>, <b>wind round</b>, or <b>roll up</b>.",
      "b9bd499e8758c565a81b2164ea026c71261f17281a3cadd8c8d884fd87243b74"
    ),
    identityPatch: {},
    rationale:
      "The explicit STEP spelling relation and exact TFLSJ variant notice support the definition; the zero exact G1507 corpus prevents transferring G1667 occurrences into this sub-entry."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G1970@1",
    entryKey: "greek:G1970",
    code: "G1970",
    classification: "direct-source-extraction",
    confidence: 0.98,
    expectedSourceRecordDigest:
      "d07c38ab98708de32a970cc4ac8a3bb7de84ed077227c9fa2c980f3376f6ba93",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G1970.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 2111, byte 1247327; exact UTF-8 row without LF",
        "40940a3d32802a9bfba105acce64190cbe6c41625cc254b9e1390a7e6fa0d0e1",
        "primary"
      ),
      witness(
        "TFLSJ.G1970.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 2084, byte 7203379; exact UTF-8 row without LF",
        "e144b45cb07ecd28a1b6e37571f318f2ef96adc0e54758269a14ae84af0878f7",
        "corroborating"
      ),
      witness(
        "TAGNT.G1970.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G1970 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G1970,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to choke",
      "<b>ἐπιπνίγω</b>: <b>to choke</b> or <b>stifle</b>; figuratively, <b>to overgrow and choke</b>.",
      "72d29fee60d4adecb6df35f563e143619b82911095062010f74e5566b6f63cf7"
    ),
    identityPatch: {},
    rationale:
      "The exact source meaning is extracted after correcting its transcription error; the component identities remain witnesses only and receive no transferred occurrences or relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G2199H@1",
    entryKey: "greek:G2199H",
    code: "G2199H",
    classification: "entity-template",
    expectedSourceRecordDigest:
      "b566b50667abbd3a90b09d24e29138fb41bce91294dffe0931a09f2ed70ac2c8",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TIPNR.people", SNAPSHOT.tipnrPeople),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TIPNR.G2199H.root",
        "TIPNR",
        "entity-record",
        "people.json unique dStrong G2199H root object",
        "99666f01c6d87cb6cf832db1feed736341ed7536e827693c383f628f41438913",
        "primary"
      ),
      witness(
        "TIPNR.G2199H.relationships",
        "TIPNR",
        "entity-record",
        "Matt.20.20; partner Zebedee; offspring James and John",
        "e254eb4ec39351c046b4a8b5dd1a394b29fd6b3d096fcdaccde325deb5ae7e7e",
        "primary"
      ),
      witness(
        "legacy.G2199",
        "legacy",
        "legacy-row",
        "strong:G2199 base Zebedee row",
        "8ac589a5021add61213270f00de73d9dfa6dd33d225d7e3944cf1dad830ec51a",
        "base-context"
      )
    ],
    expectedOccurrenceCount: null,
    output: output(
      "[wife of Zebedee]",
      "An unnamed woman identified as Zebedee’s wife and as the mother of James and John in Matt. 20:20.",
      "7ec1b34a0497661e1dbf6e17410cc436e32292aafd0017dd6a9575a572d51450"
    ),
    identityPatch: {
      original: "",
      transliteration: "",
      classicTransliteration: "",
      pronunciation: "",
      morph: ""
    },
    rationale:
      "This is a TIPNR entity without a lexical headword; copied Zebedee identity fields are cleared instead of published as the woman’s identity."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G2424K@1",
    entryKey: "greek:G2424K",
    code: "G2424K",
    classification: "entity-template",
    expectedSourceRecordDigest:
      "ce679873eb3f72b31e7e429d3fea0c957ddb7e4706995a34f2d27a39ca0ea791",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TIPNR.people", SNAPSHOT.tipnrPeople),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TIPNR.G2424K.root",
        "TIPNR",
        "entity-record",
        "people.json unique dStrong G2424K root object",
        "9520aef790a2245b2469ee66a8f07363bb7724fd22dca3a10c1aedee434fbc57",
        "primary"
      ),
      witness(
        "TIPNR.G2424K.relationships",
        "TIPNR",
        "entity-record",
        "Luke 3:29; son of Eliezer; father of Er; Jose variant",
        "d9a186756784b0b5dcd0ff32c01a8ccf4c952ced57137e5f44180c337ed7b299",
        "primary"
      ),
      witness(
        "TAGNT.G2424K.direct",
        "TAGNT",
        "occurrence-corpus",
        "Luke.3.29 direct occurrence",
        "946f1ebab36d8f0e60161d8f58338b26fb36d3fc101c6b41f0955e97d06476af",
        "primary"
      ),
      witness(
        "legacy.G2424",
        "legacy",
        "legacy-row",
        "strong:G2424 base row",
        "8b3d182473764f370e777299e8b77bf5328de4d888058d6e9dd1ffff617bb2ec",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 1,
    output: output(
      "Joshua",
      "Joshua (a textual variant reads Jose), son of Eliezer and father of Er in Jesus’ genealogy at Luke 3:29.",
      "30b2a36e653e2cfacd9e39d20a248421c2f6b8fac50c0a3839278a4a50c7d00e"
    ),
    identityPatch: {},
    rationale:
      "TIPNR identity and relationships are constrained by the single direct TAGNT occurrence and the documented textual variant."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G2501O@1",
    entryKey: "greek:G2501O",
    code: "G2501O",
    classification: "entity-template",
    expectedSourceRecordDigest:
      "618b02814a68c95b583ab7dd08153130eaa37463c01d1150dc1538f82134c476",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TIPNR.people", SNAPSHOT.tipnrPeople),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TIPNR.G2501O.barnabas",
        "TIPNR",
        "entity-record",
        "people.json Barnabas root object",
        "6b10ac25a7dbf654a68d579e28310db0aa61c1b9b1b5eaab6c7729fd48eefa0e",
        "primary"
      ),
      witness(
        "TIPNR.G2501O.identity",
        "TIPNR",
        "entity-record",
        "Acts 4:36; Levite from Cyprus; Barnabas; Joses variant",
        "5f1df7325346fc5e90669fd2e006625b9bd0361daa9e8e4175a4b41b66153f09",
        "primary"
      ),
      witness(
        "TAGNT.G2501O.direct",
        "TAGNT",
        "occurrence-corpus",
        "Acts.4.36 direct occurrence",
        "1b2211533331c3d40d13ad58ad7fe612b877f404dfe79c8c9f5629be0b3a546d",
        "primary"
      ),
      witness(
        "legacy.G2501",
        "legacy",
        "legacy-row",
        "strong:G2501 base row",
        "93a713da9ab43e39ca16fe63264f4c828fc147500aa9944f69af2c3a515cf50e",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 1,
    output: output(
      "Joseph",
      "Joseph, the name of the Levite from Cyprus whom the apostles called Barnabas, at Acts 4:36; a textual variant reads Joses.",
      "e717d0e18189805632eb1e2181e5fd0d6c2e1a212b102ccc6b5e53706764a3fa"
    ),
    identityPatch: {},
    rationale:
      "TIPNR entity facts are tied to the one direct TAGNT occurrence and distinguish this variant from the base Joseph row."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G4245G@1",
    entryKey: "greek:G4245G",
    code: "G4245G",
    classification: "sense-extraction",
    expectedSourceRecordDigest:
      "ee6f5f041d215f0cd5f327f80665990e4511f460fb9f54c36d5934003da917cd",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TBESG.G4245G.office-sense",
        "TBESG",
        "lexicon-slice",
        "πρεσβύτερος sense 2 status or office",
        "a18350af820cb39c6e98d750e1a09c176380a0ab11c0a673d2799313bc3807be",
        "primary"
      ),
      witness(
        "TBESG.G4245G.traditional-elders",
        "TBESG",
        "lexicon-slice",
        "ancestral or traditional elders sub-sense",
        "58a67849267acf5a1819e19c14ab939775651479cd2303135b3fd97be6e16da2",
        "primary"
      ),
      witness(
        "TAGNT.G4245G.direct",
        "TAGNT",
        "occurrence-corpus",
        "sixty exact G4245G occurrences, excluding G4245H",
        "7121a81e5452389045aff0955a0338b9342c6bf0412d5ed9c1052fc8685dd5c0",
        "primary"
      ),
      witness(
        "legacy.G4245",
        "legacy",
        "legacy-row",
        "strong:G4245 base row",
        "e77d6b41350e105815c0e0c1ebe3588b67bb1aa889b779fd5ff27a92690ad5c2",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 60,
    output: output(
      "elder (leader)",
      "πρεσβύτερος, “elder” in the sense of status or office: a recognized leader among Jews or Christians, or one of the elders in Revelation; also used of ancestral elders whose tradition is cited.",
      "6897175e7827e41fe6b052dd0c0b62b2810114a379bebc5e9740b7c9aeecb951"
    ),
    identityPatch: {},
    rationale:
      "Only the exact status-or-office sense is retained; the separate G4245H age sense is excluded."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G5441@1",
    entryKey: "greek:G5441",
    code: "G5441",
    classification: "identity-repair-exact-extraction",
    expectedSourceRecordDigest:
      "46cb24ba5e3e62ca6d824635919b68823dc903f3935d5210c4c3bc82ab7336c1",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TBESG.G5441.full",
        "TBESG",
        "lexicon-slice",
        "exact φύλαξ brief definition",
        "8fe42b0c40afdd221f86cdf47d0d4871c63deae04295569367cea40c3fc3b0a8",
        "primary"
      ),
      witness(
        "TAGNT.G5441.direct",
        "TAGNT",
        "occurrence-corpus",
        "Acts 5:23; 12:6,19 exact occurrences",
        "4fdf9c8660f4cb9117386892f4af8406ef23cb1b67a18a7926ee1a736fd0a580",
        "primary"
      ),
      witness(
        "legacy.G5441",
        "legacy",
        "legacy-row",
        "strong:G5441",
        "e66fcc30576c6565ca929703d42466152254fc3d44aefca25e65285625581702",
        "corroborating"
      )
    ],
    expectedOccurrenceCount: 3,
    output: output(
      "guard; keeper",
      "φύλαξ, -ακος, ὁ, a guard or keeper (Acts 5:23; 12:6, 19).",
      "085d08d91d212bc217137a44dc3830c8b051e2a071a45a1aa92ff8cf06fb77fa"
    ),
    identityPatch: { original: "φύλαξ", transliteration: "phulax" },
    rationale:
      "The exact brief definition and all three occurrences support the entry after repairing its copied headword and transliteration."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G6087@1",
    entryKey: "greek:G6087",
    code: "G6087",
    classification: "composition",
    expectedSourceRecordDigest:
      "971ce2c2f86035e33ff4d60e1fb1ed56486a04069aade454af4a20a944a69faa",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("legacy.database", SNAPSHOT.legacyDatabase)
    ],
    witnesses: [
      witness(
        "TAGNT.G6087.composition",
        "TAGNT",
        "occurrence-corpus",
        "three exact ὑπέρ + ἐκ περισσοῦ compositions",
        "81ef8f9714c01947c471a8e5f70bcf7f416a5a889519e53ad683940fb78e6254",
        "primary"
      ),
      witness(
        "TBESG.G4053.cross-reference",
        "TBESG",
        "cross-reference",
        "G4053 ἐκ περισσοῦ cross-reference slice",
        "db55c2110c06a11cff7c1048cbdf4da6d8f0fc7829b66825d8a9e1cd4d2147d3",
        "primary"
      ),
      witness(
        "STEP.G4057.source-record",
        "TBESG",
        "cross-reference",
        "validated G4057 source record",
        "91460d8aafb557ff16ad8489d64a80e185402829eea309f660f85dc98350194f",
        "corroborating"
      ),
      witness(
        "STEP.G4057.meaning",
        "TBESG",
        "cross-reference",
        "validated G4057 meaning",
        "60e85008c17dc463e98824cf595e7861ae3307f00669256c919bbc721147cda9",
        "corroborating"
      ),
      witness(
        "legacy.G6087.absent",
        "legacy",
        "legacy-absence",
        "no G6087 row; legacy maximum Greek code is G5877",
        null,
        "negative"
      )
    ],
    expectedOccurrenceCount: 3,
    output: output(
      "exceedingly abundantly; beyond measure",
      "ὑπερεκπερισσοῦ, an emphatic adverb formed from ὑπέρ + ἐκ περισσοῦ, meaning “exceedingly abundantly” or “beyond measure”; Eph. 3:20; 1 Thess. 3:10; 5:13.",
      "c3b065f5db20f01dc679dcb30f0c10e9d7e735af308c2190202fa459fd5f69d2"
    ),
    identityPatch: {},
    rationale:
      "The quarantined copied G6029 notice is replaced by the exact three-part TAGNT composition, corroborating component notices, and verified legacy absence."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G6243@1",
    entryKey: "greek:G6243",
    code: "G6243",
    classification: "morphological-reconstruction",
    confidence: 0.98,
    expectedSourceRecordDigest:
      "822c87166f8d9d1320d5cedb96f38a713a94b3af99890768501d1c1d8c373713",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G6243.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 6028, byte 3680973; exact UTF-8 row without LF",
        "729f1889b167091a79bda24dbf13ea6333c9c3de97bf7167eb5d1a22a31d2651",
        "primary"
      ),
      witness(
        "TBESG.G6242.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 6027, byte 3680806; exact G6242 UTF-8 row without LF",
        "67c4887da1c858a3579a31ec0b1b2d79c4a9addaa873d19bbee58e9d54b7e6e8",
        "corroborating"
      ),
      witness(
        "TAGNT.G6243.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G6243 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G6243,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "wooded",
      "<b>ἀλσώδης</b>: <b>wooded</b> or <b>full of groves</b>.",
      "3a02632b107726fb39ffa463955545bf835e01d4fb10c8081a33022c8cd86f8a"
    ),
    identityPatch: { morph: "G:A" },
    rationale:
      "The adjectival formation from the pinned grove witness requires an adjective, not the copied noun morphology or the ungrammatical source gloss. No STEP relation to G6242 is introduced."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G8216@1",
    entryKey: "greek:G8216",
    code: "G8216",
    classification: "source-reconciled-homograph/accent-confusion",
    expectedSourceRecordDigest:
      "fc70897e95b5f39a8448df442a68f63775cb3ff8b213d766ea7a5eb5145da691",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation)
    ],
    witnesses: [
      witness(
        "TBESG.G8216.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 7996, byte 4094134; exact UTF-8 row without LF",
        "23c1ce9d12b161a149c1ba60dc3e667d26c536920b9236ec45f04530f69b223f",
        "primary"
      ),
      witness(
        "TBESG.G8216.raw-meaning",
        "TBESG",
        "semantic-payload",
        "G8216 exact raw meaning beginning shortened doric form for μάτηρ",
        "f7ebc97499b9c594752dfa415ec20f7c2879ec45a05a5936c0e63bd1dfd4bd66",
        "primary"
      ),
      witness(
        "TFLSJ.G3483.mu-acute-oath-fragment",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 3569, byte 13200857 including UTF-8 BOM (13200854 after BOM); exact fragment ν. μά <b>yea by</b>..",
        "f17f7e6495a3f717ece4dfaef890921da8e73e378cb2b035ebf4f4d5c54a2be7",
        "conflicting-base"
      ),
      witness(
        "TAGNT.G8216.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G8216 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G8216,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "mother!",
      "<b>μᾶ</b>, a shortened Doric vocative of <b>μάτηρ</b> (“mother”), used in direct address; e.g. <b>μᾶ γᾶ</b>, “Mother Earth,” for <b>μῆτερ γῆ</b>.",
      "435a6503e871cda78732c638296095c30c835dcf00f84dc56d9ff531b85f5735"
    ),
    identityPatch: {},
    rationale:
      "The raw G8216 row consistently identifies circumflex μᾶ as a shortened Doric form of μάτηρ and supplies direct-address examples. The source gloss ‘by!’ belongs to the acute homograph μά, independently pinned in TFLSJ, so the reconstruction corrects the accent-confused sense without changing the STEP identity."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20014@1",
    entryKey: "greek:G20014",
    code: "G20014",
    classification: "editorial_reconstruction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "3a149712f171a28fb80c14443f717db77cf023b4c32bcaa2f357a8362c93a755",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20014.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 9653, byte 4530926; exact G20014 UTF-8 row without LF",
        "c57890d9ea80fe3ce80515a1ed82415431b1a62749163209cebb43993714437e",
        "primary"
      ),
      witness(
        "TBESG.G0058.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 153, byte 50156; exact reciprocal G0058 UTF-8 row without LF",
        "49b66c1d59c8b14121447c2e2844cfba87f3fd2c050fd5ef81ca34fbc510cb58",
        "primary"
      ),
      witness(
        "TFLSJ.G3739.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 3829, byte 14323758; exact contextual street witness without LF",
        "1bb67451c095c4f00a1bff958579f0c7b9f3f5eed4e33a0bfef9ca848906334f",
        "corroborating"
      ),
      witness(
        "TAGNT.G20014.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20014 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20014,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "street",
      "<b>a street</b>; compare ἀγορά (G0058). In the LXX: 3Ma.1:20; 4:3.",
      "a359b967941d0028a0fcbc3c397ef2acf90394cb8a939dea39ca77685d28e7f8"
    ),
    identityPatch: {},
    rationale:
      "The exact target row preserves the unsuffixed G20014 identity and an explicit ἀγορά cross-reference; the reciprocal G0058 row and an independent TFLSJ contextual translation resolve the headword narrowly as ‘street’. The empty exact TAGNT corpus prevents occurrence transfer."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20128@1",
    entryKey: "greek:G20128",
    code: "G20128",
    classification: "morphological-reconstruction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "b89dfc7148d22599f567d8707577872ca2b5f1cc609ad02c8696b0b18fd7de40",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20128.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 9766, byte 4545358; exact UTF-8 row without LF",
        "ee6d4360e71c54b67ab5d186a39c2e447632f8534558caf2a330fe57789e9fe9",
        "primary"
      ),
      witness(
        "TBESG.G20128.abrupt-fragment",
        "TBESG",
        "semantic-payload",
        "G20128 exact source fragment cut off, abrupt, precipitous",
        "0eec7292aa9ec71a79570055fce1c5048bb0569bb37cd4f0fe8f2296bf292227",
        "primary"
      ),
      witness(
        "TBESG.G20128.severe-fragment",
        "TBESG",
        "semantic-payload",
        "G20128 exact source fragment severe, relentless",
        "72c924ba282a65fc362307ace67d56bd9c386038698d1df8206204d3e4779f32",
        "primary"
      ),
      witness(
        "TAGNT.G20128.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20128 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20128,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "abrupt, precipitous; severe, relentless",
      "<b>ἀπότομος</b>: <b>cut off</b>, <b>abrupt</b>, or <b>precipitous</b>; metaphorically, <b>severe</b> or <b>relentless</b>.",
      "4ad2428849f86403ab7bb3750b4455df92c7f85939c590d8c9ed6ee45a29d603"
    ),
    identityPatch: { morph: "G:A" },
    rationale:
      "Both senses are extracted verbatim from the pinned source row, while the copied noun morphology is corrected to the adjective required by the headword and its uses."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20209@1",
    entryKey: "greek:G20209",
    code: "G20209",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "e1bf7c0ebbc1613e3693051a8e52a02d0d8b96b9d34ba4a18a7ba321fca6dfc7",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20209.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 9847, byte 4559998; exact UTF-8 row without LF",
        "d73f01ef5884bf4cc1388c35be7d030083c7c8be9f0d3762db289b10b01c6ec6",
        "primary"
      ),
      witness(
        "TBESG.G6792.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 6574, byte 3794534; exact G6792 UTF-8 row without LF",
        "3af6accc33a3d71389f6493e5affa728a78dd45fb7b8154087690ecb5ae4554e",
        "corroborating"
      ),
      witness(
        "TAGNT.G20209.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20209 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20209,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "commander of ten",
      "<b>δεκάταρχος</b>: <b>a commander or leader of ten</b>.",
      "72a050d84ca25d9a33dc4f21cfb7d96ecca3041e3c2ea85c9df3a010bda2d229"
    ),
    identityPatch: { morph: "G:N-M" },
    rationale:
      "The truncated source is completed from the exact parallel lexical witness and the masculine agent-noun morphology; G6792 remains a witness, not a STEP relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20278@1",
    entryKey: "greek:G20278",
    code: "G20278",
    classification: "editorial_reconstruction",
    confidence: 0.94,
    expectedSourceRecordDigest:
      "ec30d9c44ee9e2f5fdd55c5f9ba4aa16f4fd6f74be576a379c6feb9d2c90c4a6",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20278.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 9916, byte 4567343; exact G20278 UTF-8 row without LF",
        "62308c2d7959c0b92ebdedae34231ea90b85a2c3355a99de305da9fde5a2b418",
        "primary"
      ),
      witness(
        "TBESG.G7116.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 6896, byte 3857996; exact local word-family witness without LF",
        "10fbb85cc6a4e03d9d50b6dfd2985c9c4ceded44c61a6e35999f5377b35d123b",
        "corroborating"
      ),
      witness(
        "TAGNT.G20278.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20278 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20278,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to divide into companies",
      "<b>ἐγκαταλοχίζω</b>: <b>to divide or organise into companies</b>.",
      "74ba1bb96d1e241ace7702f76653c017e95ac4c37ad666be75e7bcebcaa21539"
    ),
    identityPatch: {},
    rationale:
      "The exact unsuffixed G20278 row supplies the coherent verbal gloss while its one-word meaning is incomplete; the local word-family witness supports the conservative companies formulation, and the empty exact TAGNT corpus remains isolated."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20394@1",
    entryKey: "greek:G20394",
    code: "G20394",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "75d9eee230a4ba755d9708d6b2d8c83f42f2e78303625e5eea6c985413f0144e",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20394.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10030, byte 4584026; exact UTF-8 row without LF",
        "007db376839b47dd4773e02c5c0fac27e2aedd30b62f593277bbac424abc3082",
        "primary"
      ),
      witness(
        "TBESG.G7336.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 7116, byte 3906773; exact G7336 UTF-8 row without LF",
        "5dcf5e8816ac2f33f932a80029bd949d31f62aae2c653c0a66db5757db876632",
        "corroborating"
      ),
      witness(
        "TBESG.G7730.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 7510, byte 3991589; exact G7730 UTF-8 row without LF",
        "4fa24c483b94b7cff77d68f9194ba7c81c5c6db48926ecc95aa48df020973346",
        "corroborating"
      ),
      witness(
        "TAGNT.G20394.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20394 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20394,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to equate",
      "<b>ἐξισάζω</b>: <b>to make equal</b> or <b>equate</b>.",
      "5261d92be89da14d792761dfdbe27f4aabbf364f51747aa1802bbc83c418828d"
    ),
    identityPatch: {},
    rationale:
      "The complete gloss and cognate lexical witnesses replace the opaque bibliographic fragment ‘in R.’ without asserting any new STEP relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20464@1",
    entryKey: "greek:G20464",
    code: "G20464",
    classification: "editorial_reconstruction",
    confidence: 0.94,
    expectedSourceRecordDigest:
      "c487b224a14f635d458802a9b9d21c5141eb71735cb14d88e412085189187e20",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot(
        "internal-adjudication.G20464.artifact",
        PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST
      ),
      sourceSnapshot(
        "internal-adjudication.G20464.artifact-file",
        PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_FILE_DIGEST
      )
    ],
    witnesses: [
      witness(
        "TBESG.G20464.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10098, byte 4593900; exact G20464 UTF-8 row without LF",
        "e7848bd8dd60e9187addb55f43fdd5f25abe50c618f069b21205aae7e8944382",
        "primary"
      ),
      witness(
        "InternalAdjudication.G20464.semantic-payload",
        "InternalAdjudication",
        "semantic-payload",
        "g20464-internal-adjudication.json payload agreed by both independent judgments",
        PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST,
        "primary"
      ),
      witness(
        "TAGNT.G20464.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20464 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20464,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "king bee; priest of Artemis at Ephesus",
      "<b>ἐσσήν</b>: the <b>king bee</b>; also a title of the priest of Artemis at Ephesus.",
      "b508c98d129423b0ebc9b92ebbea660ece51fb4429accaf07c2aeb59e4823aff"
    ),
    identityPatch: { morph: "G:N-M" },
    rationale:
      "The exact unsuffixed G20464 row proves identity but contains only an opaque repeated string. Pinned TFLSJ and TAGNT establish the local proof limit, while two separately recorded internal lexicographic judgments unanimously authorize the explicitly editorial masculine-noun reconstruction."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20467@1",
    entryKey: "greek:G20467",
    code: "G20467",
    classification: "contextual-extraction",
    confidence: 0.96,
    expectedSourceRecordDigest:
      "e4c8a5bdf7b10cf109a3b10be6d868804b29a39d9f3983d94c02c410da9f2198",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20467.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10101, byte 4594182; exact UTF-8 row without LF",
        "b82dc782a1880e44cfe26c7743229e3fcc8c33e0789124b54b3b3496b8812353",
        "primary"
      ),
      witness(
        "TFLSJ.G3741.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 3831, byte 14338575; exact G3741 UTF-8 row without LF",
        "5ed3350ff7856bb2f1206660ec762d5186ef7fd082797761554077ff17b42e57",
        "corroborating"
      ),
      witness(
        "TAGNT.G20467.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20467 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20467,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "pure",
      "<b>εὐαγής</b>: <b>pure</b>, especially in relation to sacred rites.",
      "c0bb975774e18b8bb31bbb3c4150b693ce29c49275ba0d64b8e561013a0ee83b"
    ),
    identityPatch: { morph: "G:A" },
    rationale:
      "The sacred-rite context and adjectival formation correct the unrelated Romanian/Latin carry-over ‘rūgio’; the witness does not create a STEP relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20490@1",
    entryKey: "greek:G20490",
    code: "G20490",
    classification: "direct-alias-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "3f872c02d4bd6f5a7e4beded41ae46cff8fc78d3971b06bddd2bb7e715d1fb9b",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20490.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10124, byte 4596841; exact UTF-8 row without LF",
        "5229644b5804fd46dc746c1eacc4dd6fcfc0c14da2d052a95901cf8a99a82a5e",
        "primary"
      ),
      witness(
        "TFLSJ.G2198.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 2314, byte 8353182; exact G2198 UTF-8 row without LF",
        "013e9a3216d8c9d57cd51ba18b51530b95bbfc69f94b5af237ddd6795c953c3c",
        "primary"
      ),
      witness(
        "TAGNT.G20490.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20490 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20490,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to live",
      "<b>ζῶ</b>, a contracted form of <b>ζάω</b>: <b>to live</b>; of persons, animals, and plants; figuratively, <b>to be alive or vigorous</b>. See G2198.",
      "43bbf5e3de5ef583f4df9fc2662de129a4f6eb27cc01d31a84cfba089ebcee42"
    ),
    identityPatch: { morph: "G:V" },
    rationale:
      "The explicit STEP form relation and exact TFLSJ notice restore the verb sense; the raw ‘spring, spring’ is only the phrase ὕδωρ ζῶν (‘spring water’), not this headword's gloss."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20583@1",
    entryKey: "greek:G20583",
    code: "G20583",
    classification: "morphological-reconstruction",
    confidence: 0.97,
    expectedSourceRecordDigest:
      "7c575b096b7c0ce3d8b97560383c8f02d012d64f956af440659534b5de6e93fc",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20583.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10215, byte 4608698; exact UTF-8 row without LF",
        "f3fb94096eef9cbe370003730ec8ab4fec33140aeaa21d3eb67ea76d385581ce",
        "primary"
      ),
      witness(
        "TBESG.G1830.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 1971, byte 1159885; exact G1830 UTF-8 row without LF",
        "aac6136f1453af3625831d178566e103d5ab5596a009d89858cb6816856d717d",
        "corroborating"
      ),
      witness(
        "TBESG.G2045.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 2186, byte 1289623; exact G2045 UTF-8 row without LF",
        "ba819ad9adef73ba9609edcd4b02dbdf4e79131df16dedfeb71e81970d498fa7",
        "corroborating"
      ),
      witness(
        "TAGNT.G20583.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20583 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20583,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to search thoroughly",
      "<b>κατερευνάω</b>: <b>to search thoroughly</b> or <b>investigate closely</b>.",
      "de760e3aa8648d95aa374fdfaa83aaacc832d01799e0e976cc6101cc53b128c6"
    ),
    identityPatch: {},
    rationale:
      "The Greek verbal formation and both pinned search-verb witnesses replace the unrelated carry-over ‘dīrīmat’ without asserting a STEP relation to either cognate."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20654@1",
    entryKey: "greek:G20654",
    code: "G20654",
    classification: "editorial_reconstruction",
    confidence: 0.94,
    expectedSourceRecordDigest:
      "3f390ba7e965b4b170f3b066946aff6c165d2ebe4519cc86f200b79771eb5e13",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TBESH", SNAPSHOT.tbesh),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20654.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10283, byte 4618216; exact UTF-8 row without LF",
        "18993c70c5a49748f7675bd915eae10f6aa9c50afa07ba5afb23862ad08cbe41",
        "primary"
      ),
      witness(
        "TBESG.G20654.ish-madhon-fragment",
        "TBESG",
        "semantic-payload",
        "G20654 exact raw fragment íš mādhón",
        "74252a3343a57a739717b65f7b61bb029f4268ae88bb666a6796ce05739e9e49",
        "primary"
      ),
      witness(
        "TBESH.H0376G.raw-row",
        "TBESH",
        "cross-reference",
        "TBESH.txt line 546, byte 136257; exact H0376G UTF-8 row without LF",
        "4e72818b021fc1334922ddf529debad62e5ff43a11813012e021a1f33233221c",
        "primary"
      ),
      witness(
        "TBESH.H4066.raw-row",
        "TBESH",
        "cross-reference",
        "TBESH.txt line 5577, byte 1557711; exact H4066 UTF-8 row without LF",
        "4e8118f8cc811d11fbaa28ea6fe5526e7cd32504c26878a9f0435e511b04cd6f",
        "primary"
      ),
      witness(
        "TBESH.H4067.raw-row",
        "TBESH",
        "cross-reference",
        "TBESH.txt line 5578, byte 1557840; exact H4067 stature row excluded",
        "3532e091dd0d335a796f1a8d971f8198dca1d25afb471142902baf79d84eaacf",
        "negative"
      ),
      witness(
        "TBESH.H4068.raw-row",
        "TBESH",
        "cross-reference",
        "TBESH.txt line 5579, byte 1557908; exact H4068 place-name Madon row excluded",
        "9875421756f7810d1e77a54491e24a44b7eeccf021b6a5c145d227fc8730adcd",
        "negative"
      ),
      witness(
        "TAGNT.G20654.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20654 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20654,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "a man of strife",
      "<b>μαδών</b>, corresponding to Hebrew <b>אִישׁ מָדוֹן</b>: <b>a man of strife</b> or <b>a contentious person</b>.",
      "1186d378b529d9884c99b38b66c5c338391a7cfa3b744f99273cb5ca20e58159"
    ),
    identityPatch: {},
    rationale:
      "This explicit editorial reconstruction expands the source's Hebrew phrase through the exact man and strife witnesses while excluding the homographic stature and place-name rows. It creates no STEP relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20665@1",
    entryKey: "greek:G20665",
    code: "G20665",
    classification: "editorial_reconstruction",
    confidence: 0.96,
    expectedSourceRecordDigest:
      "f7d233bb8bf7624262b85be4cad5a8f966fc8e1372003ba706c5197a7d6d1687",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("kaikki.fr", SNAPSHOT.kaikkiFrench),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20665.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10294, byte 4619223; exact UTF-8 row without LF",
        "1f9f7718e3905c988e398afff90f2f35c301a795400175db84220d03522be1ad",
        "primary"
      ),
      witness(
        "Kaikki.fr.manticore.raw-row",
        "Kaikki",
        "lexicon-slice",
        "kaikki.org-dictionary-French.jsonl line 2484, byte 8480400; exact UTF-8 row without LF",
        "b23c381205de2af0dcc10db9b192df444a5ec4f8f99b3baa6cfb0f971d10ff57",
        "corroborating"
      ),
      witness(
        "TAGNT.G20665.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20665 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20665,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "manticore",
      "<b>μαρτιχόρας</b>: the <b>manticore</b>, a mythical man-eating creature.",
      "49ccceff74400b0b2bb4bb2983e4e499159d2336b8c648d01c2eccd5fe34c346"
    ),
    identityPatch: { morph: "G:N-M" },
    rationale:
      "STEP preserves the exact Greek headword and the Iranian etymon mard-khwār but no English definition. This editorial reconstruction identifies the mythological creature through the independently pinned Kaikki manticore record and keeps the zero-occurrence supplemental STEP identity isolated."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20765@1",
    entryKey: "greek:G20765",
    code: "G20765",
    classification: "editorial-morphological-reconstruction",
    expectedSourceRecordDigest:
      "687cd93d41079033d4d0cefb080ec763ff3b8e1c8827cdae5f62c1dbb38527db",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation)
    ],
    witnesses: [
      witness(
        "TBESG.G20765.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10394, byte 4631880; exact UTF-8 row without LF",
        "6bc5369707fc049348490c8c2a9517c38fc72761d2ca63dbabf7d18abd58ab39",
        "primary"
      ),
      witness(
        "TBESG.G20765.unpublished-papyrus-fragment",
        "TBESG",
        "raw-fragment",
        "G20765 exact bibliographic fragment PLond.ined.",
        "ca40a517362ec757c6151999f307d77eaab13f014ddab4c217fe58076f772eb2",
        "base-context"
      ),
      witness(
        "TBESG.G3448.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 3561, byte 2217105; exact G3448 UTF-8 row without LF",
        "719ee4d2a0dac0a7627c6cea79f1ef1f97bc3fe01ea98a0f63fe8282789d4876",
        "corroborating"
      ),
      witness(
        "TBESG.G3448.young-shoot-fragment",
        "TBESG",
        "lexicon-slice",
        "G3448 exact fragment a young shoot or twig.",
        "0923b43a07903a312f010009d9abd71142397d30bff1692470fc428f5d98781d",
        "primary"
      ),
      witness(
        "STEP.G3448.source-record",
        "STEP",
        "source-record",
        "greek:G3448 exact source-record projection in the pinned STEP SQLite",
        "d5e9ba7019ddc1091d2e6d34a584328ba8d7a8435d86b629570dcee12b07c5ec",
        "corroborating"
      ),
      witness(
        "TAGNT.G20765.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20765 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20765,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "a plant cutting",
      "<b>μόσχευμα</b>, a young shoot or plant cutting; a scion. The STEP source cites an unpublished London papyrus (<i>P.Lond. ined.</i>).",
      "444253c73cb873c587b45939dc5ad097e34fc2b6c6ef060f6fc0dbf63fb967e1"
    ),
    identityPatch: {},
    rationale:
      "STEP supplies only the unpublished-papyrus citation, not a direct definition. This explicitly editorial reconstruction derives the plant-shoot sense morphologically and binds it to the exact G3448 ‘young shoot or twig’ witness; it does not declare G20765 a STEP relation or merge either identity."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G20937@1",
    entryKey: "greek:G20937",
    code: "G20937",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "9376ae6714fc5af8faa9988d399012d92c4a9c315f12f3ddde9117ff0a8e488f",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G20937.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10564, byte 4656580; exact UTF-8 row without LF",
        "58fe831758623666faacadb738630b8ae3f296a7ef21b0222b4c863b64612288",
        "primary"
      ),
      witness(
        "TBESG.G1041.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 1163, byte 573874; exact G1041 UTF-8 row without LF",
        "e1d0b4c3e244ab3f18ee1f8a63dc66ad86ca3d3dfe09ff982cd80d03db4c4dbb",
        "corroborating"
      ),
      witness(
        "TAGNT.G20937.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G20937 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G20937,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "space around an altar",
      "<b>περιβώμιος</b>: <b>around an altar</b>; substantivally, <b>the space around an altar</b>.",
      "b8a17799e687ab69afe71cf5ce10bc7346bb2d06b85f66d7b9959591e3985a5f"
    ),
    identityPatch: { morph: "G:A" },
    rationale:
      "The truncated phrase is completed from the adjectival formation and exact altar witness; G1041 remains corroboration only and is not added as a STEP relation."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G21057@1",
    entryKey: "greek:G21057",
    code: "G21057",
    classification: "editorial_reconstruction",
    confidence: 0.92,
    expectedSourceRecordDigest:
      "081aebb4da542448a7a38c317bc4febbf8f55dffcddc567c454815f5af26f480",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G21057.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10683, byte 4674085; exact UTF-8 row without LF",
        "74811805f201bc3a638231f86e3591c3e7e09091e28e5143f2e83ddf07891370",
        "primary"
      ),
      witness(
        "TBESG.G21057.obtutus-fragment",
        "TBESG",
        "semantic-payload",
        "G21057 exact raw bibliographic/Latin fragment obtutus)",
        "150fc17f580c8ce82ec6330b8e23e8bba26b9a035a4edf89a7c45d91dcecdb1b",
        "base-context"
      ),
      witness(
        "TFLSJ.G4337.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 4440, byte 17401621; exact G4337 UTF-8 row without LF",
        "41d25882df7ecfe11780ce5141e8089f6c76f6fbc5fac0bcc6e86b47a33a8392",
        "primary"
      ),
      witness(
        "TAGNT.G21057.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G21057 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G21057,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "attention",
      "<b>πρόσχεσις</b>: <b>attention</b>, the directing of the mind or gaze toward something.",
      "be4c189c8ddb782613a3f09e26c4f984624ff38c7fca276768fad4dfeab2df56"
    ),
    identityPatch: { morph: "G:N-F" },
    rationale:
      "This explicit editorial reconstruction interprets the exact ‘obtutus)’ fragment only with the pinned προσέχω witness and feminine action-noun morphology; absent either witness, publication must remain blocked."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G21118@1",
    entryKey: "greek:G21118",
    code: "G21118",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "b341309368878744b9739b24f059ffcfafcfd2c055438646b136a6bb43f98291",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G21118.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10743, byte 4682729; exact UTF-8 row without LF",
        "88883e4660add2bd58eeced04b8a8572a66d7ac0dc35504821e3ff888fb865f1",
        "primary"
      ),
      witness(
        "TBESG.G21117.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 10742, byte 4682584; exact G21117 UTF-8 row without LF",
        "38e700e9861204a98633e50fe56dddda423d2a517843cc7246be76f3562b1267",
        "primary"
      ),
      witness(
        "TBESG.G4698.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 4846, byte 3060322; exact G4698 UTF-8 row without LF",
        "2b72f3dcedf36f555780d9bde2e1d89c241ac68f932af765d74ee431cffa9ccc",
        "corroborating"
      ),
      witness(
        "TBESG.G5314.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 5470, byte 3414535; exact G5314 UTF-8 row without LF",
        "e42e7ec57c5f1d153c6cb5325bbabb57e669c96f0696f6e3f8933fe7ce45b215",
        "corroborating"
      ),
      witness(
        "TAGNT.G21118.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G21118 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G21118,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "eating the entrails",
      "<b>σπλαγχνοφάγος</b>: <b>eating the inward parts or entrails</b>.",
      "1196ba409f3e41816a00aefdead6cb5a0049fbcd0cea93e27acea53bd12689f4"
    ),
    identityPatch: { morph: "G:A" },
    rationale:
      "The exact compound witnesses support the literal entrails sense and adjectival morphology; the metaphorical ‘affection’ sense of G4698 is explicitly not imported."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G21241@1",
    entryKey: "greek:G21241",
    code: "G21241",
    classification: "direct-source-extraction",
    confidence: 0.99,
    expectedSourceRecordDigest:
      "b81afe6b56d8f2922ed2be57b649582c12a7871e1be704113de5ba411e1c6259",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G21241.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10866, byte 4703494; exact UTF-8 row without LF",
        "7d810bf962c15d7740b3f885ac8a154042a313968386a962785219b8519254b8",
        "primary"
      ),
      witness(
        "TBESG.G9466.raw-row",
        "TBESG",
        "cross-reference",
        "TBESG.txt line 9245, byte 4428320; exact G9466 UTF-8 row without LF",
        "5c8ed5d6d7ae13d608bd5764d7b61d18083f8f90194bd82e3252cead6e7da165",
        "primary"
      ),
      witness(
        "TFLSJ.G5117.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 5245, byte 20570459; exact G5117 UTF-8 row without LF",
        "0b3520c90c17bac012830e3bcaffeb6eb994e5600cb307a807f349bb2796f2fc",
        "corroborating"
      ),
      witness(
        "TAGNT.G21241.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G21241 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G21241,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "district governed by a toparch",
      "<b>τοπαρχία</b>: <b>a district governed by a toparch</b>; in Egypt, an administrative subdivision of a nome.",
      "19cb30f2eff04511a4b058628ecf2b937c3018cfa608fb280a1c1ed4bc78050f"
    ),
    identityPatch: { morph: "G:N-F" },
    rationale:
      "The exact toparch and place witnesses complete the truncated administrative definition and feminine noun morphology while keeping G21241 a distinct STEP identity."
  },
  {
    schemaVersion: GREEK_RECONSTRUCTION_SCHEMA_VERSION,
    ruleId: "greek-reconstruction:G21273@1",
    entryKey: "greek:G21273",
    code: "G21273",
    classification: "editorial_reconstruction",
    confidence: 0.93,
    expectedSourceRecordDigest:
      "6be9b92841af20ae67a797598ff3330f9e5c6fc38a27a0be2af26b2705897475",
    sourceSnapshots: [
      sourceSnapshot("step.database", SNAPSHOT.stepDatabase),
      sourceSnapshot("TBESG", SNAPSHOT.tbesg),
      sourceSnapshot("TFLSJ", SNAPSHOT.tflsj),
      sourceSnapshot("TAGNT.Act-Rev", SNAPSHOT.tagntActsRevelation),
      sourceSnapshot("TAGNT.Mat-Jhn", SNAPSHOT.tagntMatthewJohn)
    ],
    witnesses: [
      witness(
        "TBESG.G21273.raw-row",
        "TBESG",
        "raw-fragment",
        "TBESG.txt line 10897, byte 4707557; exact G21273 UTF-8 row without LF",
        "0c7f0688a37fd1176cf7c70b17c60154c7c3e12f858f7d99bf58eb1b8d164f52",
        "primary"
      ),
      witness(
        "TBESG.G0071.raw-row",
        "TBESG",
        "lexicon-slice",
        "TBESG.txt line 168, byte 57303; exact ἄγω component row without LF",
        "bf37f53c334164fbb195db6e4c4be5695694a6498ea8b7d2e848a89f65261bf7",
        "primary"
      ),
      witness(
        "TBESG.G5228.raw-row",
        "TBESG",
        "lexicon-slice",
        "TBESG.txt line 5383, byte 3364788; exact ὑπέρ component row without LF",
        "137b467879d235e86d9bb29f3b3b57d6d2bd37c15724edad04e2a8e06964841d",
        "primary"
      ),
      witness(
        "TFLSJ.G0071.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 141, byte 157565; exact ἄγω component row without LF",
        "e12ac283e24f726cfd7172f2279ec10cc273e8969ae2673019b8d4a7d2a97fdb",
        "corroborating"
      ),
      witness(
        "TFLSJ.G5228.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 5356, byte 21419991; exact ὑπέρ component row without LF",
        "44e9001b7364ee336af694e6568501c0382c3a3eab82b88060203a1895147eb0",
        "corroborating"
      ),
      witness(
        "TFLSJ.G5229.raw-row",
        "TFLSJ",
        "lexicon-slice",
        "TFLSJ.txt line 5357, byte 21446809; exact figurative elevation analogue without LF",
        "6d87120f972a2f9173f7cecda2bb2326b058599baae260161a90f7ac3b470435",
        "corroborating"
      ),
      witness(
        "TAGNT.G21273.zero-exact-occurrence-corpus",
        "TAGNT",
        "exact-absence-corpus",
        "canonical exact-dStrong TAGNT corpus for G21273 across both pinned files",
        PINNED_GREEK_ZERO_EXACT_OCCURRENCE_CORPORA.G21273,
        "negative"
      )
    ],
    expectedOccurrenceCount: 0,
    output: output(
      "to lead or carry over or beyond; to exalt",
      "<b>ὑπεράγω</b>: <b>to lead or carry over or beyond</b>; figuratively, <b>to exalt</b>.",
      "137461e47024ee5f7ccf706373426fdb66fa18984f260280c41d67c2a6796a57"
    ),
    identityPatch: {},
    rationale:
      "The exact unsuffixed G21273 row preserves the target-specific figurative gloss but carries a category-incoherent meaning. Independent TBESG and TFLSJ component rows establish the literal compound, a local elevation analogue preserves the figurative bridge, and the empty exact TAGNT corpus remains explicit."
  }
] as const;

const RULES = RULE_DEFINITIONS.map(createRule);

class ImmutableRuleMap<K, V> implements ReadonlyMap<K, V> {
  readonly #entries: Map<K, V>;

  constructor(entries: readonly (readonly [K, V])[]) {
    this.#entries = new Map(entries);
    Object.freeze(this);
  }

  get size(): number {
    return this.#entries.size;
  }

  get(key: K): V | undefined {
    return this.#entries.get(key);
  }

  has(key: K): boolean {
    return this.#entries.has(key);
  }

  entries(): MapIterator<[K, V]> {
    return this.#entries.entries();
  }

  keys(): MapIterator<K> {
    return this.#entries.keys();
  }

  values(): MapIterator<V> {
    return this.#entries.values();
  }

  forEach(
    callbackfn: (value: V, key: K, map: ReadonlyMap<K, V>) => void,
    thisArg?: unknown
  ): void {
    this.#entries.forEach((value, key) => {
      callbackfn.call(thisArg, value, key, this);
    });
  }

  [Symbol.iterator](): MapIterator<[K, V]> {
    return this.entries();
  }
}

/**
 * Immutable rule values keyed by canonical entry key. The `ReadonlyMap` API is
 * intentional: callers can inspect rules but cannot alter production policy.
 */
export const GREEK_RECONSTRUCTION_RULES: ReadonlyMap<
  string,
  GreekReconstructionRule
> = new ImmutableRuleMap(RULES.map((rule) => [rule.entryKey, rule] as const));

/** Trust anchor over the canonical rule objects, including rule digests. */
export const GREEK_RECONSTRUCTION_REGISTRY_DIGEST =
  "0142ae486f44c6e59b003fdd86303340e27cdcf987b3662029f9cbe6dc650a9c" as const;

export function digestGreekReconstructionSourceRecord(
  entry: Pick<
    LexiconV3SourceEntry,
    | "language"
    | "eStrong"
    | "dStrong"
    | "uStrong"
    | "original"
    | "transliteration"
    | "morph"
    | "gloss"
    | "meaning"
  >
): string {
  // Compatibility contract: existing English audit records hash the exact
  // source bytes without Unicode normalization. Output bundles use NFC below.
  return sha256Raw(
    stableJson({
      language: entry.language,
      eStrong: entry.eStrong,
      dStrong: entry.dStrong,
      uStrong: entry.uStrong,
      original: entry.original,
      transliteration: entry.transliteration,
      morph: entry.morph,
      gloss: entry.gloss,
      meaning: entry.meaning
    })
  );
}

export function digestGreekReconstructionOutput(
  outputValue: Pick<GreekReconstructionOutput, "gloss" | "meaning">
): string {
  return sha256(
    stableJson({ gloss: outputValue.gloss, meaning: outputValue.meaning })
  );
}

export function digestGreekReconstructionRegistry(): string {
  return sha256(
    stableJson(
      [...GREEK_RECONSTRUCTION_RULES.entries()]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([entryKey, rule]) => ({ entryKey, rule }))
    )
  );
}

export function getGreekReconstructionRule(
  codeOrEntryKey: string
): GreekReconstructionRule | null {
  return GREEK_RECONSTRUCTION_RULES.get(toEntryKey(codeOrEntryKey)) ?? null;
}

/**
 * Fail-closed authorization gate. Every expected snapshot and witness key must
 * be present exactly once and no unregistered evidence may be mixed in.
 */
export function proveGreekReconstruction(
  codeOrEntryKey: string,
  input: GreekReconstructionProofInput
): GreekReconstructionProof {
  const entryKey = toEntryKey(codeOrEntryKey);
  const rule = GREEK_RECONSTRUCTION_RULES.get(entryKey);
  const reasons = new Set<GreekReconstructionProofReasonCode>();

  if (!rule) reasons.add("greek-reconstruction-unknown-rule");
  if (verifyGreekReconstructionRegistry().length > 0) {
    reasons.add("greek-reconstruction-registry-integrity-invalid");
  }
  if (!isSha256(input.sourceRecordDigest)) {
    reasons.add("greek-reconstruction-source-record-digest-invalid");
  }

  if (rule) {
    if (input.sourceRecordDigest !== rule.expectedSourceRecordDigest) {
      reasons.add("greek-reconstruction-source-record-digest-mismatch");
    }

    const expectedSources = Object.fromEntries(
      rule.sourceSnapshots.map((source) => [source.id, source.sha256])
    );
    if (!sameKeys(input.sourceDigests, expectedSources)) {
      reasons.add("greek-reconstruction-source-digest-set-mismatch");
    }
    if (
      Object.entries(expectedSources).some(
        ([id, digest]) => input.sourceDigests[id] !== digest
      ) ||
      Object.values(input.sourceDigests).some((digest) => !isSha256(digest))
    ) {
      reasons.add("greek-reconstruction-source-digest-mismatch");
    }

    const expectedWitnesses = Object.fromEntries(
      rule.witnesses.map((item) => [item.id, item.expectedDigest])
    );
    if (!sameKeys(input.witnessDigests, expectedWitnesses)) {
      reasons.add("greek-reconstruction-witness-digest-set-mismatch");
    }
    if (
      Object.entries(expectedWitnesses).some(
        ([id, digest]) => input.witnessDigests[id] !== digest
      ) ||
      Object.values(input.witnessDigests).some(
        (digest) => digest !== null && !isSha256(digest)
      )
    ) {
      reasons.add("greek-reconstruction-witness-digest-mismatch");
    }

    const countMatches =
      rule.expectedOccurrenceCount === null
        ? input.occurrenceCount === undefined
        : input.occurrenceCount === rule.expectedOccurrenceCount &&
          Number.isSafeInteger(input.occurrenceCount);
    if (!countMatches) {
      reasons.add("greek-reconstruction-occurrence-count-mismatch");
    }
    if (
      digestGreekReconstructionOutput(rule.output) !==
      rule.output.expectedDigest
    ) {
      reasons.add("greek-reconstruction-output-digest-mismatch");
    }
  }

  const approved = reasons.size === 0;
  if (approved) reasons.add("greek-reconstruction-approved");
  const reasonCodes = [...reasons].sort();
  const outputValue = approved && rule ? rule.output : null;
  const identityPatch = approved && rule ? rule.identityPatch : null;
  const proofWithoutDigest = {
    approved,
    entryKey,
    ruleId: rule?.ruleId ?? null,
    reasonCodes,
    sourceRecordDigest: input.sourceRecordDigest,
    sourceDigests: canonicalRecord(input.sourceDigests),
    witnessDigests: canonicalRecord(input.witnessDigests),
    occurrenceCount: input.occurrenceCount ?? null,
    ruleDigest: rule?.ruleDigest ?? null,
    output: outputValue,
    identityPatch
  };

  return {
    approved,
    entryKey,
    ruleId: rule?.ruleId ?? null,
    reasonCodes,
    sourceRecordDigest: input.sourceRecordDigest,
    ruleDigest: rule?.ruleDigest ?? null,
    output: outputValue,
    identityPatch,
    proofDigest: sha256(stableJson(proofWithoutDigest))
  };
}

export function verifyGreekReconstructionRegistry(): string[] {
  const issues: string[] = [];
  if (GREEK_RECONSTRUCTION_RULES.size !== 32) {
    issues.push("registry-rule-count-mismatch");
  }

  for (const [entryKey, rule] of GREEK_RECONSTRUCTION_RULES) {
    if (entryKey !== rule.entryKey || entryKey !== `greek:${rule.code}`) {
      issues.push(`${entryKey}:identity-mismatch`);
    }
    if (rule.schemaVersion !== GREEK_RECONSTRUCTION_SCHEMA_VERSION) {
      issues.push(`${entryKey}:schema-version-mismatch`);
    }
    if (!isSha256(rule.expectedSourceRecordDigest)) {
      issues.push(`${entryKey}:source-record-digest-invalid`);
    }
    if (
      hasDuplicateIds(rule.sourceSnapshots) ||
      rule.sourceSnapshots.some((source) => !isSha256(source.sha256))
    ) {
      issues.push(`${entryKey}:source-snapshot-invalid`);
    }
    if (
      hasDuplicateIds(rule.witnesses) ||
      rule.witnesses.some(
        (item) => item.expectedDigest !== null && !isSha256(item.expectedDigest)
      )
    ) {
      issues.push(`${entryKey}:witness-invalid`);
    }
    if (
      rule.expectedOccurrenceCount !== null &&
      (!Number.isSafeInteger(rule.expectedOccurrenceCount) ||
        rule.expectedOccurrenceCount < 0)
    ) {
      issues.push(`${entryKey}:occurrence-count-invalid`);
    }
    if (
      rule.confidence !== undefined &&
      (!Number.isFinite(rule.confidence) ||
        rule.confidence <= 0 ||
        rule.confidence > 1)
    ) {
      issues.push(`${entryKey}:confidence-invalid`);
    }
    if (
      digestGreekReconstructionOutput(rule.output) !==
      rule.output.expectedDigest
    ) {
      issues.push(`${entryKey}:output-digest-mismatch`);
    }
    const definition = Object.fromEntries(
      Object.entries(rule).filter(([key]) => key !== "ruleDigest")
    );
    if (sha256(stableJson(definition)) !== rule.ruleDigest) {
      issues.push(`${entryKey}:rule-digest-mismatch`);
    }
    if (!Object.isFrozen(rule) || !Object.isFrozen(rule.output)) {
      issues.push(`${entryKey}:rule-not-frozen`);
    }
  }

  if (
    digestGreekReconstructionRegistry() !== GREEK_RECONSTRUCTION_REGISTRY_DIGEST
  ) {
    issues.push("registry-digest-mismatch");
  }
  return issues.sort();
}

export function verifyPinnedG0001HPerseusArtifact(
  value: unknown
): PinnedPerseusArtifactVerification {
  const reasons = new Set<PinnedPerseusArtifactReasonCode>();
  const artifactDigest = sha256(stableJson(value));
  const artifact = asRecord(value);
  if (!artifact) reasons.add("perseus-artifact-malformed");

  const source = asRecord(artifact?.source);
  if (!source || stableJson(source) !== stableJson(EXPECTED_PERSEUS_SOURCE)) {
    reasons.add("perseus-artifact-source-mismatch");
  }

  const license = asRecord(artifact?.license);
  if (
    !license ||
    stableJson(license) !== stableJson(EXPECTED_PERSEUS_LICENSE)
  ) {
    reasons.add("perseus-artifact-license-mismatch");
  }

  const payload = asRecord(artifact?.payload);
  const payloadIsWellFormed =
    payload !== null &&
    sameKeys(payload, EXPECTED_PERSEUS_PAYLOAD_KEYS) &&
    Object.values(payload).every((item) => typeof item === "string");
  if (!payloadIsWellFormed) {
    reasons.add("perseus-artifact-payload-malformed");
  }
  const payloadDigest = payloadIsWellFormed
    ? sha256(stableJson(payload))
    : null;
  if (
    payloadDigest !== PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST ||
    artifact?.payloadSha256 !== PINNED_G0001H_PERSEUS_PAYLOAD_DIGEST ||
    artifact?.schemaVersion !== "perseus-lsj-entry@1" ||
    artifact?.entryKey !== "greek:G0001H"
  ) {
    reasons.add("perseus-artifact-payload-digest-mismatch");
  }
  if (artifactDigest !== PINNED_G0001H_PERSEUS_ARTIFACT_DIGEST) {
    reasons.add("perseus-artifact-digest-mismatch");
  }

  const valid = reasons.size === 0;
  if (valid) reasons.add("perseus-artifact-verified");
  return {
    valid,
    reasonCodes: [...reasons].sort(),
    artifactDigest,
    payloadDigest
  };
}

/**
 * Verifies the checked-in G20464 adjudication object itself. The English audit
 * additionally hashes the raw JSON file, so neither a copied catalog digest
 * nor a semantically equivalent but rewritten file can authorize publication.
 */
export function verifyPinnedG20464InternalAdjudicationArtifact(
  value: unknown
): PinnedG20464InternalAdjudicationVerification {
  const reasons = new Set<PinnedG20464InternalAdjudicationReasonCode>();
  const artifactDigest = sha256(stableJson(value));
  const artifact = asRecord(value);
  if (
    !artifact ||
    !sameKeys(artifact, EXPECTED_G20464_ADJUDICATION_TOP_LEVEL_KEYS) ||
    artifact.schemaVersion !== "lexicon-v3-internal-greek-adjudication@1" ||
    artifact.entryKey !== "greek:G20464"
  ) {
    reasons.add("g20464-adjudication-artifact-malformed");
  }

  const identity = asRecord(artifact?.stepIdentity);
  if (
    !identity ||
    stableJson(identity) !== stableJson(EXPECTED_G20464_STEP_IDENTITY)
  ) {
    reasons.add("g20464-adjudication-identity-mismatch");
  }

  const sourceRecord = asRecord(artifact?.rawSourceRecord);
  if (
    !sourceRecord ||
    stableJson(sourceRecord) !==
      stableJson(EXPECTED_G20464_RAW_SOURCE_RECORD) ||
    artifact?.sourceRecordSha256 !==
      "c487b224a14f635d458802a9b9d21c5141eb71735cb14d88e412085189187e20" ||
    digestGreekReconstructionSourceRecord(EXPECTED_G20464_RAW_SOURCE_RECORD) !==
      artifact?.sourceRecordSha256
  ) {
    reasons.add("g20464-adjudication-source-record-mismatch");
  }

  const localProofBoundary = asRecord(artifact?.localProofBoundary);
  if (
    !localProofBoundary ||
    stableJson(localProofBoundary) !==
      stableJson(EXPECTED_G20464_LOCAL_PROOF_BOUNDARY)
  ) {
    reasons.add("g20464-adjudication-local-proof-boundary-mismatch");
  }

  if (
    !Array.isArray(artifact?.judgments) ||
    stableJson(artifact.judgments) !== stableJson(EXPECTED_G20464_JUDGMENTS)
  ) {
    reasons.add("g20464-adjudication-judgments-mismatch");
  }

  const consensus = asRecord(artifact?.consensus);
  if (
    !consensus ||
    stableJson(consensus) !== stableJson(EXPECTED_G20464_CONSENSUS)
  ) {
    reasons.add("g20464-adjudication-consensus-mismatch");
  }

  const payload = asRecord(artifact?.payload);
  const payloadIsWellFormed =
    payload !== null &&
    sameKeys(payload, EXPECTED_G20464_PAYLOAD) &&
    Object.values(payload).every((item) => typeof item === "string");
  if (!payloadIsWellFormed) {
    reasons.add("g20464-adjudication-payload-malformed");
  }
  const payloadDigest = payloadIsWellFormed
    ? sha256(stableJson(payload))
    : null;
  if (
    !payload ||
    stableJson(payload) !== stableJson(EXPECTED_G20464_PAYLOAD) ||
    payloadDigest !== PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST ||
    artifact?.payloadSha256 !==
      PINNED_G20464_INTERNAL_ADJUDICATION_PAYLOAD_DIGEST
  ) {
    reasons.add("g20464-adjudication-payload-digest-mismatch");
  }
  if (artifactDigest !== PINNED_G20464_INTERNAL_ADJUDICATION_ARTIFACT_DIGEST) {
    reasons.add("g20464-adjudication-artifact-digest-mismatch");
  }

  const valid = reasons.size === 0;
  if (valid) reasons.add("g20464-adjudication-verified");
  return {
    valid,
    reasonCodes: [...reasons].sort(),
    artifactDigest,
    payloadDigest
  };
}

export function applyProvenGreekReconstruction<
  T extends LexiconV3SourceEntry & {
    classicTransliteration?: string;
    pronunciation?: string;
  }
>(entry: T, proof: GreekReconstructionProof): T | null {
  if (
    !proof.approved ||
    !proof.output ||
    !proof.identityPatch ||
    proof.entryKey !== `greek:${extractPrimaryDStrong(entry.dStrong)}` ||
    proof.sourceRecordDigest !== digestGreekReconstructionSourceRecord(entry)
  ) {
    return null;
  }
  return {
    ...entry,
    ...proof.identityPatch,
    gloss: proof.output.gloss,
    meaning: proof.output.meaning
  };
}

const EXPECTED_PERSEUS_SOURCE = Object.freeze({
  name: "A Greek-English Lexicon (LSJ)",
  provider: "Perseus Digital Library",
  repository: "https://github.com/PerseusDL/lexica",
  commit: "b5e707bdda2d6c8e0bb6c29657454996b4fb04d7",
  path: "CTS_XML_TEI/perseus/pdllex/grc/lsj/grc.lsj.perseus-eng1.xml",
  rawUrl:
    "https://raw.githubusercontent.com/PerseusDL/lexica/b5e707bdda2d6c8e0bb6c29657454996b4fb04d7/CTS_XML_TEI/perseus/pdllex/grc/lsj/grc.lsj.perseus-eng1.xml",
  viewerUrl:
    "https://atlas.perseus.tufts.edu/dictionaries/entry/urn%3Acite2%3Ascaife-viewer%3Adictionaries.v1%3Alsj-n3/",
  urn: "urn:cite2:scaife-viewer:dictionaries.v1:lsj-n3",
  accessedAt: "2026-07-13",
  sourceFileSha256: SNAPSHOT.perseusLsj,
  sourceFragmentSha256:
    "c6db2a6fa2024976aae6b3e197dc9fde9865fc7f0168bd796100a8e1a4ddf420",
  sourceFragmentBytes: 7293
});

const EXPECTED_PERSEUS_LICENSE = Object.freeze({
  spdx: "CC-BY-SA-4.0",
  url: "https://creativecommons.org/licenses/by-sa/4.0/",
  attribution:
    "Text provided under a CC BY-SA license by Perseus Digital Library, http://www.perseus.tufts.edu, with funding from The National Endowment for the Humanities.",
  provenanceUrl:
    "https://github.com/PerseusDL/lexica/blob/b5e707bdda2d6c8e0bb6c29657454996b4fb04d7/CTS_XML_TEI/perseus/pdllex/grc/lsj/README.md",
  modifications:
    "The TEI entry was reduced to a canonical semantic payload; wording in the payload is otherwise unchanged."
});

const EXPECTED_PERSEUS_PAYLOAD_KEYS = Object.freeze({
  definition: true,
  headword: true,
  shortDef: true,
  urn: true
});

const EXPECTED_G20464_ADJUDICATION_TOP_LEVEL_KEYS = Object.freeze({
  schemaVersion: true,
  entryKey: true,
  stepIdentity: true,
  rawSourceRecord: true,
  sourceRecordSha256: true,
  localProofBoundary: true,
  judgments: true,
  consensus: true,
  payload: true,
  payloadSha256: true
});

const EXPECTED_G20464_STEP_IDENTITY = Object.freeze({
  stepEntryId: 10008,
  language: "greek",
  baseCode: 20464,
  eStrong: "G20464",
  dStrong: "G20464 =",
  uStrong: "G20464"
});

const EXPECTED_G20464_RAW_SOURCE_RECORD = Object.freeze({
  id: 10008,
  language: "greek" as const,
  baseCode: 20464,
  eStrong: "G20464",
  dStrong: "G20464 =",
  uStrong: "G20464",
  original: "ἐσσήν",
  transliteration: "essēn",
  morph: "",
  gloss: "[hudot ]ōšen",
  meaning: "[hudot ]ōšen",
  classicTransliteration: "",
  pronunciation: ""
});

const EXPECTED_G20464_LOCAL_PROOF_BOUNDARY = Object.freeze({
  limit:
    "The pinned local sources prove the exact STEP identity, the opaque raw source fields, and the stated absences only; they do not locally attest the reconstructed morphology or senses.",
  targetRow: {
    source: "TBESG",
    path: "data/external/stepbible/TBESG.txt",
    locator: "TBESG:10098@4593900",
    lineSha256:
      "e7848bd8dd60e9187addb55f43fdd5f25abe50c618f069b21205aae7e8944382",
    exactLine:
      "G20464\tG20464 =\tG20464\tἐσσήν\tessēn\t\t[hudot ]ōšen\t[hudot ]ōšen "
  },
  tflsj: {
    exactHeadwordMatchCount: 0,
    semanticDefinitionPresent: false
  },
  tagnt: {
    exactDStrongOccurrenceCount: 0,
    exactLemmaOccurrenceCount: 0,
    references: [],
    occurrenceCorpusSha256:
      "ff34149786c31b0c8fea544fc769ab3f9b4124a2dd5759629b3b0d82061a936a"
  },
  prohibitedClaim:
    "The reconstructed morphology and senses must never be described as proven by the pinned STEP, TFLSJ, or TAGNT files."
});

const EXPECTED_G20464_JUDGMENTS = Object.freeze([
  {
    judgmentId: "risky-greek-independent-adjudication-1:G20464",
    reportPath:
      "reports/lexicon-v3-staging/risky-greek-independent-adjudication-1.json",
    reportSha256:
      "145a2b370cdff604e169578dc2c75e2775ff27e3a7b10d0bf4f47f1aef309637",
    reviewRole: "independent-internal-lexicographic-review",
    classification: "RECONSTRUCTION",
    confidence: 0.94,
    morph: "G:N-M",
    gloss: "king bee; priest of Artemis at Ephesus",
    meaning:
      "<b>ἐσσήν</b>: the <b>king bee</b>; also a title of the priest of Artemis at Ephesus.",
    independenceStatement:
      "This judgment was produced in a separate risky-entry adjudication before the final two-entry arbitration."
  },
  {
    judgmentId: "g21122-g20464-independent-arbitration:G20464",
    reportPath:
      "reports/lexicon-v3-staging/g21122-g20464-independent-arbitration.json",
    reportSha256:
      "76bb72844bd4eaa29b6899a473c7fc94f4e7646c3ca572bc89a31dc52d098099",
    reviewRole: "independent-offline-lexicographic-arbitrator",
    classification: "EDITORIAL_RECONSTRUCTION",
    confidence: 0.94,
    morph: "G:N-M",
    gloss: "king bee; priest of Artemis at Ephesus",
    meaning:
      "<b>ἐσσήν</b>: the <b>king bee</b>; also a title of the priest of Artemis at Ephesus.",
    independenceStatement:
      "This judgment independently rechecked the exact identity, local proof limit, morphology, and both proposed senses."
  }
]);

const EXPECTED_G20464_CONSENSUS = Object.freeze({
  judgmentCount: 2,
  unanimous: true,
  independenceLimit:
    "Independence is procedural: two separate checked-in reports and review roles; the reports do not provide cryptographic reviewer or model identities and are not two external lexical attestations.",
  publicationProvenance:
    "editorial reconstruction from two independent internal lexicographic judgments",
  localAttestationClaimed: false
});

const EXPECTED_G20464_PAYLOAD = Object.freeze({
  classification: "editorial_reconstruction",
  morph: "G:N-M",
  gloss: "king bee; priest of Artemis at Ephesus",
  meaning:
    "<b>ἐσσήν</b>: the <b>king bee</b>; also a title of the priest of Artemis at Ephesus.",
  publicationProvenance: "internal-adjudication-consensus"
});

function sourceSnapshot(
  id: string,
  sha256Value: string
): GreekReconstructionSourceSnapshot {
  return { id, sha256: sha256Value };
}

function witness(
  id: string,
  family: GreekReconstructionWitness["family"],
  kind: GreekReconstructionWitnessKind,
  locator: string,
  expectedDigest: string | null,
  role: GreekReconstructionWitness["role"]
): GreekReconstructionWitness {
  return { id, family, kind, locator, expectedDigest, role };
}

function output(
  gloss: string,
  meaning: string,
  expectedDigest: string
): GreekReconstructionOutput {
  return { gloss, meaning, expectedDigest };
}

function createRule(
  definition: GreekReconstructionRuleDefinition
): GreekReconstructionRule {
  const frozenDefinition = freezeDefinition(definition);
  return Object.freeze({
    ...frozenDefinition,
    ruleDigest: sha256(stableJson(frozenDefinition))
  });
}

function freezeDefinition(
  definition: GreekReconstructionRuleDefinition
): GreekReconstructionRuleDefinition {
  const sourceSnapshots = Object.freeze(
    definition.sourceSnapshots.map((source) => Object.freeze({ ...source }))
  );
  const witnesses = Object.freeze(
    definition.witnesses.map((item) => Object.freeze({ ...item }))
  );
  const outputValue = Object.freeze({ ...definition.output });
  const identityPatch = Object.freeze({ ...definition.identityPatch });
  return Object.freeze({
    ...definition,
    sourceSnapshots,
    witnesses,
    output: outputValue,
    identityPatch
  });
}

function toEntryKey(codeOrEntryKey: string): string {
  return codeOrEntryKey.startsWith("greek:")
    ? codeOrEntryKey
    : `greek:${codeOrEntryKey}`;
}

function sameKeys(
  left: Readonly<Record<string, unknown>>,
  right: Readonly<Record<string, unknown>>
): boolean {
  return (
    stableJson(Object.keys(left).sort()) ===
    stableJson(Object.keys(right).sort())
  );
}

function canonicalRecord<T>(
  value: Readonly<Record<string, T>>
): Record<string, T> {
  return Object.fromEntries(
    Object.entries(value).sort(([left], [right]) => left.localeCompare(right))
  );
}

function hasDuplicateIds(values: readonly { id: string }[]): boolean {
  return new Set(values.map((value) => value.id)).size !== values.length;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function isSha256(value: unknown): value is string {
  return typeof value === "string" && /^[0-9a-f]{64}$/u.test(value);
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableJson(record[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value: string): string {
  return createHash("sha256").update(value.normalize("NFC")).digest("hex");
}

function sha256Raw(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
