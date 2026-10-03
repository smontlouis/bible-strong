import type { ResolutionCarrier, ResolutionUnit } from "./strongResolution.js";
import type {
  ResolutionDossier,
  WitnessEmptyProposal
} from "./strongResolutionWorkflow.js";

/**
 * Untranslated words from weaker witness context (engine option S).
 *
 * Option G establishes a source word as untranslated when a witness leaves
 * this very word (its position and number) untranslated and the two words on
 * each side of its mark recur once, verbatim, in the target. Option S starts
 * from the same evidence (a witness that leaves this very word untranslated;
 * a failed search never proves an absence) and places it in three more ways:
 *
 * - a witness rendering near G's place contradicts only when one of its words
 *   is free: « faire périr ◎ l'âme et le corps », where the « et » of Darby
 *   belongs to the other καί of the verse;
 * - a conjunction that a witness leaves untranslated before the first word of
 *   its verse is untranslated at the start of a target verse that opens
 *   without a connective (« ◎ Apportez-les-moi ici »), and one that it leaves
 *   between two source words is untranslated between our carriers of those
 *   words when they are adjacent (« la nuit est bien avancée ◎ le jour
 *   approche », δέ);
 * - a visible carrier is withdrawn when at least two witnesses leave its source
 *   word untranslated, none renders it, no other source word of the verse has
 *   its number, and one of the two rules above (or G's own context) gives the
 *   place (« Je m'en vais sans enfants et ◎ l'héritier de mes biens » : בֶן no
 *   longer sits on « enfants »).
 *
 * Each step runs only when the previous one gave no witness a vote.
 */

/** Diagnostic of a reader carrier that an override of option S hid. */
export const WITNESS_EMPTY_OVERRIDES_CARRIER =
  "witness-empty-overrides-carrier";

/**
 * Diagnostic recording the words a carrier tagged when S hid it (`3-5`), so
 * that the reader it had at the baseline can be recounted from the verse.
 */
export function overriddenWordsDiagnostic(
  startWordIndex: number,
  endWordIndex: number
): string {
  return `witness-empty-overridden-words:${startWordIndex}-${endWordIndex}`;
}

/** The words an S-hidden carrier tagged, read back from its diagnostics. */
export function overriddenWords(diagnostics: readonly string[]): number[] {
  const match = diagnostics
    .map((d) => /^witness-empty-overridden-words:(\d+)-(\d+)$/u.exec(d))
    .find(Boolean);
  if (!match) return [];
  const start = Number(match[1]),
    end = Number(match[2]);
  return Array.from({ length: end - start + 1 }, (_, i) => start + i);
}

export type WitnessRenderingLexicon = ReadonlyMap<
  string,
  ReadonlyMap<string, number>
>;

type Witness = ResolutionDossier["witnesses"][number];
type DossierUnit = ResolutionDossier["units"][number];

// As in strongResolutionWorkflow: accents, elisions and negation are kept.
const exactToken = (s: string) =>
  s.normalize("NFC").toLocaleLowerCase("fr-FR").replace(/’/gu, "'");
const visible = (p: ResolutionCarrier) => p.kind !== "empty";
const owns = (u: ResolutionUnit, p: ResolutionCarrier) =>
  Boolean(
    p.originalOccurrenceId && u.occurrenceIds.includes(p.originalOccurrenceId)
  );
/** `TAGNT.Matt.14.18.2.N.main:0` names word 2 of Matt.14.18. */
function sourceWord(occurrenceId: string) {
  const match = /^TA(?:HOT|GNT)\.([^.]+\.\d+\.\d+)\.(\d+)\./u.exec(
    occurrenceId
  );
  return match ? { ref: match[1]!, position: Number(match[2]) } : undefined;
}

/**
 * Renderings that the witnesses give each Strong number anywhere in the Bible
 * (« et », « alors », « en effet »), lowercased, with their counts.
 */
