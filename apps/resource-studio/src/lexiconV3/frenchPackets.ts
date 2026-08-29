import { createHash } from "node:crypto";

import {
  stripLexiconHtml,
  type FrenchConcordanceForm
} from "./frenchValidation.js";
import { lexiconV3FieldContentHash } from "./review.js";

export const FRENCH_PACKET_SCHEMA_VERSION =
  "lexicon-v3-french-packet@3" as const;

export interface FrenchPacketEnglishParent {
  entryKey: string;
  field: "gloss" | "meaning";
  fieldVersionId: number;
  contentHash: string;
  valueTextHash: string;
  valueHtmlHash: string | null;
  state: "auto_validated" | "human_validated";
  method: string;
  generator: string;
}

export interface FrenchPacketEnglishReleaseLineage {
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  parents: {
    gloss: FrenchPacketEnglishParent;
    meaning: FrenchPacketEnglishParent;
  };
}

export interface BuildFrenchPacketEnglishReleaseLineageInput {
  entryKey: string;
  releaseKey: string;
  releaseSnapshotFingerprint: string;
  gloss: Omit<
    FrenchPacketEnglishParent,
    "entryKey" | "field" | "contentHash" | "valueTextHash" | "valueHtmlHash"
  > & { valueText: string };
  meaning: Omit<
    FrenchPacketEnglishParent,
    "entryKey" | "field" | "contentHash" | "valueTextHash" | "valueHtmlHash"
  > & { valueText: string; valueHtml: string | null };
}

export function buildFrenchPacketEnglishReleaseLineage(
  input: BuildFrenchPacketEnglishReleaseLineageInput
): FrenchPacketEnglishReleaseLineage {
  const parent = (
    field: "gloss" | "meaning",
    value: BuildFrenchPacketEnglishReleaseLineageInput["gloss"]
  ): FrenchPacketEnglishParent => {
    const valueHtml = field === "meaning" ? input.meaning.valueHtml : null;
    return {
      entryKey: input.entryKey,
      field,
      fieldVersionId: value.fieldVersionId,
      contentHash: lexiconV3FieldContentHash({
        entryKey: input.entryKey,
        locale: "en",
        field,
        valueText: value.valueText,
        valueHtml,
        derivedFromVersionId: null
      }),
      valueTextHash: sha256(value.valueText),
      valueHtmlHash: valueHtml === null ? null : sha256(valueHtml),
      state: value.state,
      method: value.method,
      generator: value.generator
    };
  };
  return {
    releaseKey: input.releaseKey,
    releaseSnapshotFingerprint: input.releaseSnapshotFingerprint,
    parents: {
      gloss: parent("gloss", input.gloss),
      meaning: parent("meaning", input.meaning)
    }
  };
}

export interface FrenchProtectedContent {
  /** Strong/STEP codes literally visible in the English display fields. */
  strongCodes: string[];
  /** Canonical verse starts for mechanically recognized Bible references. */
  references: string[];
  /** Visible spellings, including ranges and resolved reference continuations. */
  referenceLiterals: string[];
  /** Greek and Hebrew forms literally visible in the English display fields. */
  originalTokens: string[];
  /** Numeric literals outside Strong codes and Bible references. */
  numericLiterals: string[];
  /** Source/editorial sigla that must not be translated or silently dropped. */
  sigla: string[];
}

export interface FrenchLegacyEvidence {
  gloss: string;
  meaning: string;
  source: string;
  sourceHash: string;
}

export interface FrenchExistingTranslationEvidence {
  gloss: string;
  meaning: string;
  meaningHtml: string;
  source: string;
  sourceHash: string;
  trust: "untrusted-candidate" | "validated-resource";
}

