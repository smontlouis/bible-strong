import type { ReferenceSource } from "./align.js";
import type { OriginalStrongOccurrence } from "./completeAlignment.js";
import type {
  StrongLedgerAnnotation,
  StrongLedgerToken
} from "./strongLedger.js";
import { STRONG_IDENTIFIER_ALIASES } from "./strongIdentifierFamilies.js";
import type { SourceRow } from "./strongSourceUnits.js";

/**
 * Flag M (`witnessAttestedReadings`): a source word that stays unresolved only
 * because STEP records an open reading for it (Ketiv/Qere, manuscript
 * variant) is decided visible when the witnesses already carry it exactly in
 * the target. Gn 9.21 #7 אָהֳלֹה is a Qere (Q(K), H0168): Sg1910, Darby and
 * DarbyR all put H0168 on « tente » at word 7, the witness transfer carries
 * H0168 on the target's « tente »: the word is placed there, and the decision
 * keeps its reading code.
 *
 * Every condition is required:
 * - the reading belongs to the base text, as for policy A: Nestle-Aland for
 *   TAGNT (`N` in the code), Leningrad or its Qere for TAHOT (`L`, `Q`). A word
 *   found only in the Textus Receptus (« K », « k », « KO »), only in the Ketiv
 *   or only in the LXX (« X ») stays unresolved: the witnesses follow the
 *   Textus Receptus, so their agreement says nothing of a target translating
 *   another text;
 * - every reader carrier of the word comes from exact witness transfer (the
 *   witnesses' own word form, not a stem, locution, lexicon, clitic or digit
 *   match), on one target word, with one identifier;
 * - two witness families (Segond; Darby and DarbyR) tag that identifier on the
 *   same word form and name this source word: its position, or a position at
 *   most three words away (the witnesses number Ketiv/Qere and Nestle-Aland
 *   word order as BHS and NA do, STEP numbers the Ketiv and its own order) that
 *   no other source word of the verse with that identifier occupies.
 *
 * The identifier shown is the witnesses'; the decision records whether it is
 * STEP's base-text identifier or a variant's. A failed test leaves the word
 * unresolved: it never proves an absence.
 */
export interface WitnessAttestedReading {
  /** STEP reading code of the source word, e.g. « Q(K) » or « N(k)O ». */
  reading: string;
  /** Identifier carried by the target word. */
  strong: string;
  /** The identifier is STEP's base-text one, or a variant reading's. */
  identifier: "base-text" | "variant";
  carrierIds: string[];
  /** Witnesses naming the source word on the carrier's form. */
  witnesses: string[];
  families: string[];
}

/** Largest renumbering between STEP's and the witnesses' word positions. */
export const WITNESS_POSITION_SHIFT = 3;

/** Nestle-Aland for TAGNT, Leningrad or its Qere for TAHOT (as policy A). */
export function baseTextReading(
  row: Pick<SourceRow, "source" | "reading">
): boolean {
  return row.source === "TAGNT"
    ? /N/u.test(row.reading)
    : /^[LQ]/u.test(row.reading);
}

/** `H0168`, `H168`, `H0168G` → `H168`. */
const identityKey = (code: string) => {
  const match = /^([GH])0*(\d+)/iu.exec(code.trim());
  return match ? `${match[1]!.toUpperCase()}${match[2]}` : code.toUpperCase();
};

/** Base-text identifiers of a STEP word, with their witness family aliases. */
export function baseTextIdentities(row: Pick<SourceRow, "primary">) {
  const identities = new Set<string>();
  for (const code of row.primary) {
    const key = identityKey(code);
    identities.add(key);
    for (const [stepCode, aliases] of STRONG_IDENTIFIER_ALIASES)
      if (identityKey(stepCode) === key)
        for (const alias of aliases) identities.add(identityKey(alias));
  }
  return identities;
}