export function buildWitnessRenderingLexicon(
  taggedTexts: Iterable<string>
): WitnessRenderingLexicon {
  const lexicon = new Map<string, Map<string, number>>();
  for (const text of taggedTexts)
    for (const match of text.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
      const rendering = exactToken(
        (match[2] ?? "").replace(/<[^>]+>/gu, "")
      ).trim();
      if (!rendering || !/[\p{L}\p{N}]/u.test(rendering)) continue;
      const codes = (/\bstrong="([^"]*)"/u.exec(match[1] ?? "")?.[1] ?? "")
        .split(/\s+/u)
        .filter(Boolean);
      for (const code of codes) {
        const key = code.toUpperCase();
        const counts = lexicon.get(key) ?? new Map<string, number>();
        counts.set(rendering, (counts.get(rendering) ?? 0) + 1);
        lexicon.set(key, counts);
      }
    }
  return lexicon;
}

/** Renderings used at least 3 times and for at least 1 % of a Strong's renderings. */
function frequentRenderings(
  lexicon: WitnessRenderingLexicon | undefined,
  strongs: string[]
): Set<string> {
  const out = new Set<string>();
  for (const strong of strongs) {
    const counts = lexicon?.get(strong.toUpperCase());
    if (!counts) continue;
    let total = 0;
    for (const n of counts.values()) total += n;
    for (const [rendering, n] of counts)
      if (n >= 3 && n / total >= 0.01) out.add(rendering);
  }
  return out;
}

/** « qu'il » → « qu' » : an elided head may carry the word on its own. */
const elidedHead = (word: string) => {
  const i = word.indexOf("'");
  return i > 0 && i < word.length - 1 ? word.slice(0, i + 1) : undefined;
};

/** Connectives that would carry a conjunction if the target wrote one. */
const CONNECTIVES = new Set([
  "et",
  "mais",
  "or",
  "puis",
  "alors",
  "cependant",
  "ainsi",
  "aussi",
  "donc",
  "car",
  "ni",
  "pourtant",
  "toutefois"
]);
/** First words that open a verse with a rendered connective. */
const OPENING_CONNECTIVES = new Set([
  ...CONNECTIVES,
  "même",
  "néanmoins",
  "ensuite",
  "enfin",
  "oui",
  "tandis",
  "quant",
  "c'est",
  "voici",
  "voilà",
  "là-dessus",
  "après",
  "pourquoi",
  "sinon",
  "ailleurs",
  // « en effet », « en ce qui concerne », « dès lors » …
  "en",
  "dès"
]);
/**
 * Openings that render a conjunction unless another source word carries them
 * (« De plus » is οὐ μόνον in « de plus, il a été choisi »).
 */
const FREE_OPENINGS = [
  ["ou"],
  ["plutôt"],
  ["d'ailleurs"],
  ["de", "plus"],
  ["bien", "plus"],
  ["par", "ailleurs"],
  ["au", "contraire"]
];

interface WitnessMark {
  witness: Witness;
  /** Index of the mark among the witness placements (text order). */
  index: number;
  at: number;
}

interface WitnessTreatment {
  empties: WitnessMark[];
  renderings: string[][];
  punctuated: number;
}

/** How each witness treats this very source word, exactly as option G reads it. */
function witnessTreatment(
  d: ResolutionDossier,
  unit: ResolutionUnit
): WitnessTreatment | undefined {
  const words = unit.occurrenceIds.flatMap((id) => {
    const word = sourceWord(id);
    return word ? [word] : [];
  });
  if (!words.length) return undefined;
  const identifiers = new Set(unit.strong.map((code) => code.toUpperCase()));
  const named = (w: Witness, p: ResolutionCarrier) =>
    w.ref !== undefined &&
    p.strong
      .split(/\s+/u)
      .some((code) => identifiers.has(code.toUpperCase())) &&
    words.some(
      (word) => word.ref === w.ref && p.positions?.includes(word.position)
    );
  const out: WitnessTreatment = { empties: [], renderings: [], punctuated: 0 };
  for (const w of d.witnesses) {
    const marks = w.placements.filter((p) => named(w, p));
    if (!marks.length) continue;
    // Punctuation carrying the Strong is a rendering, not an absence.
    if (marks.some((p) => p.punctuation)) {
      out.punctuated += 1;
      continue;
    }
    const rendered = marks.find(visible);
    if (rendered) {
      out.renderings.push(
        w.words
          .slice(rendered.startWordIndex!, rendered.endWordIndex! + 1)
          .map(exactToken)
      );
      continue;
    }
    out.empties.push({
      witness: w,
      index: w.placements.indexOf(marks[0]!),
      at: marks[0]!.insertAfterWordIndex!
    });
  }
  return out;
}

