/** Independent lexical evidence for an already aligned expression slot. */
import { createRequire } from "node:module";
import type { CanonicalOccurrenceDecision } from "./strongCanonicalResolution.js";
import type { FrenchInflectionIndex } from "./strongInflectionEvidence.js";
import type { SourceRow } from "./strongSourceUnits.js";
import type { ClauseLexicalProof } from "./strongClauseAlignment.js";
import { isUnsafeRecoverySurface } from "./strongWitnessRecovery.js";
import { isConcordanceFunctionWord } from "./strongConcordanceContext.js";

type Pos = "verb" | "noun" | "adj";
export interface SemanticLinks {
  schemaVersion: number;
  openOffice: Record<
    string,
    Array<{ rawPartOfSpeech: string; terms: string[] }>
  >;
  wolf: Array<{
    id: string;
    partOfSpeech: string;
    definition: string;
    terms: Array<{
      text: string;
      reviewedInDictionary: boolean;
      provenance: string;
    }>;
  }>;
}
export interface MeaningBridge {
  schemaVersion: number;
  stepSenses: Record<
    string,
    Array<{
      identity: string;
      classicalStrong: string;
      rootIdentity: string;
      partOfSpeech: string;
      gloss: string;
      meaning: string;
      sourceFile: string;
      sourceLine: number;
    }>
  >;
  frenchMeanings: Record<
    string,
    Array<{
      partOfSpeech: Pos;
      senses: Array<{ id?: string; glosses: string[]; tags: string[] }>;
    }>
  >;
}
export type ClauseLexicalLevel =
  "literal" | "inflection" | "reviewed" | "reciprocal" | "meaning";
