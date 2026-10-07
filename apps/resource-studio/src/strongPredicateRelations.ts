/** Predicate-level checks: target text and source relations only, never gold labels. */
import { normalizeWord, tokenizeText } from "./tokenize.js";
import type {
  ReconstructionPlacement,
  ReconstructionVerse
} from "./strongConcordanceRefinement.js";

export const PREDICATE_RELATION_POLICY = "supported-predicate-relations-v2";
export interface PredicatePolicy {
  expressions: boolean;
  nominalGuard: boolean;
}
export interface PredicateChange {
  rule:
    | "supported-predicate-expression"
    | "copular-translation-relation"
    | "competing-nominal-recovery";
  sourceUnitId: string;
  before: ReconstructionPlacement[];
  after: ReconstructionPlacement[];
  relation: number[];
  evidence: string[];
}
const form = (text: string) =>
  text
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/^(?:c|d|j|l|m|n|qu|s|t)'/u, "");
function pos(morphology: string) {
  return morphology.startsWith("H")
    ? (morphology
        .slice(1)
        .split("/")
        .filter((m) => !m.startsWith("S"))
        .at(-1) ?? "")
    : morphology;
}
const copulas = new Set(
  "etre suis es est sommes etes sont etais etait etions etiez etaient serai seras sera serons serez seront serais serait serions seriez seraient sois soit soyons soyez soient furent fut ete etant".split(
    " "
  )
);
const supportVerbs = new Set(
  "rendre rends rend rendons rendez rendent rendait rendaient rendit rendirent rendu rendra rendront celebre celebres celebrons celebrez celebrent celebrer celebra celebraient celebrera celebreront faire fais fait faisons faites font faisait faisaient fera feront fit firent commettre commets commet commettons commettez commettent commettait commettaient commettra commettront commis donner donne donnes donnons donnez donnent donnait donnaient donna donnera donneront prendre prends prend prenons prenez prennent prenait prenaient prit prirent prendra prendront mettre mets met mettons mettez mettent mettait mettaient mit mirent mettra mettront".split(
    " "
  )
);
const bridges = new Set("le la les un une de du des en".split(" "));
const contains = (p: ReconstructionPlacement, index: number) =>
  p.kind !== "empty" && p.startWordIndex! <= index && index <= p.endWordIndex!;

