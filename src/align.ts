import { tokenizeText, type TextSegment } from "./tokenize.js";
import { type StrongToken, type StrongVerse } from "./strongCsv.js";

export interface ReferenceSource {
  name: string;
  verse?: StrongVerse;
}

export interface StrongLexiconEntry {
  strong: string[];
  confidence: number;
  source: string;
}

export interface StrongLexicon {
  exact: Map<string, StrongLexiconEntry>;
  stem: Map<string, StrongLexiconEntry>;
}

export interface AssignedStrong {
  strong: string[];
  confidence: number;
  source: string;
  method: "exact" | "stem" | "window" | "lexicon";
}

export interface AlignmentResult {
  segments: TextSegment[];
  assignments: Map<number, AssignedStrong>;
  wordCount: number;
  taggedWordCount: number;
  lowConfidenceWordCount: number;
}

interface Candidate {
  strong: string[];
  score: number;
  source: string;
  method: AssignedStrong["method"];
}

const LOW_CONFIDENCE_THRESHOLD = 0.55;

export function alignVerse(
  targetText: string,
  references: ReferenceSource[],
  lexicon?: StrongLexicon
): AlignmentResult {
  const segments = tokenizeText(targetText);
  const assignments = new Map<number, AssignedStrong>();
  let wordIndex = -1;

  for (const segment of segments) {
    if (segment.kind !== "word") {
      continue;
    }

    wordIndex += 1;
    const candidates: Candidate[] = [];

    for (const reference of references) {
      if (!reference.verse) {
        continue;
      }

      const candidate = findCandidate(segment.normalized, reference);

      if (candidate) {
        candidates.push(candidate);
      }
    }

    const chosen = chooseCandidate(candidates);

    if (chosen) {
      assignments.set(wordIndex, {
        strong: chosen.strong,
        confidence: chosen.score,
        source: chosen.source,
        method: chosen.method
      });
      continue;
    }

    const lexiconCandidate = findLexiconCandidate(segment.normalized, lexicon);

    if (lexiconCandidate) {
      assignments.set(wordIndex, {
        strong: lexiconCandidate.strong,
        confidence: lexiconCandidate.confidence,
        source: lexiconCandidate.source,
        method: "lexicon"
      });
    }
  }

  const wordCount = segments.filter(
    (segment) => segment.kind === "word"
  ).length;
  const taggedWordCount = assignments.size;
  const lowConfidenceWordCount = [...assignments.values()].filter(
    (assignment) => assignment.confidence < LOW_CONFIDENCE_THRESHOLD
  ).length;

  return {
    segments,
    assignments,
    wordCount,
    taggedWordCount,
    lowConfidenceWordCount
  };
}

function findCandidate(
  normalizedWord: string,
  reference: ReferenceSource
): Candidate | undefined {
  const tokens = reference.verse?.tokens ?? [];
  const exact = tokens.find(
    (token) => token.strong.length > 0 && token.normalized === normalizedWord
  );

  if (exact) {
    return {
      strong: exact.strong,
      score: 0.95,
      source: reference.name,
      method: "exact"
    };
  }

  const stem = stemWord(normalizedWord);
  if (stem.length >= 4) {
    const stemMatches = tokens.filter(
      (token) =>
        token.strong.length > 0 &&
        stemWord(token.normalized).length >= 4 &&
        stemWord(token.normalized) === stem
    );

    if (stemMatches.length > 0) {
      return {
        strong: mostCommonStrong(stemMatches),
        score: 0.72,
        source: reference.name,
        method: "stem"
      };
    }
  }

  const windowMatch = tokens.find(
    (token) =>
      token.strong.length > 0 &&
      token.normalized.length >= 5 &&
      normalizedWord.length >= 5 &&
      (token.normalized.startsWith(stem) ||
        normalizedWord.startsWith(stemWord(token.normalized)))
  );

  if (windowMatch) {
    return {
      strong: windowMatch.strong,
      score: 0.48,
      source: reference.name,
      method: "window"
    };
  }

  return undefined;
}

function findLexiconCandidate(
  normalizedWord: string,
  lexicon?: StrongLexicon
): StrongLexiconEntry | undefined {
  if (!lexicon) {
    return undefined;
  }

  const exact = lexicon.exact.get(normalizedWord);
  if (exact) {
    return exact;
  }

  const stem = stemWord(normalizedWord);
  if (stem.length >= 5) {
    return lexicon.stem.get(stem);
  }

  return undefined;
}

function chooseCandidate(candidates: Candidate[]): Candidate | undefined {
  if (candidates.length === 0) {
    return undefined;
  }

  const byStrong = new Map<string, Candidate[]>();

  for (const candidate of candidates) {
    const key = candidate.strong.join(" ");
    const existing = byStrong.get(key) ?? [];
    existing.push(candidate);
    byStrong.set(key, existing);
  }

  const agreed = [...byStrong.values()]
    .map((group) => ({
      group,
      score:
        Math.max(...group.map((candidate) => candidate.score)) +
        Math.min(0.2, (group.length - 1) * 0.1)
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!agreed) {
    return undefined;
  }

  const best = agreed.group.sort((a, b) => b.score - a.score)[0];

  return {
    ...best,
    score: Math.min(0.99, agreed.score),
    source: agreed.group.map((candidate) => candidate.source).join("+")
  };
}

function mostCommonStrong(tokens: StrongToken[]): string[] {
  const counts = new Map<string, { strong: string[]; count: number }>();

  for (const token of tokens) {
    const key = token.strong.join(" ");
    const existing = counts.get(key);

    if (existing) {
      existing.count += 1;
    } else {
      counts.set(key, { strong: token.strong, count: 1 });
    }
  }

  return (
    [...counts.values()].sort((a, b) => b.count - a.count)[0]?.strong ?? []
  );
}

export function stemWord(word: string): string {
  return word
    .replace(
      /(?:ements|ement|ations|ation|ateur|atrice|iques|ique|ites|ite)$/u,
      ""
    )
    .replace(/(?:eront|erais|erait|aient|asses|ions|iez|ees|ee|es|s)$/u, "");
}