export interface LexiconV3FrenchPacket {
  schemaVersion: typeof FRENCH_PACKET_SCHEMA_VERSION;
  packetHash: string;
  entryKey: string;
  identity: {
    stepEntryId: number;
    language: "greek" | "hebrew";
    eStrong: string;
    dStrong: string;
    uStrong: string;
    original: string;
    transliteration: string;
    morph: string;
  };
  englishRelease: FrenchPacketEnglishReleaseLineage;
  english: {
    contentHash: string;
    status: "validated" | "human_validated" | "review_needed" | "source_issue";
    gloss: string;
    meaning: string;
    meaningHtml: string;
    sources: string[];
    issues: string[];
  };
  evidence: {
    occurrenceGlosses: Array<{ value: string; count: number; source: string }>;
    concordanceForms: FrenchConcordanceForm[];
    legacy: FrenchLegacyEvidence | null;
    existingFrench: FrenchExistingTranslationEvidence | null;
    resourceFrench: FrenchExistingTranslationEvidence[];
  };
  protectedContent: FrenchProtectedContent;
  createdAt: string;
}

export type FrenchPacketInput = Omit<
  LexiconV3FrenchPacket,
  "schemaVersion" | "packetHash" | "protectedContent" | "createdAt"
> & {
  /**
   * Kept input-compatible with packet-v1 callers. The builder never trusts
   * this value: protected content is deterministically re-extracted from the
   * visible English fields below.
   */
  protectedContent?: Partial<FrenchProtectedContent>;
};

interface BibleBookAlias {
  alias: string;
  canonical: string;
}