interface Vote {
  witness: string;
  family: string;
  anchor: number;
}

interface StepResult {
  anchor?: number;
  /** Some witness voted: later steps do not run. */
  voted: boolean;
  detail: string;
  votes: Vote[];
}

const step = (
  votes: Vote[],
  anchor: number | undefined,
  detail: string
): StepResult => ({ anchor, voted: votes.length > 0, detail, votes });

const agreed = (votes: Vote[]) =>
  votes.length && new Set(votes.map((v) => v.anchor)).size === 1
    ? votes[0]!.anchor
    : undefined;

interface StepContext {
  d: ResolutionDossier;
  entry: DossierUnit;
  unit: ResolutionUnit;
  target: string[];
  /** Our carriers, the unit's own left out. */
  placements: ResolutionCarrier[];
  treatment: WitnessTreatment;
  lexicon?: WitnessRenderingLexicon;
}

const carriedAt = (ctx: StepContext, i: number) =>
  ctx.placements.some(
    (p) => visible(p) && p.startWordIndex! <= i && p.endWordIndex! >= i
  );

/** Witness renderings found within [anchor − 2, anchor + 3], as word index lists. */
function renderingsNear(ctx: StepContext, anchor: number) {
  const lo = Math.max(0, anchor - 2);
  const hi = Math.min(ctx.target.length - 1, anchor + 3);
  const out: number[][] = [];
  for (const rendering of ctx.treatment.renderings) {
    if (!rendering.length) continue;
    for (let s = lo; s + rendering.length - 1 <= hi; s += 1)
      if (rendering.every((t, j) => ctx.target[s + j] === t))
        out.push(rendering.map((_, j) => s + j));
  }
  return out;
}

/** Target boundaries where `left ◎ right` occurs; a verse edge stays an edge. */
function contextHits(target: string[], left: string[], right: string[]) {
  const hits: number[] = [];
  for (let anchor = -1; anchor < target.length; anchor += 1) {
    const leftStart = anchor - left.length + 1;
    if (
      leftStart < 0 ||
      anchor + right.length >= target.length ||
      (left.length === 0 && anchor !== -1) ||
      (right.length === 0 && anchor !== target.length - 1)
    )
      continue;
    if (
      left.every((t, j) => target[leftStart + j] === t) &&
      right.every((t, j) => target[anchor + 1 + j] === t)
    )
      hits.push(anchor);
  }
  return hits;
}

/**
 * G's context (two words on each side of the mark, found once). A rendering
 * near the place contradicts only when one of its words is free.
 */
function sameContextStep(ctx: StepContext): StepResult {
  const votes: Vote[] = [];
  for (const { witness: w, at } of ctx.treatment.empties) {
    const left = w.words.slice(Math.max(0, at - 1), at + 1).map(exactToken);
    const right = w.words.slice(at + 1, at + 3).map(exactToken);
    if (left.length + right.length < 2) continue;
    const hits = contextHits(ctx.target, left, right);
    if (hits.length === 1)
      votes.push({ witness: w.name, family: w.family, anchor: hits[0]! });
  }
  const anchor = agreed(votes);
  if (anchor === undefined)
    return step(votes, undefined, votes.length ? "disagree" : "no-vote");
  const near = renderingsNear(ctx, anchor);
  if (!near.length) return step(votes, anchor, "same-context");
  if (near.some((match) => match.some((i) => !carriedAt(ctx, i))))
    return step(votes, undefined, "free-rendering-near");
  return step(votes, anchor, "rendering-carried-elsewhere");
}