/** `TAHOT.Gen.9.21.7.Q(K).main:0` names word 7. */
function sourcePosition(occurrenceId: string) {
  const match = /^TA(?:HOT|GNT)\.[^.]+\.\d+\.\d+\.(\d+)\./u.exec(occurrenceId);
  return match ? Number(match[1]) : undefined;
}

const witnessFamily = (reference: ReferenceSource) =>
  reference.family ??
  (reference.name.toLowerCase().startsWith("darby")
    ? "Darby-family"
    : reference.name);

const sameForm = (left: string, right: string) =>
  left.normalize("NFC").replace(/'/gu, "’") ===
  right.normalize("NFC").replace(/'/gu, "’");

export function witnessAttestedReading(options: {
  row: SourceRow;
  /** Occurrences of this source word. */
  occurrences: OriginalStrongOccurrence[];
  /** Every source occurrence of the verse block. */
  verseOccurrences: OriginalStrongOccurrence[];
  annotations: StrongLedgerAnnotation[];
  tokens: StrongLedgerToken[];
  references: ReferenceSource[];
  /** Canonical verses of the block: several never name one word's position. */
  canonicalRefs: string[];
}): WitnessAttestedReading | undefined {
  const { row } = options;
  if (!baseTextReading(row) || options.canonicalRefs.length !== 1)
    return undefined;
  const ids = new Set(options.occurrences.map((o) => o.occurrenceId));
  const linked = options.annotations.filter(
    (a) =>
      a.visibility === "reader" &&
      a.originalOccurrenceId !== undefined &&
      ids.has(a.originalOccurrenceId)
  );
  if (!linked.length) return undefined;
  // Exact witness transfer only: the witnesses' own word, nothing derived.
  if (
    !linked.every(
      (a) =>
        a.placement === "word" &&
        a.wordIndex !== undefined &&
        a.source === "reference-transfer" &&
        a.diagnostics[0] === "exact" &&
        !a.diagnostics.some((diagnostic) => diagnostic.includes("~"))
    )
  )
    return undefined;
  const wordIndices = new Set(linked.map((a) => a.wordIndex!));
  const strongs = new Set(linked.map((a) => identityKey(a.strong)));
  if (wordIndices.size !== 1 || strongs.size !== 1) return undefined;
  const [strong] = strongs as Set<string>;
  const form = options.tokens[[...wordIndices][0]!]?.normalized;
  const positions = new Set(
    [...ids].flatMap((id) => {
      const position = sourcePosition(id);
      return position === undefined ? [] : [position];
    })
  );
  if (form === undefined || positions.size !== 1) return undefined;
  const [position] = positions as Set<number>;
  // Positions held by other source words bearing the same identifier.
  const taken = new Set(
    options.verseOccurrences.flatMap((o) => {
      const other = sourcePosition(o.occurrenceId);
      return !ids.has(o.occurrenceId) &&
        other !== undefined &&
        other !== position &&
        identityKey(o.strong) === strong
        ? [other]
        : [];
    })
  );
  const names = (tagged: number[]) =>
    tagged.includes(position) ||
    (tagged.some((p) => Math.abs(p - position) <= WITNESS_POSITION_SHIFT) &&
      !tagged.some((p) => taken.has(p)));
  const witnesses = options.references.filter((reference) =>
    (reference.verse?.tokens ?? []).some(
      (token) =>
        token.positions !== undefined &&
        names(token.positions) &&
        token.strong.some((code) => identityKey(code) === strong) &&
        sameForm(token.normalized, form)
    )
  );
  const families = [...new Set(witnesses.map(witnessFamily))].sort();
  if (families.length < 2) return undefined;
  return {
    reading: row.reading,
    strong: linked[0]!.strong,
    identifier: baseTextIdentities(row).has(strong) ? "base-text" : "variant",
    carrierIds: linked.map((a) => a.id),
    witnesses: witnesses.map((reference) => reference.name).sort(),
    families
  };
}
