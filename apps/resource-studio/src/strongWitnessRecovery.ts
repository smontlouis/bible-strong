/** Recover unresolved carriers from allowed witnesses, never target labels. */
import type {
  ReconstructionVerse,
  ReconstructionWitness,
  ReconstructionPlacement
} from "./strongConcordanceRefinement.js";
import { normalizeWord, tokenizeText } from "./tokenize.js";
import { isGenericFrenchCarrier } from "./frenchLexicalSafety.js";
import { isConcordanceFunctionWord } from "./strongConcordanceContext.js";

export const WITNESS_RECOVERY_POLICY = "attested-neighbor-recovery-v3";
export interface RecoveryAttestation {
  ref: string;
  witness: string;
  family: string;
}
export type RecoveryLexicon = Map<string, Map<string, RecoveryAttestation[]>>;
export interface WitnessRecoveryPolicy {
  lexical: boolean;
  compounds: boolean;
  neighbors: boolean;
}
export const DEFAULT_WITNESS_RECOVERY: WitnessRecoveryPolicy = {
  lexical: true,
  compounds: true,
  neighbors: true
};
export interface RecoveryChange {
  rule: "attested-neighbor-recovery" | "attested-compound-recovery";
  sourceUnitId: string;
  placement: ReconstructionPlacement;
  attestations: RecoveryAttestation[];
  anchors: string[];
}
// Keep accents and derivations distinct. Only case and French elisions vary.
const form = (s: string) =>
  s
    .normalize("NFC")
    .toLowerCase()
    .replaceAll("’", "'")
    .replace(/^(?:c|d|j|l|m|n|qu|s|t)'/u, "");
export function learnRecoveryLexicon(
  corpus: Iterable<ReconstructionWitness & { ref: string }>
): RecoveryLexicon {
  const lexicon: RecoveryLexicon = new Map();
  const seen = new Set<string>();
  for (const witness of corpus)
    for (const placement of witness.placements) {
      if (placement.kind !== "word") continue;
      const word = witness.words[placement.startWordIndex!];
      if (!word) continue;
      const key = form(word);
      if (!/^\p{L}{3,}$/u.test(key)) continue;
      const forms = lexicon.get(placement.strong) ?? new Map();
      lexicon.set(placement.strong, forms);
      const attestations: RecoveryAttestation[] = forms.get(key) ?? [];
      forms.set(key, attestations);
      const identity = JSON.stringify([
        placement.strong,
        key,
        witness.ref,
        witness.family
      ]);
      if (!seen.has(identity)) {
        seen.add(identity);
        attestations.push({
          ref: witness.ref,
          witness: witness.name,
          family: witness.family
        });
      }
    }
  return lexicon;
}
const functionWords = new Set(
  "aucun aucune autre autres bien car comme dans depuis des donc elle elles entre eux lequel laquelle les leur leurs lui mais meme même mon nos notre nous par pas peu plus pour pourquoi quand que quel quelle qui quoi sans ses son sous sur tes toi ton tous tout toute toutes tres très trop une vers vos votre vous ainsi alors avec aussi celui celle ceux celles cela ceci dont ici rien sont sommes etait était est ont ayant être etre fait font faire sera seront été ete".split(
    " "
  )
);
// Ambiguous adpositions/adverbs are not standalone lexical recovery evidence.
for (const word of "avant après devant derrière depuis pendant durant selon sauf envers autour auprès près loin dessus dessous seulement encore déjà désormais lorsque puisque toutefois pourtant cependant sinon voilà voici".split(
  " "
))
  functionWords.add(word);
function lexical(morphology: string) {
  const value = morphology.startsWith("H")
    ? (morphology
        .slice(1)
        .split("/")
        .filter((part) => !part.startsWith("S"))
        .at(-1) ?? "")
    : morphology;
  return /^(?:N|V|A)/u.test(value);
}

/** Shared rejection of grammatical or overly polysemous standalone surfaces. */
export function isUnsafeRecoverySurface(word: string): boolean {
  return (
    functionWords.has(form(word)) ||
    isGenericFrenchCarrier(normalizeWord(word)) ||
    isConcordanceFunctionWord(word)
  );
}

export function recoverWitnessCarriers(options: {
  initial: ReconstructionVerse;
  lexicon: RecoveryLexicon;
  policy?: WitnessRecoveryPolicy;
}) {
  const prediction = structuredClone(options.initial);
  const policy = options.policy ?? DEFAULT_WITNESS_RECOVERY;
  const changes: RecoveryChange[] = [];
  if (prediction.issues.length || prediction.unownedAnnotationIds.length)
    return { prediction, changes };
  const eligible = (u: ReconstructionVerse["units"][number]) =>
    !u.source.readingUnresolved &&
    u.strong.length === 1 &&
    u.occurrenceIds.length === 1 &&
    lexical(u.source.morphology) &&
    prediction.units.filter((other) => other.strong.includes(u.strong[0]))
      .length === 1;
  const owned = (u: ReconstructionVerse["units"][number]) =>
    prediction.placements.filter(
      (p) => p.originalOccurrenceId === u.occurrenceIds[0] && p.kind !== "empty"
    );
  const covers = (p: ReconstructionPlacement, at: number) =>
    p.kind !== "empty" && p.startWordIndex! <= at && at <= p.endWordIndex!;
  const evidence = (strong: string, text: string) => {
    const records = (options.lexicon.get(strong)?.get(form(text)) ?? []).filter(
      (a) => a.ref !== prediction.ref
    );
    return new Set(records.map((a) => a.family)).size >= 2 &&
      new Set(records.map((a) => a.ref)).size >= 2
      ? records
      : [];
  };
  let offset = 0;
  const ranges = tokenizeText(prediction.text).flatMap((token) => {
    const start = offset;
    offset += token.text.length;
    return token.kind === "word" ? [{ start, end: offset }] : [];
  });
  const candidates: Array<
    RecoveryChange & { unit: ReconstructionVerse["units"][number] }
  > = [];
  for (let index = 0; index < prediction.units.length; index++) {
    const unit = prediction.units[index];
    if (unit.state !== "unresolved" || !eligible(unit) || owned(unit).length)
      continue;
    // Withdrawals due to conflicting clauses or verse groups are not lexical gaps.
    if (
      unit.assurance !== "unresolved" ||
      !unit.reasons.includes("missing-carrier-is-not-absent-translation")
    )
      continue;
    const strong = unit.strong[0];
    const proposals: typeof candidates = [];
    const make = (
      at: number,
      rule: RecoveryChange["rule"],
      attestations: RecoveryAttestation[],
      anchors: string[]
    ) => ({
      unit,
      rule,
      sourceUnitId: unit.sourceUnitId,
      attestations,
      anchors,
      placement: {
        id: `recovery:${unit.occurrenceIds[0]}`,
        originalOccurrenceId: unit.occurrenceIds[0],
        strong,
        kind: "word" as const,
        startWordIndex: at,
        endWordIndex: at,
        confidence: 0,
        source: rule
      }
    });
    if (policy.lexical) {
      const anchor = (direction: -1 | 1) => {
        for (
          let at = index + direction;
          at >= 0 && at < prediction.units.length && Math.abs(at - index) <= 8;
          at += direction
        ) {
          const other = prediction.units[at],
            placements = owned(other);
          if (
            other.state === "visible" &&
            eligible(other) &&
            placements.length === 1 &&
            placements[0].kind === "word"
          )
            return { unit: other, position: placements[0].startWordIndex! };
        }
        return undefined;
      };
      const left = anchor(-1),
        right = anchor(1);
      const bounded =
        left &&
        right &&
        left.position < right.position &&
        right.position - left.position <= 14;
      if (!policy.neighbors || bounded) {
        for (let at = 0; at < prediction.words.length; at++) {
          const word = prediction.words[at];
          if (
            isUnsafeRecoverySurface(word) ||
            prediction.placements.some((p) => covers(p, at))
          )
            continue;
          if (
            policy.neighbors &&
            (!left ||
              !right ||
              at <= left.position ||
              at >= right.position ||
              /[.;:!?«»]/u.test(
                prediction.text.slice(
                  ranges[left.position].end,
                  ranges[right.position].start
                )
              ))
          )
            continue;
          const attestations = evidence(strong, word);
          if (attestations.length)
            proposals.push(
              make(
                at,
                "attested-neighbor-recovery",
                attestations,
                bounded ? [left.unit.sourceUnitId, right.unit.sourceUnitId] : []
              )
            );
        }
      }
    }
    if (policy.compounds && /^N/u.test(unit.source.morphology)) {
      for (let at = 0; at < prediction.words.length; at++) {
        const parts = prediction.words[at].split(/[-‐‑]/u);
        if (
          parts.length !== 2 ||
          parts.some((part) => !/^\p{Lu}\p{L}{2,}$/u.test(part))
        )
          continue;
        const claims = prediction.placements.filter((p) => covers(p, at));
        if (claims.length !== 1 || claims[0].kind !== "word") continue;
        const companionIndex = prediction.units.findIndex((u) =>
          u.occurrenceIds.includes(claims[0].originalOccurrenceId ?? "")
        );
        if (companionIndex < 0 || Math.abs(companionIndex - index) > 3)
          continue;
        const companion = prediction.units[companionIndex];
        if (!eligible(companion) || !/^N/u.test(companion.source.morphology))
          continue;
        for (const partIndex of [0, 1]) {
          const attestations = evidence(strong, parts[partIndex]);
          if (
            attestations.length &&
            evidence(claims[0].strong, parts[1 - partIndex]).length
          )
            proposals.push(
              make(at, "attested-compound-recovery", attestations, [
                companion.sourceUnitId
              ])
            );
        }
      }
    }
    if (proposals.length === 1) candidates.push(proposals[0]);
  }
  for (const candidate of candidates) {
    if (
      candidates.filter(
        (other) =>
          other.placement.startWordIndex === candidate.placement.startWordIndex
      ).length !== 1
    )
      continue;
    const { unit, ...change } = candidate;
    prediction.placements.push(change.placement);
    unit.state = "visible";
    unit.assurance = change.rule;
    unit.targetWordIndices = [change.placement.startWordIndex!];
    unit.reasons = [
      change.rule,
      ...change.attestations.map((a) => `${a.family}:${a.ref}`),
      ...change.anchors.map((a) => `neighbor:${a}`)
    ];
    unit.annotationIds.push(change.placement.id);
    unit.exploration.methods.push(change.rule);
    unit.exploration.remainingReason = null;
    delete unit.anchor;
    delete unit.grammaticalRelation;
    changes.push(change);
  }
  return { prediction, changes };
}