const BIBLE_BOOK_ALIASES: BibleBookAlias[] = [
  ["Genesis", "Gen"],
  ["Gen", "Gen"],
  ["Exodus", "Exod"],
  ["Exod", "Exod"],
  ["Exo", "Exod"],
  ["Leviticus", "Lev"],
  ["Lev", "Lev"],
  ["Numbers", "Num"],
  ["Num", "Num"],
  ["Deuteronomy", "Deut"],
  ["Deut", "Deut"],
  ["Deu", "Deut"],
  ["Joshua", "Josh"],
  ["Josh", "Josh"],
  ["Jos", "Josh"],
  ["Judges", "Judg"],
  ["Judg", "Judg"],
  ["Jdg", "Judg"],
  ["Ruth", "Ruth"],
  ["Rut", "Ruth"],
  ["1Samuel", "1Sam"],
  ["1Sam", "1Sam"],
  ["1Sa", "1Sam"],
  ["2Samuel", "2Sam"],
  ["2Sam", "2Sam"],
  ["2Sa", "2Sam"],
  ["1Kings", "1Kgs"],
  ["1Kgs", "1Kgs"],
  ["1Ki", "1Kgs"],
  ["2Kings", "2Kgs"],
  ["2Kgs", "2Kgs"],
  ["2Ki", "2Kgs"],
  // STEP/LXX occasionally carries the historical 3/4 Kings numbering.
  ["3Kings", "3Kgs"],
  ["3Kgs", "3Kgs"],
  ["3Ki", "3Kgs"],
  ["4Kings", "4Kgs"],
  ["4Kgs", "4Kgs"],
  ["4Ki", "4Kgs"],
  ["1Chronicles", "1Chr"],
  ["1Chr", "1Chr"],
  ["1Ch", "1Chr"],
  ["2Chronicles", "2Chr"],
  ["2Chr", "2Chr"],
  ["2Ch", "2Chr"],
  ["Ezra", "Ezra"],
  ["Ezr", "Ezra"],
  ["Nehemiah", "Neh"],
  ["Neh", "Neh"],
  ["Esther", "Esth"],
  ["Esth", "Esth"],
  ["Est", "Esth"],
  ["Job", "Job"],
  ["Psalms", "Ps"],
  ["Psalm", "Ps"],
  ["Psa", "Ps"],
  ["Ps", "Ps"],
  ["Proverbs", "Prov"],
  ["Prov", "Prov"],
  ["Pro", "Prov"],
  ["Ecclesiastes", "Eccl"],
  ["Eccl", "Eccl"],
  ["Ecc", "Eccl"],
  ["SongofSolomon", "Song"],
  ["Song of Solomon", "Song"],
  ["Song", "Song"],
  ["Sng", "Song"],
  ["Isaiah", "Isa"],
  ["Isa", "Isa"],
  ["Jeremiah", "Jer"],
  ["Jer", "Jer"],
  ["Lamentations", "Lam"],
  ["Lam", "Lam"],
  ["Ezekiel", "Ezek"],
  ["Ezek", "Ezek"],
  ["Eze", "Ezek"],
  ["Ezk", "Ezek"],
  ["Daniel", "Dan"],
  ["Dan", "Dan"],
  ["Da TH", "Dan"],
  ["Hosea", "Hos"],
  ["Hos", "Hos"],
  ["Joel", "Joel"],
  ["Jol", "Joel"],
  ["Amos", "Amos"],
  ["Amo", "Amos"],
  ["Obadiah", "Obad"],
  ["Obad", "Obad"],
  ["Oba", "Obad"],
  ["Jonah", "Jonah"],
  ["Jon", "Jonah"],
  ["Micah", "Mic"],
  ["Mic", "Mic"],
  ["Nahum", "Nah"],
  ["Nah", "Nah"],
  ["Habakkuk", "Hab"],
  ["Hab", "Hab"],
  ["Zephaniah", "Zeph"],
  ["Zeph", "Zeph"],
  ["Zep", "Zeph"],
  ["Haggai", "Hag"],
  ["Hag", "Hag"],
  ["Zechariah", "Zech"],
  ["Zech", "Zech"],
  ["Zec", "Zech"],
  ["Malachi", "Mal"],
  ["Mal", "Mal"],
  ["Matthew", "Matt"],
  ["Matt", "Matt"],
  ["Mat", "Matt"],
  ["Mark", "Mark"],
  ["Mrk", "Mark"],
  ["Mk", "Mark"],
  ["Luke", "Luke"],
  ["Luk", "Luke"],
  ["Lk", "Luke"],
  ["John", "John"],
  ["Jhn", "John"],
  ["Jn", "John"],
  ["Acts", "Acts"],
  ["Act", "Acts"],
  ["Romans", "Rom"],
  ["Rom", "Rom"],
  ["1Corinthians", "1Cor"],
  ["1Cor", "1Cor"],
  ["1Co", "1Cor"],
  ["2Corinthians", "2Cor"],
  ["2Cor", "2Cor"],
  ["2Co", "2Cor"],
  ["Galatians", "Gal"],
  ["Gal", "Gal"],
  ["Ephesians", "Eph"],
  ["Eph", "Eph"],
  ["Philippians", "Phil"],
  ["Phil", "Phil"],
  ["Php", "Phil"],
  ["Colossians", "Col"],
  ["Col", "Col"],
  ["1Thessalonians", "1Thess"],
  ["1Thess", "1Thess"],
  ["1Thes", "1Thess"],
  ["1Th", "1Thess"],
  ["2Thessalonians", "2Thess"],
  ["2Thess", "2Thess"],
  ["2Thes", "2Thess"],
  ["2Th", "2Thess"],
  ["1Timothy", "1Tim"],
  ["1Tim", "1Tim"],
  ["1Ti", "1Tim"],
  ["2Timothy", "2Tim"],
  ["2Tim", "2Tim"],
  ["2Ti", "2Tim"],
  ["Titus", "Titus"],
  ["Tit", "Titus"],
  ["Philemon", "Phlm"],
  ["Philem", "Phlm"],
  ["Phlm", "Phlm"],
  ["Phm", "Phlm"],
  ["Hebrews", "Heb"],
  ["Heb", "Heb"],
  ["James", "Jas"],
  ["Jam", "Jas"],
  ["Jas", "Jas"],
  ["1Peter", "1Pet"],
  ["1Pet", "1Pet"],
  ["1Pe", "1Pet"],
  ["2Peter", "2Pet"],
  ["2Pet", "2Pet"],
  ["2Pe", "2Pet"],
  ["1John", "1John"],
  ["1Jn", "1John"],
  ["1Jo", "1John"],
  ["2John", "2John"],
  ["2Jn", "2John"],
  ["2Jo", "2John"],
  ["3John", "3John"],
  ["3Jn", "3John"],
  ["3Jo", "3John"],
  ["Jude", "Jude"],
  ["Jud", "Jude"],
  ["Revelation", "Rev"],
  ["Rev", "Rev"],
  // Deuterocanonical/LXX books occur in the lexical source as evidence too.
  ["Tobit", "Tob"],
  ["Tob", "Tob"],
  ["Judith", "Jdt"],
  ["Jdth", "Jdt"],
  ["Jdt", "Jdt"],
  ["Wisdom", "Wis"],
  ["Wis", "Wis"],
  ["Sirach", "Sir"],
  ["Sir", "Sir"],
  ["Baruch", "Bar"],
  ["Bar", "Bar"],
  ["1Maccabees", "1Macc"],
  ["1Macc", "1Macc"],
  ["1Mac", "1Macc"],
  ["1Ma", "1Macc"],
  ["2Maccabees", "2Macc"],
  ["2Macc", "2Macc"],
  ["2Mac", "2Macc"],
  ["2Ma", "2Macc"],
  ["3Maccabees", "3Macc"],
  ["3Macc", "3Macc"],
  ["3Mac", "3Macc"],
  ["3Ma", "3Macc"],
  ["4Maccabees", "4Macc"],
  ["4Macc", "4Macc"],
  ["4Mac", "4Macc"],
  ["4Ma", "4Macc"]
].map(([alias, canonical]) => ({ alias, canonical }));

