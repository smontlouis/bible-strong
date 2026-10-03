/**
 * Greek article carried by the French determiner of its head (option R,
 * `articleDeterminers`).
 *
 * Concordance carries the article ὁ (G3588) on the French determiner that
 * introduces its noun: « dans la maison » puts G3588 on « la ». The determiner
 * keeps whatever it already carries (« vos » G5216+G3588, « cet »
 * G1565+G3588), and an elided article stays on its noun (« l'eau »). French
 * often drops the article (proper names, bare nouns), so the rule only follows
 * a witness that renders it: the Louis Segond 1910 witness must tag this very
 * article, by its source position, on a determiner (« la ») immediately
 * followed, with nothing but spaces between them, by the tag of its head word
 * (« maison » G3614@5), which the article precedes in the source. When our
 * own carrier of that head word starts on an elided word, the article goes
 * there; otherwise the target word just before it must be a determiner
 * (« la », « vos », « jusqu'au »).
 *
 * One candidate only. Never on a word that already carries an article, never
 * two articles on one word, never across merged verses. Anything less leaves
 * the article unresolved: a failed search proves nothing.
 */
import type { StrongLedgerAnnotation } from "./strongLedger.js";
import type { ResolutionCarrier, ResolutionUnit } from "./strongResolution.js";
import type { ResolutionDossier } from "./strongResolutionWorkflow.js";

export const ARTICLE_STRONG = "G3588";
/** The witness whose article tags the rule follows. */
export const ARTICLE_WITNESS = "Sg1910";
export const ARTICLE_DETERMINER_ASSURANCE = "witness-article-determiner";

const DETERMINERS = new Set(
  "le la les du des au aux son sa ses mon ma mes ton ta tes notre nos votre vos leur leurs ce cet cette ces".split(
    " "
  )
);
const ELIDED_ARTICLE = /^l['’]/iu;
const GLUED_DETERMINER = /^jusqu['’]aux?$/iu;
const lower = (word: string) =>
  word.normalize("NFC").toLocaleLowerCase("fr-FR");

/** One `<w>` mark of a witness verse, in text order. */
export interface ArticleWitnessMark {
  /** Strong numbers of the mark, each paired with its source position. */
  items: Array<{ strong: string; position?: number }>;
  text: string;
  /** Raw text between the previous mark (or the verse start) and this one. */
  gapBefore: string;
}

/** The article witness of one verse: its row reference and its marks. */
export interface ArticleWitness {
  name: string;
  ref: string;
  marks: ArticleWitnessMark[];
}

/** Marks of a tagged witness verse (publisher notes already removed). */
export function readArticleWitnessMarks(
  taggedText: string
): ArticleWitnessMark[] {
  const marks: ArticleWitnessMark[] = [];
  let cursor = 0;
  for (const match of taggedText.matchAll(/<w\b([^>]*)>([\s\S]*?)<\/w>/giu)) {
    const attributes = match[1] ?? "";
    const strongs = (/\bstrong="([^"]*)"/u.exec(attributes)?.[1] ?? "")
      .split(/\s+/u)
      .filter(Boolean);
    const positions = (/\bpos="([^"]*)"/u.exec(attributes)?.[1] ?? "")
      .split("+")
      .map((value) => (/^\d+$/u.test(value) ? Number(value) : undefined));
    marks.push({
      // « G3588 G0846 » with pos « 6+8 » pairs by index; one position names all.
      items: strongs.map((strong, index) => ({
        strong,
        position:
          positions.length === strongs.length
            ? positions[index]
            : positions.length === 1
              ? positions[0]
              : undefined
      })),
      text: (match[2] ?? "").replace(/<[^>]*>/gu, ""),
      gapBefore: taggedText.slice(cursor, match.index)
    });
    cursor = match.index! + match[0].length;
  }
  return marks;
}

/** `TAGNT.Matt.10.12.4.NKO.main:0` names word 4 of Matt.10.12. */
function sourceWord(occurrenceId: string) {
  const match = /^TA(?:HOT|GNT)\.([^.]+\.\d+\.\d+)\.(\d+)\./u.exec(
    occurrenceId
  );
  return match ? { ref: match[1]!, position: Number(match[2]) } : undefined;
}

export interface ArticleDeterminerProposal {
  sourceUnitId: string;
  /** Target word carrying the article. */
  wordIndex: number;
  how: "determiner" | "elided" | "glued";
  headUnitId: string;
  /** The head as the witness names it: `G3614@5`. */
  head: string;
  /** The witness determiner carrying the article (« la »). */
  witnessDeterminer: string;
}