export function refinePredicateRelations(options: {
  initial: ReconstructionVerse;
  display: "expressions" | "heads";
  preserveExistingDisplay?: boolean;
  policy?: PredicatePolicy;
}) {
  const prediction = structuredClone(options.initial);
  const policy = options.policy ?? { expressions: true, nominalGuard: true };
  const changes: PredicateChange[] = [];
  if (prediction.issues.length || prediction.unownedAnnotationIds.length)
    return { prediction, changes };
  let offset = 0;
  const ranges = tokenizeText(prediction.text).flatMap((t) => {
    const start = offset;
    offset += t.text.length;
    return t.kind === "word" ? [{ start, end: offset }] : [];
  });
  const initialPlacements = [...prediction.placements];
  for (const unit of prediction.units) {
    if (
      unit.state !== "visible" ||
      unit.source.readingUnresolved ||
      !pos(unit.source.morphology).startsWith("V") ||
      unit.assurance === "durable-reviewed-placement"
    )
      continue;
    const placements = initialPlacements.filter((p) =>
      unit.occurrenceIds.includes(p.originalOccurrenceId ?? "")
    );
    if (placements.length !== 1 || placements[0].kind !== "word") continue;
    const before = placements[0],
      at = before.startWordIndex!;
    const head = form(prediction.words[at]);
    let support: { at: number; copula: boolean } | undefined;
    for (let index = at - 1; index >= Math.max(0, at - 3); index--) {
      const word = normalizeWord(prediction.words[index]);
      if (
        /[.;:!?«,»]/u.test(
          prediction.text.slice(ranges[index].end, ranges[at].start)
        )
      )
        break;
      if (
        initialPlacements.some((p) => p.id !== before.id && contains(p, index))
      )
        break;
      if (copulas.has(word) || supportVerbs.has(word)) {
        // A determiner before a possible verb indicates a nominal use (e.g. a famous...).
        if (
          !copulas.has(word) &&
          index > 0 &&
          ["le", "la", "les", "un", "une"].includes(
            normalizeWord(prediction.words[index - 1])
          )
        )
          break;
        support = { at: index, copula: copulas.has(word) };
        break;
      }
      if (!bridges.has(word)) break;
    }
    if (support && policy.expressions) {
      const displayIndices = Array.from(
        { length: at - support.at + 1 },
        (_, i) => support!.at + i
      );
      if (
        displayIndices.some((index) =>
          initialPlacements.some(
            (p) => p.id !== before.id && contains(p, index)
          )
        )
      )
        continue;
      const relation = [
        ...new Set([...unit.targetWordIndices, ...displayIndices])
      ].sort((a, b) => a - b);
      const rule = support.copula
        ? "copular-translation-relation"
        : "supported-predicate-expression";
      const after: ReconstructionPlacement =
        support.copula ||
        options.display === "heads" ||
        (options.preserveExistingDisplay !== false &&
          !before.id.startsWith("recovery:"))
          ? { ...before }
          : {
              ...before,
              kind: "phrase",
              startWordIndex: support.at,
              endWordIndex: at,
              targetWordIndices: displayIndices,
              source: rule,
              confidence: 0
            };
      prediction.placements[
        prediction.placements.findIndex((p) => p.id === before.id)
      ] = after;
      unit.targetWordIndices = relation;
      unit.reasons = [...unit.reasons, rule];
      unit.exploration.methods = [...unit.exploration.methods, rule];
      changes.push({
        rule,
        sourceUnitId: unit.sourceUnitId,
        before: [before],
        after: [after],
        relation,
        evidence: [
          "source-verb",
          "adjacent-unoccupied-support",
          `support:${prediction.words[support.at]}`,
          `display:${options.display}`
        ]
      });
      continue;
    }
    if (!policy.nominalGuard || !before.id.startsWith("recovery:") || support)
      continue;
    // A repeated noun belonging to a different source occurrence is not evidence
    // for the target verb. Preserve uncertainty until its predicate is established.
    const nominal = prediction.units.find(
      (other) =>
        other.sourceUnitId !== unit.sourceUnitId &&
        other.state === "visible" &&
        !other.source.readingUnresolved &&
        pos(other.source.morphology).startsWith("N") &&
        initialPlacements.some(
          (p) =>
            other.occurrenceIds.includes(p.originalOccurrenceId ?? "") &&
            p.kind === "word" &&
            p.startWordIndex !== at &&
            form(prediction.words[p.startWordIndex!]) === head
        )
    );
    if (!nominal) continue;
    prediction.placements = prediction.placements.filter(
      (p) => p.id !== before.id
    );
    unit.state = "unresolved";
    unit.assurance = "unresolved-predicate-relation";
    unit.targetWordIndices = [];
    unit.reasons = [
      ...unit.reasons,
      "competing-nominal-recovery",
      `nominal-source:${nominal.sourceUnitId}`
    ];
    unit.exploration.methods.push("predicate-relation-check");
    unit.exploration.remainingReason = "competing-nominal-recovery";
    delete unit.anchor;
    delete unit.grammaticalRelation;
    changes.push({
      rule: "competing-nominal-recovery",
      sourceUnitId: unit.sourceUnitId,
      before: [before],
      after: [],
      relation: [],
      evidence: [
        "source-verb",
        "repeated-target-noun-already-owned",
        `nominal-source:${nominal.sourceUnitId}`,
        "no-supported-predicate-no-absence-inferred"
      ]
    });
  }
  return { prediction, changes };
}