const BIBLE_BOOK_BY_ALIAS = new Map(
  BIBLE_BOOK_ALIASES.map(({ alias, canonical }) => [
    compactBookAlias(alias).toLowerCase(),
    canonical
  ])
);
const BIBLE_BOOK_PATTERN = [
  ...new Set(BIBLE_BOOK_ALIASES.map(({ alias }) => alias))
]
  .sort(
    (left, right) => right.length - left.length || left.localeCompare(right)
  )
  .map(bookAliasPattern)
  .join("|");
const BIBLE_REFERENCE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:NT\\.\\s*)?(${BIBLE_BOOK_PATTERN})\\s*\\.?\\s*(\\d{1,3})\\s*[:.]\\s*(\\d{1,3})(?:\\s*[-–—]\\s*(\\d{1,3})(?:\\s*[:.]\\s*(\\d{1,3}))?)?`,
  "giu"
);
const REFERENCE_CONTINUATION_PATTERN =
  /^(?:\s*[,;]\s*|\s+)(\d{1,3})\s*[:.]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?/u;
const VERSE_CONTINUATION_PATTERN =
  /^\s*[,;]\s*(\d{1,3})(?!\d)(?!\s*[:.]\s*\d)/u;
const IBID_REFERENCE_PATTERN =
  /(?<![\p{L}\p{N}])ib[.]\s*(?:(\d{1,3})\s*[:.]\s*)?(\d{1,3})(?!\d)/giu;
const BIBLE_CHAPTER_REFERENCE_PATTERN = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:NT\\.\\s*)?(${BIBLE_BOOK_PATTERN})\\s*\\.?\\s*(\\d{1,3})(?!\\s*[:.]\\s*\\d)`,
  "giu"
);
const STRONG_CODE_PATTERN =
  /(?<![\p{L}\p{N}])[GH]\d{1,5}[A-Za-z]?(?:_[A-Za-z])?(?![\p{L}\p{N}])/gu;
const ORIGINAL_SCRIPT_PATTERN =
  /[\p{Script=Greek}\p{Script=Hebrew}][\p{Script=Greek}\p{Script=Hebrew}\p{Mark}]*/gu;
const NUMERIC_LITERAL_PATTERN =
  /(?<![\p{L}\p{N}])(?:\d+\s*[/⁄]\s*\d+|\d+\s*[-–—]\s*\d+|\d{1,3}(?:[,\u202f ]\d{3})+(?:[.]\d+)?|\d+(?:[.,]\d+)?)(?![\p{L}\p{N}])/gu;
