/** Conservative relation checks using allowed witnesses only; no target labels. */
import { normalizeWord, tokenizeText } from "./tokenize.js";
import type {
  ReconstructionVerse,
  ReconstructionWitness,
  ReconstructionPlacement
} from "./strongConcordanceRefinement.js";
export const CONCORDANCE_CONTEXT_POLICY = "witness-context-v1";
export interface ContextPolicy {
  lightVerbs: boolean;
  localContext: boolean;
  measuredGroups: boolean;
}
export const DEFAULT_CONTEXT_POLICY: ContextPolicy = {
  lightVerbs: true,
  localContext: true,
  measuredGroups: true
};
export interface ContextChange {
  rule:
    | "light-verb-relation"
    | "exact-witness-context"
    | "witness-imperative-form"
    | "conflicting-clause"
    | "compressed-measurement-group";
  sourceUnitIds: string[];
  before: ReconstructionPlacement[];
  after: ReconstructionPlacement[];
  evidence: string[];
}
type Attestations = Map<string, { family: string; ref: string }>;
export type CarrierLexicon = Map<string, Map<string, Attestations>>;
const exact = (s: string) =>
  s.normalize("NFC").toLowerCase().replaceAll("’", "'");
const span = (p: ReconstructionPlacement) =>
  p.kind === "empty"
    ? []
    : Array.from(
        { length: p.endWordIndex! - p.startWordIndex! + 1 },
        (_, i) => p.startWordIndex! + i
      );
