export interface EnglishMeaningContaminationEntry {
  key: string;
  language: string;
  meaning: string;
}

export interface EnglishForeignFullMeaningSuffix {
  ownerKey: string;
  foreignKey: string;
  language: string;
  suffixOffset: number;
  prefixLength: number;
  suffixLength: number;
}

export interface EnglishMeaningContaminationOptions {
  minPrefixLength?: number;
  minSuffixLength?: number;
}

const DEFAULT_MIN_PREFIX_LENGTH = 128;
const DEFAULT_MIN_SUFFIX_LENGTH = 256;

/**
 * Finds a high-confidence contamination shape: a notice has a substantial
 * prefix and then ends with the complete, byte-exact HTML notice of another
 * entry in the same language. The target-row identity is independent of the
 * candidate and no lexical or fuzzy similarity is used.
 */
export function findForeignFullMeaningSuffixes(
  entries: readonly EnglishMeaningContaminationEntry[],
  options: EnglishMeaningContaminationOptions = {}
): EnglishForeignFullMeaningSuffix[] {
  const minPrefixLength = options.minPrefixLength ?? DEFAULT_MIN_PREFIX_LENGTH;
  const minSuffixLength = options.minSuffixLength ?? DEFAULT_MIN_SUFFIX_LENGTH;
  if (
    !Number.isSafeInteger(minPrefixLength) ||
    !Number.isSafeInteger(minSuffixLength) ||
    minPrefixLength < 1 ||
    minSuffixLength < 1
  ) {
    throw new Error("english-meaning-contamination-invalid-thresholds");
  }

  const exactOwnersByMeaning = new Map<
    string,
    EnglishMeaningContaminationEntry[]
  >();
  const normalizedEntries = entries.map((entry) => ({
    ...entry,
    meaning: entry.meaning.trim()
  }));
  for (const entry of normalizedEntries) {
    if (
      entry.meaning.length < minSuffixLength ||
      !entry.meaning.startsWith("<b>")
    ) {
      continue;
    }
    const owners = exactOwnersByMeaning.get(entry.meaning) ?? [];
    owners.push(entry);
    exactOwnersByMeaning.set(entry.meaning, owners);
  }

  const findings: EnglishForeignFullMeaningSuffix[] = [];
  const seen = new Set<string>();
  for (const candidate of normalizedEntries) {
    let offset = candidate.meaning.indexOf("<b>", minPrefixLength);
    while (offset !== -1) {
      const suffix = candidate.meaning.slice(offset);
      const foreignOwners = exactOwnersByMeaning.get(suffix) ?? [];
      for (const foreign of foreignOwners) {
        if (
          foreign.key === candidate.key ||
          foreign.language !== candidate.language
        ) {
          continue;
        }
        const findingKey = `${candidate.key}\u0000${foreign.key}\u0000${offset}`;
        if (seen.has(findingKey)) continue;
        seen.add(findingKey);
        findings.push({
          ownerKey: candidate.key,
          foreignKey: foreign.key,
          language: candidate.language,
          suffixOffset: offset,
          prefixLength: offset,
          suffixLength: suffix.length
        });
      }
      offset = candidate.meaning.indexOf("<b>", offset + 3);
    }
  }
  return findings.sort(
    (left, right) =>
      left.ownerKey.localeCompare(right.ownerKey) ||
      left.foreignKey.localeCompare(right.foreignKey) ||
      left.suffixOffset - right.suffixOffset
  );
}

export function assertNoForeignFullMeaningSuffixes(
  entries: readonly EnglishMeaningContaminationEntry[],
  options: EnglishMeaningContaminationOptions = {}
): void {
  const findings = findForeignFullMeaningSuffixes(entries, options);
  if (findings.length === 0) return;
  throw new Error(
    `english-meaning-foreign-full-suffix:${findings
      .map(
        (finding) =>
          `${finding.ownerKey}->${finding.foreignKey}@${finding.suffixOffset}`
      )
      .join(",")}`
  );
}
