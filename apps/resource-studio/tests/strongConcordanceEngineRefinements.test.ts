import assert from "node:assert/strict";
import test from "node:test";
import { alignVerse, encliticHost, spelledFrenchNumber } from "../src/align.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  demoteAlternativeIdentityCarriers,
  identityInvariantReading,
  resolveCanonicalVerse,
  sourceIdentityGroups
} from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import {
  resolveEnginePolicy,
  type StrongLedgerAnnotation
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";

const witness = (tagged: string) => ({
  name: "Sg1910",
  verse: {
    row: { bookId: "Exod", chapter: 1, verse: 1, text: tagged },
    tokens: parseStrongTokens(tagged)
  }
});

test("enclitic hosts and one-word numerals are recognised narrowly", () => {
  assert.equal(encliticHost("dit-il"), "dit");
  assert.equal(encliticHost("va-t-il"), "va");
  assert.equal(encliticHost("jour-la"), "jour");
  assert.equal(encliticHost("petits-enfants"), undefined);
  assert.equal(encliticHost("il"), undefined);
  assert.equal(spelledFrenchNumber("3"), "trois");
  assert.equal(spelledFrenchNumber("17"), "dix-sept");
  assert.equal(spelledFrenchNumber("22"), "vingt-deux");
  assert.equal(spelledFrenchNumber("72"), "soixante-douze");
  assert.equal(spelledFrenchNumber("80"), "quatre-vingts");
  assert.equal(spelledFrenchNumber("97"), "quatre-vingt-dix-sept");
  assert.equal(spelledFrenchNumber("21"), undefined);
  assert.equal(spelledFrenchNumber("120"), undefined);
  assert.equal(spelledFrenchNumber("deux"), undefined);
});

test("witness transfer reaches enclitic hosts and digits only when enabled", () => {
  const references = [
    witness(
      'Moïse <w strong="H0559">dit</w> : <w strong="H7969">trois</w> jours.'
    )
  ];
  const off = alignVerse("Moïse, dit-il, 3 jours.", references);
  assert.equal(off.assignments.size, 0);
  const on = alignVerse(
    "Moïse, dit-il, 3 jours.",
    references,
    undefined,
    undefined,
    {
      encliticHosts: true,
      digitNumerals: true
    }
  );
  assert.deepEqual(on.assignments.get(1)?.strong, ["H0559"]);
  assert.equal(on.assignments.get(1)?.method, "exact");
  assert.match(on.assignments.get(1)?.source ?? "", /enclitic-host/u);
  assert.deepEqual(on.assignments.get(2)?.strong, ["H7969"]);
  assert.match(on.assignments.get(2)?.source ?? "", /digit-numeral/u);
});

const tagnt = (
  id: string,
  primary: string,
  meaningVariant = "",
  alternatives = ""
) =>
  parseSourceRow(
    `${id}\tσυ (su)\tyou\t${primary}=N-ASN\tlemma=gloss\tNA28+TR\t${meaningVariant}\t\tes\tgloss\t\t${primary.slice(0, 5)}\t${alternatives}\t`,
    "TAGNT fixture.txt",
    1
  )!;

test("only identity-preserving readings of the base text become decidable", () => {
  assert.equal(
    identityInvariantReading(
      tagnt(
        "Mat.5.13#21=N(k)O",
        "G0906G",
        "βληθῆναι (t=blēthēnai) to be cast - G0906=V-APN in: TR+Byz"
      )
    ),
    true
  );
  assert.equal(
    identityInvariantReading(
      tagnt(
        "Mat.5.30#32=N(K)O",
        "G0565",
        "βληθῇ (T=blēthēa) may be cast - G0906=V-APS-3S in: TR",
        "G0906"
      )
    ),
    false
  );
  assert.equal(
    identityInvariantReading(tagnt("Mat.5.27#04=K", "G3588")),
    false
  );
  const qere = parseSourceRow(
    "Isa.58.14#07=Q(k)\tבָּ֣מֳתֵי\tba.mo.tei\thigh places\t{H1116}\tHNcfpc\t\tL= בָּ֣מֳותֵי ¦ ;K= בָּמוֹתֵי\tH1116\t\t\t",
    "TAHOT fixture.txt",
    1
  )!;
  assert.equal(identityInvariantReading(qere), true);
});

function resolutionFixture(options: {
  rows: string[];
  strongs: string[][];
  carriers: Array<{
    occurrence: [number, number];
    wordIndex: number;
    source: string;
    diagnostic: string;
    confidence: number;
  }>;
  words: string[];
}) {
  const rows = options.rows.map((line, index) =>
    parseSourceRow(line, "TAHOT fixture.txt", index + 1)!
  );
  const occurrences: OriginalStrongOccurrence[] = rows.flatMap((row, i) =>
    options.strongs[i]!.map((strong, j) => ({
      occurrenceId: `${row.id}.main:${j}`,
      tokenId: `${row.id}.main`,
      tokenIndex: i + 1,
      sourceIdentity: row.id,
      strong,
      sourceStrong: strong,
      text: row.surface,
      gloss: row.gloss,
      lemma: row.surface,
      morph: "HNcmpa",
      pos: ""
    }))
  );
  const annotations: StrongLedgerAnnotation[] = options.carriers.map(
    (carrier, index) => {
      const occurrence = occurrences.find(
        (candidate) =>
          candidate.sourceIdentity === rows[carrier.occurrence[0]]!.id &&
          candidate.occurrenceId.endsWith(`:${carrier.occurrence[1]}`)
      )!;
      return {
        id: `a${index}`,
        strong: occurrence.strong,
        visibility: "reader",
        placement: "word",
        source: carrier.source as StrongLedgerAnnotation["source"],
        confidence: carrier.confidence,
        reason: "fixture",
        diagnostics: [carrier.diagnostic],
        wordIndex: carrier.wordIndex,
        originalOccurrenceId: occurrence.occurrenceId
      };
    }
  );
  return {
    bible: "s21",
    verse: {
      ref: "Exod.10.7",
      text: options.words.join(" "),
      tokens: options.words.map((text, wordIndex) => ({
        wordIndex,
        text,
        normalized: text.toLowerCase()
      })),
      annotations
    },
    input: { occurrences, references: [], issues: [] },
    sourceRows: new Map(rows.map((row) => [row.id, row])),
    lexicalItems: []
  };
}

test("a reading variant that keeps the Strong identity no longer blocks an owned carrier", () => {
  const make = () =>
    resolutionFixture({
      rows: [
        "Isa.58.14#07=Q(k)\tבָּ֣מֳתֵי\tba.mo.tei\thigh places\t{H1116}\tHNcfpc\t\tL= בָּ֣מֳותֵי ¦ ;K= בָּמוֹתֵי\tH1116\t\t\t"
      ],
      strongs: [["H1116"]],
      carriers: [
        {
          occurrence: [0, 0],
          wordIndex: 1,
          source: "reference-transfer",
          diagnostic: "exact",
          confidence: 0.99
        }
      ],
      words: ["les", "hauteurs"]
    });
  const before = resolveCanonicalVerse(make());
  assert.equal(before.decisions[0]!.state, "unresolved");
  assert.ok(before.decisions[0]!.reasons.includes("unresolved-source-reading"));
  const after = resolveCanonicalVerse({
    ...make(),
    policy: { readingInvariantVariants: true }
  });
  assert.equal(after.decisions[0]!.state, "visible");
  assert.deepEqual(after.decisions[0]!.targetWordIndices, [1]);
  assert.equal(after.decisions[0]!.source.readingVariant, "identity-invariant");
});

test("alternative identifiers of one source word keep a single best-evidenced carrier", () => {
  const row =
    "Exo.10.7#13=L\tהָ֣/אֲנָשִׁ֔ים\tha./'a.na.Shim\tthe/ people\tH9009/{H0582}\tHTd/Ncmpa\t\t\tH0582\tH0376\t\t";
  const make = (
    secondSource = "phrase-transfer",
    secondDiagnostic = "learned-phrase",
    confidence = 0.6
  ) =>
    resolutionFixture({
      rows: [row],
      strongs: [["H0582", "H0376"]],
      carriers: [
        {
          occurrence: [0, 0],
          wordIndex: 0,
          source: secondSource,
          diagnostic: secondDiagnostic,
          confidence
        },
        {
          occurrence: [0, 1],
          wordIndex: 3,
          source: "reference-transfer",
          diagnostic: "exact",
          confidence: 0.99
        }
      ],
      words: ["gens", "laisse", "partir", "hommes"]
    });
  const before = resolveCanonicalVerse(make());
  assert.equal(before.decisions[0]!.state, "unresolved");
  assert.ok(
    before.decisions[0]!.reasons.includes("competing-existing-carriers")
  );
  const fixture = make();
  const after = resolveCanonicalVerse({
    ...fixture,
    policy: { singleCarrierPerSourceIdentity: true }
  });
  assert.equal(after.decisions[0]!.state, "visible");
  assert.deepEqual(after.decisions[0]!.targetWordIndices, [3]);
  assert.equal(fixture.verse.annotations[0]!.visibility, "hidden");
  assert.equal(fixture.verse.annotations[0]!.placement, "duplicate");
  assert.ok(
    fixture.verse.annotations[0]!.diagnostics.includes(
      "alternative-identifier-demoted"
    )
  );
  // The ledger refreshes a verse's metrics only when carriers were demoted.
  const direct = make();
  assert.equal(
    demoteAlternativeIdentityCarriers(
      direct.verse.annotations,
      sourceIdentityGroups(direct.input.occurrences)
    ),
    1
  );
  // Equal evidence is not arbitrated: the competition stays explicit.
  const tie = make("reference-transfer", "exact", 0.99);
  assert.equal(
    demoteAlternativeIdentityCarriers(
      make("reference-transfer", "exact", 0.99).verse.annotations,
      sourceIdentityGroups(tie.input.occurrences)
    ),
    0
  );
  const tied = resolveCanonicalVerse({
    ...tie,
    policy: { singleCarrierPerSourceIdentity: true }
  });
  assert.equal(tied.decisions[0]!.state, "unresolved");
  assert.equal(tie.verse.annotations[0]!.visibility, "reader");
});

test("the identifier used by the witnesses wins between alternative carriers", () => {
  // Rev.3.3 pattern: a learned "tu" claims σέ through the lemma identifier
  // while "te" carries the form identifier that every witness uses.
  const row =
    "Exo.10.7#13=L\tהָ֣/אֲנָשִׁ֔ים\tha./'a.na.Shim\tthe/ people\tH9009/{H0582}\tHTd/Ncmpa\t\t\tH0582\tH0376\t\t";
  const make = () =>
    resolutionFixture({
      rows: [row],
      strongs: [["H0582", "H0376"]],
      carriers: [
        {
          occurrence: [0, 0],
          wordIndex: 0,
          source: "reference-learned",
          diagnostic: "learned-translation",
          confidence: 0.73
        },
        {
          occurrence: [0, 1],
          wordIndex: 3,
          source: "reference-learned",
          diagnostic: "learned-translation",
          confidence: 0.7
        }
      ],
      words: ["gens", "laisse", "partir", "hommes"]
    });
  const unattested = make();
  resolveCanonicalVerse({
    ...unattested,
    policy: { singleCarrierPerSourceIdentity: true }
  });
  assert.equal(unattested.verse.annotations[0]!.visibility, "reader");
  assert.equal(unattested.verse.annotations[1]!.visibility, "hidden");
  const attested = make();
  const resolution = resolveCanonicalVerse({
    ...attested,
    input: {
      ...attested.input,
      references: [witness('les <w strong="H0376">hommes</w> partent')]
    },
    policy: { singleCarrierPerSourceIdentity: true }
  });
  assert.equal(attested.verse.annotations[0]!.visibility, "hidden");
  assert.equal(attested.verse.annotations[1]!.visibility, "reader");
  assert.deepEqual(resolution.decisions[0]!.targetWordIndices, [3]);
});

test("the engine enables every measured refinement by default and allows a full opt-out", () => {
  assert.deepEqual(resolveEnginePolicy(), {
    readingInvariantVariants: true,
    singleCarrierPerSourceIdentity: true,
    encliticHostTransfer: true,
    digitNumeralTransfer: true
  });
  assert.deepEqual(resolveEnginePolicy({ encliticHostTransfer: false }), {
    readingInvariantVariants: true,
    singleCarrierPerSourceIdentity: true,
    encliticHostTransfer: false,
    digitNumeralTransfer: true
  });
});