/** The decision fields this pass reads and rewrites. */
export interface ArticleDeterminerDecision {
  sourceUnitId: string;
  state: "visible" | "empty" | "unresolved";
  assurance: string;
  targetWordIndices: number[];
  reasons: string[];
  reviewApplied: boolean;
  display?: ResolutionCarrier;
}

const owns = (unit: ResolutionUnit, carrier: ResolutionCarrier) =>
  Boolean(
    carrier.originalOccurrenceId &&
    unit.occurrenceIds.includes(carrier.originalOccurrenceId)
  );

/**
 * Candidate generation: where each still unresolved article would go. Heads
 * are read from the decisions already taken for the verse, so this runs after
 * every other decision of the verse.
 */
export function proposeArticleDeterminerCarriers(
  d: ResolutionDossier,
  decisions: readonly ArticleDeterminerDecision[],
  witness: ArticleWitness
): ArticleDeterminerProposal[] {
  const units = d.units.map((entry) => entry.unit);
  // Alternative identifiers of one source word share its position.
  const words = units.map((unit) => sourceWord(unit.occurrenceIds[0] ?? ""));
  // Positions number the words of one source verse: a merged verse could
  // pair an article with a word of its neighbour.
  if (
    witness.name !== ARTICLE_WITNESS ||
    !units.length ||
    units.some(
      (unit) =>
        !unit.occurrenceIds.every((id) => sourceWord(id)?.ref === witness.ref)
    )
  )
    return [];
  const decisionOf = new Map(decisions.map((x) => [x.sourceUnitId, x]));
  const articleOn = (wordIndex: number) =>
    d.placements.some(
      (p) =>
        p.kind !== "empty" &&
        p.strong === ARTICLE_STRONG &&
        p.startWordIndex! <= wordIndex &&
        p.endWordIndex! >= wordIndex
    );
  const proposals: ArticleDeterminerProposal[] = [];
  for (const [index, unit] of units.entries()) {
    const decision = decisionOf.get(unit.id);
    if (
      !decision ||
      decision.state !== "unresolved" ||
      decision.reviewApplied ||
      decision.display ||
      unit.readingUnresolved ||
      unit.strong.length !== 1 ||
      unit.strong[0] !== ARTICLE_STRONG ||
      unit.occurrenceIds.length !== 1 ||
      d.placements.some((p) => owns(unit, p) && p.kind !== "empty")
    )
      continue;
    const position = words[index]!.position;
    const rendered = witness.marks.flatMap((mark, markIndex) =>
      mark.text.trim() &&
      mark.items.some(
        (item) => item.strong === ARTICLE_STRONG && item.position === position
      )
        ? [markIndex]
        : []
    );
    if (rendered.length !== 1) continue;
    const article = witness.marks[rendered[0]!]!;
    const witnessDeterminer = lower(article.text.trim());
    const next = witness.marks[rendered[0]! + 1];
    if (
      !DETERMINERS.has(witnessDeterminer) ||
      !next ||
      !next.text.trim() ||
      !/^\s*$/u.test(next.gapBefore)
    )
      continue;
    const candidates = new Map<number, ArticleDeterminerProposal>();
    for (const item of next.items) {
      // A Greek article comes before the word it determines.
      if (
        item.strong === ARTICLE_STRONG ||
        item.position === undefined ||
        item.position <= position
      )
        continue;
      const heads = units.filter(
        (head, headIndex) =>
          words[headIndex]?.position === item.position &&
          head.strong.includes(item.strong)
      );
      if (heads.length !== 1) continue;
      const head = decisionOf.get(heads[0]!.id);
      if (head?.state !== "visible" || !head.targetWordIndices.length) continue;
      const start = Math.min(...head.targetWordIndices);
      const before = d.words[start - 1];
      const how = ELIDED_ARTICLE.test(d.words[start] ?? "")
        ? "elided"
        : before !== undefined && DETERMINERS.has(lower(before))
          ? "determiner"
          : before !== undefined && GLUED_DETERMINER.test(before)
            ? "glued"
            : undefined;
      if (!how) continue;
      const wordIndex = how === "elided" ? start : start - 1;
      candidates.set(wordIndex, {
        sourceUnitId: unit.id,
        wordIndex,
        how,
        headUnitId: heads[0]!.id,
        head: `${item.strong}@${item.position}`,
        witnessDeterminer
      });
    }
    if (candidates.size !== 1) continue;
    const [proposal] = candidates.values();
    // A word naming the article twice would hide which one is wrong.
    if (articleOn(proposal!.wordIndex)) continue;
    proposals.push(proposal!);
  }
  // Two articles on one word are rejected together, never by order.
  return proposals.filter(
    (p) => !proposals.some((q) => p !== q && q.wordIndex === p.wordIndex)
  );
}

