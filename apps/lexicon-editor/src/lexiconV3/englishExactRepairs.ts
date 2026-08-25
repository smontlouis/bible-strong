import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

import {
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG,
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST
} from "./englishSupplementalGlossAudit.js";
import {
  PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
  PINNED_G20354_PERSEUS_ARTIFACT_PATH,
  PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
  PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
  PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST,
  verifyPinnedG20354PerseusArtifact
} from "./perseusLsjG20354.js";
import pinnedG20354PerseusArtifact from "./sources/perseus-lsj-g20354-n35193.json" with { type: "json" };

const pinnedG20354PerseusArtifactFile = readFileSync(
  new URL("./sources/perseus-lsj-g20354-n35193.json", import.meta.url)
);

export const ENGLISH_EXACT_REPAIR_SCHEMA_VERSION =
  "lexicon-v3-english-exact-repair@1" as const;
export const ENGLISH_EXACT_REPAIR_POLICY_VERSION =
  "lexicon-v3-english-exact-repair-policy@1" as const;

export const PINNED_ENGLISH_EXACT_REPAIR_SOURCES = Object.freeze({
  database: "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
  TBESG: "e8f58a8f841f2a338b3df648466a773928127e6080c06d32ee88694fb761facb",
  TBESH: "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
  TIPNR: "af26347131e130f5abf060522437f1b03ebf0a9b60338065ce9b4e1e9a8ef4a1"
});

export type EnglishExactRepairField = "gloss" | "meaning" | "morph";
export type EnglishExactRepairMethod =
  | "exact-definition-extraction"
  | "exact-mechanical-normalization"
  | "exact-morphological-classification"
  | "exact-orthographic-correction"
  | "exact-companion-field-recovery"
  | "exact-same-family-companion-recovery"
  | "exact-external-witness-recovery"
  | "exact-pinned-external-lexicon-recovery";

export interface EnglishExactRepairExternalArtifact {
  sourceFamily: "PERSEUS_LSJ";
  artifactPath: typeof PINNED_G20354_PERSEUS_ARTIFACT_PATH;
  artifactDigest: typeof PINNED_G20354_PERSEUS_ARTIFACT_DIGEST;
  artifactFileDigest: typeof PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST;
  payloadDigest: typeof PINNED_G20354_PERSEUS_PAYLOAD_DIGEST;
  sourceFileDigest: typeof PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST;
  sourceFragmentDigest: typeof PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST;
}

export interface EnglishExactRepairExternalWitness {
  sourceFamily: "TBESG" | "TBESH" | "TIPNR";
  role:
    | "same-family-adjective"
    | "same-family-adverb"
    | "same-family-noun"
    | "same-family-verb"
    | "foreign-suffix-owner"
    | "tipnr-exact-dstrong"
    | "tipnr-short-description";
  locator: string;
  expectedLineDigest: string;
  exactFragments: readonly string[];
}

export interface EnglishExactRepairEntry {
  language: "greek" | "hebrew";
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
  gloss: string;
  meaning: string;
}

export interface EnglishExactRepairSupport {
  field: EnglishExactRepairField;
  exactFragment: string;
  fragmentDigest: string;
}

export interface EnglishExactRepairChange {
  field: EnglishExactRepairField;
  sourceValue: string;
  sourceValueDigest: string;
  repairedValue: string;
  repairedValueDigest: string;
  method: EnglishExactRepairMethod;
  support: readonly EnglishExactRepairSupport[];
}

export interface EnglishExactRepairRule {
  ruleId: string;
  entryKey: string;
  sourceFamily: "TBESG" | "TBESH";
  expectedSourceRecordDigest: string;
  supplementalAuditCatalogDigest?: string;
  rationale: string;
  changes: readonly EnglishExactRepairChange[];
  externalWitnesses?: readonly EnglishExactRepairExternalWitness[];
  externalArtifact?: EnglishExactRepairExternalArtifact;
}

export interface EnglishExactFieldRepairEvidence {
  schemaVersion: typeof ENGLISH_EXACT_REPAIR_SCHEMA_VERSION;
  policyVersion: typeof ENGLISH_EXACT_REPAIR_POLICY_VERSION;
  entryKey: string;
  field: EnglishExactRepairField;
  sourceValue: string;
  repairedValue: string;
  method: EnglishExactRepairMethod;
  ruleId: string;
  ruleDigest: string;
  sourceRecordDigest: string;
  sourceValueDigest: string;
  repairedValueDigest: string;
  supportDigest: string;
  repairDigest: string;
}

export interface EnglishExactRepairContext {
  databaseDigest: string;
  sourceDigests: Readonly<Partial<Record<"TBESG" | "TBESH" | "TIPNR", string>>>;
  /** Test-only override; production replays the checked-in canonical artifact. */
  g20354PerseusArtifact?: unknown;
  /** Test-only override paired with g20354PerseusArtifact. */
  g20354PerseusArtifactFile?: string | Buffer;
}

export interface EnglishExactRepairResult {
  entry: EnglishExactRepairEntry;
  repairs: EnglishExactFieldRepairEvidence[];
}

interface ChangeInput {
  field: EnglishExactRepairField;
  sourceValue: string;
  repairedValue: string;
  method: EnglishExactRepairMethod;
  support?: ReadonlyArray<{
    field: EnglishExactRepairField;
    exactFragment: string;
  }>;
}

function change(input: ChangeInput): EnglishExactRepairChange {
  const support = (input.support ?? []).map((item) => ({
    ...item,
    fragmentDigest: sha256(item.exactFragment)
  }));
  return Object.freeze({
    field: input.field,
    sourceValue: input.sourceValue,
    sourceValueDigest: sha256(input.sourceValue),
    repairedValue: input.repairedValue,
    repairedValueDigest: sha256(input.repairedValue),
    method: input.method,
    support: Object.freeze(support)
  });
}

function rule(input: {
  entryKey: string;
  sourceFamily?: "TBESG" | "TBESH";
  expectedSourceRecordDigest: string;
  supplementalAuditCatalogDigest?: string;
  rationale: string;
  changes: readonly ChangeInput[];
  externalWitnesses?: readonly EnglishExactRepairExternalWitness[];
  externalArtifact?: EnglishExactRepairExternalArtifact;
}): EnglishExactRepairRule {
  return Object.freeze({
    ruleId: `english-exact-repair:${input.entryKey}@1`,
    entryKey: input.entryKey,
    sourceFamily: input.sourceFamily ?? "TBESG",
    expectedSourceRecordDigest: input.expectedSourceRecordDigest,
    ...(input.supplementalAuditCatalogDigest
      ? { supplementalAuditCatalogDigest: input.supplementalAuditCatalogDigest }
      : {}),
    rationale: input.rationale,
    changes: Object.freeze(input.changes.map(change)),
    ...(input.externalArtifact
      ? { externalArtifact: Object.freeze({ ...input.externalArtifact }) }
      : {}),
    ...(input.externalWitnesses && input.externalWitnesses.length > 0
      ? {
          externalWitnesses: Object.freeze(
            input.externalWitnesses.map((witness) =>
              Object.freeze({
                ...witness,
                exactFragments: Object.freeze([...witness.exactFragments])
              })
            )
          )
        }
      : {})
  });
}

