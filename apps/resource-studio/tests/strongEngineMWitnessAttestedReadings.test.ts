import assert from "node:assert/strict";
import test from "node:test";
import type { ReferenceSource } from "../src/align.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import { resolveCanonicalVerse } from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import type { StrongLedgerAnnotation } from "../src/strongLedger.js";
import { parseSourceRow, type SourceRow } from "../src/strongSourceUnits.js";
import {
  baseTextIdentities,
  baseTextReading
} from "../src/strongWitnessAttestedReading.js";
import { tokenizeText } from "../src/tokenize.js";

// Gen.9.21 #7 is a Qere (Q(K)): Ketiv and Qere differ only by a suffix.
const QERE =
  "Gen.9.21#07=Q(K)\tאָהֳלֽ/וֹ\t'o.ho.L/o\ttent/ his\t{H0168G}/H9023\tHNcmsc/Sp3ms\tK= 'o.ho.Lo/h (אָהֳלֹ/ה) \"tent/ his\" (H0168G/H9023=HNcbsc/Sp3ms)\tL= אָהֳלֹֽ/ה ¦ ;\tH0168G\t\t\t";
// A Greek word of the Nestle-Aland text whose Textus Receptus reading differs.
const tagnt = (id: string, primary: string, variant: string, alt = "") =>
  `${id}\tἑτέραν (heteran)\ta different\t${primary}=A-ASF\tἕτερος=other\tNA28+NA27\t${variant}\t\totra\tother\t#12\t${primary}\t${alt}\t`;
const NA_WORD = tagnt(
  "Mat.10.23#12=N(k)O",
  "G2087",
  "ἄλλην (t=allēn) another - G0243=A-ASF in: TR+Byz",
  "G0243"
);
const TR_ONLY = tagnt(
  "Mat.10.23#12=K",
  "G2087",
  "ἄλλην (t=allēn) another - G0243=A-ASF in: TR+Byz"
);

const witness = (name: string, ref: string, tagged: string) => {
  const [bookId, chapter, verse] = ref.split(".");
  return {
    name,
    verse: {
      row: {
        bookId: bookId!,
        chapter: Number(chapter),
        verse: Number(verse),
        text: tagged
      },
      tokens: parseStrongTokens(tagged)
    }
  } satisfies ReferenceSource;
};

function fixture(options: {
  line: string;
  file: string;
  strongs: string[];
  /** Carrier: identifier index, target word, transfer method. */
  carrier?: { strong: number; wordIndex: number; diagnostic?: string };
  words: string[];
  references: ReferenceSource[];
  canonicalRefs?: string[];
  /** Another source word of the verse (STEP line) with one identifier. */
  otherWord?: { line: string; strong: string };
}) {
  const row: SourceRow = parseSourceRow(options.line, options.file, 1)!;
  const occurrence = (
    source: SourceRow,
    strong: string,
    j: number
  ): OriginalStrongOccurrence => ({
    occurrenceId: `${source.id}.main:${j}`,
    tokenId: `${source.id}.main`,
    tokenIndex: source.tokenIndex,
    sourceIdentity: source.id,
    strong,
    sourceStrong: strong,
    text: source.surface,
    gloss: source.gloss,
    lemma: source.surface,
    morph: "HNcmsc",
    pos: ""
  });
  const occurrences = options.strongs.map((strong, j) =>
    occurrence(row, strong, j)
  );
  const other = options.otherWord
    ? parseSourceRow(options.otherWord.line, options.file, 2)!
    : undefined;
  const annotations: StrongLedgerAnnotation[] = options.carrier
    ? [
        {
          id: "a0",
          strong: options.strongs[options.carrier.strong]!,
          visibility: "reader",
          placement: "word",
          source: "reference-transfer",
          confidence: 0.99,
          reason: "fixture",
          diagnostics: [options.carrier.diagnostic ?? "exact", "Sg1910"],
          wordIndex: options.carrier.wordIndex,
          originalOccurrenceId:
            occurrences[options.carrier.strong]!.occurrenceId
        }
      ]
    : [];
  const text = options.words.join(" ");
  const ref = row.reference;
  return (policy: { witnessAttestedReadings?: boolean }) =>
    resolveCanonicalVerse({
      bible: "s21",
      verse: {
        ref,
        text,
        tokens: tokenizeText(text)
          .filter((t) => t.kind === "word")
          .map((t, wordIndex) => ({
            wordIndex,
            text: t.text,
            normalized: t.normalized
          })),
        annotations: structuredClone(annotations)
      },
      input: {
        mapping: {
          targetRefs: [ref],
          canonicalRefs: options.canonicalRefs ?? [ref],
          kind: "identity"
        } as never,
        occurrences: other
          ? [...occurrences, occurrence(other, options.otherWord!.strong, 0)]
          : occurrences,
        references: options.references,
        issues: []
      },
      sourceRows: new Map(
        [row, ...(other ? [other] : [])].map((source) => [source.id, source])
      ),
      lexicalItems: [],
      policy: { readingInvariantVariants: true, ...policy }
    }).decisions[0]!;
}

