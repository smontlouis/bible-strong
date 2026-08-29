import { createHash } from "node:crypto";

import {
  digestEnglishExactRepairSourceRecord,
  ENGLISH_EXACT_REPAIR_RULES,
  englishExactRepairEntryKey,
  PINNED_ENGLISH_EXACT_REPAIR_SOURCES,
  type EnglishExactRepairEntry
} from "./englishExactRepairs.js";

export const ENGLISH_SEMANTIC_PUNCTUATION_SCHEMA_VERSION =
  "lexicon-v3-english-semantic-punctuation@1" as const;
export const ENGLISH_SEMANTIC_PUNCTUATION_POLICY_VERSION =
  "lexicon-v3-english-semantic-punctuation-policy@1" as const;

export type EnglishSemanticTerminalPunctuation = "!" | "?";
export type EnglishSemanticPunctuationFunction =
  | "direct-address"
  | "exclamatory-response"
  | "hortative"
  | "imperative"
  | "interrogative"
  | "optative"
  | "strengthened-negation";

export interface EnglishSemanticPunctuationSupport {
  field: "meaning" | "morph";
  exactFragment: string;
  fragmentDigest: string;
}

export interface EnglishSemanticPunctuationRule {
  ruleId: string;
  entryKey: string;
  sourceFamily: "TBESG" | "TBESH" | "GREEK_RECONSTRUCTION";
  sourceSnapshotDigest: string;
  expectedSourceRecordDigest: string;
  expectedGloss: string;
  punctuation: EnglishSemanticTerminalPunctuation;
  semanticFunction: EnglishSemanticPunctuationFunction;
  rationale: string;
  support: readonly EnglishSemanticPunctuationSupport[];
}

export interface EnglishSemanticPunctuationEvidence {
  schemaVersion: typeof ENGLISH_SEMANTIC_PUNCTUATION_SCHEMA_VERSION;
  policyVersion: typeof ENGLISH_SEMANTIC_PUNCTUATION_POLICY_VERSION;
  entryKey: string;
  punctuation: EnglishSemanticTerminalPunctuation;
  semanticFunction: EnglishSemanticPunctuationFunction;
  ruleId: string;
  ruleDigest: string;
  registryDigest: string;
  sourceFamily: EnglishSemanticPunctuationRule["sourceFamily"];
  sourceSnapshotDigest: string;
  sourceRecordDigest: string;
  supportDigest: string;
  attestationDigest: string;
}

interface RuleInput {
  entryKey: string;
  sourceFamily?: EnglishSemanticPunctuationRule["sourceFamily"];
  sourceSnapshotDigest?: string;
  expectedSourceRecordDigest: string;
  expectedGloss: string;
  punctuation: EnglishSemanticTerminalPunctuation;
  semanticFunction: EnglishSemanticPunctuationFunction;
  rationale: string;
  support: ReadonlyArray<{
    field: EnglishSemanticPunctuationSupport["field"];
    exactFragment: string;
  }>;
}

function rule(input: RuleInput): EnglishSemanticPunctuationRule {
  const sourceFamily = input.sourceFamily ?? "TBESG";
  return Object.freeze({
    ruleId: `english-semantic-punctuation:${input.entryKey}@1`,
    entryKey: input.entryKey,
    sourceFamily,
    sourceSnapshotDigest:
      input.sourceSnapshotDigest ??
      (sourceFamily === "TBESH"
        ? PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESH
        : PINNED_ENGLISH_EXACT_REPAIR_SOURCES.TBESG),
    expectedSourceRecordDigest: input.expectedSourceRecordDigest,
    expectedGloss: input.expectedGloss,
    punctuation: input.punctuation,
    semanticFunction: input.semanticFunction,
    rationale: input.rationale,
    support: Object.freeze(
      input.support.map((item) => ({
        ...item,
        fragmentDigest: sha256(item.exactFragment)
      }))
    )
  });
}

