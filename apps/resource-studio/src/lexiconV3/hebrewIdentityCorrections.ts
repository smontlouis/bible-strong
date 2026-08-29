import { createHash } from "node:crypto";

import type {
  HebrewEnglishArtifactSummary,
  HebrewEnglishCandidate
} from "./hebrewEnglish.js";

export const HEBREW_IDENTITY_CORRECTION_POLICY_ID =
  "hebrew-identity-correction-policy@1" as const;

export const HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT = {
  schema: "hebrew-identity-corrections@1",
  correctionCount: 10,
  mutatedFieldCount: 13,
  fileDigest:
    "0daae79609176d90526635631e8aceb429e3be7bad18222a8cde5ea579f02b7a",
  logicalDigest:
    "2756970756968bdbb379c4f794d841e38b9de436f332dc75ecaa486efe766ce7",
  normalizationNote:
    "The counter-audit display normalized H5718O by omitting one cantillation mark; this runtime registry pins the exact source form עֲדָיָ֫הוּ before applying the same adjudicated correction.",
  sourcePins: {
    coreDatabase:
      "8931ebbaf47413189682bba2c0f010a7bbeed28bdfde0a25e720d90492c80232",
    fullDatabase:
      "48a023568f83ebbc37de2e811dcefa54ba422f92d0cbb66c25f2b8245c79d9d8",
    tbesh: "da0a8d2aafba429421f55f2906e8896a7ea83458a0d905deb2668d91f2a75e31",
    tahot: {
      "TAHOT Isa-Mal.txt":
        "f3ded203d2a74d6368932c97ae550d1d0754b271af491dc0dedf36fe3ba0bcc5",
      "TAHOT Job-Sng.txt":
        "84e118a97e5725e3847cdfdd593873513021c790c63cc91a0d41fca2b5db2ed5",
      "TAHOT Jos-Est.txt":
        "195fee1dc3653bab33701f170734eb894ed647c10cd08cc61749375fe8b73775"
    },
    openScripturesRevision: "21c9add13bc727d3a951361778e97e3ff7afd1ce",
    openScriptures: {
      hebrewStrong:
        "a628f4f89f8bdaf2483fd3faf1abc8653cc6717758dfc9f24beb7571d9bdd0c4",
      lexicalIndex:
        "8f7a605c58899d2f44430149c143c00903976e1e91232476677972a69e5bc85f",
      brownDriverBriggs:
        "2b52658a4323d91674cda4090ab8b3ebddfff640f4f18143c28300e80b2c38f8",
      augIndex:
        "e7217ca8ff8ff3f21f9cf1bbe87411adf55f6aa88bcf5ed9ddc886cc6b160c5d"
    }
  }
} as const;

interface HebrewIdentityValue {
  eStrong: string;
  dStrong: string;
  uStrong: string;
  original: string;
  transliteration: string;
  morph: string;
}