const SIGLUM_PATTERN =
  /(?<![\p{L}\p{N}])(?:[A-Z][A-Z0-9]{1,19}|(?:[A-Z][.]){2,8})(?![\p{L}\p{N}])/gu;
const TRANSLATABLE_UPPERCASE_WORDS = new Set([
  "ACT",
  "ACTION",
  "AD",
  "ANIMAL",
  "ANIMALS",
  "BE",
  "BC",
  "DANGER",
  "DESCRIPTOR",
  "GOD",
  "HE",
  "JESUS",
  "LIVING",
  "LORD",
  "OBJECT",
  "OBJECTS",
  "PEOPLE",
  "PERSON",
  "PLANTS",
  "QUESTION",
  "SON",
  "THING",
  "THINGS",
  "TIME",
  "WE",
  "WEAPON",
  "YEARS"
]);

export function buildFrenchPacket(
  input: FrenchPacketInput,
  createdAt = new Date().toISOString()
): LexiconV3FrenchPacket {
  const {
    protectedContent: _untrustedProtectedContent,
    english: untrustedEnglish,
    ...trustedInput
  } = input;
  void _untrustedProtectedContent;
  const { contentHash: _untrustedEnglishHash, ...englishContent } =
    untrustedEnglish;
  void _untrustedEnglishHash;
  const english = {
    contentHash: frenchPacketEnglishContentHash(
      input.entryKey,
      input.englishRelease,
      englishContent
    ),
    ...englishContent
  };
  const content = {
    schemaVersion: FRENCH_PACKET_SCHEMA_VERSION,
    ...trustedInput,
    english,
    protectedContent: extractFrenchProtectedContent(english)
  };
  return {
    ...content,
    packetHash: frenchPacketHash(content),
    createdAt
  };
}

export function frenchPacketEnglishContentHash(
  entryKey: string,
  release: FrenchPacketEnglishReleaseLineage,
  english: Omit<LexiconV3FrenchPacket["english"], "contentHash">
): string {
  return createHash("sha256")
    .update(
      canonicalJson({
        schemaVersion: "lexicon-v3-french-packet-english@2",
        entryKey,
        release,
        english
      })
    )
    .digest("hex");
}

export function frenchPacketHash(
  packet: Omit<LexiconV3FrenchPacket, "packetHash" | "createdAt">
): string {
  return createHash("sha256").update(canonicalJson(packet)).digest("hex");
}

export function validateFrenchPacket(packet: LexiconV3FrenchPacket): string[] {
  const issues: string[] = [];
  if (packet.schemaVersion !== FRENCH_PACKET_SCHEMA_VERSION) {
    issues.push("invalid-packet-schema");
  }
  if (!packet.entryKey || !packet.english.contentHash) {
    issues.push("missing-packet-identity");
  }
  validateEnglishReleaseLineage(packet, issues);
  const { contentHash: _englishHash, ...englishContent } = packet.english;
  void _englishHash;
  if (
    frenchPacketEnglishContentHash(
      packet.entryKey,
      packet.englishRelease,
      englishContent
    ) !== packet.english.contentHash
  ) {
    issues.push("english-content-hash-mismatch");
  }
  const { packetHash, createdAt: _createdAt, ...content } = packet;
  void _createdAt;
  if (frenchPacketHash(content) !== packetHash) {
    issues.push("packet-hash-mismatch");
  }
  if (
    packet.english.status !== "source_issue" &&
    (!packet.english.gloss || !packet.english.meaning)
  ) {
    issues.push("missing-english-content");
  }
  if (
    packet.identity.language !== "greek" &&
    packet.identity.language !== "hebrew"
  ) {
    issues.push("invalid-entry-language");
  }
  const expectedProtectedContent = extractFrenchProtectedContent(
    packet.english
  );
  if (!isFrenchProtectedContent(packet.protectedContent)) {
    issues.push("invalid-protected-content");
  } else if (
    canonicalJson(packet.protectedContent) !==
    canonicalJson(expectedProtectedContent)
  ) {
    issues.push("protected-content-mismatch");
  }
  return issues;
}