const tent = (pos = "7", strong = "H0168") => [
  witness(
    "Sg1910",
    "Gen.9.21",
    `au milieu de sa <w strong="${strong}" pos="${pos}">tente</w>.`
  ),
  witness(
    "Darby",
    "Gen.9.21",
    `au milieu de sa <w strong="${strong}" pos="${pos}">tente</w>.`
  )
];

test("base-text readings and identities follow STEP's codes", () => {
  const row = (line: string, file: string) => parseSourceRow(line, file, 1)!;
  assert.equal(baseTextReading(row(QERE, "TAHOT fixture.txt")), true);
  assert.equal(baseTextReading(row(NA_WORD, "TAGNT fixture.txt")), true);
  assert.equal(baseTextReading(row(TR_ONLY, "TAGNT fixture.txt")), false);
  assert.equal(
    baseTextReading({ source: "TAHOT", reading: "X" } as SourceRow),
    false
  );
  assert.deepEqual(
    [...baseTextIdentities(row(QERE, "TAHOT fixture.txt"))],
    ["H168"]
  );
  // A witness family alias names the same base-text word (G1492 / G3708).
  assert.ok(
    baseTextIdentities({ primary: ["G1492"] } as SourceRow).has("G3708")
  );
});

test("a Qere carried exactly by both witness families becomes visible", () => {
  const decide = fixture({
    line: QERE,
    file: "TAHOT fixture.txt",
    strongs: ["H0168"],
    carrier: { strong: 0, wordIndex: 4 },
    words: ["au", "milieu", "de", "sa", "tente"],
    references: tent()
  });
  const off = decide({});
  assert.equal(off.state, "unresolved");
  assert.deepEqual(off.reasons, ["unresolved-source-reading"]);
  const on = decide({ witnessAttestedReadings: true });
  assert.equal(on.state, "visible");
  assert.deepEqual(on.targetWordIndices, [4]);
  assert.equal(on.assurance, "witness-attested-reading");
  assert.equal(on.source.readingVariant, "witness-attested");
  assert.deepEqual(on.reasons, [
    "witness-attested-reading",
    "source-reading:Q(K)",
    "identifier:base-text",
    "witnesses:Darby+Sg1910"
  ]);
});