export const HEBREW_IDENTITY_CORRECTIONS = [
  {
    key: "H2679",
    stepEntryId: 14633,
    changedFields: ["original", "transliteration"],
    before: {
      eStrong: "H2679",
      dStrong: "H2679 = a Part of",
      uStrong: "H4506B",
      original: "חֲצִי",
      transliteration: "cha.tsi ham.m.nu.chot",
      morph: "N:N--PG"
    },
    after: {
      eStrong: "H2679",
      dStrong: "H2679 = a Part of",
      uStrong: "H4506B",
      original: "חֲצִי הַמְּנֻחוֹת",
      transliteration: "cha.tsi ham.me.nu.chot",
      morph: "N:N--PG"
    },
    historicalCandidateRecordDigest:
      "6b4fc0dab4ee15334d974d5a9a29d95fefb220b78b67a1342d18a28d92e76edd",
    stepAnchorDigest:
      "e3d51fb6f224c9c1068d0a5d33c8b01bcf73231f3f43ef1708321ae2e7994e61",
    evidenceProofsDigest:
      "053050df97ca871526fc2747965e7aa65c2266b267d32f97dea4d5e2ad393c5a"
  },
  {
    key: "H2680",
    stepEntryId: 14634,
    changedFields: ["original", "transliteration"],
    before: {
      eStrong: "H2680",
      dStrong: "H2680 = combination of",
      uStrong: "H4506B (H2677+H4506B)",
      original: "חֲצִי הַמְּנַחְתִּי מְנַשֶּׁה",
      transliteration: "cha.tsi ham.nach.ti me.nash.sheh",
      morph: "N:N--PG"
    },
    after: {
      eStrong: "H2680",
      dStrong: "H2680 = combination of",
      uStrong: "H4506B (H2677+H4506B)",
      original: "חֲצִי הַמְּנַחְתִּי",
      transliteration: "cha.tsi ham.me.nach.ti",
      morph: "N:N--PG"
    },
    historicalCandidateRecordDigest:
      "bb0d25dc20648bcb71b2f6ad2e360beae644c13958d723184484fb5a60d57a3b",
    stepAnchorDigest:
      "68488d704a3bc65f5bc1b0c04ba3c9efbc38d00903a31f01b4d2598447de8cc1",
    evidenceProofsDigest:
      "8f369d7019a726ef0d5b5309b1edf93fd09790d297b45255354c0111e7209b15"
  },
  {
    key: "H5718O",
    stepEntryId: 18722,
    changedFields: ["original", "transliteration"],
    before: {
      eStrong: "H5718",
      dStrong: "H5718O = a Name of",
      uStrong: "H5714K",
      original: "עֲדָיָ֫הוּ",
      transliteration: "a.da.yah",
      morph: "N:N-M-P"
    },
    after: {
      eStrong: "H5718",
      dStrong: "H5718O = a Name of",
      uStrong: "H5714K",
      original: "עֲדָיָא",
      transliteration: "a.da.ya",
      morph: "N:N-M-P"
    },
    historicalCandidateRecordDigest:
      "dbe6399c3009d61e49dfd90010cd0fd7159db163b19fdb53c773f5cd87f766a7",
    stepAnchorDigest:
      "42de7f8888a3fba943df359573e6da93e710a3216ab1de5d4a673639ce5c5324",
    evidenceProofsDigest:
      "dbb55755ab504425b849591f70a0ac62ee9bd28a0361b177bab34082fe5b05c8"
  },
  {
    key: "H4192",
    stepEntryId: 16706,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H4192",
      dStrong: "H4192 =",
      uStrong: "H4192",
      original: "לַבֵּן",
      transliteration: "mut",
      morph: "H:N-M"
    },
    after: {
      eStrong: "H4192",
      dStrong: "H4192 =",
      uStrong: "H4192",
      original: "לַבֵּן",
      transliteration: "la.ben",
      morph: "H:N-M"
    },
    historicalCandidateRecordDigest:
      "dbd16c7fd5b43a825a3a3f5a0d415c1836f3119b32c29843065983c27b5b482a",
    stepAnchorDigest:
      "c889284beac18c794cfb4f1995eaa55655cca25a7a3fc178257ba78da8847833",
    evidenceProofsDigest:
      "38ab3bca7564c0041e0ecb80eaf96562bf5b643916539706ce729e2eb69d9a73"
  },
  {
    key: "H1276",
    stepEntryId: 12784,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H1276",
      dStrong: "H1276 = a group of",
      uStrong: "H1075",
      original: "בֵּרִים",
      transliteration: "be.ri",
      morph: "N:N--PG"
    },
    after: {
      eStrong: "H1276",
      dStrong: "H1276 = a group of",
      uStrong: "H1075",
      original: "בֵּרִים",
      transliteration: "be.rim",
      morph: "N:N--PG"
    },
    historicalCandidateRecordDigest:
      "d6b837b8e000217d651e58d1827007a14c20d8db9efcb497db6773bc70c64c86",
    stepAnchorDigest:
      "0d8eed342deedf200bfbd866e3ed545cc4bfe12152b2649341b6f8b31d901053",
    evidenceProofsDigest:
      "ec3ccde29915729a458fc78e2eeea72e07e2186b913f1119275c4f77ce85dd3b"
  },
  {
    key: "H2050",
    stepEntryId: 13753,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H2050",
      dStrong: "H2050 =",
      uStrong: "H2050",
      original: "הוּת",
      transliteration: "ha.tat",
      morph: "H:V"
    },
    after: {
      eStrong: "H2050",
      dStrong: "H2050 =",
      uStrong: "H2050",
      original: "הוּת",
      transliteration: "hut",
      morph: "H:V"
    },
    historicalCandidateRecordDigest:
      "7783e7c2471a0f38508453ecf6896181eb54e2cb25e69834ff5a5f65b7bf35eb",
    stepAnchorDigest:
      "e8be73151a1e91a7ca9891ace514fe88e77c69ff744bf8c6d3f9b38cb4e12f84",
    evidenceProofsDigest:
      "c138950bcfd4bd3c61abfc381109049bdebbec01967815c0df36c51d454677c4"
  },
  {
    key: "H2654B",
    stepEntryId: 14600,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H2654b",
      dStrong: "H2654B =",
      uStrong: "H2654B",
      original: "חָפַץ",
      transliteration: "ch.ph",
      morph: "H:V"
    },
    after: {
      eStrong: "H2654b",
      dStrong: "H2654B =",
      uStrong: "H2654B",
      original: "חָפַץ",
      transliteration: "cha.phats",
      morph: "H:V"
    },
    historicalCandidateRecordDigest:
      "1b58242066cbce798af0411a05efee2c0ca68466047cad3032dd0e9a49fbbe5e",
    stepAnchorDigest:
      "6c4b7c2ac19182d50edad7c46a44005962ce16ad223be392213a26fe5e227406",
    evidenceProofsDigest:
      "8a639c6ce8a6c2304c8cc05abf2544add6d2b2cd2aca46dfae996da266ccb5ba"
  },
  {
    key: "H3491",
    stepEntryId: 15861,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H3491",
      dStrong: "H3491 =",
      uStrong: "H3491",
      original: "יְתוּר",
      transliteration: "ya.tur",
      morph: "H:N-M"
    },
    after: {
      eStrong: "H3491",
      dStrong: "H3491 =",
      uStrong: "H3491",
      original: "יְתוּר",
      transliteration: "ye.tur",
      morph: "H:N-M"
    },
    historicalCandidateRecordDigest:
      "a66fa33a09831ef323556ca9a0f4d406ef019dabc2ff188732007a043e272b96",
    stepAnchorDigest:
      "68ce450d66dac74fbf20b1454a40dbf6012b4143e17750108ce08cd02cae1fb0",
    evidenceProofsDigest:
      "145a2170912250e504afed38ffdf3d21e4fe6d91fece49a407de1e1da779c56a"
  },
  {
    key: "H4360",
    stepEntryId: 16924,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H4360",
      dStrong: "H4360 =",
      uStrong: "H4360",
      original: "מַכְלֻל",
      transliteration: "mikh.lul",
      morph: "H:N-M"
    },
    after: {
      eStrong: "H4360",
      dStrong: "H4360 =",
      uStrong: "H4360",
      original: "מַכְלֻל",
      transliteration: "makh.lul",
      morph: "H:N-M"
    },
    historicalCandidateRecordDigest:
      "cec8e77a3851dc1f52e5c2787e40e0853ec73fa46438feefcdad328fe0925b49",
    stepAnchorDigest:
      "0019b211ee9a59d21f214bda9501ac2a6f0aa22c5e2bb0490f3612ea369b6067",
    evidenceProofsDigest:
      "7192c113c8ce85e59f50568af88a0ba21045944331103c10de5ff2eb81d5320d"
  },
  {
    key: "H8530",
    stepEntryId: 22494,
    changedFields: ["transliteration"],
    before: {
      eStrong: "H8530",
      dStrong: "H8530 =",
      uStrong: "H8530",
      original: "תַּלְפִּיָּוֹת",
      transliteration: "tal.piy.yah",
      morph: "H:N-F"
    },
    after: {
      eStrong: "H8530",
      dStrong: "H8530 =",
      uStrong: "H8530",
      original: "תַּלְפִּיָּוֹת",
      transliteration: "tal.piy.yot",
      morph: "H:N-F"
    },
    historicalCandidateRecordDigest:
      "82eedd7bafacc4af75b4a2abddb36d65b74c38b17a2fca9947c29873b7a943b5",
    stepAnchorDigest:
      "22f114f30581381c323b840c3b506eba5171064f3bae77d0a6f427a4c1bae110",
    evidenceProofsDigest:
      "3cd80e28bc634fe4283fe8c92254b2d3be05175b652ce7b69705c9847f184721"
  }
] as const;