function validateEnglishReleaseLineage(
  packet: LexiconV3FrenchPacket,
  issues: string[]
): void {
  const release = packet.englishRelease;
  if (
    !release?.releaseKey?.trim() ||
    !/^[a-f0-9]{64}$/u.test(release.releaseSnapshotFingerprint ?? "")
  ) {
    issues.push("invalid-english-release");
    return;
  }
  const parents = [release.parents?.gloss, release.parents?.meaning] as const;
  if (parents.some((parent) => !parent)) {
    issues.push("missing-english-parent");
    return;
  }
  for (const [field, parent] of [
    ["gloss", release.parents.gloss],
    ["meaning", release.parents.meaning]
  ] as const) {
    const valueText =
      field === "gloss" ? packet.english.gloss : packet.english.meaning;
    const valueHtml =
      field === "gloss" || parent.valueHtmlHash === null
        ? null
        : packet.english.meaningHtml;
    if (
      parent.entryKey !== packet.entryKey ||
      parent.field !== field ||
      !Number.isInteger(parent.fieldVersionId) ||
      parent.fieldVersionId < 1 ||
      !/^[a-f0-9]{64}$/u.test(parent.contentHash) ||
      !/^[a-f0-9]{64}$/u.test(parent.valueTextHash) ||
      (parent.valueHtmlHash !== null &&
        !/^[a-f0-9]{64}$/u.test(parent.valueHtmlHash)) ||
      !["auto_validated", "human_validated"].includes(parent.state) ||
      !parent.method.trim() ||
      !parent.generator.trim()
    ) {
      issues.push(`invalid-english-parent:${field}`);
      continue;
    }
    if (
      sha256(valueText) !== parent.valueTextHash ||
      (valueHtml === null ? null : sha256(valueHtml)) !==
        parent.valueHtmlHash ||
      (field === "meaning" &&
        parent.valueHtmlHash === null &&
        packet.english.meaningHtml !== packet.english.meaning) ||
      lexiconV3FieldContentHash({
        entryKey: packet.entryKey,
        locale: "en",
        field,
        valueText,
        valueHtml,
        derivedFromVersionId: null
      }) !== parent.contentHash
    ) {
      issues.push(`english-parent-content-mismatch:${field}`);
    }
  }
}

/**
 * Extracts only content that is visibly present in gloss/meaning/meaningHtml.
 * It deliberately does not copy packet identity metadata into the definition.
 */