const RULES: readonly EnglishSemanticPunctuationRule[] = [
  rule({
    entryKey: "greek:G0687",
    expectedSourceRecordDigest:
      "9e2fb1d2662130ae3cbe3283797b65701d1d3fe8ab75e6e00b5593d237e9995b",
    expectedGloss: "no?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale:
      "The question mark is lexical: the notice identifies an interrogative particle.",
    support: [{ field: "meaning", exactFragment: "<i>interrog. particle</i>" }]
  }),
  rule({
    entryKey: "greek:G2095",
    expectedSourceRecordDigest:
      "fe6e7541fc640d2727aa8970fd71eb9396ab5f7bf51461ea679ac1655489f0ab",
    expectedGloss: "well/well done!",
    punctuation: "!",
    semanticFunction: "exclamatory-response",
    rationale: "The exclamation mark belongs to the attested reply formula.",
    support: [
      {
        field: "meaning",
        exactFragment: "<b>in replies, well! good! well done!</b>"
      }
    ]
  }),
  rule({
    entryKey: "greek:G2188",
    expectedSourceRecordDigest:
      "731d46c5dd32314f45b199d28ad63b7b6da6c6367de420c53dea8697f05a447b",
    expectedGloss: "open!",
    punctuation: "!",
    semanticFunction: "imperative",
    rationale: "The gloss renders the Aramaic command in direct speech.",
    support: [{ field: "meaning", exactFragment: "ephphatha, be opened" }]
  }),
  rule({
    entryKey: "greek:G2891",
    expectedSourceRecordDigest:
      "cfa92c2b6cd09292e830d4ffba78c966b473f4cf18f3e45e961dfea6ed940751",
    expectedGloss: "stand up!",
    punctuation: "!",
    semanticFunction: "imperative",
    rationale: "The punctuation marks the source's explicit imperative force.",
    support: [{ field: "meaning", exactFragment: "Heb. imperat. masc." }]
  }),
  rule({
    entryKey: "greek:G3134",
    expectedSourceRecordDigest:
      "9a45f97a3ea3e6d7f7145a652da9756592080277d686076cc544846d11108e11",
    expectedGloss: "Come, Lord!",
    punctuation: "!",
    semanticFunction: "direct-address",
    rationale:
      "The punctuation is part of STEP's direct-address interpretation of Maranatha.",
    support: [{ field: "meaning", exactFragment: "Maranatha" }]
  }),
  rule({
    entryKey: "greek:G3378",
    expectedSourceRecordDigest:
      "fe244d14f0f43654a0b88c6be4b0e6f57130444528422c6cbfb3173f62d5ad6a",
    expectedGloss: "isn't it?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale:
      "The notice explicitly describes the combination as interrogative.",
    support: [{ field: "meaning", exactFragment: "III. Interrogative" }]
  }),
  rule({
    entryKey: "greek:G3780",
    expectedSourceRecordDigest:
      "ecdea5acce45491f1217626d95f0412b9722b7ffd13ae5ab6a1f4b7df4fab619",
    expectedGloss: "not!",
    punctuation: "!",
    semanticFunction: "strengthened-negation",
    rationale:
      "The exclamation mark conveys the notice's explicitly strengthened negation.",
    support: [{ field: "meaning", exactFragment: "strengthened form of οὐ" }]
  }),
  rule({
    entryKey: "greek:G4212",
    expectedSourceRecordDigest:
      "b912b0f9cba08a61f43b5d053bd8834c3d23adb335da8b4e78971efdd9129820",
    expectedGloss: "how often!",
    punctuation: "!",
    semanticFunction: "exclamatory-response",
    rationale:
      "The short exclamatory gloss is supported by an interrogative numeral adverb notice.",
    support: [{ field: "meaning", exactFragment: "interrog. num. adv." }]
  }),
  rule({
    entryKey: "greek:G7049",
    expectedSourceRecordDigest:
      "69cbc7bf0665ec4e5f572fa1ed8e45c73a178c75234ebf87dcabcd008c416252",
    expectedGloss: "is it not?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale:
      "The complete exact notice is itself the interrogative expression.",
    support: [{ field: "meaning", exactFragment: "is it not?" }]
  }),
  rule({
    entryKey: "greek:G8216",
    sourceFamily: "GREEK_RECONSTRUCTION",
    sourceSnapshotDigest:
      "f75d92886fb602e75372ff7bc3cbce11ca758311fc5d09ca22fbc3c841ed5874",
    expectedSourceRecordDigest:
      "9651609dd0a973044c8f4b087374ab04815bb6ebc046015b88b77741387aa0dc",
    expectedGloss: "mother!",
    punctuation: "!",
    semanticFunction: "direct-address",
    rationale:
      "The exclamation mark belongs to the proven Doric vocative reconstruction.",
    support: [
      { field: "meaning", exactFragment: "used in direct address" },
      { field: "meaning", exactFragment: "Mother Earth" }
    ]
  }),
  rule({
    entryKey: "greek:G20507",
    expectedSourceRecordDigest:
      "30f2863633b6e0558bb1c6fe5d6bc77f14c54bac71dff86d77f7b9bff274a5ac",
    expectedGloss: "look!",
    punctuation: "!",
    semanticFunction: "imperative",
    rationale: "The complete exact notice is the imperative interjection.",
    support: [{ field: "meaning", exactFragment: "look!" }]
  }),
  rule({
    entryKey: "greek:G20727",
    expectedSourceRecordDigest:
      "28b716dffe623e43c665f0247938c4e04337f5751e70e157ca93c3b6f63d0c1a",
    expectedGloss: "isn't it?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale:
      "The question mark expresses the combined negative particle's interrogative use.",
    support: [{ field: "meaning", exactFragment: "μὴ οὐ" }]
  }),
  rule({
    entryKey: "hebrew:H0015",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "8be822b069b2a41afe01c9b401432a7e3aa0cf6cb0561f574aa6199412c5ad49",
    expectedGloss: "oh that!",
    punctuation: "!",
    semanticFunction: "optative",
    rationale: "The exclamation mark conveys entreaty, longing, and desire.",
    support: [{ field: "meaning", exactFragment: "entreat, longing, desire" }]
  }),
  rule({
    entryKey: "hebrew:H0165",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "1ec0b579bfa5c6efe393ed6ce7ca054ed42bb1288bb8e02988e3795860abc754",
    expectedGloss: "where?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale: "The question mark is inherent in the interrogative adverb.",
    support: [{ field: "meaning", exactFragment: "where" }]
  }),
  rule({
    entryKey: "hebrew:H0346",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "f4f283026f4a505adfae93ddcec87100601bbd8592ea5df878ce38b7f0825859",
    expectedGloss: "where?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale: "The question mark is repeated verbatim in the exact notice.",
    support: [{ field: "meaning", exactFragment: "1) where?" }]
  }),
  rule({
    entryKey: "hebrew:H0351",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "a612495c17ab5643d5ec4d9e4e2a4852a0e91908151d56d1d2c32c62bfb433bb",
    expectedGloss: "where?",
    punctuation: "?",
    semanticFunction: "interrogative",
    rationale:
      "The question mark represents an interrogative/exclamatory adverb.",
    support: [{ field: "meaning", exactFragment: "where!" }]
  }),
  rule({
    entryKey: "hebrew:H1980K",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "63984b8910e417c9b20e79a05efeb482769fd94a6285fe2471233bdd84a83e29",
    expectedGloss: "to go: come!",
    punctuation: "!",
    semanticFunction: "hortative",
    rationale:
      "The exclamation mark belongs to STEP's exact hortative sub-sense.",
    support: [{ field: "meaning", exactFragment: ": come[hortative]" }]
  }),
  rule({
    entryKey: "hebrew:H5414Q",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "f0a91349e016ef0df3e8ebb921d373cf0ca54daaeb12f9e29b02b3c46d6a7466",
    expectedGloss: "to give: if only!",
    punctuation: "!",
    semanticFunction: "optative",
    rationale:
      "The exclamation mark belongs to STEP's exact wishing sub-sense.",
    support: [{ field: "meaning", exactFragment: ": if_only[wishing]" }]
  }),
  rule({
    entryKey: "hebrew:H7200I",
    sourceFamily: "TBESH",
    expectedSourceRecordDigest:
      "c608839c0357eeb56ccb4f02b7d4588b00402600ad17a62fa1e71c946994d5f9",
    expectedGloss: "to see: behold!",
    punctuation: "!",
    semanticFunction: "imperative",
    rationale:
      "The exclamation mark belongs to STEP's exact deictic command sub-sense.",
    support: [{ field: "meaning", exactFragment: ": behold!" }]
  })
];