/** Does every source word of the dossier come from one STEP verse? */
function singleSourceVerse(d: ResolutionDossier) {
  const refs = new Set(
    d.units.flatMap((u) =>
      u.unit.occurrenceIds.flatMap((id) => sourceWord(id)?.ref ?? [])
    )
  );
  return refs.size === 1;
}

/** The rendered witness tag nearest to the mark on one side (text order). */
function nearestTag(w: Witness, index: number, direction: -1 | 1) {
  for (
    let i = index + direction;
    i >= 0 && i < w.placements.length;
    i += direction
  ) {
    const p = w.placements[i]!;
    if (!visible(p)) continue;
    // A tag naming several numbers gives consecutive placements.
    const same = (q: ResolutionCarrier | undefined) =>
      q !== undefined &&
      visible(q) &&
      q.startWordIndex === p.startWordIndex &&
      q.endWordIndex === p.endWordIndex &&
      (q.positions ?? []).join("+") === (p.positions ?? []).join("+");
    const tag = [p];
    for (let j = i - 1; same(w.placements[j]); j -= 1)
      tag.unshift(w.placements[j]!);
    for (let j = i + 1; same(w.placements[j]); j += 1)
      tag.push(w.placements[j]!);
    return tag;
  }
  return undefined;
}

/** Our one carrier of the source word that a witness tag names (pos + number). */
function carrierOfTag(
  ctx: StepContext,
  w: Witness,
  tag: ResolutionCarrier[]
): ResolutionCarrier | undefined {
  const positions = new Set(tag.flatMap((p) => p.positions ?? []));
  const strongs = new Set(
    tag.flatMap((p) => p.strong.split(/\s+/u).map((s) => s.toUpperCase()))
  );
  if (!positions.size) return undefined;
  const found = ctx.d.units.flatMap(({ unit }) => {
    if (
      unit.readingUnresolved ||
      unit.id === ctx.unit.id ||
      !unit.strong.some((s) => strongs.has(s.toUpperCase())) ||
      !unit.occurrenceIds.some((id) => {
        const word = sourceWord(id);
        return (
          word !== undefined &&
          word.ref === w.ref &&
          positions.has(word.position)
        );
      })
    )
      return [];
    const owned = ctx.placements.filter((p) => visible(p) && owns(unit, p));
    const spans = new Set(
      owned.map((p) => `${p.startWordIndex}:${p.endWordIndex}`)
    );
    return [spans.size === 1 ? owned[0]! : undefined];
  });
  return found.length === 1 ? found[0] : undefined;
}

/**
 * Conjunctions (STEP morphology CONJ) only. The witness mark comes before the
 * first word of its verse, and the target opens without a connective, none in
 * its first fifth (as K reads opening conjunctions); or the mark sits between
 * two rendered witness tags whose source words we carry on adjacent words,
 * and no free word nearby is one the witnesses use for this Strong number
 * (« Festus ◎ répondit alors » keeps οὖν open: « alors » renders it).
 */