export const HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST =
  "eebb9d84c63f12a9c637d6e13b7108fa67853ee14b7a7f131889dd8477074689" as const;

type HebrewIdentityCorrection = (typeof HEBREW_IDENTITY_CORRECTIONS)[number];

export interface ProveHebrewIdentityCorrectionInput {
  key: string;
  stepEntryId: number;
  sourceIdentity: HebrewIdentityValue;
  auditIdentity: HebrewIdentityValue;
  candidate: HebrewEnglishCandidate | null;
  databaseDigest: string;
  tbeshSourceDigest: string;
  tahotSourceDigests: Readonly<Record<string, string>>;
  hebrewEnglishSummary: HebrewEnglishArtifactSummary | null;
}

export interface HebrewIdentityCorrectionProof {
  policyId: typeof HEBREW_IDENTITY_CORRECTION_POLICY_ID;
  key: string;
  applicable: true;
  proven: boolean;
  issueCodes: string[];
  facts: {
    registryDigestValid: boolean;
    sourcePinsValid: boolean;
    stepEntryIdExact: boolean;
    sourceIdentityExact: boolean;
    auditIdentityExact: boolean;
    candidateIdentityExact: boolean;
    stepAnchorExact: boolean;
    strongIdentityPreserved: boolean;
    changedFieldsExact: boolean;
  };
  selectedIdentity: HebrewIdentityValue | null;
  correctionRecordDigest: string;
  sourceArtifactDigest: string;
  registryDigest: string;
}