export function learnCarrierLexicon(
  corpus: Iterable<ReconstructionWitness & { ref: string }>
): CarrierLexicon {
  const lexicon: CarrierLexicon = new Map();
  for (const w of corpus)
    for (const p of w.placements) {
      if (p.kind !== "word") continue;
      const word = w.words[p.startWordIndex!];
      if (!word) continue;
      const forms = lexicon.get(p.strong) ?? new Map<string, Attestations>();
      lexicon.set(p.strong, forms);
      const key = normalizeWord(word),
        attest = forms.get(key) ?? new Map();
      forms.set(key, attest);
      attest.set(`${w.family}:${w.ref}`, { family: w.family, ref: w.ref });
    }
  return lexicon;
}
function evidenceFor(
  lexicon: CarrierLexicon,
  strong: string,
  word: string,
  exclude: string,
  plural = false
) {
  const forms = lexicon.get(strong),
    all = [
      ...(forms?.get(word)?.values() ?? []),
      ...(plural && word.length >= 3 && !word.endsWith("s")
        ? (forms?.get(word + "s")?.values() ?? [])
        : [])
    ].filter((a) => a.ref !== exclude);
  return {
    refs: new Set(all.map((a) => a.ref)),
    families: new Set(all.map((a) => a.family)),
    records: all
  };
}
function lexicalPos(morph: string) {
  const m = morph.startsWith("H")
    ? (morph
        .slice(1)
        .split("/")
        .filter((p) => !p.startsWith("S"))
        .at(-1) ?? "")
    : morph;
  return m.startsWith("N") ? "noun" : m.startsWith("V") ? "verb" : "other";
}
const light = new Set([
  "fais",
  "fait",
  "faisons",
  "faites",
  "font",
  "faisait",
  "faisaient",
  "fera",
  "feront",
  "donne",
  "donnes",
  "donnent",
  "donna",
  "donnera",
  "prend",
  "prends",
  "prennent",
  "prit",
  "pris",
  "prendra",
  "met",
  "mets",
  "mettent",
  "mit",
  "mis",
  "mettra",
  "rend",
  "rends",
  "rendent",
  "rendit",
  "rendu",
  "rendra",
  "porte",
  "portes",
  "portent",
  "portait",
  "porta",
  "portera"
]);
const functionWords = new Set([
  "pas",
  "point",
  "de",
  "du",
  "des",
  "un",
  "une",
  "le",
  "la",
  "les",
  "aucun",
  "aucune",
  "plus",
  "a",
  "au",
  "aux",
  "en",
  "et",
  "avec",
  "contre",
  "dans",
  "par",
  "pour",
  "sans",
  "sur",
  "sous",
  "vers",
  "chez",
  "afin",
  "alors",
  "ainsi",
  "ni",
  "non",
  "que",
  "qui",
  "quoi",
  "dont",
  "ou",
  "si",
  "comme",
  "ce",
  "cet",
  "cette",
  "ces",
  "il",
  "elle",
  "ils",
  "elles",
  "je",
  "tu",
  "nous",
  "vous",
  "me",
  "te",
  "se",
  "lui",
  "leur",
  "eux",
  "y",
  "moi",
  "toi",
  "mon",
  "ma",
  "mes",
  "ton",
  "ta",
  "tes",
  "son",
  "sa",
  "ses",
  "notre",
  "votre",
  "nos",
  "vos",
  "leurs",
  "ne",
  "mais",
  "car",
  "donc",
  "or",
  "puis",
  "puisque",
  "lorsque",
  "quand",
  "apres",
  "avant",
  "depuis",
  "entre",
  "envers",
  "hors",
  "malgre",
  "parmi",
  "pendant",
  "selon",
  "sauf",
  "jusque"
]);
function ranges(text: string) {
  let offset = 0;
  return tokenizeText(text).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
}
export function refineConcordanceContext(options: {
  initial: ReconstructionVerse;
  witnesses: ReconstructionWitness[];
  lexicon: CarrierLexicon;
  display: "expressions" | "heads";
  policy?: ContextPolicy;
}) {
  const prediction = structuredClone(options.initial),
    { witnesses, lexicon } = options,
    policy = options.policy ?? DEFAULT_CONTEXT_POLICY,
    changes: ContextChange[] = [];
  // Supports are immutable during one verse. Reusing them avoids rescanning
  // thousands of corpus attestations for every repeated anchor comparison.
  const supportCache = new Map<string, ReturnType<typeof evidenceFor>>();
  const support = (strong: string, word: string, plural = false) => {
    const key = JSON.stringify([strong, word, plural]);
    let value = supportCache.get(key);
    if (!value) {
      value = evidenceFor(lexicon, strong, word, prediction.ref, plural);
      supportCache.set(key, value);
    }
    return value;
  };
  const owned = (u: ReconstructionVerse["units"][number]) =>
    prediction.placements.filter(
      (p) =>
        p.originalOccurrenceId &&
        u.occurrenceIds.includes(p.originalOccurrenceId)
    );
  const uniqueUnit = (strong: string) =>
    prediction.units.filter(
      (u) => !u.source.readingUnresolved && u.strong.includes(strong)
    ).length === 1;
  const positions = ranges(prediction.text);
  const hardBoundary = (a: number, b: number) =>
    /[.;:!?«»]/u.test(
      prediction.text.slice(
        positions[Math.min(a, b)].end,
        positions[Math.max(a, b)].start
      )
    );
  const withdraw = (
    units: ReconstructionVerse["units"],
    rule: ContextChange["rule"],
    evidence: string[]
  ) => {
    const before = units.flatMap(owned);
    prediction.placements = prediction.placements.filter(
      (p) => !before.some((b) => b.id === p.id)
    );
    for (const u of units) {
      u.state = "unresolved";
      u.assurance = rule;
      u.targetWordIndices = [];
      delete u.anchor;
      delete u.grammaticalRelation;
      u.reasons = [...u.reasons, ...evidence];
      u.exploration.remainingReason = evidence.join("; ");
    }
    changes.push({
      rule,
      sourceUnitIds: units.map((u) => u.sourceUnitId),
      before,
      after: [],
      evidence
    });
  };
  if (policy.lightVerbs)
    for (const u of prediction.units) {
      const ps = owned(u);
      if (
        u.state !== "visible" ||
        u.source.readingUnresolved ||
        lexicalPos(u.source.morphology) !== "verb" ||
        ps.length !== 1 ||
        ps[0].kind !== "word"
      )
        continue;
      const p = ps[0],
        at = p.startWordIndex!,
        word = normalizeWord(prediction.words[at]);
      if (!light.has(word) && !/^comm(?:et|is)/u.test(word)) continue;
      const head = support(p.strong, word);
      if (head.refs.size > 4) continue;
      const candidates: number[] = [];
      for (
        let end = at + 1;
        end <= Math.min(at + 4, prediction.words.length - 1);
        end++
      ) {
        const content = normalizeWord(prediction.words[end]);
        if (functionWords.has(content)) continue;
        const ev = support(p.strong, content, true);
        if (
          ev.refs.size >= 2 &&
          ev.families.size >= 2 &&
          !hardBoundary(at, end) &&
          !prediction.placements.some(
            (q) => q.id !== p.id && span(q).includes(end)
          )
        )
          candidates.push(end);
        break;
      }
      if (candidates.length !== 1) continue;
      const end = candidates[0],
        ev = support(p.strong, normalizeWord(prediction.words[end]), true);
      const next =
        options.display === "heads"
          ? { ...p }
          : {
              ...p,
              kind: "word" as const,
              startWordIndex: end,
              endWordIndex: end,
              source: "light-verb-relation"
            };
      const evidence = [
        "light-verb-with-attested-content-carrier",
        ...ev.records.map((a) => `${a.family}:${a.ref}`)
      ];
      prediction.placements[prediction.placements.indexOf(p)] = next;
      u.targetWordIndices = [at, end];
      u.assurance = "witness-supported-light-verb-relation";
      u.reasons = evidence;
      changes.push({
        rule: "light-verb-relation",
        sourceUnitIds: [u.sourceUnitId],
        before: [p],
        after: [next],
        evidence
      });
    }
  if (policy.localContext)
    for (const u of prediction.units) {
      const ps = owned(u);
      if (
        u.state !== "visible" ||
        u.source.readingUnresolved ||
        ps.length !== 1 ||
        ps[0].kind !== "word" ||
        lexicalPos(u.source.morphology) === "other"
      )
        continue;
      const p = ps[0];
      if (!uniqueUnit(p.strong)) continue;
      if (/^V-[A-Z0-9]*M-/u.test(u.source.morphology)) {
        const imperative = new Map<number, Set<string>>();
        for (const w of witnesses) {
          const wp = w.placements.filter((q) => q.strong === p.strong);
          if (wp.length !== 1 || wp[0].kind !== "word") continue;
          const form = exact(w.words[wp[0].startWordIndex!]);
          if (!/-(?:toi|vous)$/u.test(form)) continue;
          const at = prediction.words.flatMap((word, i) =>
            exact(word) === form ? [i] : []
          );
          if (at.length !== 1) continue;
          const families = imperative.get(at[0]) ?? new Set<string>();
          families.add(w.family);
          imperative.set(at[0], families);
        }
        if (imperative.size === 1) {
          const [at, families] = [...imperative][0];
          if (
            at !== p.startWordIndex &&
            !prediction.placements.some(
              (q) => q.id !== p.id && span(q).includes(at)
            )
          ) {
            const next = {
              ...p,
              startWordIndex: at,
              endWordIndex: at,
              source: "witness-imperative-form"
            };
            prediction.placements[prediction.placements.indexOf(p)] = next;
            // A nearby complement may still realize the command ("tiens-toi
            // debout"). Preserve that relation; a distant narrative carrier
            // such as a later past participle does not join the command.
            u.targetWordIndices =
              Math.abs(at - p.startWordIndex!) <= 3 &&
              !hardBoundary(at, p.startWordIndex!)
                ? [...new Set([...u.targetWordIndices, at])].sort(
                    (a, b) => a - b
                  )
                : [at];
            u.assurance = "witness-imperative-form";
            u.reasons = [
              "source-imperative-and-unique-witnessed-French-imperative"
            ];
            changes.push({
              rule: "witness-imperative-form",
              sourceUnitIds: [u.sourceUnitId],
              before: [p],
              after: [next],
              evidence: [...families, ...u.reasons]
            });
            continue;
          }
        }
      }
      const proposals = new Map<number, Set<string>>(),
        clauseConflicts = new Map<string, Set<string>>();
      for (const w of witnesses) {
        const wps = w.placements.filter((q) => q.strong === p.strong);
        if (wps.length !== 1 || wps[0].kind !== "word") continue;
        const wp = wps[0];
        for (const anchor of prediction.units) {
          if (
            anchor === u ||
            anchor.state !== "visible" ||
            anchor.source.readingUnresolved ||
            lexicalPos(anchor.source.morphology) !== "noun" ||
            anchor.strong.length !== 1 ||
            !uniqueUnit(anchor.strong[0])
          )
            continue;
          const aps = owned(anchor);
          if (aps.length !== 1 || aps[0].kind !== "word") continue;
          const ap = aps[0];
          const attestedAnchor =
            support(
              ap.strong,
              normalizeWord(prediction.words[ap.startWordIndex!])
            ).refs.size >= 8;
          if (
            !attestedAnchor &&
            ((ap.confidence ?? 0) < 0.9 ||
              !ap.source?.startsWith("reference-transfer:exact"))
          )
            continue;
          if (
            prediction.words.filter(
              (word) =>
                exact(word) === exact(prediction.words[ap.startWordIndex!])
            ).length !== 1
          )
            continue;
          const was = w.placements.filter((q) => q.strong === ap.strong);
          if (was.length !== 1 || was[0].kind !== "word") continue;
          const wa = was[0];
          const left = Math.min(wp.startWordIndex!, wa.startWordIndex!),
            right = Math.max(wp.endWordIndex!, wa.endWordIndex!);
          if (right - left > 6 || right === left) continue;
          const offset = wp.startWordIndex! - left,
            anchorOffset = wa.startWordIndex! - left,
            start = ap.startWordIndex! - anchorOffset;
          if (
            start >= 0 &&
            start + right - left < prediction.words.length &&
            w.words
              .slice(left, right + 1)
              .every(
                (word, i) => exact(word) === exact(prediction.words[start + i])
              ) &&
            !hardBoundary(start, start + right - left)
          ) {
            const at = start + offset;
            const families = proposals.get(at) ?? new Set<string>();
            families.add(w.family);
            proposals.set(at, families);
          }
          const invertedPredicate = prediction.units.some((other) => {
            if (
              other === u ||
              other.state !== "visible" ||
              other.source.readingUnresolved ||
              lexicalPos(other.source.morphology) !== "verb"
            )
              return false;
            const ops = owned(other);
            if (
              ops.length !== 1 ||
              ops[0].kind !== "word" ||
              !uniqueUnit(ops[0].strong)
            )
              return false;
            const op = ops[0],
              ows = w.placements.filter((q) => q.strong === op.strong);
            return (
              ows.length === 1 &&
              ows[0].kind === "word" &&
              op.startWordIndex! >
                Math.min(p.startWordIndex!, ap.startWordIndex!) &&
              op.startWordIndex! <
                Math.max(p.startWordIndex!, ap.startWordIndex!) &&
              Math.sign(p.startWordIndex! - op.startWordIndex!) !==
                Math.sign(wp.startWordIndex! - ows[0].startWordIndex!)
            );
          });
          if (
            lexicalPos(u.source.morphology) === "verb" &&
            Math.abs(p.startWordIndex! - ap.startWordIndex!) >= 6 &&
            Math.abs(wp.startWordIndex! - wa.startWordIndex!) <= 3 &&
            invertedPredicate
          ) {
            const between = prediction.text.slice(
              positions[Math.min(p.startWordIndex!, ap.startWordIndex!)].end,
              positions[Math.max(p.startWordIndex!, ap.startWordIndex!)].start
            );
            if (/[,.;:!?«»]/u.test(between)) {
              const families =
                clauseConflicts.get(anchor.sourceUnitId) ?? new Set<string>();
              families.add(w.family);
              clauseConflicts.set(anchor.sourceUnitId, families);
            }
          }
        }
      }
      if (proposals.size === 1) {
        const [at, families] = [...proposals][0];
        if (at === p.startWordIndex || families.size < 2) continue;
        if (
          prediction.placements.some(
            (q) => q.id !== p.id && span(q).includes(at)
          )
        )
          continue;
        const next = {
          ...p,
          startWordIndex: at,
          endWordIndex: at,
          source: "exact-witness-context"
        };
        prediction.placements[prediction.placements.indexOf(p)] = next;
        u.targetWordIndices = [at];
        u.assurance = "exact-witness-context";
        u.reasons = ["unique-local-witness-phrase-and-existing-nominal-anchor"];
        changes.push({
          rule: "exact-witness-context",
          sourceUnitIds: [u.sourceUnitId],
          before: [p],
          after: [next],
          evidence: [
            ...families,
            "unique-local-witness-phrase-and-existing-nominal-anchor"
          ]
        });
      } else if (!proposals.size) {
        const agreed = [...clauseConflicts].filter(
          ([, families]) => families.size >= 2
        );
        if (agreed.length)
          withdraw(
            [u],
            "conflicting-clause",
            agreed.map(
              ([id]) =>
                `independent-witness-context-conflicts-with-carrier:${id}`
            )
          );
      }
    }
  if (policy.measuredGroups) {
    const processed = new Set<string>();
    for (const first of prediction.units) {
      if (
        first.strong.length !== 1 ||
        lexicalPos(first.source.morphology) !== "noun"
      )
        continue;
      const strong = first.strong[0];
      if (processed.has(strong)) continue;
      processed.add(strong);
      const group = prediction.units.filter(
        (u) => u.strong.length === 1 && u.strong[0] === strong
      );
      if (
        group.length !== 2 ||
        group.some((u) => u.state !== "visible" || u.source.readingUnresolved)
      )
        continue;
      if (
        group.some((u) => {
          const at = prediction.units.indexOf(u);
          return !prediction.units
            .slice(Math.max(0, at - 1), at + 2)
            .some((n) => /(?:^H|\/)A[co]|^A-NUI/u.test(n.source.morphology));
        })
      )
        continue;
      const ps = group.map((u) => owned(u));
      if (ps.some((xs) => xs.length !== 1 || xs[0].kind !== "word")) continue;
      const words = ps.map((xs) =>
        normalizeWord(prediction.words[xs[0].startWordIndex!])
      );
      if (words[0] === words[1]) continue;
      const supports = words.map((word) => support(strong, word));
      const dominant = supports.findIndex(
        (s) => s.refs.size >= 16 && s.families.size >= 2
      );
      if (dominant < 0) continue;
      const other = 1 - dominant;
      if (
        supports[other].families.size !== 1 ||
        supports[other].refs.size > supports[dominant].refs.size / 10
      )
        continue;
      const local = new Map<string, Set<string>>();
      for (const w of witnesses) {
        const ws = w.placements
          .filter((p) => p.strong === strong && p.kind === "word")
          .map((p) => normalizeWord(w.words[p.startWordIndex!]));
        if (ws.length === 2)
          local.set(w.family, new Set([...(local.get(w.family) ?? []), ...ws]));
      }
      if (
        local.size < 2 ||
        ![...local.values()].every((s) => s.has(words[dominant])) ||
        [...local.values()].every((s) => s.has(words[other]))
      )
        continue;
      withdraw(group, "compressed-measurement-group", [
        "repeated-source-nouns-with-adjacent-numerals",
        "witness-families-disagree-on-the-weaker-carrier",
        "group-ownership-not-established-no-absence-inferred"
      ]);
    }
  }
  return { prediction, changes };
}