/**
 * The pass itself: place each proposed article on its determiner. Runs after
 * the verse's other decisions (it reads the heads' carriers) and before the
 * display carriers are materialised.
 */
export function applyArticleDeterminers(
  d: ResolutionDossier,
  decisions: ArticleDeterminerDecision[],
  projected: ResolutionCarrier[],
  witness: ArticleWitness
): ArticleDeterminerProposal[] {
  const proposals = proposeArticleDeterminerCarriers(d, decisions, witness);
  for (const proposal of proposals) {
    const decision = decisions.find(
      (x) => x.sourceUnitId === proposal.sourceUnitId
    )!;
    const unit = d.units.find((u) => u.unit.id === proposal.sourceUnitId)!.unit;
    decision.state = "visible";
    decision.assurance = ARTICLE_DETERMINER_ASSURANCE;
    decision.targetWordIndices = [proposal.wordIndex];
    decision.reasons.splice(
      0,
      decision.reasons.length,
      `article-on-head-determiner:${witness.name}:${proposal.witnessDeterminer}:${proposal.head}:${proposal.how}`
    );
    decision.display = {
      id: `article:${unit.id}`,
      strong: ARTICLE_STRONG,
      originalOccurrenceId: unit.occurrenceIds[0],
      kind: "word",
      startWordIndex: proposal.wordIndex,
      endWordIndex: proposal.wordIndex
    };
    projected.push(decision.display);
  }
  return proposals;
}

/**
 * The reader carrier of a placed article. The unit's own weak carrier (the
 * complete alignment's guess, or a reader empty) moves onto the determiner;
 * without one, a carrier is added. Returns the carrier.
 */
export function carryArticleOnDeterminer(options: {
  ref: string;
  annotations: StrongLedgerAnnotation[];
  occurrenceIds: string[];
  proposal: ArticleDeterminerProposal;
  normalizedWord?: string;
}): StrongLedgerAnnotation {
  const { annotations, proposal } = options;
  const linked = annotations.filter(
    (a) =>
      a.originalOccurrenceId !== undefined &&
      options.occurrenceIds.includes(a.originalOccurrenceId)
  );
  const rank = (a: StrongLedgerAnnotation) =>
    a.visibility === "reader"
      ? 0
      : a.placement === "word" || a.placement === "phrase"
        ? 1
        : a.placement === "technical" || a.placement === "empty"
          ? 2
          : 3;
  let carrier = [...linked].sort((a, b) => rank(a) - rank(b))[0];
  if (!carrier) {
    carrier = {
      id: `${options.ref}:${annotations.length}:${ARTICLE_STRONG}`,
      strong: ARTICLE_STRONG,
      visibility: "reader",
      placement: "word",
      source: "reference-transfer",
      confidence: 0,
      reason: "",
      diagnostics: [],
      originalOccurrenceId: options.occurrenceIds[0]
    };
    annotations.push(carrier);
  }
  // One reader carrier per source word.
  for (const other of linked)
    if (other !== carrier && other.visibility === "reader") {
      other.visibility = "hidden";
      other.placement = "duplicate";
    }
  carrier.visibility = "reader";
  carrier.placement = "word";
  carrier.source = "reference-transfer";
  carrier.confidence = Math.max(carrier.confidence, 0.9);
  carrier.reason = `Visible in reader mode because ${ARTICLE_WITNESS} carries this article on the determiner of its head word (${proposal.head}), and the target's determiner introduces our carrier of that head.`;
  carrier.diagnostics = [
    ARTICLE_DETERMINER_ASSURANCE,
    proposal.how,
    `head:${proposal.head}`,
    `witness:${ARTICLE_WITNESS}:${proposal.witnessDeterminer}`
  ];
  carrier.wordIndex = proposal.wordIndex;
  carrier.normalizedWord = options.normalizedWord;
  carrier.startWordIndex = undefined;
  carrier.endWordIndex = undefined;
  carrier.normalizedPhrase = undefined;
  carrier.insertAfterWordIndex = undefined;
  carrier.emptyEvidence = undefined;
  return carrier;
}