const rank: Record<ClauseLexicalLevel, number> = {
  literal: 0,
  inflection: 1,
  reviewed: 2,
  reciprocal: 3,
  meaning: 4
};
const norm = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/[‐‑‒–—]/gu, "-");
const base = (s: string) => norm(s).replace(/^(?:c|d|j|l|m|n|qu|s|t)'/u, "");
const positions = ["verb", "noun", "adj"] as const;
const englishStop = new Set(
  "a an the to and or of at in on into out from for with by he she it they we you i me him her them us my your his its our their this that these those is are was were be been being have has had do does did make made give gave go went come came take took get got put one something someone person thing not only than very all as also then more most some whom which who will would can could may might shall should must about through".split(
    " "
  )
);
const require = createRequire(import.meta.url);
const lemmaEn = require("wink-lemmatizer") as {
  verb(s: string): string;
  noun(s: string): string;
  adjective(s: string): string;
};
function english(text: string): Set<string> {
  return new Set(
    (text.toLowerCase().match(/[a-z]{3,}/gu) ?? [])
      .map((w) => lemmaEn.verb(lemmaEn.noun(w)))
      .filter((w) => !englishStop.has(w))
  );
}
const morphPos = (s: string): Pos | undefined => {
  const p = s.startsWith("H")
    ? (s
        .slice(1)
        .split("/")
        .filter((x) => !x.startsWith("S"))
        .at(-1) ?? "")
    : s;
  return p.startsWith("V")
    ? "verb"
    : p.startsWith("N")
      ? "noun"
      : p.startsWith("A")
        ? "adj"
        : undefined;
};

export function createClauseLexicon(options: {
  inflections: FrenchInflectionIndex;
  semantics: SemanticLinks;
  meanings: MeaningBridge;
}) {
  const reviewed = new Map<string, Set<string>>();
  for (const sense of options.semantics.wolf) {
    const pos =
      sense.partOfSpeech === "v"
        ? "verb"
        : sense.partOfSpeech === "n"
          ? "noun"
          : ["a", "s"].includes(sense.partOfSpeech)
            ? "adj"
            : undefined;
    if (!pos) continue;
    for (const word of sense.terms.filter((t) => t.reviewedInDictionary)) {
      const key = `${pos}:${norm(word.text)}`,
        ids = reviewed.get(key) ?? new Set<string>();
      ids.add(sense.id);
      reviewed.set(key, ids);
    }
  }
  const cache = new Map<string, ClauseLexicalProof | undefined>();
  function phraseForms(words: string[], pos: Pos): string[] {
    const literal = words.map(base),
      lemmas = literal.map((w, i) => {
        const preferred = options.inflections[w]?.[i === 0 ? pos : "noun"];
        if (preferred?.length === 1) return preferred[0];
        const all = [
          ...new Set(
            positions.flatMap((p) => options.inflections[w]?.[p] ?? [])
          )
        ];
        return all.length === 1 ? all[0] : w;
      });
    return [...new Set([literal.join(" "), lemmas.join(" ")])];
  }
  function reciprocal(a: string, b: string, pos: Pos) {
    const label =
      pos === "verb" ? "Verbe" : pos === "noun" ? "Nom" : "Adjectif";
    const edge = (from: string, to: string) =>
      options.semantics.openOffice[from]?.some(
        (g) => g.rawPartOfSpeech.includes(label) && g.terms.includes(to)
      );
    return edge(a, b) && edge(b, a);
  }
  return (
    unit: CanonicalOccurrenceDecision,
    target: string[],
    witness: string[],
    level: ClauseLexicalLevel,
    sourceRow?: SourceRow
  ): ClauseLexicalProof | undefined => {
    const key = JSON.stringify([
      unit.sourceUnitId,
      unit.source.morphology,
      unit.source.gloss,
      sourceRow?.id,
      sourceRow?.primary,
      sourceRow?.evidence.expanded,
      target,
      witness,
      level
    ]);
    if (cache.has(key)) return cache.get(key);
    const remember = (p: ClauseLexicalProof | undefined) => {
      cache.set(key, p);
      return p;
    };
    const declaredPos = morphPos(unit.source.morphology);
    if (
      declaredPos &&
      target.length === 1 &&
      isConcordanceFunctionWord(target[0]) &&
      options.inflections[base(target[0])]?.[declaredPos]?.length !== 1
    )
      return remember(undefined);
    if (
      target.length === witness.length &&
      target.every((w, i) => norm(w) === norm(witness[i]))
    )
      return remember({
        kind: "literal",
        sourceTerms: witness,
        targetTerms: target,
        provenance: ["identical-witnessed-expression"]
      });
    if (rank[level] === 0) return remember(undefined);
    // Use the source POS as a conservative restriction for nonliteral semantic
    // bridging. Literal whole-expression matches need no invented POS decision.
    const pos = morphPos(unit.source.morphology);
    if (!pos || /Np/u.test(unit.source.morphology)) return remember(undefined);
    const ts = phraseForms(target, pos),
      ws = phraseForms(witness, pos);
    if (
      ts.some((t) => ws.includes(t)) &&
      target.some((w) => !isUnsafeRecoverySurface(w))
    )
      return remember({
        kind: "inflection",
        sourceTerms: ws,
        targetTerms: ts,
        provenance: ["explicit-kaikki-inflection"]
      });
    if (rank[level] >= 2)
      for (const t of ts)
        for (const w of ws) {
          const a = reviewed.get(`${pos}:${t}`),
            b = reviewed.get(`${pos}:${w}`);
          const shared = [...(a ?? [])].filter((id) => b?.has(id));
          if (shared.length)
            return remember({
              kind: "reviewed-synset",
              sourceTerms: [w],
              targetTerms: [t],
              provenance: shared
            });
        }
    if (level === "reciprocal")
      for (const t of ts)
        for (const w of ws)
          if (
            !isUnsafeRecoverySurface(t) &&
            !isUnsafeRecoverySurface(w) &&
            reciprocal(t, w, pos)
          )
            return remember({
              kind: "reciprocal-synonym",
              sourceTerms: [w],
              targetTerms: [t],
              provenance: ["openoffice-direct-reciprocal-link-not-transitive"]
            });
    if (
      level !== "meaning" ||
      !sourceRow ||
      sourceRow.id !== unit.sourceUnitId ||
      sourceRow.primary.length !== 1
    )
      return remember(undefined);
    const identities = options.meanings.stepSenses[sourceRow.primary[0]] ?? [];
    if (identities.length !== 1) return remember(undefined);
    const entry = identities[0];
    const expanded = [
      ...sourceRow.evidence.expanded.matchAll(/»([^}]+)/gu)
    ].map((m) => m[1].split(":").at(-1)!.replaceAll("_", " "));
    const descriptions = [
      unit.source.gloss,
      entry.gloss.includes(":")
        ? entry.gloss.split(":").slice(1).join(":")
        : entry.gloss,
      ...expanded
    ];
    for (const t of ts)
      for (const article of options.meanings.frenchMeanings[t] ?? []) {
        if (article.partOfSpeech !== pos) continue;
        for (const sense of article.senses)
          for (const definition of sense.glosses) {
            if (/^see\b/iu.test(definition)) continue;
            const dt = english(definition);
            for (const source of descriptions) {
              if (
                /\b(?:not|without|lack)\b/iu.test(source) !==
                /\b(?:not|without|lack)\b/iu.test(definition)
              )
                continue;
              const st = english(source),
                shared = [...st].filter((w) => dt.has(w));
              const direct =
                st.size === 1 &&
                shared.length === 1 &&
                !/\b(?:not|without|lack)\b/iu.test(source) &&
                !/\b(?:not|without|lack)\b/iu.test(definition) &&
                new RegExp(
                  `^(?:to |a |an |the )?${shared[0]}(?:[ ,;(]|$)`,
                  "iu"
                ).test(definition);
              if (shared.length >= 2 || direct)
                return remember({
                  kind: "source-definition",
                  sourceTerms: [source],
                  targetTerms: [t, definition],
                  provenance: [
                    entry.identity,
                    `${entry.sourceFile}:${entry.sourceLine}`,
                    sense.id ?? "kaikki-sense",
                    `shared:${shared.sort().join(",")}`
                  ]
                });
            }
          }
      }
    return remember(undefined);
  };
}