test("one witness family, another position or another form is not enough", () => {
  const base = {
    line: QERE,
    file: "TAHOT fixture.txt",
    strongs: ["H0168"],
    carrier: { strong: 0, wordIndex: 4 },
    words: ["au", "milieu", "de", "sa", "tente"]
  };
  const on = { witnessAttestedReadings: true };
  // Darby and DarbyR are one family.
  const darbyOnly = [
    witness("Darby", "Gen.9.21", '<w strong="H0168" pos="7">tente</w>'),
    witness("DarbyR", "Gen.9.21", '<w strong="H0168" pos="7">tente</w>')
  ];
  assert.equal(
    fixture({ ...base, references: darbyOnly })(on).state,
    "unresolved"
  );
  // The witnesses name another source word, more than three words away.
  assert.equal(
    fixture({ ...base, references: tent("11") })(on).state,
    "unresolved"
  );
  // The witnesses carry the identifier on another word form.
  assert.equal(
    fixture({
      ...base,
      words: ["au", "milieu", "de", "son", "pavillon"],
      references: tent()
    })(on).state,
    "unresolved"
  );
  // A block of several canonical verses cannot name the word's position.
  assert.equal(
    fixture({
      ...base,
      references: tent(),
      canonicalRefs: ["Gen.9.21", "Gen.9.22"]
    })(on).state,
    "unresolved"
  );
});

test("a nearby witness position names the word unless another one holds it", () => {
  const base = {
    line: QERE,
    file: "TAHOT fixture.txt",
    carrier: { strong: 0, wordIndex: 4 },
    words: ["au", "milieu", "de", "sa", "tente"],
    references: tent("8")
  };
  const on = { witnessAttestedReadings: true };
  // BHS numbers the Qere one word further than STEP's Ketiv numbering.
  assert.equal(fixture({ ...base, strongs: ["H0168"] })(on).state, "visible");
  // Word 8 is another H0168 of the verse: the witnesses name that word.
  const otherWord = {
    line: "Gen.9.21#08=L\tאֹ֫הֶל\t'o.hel\ttent\t{H0168G}\tHNcmsa\t\t\tH0168G\t\t\t",
    strong: "H0168"
  };
  const decision = fixture({ ...base, strongs: ["H0168"], otherWord })(on);
  assert.equal(decision.state, "unresolved");
  assert.deepEqual(decision.reasons, ["unresolved-source-reading"]);
  // Naming word 7 itself still attests it.
  assert.equal(
    fixture({ ...base, strongs: ["H0168"], otherWord, references: tent() })(on)
      .state,
    "visible"
  );
});

test("only an exact witness carrier on one word qualifies", () => {
  const base = {
    line: QERE,
    file: "TAHOT fixture.txt",
    strongs: ["H0168"],
    words: ["au", "milieu", "de", "sa", "tente"],
    references: tent()
  };
  const on = { witnessAttestedReadings: true };
  assert.equal(
    fixture({
      ...base,
      carrier: { strong: 0, wordIndex: 4, diagnostic: "stem" }
    })(on).state,
    "unresolved"
  );
  // Without any carrier the word stays open: no absence is inferred.
  const none = fixture(base)(on);
  assert.equal(none.state, "unresolved");
  assert.deepEqual(none.reasons, ["unresolved-source-reading"]);
});

test("a word absent from the Nestle-Aland text stays unresolved", () => {
  // The witnesses follow the Textus Receptus (ἄλλην, G0243).
  const references = [
    witness(
      "Sg1910",
      "Matt.10.23",
      'dans une <w strong="G0243" pos="12">autre</w>'
    ),
    witness(
      "Darby",
      "Matt.10.23",
      'dans une <w strong="G0243" pos="12">autre</w>'
    )
  ];
  const make = (line: string) =>
    fixture({
      line,
      file: "TAGNT fixture.txt",
      strongs: ["G2087", "G0243"],
      carrier: { strong: 1, wordIndex: 2 },
      words: ["dans", "une", "autre"],
      references
    })({ witnessAttestedReadings: true });
  const attested = make(NA_WORD);
  assert.equal(attested.state, "visible");
  assert.equal(attested.source.readingVariant, "witness-attested");
  // The identifier shown is the witnesses' variant: the decision says so.
  assert.ok(attested.reasons.includes("identifier:variant"));
  assert.equal(make(TR_ONLY).state, "unresolved");
});