export function extractFrenchProtectedContent(
  english: Pick<
    LexiconV3FrenchPacket["english"],
    "gloss" | "meaning" | "meaningHtml"
  >
): FrenchProtectedContent {
  const visibleTexts = uniqueSorted(
    [english.gloss, english.meaning, stripLexiconHtml(english.meaningHtml)]
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const strongCodes = new Set<string>();
  const references = new Set<string>();
  const referenceLiterals = new Set<string>();
  const originalTokens = new Set<string>();
  const numericLiterals = new Set<string>();
  const sigla = new Set<string>();

  for (const visible of visibleTexts) {
    const maskedRanges: Array<[number, number]> = [];
    // Resolve explicit references before their shorthand continuations. This
    // prevents `, 1 Cor 14:5` from being read as verse 1 of the preceding
    // book, while preserving the real verse 26 in `Luk.2:11, 26 Jhn.1:41`.
    // The full numeric boundary above also prevents RegExp backtracking from
    // silently turning that `26` into the spurious verse `2`.
    const explicitReferenceMatches = [
      ...visible.matchAll(BIBLE_REFERENCE_PATTERN)
    ];
    const explicitReferenceRanges = explicitReferenceMatches.map(
      (match): [number, number] => [match.index, match.index + match[0].length]
    );
    const referenceAnchors: Array<{
      index: number;
      canonicalBook: string;
      chapter: number;
    }> = [];
    for (const match of visible.matchAll(STRONG_CODE_PATTERN)) {
      strongCodes.add(match[0]);
      maskedRanges.push([match.index, match.index + match[0].length]);
    }
    for (const match of explicitReferenceMatches) {
      const alias = compactBookAlias(match[1] ?? "").toLowerCase();
      const canonicalBook = canonicalBookForAlias(alias);
      const chapter = Number(match[2]);
      const verse = Number(match[3]);
      if (!canonicalBook || chapter < 1 || verse < 1) continue;
      references.add(`${canonicalBook}.${chapter}.${verse}`);
      referenceLiterals.add(normalizeReferenceLiteral(match[0]));
      maskedRanges.push([match.index, match.index + match[0].length]);
      referenceAnchors.push({ index: match.index, canonicalBook, chapter });

      let cursor = match.index + match[0].length;
      let remainder = visible.slice(cursor);
      let activeChapter = chapter;
      while (true) {
        const continuation = REFERENCE_CONTINUATION_PATTERN.exec(remainder);
        const verseContinuation = VERSE_CONTINUATION_PATTERN.exec(remainder);
        if (!continuation && !verseContinuation) break;
        let continuationLength: number;
        if (continuation) {
          const continuedChapter = Number(continuation[1]);
          const continuedVerse = Number(continuation[2]);
          if (continuedChapter < 1 || continuedVerse < 1) break;
          activeChapter = continuedChapter;
          references.add(
            `${canonicalBook}.${continuedChapter}.${continuedVerse}`
          );
          referenceLiterals.add(
            normalizeReferenceLiteral(
              continuation[0].replace(/^\s*[,;]\s*/u, "")
            )
          );
          continuationLength = continuation[0].length;
        } else {
          const continuedVerse = Number(verseContinuation?.[1]);
          if (continuedVerse < 1) break;
          const verseContinuationLength = verseContinuation?.[0].length ?? 0;
          const afterVerseContinuation = remainder.slice(
            verseContinuationLength
          );
          if (
            continuedVerse <= 4 &&
            /^\s*\p{L}/u.test(afterVerseContinuation)
          ) {
            break;
          }
          if (
            rangeOverlaps(
              explicitReferenceRanges,
              cursor,
              cursor + verseContinuationLength
            )
          ) {
            break;
          }
          references.add(`${canonicalBook}.${activeChapter}.${continuedVerse}`);
          referenceLiterals.add(String(continuedVerse));
          continuationLength = verseContinuationLength;
        }
        maskedRanges.push([cursor, cursor + continuationLength]);
        referenceAnchors.push({
          index: cursor,
          canonicalBook,
          chapter: activeChapter
        });
        cursor += continuationLength;
        remainder = visible.slice(cursor);
      }
    }

    for (const match of visible.matchAll(IBID_REFERENCE_PATTERN)) {
      const prior = referenceAnchors
        .filter(
          (anchor) =>
            anchor.index < match.index && match.index - anchor.index <= 160
        )
        .at(-1);
      if (!prior) continue;
      const chapter = match[1] ? Number(match[1]) : prior.chapter;
      const verse = Number(match[2]);
      if (chapter < 1 || verse < 1) continue;
      references.add(`${prior.canonicalBook}.${chapter}.${verse}`);
      referenceLiterals.add(normalizeReferenceLiteral(match[0]));
      maskedRanges.push([match.index, match.index + match[0].length]);
    }

    for (const match of visible.matchAll(BIBLE_CHAPTER_REFERENCE_PATTERN)) {
      if (
        rangeOverlaps(maskedRanges, match.index, match.index + match[0].length)
      ) {
        continue;
      }
      const canonicalBook = canonicalBookForAlias(
        compactBookAlias(match[1] ?? "").toLowerCase()
      );
      const chapter = Number(match[2]);
      if (!canonicalBook || chapter < 1) continue;
      referenceLiterals.add(normalizeReferenceLiteral(match[0]));
      maskedRanges.push([match.index, match.index + match[0].length]);
    }

    const masked = maskTextRanges(visible, maskedRanges);
    for (const token of masked.match(ORIGINAL_SCRIPT_PATTERN) ?? []) {
      originalTokens.add(token);
    }

    for (const literal of masked.match(NUMERIC_LITERAL_PATTERN) ?? []) {
      numericLiterals.add(normalizeNumericLiteral(literal));
    }
    for (const candidate of masked.match(SIGLUM_PATTERN) ?? []) {
      const siglum = candidate.replace(/[.]$/u, "");
      const undotted = siglum.replace(/[.]/gu, "");
      if (
        !TRANSLATABLE_UPPERCASE_WORDS.has(siglum) &&
        !TRANSLATABLE_UPPERCASE_WORDS.has(undotted)
      ) {
        sigla.add(siglum);
      }
    }
  }

  return {
    strongCodes: [...strongCodes].sort(),
    references: [...references].sort(),
    referenceLiterals: [...referenceLiterals].sort(),
    originalTokens: [...originalTokens].sort(),
    numericLiterals: [...numericLiterals].sort(),
    sigla: [...sigla].sort()
  };
}

function isFrenchProtectedContent(
  value: unknown
): value is FrenchProtectedContent {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const record = value as Record<string, unknown>;
  const expectedKeys = [
    "numericLiterals",
    "originalTokens",
    "referenceLiterals",
    "references",
    "sigla",
    "strongCodes"
  ];
  if (
    canonicalJson(Object.keys(record).sort()) !== canonicalJson(expectedKeys)
  ) {
    return false;
  }
  return expectedKeys.every((key) => isCanonicalStringArray(record[key]));
}

function isCanonicalStringArray(value: unknown): value is string[] {
  return (
    Array.isArray(value) &&
    value.every((item) => typeof item === "string" && item.length > 0) &&
    canonicalJson(value) === canonicalJson(uniqueSorted(value))
  );
}

function maskTextRanges(
  value: string,
  ranges: Array<[number, number]>
): string {
  // Match indexes are UTF-16 offsets. Replacing code units rather than code
  // points preserves those offsets.
  const units = value.split("");
  for (const [start, end] of ranges) {
    for (let index = start; index < end; index += 1) units[index] = " ";
  }
  return units.join("");
}

function normalizeReferenceLiteral(value: string): string {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function normalizeNumericLiteral(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\u202f/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function compactBookAlias(value: string): string {
  return value.replace(/[.\s]/gu, "");
}

function canonicalBookForAlias(compactAlias: string): string | undefined {
  const direct = BIBLE_BOOK_BY_ALIAS.get(compactAlias);
  if (direct) return direct;
  const roman = /^(iv|iii|ii|i|ιιι|ιι|ι)([a-z].*)$/iu.exec(compactAlias);
  if (!roman) return undefined;
  const number = new Map([
    ["i", "1"],
    ["ii", "2"],
    ["iii", "3"],
    ["iv", "4"],
    ["ι", "1"],
    ["ιι", "2"],
    ["ιιι", "3"]
  ]).get((roman[1] ?? "").toLowerCase());
  return number
    ? BIBLE_BOOK_BY_ALIAS.get(`${number}${roman[2] ?? ""}`)
    : undefined;
}

function bookAliasPattern(value: string): string {
  return value
    .split(/(\d+|\s+)/u)
    .filter(Boolean)
    .map((part) => {
      if (/^\s+$/u.test(part)) return "\\s*";
      if (/^\d+$/u.test(part)) {
        const roman = new Map([
          ["1", "I|Ι"],
          ["2", "II|ΙΙ"],
          ["3", "III|ΙΙΙ"],
          ["4", "IV"]
        ]).get(part);
        return `(?:${part}${roman ? `|${roman}` : ""})\\s*`;
      }
      return part.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
    })
    .join("");
}

function rangeOverlaps(
  ranges: Array<[number, number]>,
  start: number,
  end: number
): boolean {
  return ranges.some(
    ([rangeStart, rangeEnd]) => start < rangeEnd && end > rangeStart
  );
}

function uniqueSorted(values: readonly string[]): string[] {
  return [...new Set(values)].sort();
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
