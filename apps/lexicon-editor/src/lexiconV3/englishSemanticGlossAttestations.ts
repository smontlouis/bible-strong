import { createHash } from "node:crypto";

import {
  digestEnglishExactRepairSourceRecord,
  englishExactRepairEntryKey,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "./englishExactRepairs.js";
import {
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG,
  type EnglishSupplementalGlossAuditRule,
  type EnglishSupplementalGlossAuditWitness
} from "./englishSupplementalGlossAudit.js";

export const ENGLISH_SEMANTIC_GLOSS_ATTESTATION_SCHEMA_VERSION =
  "lexicon-v3-english-semantic-gloss-attestation@2" as const;
export const ENGLISH_SEMANTIC_GLOSS_ATTESTATION_POLICY_VERSION =
  "lexicon-v3-english-semantic-gloss-attestation-policy@2" as const;

export const PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES = Object.freeze({
  database: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database,
  TBESG: PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG,
  TFLSJ: "fcc2845412132a7bb91fc3dbb5a544c807daf57e4791c4d9af61efe209e97691"
});

export type EnglishSemanticGlossClassification =
  | "cognate-derived-sense"
  | "derived-substantive-sense"
  | "homonymy"
  | "lexical-polysemy"
  | "semantic-extension"
  | "specialized-domain-sense";

export type EnglishSemanticGlossSourceFamily = "TBESG" | "TFLSJ";

export interface EnglishSemanticGlossWitnessFragment {
  exactFragment: string;
  fragmentDigest: string;
}

export interface EnglishSemanticGlossWitness {
  id: string;
  sourceFamily: EnglishSemanticGlossSourceFamily;
  locator: string;
  expectedLineDigest: string;
  role: "cognate" | "full-lexicon-corroboration" | "target-source-row";
  /** A target source row is identity-only and can never prove its own gloss. */
  semanticAuthority: boolean;
  fragments: readonly EnglishSemanticGlossWitnessFragment[];
}

export interface EnglishSemanticGlossProof {
  id: string;
  kind: "independent-witness-fragment" | "target-meaning-fragment";
  exactFragment: string;
  fragmentDigest: string;
  sourceFamily?: EnglishSemanticGlossSourceFamily;
  locator?: string;
  expectedLineDigest?: string;
  witnessId?: string;
}

export interface EnglishSemanticGlossAttestationRule {
  ruleId: string;
  entryKey: string;
  expectedSourceRecordDigest: string;
  expectedGloss: string;
  expectedGlossDigest: string;
  expectedExactOccurrenceCount: 0;
  classification: EnglishSemanticGlossClassification;
  confidence: number;
  rationale: string;
  semanticBridge: string;
  witnesses: readonly EnglishSemanticGlossWitness[];
  semanticProofs: readonly EnglishSemanticGlossProof[];
}

export interface EnglishSemanticGlossAttestationContext {
  databaseDigest: string;
  sourceDigests: Readonly<
    Partial<Record<EnglishSemanticGlossSourceFamily, string>>
  >;
  /** Exact UTF-8 source lines, without their LF/CRLF terminator, by locator. */
  sourceLines: Readonly<Record<string, string>>;
}

export interface EnglishSemanticGlossAttestationEnvelopeContext {
  databaseDigest: string;
  sourceDigests: Readonly<
    Partial<Record<EnglishSemanticGlossSourceFamily, string>>
  >;
  exactOccurrenceCount: number;
}

export interface EnglishSemanticGlossAttestationEvidence {
  schemaVersion: typeof ENGLISH_SEMANTIC_GLOSS_ATTESTATION_SCHEMA_VERSION;
  policyVersion: typeof ENGLISH_SEMANTIC_GLOSS_ATTESTATION_POLICY_VERSION;
  entryKey: string;
  gloss: string;
  classification: EnglishSemanticGlossClassification;
  confidence: number;
  expectedExactOccurrenceCount: 0;
  ruleId: string;
  ruleDigest: string;
  registryDigest: string;
  sourceRecordDigest: string;
  witnessCorpusDigest: string;
  semanticProofCorpusDigest: string;
  attestationDigest: string;
}

interface WitnessInput {
  id: string;
  sourceFamily?: EnglishSemanticGlossSourceFamily;
  line: number;
  byteOffset: number;
  expectedLineDigest: string;
  role: EnglishSemanticGlossWitness["role"];
  fragments: readonly string[];
}

interface RuleInput {
  entryKey: string;
  expectedSourceRecordDigest: string;
  expectedGloss: string;
  classification: EnglishSemanticGlossClassification;
  confidence: number;
  rationale: string;
  semanticBridge: string;
  target: Omit<WitnessInput, "id" | "role" | "sourceFamily">;
  witnesses?: readonly WitnessInput[];
  meaningProofs?: readonly string[];
}

function witness(input: WitnessInput): EnglishSemanticGlossWitness {
  const sourceFamily = input.sourceFamily ?? "TBESG";
  return Object.freeze({
    id: input.id,
    sourceFamily,
    locator: `${sourceFamily}:${input.line}@${input.byteOffset}`,
    expectedLineDigest: input.expectedLineDigest,
    role: input.role,
    semanticAuthority: input.role !== "target-source-row",
    fragments: Object.freeze(
      input.fragments.map((exactFragment) => ({
        exactFragment,
        fragmentDigest: sha256(exactFragment)
      }))
    )
  });
}

function rule(input: RuleInput): EnglishSemanticGlossAttestationRule {
  const code = input.entryKey.slice(input.entryKey.indexOf(":") + 1);
  const targetIdentityFragment = deriveTargetIdentityFragment(
    input.target.fragments[0]
  );
  const witnesses = [
    witness({
      id: `TBESG.${code}.target-row`,
      role: "target-source-row",
      ...input.target,
      fragments: [targetIdentityFragment]
    }),
    ...(input.witnesses ?? []).map(witness)
  ];
  const semanticProofs: EnglishSemanticGlossProof[] = [
    ...(input.meaningProofs ?? []).map((exactFragment, index) => ({
      id: `${input.entryKey}.meaning.${index + 1}`,
      kind: "target-meaning-fragment" as const,
      exactFragment,
      fragmentDigest: sha256(exactFragment)
    })),
    ...witnesses
      .filter((item) => item.semanticAuthority)
      .map((item) => {
        const fragment = item.fragments[item.fragments.length - 1];
        if (!fragment) {
          throw new Error(
            `english-semantic-gloss-independent-witness-empty:${input.entryKey}:${item.id}`
          );
        }
        return {
          id: `${input.entryKey}.witness.${item.id}`,
          kind: "independent-witness-fragment" as const,
          exactFragment: fragment.exactFragment,
          fragmentDigest: fragment.fragmentDigest,
          sourceFamily: item.sourceFamily,
          locator: item.locator,
          expectedLineDigest: item.expectedLineDigest,
          witnessId: item.id
        };
      })
  ];
  return Object.freeze({
    ruleId: `english-semantic-gloss-attestation:${input.entryKey}@2`,
    entryKey: input.entryKey,
    expectedSourceRecordDigest: input.expectedSourceRecordDigest,
    expectedGloss: input.expectedGloss,
    expectedGlossDigest: sha256(input.expectedGloss),
    expectedExactOccurrenceCount: 0,
    classification: input.classification,
    confidence: input.confidence,
    rationale: input.rationale,
    semanticBridge: input.semanticBridge,
    witnesses: Object.freeze(witnesses),
    semanticProofs: Object.freeze(semanticProofs)
  });
}

const LEGACY_BASE_RULES: readonly EnglishSemanticGlossAttestationRule[] = [
  rule({
    entryKey: "greek:G20045",
    expectedSourceRecordDigest:
      "ed164bbe1d2191728703aa635f7e28f9819546072e75f640c10a59d815b30510",
    expectedGloss: "to jut out",
    classification: "lexical-polysemy",
    confidence: 0.86,
    rationale:
      "The projecting/promontory branch and the mutilation-of-extremities branch belong to the same extremity lexeme.",
    semanticBridge:
      "The verb can describe projecting as an extremity and, transitively, cutting off extremities; the brief notice records only the latter branch.",
    target: {
      line: 9684,
      byteOffset: 4535484,
      expectedLineDigest:
        "9b25a33f09bed257b101e3a219e0ad65787f0f748b611f0585d83e9b89c5dbf1",
      fragments: [
        "\tἀκρωτηριάζω\t",
        "\tto jut out\t",
        "<b>to cut off the extremities, mutilate </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G20063",
    expectedSourceRecordDigest:
      "1d0d4ffd28c5d6c32ed95cb152b2d35513f80b0c901a55e649f75ace2817ee65",
    expectedGloss: "emergence",
    classification: "lexical-polysemy",
    confidence: 0.91,
    rationale:
      "The action noun covers both emergence from and withdrawal into/from a medium.",
    semanticBridge:
      "Emergence and drawing back are opposed directional realizations of ἀνάδυσις, not an identity mismatch.",
    target: {
      line: 9702,
      byteOffset: 4537976,
      expectedLineDigest:
        "01905ce8c9baf00144101b227226a6691848eb5d56a2c74ed4fb3c8d363bf79c",
      fragments: [
        "\tἀνάδυσις\t",
        "\temergence\t",
        "<b>a drawing back, retreat </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G20159",
    expectedSourceRecordDigest:
      "829480c643823f46b4d717c709b994b1ca13dd47257b540bc40830d6a69417b2",
    expectedGloss: "wickedness, misdeed",
    classification: "cognate-derived-sense",
    confidence: 0.91,
    rationale:
      "The late ethical sense of cognate ἄτοπος licenses the action/quality noun's ethical gloss.",
    semanticBridge:
      "The target notice gives spatial and oddness senses; both the brief and full G0824 witnesses explicitly attest the later wicked/wrong branch.",
    target: {
      line: 9797,
      byteOffset: 4549006,
      expectedLineDigest:
        "2892ae0fd13fa681898555b774deaaf4783178612c63e1d76f4cb4b5cf94415b",
      fragments: [
        "\tἀτοπία\t",
        "\twickedness, misdeed\t",
        "<b>strangeness, oddness, eccentricity </b>"
      ]
    },
    witnesses: [
      {
        id: "TBESG.G0824.ethical-sense",
        line: 936,
        byteOffset: 449056,
        expectedLineDigest:
          "5f6fe93396c01a1fc3981ac43edcb7017add73ccb959d0124eeafbdd8da538fa",
        role: "cognate",
        fragments: [
          "hence, in late Greek, with ethical sense",
          "<b>improper, unrighteous </b>"
        ]
      },
      {
        id: "TFLSJ.G0824.wicked-wrong",
        sourceFamily: "TFLSJ",
        line: 909,
        byteOffset: 2460464,
        expectedLineDigest:
          "580d5095b10dfca89eacc8cdb34170bb2f58f38785e314032d7cbcd090daa81f",
        role: "full-lexicon-corroboration",
        fragments: ["later, <b>wicked, wrong,</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20166",
    expectedSourceRecordDigest:
      "b95db0531f24d515bfa40f96630278d261dfbb198fe43d7ee20ad91260893e1b",
    expectedGloss: "wild, natural",
    classification: "semantic-extension",
    confidence: 0.82,
    rationale:
      "The spontaneous, unrehearsed branch extends naturally to wild or natural production.",
    semanticBridge:
      "The notice's off-hand/improvised sense and the gloss's wild/natural sense share the lexical notion of acting without prior preparation.",
    target: {
      line: 9804,
      byteOffset: 4549766,
      expectedLineDigest:
        "9d997104ffcfb29f3b6a81fe586dc3c37bff33f6e1e957c98653d783deb8c8bb",
      fragments: ["\tαὐτοσχέδιος\t", "\twild, natural\t", "<b>off-hand </b>"]
    }
  }),
  rule({
    entryKey: "greek:G20202",
    expectedSourceRecordDigest:
      "b0aaeeeec07a464af39c411f09a51a76a54ed89cea736e09468b5d57205a0e80",
    expectedGloss: "thumb-screw",
    classification: "specialized-domain-sense",
    confidence: 0.82,
    rationale:
      "The gloss and notice preserve two distinct finger-applied instrument senses.",
    semanticBridge:
      "A thumb-screw and a finger-sheath are separate specialized objects named from their attachment to a digit.",
    target: {
      line: 9840,
      byteOffset: 4559362,
      expectedLineDigest:
        "5c8c73a0402fa65a8f6a6c43fdfbf74ba04d734cc5091a08b027fe8f722df161",
      fragments: [
        "\tδακτυλήθρα\t",
        "\tthumb-screw\t",
        "<b>a finger-sheath </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G20567",
    expectedSourceRecordDigest:
      "36f1cc032201e690d1c39551857887aae1c841794801f97e1b33ebd02501af4d",
    expectedGloss: "cryptoporticus",
    classification: "specialized-domain-sense",
    confidence: 0.88,
    rationale:
      "The architectural descending passage and the movement/raid branch are established domain senses of the same action noun.",
    semanticBridge:
      "The brief notice records descent as an inroad or attack; the gloss preserves the architectural covered-passage specialization.",
    target: {
      line: 10199,
      byteOffset: 4606859,
      expectedLineDigest:
        "477ef990982d78f40ce394ed9b19594adb4a1201ffb6fa0e99dada0740697b7e",
      fragments: [
        "\tκαταδρομή\t",
        "\tcryptoporticus\t",
        "<b>an inroad, raid </b>",
        "<b>a vehement attack, invective </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G20595",
    expectedSourceRecordDigest:
      "46876f1ee8abb1bde8a6dbb181cbb533ea3dd741fabc1b1673aff27fb3767b97",
    expectedGloss: "kiln",
    classification: "specialized-domain-sense",
    confidence: 0.85,
    rationale:
      "A combustion place and a cautery/branding instrument are distinct technical realizations of the same burning noun.",
    semanticBridge:
      "The gloss names the place of burning while the notice names a burning instrument; the semantic root remains cauterization/heat.",
    target: {
      line: 10225,
      byteOffset: 4609840,
      expectedLineDigest:
        "9c37dab4dec743399eaf94f560b09eb3196fb9d25dccec034c442dd414671325",
      fragments: ["\tκαυτήριον\t", "\tkiln\t", "<b>a branding iron </b>"]
    }
  }),
  rule({
    entryKey: "greek:G20617",
    expectedSourceRecordDigest:
      "04b5a2e635b07f5bb3c0de508016793157aec95d04cb1bafbd99641ca9aab7c0",
    expectedGloss: "lurking-place",
    classification: "derived-substantive-sense",
    confidence: 0.89,
    rationale:
      "The substantivized hidden/secret adjective yields a hidden or lurking place.",
    semanticBridge:
      "The target's cloud/cover example and cognates κρυπτός/κρύπτω bind the gloss to the hidden-place branch.",
    target: {
      line: 10246,
      byteOffset: 4613097,
      expectedLineDigest:
        "e59544b7b8949c881493eb64594134995a71487d5f85e8bf3d0cbe38c3dd813a",
      fragments: [
        "\tκρυφός\t",
        "\tlurking-place\t",
        "to throw <b>a cloud </b> over"
      ]
    },
    witnesses: [
      {
        id: "TBESG.G2927.hidden-secret",
        line: 3122,
        byteOffset: 1925203,
        expectedLineDigest:
          "026a1d07ff5ff8b8b53c697fb80b6843cdd8561db7234647d546339efcb0d7bc",
        role: "cognate",
        fragments: ["\tκρυπτός\t", "<b>hidden, secret</b>"]
      },
      {
        id: "TBESG.G2928.hide-conceal",
        line: 3123,
        byteOffset: 1926252,
        expectedLineDigest:
          "21856822ffb3c1a6b4488c81da87c4a711ac470d2cf79a8a29064921b4507ead",
        role: "cognate",
        fragments: ["\tκρύπτω\t", "<b>to hide, conceal</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20655",
    expectedSourceRecordDigest:
      "6ff1938ce8b7323a7b890e7d4c30fb0e70f37bdde184d9d8e2ee256b9b158d17",
    expectedGloss: "amalgam",
    classification: "semantic-extension",
    confidence: 0.84,
    rationale:
      "A kneaded barley cake and an amalgam share the concrete mass/mixture branch.",
    semanticBridge:
      "The notice illustrates one shaped mixture; the gloss retains the generalized mixed-mass sense.",
    target: {
      line: 10284,
      byteOffset: 4618288,
      expectedLineDigest:
        "12231c2725d8125e939d939e211f23ef5a4283e9693461c062052948a3eadae4",
      fragments: ["\tμᾶζα\t", "\tamalgam\t", "<b>a barley-cake </b>"]
    }
  }),
  rule({
    entryKey: "greek:G20685",
    expectedSourceRecordDigest:
      "3bcfee6b95f04ca320520b49d99a6ddf7c7b19cd0a18a7490f0d6a1742b009ec",
    expectedGloss: "having a higher denominator",
    classification: "specialized-domain-sense",
    confidence: 0.97,
    rationale:
      "The mathematical denominator sense is a regular technical specialization of 'great-named'.",
    semanticBridge:
      "The notice preserves the general great-name sense; the gloss preserves the high-denominator mathematical usage.",
    target: {
      line: 10314,
      byteOffset: 4621466,
      expectedLineDigest:
        "30fbf6ca092bfae9a23aba657107292c68328daa62d543d016260ea167df8cac",
      fragments: [
        "\tμεγαλώνυμος\t",
        "\thaving a higher denominator\t",
        "<b>with a great name, giving glory </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G20727",
    expectedSourceRecordDigest:
      "23dcadaa6f1c149e999ab45a0dc653c29de6d4989be9556d5dfdb9dea4782071",
    expectedGloss: "isn't it?",
    classification: "lexical-polysemy",
    confidence: 0.98,
    rationale:
      "The interrogative gloss is the question-use branch of the exact particle combination μὴ οὐ, independently preserved by the parallel STEP combination G3378.",
    semanticBridge:
      "TBESG G20727 retains the broader negative-particle construction, while TBESG and TFLSJ G3378 explicitly attest the same gloss and questions expecting an affirmative answer for μὴ οὐ.",
    target: {
      line: 10356,
      byteOffset: 4626355,
      expectedLineDigest:
        "57e2f8a88bd34d56e1a2e462358f54c5f037d47eeaeeeae4e5fcfcd2dc50cc8a",
      fragments: [
        "\tμὴ οὐ\tmē ou\t\tisn't it?\t",
        "Here, μή and οὐ each retain their proper force."
      ]
    },
    witnesses: [
      {
        id: "TBESG.G3378.parallel-combination",
        line: 3491,
        byteOffset: 2162433,
        expectedLineDigest:
          "849387527f44f350a0c042500c070e210b5f84d69bb88c16010a4320c730ad44",
        role: "cognate",
        fragments: [
          "\tμὴ οὐκ\tmē ouk\tG:PRT-N + G:PRT-N\tisn't it?\t",
          "before οὐ (<ref='Rom.10.17'>Rom.10:17</ref>, al. in Pl.), expecting an affirm, ans."
        ]
      },
      {
        id: "TFLSJ.G3378.affirmative-question",
        sourceFamily: "TFLSJ",
        line: 3464,
        byteOffset: 12898375,
        expectedLineDigest:
          "0b61adad4c7e077f761d9f4613644f595733e786656d74d4fd8de13b8b0ac2c8",
        role: "full-lexicon-corroboration",
        fragments: [
          "Included with: <b> μὴ οὐ</b>",
          "in questions expecting an affirmative answer"
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20911",
    expectedSourceRecordDigest:
      "ed1b0e462265cb222a9658c0664fa1fc8d7cf5e684cc11386020a5e653f6558c",
    expectedGloss: "be included in one form",
    classification: "specialized-domain-sense",
    confidence: 0.84,
    rationale:
      "The technical inclusion sense derives from falling or entering into an enclosing form.",
    semanticBridge:
      "The notice records physical/metaphorical insertion; the gloss records its formal or classificatory specialization.",
    target: {
      line: 10539,
      byteOffset: 4653427,
      expectedLineDigest:
        "d33173db1242fc1e2b7eb2cc5f010ade12c0360d35f4309d9bc0d4f8a2c08f11",
      fragments: [
        "\tπαρεμπίπτω\t",
        "\tbe included in one form\t",
        "<b>to fall in by the way, creep </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21091",
    expectedSourceRecordDigest:
      "59eca1157c31597484aaa43d1e2ff690d2cd10e5d0f040ea1b70ff133c6a30f0",
    expectedGloss: "weight",
    classification: "homonymy",
    confidence: 0.82,
    rationale:
      "The weight gloss belongs to the independent homonymous branch, not to the enclosure branch excerpted in the notice.",
    semanticBridge:
      "STEP retains a compact gloss from the weight homonym and a notice from the pen/fold/shrine homonym under one written headword.",
    target: {
      line: 10716,
      byteOffset: 4678936,
      expectedLineDigest:
        "69ed08d158b081c0e4dec0aa81bef55133c43c95c2251596afba2b30aa150879",
      fragments: [
        "\tσηκός\t",
        "\tweight\t",
        "<b>a pen, fold </b>",
        "<b>a sacred enclosure, chapel, shrine </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21114",
    expectedSourceRecordDigest:
      "a9315e3025955fab5237b9732da5563bc5586649d6c037f5b27cb011b56b447e",
    expectedGloss: "drawing",
    classification: "cognate-derived-sense",
    confidence: 0.96,
    rationale:
      "The action noun transparently preserves the base verb's drawing sense alongside the specialized spasm result.",
    semanticBridge:
      "G4685 explicitly attests σπάω 'to draw'; σπασμός can denote the action or its convulsive result.",
    target: {
      line: 10739,
      byteOffset: 4682009,
      expectedLineDigest:
        "47f5b04c5da7644ce3748770700fd236b02c1362fd00331efef3262a67cf7048",
      fragments: ["\tσπασμός\t", "\tdrawing\t", "<b>a convulsion, spasm </b>"]
    },
    witnesses: [
      {
        id: "TBESG.G4685.draw",
        line: 4832,
        byteOffset: 3049534,
        expectedLineDigest:
          "0f16c147fe8a7f0df2af71b890c2db59cc6206a8e893956264e56144662c7120",
        role: "cognate",
        fragments: ["\tσπάω\t", "<b>to draw</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21136",
    expectedSourceRecordDigest:
      "7f1410ef39acc941973581a885b1211d038dd420291f6350648cf050f6db1f3f",
    expectedGloss: "a scale which flies from hammered iron",
    classification: "specialized-domain-sense",
    confidence: 0.96,
    rationale:
      "The metallurgy gloss is a specialized material sense alongside the mouth/opening sense.",
    semanticBridge:
      "The terse classical notice records the opening branch; the gloss preserves the smithing-scale branch of στόμωμα.",
    target: {
      line: 10761,
      byteOffset: 4685859,
      expectedLineDigest:
        "9cfc6d180d00456da06799f7960629048e1cd10766d5c2082f90aaac87a6f441",
      fragments: [
        "\tστόμωμα\t",
        "\ta scale which flies from hammered iron\t",
        "<b>a mouth, entrance </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21211",
    expectedSourceRecordDigest:
      "cb52d1ed997d274ba7c79660e766b4643eb35c86df51fe9575adf18720ecdd0c",
    expectedGloss: "in arithmetical progression",
    classification: "specialized-domain-sense",
    confidence: 0.93,
    rationale:
      "The mathematical progression usage is a technical specialization of repeated heap/group arrangement.",
    semanticBridge:
      "The notice records the concrete adverb 'in heaps'; the gloss records its ordered mathematical application.",
    target: {
      line: 10836,
      byteOffset: 4697128,
      expectedLineDigest:
        "892e8a15a4454ce572b1566720e8a441b40eae88da83edff64a99756a2d47ec3",
      fragments: [
        "\tσωρηδόν\t",
        "\tin arithmetical progression\t",
        "<b>by heaps, in heaps </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21228",
    expectedSourceRecordDigest:
      "bc8b466ae78cba86bf974daba27e04d940d21cb142f7c656d1a9d03a524f3c8f",
    expectedGloss: "masonry, fabric",
    classification: "semantic-extension",
    confidence: 0.86,
    rationale:
      "The constructed fabric/masonry branch and the manufactured implement/vessel branch share the making root.",
    semanticBridge:
      "The long notice inventories things made—tools, armour, vessels, body, book—while the gloss retains the construction/product branch.",
    target: {
      line: 10853,
      byteOffset: 4700424,
      expectedLineDigest:
        "837a4ea653bdb2fa26b001334aa0f8f6d487a3c7f3bb016139660e818fb0bdb7",
      fragments: [
        "\tτεῦχος\t",
        "\tmasonry, fabric\t",
        "<b>a tool, implement </b>",
        "<b>a vessel </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21268",
    expectedSourceRecordDigest:
      "055c173ee7dfce945eb0efcdb80dcd03ca47886130a18c940ab6b9a966abd94c",
    expectedGloss: "worm",
    classification: "derived-substantive-sense",
    confidence: 0.8,
    rationale:
      "The zoological substantive denotes a wood-cutting or wood-boring creature.",
    semanticBridge:
      "The notice records the agentive wood-cutter/woodman branch; the gloss retains the analogous wood-boring animal branch.",
    target: {
      line: 10892,
      byteOffset: 4706974,
      expectedLineDigest:
        "5bf6e5d5845b9547c2fd5813c9200e25e32624c73112fcd6834160a758233c5e",
      fragments: [
        "\tὑλοτόμος\t",
        "\tworm\t",
        "<b>cutting </b> or <b>felling wood </b>",
        "<b>a wood-cutter, woodman </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21307",
    expectedSourceRecordDigest:
      "0ccac8c365fd98581302131262d2979e4be698db6fcaa9a73ac35920e5d83e20",
    expectedGloss: "to obtain redress",
    classification: "specialized-domain-sense",
    confidence: 0.79,
    rationale:
      "The judicial/passive redress branch develops from receiving humane or favourable treatment.",
    semanticBridge:
      "The notice records active humane treatment; the gloss records the specialized legal result obtained by the treated party.",
    target: {
      line: 10931,
      byteOffset: 4712215,
      expectedLineDigest:
        "1196aa98d4b0582d1fc34c5e623e4bff3417e8bcb8205de8855181e30d472c0e",
      fragments: [
        "\tφιλανθρωπέω\t",
        "\tto obtain redress\t",
        "<b>to treat humanely </b>"
      ]
    }
  }),
  rule({
    entryKey: "greek:G21347",
    expectedSourceRecordDigest:
      "1ae98bdfbd04d925e0deba6f8fcc4e9f67d88599feb0087cc01c1fdf10047aaa",
    expectedGloss: "oracle, sanctuary",
    classification: "cognate-derived-sense",
    confidence: 0.96,
    rationale:
      "The χρηματ- family has both commercial/public-business and divine-response/oracular branches.",
    semanticBridge:
      "The target notice records the counting-house branch; G5537 and G5538 explicitly attest oracle, divine response, and revelation senses.",
    target: {
      line: 10971,
      byteOffset: 4717268,
      expectedLineDigest:
        "b5522a49d1b585f829d3fd36a97276687640441b3948cdbdfb061bdf95452d62",
      fragments: [
        "\tχρηματιστήριον\t",
        "\toracle, sanctuary\t",
        "<b>a place for transacting business, a counting-house </b>"
      ]
    },
    witnesses: [
      {
        id: "TBESG.G5537.oracle-response",
        line: 5705,
        byteOffset: 3544860,
        expectedLineDigest:
          "e75737b05eb0254361bdad25639a295173e45db0af9c42b1b61dcd62b532f0f5",
        role: "cognate",
        fragments: [
          "of an answer by an oracle",
          "of divine communications, to instruct, admonish"
        ]
      },
      {
        id: "TBESG.G5538.divine-response",
        line: 5706,
        byteOffset: 3546046,
        expectedLineDigest:
          "a5bfa60f76d56be0e99856bedb1efecc24385d5a93949fa22a4fa2bd7708c3b9",
        role: "cognate",
        fragments: ["<b>a divine response, an oracle</b>"]
      }
    ]
  })
];

const RETAINED_BASE_ENTRY_KEYS = new Set([
  "greek:G20159",
  "greek:G20727",
  "greek:G21114",
  "greek:G21347"
]);

const BASE_RULES: readonly EnglishSemanticGlossAttestationRule[] =
  LEGACY_BASE_RULES.filter((entry) =>
    RETAINED_BASE_ENTRY_KEYS.has(entry.entryKey)
  );

const RETAINED_SUPPLEMENTAL_ENTRY_KEYS = new Set(
  `G20011 G20021 G20110 G20174 G20286 G20369 G20450 G20598 G20818 G20836 G20895 G20921 G20995 G21015 G21045 G21187 G21208 G21224 G21284 G21423 G20044 G20055 G20085 G20125 G20180 G20289 G20308 G20349 G20355 G20463 G20952 G21213 G21235 G21245 G21333 G20057 G20171 G20317 G20329 G20392 G20448 G20538 G20618 G20689 G20787 G20947 G21006 G21081 G21133 G21214 G21294 G21493`
    .split(" ")
    .map((code) => `greek:${code}`)
);

const SUPPLEMENTAL_RULES: readonly EnglishSemanticGlossAttestationRule[] =
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries
    .filter(
      (entry) =>
        RETAINED_SUPPLEMENTAL_ENTRY_KEYS.has(entry.entryKey) &&
        entry.classification === "VALID_POLYSENSE" &&
        entry.proposedMorph === entry.identity.morph
    )
    .map(buildSupplementalRule);

const RULES: readonly EnglishSemanticGlossAttestationRule[] = [
  ...BASE_RULES,
  ...SUPPLEMENTAL_RULES
];

if (
  BASE_RULES.length !== 4 ||
  SUPPLEMENTAL_RULES.length !== 52 ||
  RULES.length !== 56
) {
  throw new Error(
    `english-semantic-gloss-attestation-coverage-drift:${BASE_RULES.length}:${SUPPLEMENTAL_RULES.length}:${RULES.length}`
  );
}
for (const retainedRule of RULES) {
  const targetWitnesses = retainedRule.witnesses.filter(
    (item) => item.role === "target-source-row"
  );
  if (
    targetWitnesses.length !== 1 ||
    targetWitnesses[0]!.semanticAuthority ||
    retainedRule.semanticProofs.length === 0 ||
    retainedRule.semanticProofs.some(
      (proof) =>
        proof.fragmentDigest !== sha256(proof.exactFragment) ||
        (proof.kind === "independent-witness-fragment" &&
          targetWitnesses[0]!.locator === proof.locator)
    )
  ) {
    throw new Error(
      `english-semantic-gloss-attestation-proof-policy-drift:${retainedRule.entryKey}`
    );
  }
}

export const ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES: ReadonlyMap<
  string,
  EnglishSemanticGlossAttestationRule
> = new Map(RULES.map((item) => [item.entryKey, item]));

export const ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST = sha256(
  stableJson(RULES)
);
export const EXPECTED_ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST =
  "2b5ada6c68a28fc741f1b187db11a98a1b0634bfff3aa4a5fa467fbbd5deedb7" as const;
if (
  ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST !==
  EXPECTED_ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST
) {
  throw new Error(
    `english-semantic-gloss-attestation-registry-drift:${ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST}:${EXPECTED_ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST}`
  );
}

function buildSupplementalRule(
  entry: EnglishSupplementalGlossAuditRule
): EnglishSemanticGlossAttestationRule {
  const target = entry.witnesses.find(
    (item) => item.role === "target-source-row"
  );
  if (!target || target.sourceFamily !== "TBESG") {
    throw new Error(
      `english-supplemental-semantic-gloss-target-missing:${entry.entryKey}`
    );
  }
  const targetLocator = parseSupplementalLocator(target);
  return rule({
    entryKey: entry.entryKey,
    expectedSourceRecordDigest: entry.sourceRecordDigest,
    expectedGloss: entry.rawGloss,
    classification: "lexical-polysemy",
    confidence: entry.confidence,
    rationale: entry.rationale,
    semanticBridge: entry.semanticBridge,
    meaningProofs: [entry.rawMeaning],
    target: {
      line: targetLocator.line,
      byteOffset: targetLocator.byteOffset,
      expectedLineDigest: target.expectedLineDigest,
      fragments: target.exactFragments
    },
    witnesses: entry.witnesses
      .filter((item) => item !== target)
      .map((item, index) => {
        const locator = parseSupplementalLocator(item);
        return {
          id: `SUPPLEMENTAL.${entry.entryKey}.${index + 1}.${item.role}`,
          sourceFamily: item.sourceFamily,
          line: locator.line,
          byteOffset: locator.byteOffset,
          expectedLineDigest: item.expectedLineDigest,
          role:
            item.sourceFamily === "TFLSJ"
              ? ("full-lexicon-corroboration" as const)
              : ("cognate" as const),
          fragments: item.exactFragments
        };
      })
  });
}

function parseSupplementalLocator(
  witness: EnglishSupplementalGlossAuditWitness
): { line: number; byteOffset: number } {
  const match = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(witness.locator);
  if (!match || match[1] !== witness.sourceFamily) {
    throw new Error(
      `english-supplemental-semantic-gloss-invalid-locator:${witness.locator}`
    );
  }
  return {
    line: Number.parseInt(match[2]!, 10),
    byteOffset: Number.parseInt(match[3]!, 10)
  };
}

function deriveTargetIdentityFragment(value: string | undefined): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("english-semantic-gloss-target-identity-fragment-missing");
  }
  if (!value.includes("\t")) return value;
  const firstField = value.split("\t").find((field) => field.length > 0);
  if (!firstField) {
    throw new Error("english-semantic-gloss-target-identity-fragment-invalid");
  }
  return `\t${firstField}\t`;
}

/**
 * Replays only semantic authority. It deliberately ignores the target gloss
 * and the target-row identity witness, so callers can prove non-circularity.
 */
export function validateEnglishSemanticGlossRuleProofs(
  entry: EnglishExactRepairEntry,
  context: EnglishSemanticGlossAttestationContext
): string[] {
  const issues = new Set<string>();
  const entryKey = englishExactRepairEntryKey(entry);
  const attestationRule =
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get(entryKey);
  if (!attestationRule) return [];
  if (attestationRule.semanticProofs.length === 0) {
    issues.add("english-semantic-gloss-proof-missing");
  }
  for (const proof of attestationRule.semanticProofs) {
    if (
      proof.fragmentDigest !== sha256(proof.exactFragment) ||
      proof.exactFragment.length === 0
    ) {
      issues.add(`english-semantic-gloss-proof-fragment-drift:${proof.id}`);
      continue;
    }
    if (proof.kind === "target-meaning-fragment") {
      if (!entry.meaning.includes(proof.exactFragment)) {
        issues.add(`english-semantic-gloss-proof-meaning-drift:${proof.id}`);
      }
      continue;
    }
    const witness = attestationRule.witnesses.find(
      (item) => item.id === proof.witnessId
    );
    if (
      !witness ||
      !witness.semanticAuthority ||
      witness.role === "target-source-row" ||
      proof.sourceFamily !== witness.sourceFamily ||
      proof.locator !== witness.locator ||
      proof.expectedLineDigest !== witness.expectedLineDigest
    ) {
      issues.add(`english-semantic-gloss-proof-witness-invalid:${proof.id}`);
      continue;
    }
    if (
      context.sourceDigests[witness.sourceFamily] !==
      PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES[witness.sourceFamily]
    ) {
      issues.add(
        `english-semantic-gloss-proof-source-drift:${proof.id}:${witness.sourceFamily}`
      );
    }
    const exactLine = context.sourceLines[witness.locator];
    if (
      typeof exactLine !== "string" ||
      sha256(exactLine) !== witness.expectedLineDigest ||
      !exactLine.includes(proof.exactFragment)
    ) {
      issues.add(`english-semantic-gloss-proof-witness-drift:${proof.id}`);
    }
  }
  return [...issues].sort();
}

export function attestEnglishSemanticGloss(
  entry: EnglishExactRepairEntry,
  context: EnglishSemanticGlossAttestationContext
): EnglishSemanticGlossAttestationEvidence | null {
  const entryKey = englishExactRepairEntryKey(entry);
  const attestationRule =
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get(entryKey);
  if (!attestationRule) return null;
  if (
    context.databaseDigest !== PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.database
  ) {
    throw new Error(`english-semantic-gloss-database-drift:${entryKey}`);
  }
  const sourceRecordDigest = digestEnglishExactRepairSourceRecord(entry);
  if (sourceRecordDigest !== attestationRule.expectedSourceRecordDigest) {
    throw new Error(`english-semantic-gloss-row-drift:${entryKey}`);
  }
  if (
    entry.gloss !== attestationRule.expectedGloss ||
    sha256(entry.gloss) !== attestationRule.expectedGlossDigest
  ) {
    throw new Error(`english-semantic-gloss-value-drift:${entryKey}`);
  }
  const proofIssues = validateEnglishSemanticGlossRuleProofs(entry, context);
  if (proofIssues.length > 0) {
    throw new Error(`${proofIssues[0]}:${entryKey}`);
  }
  const witnessLocators = new Set<string>();
  for (const sourceWitness of attestationRule.witnesses) {
    if (
      context.sourceDigests[sourceWitness.sourceFamily] !==
      PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES[sourceWitness.sourceFamily]
    ) {
      throw new Error(
        `english-semantic-gloss-source-drift:${entryKey}:${sourceWitness.sourceFamily}`
      );
    }
    if (witnessLocators.has(sourceWitness.locator)) {
      throw new Error(
        `english-semantic-gloss-witness-duplicate:${entryKey}:${sourceWitness.locator}`
      );
    }
    witnessLocators.add(sourceWitness.locator);
    const exactLine = context.sourceLines[sourceWitness.locator];
    if (
      typeof exactLine !== "string" ||
      sha256(exactLine) !== sourceWitness.expectedLineDigest
    ) {
      throw new Error(
        `english-semantic-gloss-witness-drift:${entryKey}:${sourceWitness.id}`
      );
    }
    for (const fragment of sourceWitness.fragments) {
      if (
        sha256(fragment.exactFragment) !== fragment.fragmentDigest ||
        !exactLine.includes(fragment.exactFragment)
      ) {
        throw new Error(
          `english-semantic-gloss-fragment-drift:${entryKey}:${sourceWitness.id}`
        );
      }
    }
  }
  return buildEnglishSemanticGlossAttestationEvidence(
    entry,
    attestationRule,
    attestationRule.witnesses.map((item) => ({
      id: item.id,
      sourceFamily: item.sourceFamily,
      locator: item.locator,
      lineDigest: sha256(context.sourceLines[item.locator]!)
    }))
  );
}

/**
 * Replays the sealed attestation envelope without trusting the audit JSON.
 * Exact source-line membership is checked while the audit is built; downstream
 * stages can then replay the same proof from the pinned source-file digests and
 * the line digests embedded in the registry.
 */
export function validateEnglishSemanticGlossAttestationEnvelope(input: {
  entry: EnglishExactRepairEntry;
  evidence: EnglishSemanticGlossAttestationEvidence | null;
  context: EnglishSemanticGlossAttestationEnvelopeContext;
}): string[] {
  const issues = new Set<string>();
  const entryKey = englishExactRepairEntryKey(input.entry);
  const attestationRule =
    ENGLISH_SEMANTIC_GLOSS_ATTESTATION_RULES.get(entryKey);
  if (!attestationRule) {
    if (input.evidence !== null) {
      issues.add("english-semantic-gloss-unexpected-attestation");
    }
    return [...issues];
  }
  if (input.context.exactOccurrenceCount !== 0) {
    issues.add("english-semantic-gloss-exact-occurrence-count-drift");
  }
  if (
    input.context.databaseDigest !==
    PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES.database
  ) {
    issues.add("english-semantic-gloss-database-drift");
  }
  for (const sourceWitness of attestationRule.witnesses) {
    if (
      input.context.sourceDigests[sourceWitness.sourceFamily] !==
      PINNED_ENGLISH_SEMANTIC_GLOSS_SOURCES[sourceWitness.sourceFamily]
    ) {
      issues.add(
        `english-semantic-gloss-source-drift:${sourceWitness.sourceFamily}`
      );
    }
  }
  if (
    attestationRule.semanticProofs.length === 0 ||
    attestationRule.witnesses.some(
      (witness) =>
        witness.role === "target-source-row" && witness.semanticAuthority
    )
  ) {
    issues.add("english-semantic-gloss-proof-policy-drift");
  }
  for (const proof of attestationRule.semanticProofs) {
    if (
      proof.fragmentDigest !== sha256(proof.exactFragment) ||
      proof.exactFragment.length === 0
    ) {
      issues.add("english-semantic-gloss-proof-fragment-drift");
    } else if (
      proof.kind === "target-meaning-fragment" &&
      !input.entry.meaning.includes(proof.exactFragment)
    ) {
      issues.add("english-semantic-gloss-proof-meaning-drift");
    } else if (proof.kind === "independent-witness-fragment") {
      const witness = attestationRule.witnesses.find(
        (item) => item.id === proof.witnessId
      );
      if (
        !witness ||
        !witness.semanticAuthority ||
        witness.role === "target-source-row" ||
        witness.locator !== proof.locator ||
        witness.expectedLineDigest !== proof.expectedLineDigest
      ) {
        issues.add("english-semantic-gloss-proof-witness-invalid");
      }
    }
  }
  if (
    digestEnglishExactRepairSourceRecord(input.entry) !==
    attestationRule.expectedSourceRecordDigest
  ) {
    issues.add("english-semantic-gloss-row-drift");
  }
  if (
    input.entry.gloss !== attestationRule.expectedGloss ||
    sha256(input.entry.gloss) !== attestationRule.expectedGlossDigest
  ) {
    issues.add("english-semantic-gloss-value-drift");
  }
  const expected = buildEnglishSemanticGlossAttestationEvidence(
    input.entry,
    attestationRule,
    attestationRule.witnesses.map((item) => ({
      id: item.id,
      sourceFamily: item.sourceFamily,
      locator: item.locator,
      lineDigest: item.expectedLineDigest
    }))
  );
  if (!input.evidence || stableJson(expected) !== stableJson(input.evidence)) {
    issues.add("english-semantic-gloss-attestation-evidence-replay-mismatch");
  }
  return [...issues].sort();
}

/** Builds the exact line map consumed by the audit from pinned STEP texts. */
export function buildEnglishSemanticGlossSourceLines(
  sourceTexts: Readonly<
    Partial<Record<EnglishSemanticGlossSourceFamily, string>>
  >
): Readonly<Record<string, string>> {
  const linesBySource = new Map<
    EnglishSemanticGlossSourceFamily,
    { bytes: Buffer; offsets: number[] }
  >();
  for (const sourceFamily of ["TBESG", "TFLSJ"] as const) {
    const text = sourceTexts[sourceFamily];
    if (typeof text !== "string") continue;
    const bytes = Buffer.from(text, "utf8");
    const offsets = [0];
    for (let index = 0; index < bytes.length; index += 1) {
      if (bytes[index] === 0x0a) offsets.push(index + 1);
    }
    linesBySource.set(sourceFamily, { bytes, offsets });
  }

  const result: Record<string, string> = {};
  for (const attestationRule of RULES) {
    for (const sourceWitness of attestationRule.witnesses) {
      if (result[sourceWitness.locator] !== undefined) continue;
      const parsed = /^(TBESG|TFLSJ):(\d+)@(\d+)$/u.exec(sourceWitness.locator);
      if (!parsed) {
        throw new Error(
          `english-semantic-gloss-invalid-locator:${sourceWitness.locator}`
        );
      }
      const sourceFamily = parsed[1] as EnglishSemanticGlossSourceFamily;
      const lineNumber = Number(parsed[2]);
      const expectedOffset = Number(parsed[3]);
      const source = linesBySource.get(sourceFamily);
      const actualOffset = source?.offsets[lineNumber - 1];
      if (!source || actualOffset !== expectedOffset) {
        throw new Error(
          `english-semantic-gloss-locator-drift:${sourceWitness.locator}`
        );
      }
      const lf = source.bytes.indexOf(0x0a, actualOffset);
      let end = lf === -1 ? source.bytes.length : lf;
      if (end > actualOffset && source.bytes[end - 1] === 0x0d) end -= 1;
      const exactLine = source.bytes
        .subarray(actualOffset, end)
        .toString("utf8");
      if (sha256(exactLine) !== sourceWitness.expectedLineDigest) {
        throw new Error(
          `english-semantic-gloss-witness-drift:${sourceWitness.id}`
        );
      }
      result[sourceWitness.locator] = exactLine;
    }
  }
  return Object.freeze(result);
}

function buildEnglishSemanticGlossAttestationEvidence(
  entry: EnglishExactRepairEntry,
  attestationRule: EnglishSemanticGlossAttestationRule,
  witnessLines: ReadonlyArray<{
    id: string;
    sourceFamily: EnglishSemanticGlossSourceFamily;
    locator: string;
    lineDigest: string;
  }>
): EnglishSemanticGlossAttestationEvidence {
  const entryKey = englishExactRepairEntryKey(entry);
  const ruleDigest = sha256(stableJson(attestationRule));
  const witnessCorpusDigest = sha256(stableJson(witnessLines));
  const semanticProofCorpusDigest = sha256(
    stableJson(attestationRule.semanticProofs)
  );
  const sourceRecordDigest = digestEnglishExactRepairSourceRecord(entry);
  const withoutDigest = {
    schemaVersion: ENGLISH_SEMANTIC_GLOSS_ATTESTATION_SCHEMA_VERSION,
    policyVersion: ENGLISH_SEMANTIC_GLOSS_ATTESTATION_POLICY_VERSION,
    entryKey,
    gloss: entry.gloss,
    classification: attestationRule.classification,
    confidence: attestationRule.confidence,
    expectedExactOccurrenceCount: attestationRule.expectedExactOccurrenceCount,
    ruleId: attestationRule.ruleId,
    ruleDigest,
    registryDigest: ENGLISH_SEMANTIC_GLOSS_ATTESTATION_REGISTRY_DIGEST,
    sourceRecordDigest,
    witnessCorpusDigest,
    semanticProofCorpusDigest
  };
  return {
    ...withoutDigest,
    attestationDigest: sha256(stableJson(withoutDigest))
  };
}

export function validateEnglishSemanticGlossAttestationEvidence(input: {
  entry: EnglishExactRepairEntry;
  evidence: EnglishSemanticGlossAttestationEvidence;
  context: EnglishSemanticGlossAttestationContext;
}): string[] {
  let expected: EnglishSemanticGlossAttestationEvidence | null = null;
  try {
    expected = attestEnglishSemanticGloss(input.entry, input.context);
  } catch (error) {
    return [error instanceof Error ? error.message : String(error)];
  }
  return expected && stableJson(expected) === stableJson(input.evidence)
    ? []
    : ["english-semantic-gloss-attestation-evidence-replay-mismatch"];
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
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
  return JSON.stringify(value);
}