function neighbourStep(ctx: StepContext): StepResult {
  if (ctx.entry.morphology !== "CONJ")
    return step([], undefined, "not-conjunction");
  const { target } = ctx;
  const votes: Vote[] = [];
  const kinds = new Set<string>();
  for (const mark of ctx.treatment.empties) {
    const w = mark.witness;
    if (mark.at === -1) {
      // A merged or resegmented verse may start elsewhere than the witness.
      if (!singleSourceVerse(ctx.d)) continue;
      if (OPENING_CONNECTIVES.has(target[0] ?? "")) continue;
      if (
        FREE_OPENINGS.some(
          (words) =>
            words.every((word, i) => target[i] === word) &&
            words.some((_, i) => !carriedAt(ctx, i))
        )
      )
        continue;
      if (
        target.some(
          (t, k) => k <= 0.2 * (target.length - 1) && CONNECTIVES.has(t)
        )
      )
        continue;
      votes.push({ witness: w.name, family: w.family, anchor: -1 });
      kinds.add("verse-start");
      continue;
    }
    const leftTag = nearestTag(w, mark.index, -1);
    const rightTag = nearestTag(w, mark.index, 1);
    const left = leftTag && carrierOfTag(ctx, w, leftTag);
    const right = rightTag && carrierOfTag(ctx, w, rightTag);
    if (!left || !right || left.endWordIndex! + 1 !== right.startWordIndex)
      continue;
    votes.push({
      witness: w.name,
      family: w.family,
      anchor: left.endWordIndex!
    });
    kinds.add("adjacent-neighbours");
  }
  const anchor = agreed(votes);
  if (anchor === undefined)
    return step(votes, undefined, votes.length ? "disagree" : "no-vote");
  if (anchor >= 0) {
    const known = frequentRenderings(ctx.lexicon, ctx.unit.strong);
    const hi = Math.min(target.length - 1, anchor + 3);
    for (let i = Math.max(0, anchor - 2); i <= hi; i += 1) {
      if (carriedAt(ctx, i)) continue;
      const head = elidedHead(target[i]!);
      if (known.has(target[i]!) || (head && known.has(head)))
        return step(votes, undefined, "known-rendering-near");
    }
  }
  return step(votes, anchor, [...kinds].join("+"));
}

export interface WitnessEmptyContextOptions {
  lexicon?: WitnessRenderingLexicon;
  /**
   * Units whose visible carrier an earlier resolution of the verse withdrew
   * (option S): they are decided as overrides again, so that resolving a
   * verse twice gives the same decision.
   */
  overriddenCarrierUnits?: ReadonlySet<string>;
}

/**
 * Option S for one verse: untranslated words that option G left open
 * (`established` names the units G decided). Run after the reader carriers
 * are final and after G, before the occurrence decisions.
 */
export function proposeWitnessEmptyContexts(
  d: ResolutionDossier,
  established: ReadonlySet<string>,
  options: WitnessEmptyContextOptions = {}
): WitnessEmptyProposal[] {
  const target = d.words.map(exactToken);
  const proposals: WitnessEmptyProposal[] = [];
  for (const entry of d.units) {
    const { unit } = entry;
    if (unit.readingUnresolved || established.has(unit.id)) continue;
    const treatment = witnessTreatment(d, unit);
    if (!treatment?.empties.length) continue;
    const overridesCarrier =
      options.overriddenCarrierUnits?.has(unit.id) === true ||
      d.placements.some((p) => owns(unit, p) && visible(p));
    // A visible carrier gives way only to witnesses that all leave the word
    // untranslated, at least two of them, and only when no other source word
    // of the verse has its number: that carrier may then be the other's
    // (« Noé vécut 350 ans », where one of two שָׁנָה is on « ans »).
    if (
      overridesCarrier &&
      (treatment.empties.length < 2 ||
        treatment.renderings.length ||
        treatment.punctuated ||
        d.units.some(
          (other) =>
            other.unit.id !== unit.id &&
            other.unit.strong.some((s) => unit.strong.includes(s))
        ))
    )
      continue;
    const ctx: StepContext = {
      d,
      entry,
      unit,
      target,
      placements: d.placements.filter((p) => !owns(unit, p)),
      treatment,
      lexicon: options.lexicon
    };
    let found: StepResult | undefined;
    for (const run of [sameContextStep, neighbourStep]) {
      const r = run(ctx);
      if (r.anchor !== undefined) {
        // Without a carrier, G's own context is G's to establish.
        if (!overridesCarrier && r.detail === "same-context") break;
        found = r;
        break;
      }
      if (r.voted) break;
    }
    if (!found) continue;
    proposals.push({
      sourceUnitId: unit.id,
      insertAfterWordIndex: found.anchor!,
      witnesses: found.votes.map((v) => v.witness),
      families: [...new Set(found.votes.map((v) => v.family))].sort(),
      method: `witness-empty-${overridesCarrier ? "overrides-carrier" : "context"}:${found.detail}`,
      ...(overridesCarrier ? { overridesCarrier } : {})
    });
  }
  return proposals;
}