export const ENGLISH_SEMANTIC_PUNCTUATION_RULES: ReadonlyMap<
  string,
  EnglishSemanticPunctuationRule
> = new Map(RULES.map((item) => [item.entryKey, item]));

export const ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST = sha256(
  stableJson(RULES)
);
export const EXPECTED_ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST =
  "91c9c64aa280de4f7dfbc264324b4a7199650a2571c483559bf687080caa3de2" as const;
if (
  ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST !==
  EXPECTED_ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST
) {
  throw new Error("english-semantic-punctuation-registry-drift");
}

export function attestEnglishSemanticTerminalPunctuation(
  entry: EnglishExactRepairEntry
): EnglishSemanticPunctuationEvidence | null {
  const entryKey = englishExactRepairEntryKey(entry);
  const attestationRule = ENGLISH_SEMANTIC_PUNCTUATION_RULES.get(entryKey);
  if (!attestationRule) return null;
  const sourceEntry = exactSemanticPunctuationSourceEntry(
    entry,
    attestationRule
  );
  if (!sourceEntry) return null;
  const sourceRecordDigest = digestEnglishExactRepairSourceRecord(sourceEntry);
  if (
    sourceRecordDigest !== attestationRule.expectedSourceRecordDigest ||
    entry.gloss !== attestationRule.expectedGloss ||
    !entry.gloss.endsWith(attestationRule.punctuation)
  ) {
    return null;
  }
  for (const support of attestationRule.support) {
    if (
      sha256(support.exactFragment) !== support.fragmentDigest ||
      !entry[support.field].includes(support.exactFragment)
    ) {
      return null;
    }
  }
  const ruleDigest = sha256(stableJson(attestationRule));
  const supportDigest = sha256(stableJson(attestationRule.support));
  const withoutDigest = {
    schemaVersion: ENGLISH_SEMANTIC_PUNCTUATION_SCHEMA_VERSION,
    policyVersion: ENGLISH_SEMANTIC_PUNCTUATION_POLICY_VERSION,
    entryKey,
    punctuation: attestationRule.punctuation,
    semanticFunction: attestationRule.semanticFunction,
    ruleId: attestationRule.ruleId,
    ruleDigest,
    registryDigest: ENGLISH_SEMANTIC_PUNCTUATION_REGISTRY_DIGEST,
    sourceFamily: attestationRule.sourceFamily,
    sourceSnapshotDigest: attestationRule.sourceSnapshotDigest,
    sourceRecordDigest,
    supportDigest
  };
  return {
    ...withoutDigest,
    attestationDigest: sha256(stableJson(withoutDigest))
  };
}