const BASE_RULES: readonly EnglishExactRepairRule[] = [
  rule({
    entryKey: "greek:G1605",
    expectedSourceRecordDigest:
      "97b177d4a8b9b4f3eafd6d160e631b74fadb0aae69e99d84eeca08de634b9639",
    rationale:
      "Remove the exact G1167 notice mechanically expanded after the complete G1605 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          '<b>ἐκ-πλήσσω</b><br /> (Attic -ττω, Act.13:12), [in LXX: (pass.) Ecc.7:16, (שָׁמֵם hithp.), Wis.13:4, 2Ma.7:12, 4Ma.8:4 4Mac 17:16 *;] <br />1. prop., <b>to strike out, drive away</b>. <br /><br />2. <b>to strike with panic or shock, to amaze, astonish</b>: pass., Mat.13:54 19:25, Mrk.6:2 7:37 10:26, Luk.2:48; before ἐπί, with dative of thing(s), Mat.7:28 22:33, Mrk.1:22 11:18, Luk.4:32 9:43, Act.13:12.†<br /> <re><i>SYN.</i>: " πτωεῖν G?, <i>to terrify, agitate with fear</i>; </re> <br />τρεμεῖν, <b>to tremble</b>, predominantly physical; <br /> φοβεῖν, <b>to fear</b>, "the general term," Thayer; <br /> cf. also φρίσσω, <b>to shudder</b>, and see: δειλία <br /> <b>δειλία</b>, -ας, ἡ <br /> (δειλός), [in LXX for אֵימָה, מְחִתָּה, etc.;] <br /><b>cowardice, timidity</b> (never in good sense): 2Ti.1:7.†<br /> <re><i>SYN.</i>: φόβος, <i>fear</i>, in general, good or bad; εὐλάβεια (which see), apprehension generally, but chiefly <i>pious fear</i>, "that careful and watchful reverence which pays regard to every circumstance in that with which it has to deal" (cf. Tr., <i>Syn.</i>, § x).†</re> (AS)',
        repairedValue:
          '<b>ἐκ-πλήσσω</b><br /> (Attic -ττω, Act.13:12), [in LXX: (pass.) Ecc.7:16, (שָׁמֵם hithp.), Wis.13:4, 2Ma.7:12, 4Ma.8:4 4Mac 17:16 *;] <br />1. prop., <b>to strike out, drive away</b>. <br /><br />2. <b>to strike with panic or shock, to amaze, astonish</b>: pass., Mat.13:54 19:25, Mrk.6:2 7:37 10:26, Luk.2:48; before ἐπί, with dative of thing(s), Mat.7:28 22:33, Mrk.1:22 11:18, Luk.4:32 9:43, Act.13:12.†<br /> <re><i>SYN.</i>: " πτωεῖν G?, <i>to terrify, agitate with fear</i>; </re> <br />τρεμεῖν, <b>to tremble</b>, predominantly physical; <br /> φοβεῖν, <b>to fear</b>, "the general term," Thayer; <br /> cf. also φρίσσω, <b>to shudder</b>, and see: δειλία <br /> ',
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>δειλία</b>, -ας, ἡ <br /> (δειλός), [in LXX for אֵימָה, מְחִתָּה, etc.;] <br "
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:1299@661623",
        expectedLineDigest:
          "7edd565f2f64e23fb86e69b5372b4c844e43fd36abe0bc1d7a96964f91c07f61",
        exactFragments: ["G1167\tG1167 =", "\tδειλία\t", "<b>δειλία</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G1933",
    expectedSourceRecordDigest:
      "47393ab71da7e1a1d4f5ca1935718fbe867a91c1e7c2d671e3e2da048130b346",
    rationale:
      "Remove the exact G1932 notice mechanically expanded after the complete G1933 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          '<b>ἐπιεικής</b>, -ές<br /> (εἰκός, likely), [in LXX: Psa.86:5 (סַלָּח), Est.8:13 *;] <br />1. seemly, fitting (Hom.). <br /><br />2. <b>equitable, fair, moderate</b>: 1Ti.3:3, Tit.3:2, 1Pe.2:18, Jas.3:17; τὸ ἐ. (Thuc., i, 76), Php.4:5 (cf. Mayor, Ja, l.with, and see: ἐπιεικία).†<br /> ἐπιείκεια see: ἐπιεικία<br /> <b>ἐπιεικία</b> (Rec. -είκεια), -ας, ἡ <br /> (ἐπιεικής), [in LXX: Wis.2:19 12:18 Bar.2:27, from LXX Bar.4:24, TH (3:42), 2Ma.2:22 2Mac 10:4, 3Ma.3:15 3Mac 7:6 *;] <br /><b>fairness, moderation, gentleness </b>("sweet reasonableness," Matthew Arnold): Act.24:4; with πραΰτης, 2Co.10:1.†<br /> <re><i>SYN.</i>: πραΰτης (see Tr., <i>Syn.</i>, § xliii)</re> (AS)',
        repairedValue:
          "<b>ἐπιεικής</b>, -ές<br /> (εἰκός, likely), [in LXX: Psa.86:5 (סַלָּח), Est.8:13 *;] <br />1. seemly, fitting (Hom.). <br /><br />2. <b>equitable, fair, moderate</b>: 1Ti.3:3, Tit.3:2, 1Pe.2:18, Jas.3:17; τὸ ἐ. (Thuc., i, 76), Php.4:5 (cf. Mayor, Ja, l.with, and see: ἐπιεικία).†<br /> ἐπιείκεια see: ἐπιεικία<br /> ",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>ἐπιεικία</b> (Rec. -είκεια), -ας, ἡ <br /> (ἐπιεικής), [in LXX: Wis.2:19 12:1"
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:2073@1225060",
        expectedLineDigest:
          "1ff851d69f651516bdd0e575728212649d5dbbcc4b917403017f2d9ba6a8a13c",
        exactFragments: ["G1932\tG1932 =", "\tἐπιείκεια\t", "<b>ἐπιεικία</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G3043",
    expectedSourceRecordDigest:
      "e456671d44ab9d8ff5bdd3778531038571dbb0f82cc7dffbc82354f8068cde77",
    rationale:
      "Remove the exact G3037 notice mechanically expanded after the complete G3043 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "<b>λίνον</b><br /> (Tr. λῖνον), -ου, τό [in LXX: Exo.9:31 (פִּשְׁתָּה), al.;] <br />1. <b>flax</b>: Mat.12:20 (LXX). <br /><br />2. <b>linen</b>: Rev.15:6 (R, mg., see: λίθος).†<br /> <b>λίθος</b>, -ου, ὁ<br /> (and, in Att.., of precious stones, ἡ.) [in LXX for אֶבֶן, Gen.11:3, al.; λ. τίμιος, for פָּז, Psa.19:10 21:3, Pro.8:19, al.;] <br /><b>a stone</b>: Mat.4:6, al.; pl., Mat.3:9, al.; at the entrance of a tomb, Mat.27:60, 66 28:2, Mrk.15:46 16:3-4, Luk.24:2, Jhn.11:38, 32 11:41 20:1; λ. μυλικός, Luk.17:2, cf. Rev.18:21; of building stones, Mat.21:42, [44], Mat.24:2, Mrk.12:10 13:1-2, Luk.19:44 20:17-18 21:5-6 Act.4:11, 1Pe.2:7; metaphorically, of Christ, λ. ἀκρογωναῖος, ἐκλεκτός, ἔντιμος, 1Pe.2:6 (LXX); λ. ζῶν, 1Pe.2:4; προσκόμματος, 1Pe.2:8, Rom.9:33; of Christians, λ. ζῶντες, 1Pe.2:5; of precious stones, λ. τίμιος, Rev.17:4 18:12, 16 21:11, 19; ἴασπις, Rev.4:3; ἐνδεδυμένοι λ. καθαρόν, Rev.15:6 (λίνον, Rec., R, mg., see Swete, in l); metaphorically, λ. τίμιοι, 1Co.3:12; of the tables of the law, 2Co.3:7; of idols, Act.17:29 <br /> (AS)",
        repairedValue:
          "<b>λίνον</b><br /> (Tr. λῖνον), -ου, τό [in LXX: Exo.9:31 (פִּשְׁתָּה), al.;] <br />1. <b>flax</b>: Mat.12:20 (LXX). <br /><br />2. <b>linen</b>: Rev.15:6 (R, mg., see: λίθος).†<br /> ",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>λίθος</b>, -ου, ὁ<br /> (and, in Att.., of precious stones, ἡ.) [in LXX for א"
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:3239@1994854",
        expectedLineDigest:
          "74174b35f10b716f43fbc6d02f3a0f16c4e4c3d7811d2698b6341aff70d8ca15",
        exactFragments: ["G3037\tG3037 =", "\tλίθος\t", "<b>λίθος</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G3385",
    expectedSourceRecordDigest:
      "f49eba0692115c0b3a3b670a63da964997b44eb4a4fa8cf9b64972872d50e3d3",
    rationale:
      "Remove the exact G1487G notice mechanically expanded after the complete G3385 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          '<b>μή-τι </b><br /> interrog. particle, <b>expecting a negative answer</b>: Mat.7:16 26:22, 25, Mrk.4:21 14:19, Luk.6:39, Jhn.8:22 18:35, Act.10:47, 2Co.12:18, Jas.3:11; in hesitant questions (see M, <i>Pr.</i>, 170.), μ οὗτός ἐστιν, <br /> can this be, Mat.12:23, Jhn.4:29; μ. ἄρα, 2Co.1:17; On εἰ μήτι (Luk.9:13, cf. Bl., § 65, 6), see: εἰ.†<br /> <b>εἰ</b>, <br /> <i>conjunctive particle</i>, used in conditions and in indirect questions. <br /><br />I. Conditional, <b>if</b>; <br />1. with indic, expressing a general assumption; <br />__(a) pres.: before indic, pres., Mat.11:14, Rom.8:25, al.; before imperat., Mrk.4:23 9:22, Jhn.15:18, 1Co.7:9, al.; before fut. indic., Luk.16:31, Rom.8:11, al.; before pf. or aor., with negation in apodosis, Mat.12:26, Rom.4:14, al.; similarly, before impf., Luk.17:6, Jhn.8:39; before quæst., Mat.6:23, Jhn.5:47 7:23 8:46, 1Pe.2:20; <br /> __(b) fut.: Mat.26:33, 1Pe.2:20; <br /> __(with) pf.: Jhn.11:12, Rom.6:5, al.; <br /> __(d) aor.: Luk.16:11 19:8, Jhn.13:32, 18:23, Rev.20:15, al. <br /><br />2. <b>Where the assumption is certain = ἐπεί</b>: Mat.12:28, Jhn.7:4, Rom.5:17, al. <br /><br />3. Of an unfulfilled condition, with indic, impf., aor. or plpf., before ἄν, with imp. or aor. (see: ἄν, I, i). <br /><br />4. C. indic., after verbs denoting wonder, etc., sometimes, but not always, coupled with an element of doubt: Mrk.15:44, 1Jn.3:13, al. <br /><br />5. C. indic., as in LXX (Num.14:3o, 1Ki.14:45, al. = Heb. אִם), in oaths, with the formula of imprecation understood in a suppressed apodosis (WM, 627; Burton, §272): Mrk.8:12, Heb.3:11" (LXX) 4:3 (LXX). <br /><br />6. Rarely (cl.) with optative, <b>to express a merely possible condition</b>: Act.24:19 27:39, 1Co.14:10 15:37, I Pe3:14, 17. <br /><br />II. Interrogative, <b>if, whether</b>. <br />1. As in cl., in indir. questions after verbs of seeing, asking, knowing, saying, etc.: with indic. pres., Mat.26:63, Mrk.15:36, Act.19:2, 2Co.13:5, al.; fut., Mrk.3:2, Act.8:22, al.; aor., Mrk.15:44, 1Co.1:16, al.; with subjc. aor. (M, <i>Pr.</i>, 194), Php.3:12. <br /><br />2. As in LXX (= Heb. אִם and interrog. הֲ, Gen.17:17, al.; see WM, 639f.; Viteau, i, 22), <b>in direct questions</b>: Mrk.8:23 (Tr., WH, txt.), Luk.13:23, 22:49, Act.19:2, al.<br /><br />III. With other particles. <br />1. εἰ ἄρα, εἴγε, εἰ δὲ μήγε, see: ἄρα, γε. <br /><br />2. εἰ δὲ καί, <b>but if also</b>: Luk.11:18; <b>but even if</b>, 1Co.4:7, 2Co.4:3 11:16. <br /><br />3. εἰ δὲ μή, <b>but if not, but if otherwise</b>: Mrk.2:21, 22 Jhn.14:2, Rev.2:5, al. <br /><br />4. εἰ καί, <b>if even, if also, although</b>: Mrk.14:29, Luk.11:8, 1Co.7:21, 2Co.4:16, Php.2:17, al. <br /><br />5. καὶ εἰ, <b>even if</b>, see: καί <br /><br />6. εἰ μή, <b>if not, unless, except, but only</b>: Mat.24:22, Mrk.2:26 6:5, Jhn.9:33, 1Co.7:17 (<b>only</b>), Gal.1:19 (cf. ἐὰν μή, 2:16; see Hort., <i>Ja.</i>, xvi); ἐκτὸς εἰ μή, pleonastic (Bl., §65, 6), 1Co.14:5 15:2, 1Ti.5:19. <br /><br />7. εἰ μήν = cl. ἦ μήν (M, <i>Pr.</i>, 46), in oaths, <b>surely</b> (Eze.33:27, al.): Heb.6:14. <br /><br />8. εἴ πως, <b>if haply</b>: Act.27:12, Rom.1:10. <br /><br />9. εἴτε... εἴτε, <b>whether... or</b>; Rom.12:6-8, 1Co.3:22 13:8, al. <br /> (AS)',
        repairedValue:
          "<b>μή-τι </b><br /> interrog. particle, <b>expecting a negative answer</b>: Mat.7:16 26:22, 25, Mrk.4:21 14:19, Luk.6:39, Jhn.8:22 18:35, Act.10:47, 2Co.12:18, Jas.3:11; in hesitant questions (see M, <i>Pr.</i>, 170.), μ οὗτός ἐστιν, <br /> can this be, Mat.12:23, Jhn.4:29; μ. ἄρα, 2Co.1:17; On εἰ μήτι (Luk.9:13, cf. Bl., § 65, 6), see: εἰ.†<br /> ",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>εἰ</b>, <br /> <i>conjunctive particle</i>, used in conditions and in indirec"
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:1619@864648",
        expectedLineDigest:
          "acfa0bc4dcc32ec6535199ae51d8275cd883da20016d43afd8d81bc805174d34",
        exactFragments: ["G1487\tG1487G =", "\tεἰ\t", "<b>εἰ</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G4461",
    expectedSourceRecordDigest:
      "4c2da9a055a41d40b1cbbd14b7c93c59c6471e344fae0ea49e83cb5f78d17f66",
    rationale:
      "Remove the exact G4462 notice mechanically expanded after the complete G4461 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "<b>ῥαββεί</b> (Rec. -βί, see WH, <i>App.</i>, 155) (Heb. and Aram. רַב, my master; see Dalman, <i>Words</i>, 327, 331 ff.), <br /> <b>a title of respectful address to Jewish teachers, Rabbi</b>: Mat.23:7-8; of John, Jhn.3:26; of Christ, Mat.26:25, 49, Mrk.9:5 11:21 14:45, Jhn.1:30, 50 3:2 4:31 6:25 9:2 11:8; κύριε ῥ Mrk.10:51 (WH, mg., see: ῥαββουνεί).†<br /> <b>ῥαββουνεί</b> (Rec. -βονί, see: ῥαββεί) (Aram. רַבּוֺנִי, later, רִבּוֺנִי my master; on the Greek vocalization and the relation of the word to ῥαββεί, see Dalman, <i>Words</i>, 324, 340; <i>Gr.</i>, 140; <i>DB</i>, iv, 190) <br /> <b>Rabboni</b>: Mrk.10:51 (WH, mg., κύριε ῥαββεί), Jhn.20:16.†<br /> (AS)",
        repairedValue:
          "<b>ῥαββεί</b> (Rec. -βί, see WH, <i>App.</i>, 155) (Heb. and Aram. רַב, my master; see Dalman, <i>Words</i>, 327, 331 ff.), <br /> <b>a title of respectful address to Jewish teachers, Rabbi</b>: Mat.23:7-8; of John, Jhn.3:26; of Christ, Mat.26:25, 49, Mrk.9:5 11:21 14:45, Jhn.1:30, 50 3:2 4:31 6:25 9:2 11:8; κύριε ῥ Mrk.10:51 (WH, mg., see: ῥαββουνεί).†<br /> ",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>ῥαββουνεί</b> (Rec. -βονί, see: ῥαββεί) (Aram. רַבּוֺנִי, later, רִבּוֺנִי my"
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:4595@2921286",
        expectedLineDigest:
          "1a98879ba32ceab5dee23c9a54f336e8ee3dce61450e65f2001c2915677fbe60",
        exactFragments: [
          "G4462\tG4462 = a Name of",
          "\tῥαββονί\t",
          "<b>ῥαββουνεί</b>"
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G4632",
    expectedSourceRecordDigest:
      "3643f7abd2659859756bfa4323070c88349c48bcb2f616e3150a5af512975a5e",
    rationale:
      "Remove the exact G2932 notice mechanically expanded after the complete G4632 notice; retain the owner's see-reference.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "<b>σκεῦος</b>, -ους, τό <br /> [in LXX chiefly for כְּלִי;] <br /><b>a vessel, implement </b>(for exx. in various senses, see MM, xxii): Mrk.11:16, Luk.8:16, Jhn.19:29, Act.10:11, 16 11:5, Rom.9:21, Rev.18:12; pl., 2Ti.2:20, Rev.2:27; τὰ σ. τῆς λειτουργίας, Heb.9:21; pl., τὰ σ., utensils, goods, Mat.12:29, Mrk.3:27, Luk.17:31; id. of the tackle or gear of a ship (Xen., Polyb., al.); so in sing., τὸ σ., Act.27:17. Metaphorical, of persons: σ. ἐκλογῆς, Act.9:15; ὀργῆς, Rom.9:22; ἐλέους, Rom.9:23; σ. εἰς τιμήν (cf. Rom.9:21), 2Ti.2:21; of woman, ἀσθενέστερον σ., 1Pe.3:7; so perh. τ. ἑαυτοῦ σ., 1Th.4:4 (but see infr.); of the body, 2Co.4:7; so perh. 1Th.4:4 (but see supr., and see: κτάομαι).†<br /> <b>κτάομαι</b>, -ῶμαι <br /> [in LXX chiefly for קָנָה;] <br />in pres., impf., fut. and aor., <b>to procure for oneself, get, gain, acquire </b>(the pf. and plpf., to have acquired, hence to possess, do not occur in NT): with accusative of thing(s), Mat.10:9, Luk.18:12, Act.8:20; with genitive pret., Act.22:28; ἐκ with genitive pret., Act.1:18; τ,ψυχὰς ὑμῶν (MM, xvi), Luk.21:19; τ. ἑαυτοῦ σκεῦος κτᾶσθαι, 1Th.4:4 (where if σ. = body, κ. must = pf., κέκτημαι; see MM, xvi; M, <i>Th.</i>, in l; Field, <i>Notes</i>, 72 f. But σ. is most frequently taken as = wife; see Thayer, see word; Lft., <i>Notes</i>, 53 ff.; <i>ICC</i>, in l).†<br /> (AS)",
        repairedValue:
          "<b>σκεῦος</b>, -ους, τό <br /> [in LXX chiefly for כְּלִי;] <br /><b>a vessel, implement </b>(for exx. in various senses, see MM, xxii): Mrk.11:16, Luk.8:16, Jhn.19:29, Act.10:11, 16 11:5, Rom.9:21, Rev.18:12; pl., 2Ti.2:20, Rev.2:27; τὰ σ. τῆς λειτουργίας, Heb.9:21; pl., τὰ σ., utensils, goods, Mat.12:29, Mrk.3:27, Luk.17:31; id. of the tackle or gear of a ship (Xen., Polyb., al.); so in sing., τὸ σ., Act.27:17. Metaphorical, of persons: σ. ἐκλογῆς, Act.9:15; ὀργῆς, Rom.9:22; ἐλέους, Rom.9:23; σ. εἰς τιμήν (cf. Rom.9:21), 2Ti.2:21; of woman, ἀσθενέστερον σ., 1Pe.3:7; so perh. τ. ἑαυτοῦ σ., 1Th.4:4 (but see infr.); of the body, 2Co.4:7; so perh. 1Th.4:4 (but see supr., and see: κτάομαι).†<br /> ",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>κτάομαι</b>, -ῶμαι <br /> [in LXX chiefly for קָנָה;] <br />in pres., impf., "
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:3127@1928264",
        expectedLineDigest:
          "1eba01ab8c4d3549949e7bd5fbd7d716f10c170affdd119551ec8995d7a461f1",
        exactFragments: ["G2932\tG2932 =", "\tκτάομαι\t", "<b>κτάομαι</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G2532",
    expectedSourceRecordDigest:
      "3cedfddeb469740c98ca327ae455117ef1a54d5c265530dda64c6fb451e11645",
    rationale:
      "Remove the exact G1437 notice that was mechanically concatenated after the complete G2532 notice.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          '<b>καί</b>, <br /> <i>conj.</i>, <br /><b>and</b> <br />I. Copulative. <br /><br />1. Connecting single words; <br />__(a) <b>in general</b>: Mat.2:18, 16:1, Mrk.2:15, Luk.8:15, Heb.1:1, al. mult.; repeated before each of the terms in a series, Mat.23:23, Luk.14:21, Rom.7:12, 9:4, al.<br /> __(b) <b>connecting numerals </b>(WM, §37, 4): Jhn.2:20, Act.13:20; <br /> __(with) <b>joining terms which are not mutually exclusive, as the part with the whole</b>: Mat.8:33, 26:59, Mrk.16:17, Act.5:29, al. <br /><br />2. <b>Connecting clauses and sentences</b>: Mat.3:12, Act.5:21, al. mult.; esp. <br />__(a) <b>where, after the simplicity of the popular language, sentences are paratactically joined </b>(WM, §60, 3; M, <i>Pr.</i>, 12; Deiss., <i>LAE</i>, 128ff.): Mat.1:21, 7:25, Mrk.9:5, Jhn.10:3, al.; <br /> __(b) <b>joining affirmative to negative sentences</b>: Luk.3:14, Jhn.4:11, IIIJhn.10; <br /> __(with) consecutive, <b>and so</b>: Mat.5:1, 23:32, Heb.3:19, al.; after imperatives, Mat.4:19, Luk.7:7, al.; <br /> __(d) = καίτοι, <b>and yet</b>: Mat.3:14, 6:26, Mrk.12:12, Luk.18:7 (Field, <i>Notes</i>, 72), 1Co.5:2, al.; <br /> __(e) beginning an apodosis (= Heb. וְ; so sometimes δέ in cl.), <b>then</b>: Luk.2:21, 7:12, Act.1:10; beginning a question (WM, §53, 3a): Mrk.10:26, Luk.10:29, Jhn.9:36.<br /><br />3. Epexegetic, <b>and, and indeed, namely</b> (WM, §53, 3c): Luk.3:18, Jhn.1:16, Act.23:6, Rom.1:5, 1Co.3:5, al.<br /><br />4. <b>In transition</b>: Mat.4:23, Mrk.5:1, 21, Jhn.1:19, al.; so, Hebraistically, καὶ ἐγένετο (וַי:הִי; also ἐγένετο δέ), Mrk.1:9 (cf. Luk.5:1; V. Burton, §§357-60; M, <i>Pr.</i>, 14, 16). <br /><br />5. καὶ... καί, <b>both... and</b> (for τε... καί, see: τε); <br />__(a) <b>connecting single words</b>: Mat.10:28, Mrk.4:41, Rom.11:33, al.; <br /> __(b) <b>clauses and sentences</b>: Mrk.9:13, Jhn.7:28, 1Co.1:22, al. <br /><br />II. Adjunctive, <b>also, even, still</b>: Mat.5:39, 40; Mrk.2:28, al. mult.; esp. with pron., adv., etc., Mat.20:4, Jhn.7:47, al; ὡς κ., Act.11:17; καθὼς κ., Rom.15:7; οὑτω κ., Rom.6:11; διὸ κ., Luk.1:35; ὁ κ. (Deiss., <i>BS</i>, 313ff.), Act.13:9; pleonastically, μετὰ κ.. (Bl., §77, 7; Deiss., <i>BS</i>, 265f,), Php.4:3; τί κ., 1 Co 15:29; ἀλλὰ κ., Luk.14:22, Jhn.5:18, al.; καίγε (M, <i>Pr.</i>, 230; Burton, §437), Act.17:27; καίπερ, Heb.5:8; κ. ἐάν, see: ἐάν.<br /> <b>ἐάν</b>, contr. fr. εἰ ἄν, <br /> <i>conditional particle</i>, <br />representing something as "under certain circumstances actual or liable to happen," but not so definitely expected as in the case of εἰ with ind. (Bl., §65, 4; cf. Jhn.13:17, 1Co.7:36), <b>if haply, if</b>; <br />1. with subjc. (cl.); <br />__(a) pres.: Mat.6:22, Luk.10:6, Jhn.7:17, Rom.2:25, 26 al.; <br />{ __(b) aor. (= Lat. fut. pf.): Mat.4:9 16:26 (cf. ptcp. in Luk.9:25; M, <i>Pr.</i>, 230), Mrk.3:24, Luk.14:34, Jhn.5:43, Rom.7:2, al.; = cl. εἰ, with opt., Jhn.9:22 11:57, Act.9:2; as Heb. אִם = ὅταν, Jhn.12:32 14:3, I Jhn.2:28 3:2, Heb.3:7" (LXX). <br /><br />2. C. indic, (as in late writers, fr. Arist. on; see WH, <i>App.</i>, 171; VD, <i>MGr.</i> 2, <i>App.</i>, §77; Deiss., <i>BS</i>, 201f., <i>LAE</i>, 155, 254; M, <i>Pr.</i>, 168, 187; Bl., §65, 4); <br />__(a) fut.: Mat.18:19 T, Luk.19:40, Act.7:7; <br /> __(b) pres.: 1Th.3:8 (see Milligan, in l.). <br /><br />3. <b>With other particles</b>: ἐ. καί (Bl., §65, 6), Gal.6:1; ἐ. μή (M, <i>Pr.</i>, 185, 187; Bl., l.with), with subjc. pres., Mat.10:13, 1Co.8:8, Jas.2:17, 1Jn.3:21; aor., Mat.6:15, Mrk.3:27, Jhn.3:3, Rom.10:15, Gal.1:8 2:16 (see Lft., Ellic., in ll.); ἐ. τε... ἐ. τε, [in LXX for אִם... אִם, Est.19:13, al.,] Rom.14:8. <br /><br />4. = cl. ἄν (which see) after relat. pronouns and adverbs (Tdf., <i>Pr.</i>, 96; WH, <i>App.</i>, 173; M, <i>Pr.</i>, 42f.; Bl., §26, 4; Mayser, 152f.; Deiss., <i>BS</i>, 202ff.): ὃς ἐ., Mat.5:19, Mrk.6:22, 23 Luk.17:32, 1Co.6:18, al.; ὅπου ἐ., Mat.8:19; ὁσάκις ἐ., Rev.11:6; οὗ ἐ., 1Co.16:6; καθὸ ἐ., 2Co.8:12; ὅστις ἐ., Gal.5:10. <br /> (AS)',
        repairedValue:
          "<b>καί</b>, <br /> <i>conj.</i>, <br /><b>and</b> <br />I. Copulative. <br /><br />1. Connecting single words; <br />__(a) <b>in general</b>: Mat.2:18, 16:1, Mrk.2:15, Luk.8:15, Heb.1:1, al. mult.; repeated before each of the terms in a series, Mat.23:23, Luk.14:21, Rom.7:12, 9:4, al.<br /> __(b) <b>connecting numerals </b>(WM, §37, 4): Jhn.2:20, Act.13:20; <br /> __(with) <b>joining terms which are not mutually exclusive, as the part with the whole</b>: Mat.8:33, 26:59, Mrk.16:17, Act.5:29, al. <br /><br />2. <b>Connecting clauses and sentences</b>: Mat.3:12, Act.5:21, al. mult.; esp. <br />__(a) <b>where, after the simplicity of the popular language, sentences are paratactically joined </b>(WM, §60, 3; M, <i>Pr.</i>, 12; Deiss., <i>LAE</i>, 128ff.): Mat.1:21, 7:25, Mrk.9:5, Jhn.10:3, al.; <br /> __(b) <b>joining affirmative to negative sentences</b>: Luk.3:14, Jhn.4:11, IIIJhn.10; <br /> __(with) consecutive, <b>and so</b>: Mat.5:1, 23:32, Heb.3:19, al.; after imperatives, Mat.4:19, Luk.7:7, al.; <br /> __(d) = καίτοι, <b>and yet</b>: Mat.3:14, 6:26, Mrk.12:12, Luk.18:7 (Field, <i>Notes</i>, 72), 1Co.5:2, al.; <br /> __(e) beginning an apodosis (= Heb. וְ; so sometimes δέ in cl.), <b>then</b>: Luk.2:21, 7:12, Act.1:10; beginning a question (WM, §53, 3a): Mrk.10:26, Luk.10:29, Jhn.9:36.<br /><br />3. Epexegetic, <b>and, and indeed, namely</b> (WM, §53, 3c): Luk.3:18, Jhn.1:16, Act.23:6, Rom.1:5, 1Co.3:5, al.<br /><br />4. <b>In transition</b>: Mat.4:23, Mrk.5:1, 21, Jhn.1:19, al.; so, Hebraistically, καὶ ἐγένετο (וַי:הִי; also ἐγένετο δέ), Mrk.1:9 (cf. Luk.5:1; V. Burton, §§357-60; M, <i>Pr.</i>, 14, 16). <br /><br />5. καὶ... καί, <b>both... and</b> (for τε... καί, see: τε); <br />__(a) <b>connecting single words</b>: Mat.10:28, Mrk.4:41, Rom.11:33, al.; <br /> __(b) <b>clauses and sentences</b>: Mrk.9:13, Jhn.7:28, 1Co.1:22, al. <br /><br />II. Adjunctive, <b>also, even, still</b>: Mat.5:39, 40; Mrk.2:28, al. mult.; esp. with pron., adv., etc., Mat.20:4, Jhn.7:47, al; ὡς κ., Act.11:17; καθὼς κ., Rom.15:7; οὑτω κ., Rom.6:11; διὸ κ., Luk.1:35; ὁ κ. (Deiss., <i>BS</i>, 313ff.), Act.13:9; pleonastically, μετὰ κ.. (Bl., §77, 7; Deiss., <i>BS</i>, 265f,), Php.4:3; τί κ., 1 Co 15:29; ἀλλὰ κ., Luk.14:22, Jhn.5:18, al.; καίγε (M, <i>Pr.</i>, 230; Burton, §437), Act.17:27; καίπερ, Heb.5:8; κ. ἐάν, see: ἐάν.<br />",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>ἐάν</b>, contr. fr. εἰ ἄν"
          }
        ]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "foreign-suffix-owner",
        locator: "TBESG:1569@831774",
        expectedLineDigest:
          "7807abf2fd36bf2dd52962e7a04c8d71e0d7e80a977c98be6a0e4bbcc4bb9469",
        exactFragments: ["G1437\tG1437 =", "\tἐάν\t", "<b>ἐάν</b>"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20685",
    expectedSourceRecordDigest:
      "3bcfee6b95f04ca320520b49d99a6ddf7c7b19cd0a18a7490f0d6a1742b009ec",
    rationale:
      "Replace an unrelated mathematical gloss with a concise normalization of the exact STEP adjectival definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "having a higher denominator",
        repairedValue: "renowned, glorious",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>with a great name, giving glory </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21268",
    expectedSourceRecordDigest:
      "055c173ee7dfce945eb0efcdb80dcd03ca47886130a18c940ab6b9a966abd94c",
    rationale:
      "Replace an unsupported zoological gloss with a concise normalization preserving both uses of the exact STEP occupational definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "worm",
        repairedValue: "wood-cutting; woodcutter",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>a wood-cutter, woodman </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G7366",
    expectedSourceRecordDigest:
      "5ff49b33d1d390ea5b362171ee0b0c87cc9f7cefed2551e250299b0770a8da21",
    rationale:
      "Replace an unrelated prepositional gloss with the exact adverbial definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "about",
        repairedValue: "from above, above",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>from above, above </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G7957",
    expectedSourceRecordDigest:
      "ba81c263f9383e7b3600ca717427dd1312fabfa1a9c4c1a95b3711fa580aec27",
    rationale:
      "Classify the -χρύσεος gold adjective as G:A; the exact STEP χρύσεος family witness is explicitly adjectival.",
    changes: [
      {
        field: "morph",
        sourceValue: "N:N",
        repairedValue: "G:A",
        method: "exact-morphological-classification"
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "same-family-adjective",
        locator: "TBESG:5720@3555469",
        expectedLineDigest:
          "29cef9f0e77ece340899eeec08b8aa784cfc0e8cbe869c9ad49f42d5b038e5a9",
        exactFragments: ["\tχρύσεος\t", "\tG:A\t", "\tgolden\t"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G8628",
    expectedSourceRecordDigest:
      "5717f55daf5c9d50069000b5bd9b866a228ebbfddbf0a8bf99feee4ee4b87f87",
    rationale:
      "Classify παρανόμως as G:ADV; the exact adjective-family STEP notice explicitly labels this form as an adverb.",
    changes: [
      {
        field: "morph",
        sourceValue: "G:A",
        repairedValue: "G:ADV",
        method: "exact-morphological-classification"
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "same-family-adverb",
        locator: "TBESG:8407@4192344",
        expectedLineDigest:
          "242f0c1df4e77fa12495d53d18e4ec96979ac2999b729a3e6cec67e9ed820b2b",
        exactFragments: ["<i>adverb</i>, παρανόμως", "<b>illegally </b>"]
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H3356H",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "40bd8ca5c85e81e8a4fbcc02cc14b503cd04b5695ed930a0fcbd70a536a53e7c",
    rationale:
      "Correct the period label contradicted by the same exact notice: David belongs to the United Monarchy.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          'A man living at the time of Divided Monarchy, only mentioned at 1Ch.24.12<br /> § Jakim = "He will raise"<br />1) a Benjamite and descendant of Shimhi<br />2) a Levite priest in charge of the 12th course in the time of David',
        repairedValue:
          'A man living at the time of United Monarchy, only mentioned at 1Ch.24.12<br /> § Jakim = "He will raise"<br />1) a Benjamite and descendant of Shimhi<br />2) a Levite priest in charge of the 12th course in the time of David',
        method: "exact-companion-field-recovery",
        support: [{ field: "meaning", exactFragment: "in the time of David" }]
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H3659",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "55a46bfc431b590b97d965f4658451c2fcbe84ad77d47fe8a28dc1651fd80282",
    rationale:
      "Replace the corrupted replicated TBESH reference string with the pinned TIPNR exact-dStrong short description.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          'A king of the tribe of Judah living at the time of Divided Monarchy, first mentioned at 2Ki.24.6; <br /> son of: Jehoiakim (H3079) and Nehushta (H5179); <br /> father of: Zedekiah (H6667I)(?) and Shealtiel (H7597A); also called Jeconiah at 1Ch.3.16,17; 2x27.20; 28.4; 29.2; Coniah at Jer.22.24,28; 37.1; Shallum at Jer.22.11; Jechoniah (KJV: Jechonias; NIV: Jeconiah) inMat.1.11; 1x<br />Another name of <i>ye.ho.ya.khin</i> (יְהוֹיָכִין "Jehoiachin" H3078) <br /> § Coniah = "Jehovah will establish"<br /> another name for king Jehoiachin of Judah, the next to last king on the throne before the captivity<br />',
        repairedValue:
          "<p>Jehoiachin, also known as Jeconiah, Coniah, or Shallum, was a king of Judah who reigned for three months before being exiled to Babylon.</p>",
        method: "exact-external-witness-recovery"
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TIPNR",
        role: "tipnr-exact-dstrong",
        locator: "TIPNR:109707@4506075",
        expectedLineDigest:
          "45a2ba7fb409bf02cdf9a6a5254e45c43249279276310d440dd07a5a6b390efb",
        exactFragments: ['"dStrong": "H3659"']
      },
      {
        sourceFamily: "TIPNR",
        role: "tipnr-short-description",
        locator: "TIPNR:109636@4502346",
        expectedLineDigest:
          "d287e351de10f40b5ece77e28db41b7a45de54b09b5263a824c4661266b75f41",
        exactFragments: [
          "Jehoiachin, also known as Jeconiah, Coniah, or Shallum",
          "reigned for three months before being exiled to Babylon"
        ]
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9030",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "c8964f53dc3453ad2a80d3082e79b38a24fd04b2cbfaa0c2c4dd33485c0b19f7",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 1st person singular",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 1st person singular",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9031",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "330296224129ac10543d1ae0b75139f6512e35bec1e070928f7958aa9543dca5",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 2nd person masculine singular",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 2nd person masculine singular",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9032",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "ee12d8a4361368782649fedc61b9b8112d414d0964288f4079b18c9ab28768c9",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 2nd person feminine singular",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 2nd person feminine singular",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9033",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "f3f8893ab0a991a0e141e89d33f365bde2b6adbd8f03703978fb8948949f6ba9",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 3rd person masculine singular",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 3rd person masculine singular",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9034",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "b420d6e0a4fd3d05ff6a4059440f27f73bc16ba1ea176b427377b4ea38329f84",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 3rd person feminine singular",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 3rd person feminine singular",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9035",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "5f407ed1912c242a0a9216929da10f6ad6cb237acba36a9ac76313f52dd73d18",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 1st person plural",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 1st person plural",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9036",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "73927b53f54a4775ac3a6c239da440bfee98767094a03753c6354ada0cec7619",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 2nd person masculine plural",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 2nd person masculine plural",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9037",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "d4a3b0f16adc1cca3b021aae3544bd7841532fc9f2baf09d23cc0505e2b6773b",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 2nd person feminine plural",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 2nd person feminine plural",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9038",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "bc72e1f5fa7dbe999f5d9d199101693aa6d96cf960cf1fd30d4a5bc5c4df7127",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 3rd person masculine plural",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 3rd person masculine plural",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H9039",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "d1e460ac0d47629ea1060d60f1af50fe10b79c0489c9788c9408bc1407a413d9",
    rationale:
      "Correct the systematic grammatical typo: object-pronoun suffixes attach to prepositions, not propositions.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "Personal object pronoun - suffix for propositions and verbs without an object: 3rd person feminine plural",
        repairedValue:
          "Personal object pronoun - suffix for prepositions and verbs without an object: 3rd person feminine plural",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "greek:G1227",
    expectedSourceRecordDigest:
      "df5b49569a09a70aec4a282524679c06c3b434b25b484d57526252851e2727f9",
    rationale: "Correct the impossible OCR verb 'took' to 'look'.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          "<b>δια-βλέπω </b><br /><br />1. <b>to took straight before one</b>. <br /><br />2. <b>to see clearly</b>: Mat.7:5, Mrk.8:25, Luk.6:42 (cf. διάβλεψις, Aq., Isa.61:1, for LXX ἀνάβ-).†<br /> (AS)",
        repairedValue:
          "<b>δια-βλέπω </b><br /><br />1. <b>to look straight before one</b>. <br /><br />2. <b>to see clearly</b>: Mat.7:5, Mrk.8:25, Luk.6:42 (cf. διάβλεψις, Aq., Isa.61:1, for LXX ἀνάβ-).†<br /> (AS)",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "greek:G3362",
    expectedSourceRecordDigest:
      "eb5cfb2d3ffbbbe2c4844253dc5f607807203951fdc3456447f3f632d2501ba5",
    rationale: "Remove the mechanically tripled final s in 'unlessss'.",
    changes: [
      {
        field: "meaning",
        sourceValue: "- if not, i.e. unlessss, if not",
        repairedValue: "- if not, i.e. unless, if not",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "greek:G4662",
    expectedSourceRecordDigest:
      "efa7f92be030b1017d709054e123409afc16780e1c3b82f9f92e9a1343742777",
    rationale:
      "Use the grammatically correct past participle supported by the notice.",
    changes: [
      {
        field: "gloss",
        sourceValue: "worm-eated",
        repairedValue: "worm-eaten",
        method: "exact-orthographic-correction",
        support: [{ field: "meaning", exactFragment: "<b>eaten of worms</b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G6482",
    expectedSourceRecordDigest:
      "094712971fad215eccf3a7ccc4d62d01018a755d070bcd5987c0c20f14f22d0e",
    rationale: "Correct the certain OCR spelling 'caurse'.",
    changes: [
      {
        field: "meaning",
        sourceValue: "to caurse one to be far away",
        repairedValue: "to cause one to be far away",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "greek:G7632",
    expectedSourceRecordDigest:
      "abc5292efa406f77f504b4323f26123a8e4c0b1f16b3278c0ea33af2c425e074",
    rationale:
      "Correct two certain transcription errors; the exact gloss corroborates 'reins'.",
    changes: [
      {
        field: "meaning",
        sourceValue: "sandal-thongg, reigns, bridle",
        repairedValue: "sandal-thong, reins, bridle",
        method: "exact-orthographic-correction",
        support: [{ field: "gloss", exactFragment: "reins" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G7647",
    expectedSourceRecordDigest:
      "0f5ed869b196eb350aa8660f67f6bd60fedd7ed9ffeb6a99c09045209c7861b5",
    rationale: "Correct the certain OCR spelling 'portch'.",
    changes: [
      {
        field: "meaning",
        sourceValue: "a portch, doorway",
        repairedValue: "a porch, doorway",
        method: "exact-orthographic-correction",
        support: [{ field: "gloss", exactFragment: "a porch" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G8438",
    expectedSourceRecordDigest:
      "792ed1854f5523e558bfa58d6eeae117c60c567ff079abde58a5f4c2020f1371",
    rationale:
      "Replace the ungrammatical/Latinized headword with the exact English definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "a obolus",
        repairedValue: "an obol",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>an obol </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20003",
    expectedSourceRecordDigest:
      "56cfe3bc41b99a0c48863d51fba0a5df2b8256556dcaa22e2a888a386aecf183",
    rationale: "Remove impossible punctuation and a duplicated OCR fragment.",
    changes: [
      {
        field: "gloss",
        sourceValue: "ill-advised,.",
        repairedValue: "ill-advised",
        method: "exact-mechanical-normalization"
      },
      {
        field: "meaning",
        sourceValue: "ill-advised.advised, inconsiderate.",
        repairedValue: "ill-advised, inconsiderate.",
        method: "exact-mechanical-normalization"
      }
    ]
  }),
  rule({
    entryKey: "greek:G20062",
    expectedSourceRecordDigest:
      "a0dc5a80c2ca1f9c8217bafe7a3d8adcb6b7f40acd6247e1060653be4553067f",
    rationale: "Replace a foreign fragment with the first exact English sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "inerudite et",
        repairedValue: "ill-trained",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>ill-trained </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20145",
    expectedSourceRecordDigest:
      "3f2bd826c74ccc0c8f3e310d12a25251f26c3c3518dc52d740eedf8c57bebe8b",
    rationale:
      "Normalize sentence punctuation accidentally retained in a one-word lexical entry.",
    changes: [
      {
        field: "gloss",
        sourceValue: "brave.",
        repairedValue: "brave",
        method: "exact-mechanical-normalization"
      },
      {
        field: "meaning",
        sourceValue: "brave.",
        repairedValue: "brave",
        method: "exact-mechanical-normalization"
      }
    ]
  }),
  rule({
    entryKey: "greek:G20146",
    expectedSourceRecordDigest:
      "1e318ff866a68d25261c6ce0604a0e2a0348cd78dc8e3a8c0484984979c66d69",
    rationale:
      "Replace an etymological fragment with the first exact English sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "aršan-",
        repairedValue: "male",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "1. <b>male </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20177",
    expectedSourceRecordDigest:
      "22482fce6fce073b209ba2f384920380b861124750177912e411dcd8350a712d",
    rationale:
      "Replace a transliterated source fragment with the exact English definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "bai",
        repairedValue: "palm branch",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>a palm-branch </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20197",
    expectedSourceRecordDigest:
      "b28f2a27a2c27d5caed14be1a3be784f9c26923d9be8c33f187b01364b3c3b3c",
    rationale: "Remove a certain terminal transcription character.",
    changes: [
      {
        field: "meaning",
        sourceValue: "coffint, box, casket",
        repairedValue: "coffin, box, casket",
        method: "exact-orthographic-correction",
        support: [{ field: "gloss", exactFragment: "coffin" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20212",
    expectedSourceRecordDigest:
      "321899941fbf2dcae2959a01445ebabbeff2e619c3dfb5e5583b3c92c204cc23",
    rationale:
      "Remove terminal placeholder dots while preserving the complete lexical phrase.",
    changes: [
      {
        field: "gloss",
        sourceValue: "to enjoy ownership of . .",
        repairedValue: "to enjoy ownership of",
        method: "exact-mechanical-normalization"
      },
      {
        field: "meaning",
        sourceValue: "enjoy ownership of..",
        repairedValue: "to enjoy ownership of",
        method: "exact-companion-field-recovery",
        support: [
          { field: "gloss", exactFragment: "to enjoy ownership of . ." }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20431",
    expectedSourceRecordDigest:
      "1fae7e255330c79d1c2a40cb2ed201eee0f5224e55c95b37687ba45988f010dd",
    rationale:
      "Remove terminal placeholder dots and restore the infinitive marker from the notice.",
    changes: [
      {
        field: "gloss",
        sourceValue: "be said of . .",
        repairedValue: "to be said of",
        method: "exact-companion-field-recovery",
        support: [{ field: "meaning", exactFragment: "to be said of.." }]
      },
      {
        field: "meaning",
        sourceValue: "to be said of..",
        repairedValue: "to be said of",
        method: "exact-mechanical-normalization"
      }
    ]
  }),
  rule({
    entryKey: "greek:G20539",
    expectedSourceRecordDigest:
      "0f18246e983469af64d35adbc1edaac5a32f604deb247b5be920e7ee79c86bb0",
    rationale: "Remove a certain terminal transcription character.",
    changes: [
      {
        field: "meaning",
        sourceValue: "equivalentl in force or power",
        repairedValue: "equivalent in force or power",
        method: "exact-orthographic-correction",
        support: [{ field: "gloss", exactFragment: "equal" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20545",
    expectedSourceRecordDigest:
      "5bab1abc572fd481023b731f4e4f6bc305ba5d0edd964619b5db67e1c9051736",
    rationale:
      "Correct a certain missing-letter typo in a repeated English phrase.",
    changes: [
      {
        field: "gloss",
        sourceValue: "one by one, one after anther",
        repairedValue: "one by one, one after another",
        method: "exact-orthographic-correction",
        support: [{ field: "meaning", exactFragment: "<b>one by one </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20626",
    expectedSourceRecordDigest:
      "8523d48404000935474b8713a589b157a826eab268d60e45d4dd6183b0daff19",
    rationale:
      "Replace an unrelated Latin gloss with the exact English anatomical sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "membrum virile",
        repairedValue: "ham",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "the ham" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20627",
    expectedSourceRecordDigest:
      "d128a30a239d8cad1e144c91b837ed694e41d965dfca834333bfd37029c16264",
    rationale:
      "Replace a Latin source form with the exact English object definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "cōnōpēum",
        repairedValue: "Egyptian couch with mosquito curtains",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>an Egyptian couch with mosquito-curtains; conopium </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20727",
    expectedSourceRecordDigest:
      "28b716dffe623e43c665f0247938c4e04337f5751e70e157ca93c3b6f63d0c1a",
    rationale:
      "Classify both particles in the exact G20727 combination and correct the certain author-name typo; the parallel STEP combination G3378 explicitly supplies G:PRT-N for each component.",
    changes: [
      {
        field: "morph",
        sourceValue: "",
        repairedValue: "G:PRT-N + G:PRT-N",
        method: "exact-morphological-classification"
      },
      {
        field: "meaning",
        sourceValue:
          "1. after Verbs expressing <b>fear </b> or <b>apprehension, = </b> Lat. <i>vereor ut</i>, δέδοικα μὴ οὐ γένηταί τι I fear <b>it will not </b> be; whereas δέδοικα μὴ γένηται mean, I fear it <b>will be. </b> Here, μή and οὐ each retain their proper force. <br />2. with Inf., <br />3. after Verbs of <b>hindering, denying, avoiding, needing </b>, when μὴ οὐ resembles Lat. quin or <b>quominus </b>, οὐδὲν κωλύει μὴ οὐκ ἀληθὲς εἶναι τοῦτο <b>nihil impedit quin hoc verum sit; </b> or with the Art., οὐδὲν ἐλλείψω τὸ μὴ οὐ πυθέσθαι <b>nihil praetermittam quominus reperiam </b>, (Sophocles Tragicus) <br />4. after Verbs signifying <b>impossibility, impropriety, reluctance </b>, μὴ οὐ has a negative translation, δεινὸν ἐδόκεε εἶναι μὴ οὐ λαβεῖν (Herdotus Historicus); αἰσχύνη ἦν μὴ οὐ δυσπουδάζειν (Xenophon Historicus) <br />5. μὴ οὐ with the Partic., only after a <i>negative</i>, expressed or implied, δυσάλγητος γὰρ ἂν εἤν μὴ οὐ κατοικτείρων I should be hard-hearted <b>if </b> I did <b>not </b> pity, (Sophocles Tragicus) <br />6. = εἰ μή, <b>except </b> πόλεις χαλεπαὶ λαβεῖν, μὴ οὐ πολιορκία (Demosthenes Orator) (ML)",
        repairedValue:
          "1. after Verbs expressing <b>fear </b> or <b>apprehension, = </b> Lat. <i>vereor ut</i>, δέδοικα μὴ οὐ γένηταί τι I fear <b>it will not </b> be; whereas δέδοικα μὴ γένηται mean, I fear it <b>will be. </b> Here, μή and οὐ each retain their proper force. <br />2. with Inf., <br />3. after Verbs of <b>hindering, denying, avoiding, needing </b>, when μὴ οὐ resembles Lat. quin or <b>quominus </b>, οὐδὲν κωλύει μὴ οὐκ ἀληθὲς εἶναι τοῦτο <b>nihil impedit quin hoc verum sit; </b> or with the Art., οὐδὲν ἐλλείψω τὸ μὴ οὐ πυθέσθαι <b>nihil praetermittam quominus reperiam </b>, (Sophocles Tragicus) <br />4. after Verbs signifying <b>impossibility, impropriety, reluctance </b>, μὴ οὐ has a negative translation, δεινὸν ἐδόκεε εἶναι μὴ οὐ λαβεῖν (Herodotus Historicus); αἰσχύνη ἦν μὴ οὐ δυσπουδάζειν (Xenophon Historicus) <br />5. μὴ οὐ with the Partic., only after a <i>negative</i>, expressed or implied, δυσάλγητος γὰρ ἂν εἤν μὴ οὐ κατοικτείρων I should be hard-hearted <b>if </b> I did <b>not </b> pity, (Sophocles Tragicus) <br />6. = εἰ μή, <b>except </b> πόλεις χαλεπαὶ λαβεῖν, μὴ οὐ πολιορκία (Demosthenes Orator) (ML)",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "greek:G20786",
    expectedSourceRecordDigest:
      "8c9270a631b4933b13f6dd0396ca5f56328b8170ca17ae5b43955985d9662f0c",
    rationale:
      "Replace a Latin editorial fragment with the first exact English sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "scribere",
        repairedValue: "mystic",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>mystic, connected with the mysteries </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20798",
    expectedSourceRecordDigest:
      "0ea2ff3f90a79fd9f4f486ecd5a912114ff923a1c9ce5e2b14345570313ce8c2",
    rationale: "Remove a certain duplicated terminal consonant.",
    changes: [
      {
        field: "gloss",
        sourceValue: "to quarrell",
        repairedValue: "to quarrel",
        method: "exact-orthographic-correction",
        support: [{ field: "meaning", exactFragment: "<b>to quarrel </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20825",
    expectedSourceRecordDigest:
      "7744288193ae9ed7b9c22bf59eb066b4d802cd77609d79b6fe3f49f008d7e375",
    rationale:
      "Replace a corrupt etymological/source fragment with the first exact English sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "olg[uglide]ā",
        repairedValue: "happiness",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>happiness, bliss, weal, wealth </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20867",
    expectedSourceRecordDigest:
      "d1b30235ff0a1325f619e7f78e8d8cde9972d2f8d6e66a3f09783e5f7b4454a1",
    rationale:
      "Replace a subject/source marker with the exact English measure name.",
    changes: [
      {
        field: "gloss",
        sourceValue: "*Geom.",
        repairedValue: "palm",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>a palm, four fingers' breadth </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20964",
    expectedSourceRecordDigest:
      "15f26a30ec56fdaec83472d6bd688b114bcaa06db1cf402949893ef32dba235b",
    rationale:
      "Replace an unrelated source fragment with the exact English verbal sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "renaid",
        repairedValue: "to sell",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>to export for sale, to sell </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21127",
    expectedSourceRecordDigest:
      "7a69b44bde4ad7859509fff3647750caa89f86e73f942e82d7dd9a94b0aa0cb6",
    rationale: "Complete a truncated gloss from the exact English definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "be a",
        repairedValue: "to wear a wreath",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>to wear a wreath </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21137",
    expectedSourceRecordDigest:
      "a53b9880533e9b63f6faededc0609ed32bd97d1b3391ee55235033c7503b9965",
    rationale:
      "Normalize sentence punctuation accidentally retained in a one-word lexical entry.",
    changes: [
      {
        field: "gloss",
        sourceValue: "strew.",
        repairedValue: "strew",
        method: "exact-mechanical-normalization"
      },
      {
        field: "meaning",
        sourceValue: "strew.",
        repairedValue: "strew",
        method: "exact-mechanical-normalization"
      }
    ]
  }),
  rule({
    entryKey: "greek:G21140",
    expectedSourceRecordDigest:
      "bb1e10bd58b2dd6dd943691f0df269b5c0c8d1d1e4cca6f2cf45e1e776181676",
    rationale:
      "Replace an unrelated source fragment with both explicit English senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "agino",
        repairedValue: "to squeeze oneself up; to loiter",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>to squeeze oneself up, twist oneself </b>"
          },
          { field: "meaning", exactFragment: "<b>to keep loitering about </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21142",
    expectedSourceRecordDigest:
      "61c930924cd5d23dac01d7b81d0ae553e606434bf9d73752c9d65196e277879f",
    rationale: "Complete a truncated gloss from the exact first definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "province governed by a",
        repairedValue: "office of a general",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>post of general, command </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21165",
    expectedSourceRecordDigest:
      "a9795375009dc9de702f0822bf49a0469de0c6a5409bea7191fbc68c79201926",
    rationale: "Normalize terminal sentence punctuation in a lexical gloss.",
    changes: [
      {
        field: "gloss",
        sourceValue: "to rest under the same roof.",
        repairedValue: "to rest under the same roof",
        method: "exact-mechanical-normalization",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>to rest under the same roof </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21219",
    expectedSourceRecordDigest:
      "04090ba9939d85d57ac8009bd9160436ebe4fded4b6180ce8f1c71b1a6f52bc7",
    rationale: "Replace a foreign etymon with the exact English animal name.",
    changes: [
      {
        field: "gloss",
        sourceValue: "tukkîyîm",
        repairedValue: "peacock",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>a peacock </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21230",
    expectedSourceRecordDigest:
      "d98b5ca49d0910c05e930f6834eb87f4c808cb4a1dc62a486c370b50449e1b33",
    rationale:
      "Complete the truncated phrase with the pinned same-family noun and verb witnesses.",
    changes: [
      {
        field: "meaning",
        sourceValue: "fry in a",
        repairedValue: "to fry in a pan",
        method: "exact-same-family-companion-recovery",
        support: [{ field: "gloss", exactFragment: "to fry" }]
      }
    ],
    externalWitnesses: [
      {
        sourceFamily: "TBESG",
        role: "same-family-noun",
        locator: "TBESG:9223@4421604",
        expectedLineDigest:
          "283424e0e73a8e3cbee6b98710b4043bdec26e6cd0a3edf0010f5f21eb0f4365",
        exactFragments: ["G9444", "τήγανον", "a frying pan"]
      },
      {
        sourceFamily: "TBESG",
        role: "same-family-verb",
        locator: "TBESG:6285@3737492",
        expectedLineDigest:
          "c1b0823b80cbe20b7b04f690bc0d5bcfaf5634fe6c19126134402e0203092bae",
        exactFragments: ["G6501", "ἀποτηγανίζω", "to fry"]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21239",
    expectedSourceRecordDigest:
      "6e6db711bfb66f8bc0939cc5264c0afb03f333fed6d5e08dc1dc5318865fe7e2",
    rationale:
      "Replace an unrelated Latin source word with the exact English art name.",
    changes: [
      {
        field: "gloss",
        sourceValue: "venenum",
        repairedValue: "archery",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>archery </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21355",
    expectedSourceRecordDigest:
      "0a5c76b2c1d63ed9bda3041c0d862e81767b0a4285350ecb7e4529f48d274f2c",
    rationale: "Replace a Latin gloss with the first exact English sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "sabulum.",
        repairedValue: "sand",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>sand </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21363",
    expectedSourceRecordDigest:
      "d808f79350a4b4e9fc4b9f33ee930e97403a417a1b05c5133f7f91ddfa4b85f8",
    rationale:
      "Replace a Latin editorial phrase with the exact English lexical sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "animi oblectamenta procurentur",
        repairedValue: "persuasion",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>a winning of souls, persuasion </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20079",
    expectedSourceRecordDigest:
      "1d33a2a805354e8eb477b2ef19a795ad0a7e416a1be9960b807e15265da10bf3",
    rationale:
      "Replace an unrelated gloss with the complete exact adjectival definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "plaster",
        repairedValue: "unconquered, unconquerable",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>unconquered, unconquerable </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20100",
    expectedSourceRecordDigest:
      "dff32b9f7537dc8a457679b8627212db2ed2270dd2ab63e9fc55aace854404a7",
    rationale:
      "Replace the contradictory finite verb with the exact privative adjectival sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "err",
        repairedValue: "unerring",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>that cannot go astray </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20158",
    expectedSourceRecordDigest:
      "d158fba1e9acf38394d601e6a278b17f31994798224027663b6ad1cd4eaeb816",
    rationale:
      "Replace the false positive-value gloss with all three exact privative senses in the notice.",
    changes: [
      {
        field: "gloss",
        sourceValue: "invaluable",
        repairedValue: "unhonoured, despised; unvalued, unassessed",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>unhonoured, despised </b>"
          },
          { field: "meaning", exactFragment: "<b>not valued </b>" },
          {
            field: "meaning",
            exactFragment: "the penalty is not assessed in court"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20169",
    expectedSourceRecordDigest:
      "b9794d0e4b1af36c7921513b502485ae385a4e235ff1d11df151976330defa48",
    rationale:
      "Replace the unrelated verbal-action gloss with the exact nominal definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "guiding, leading",
        repairedValue: "tale, narrative",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>a tale, narrative </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20200",
    expectedSourceRecordDigest:
      "2bd0409c7312bb7b2c4906d8c01352c2259d4f4d6d0ac764d64b7d28a3856662",
    rationale:
      "Recover the complete exact noun senses and replace malformed source markup with a semantically identical, valid notice.",
    changes: [
      {
        field: "gloss",
        sourceValue: "for",
        repairedValue:
          "weeping, wailing, groaning, howling; mourning, lamentation",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>weeping, wailing, groaning, howling, mourning, lamentation </b>"
          }
        ]
      },
      {
        field: "meaning",
        sourceValue:
          '<b>weeping, wailing, groaning, howling, mourning, lamentation </b>, [<a href="javascript:void(0)" title="Homer">8th/7th c.BC</a>, <date><i>variant</i> dates<author>Tragica Adespota</author></date> (ML)',
        repairedValue:
          "<b>weeping, wailing, groaning, howling, mourning, lamentation</b>, attested in Homer (8th/7th c. BC) and <i>Tragica Adespota</i> (variant dates) (ML)",
        method: "exact-mechanical-normalization",
        support: [
          {
            field: "meaning",
            exactFragment: '<a href="javascript:void(0)" title="Homer">'
          },
          {
            field: "meaning",
            exactFragment:
              "<date><i>variant</i> dates<author>Tragica Adespota</author></date>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20295",
    expectedSourceRecordDigest:
      "f5f33ff16ce48509a3a4d571ecff5804efac82db100aac91418a549c1766fa59",
    rationale:
      "Replace a mismatched finite clause with the exact adjectival and substantival senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "has broken in upon",
        repairedValue: "cast out; outcast",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>cast out of </b>" },
          { field: "meaning", exactFragment: "<b>an outcast </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20440",
    expectedSourceRecordDigest:
      "cdfdc3ec3a9cd4f630f52b1887eced117144726186f4f697cfa96c3ecf102307",
    rationale:
      "Replace an unrelated ethical phrase with the exact adverbial senses and normalize the French loan spelling.",
    changes: [
      {
        field: "gloss",
        sourceValue: "respect of persons",
        repairedValue: "confusedly, promiscuously; pell-mell",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>confusedly, promiscuously, pele-mele </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20523",
    expectedSourceRecordDigest:
      "9d5eec8f4bd98c1c49b5af853de0a6e8452973e2c73aaa21d09b8a73d29a5a2e",
    rationale:
      "Replace the unrelated relational gloss with the complete exact nominal definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "relationship",
        repairedValue: "peculiar nature, property",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>peculiar nature, property </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20805",
    expectedSourceRecordDigest:
      "1154f1c51609a819b0ab99770b5c4cc064c136766778acdea5e1f20b9f7cb137",
    rationale:
      "Replace an unrelated cosmological noun with the exact adjectival definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "world",
        repairedValue: "intellectual",
        method: "exact-definition-extraction",
        support: [{ field: "meaning", exactFragment: "<b>intellectual </b>" }]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20936",
    expectedSourceRecordDigest:
      "8d135c95c3f7a3162d536f5c6e90916a2abee040201deed3eb9bb644982eac05",
    rationale:
      "Replace a verbal phrase with the exact positive and negative adjectival senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "utter frantic cries",
        repairedValue: "famous; notorious, scandalous",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>noised abroad, much talked of, famous </b>"
          },
          {
            field: "meaning",
            exactFragment: "<b>notorious, scandalous </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G20990",
    expectedSourceRecordDigest:
      "2421cf7719d272a6fdcc6506443954e02bdbaac331974bad3df6c4375b1ee4c9",
    rationale:
      "Replace an over-broad abstract noun with the exact concrete definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "condition",
        repairedValue: "knavish trick",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>a knavish trick </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21014",
    expectedSourceRecordDigest:
      "8a81cc34f87bd00f9eaa5be0901a2310c356ac4976ad7fea6b397ab92747098f",
    rationale:
      "Replace an unrelated food noun with the exact martial and protective senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "cake",
        repairedValue: "foremost fighter, champion; defender",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>the foremost fighters, champions </b>"
          },
          { field: "meaning", exactFragment: "<b>fighting for </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21111",
    expectedSourceRecordDigest:
      "bc8c713326910411cee844625c9c28f8630094a2856755cb0da92c5aa4c574fd",
    rationale:
      "Replace unrelated abstract nouns with the exact concrete definition.",
    changes: [
      {
        field: "gloss",
        sourceValue: "evil, ruin",
        repairedValue: "pointed stake",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>a pointed stake </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21115",
    expectedSourceRecordDigest:
      "6b12ba5dc2e3fe65d033be86a6abbaa1efe63f16f822f77f81f84bc6e94e2a71",
    rationale:
      "Replace an unrelated object noun with the complete exact ethical and lifestyle senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "bracelet",
        repairedValue: "lewdness, wantonness; riot, luxury",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>lewdness, wantonness, riot, luxury </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21188",
    expectedSourceRecordDigest:
      "e2f98da5a311d37fb5c2dd52f88c27664b715820914202d5703ca021f713846a",
    rationale:
      "Replace the unrelated participial gloss with the two principal exact verbal senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "arranged",
        repairedValue: "to agree with; to advocate, help",
        method: "exact-definition-extraction",
        support: [
          { field: "meaning", exactFragment: "<b>to agree with </b>" },
          { field: "meaning", exactFragment: "<b>to advocate </b>" },
          { field: "meaning", exactFragment: "<b>to help, further </b>" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21222",
    expectedSourceRecordDigest:
      "0f7218f6c253b1ced7872c13f6514ed0eec3f1957deaff9dad22e9162a93e343",
    rationale:
      "Replace an unrelated personal noun with the exact telic adjectival senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "sorceress",
        repairedValue: "bringing to completion; accomplishing",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>bringing to an end </b>"
          },
          {
            field: "meaning",
            exactFragment: "<b>accomplishing one's purpose </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21315",
    expectedSourceRecordDigest:
      "dd270c7b02fbaafb37cce00a8ab9f6f8cabea44ec5d488b6b60bc985f064278e",
    rationale:
      "Replace an unrelated plural noun with the exact personal adjective senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "souls",
        repairedValue: "loving one's life; cowardly, faint-hearted",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment:
              "<b>loving one's life, cowardly, dastardly, faint-hearted </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21328",
    expectedSourceRecordDigest:
      "8724c11a24bffc1294740735f15dee239dfe428f06a41796913376d5f7f82873",
    rationale:
      "Replace the unrelated productive adjective with the exact nature-versus-art sense.",
    changes: [
      {
        field: "gloss",
        sourceValue: "fruitful",
        repairedValue: "natural, not artificial",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>shaped by nature, without art </b>"
          }
        ]
      }
    ]
  }),
  rule({
    entryKey: "greek:G21343",
    expectedSourceRecordDigest:
      "3cc2d42cd7f9754f8840d3df78fbde00806ae829b7890efae182c6207ddc53c7",
    rationale:
      "Replace a general gathering sense with both exact metallurgical senses.",
    changes: [
      {
        field: "gloss",
        sourceValue: "to bring together",
        repairedValue: "to cast in a mould; to cast metal",
        method: "exact-definition-extraction",
        support: [
          {
            field: "meaning",
            exactFragment: "<b>to cast into a mould </b>"
          },
          { field: "meaning", exactFragment: "<b>to cast </b> metal" }
        ]
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H5414H",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "7339dc02869a1198139bf1d58982936891c91fed2448af88ba68776aee244030",
    rationale:
      "Remove a mechanically tripled p while preserving the exact sub-STEP notice.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          ": put/set/apppoint<br />1) to give, put, set<br />1a) (Qal)<br />1a1) to give, bestow, grant, permit, ascribe, employ, devote, consecrate, dedicate, pay wages, sell, exchange, lend, commit, entrust, give over, deliver up, yield produce, occasion, produce, requite to, report, mention, utter, stretch out, extend<br />1a2) to put, set, put on, put upon, set, appoint, assign, designate<br />1a3) to make, constitute<br />1b) (Niphal)<br />1b1) to be given, be bestowed, be provided, be entrusted to, be granted to, be permitted, be issued, be published, be uttered, be assigned<br />1b2) to be set, be put, be made, be inflicted<br />1c) (Hophal)<br />1c1) to be given, be bestowed, be given up, be delivered up<br />1c2) to be put upon",
        repairedValue:
          ": put/set/appoint<br />1) to give, put, set<br />1a) (Qal)<br />1a1) to give, bestow, grant, permit, ascribe, employ, devote, consecrate, dedicate, pay wages, sell, exchange, lend, commit, entrust, give over, deliver up, yield produce, occasion, produce, requite to, report, mention, utter, stretch out, extend<br />1a2) to put, set, put on, put upon, set, appoint, assign, designate<br />1a3) to make, constitute<br />1b) (Niphal)<br />1b1) to be given, be bestowed, be provided, be entrusted to, be granted to, be permitted, be issued, be published, be uttered, be assigned<br />1b2) to be set, be put, be made, be inflicted<br />1c) (Hophal)<br />1c1) to be given, be bestowed, be given up, be delivered up<br />1c2) to be put upon",
        method: "exact-orthographic-correction"
      }
    ]
  }),
  rule({
    entryKey: "hebrew:H5415H",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "d1a2e79df4ff56fc07ee189bf83725ca10da967663b43cb7fb9412c1c13610fa",
    rationale:
      "Remove a mechanically tripled p while preserving the exact Aramaic sub-STEP notice.",
    changes: [
      {
        field: "meaning",
        sourceValue:
          ": put/set/apppoint<br />1) to give<br />1a) (P'al)<br />1a1) to give<br />1a2) to give, allow<br />1a3) to give, pay",
        repairedValue:
          ": put/set/appoint<br />1) to give<br />1a) (P'al)<br />1a1) to give<br />1a2) to give, allow<br />1a3) to give, pay",
        method: "exact-orthographic-correction"
      }
    ]
  })
];

const ADJUDICATED_LEGACY_SEMANTIC_GLOSS_RULES: readonly EnglishExactRepairRule[] =
  [
    rule({
      entryKey: "greek:G20045",
      expectedSourceRecordDigest:
        "ed164bbe1d2191728703aa635f7e28f9819546072e75f640c10a59d815b30510",
      rationale:
        "Replace the unsupported projecting gloss with the exact verbal definition.",
      changes: [
        {
          field: "gloss",
          sourceValue: "to jut out",
          repairedValue: "to mutilate; cut off extremities",
          method: "exact-definition-extraction",
          support: [
            {
              field: "meaning",
              exactFragment: "<b>to cut off the extremities, mutilate </b>"
            }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20063",
      expectedSourceRecordDigest:
        "1d0d4ffd28c5d6c32ed95cb152b2d35513f80b0c901a55e649f75ace2817ee65",
      rationale:
        "Replace the opposite-direction gloss with the exact withdrawal definition.",
      changes: [
        {
          field: "gloss",
          sourceValue: "emergence",
          repairedValue: "retreat, withdrawal",
          method: "exact-definition-extraction",
          support: [
            {
              field: "meaning",
              exactFragment: "<b>a drawing back, retreat </b>"
            }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20166",
      expectedSourceRecordDigest:
        "b95db0531f24d515bfa40f96630278d261dfbb198fe43d7ee20ad91260893e1b",
      rationale:
        "Replace the unsupported nature gloss with the exact improvisational sense.",
      changes: [
        {
          field: "gloss",
          sourceValue: "wild, natural",
          repairedValue: "improvised, off-hand",
          method: "exact-definition-extraction",
          support: [{ field: "meaning", exactFragment: "<b>off-hand </b>" }]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20202",
      expectedSourceRecordDigest:
        "b0aaeeeec07a464af39c411f09a51a76a54ed89cea736e09468b5d57205a0e80",
      rationale:
        "Replace the unsupported torture-device gloss with the exact object definition.",
      changes: [
        {
          field: "gloss",
          sourceValue: "thumb-screw",
          repairedValue: "finger-sheath",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a finger-sheath </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20567",
      expectedSourceRecordDigest:
        "36f1cc032201e690d1c39551857887aae1c841794801f97e1b33ebd02501af4d",
      rationale:
        "Replace the unsupported architectural gloss with the exact incursion sense.",
      changes: [
        {
          field: "gloss",
          sourceValue: "cryptoporticus",
          repairedValue: "raid, inroad",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>an inroad, raid </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20595",
      expectedSourceRecordDigest:
        "46876f1ee8abb1bde8a6dbb181cbb533ea3dd741fabc1b1673aff27fb3767b97",
      rationale:
        "Replace the unsupported kiln gloss with the exact cautery instrument.",
      changes: [
        {
          field: "gloss",
          sourceValue: "kiln",
          repairedValue: "branding iron",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a branding iron </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20617",
      expectedSourceRecordDigest:
        "04b5a2e635b07f5bb3c0de508016793157aec95d04cb1bafbd99641ca9aab7c0",
      rationale:
        "Normalize the adjective to the hidden/concealed sense established by its exact local cognates.",
      changes: [
        {
          field: "gloss",
          sourceValue: "lurking-place",
          repairedValue: "hidden, concealed",
          method: "exact-same-family-companion-recovery",
          support: [
            {
              field: "meaning",
              exactFragment: "to throw <b>a cloud </b> over"
            }
          ]
        }
      ],
      externalWitnesses: [
        {
          sourceFamily: "TBESG",
          role: "same-family-adjective",
          locator: "TBESG:3122@1925203",
          expectedLineDigest:
            "026a1d07ff5ff8b8b53c697fb80b6843cdd8561db7234647d546339efcb0d7bc",
          exactFragments: ["\tκρυπτός\t", "<b>hidden, secret</b>"]
        },
        {
          sourceFamily: "TBESG",
          role: "same-family-verb",
          locator: "TBESG:3123@1926252",
          expectedLineDigest:
            "21856822ffb3c1a6b4488c81da87c4a711ac470d2cf79a8a29064921b4507ead",
          exactFragments: ["\tκρύπτω\t", "<b>to hide, conceal</b>"]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20655",
      expectedSourceRecordDigest:
        "6ff1938ce8b7323a7b890e7d4c30fb0e70f37bdde184d9d8e2ee256b9b158d17",
      rationale:
        "Replace the unsupported material gloss with the exact food definition.",
      changes: [
        {
          field: "gloss",
          sourceValue: "amalgam",
          repairedValue: "barley cake",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a barley-cake </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G20911",
      expectedSourceRecordDigest:
        "ed1b0e462265cb222a9658c0664fa1fc8d7cf5e684cc11386020a5e653f6558c",
      rationale:
        "Replace the unsupported formal-inclusion gloss with the exact entry verb.",
      changes: [
        {
          field: "gloss",
          sourceValue: "be included in one form",
          repairedValue: "to creep in",
          method: "exact-definition-extraction",
          support: [
            {
              field: "meaning",
              exactFragment: "<b>to fall in by the way, creep </b>"
            }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G21091",
      expectedSourceRecordDigest:
        "59eca1157c31597484aaa43d1e2ff690d2cd10e5d0f040ea1b70ff133c6a30f0",
      rationale:
        "Replace the unsupported weight homonym with the two principal enclosure senses.",
      changes: [
        {
          field: "gloss",
          sourceValue: "weight",
          repairedValue: "pen, fold; shrine",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a pen, fold </b>" },
            {
              field: "meaning",
              exactFragment: "<b>a sacred enclosure, chapel, shrine </b>"
            }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G21136",
      expectedSourceRecordDigest:
        "7f1410ef39acc941973581a885b1211d038dd420291f6350648cf050f6db1f3f",
      rationale:
        "Replace the unsupported metallurgical gloss with the exact opening sense.",
      changes: [
        {
          field: "gloss",
          sourceValue: "a scale which flies from hammered iron",
          repairedValue: "mouth, entrance",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a mouth, entrance </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G21211",
      expectedSourceRecordDigest:
        "cb52d1ed997d274ba7c79660e766b4643eb35c86df51fe9575adf18720ecdd0c",
      rationale:
        "Replace the unsupported mathematical gloss with the exact manner definition.",
      changes: [
        {
          field: "gloss",
          sourceValue: "in arithmetical progression",
          repairedValue: "in heaps",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>by heaps, in heaps </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G21228",
      expectedSourceRecordDigest:
        "bc8b466ae78cba86bf974daba27e04d940d21cb142f7c656d1a9d03a524f3c8f",
      rationale:
        "Replace the unsupported building-material gloss with the exact implement and vessel senses.",
      changes: [
        {
          field: "gloss",
          sourceValue: "masonry, fabric",
          repairedValue: "implement, vessel",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>a tool, implement </b>" },
            { field: "meaning", exactFragment: "<b>a vessel </b>" }
          ]
        }
      ]
    }),
    rule({
      entryKey: "greek:G21307",
      expectedSourceRecordDigest:
        "0ccac8c365fd98581302131262d2979e4be698db6fcaa9a73ac35920e5d83e20",
      rationale:
        "Replace the unsupported legal-result gloss with the exact humane-treatment verb.",
      changes: [
        {
          field: "gloss",
          sourceValue: "to obtain redress",
          repairedValue: "to treat humanely",
          method: "exact-definition-extraction",
          support: [
            { field: "meaning", exactFragment: "<b>to treat humanely </b>" }
          ]
        }
      ]
    })
  ];

const ADJUDICATED_SUPPLEMENTAL_GLOSSES = Object.freeze({
  "greek:G20281": "to arrange in a place",
  "greek:G20353": "as far as possible",
  "greek:G20435": "to annoy, offend",
  "greek:G20574": "to cover with mail",
  "greek:G20747": "memorable, worth remembering",
  "greek:G20806": "to adulterate",
  "greek:G20819": "household, menial",
  "greek:G20993": "buckle, brooch",
  "greek:G21019": "to do beforehand",
  "greek:G21157": "to found or colonize jointly",
  "greek:G21180": "to agree; consider together",
  "greek:G21202": "system, composite whole",
  "greek:G21242": "to wage war from strong positions"
} as const);

const ADJUDICATED_SUPPLEMENTAL_GLOSS_RULES: readonly EnglishExactRepairRule[] =
  Object.entries(ADJUDICATED_SUPPLEMENTAL_GLOSSES).map(
    ([entryKey, repairedValue]) => {
      const entry = ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries.find(
        (candidate) => candidate.entryKey === entryKey
      );
      if (!entry) {
        throw new Error(
          `english-adjudicated-supplemental-gloss-missing:${entryKey}`
        );
      }
      return rule({
        entryKey,
        expectedSourceRecordDigest: entry.sourceRecordDigest,
        supplementalAuditCatalogDigest:
          ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
        rationale:
          "Replace the unsupported compact gloss with the adjudicated sense explicitly present in the exact source meaning.",
        changes: [
          {
            field: "gloss",
            sourceValue: entry.rawGloss,
            repairedValue,
            method: "exact-definition-extraction",
            support: [{ field: "meaning", exactFragment: entry.rawMeaning }]
          }
        ]
      });
    }
  );

const PINNED_EXTERNAL_LEXICON_RULES: readonly EnglishExactRepairRule[] = [
  rule({
    entryKey: "greek:G20354",
    expectedSourceRecordDigest:
      "16b845db6adc8df570927203e53de94422b7f6db2c82e98459d1dd5188f33b6e",
    supplementalAuditCatalogDigest:
      ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
    rationale:
      "Recover the active and passive senses from the checked-in, content-addressed LSJ entry n35193; the legacy target gloss is not used as proof.",
    changes: [
      {
        field: "gloss",
        sourceValue: "to sodomize",
        repairedValue: "to alter; passive participle: a sodomite",
        method: "exact-pinned-external-lexicon-recovery"
      },
      {
        field: "meaning",
        sourceValue: "sodomite",
        repairedValue:
          "<b>to alter</b> in the active voice (Aristotle, <i>Physiognomonica</i> 806a13); in the passive participle, substantivally, <b>a sodomite</b> (LXX 3 Kings 22:47; Aquila, Genesis 38:21).",
        method: "exact-pinned-external-lexicon-recovery"
      }
    ],
    externalArtifact: {
      sourceFamily: "PERSEUS_LSJ",
      artifactPath: PINNED_G20354_PERSEUS_ARTIFACT_PATH,
      artifactDigest: PINNED_G20354_PERSEUS_ARTIFACT_DIGEST,
      artifactFileDigest: PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST,
      payloadDigest: PINNED_G20354_PERSEUS_PAYLOAD_DIGEST,
      sourceFileDigest: PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST,
      sourceFragmentDigest: PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST
    }
  })
];

const SUPPLEMENTAL_RULES: readonly EnglishExactRepairRule[] =
  ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG.entries
    .filter(
      (entry) =>
        entry.classification === "EXACT_REPAIR" ||
        (entry.classification === "VALID_POLYSENSE" &&
          entry.proposedMorph !== entry.identity.morph)
    )
    .map((entry) => {
      const proposedMorph = entry.proposedMorph;
      const proposedGloss = entry.proposedGloss;
      const proposedMeaning = entry.proposedMeaning;
      if (
        proposedMorph === null ||
        proposedGloss === null ||
        proposedMeaning === null
      ) {
        throw new Error(
          `english-supplemental-exact-repair-missing-output:${entry.entryKey}`
        );
      }
      const targetFragments = entry.witnesses
        .filter((item) => item.role === "target-source-row")
        .flatMap((item) => item.exactFragments);
      const changes: ChangeInput[] = [];
      if (entry.identity.morph !== proposedMorph) {
        changes.push({
          field: "morph",
          sourceValue: entry.identity.morph,
          repairedValue: proposedMorph,
          method: "exact-morphological-classification"
        });
      }
      if (entry.rawGloss !== proposedGloss) {
        const meaningSupport = targetFragments
          .filter((fragment) => entry.rawMeaning.includes(fragment))
          .map((exactFragment) => ({
            field: "meaning" as const,
            exactFragment
          }));
        changes.push({
          field: "gloss",
          sourceValue: entry.rawGloss,
          repairedValue: proposedGloss,
          method:
            entry.repairMethod === "exact-orthographic-normalization"
              ? "exact-orthographic-correction"
              : "exact-definition-extraction",
          support:
            meaningSupport.length > 0
              ? meaningSupport
              : [{ field: "meaning", exactFragment: entry.rawMeaning }]
        });
      }
      if (entry.rawMeaning !== proposedMeaning) {
        changes.push({
          field: "meaning",
          sourceValue: entry.rawMeaning,
          repairedValue: proposedMeaning,
          method:
            entry.repairMethod === "exact-orthographic-normalization"
              ? "exact-orthographic-correction"
              : "exact-definition-extraction",
          support: [{ field: "meaning", exactFragment: entry.rawMeaning }]
        });
      }
      if (changes.length === 0) {
        throw new Error(
          `english-supplemental-exact-repair-empty:${entry.entryKey}`
        );
      }
      return rule({
        entryKey: entry.entryKey,
        expectedSourceRecordDigest: entry.sourceRecordDigest,
        supplementalAuditCatalogDigest:
          ENGLISH_SUPPLEMENTAL_GLOSS_AUDIT_CATALOG_DIGEST,
        rationale: `${entry.rationale}\nEvidence bridge: ${entry.semanticBridge}`,
        changes
      });
    });

const RULES: readonly EnglishExactRepairRule[] = [
  ...BASE_RULES,
  ...ADJUDICATED_LEGACY_SEMANTIC_GLOSS_RULES,
  ...ADJUDICATED_SUPPLEMENTAL_GLOSS_RULES,
  ...PINNED_EXTERNAL_LEXICON_RULES,
  ...SUPPLEMENTAL_RULES
];

export const ENGLISH_EXACT_REPAIR_RULES: ReadonlyMap<
  string,
  EnglishExactRepairRule
> = new Map(RULES.map((item) => [item.entryKey, item]));

export const EXPECTED_ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST =
  "eed63011b7bd291270bc2f22a080b9e8d5224f3d8455ae9889d68c1837396923" as const;
export const ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST = sha256(stableJson(RULES));
if (
  ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST !==
  EXPECTED_ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST
) {
  throw new Error(
    `english-exact-repair-registry-drift:${ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST}:${EXPECTED_ENGLISH_EXACT_REPAIR_REGISTRY_DIGEST}`
  );
}

export function englishExactRepairEntryKey(
  entry: Pick<EnglishExactRepairEntry, "language" | "dStrong">
): string {
  const code = /^\s*([GH]\d+[A-Za-z]*)/u.exec(entry.dStrong)?.[1];
  if (!code)
    throw new Error(`english-exact-repair-invalid-dstrong:${entry.dStrong}`);
  return `${entry.language}:${code}`;
}

export function digestEnglishExactRepairSourceRecord(
  entry: EnglishExactRepairEntry
): string {
  return sha256(
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

export function digestEnglishExactRepairRule(
  value: EnglishExactRepairRule
): string {
  return sha256(stableJson(value));
}

export function applyEnglishExactRepairs(
  entry: EnglishExactRepairEntry,
  context: EnglishExactRepairContext
): EnglishExactRepairResult | null {
  const entryKey = englishExactRepairEntryKey(entry);
  const repairRule = ENGLISH_EXACT_REPAIR_RULES.get(entryKey);
  if (!repairRule) return null;
  if (context.databaseDigest !== PINNED_ENGLISH_EXACT_REPAIR_SOURCES.database) {
    throw new Error(`english-exact-repair-database-drift:${entryKey}`);
  }
  if (
    context.sourceDigests[repairRule.sourceFamily] !==
    PINNED_ENGLISH_EXACT_REPAIR_SOURCES[repairRule.sourceFamily]
  ) {
    throw new Error(`english-exact-repair-source-drift:${entryKey}`);
  }
  for (const witness of repairRule.externalWitnesses ?? []) {
    const locator = /^(TBESG|TBESH|TIPNR):(\d+)@(\d+)$/u.exec(witness.locator);
    if (
      !locator ||
      locator[1] !== witness.sourceFamily ||
      !/^[a-f0-9]{64}$/u.test(witness.expectedLineDigest) ||
      witness.exactFragments.length === 0 ||
      witness.exactFragments.some((fragment) => fragment.trim().length === 0)
    ) {
      throw new Error(`english-exact-repair-witness-invalid:${entryKey}`);
    }
    if (
      context.sourceDigests[witness.sourceFamily] !==
      PINNED_ENGLISH_EXACT_REPAIR_SOURCES[witness.sourceFamily]
    ) {
      throw new Error(
        `english-exact-repair-witness-source-drift:${entryKey}:${witness.sourceFamily}`
      );
    }
  }
  if (repairRule.externalArtifact) {
    if (
      entryKey !== "greek:G20354" ||
      repairRule.externalArtifact.sourceFamily !== "PERSEUS_LSJ" ||
      repairRule.externalArtifact.artifactPath !==
        PINNED_G20354_PERSEUS_ARTIFACT_PATH ||
      repairRule.externalArtifact.artifactDigest !==
        PINNED_G20354_PERSEUS_ARTIFACT_DIGEST ||
      repairRule.externalArtifact.artifactFileDigest !==
        PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST ||
      repairRule.externalArtifact.payloadDigest !==
        PINNED_G20354_PERSEUS_PAYLOAD_DIGEST ||
      repairRule.externalArtifact.sourceFileDigest !==
        PINNED_G20354_PERSEUS_SOURCE_FILE_DIGEST ||
      repairRule.externalArtifact.sourceFragmentDigest !==
        PINNED_G20354_PERSEUS_SOURCE_FRAGMENT_DIGEST
    ) {
      throw new Error(
        `english-exact-repair-external-artifact-rule-drift:${entryKey}`
      );
    }
    const artifactVerification = verifyPinnedG20354PerseusArtifact(
      context.g20354PerseusArtifact ?? pinnedG20354PerseusArtifact
    );
    if (!artifactVerification.valid) {
      throw new Error(
        `english-exact-repair-external-artifact-drift:${entryKey}:${artifactVerification.reasonCodes.join(",")}`
      );
    }
    const artifactFile =
      context.g20354PerseusArtifactFile ?? pinnedG20354PerseusArtifactFile;
    if (sha256(artifactFile) !== PINNED_G20354_PERSEUS_ARTIFACT_FILE_DIGEST) {
      throw new Error(
        `english-exact-repair-external-artifact-file-drift:${entryKey}`
      );
    }
  }
  const sourceRecordDigest = digestEnglishExactRepairSourceRecord(entry);
  if (sourceRecordDigest !== repairRule.expectedSourceRecordDigest) {
    throw new Error(`english-exact-repair-row-drift:${entryKey}`);
  }
  if (
    new Set(repairRule.changes.map((item) => item.field)).size !==
    repairRule.changes.length
  ) {
    throw new Error(`english-exact-repair-duplicate-field:${entryKey}`);
  }
  const ruleDigest = digestEnglishExactRepairRule(repairRule);
  const repairedEntry: EnglishExactRepairEntry = { ...entry };
  const repairs = repairRule.changes.map((item) => {
    if (
      entry[item.field] !== item.sourceValue ||
      sha256(entry[item.field]) !== item.sourceValueDigest ||
      sha256(item.repairedValue) !== item.repairedValueDigest
    ) {
      throw new Error(
        `english-exact-repair-field-drift:${entryKey}:${item.field}`
      );
    }
    for (const support of item.support) {
      if (
        sha256(support.exactFragment) !== support.fragmentDigest ||
        !entry[support.field].includes(support.exactFragment)
      ) {
        throw new Error(
          `english-exact-repair-support-drift:${entryKey}:${item.field}:${support.field}`
        );
      }
    }
    repairedEntry[item.field] = item.repairedValue;
    const supportDigest = sha256(stableJson(item.support));
    const withoutDigest = {
      schemaVersion: ENGLISH_EXACT_REPAIR_SCHEMA_VERSION,
      policyVersion: ENGLISH_EXACT_REPAIR_POLICY_VERSION,
      entryKey,
      field: item.field,
      sourceValue: item.sourceValue,
      repairedValue: item.repairedValue,
      method: item.method,
      ruleId: repairRule.ruleId,
      ruleDigest,
      sourceRecordDigest,
      sourceValueDigest: item.sourceValueDigest,
      repairedValueDigest: item.repairedValueDigest,
      supportDigest
    };
    return {
      ...withoutDigest,
      repairDigest: sha256(stableJson(withoutDigest))
    } satisfies EnglishExactFieldRepairEvidence;
  });
  return { entry: repairedEntry, repairs };
}

export function validateEnglishExactFieldRepairEvidence(input: {
  sourceEntry: EnglishExactRepairEntry;
  repairedEntry: EnglishExactRepairEntry;
  repair: EnglishExactFieldRepairEvidence;
  context: EnglishExactRepairContext;
}): string[] {
  const issues = new Set<string>();
  let replay: EnglishExactRepairResult | null = null;
  try {
    replay = applyEnglishExactRepairs(input.sourceEntry, input.context);
  } catch (error) {
    issues.add(error instanceof Error ? error.message : String(error));
  }
  const expected = replay?.repairs.find(
    (item) => item.field === input.repair.field
  );
  if (!expected || stableJson(expected) !== stableJson(input.repair)) {
    issues.add("english-exact-repair-evidence-replay-mismatch");
  }
  if (
    replay &&
    (replay.entry[input.repair.field] !==
      input.repairedEntry[input.repair.field] ||
      input.repairedEntry[input.repair.field] !== input.repair.repairedValue)
  ) {
    issues.add("english-exact-repair-published-value-mismatch");
  }
  return [...issues].sort();
}

function sha256(value: string | Buffer): string {
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