const CORRECTIONS_BY_KEY = new Map<string, HebrewIdentityCorrection>(
  HEBREW_IDENTITY_CORRECTIONS.map((correction) => [correction.key, correction])
);

export function isHebrewIdentityCorrectionKey(key: string): boolean {
  return CORRECTIONS_BY_KEY.has(key);
}

export function proveHebrewIdentityCorrection(
  input: ProveHebrewIdentityCorrectionInput
): HebrewIdentityCorrectionProof | null {
  const correction = CORRECTIONS_BY_KEY.get(input.key);
  if (!correction) return null;

  const candidateIdentity = input.candidate?.identity ?? null;
  const stepAnchor = input.candidate?.provenance.find(
    (attestation) => attestation.source === "STEP-gloss-anchor"
  );
  const facts = {
    registryDigestValid:
      sha256(stableJson(HEBREW_IDENTITY_CORRECTIONS)) ===
      HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST,
    sourcePinsValid: sourcePinsMatch(input),
    stepEntryIdExact: input.stepEntryId === correction.stepEntryId,
    sourceIdentityExact: identityEquals(
      input.sourceIdentity,
      correction.before
    ),
    auditIdentityExact: identityEquals(input.auditIdentity, correction.before),
    candidateIdentityExact: Boolean(
      candidateIdentity &&
      candidateIdentity.stepEntryId === correction.stepEntryId &&
      identityEquals(candidateIdentity, correction.before)
    ),
    stepAnchorExact: stepAnchor?.contentDigest === correction.stepAnchorDigest,
    strongIdentityPreserved:
      correction.before.eStrong === correction.after.eStrong &&
      correction.before.dStrong === correction.after.dStrong &&
      correction.before.uStrong === correction.after.uStrong &&
      correction.before.morph === correction.after.morph,
    changedFieldsExact:
      stableJson(changedFields(correction.before, correction.after)) ===
      stableJson(correction.changedFields)
  };
  const issueCodes = Object.entries(facts)
    .filter(([, valid]) => !valid)
    .map(([fact]) => `hebrew-identity-correction-${fact}-invalid`);
  const proven = issueCodes.length === 0;

  return {
    policyId: HEBREW_IDENTITY_CORRECTION_POLICY_ID,
    key: correction.key,
    applicable: true,
    proven,
    issueCodes,
    facts,
    selectedIdentity: proven ? { ...correction.after } : null,
    correctionRecordDigest: sha256(stableJson(correction)),
    sourceArtifactDigest:
      HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT.logicalDigest,
    registryDigest: HEBREW_IDENTITY_CORRECTIONS_REGISTRY_DIGEST
  };
}

function sourcePinsMatch(input: ProveHebrewIdentityCorrectionInput): boolean {
  const pins = HEBREW_IDENTITY_CORRECTION_SOURCE_ARTIFACT.sourcePins;
  const summary = input.hebrewEnglishSummary;
  if (
    input.databaseDigest !== pins.fullDatabase ||
    input.tbeshSourceDigest !== pins.tbesh ||
    !summary ||
    summary.openScripturesRevision !== pins.openScripturesRevision
  ) {
    return false;
  }
  for (const [file, digest] of Object.entries(pins.tahot)) {
    if (input.tahotSourceDigests[file] !== digest) return false;
  }
  for (const [source, digest] of Object.entries(pins.openScriptures)) {
    if (
      (summary.sourceDigests as unknown as Record<string, string | null>)[
        source
      ] !== digest
    )
      return false;
  }
  return true;
}

function identityEquals(
  actual: HebrewIdentityValue,
  expected: HebrewIdentityValue
): boolean {
  return (
    actual.eStrong === expected.eStrong &&
    actual.dStrong === expected.dStrong &&
    actual.uStrong === expected.uStrong &&
    actual.original === expected.original &&
    actual.transliteration === expected.transliteration &&
    actual.morph === expected.morph
  );
}

function changedFields(
  before: HebrewIdentityValue,
  after: HebrewIdentityValue
): string[] {
  return Object.keys(before).filter(
    (field) =>
      before[field as keyof HebrewIdentityValue] !==
      after[field as keyof HebrewIdentityValue]
  );
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function stableJson(value: unknown): string {
  return JSON.stringify(sortJson(value));
}

function sortJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}

export type { HebrewIdentityCorrection, HebrewIdentityValue };