/**
 * French packets carry the audited English identity, so an exact morph repair
 * can differ from the raw STEP row used by a punctuation attestation. Reverse
 * only a complete registry rule and require the reconstructed raw row digest;
 * arbitrary repaired-looking values never receive an attestation.
 */
function exactSemanticPunctuationSourceEntry(
  entry: EnglishExactRepairEntry,
  punctuationRule: EnglishSemanticPunctuationRule
): EnglishExactRepairEntry | null {
  if (
    digestEnglishExactRepairSourceRecord(entry) ===
    punctuationRule.expectedSourceRecordDigest
  ) {
    return entry;
  }
  const exactRepairRule = ENGLISH_EXACT_REPAIR_RULES.get(
    punctuationRule.entryKey
  );
  if (!exactRepairRule || exactRepairRule.changes.length === 0) return null;
  const sourceEntry: EnglishExactRepairEntry = { ...entry };
  for (const change of exactRepairRule.changes) {
    if (entry[change.field] !== change.repairedValue) return null;
    sourceEntry[change.field] = change.sourceValue;
  }
  const sourceRecordDigest = digestEnglishExactRepairSourceRecord(sourceEntry);
  return sourceRecordDigest === punctuationRule.expectedSourceRecordDigest &&
    sourceRecordDigest === exactRepairRule.expectedSourceRecordDigest
    ? sourceEntry
    : null;
}

export function validateEnglishSemanticPunctuationEvidence(input: {
  entry: EnglishExactRepairEntry;
  evidence: EnglishSemanticPunctuationEvidence;
}): string[] {
  const expected = attestEnglishSemanticTerminalPunctuation(input.entry);
  return expected && stableJson(expected) === stableJson(input.evidence)
    ? []
    : ["english-semantic-punctuation-evidence-replay-mismatch"];
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
