import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import {
  alignVerse,
  encliticHost,
  gluedClitics,
  spelledFrenchNumber
} from "../src/align.js";
import { alignReaderVerse } from "../src/readerAlignment.js";
import { readStepOriginalTokens } from "../src/stepOriginals.js";
import { buildWitnessLocutionLexicon } from "../src/witnessLocutionLexicon.js";
import {
  isFamily,
  type FamilyCandidate
} from "../scripts/strong-identifier-families/derive.js";
import type { OriginalStrongOccurrence } from "../src/completeAlignment.js";
import {
  demoteAlternativeIdentityCarriers,
  identityInvariantReading,
  resolveCanonicalVerse,
  sourceIdentityGroups
} from "../src/strongCanonicalResolution.js";
import { parseStrongTokens } from "../src/strongCsv.js";
import {
  linkReaderAnnotationsToOriginalOccurrences,
  resolveEnginePolicy,
  type StrongLedgerAnnotation
} from "../src/strongLedger.js";
import { parseSourceRow } from "../src/strongSourceUnits.js";
import {
  proposeWitnessEmpties,
  type ResolutionDossier
} from "../src/strongResolutionWorkflow.js";

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

test("a witness locution transfers as one multi-word carrier only when enabled", () => {
  const references = [
    witness(
      'Il partit, <w strong="H6435" head="peur">de peur que</w> le <w strong="H4428">roi</w> vienne.'
    )
  ];
  const text = "Il s’en alla de peur que le roi vienne.";
  // Disabled, the locution is matched through its head word alone.
  const off = alignVerse(text, references);
  assert.equal(off.locutions, undefined);
  assert.deepEqual(
    [3, 4, 5].map((index) => off.assignments.get(index)?.strong),
    [undefined, ["H6435"], undefined]
  );
  const on = alignVerse(text, references, undefined, undefined, {
    witnessLocutions: true
  });
  assert.deepEqual(
    on.locutions?.map(({ startWordIndex, endWordIndex, assignment }) => [
      startWordIndex,
      endWordIndex,
      assignment.strong
    ]),
    [[3, 5, ["H6435"]]]
  );
  assert.equal(on.assignments.has(4), false);
  assert.deepEqual(on.assignments.get(7)?.strong, ["H4428"]);
  // Scattered secondary words do not become carriers of their own.
  const partial = alignVerse(
    "Il partit de crainte que le roi vienne.",
    references,
    undefined,
    undefined,
    { witnessLocutions: true }
  );
  assert.deepEqual(partial.locutions, []);
  assert.equal(partial.assignments.has(2), false);
  assert.equal(partial.assignments.has(4), false);
});

test("a witness source position decides which repeated source word a carrier owns", () => {
  const tagged = parseStrongTokens(
    '<w strong="G3588" pos="5">le</w> <w strong="G3588">la</w>'
  );
  assert.deepEqual(tagged[0]!.positions, [5]);
  assert.equal(tagged[1]!.positions, undefined);
  const occurrence = (word: number): OriginalStrongOccurrence => ({
    occurrenceId: `TAGNT.Matt.1.1.${word}.NKO.main:0`,
    tokenId: `TAGNT.Matt.1.1.${word}.NKO.main`,
    tokenIndex: word,
    sourceTokenIndex: word,
    strong: "G3588",
    sourceStrong: "G3588",
    text: "ὁ",
    gloss: "the",
    lemma: "ὁ",
    morph: "T-NSM",
    pos: ""
  });
  const carrier = (sourcePositions?: string[]): StrongLedgerAnnotation => ({
    id: "",
    strong: "G3588",
    visibility: "reader",
    placement: "word",
    source: "reference-transfer",
    confidence: 0.99,
    reason: "fixture",
    diagnostics: ["exact"],
    wordIndex: 0,
    ...(sourcePositions ? { sourcePositions } : {})
  });
  const link = (annotation: StrongLedgerAnnotation) =>
    linkReaderAnnotationsToOriginalOccurrences({
      annotations: [annotation],
      originalOccurrences: [occurrence(1), occurrence(5)],
      wordCount: 6
    })[0]!.originalOccurrenceId;
  // Proximity alone links the first word to the first article.
  assert.equal(link(carrier()), "TAGNT.Matt.1.1.1.NKO.main:0");
  assert.equal(link(carrier(["Matt.1.1#5"])), "TAGNT.Matt.1.1.5.NKO.main:0");
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
  // On the same word there is no competition: one identifier stays, even on
  // a tie, STEP's first one.
  const sameWord = resolutionFixture({
    rows: [row],
    strongs: [["H0582", "H0376"]],
    carriers: [0, 1].map((index) => ({
      occurrence: [0, index] as [number, number],
      wordIndex: 3,
      source: "reference-transfer",
      diagnostic: "exact",
      confidence: 0.99
    })),
    words: ["gens", "laisse", "partir", "hommes"]
  });
  const resolved = resolveCanonicalVerse({
    ...sameWord,
    policy: { singleCarrierPerSourceIdentity: true }
  });
  assert.deepEqual(
    sameWord.verse.annotations.map((annotation) => [
      annotation.strong,
      annotation.visibility
    ]),
    [
      ["H0582", "reader"],
      ["H0376", "hidden"]
    ]
  );
  assert.equal(resolved.decisions[0]!.state, "visible");
  assert.deepEqual(resolved.decisions[0]!.targetWordIndices, [3]);
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

test("the engine enables refinements A–L by default, keeps M–S off until measured, and allows an opt-out", () => {
  const offUntilMeasured = {
    witnessAttestedReadings: false,
    compoundTargetWords: false,
    numeralValues: false,
    properNameVariants: false,
    lexicalGapFill: false,
    articleDeterminers: false,
    witnessEmptyContexts: false
  };
  assert.deepEqual(resolveEnginePolicy(), {
    readingInvariantVariants: true,
    singleCarrierPerSourceIdentity: true,
    encliticHostTransfer: true,
    digitNumeralTransfer: true,
    witnessLocutions: true,
    witnessSourcePositions: true,
    witnessEmpties: true,
    typographicApostrophes: true,
    strongIdentifierFamilies: true,
    cliticHosts: true,
    openingConjunctions: true,
    witnessLocutionLexicon: true,
    ...offUntilMeasured
  });
  assert.deepEqual(resolveEnginePolicy({ encliticHostTransfer: false }), {
    readingInvariantVariants: true,
    singleCarrierPerSourceIdentity: true,
    encliticHostTransfer: false,
    digitNumeralTransfer: true,
    witnessLocutions: true,
    witnessSourcePositions: true,
    witnessEmpties: true,
    typographicApostrophes: true,
    strongIdentifierFamilies: true,
    cliticHosts: true,
    openingConjunctions: true,
    witnessLocutionLexicon: true,
    ...offUntilMeasured
  });
});

test("an untranslated witness word is established only where its context recurs", () => {
  const dossier = (
    target: string[],
    secondWitness?: "visible"
  ): ResolutionDossier => ({
    edition: "s21",
    ref: "Gen.2.3",
    split: "authoring",
    text: target.join(" "),
    words: target,
    units: [
      {
        unit: {
          id: "TAHOT.Gen.2.3.7.L",
          occurrenceIds: ["TAHOT.Gen.2.3.7.L.main:0"],
          strong: ["H0853"],
          readingUnresolved: false,
          sourceEvidenceSha256: "fixture"
        },
        surface: "אֶת",
        gloss: "[obj]",
        morphology: "HTo",
        sourceFile: "fixture",
        sourceLine: 1
      }
    ],
    placements: [],
    witnesses: [
      {
        name: "Sg1910",
        family: "Sg1910",
        ref: "Gen.2.3",
        text: "il le sanctifia, parce qu’en ce jour",
        words: ["il", "le", "sanctifia", "parce", "qu’en", "ce", "jour"],
        placements: [
          {
            id: "w:0",
            strong: "H0853",
            kind: "empty",
            insertAfterWordIndex: 2,
            positions: [7]
          }
        ]
      },
      ...(secondWitness
        ? [
            {
              name: "Darby",
              family: "Darby-family",
              ref: "Gen.2.3",
              text: "il le sanctifia",
              words: ["il", "le", "sanctifia"],
              placements: [
                {
                  id: "w:1",
                  strong: "H0853",
                  kind: "word" as const,
                  startWordIndex: 1,
                  endWordIndex: 1,
                  positions: [7]
                }
              ]
            }
          ]
        : [])
    ]
  });
  assert.deepEqual(
    proposeWitnessEmpties(
      dossier(["et", "il", "le", "sanctifia", "parce", "qu'en", "ce", "jour"])
    ),
    [
      {
        sourceUnitId: "TAHOT.Gen.2.3.7.L",
        insertAfterWordIndex: 3,
        witnesses: ["Sg1910"],
        families: ["Sg1910"]
      }
    ]
  );
  // A witness that translates the same source word contradicts the absence.
  assert.deepEqual(
    proposeWitnessEmpties(
      dossier(
        ["et", "il", "le", "sanctifia", "parce", "qu'en", "ce", "jour"],
        "visible"
      )
    ),
    []
  );
  // Another context proves nothing.
  assert.deepEqual(
    proposeWitnessEmpties(dossier(["il", "le", "bénit", "parce", "qu'en"])),
    []
  );
  // A witness that numbers the verse otherwise names another word there.
  const renumbered = dossier([
    "et",
    "il",
    "le",
    "sanctifia",
    "parce",
    "qu'en",
    "ce",
    "jour"
  ]);
  renumbered.witnesses[0]!.placements[0]!.strong = "H3588";
  assert.deepEqual(proposeWitnessEmpties(renumbered), []);
});

test("a target apostrophe matches the witnesses' typographic one only when enabled", () => {
  const references = [
    witness('je t’ai engendré <w strong="G4594">aujourd’hui</w>.')
  ];
  const target = "je t'ai engendré aujourd'hui.";
  assert.equal(alignVerse(target, references).assignments.size, 0);
  const on = alignVerse(target, references, undefined, undefined, {
    typographicApostrophes: true
  });
  assert.deepEqual(
    [...on.assignments].map(([index, assignment]) => [
      index,
      assignment.strong
    ]),
    [[3, ["G4594"]]]
  );
  // Only the comparison form changes; the target keeps its own spelling.
  assert.ok(on.segments.some((segment) => segment.text === "aujourd'hui"));
});

test("clitics glued inside a target word are found in witness spelling", () => {
  assert.deepEqual(gluedClitics("m'avez"), ["m"]);
  assert.deepEqual(gluedClitics("Qu’il"), ["qu"]);
  assert.deepEqual(gluedClitics("jusqu'à"), ["jusqu"]);
  assert.deepEqual(gluedClitics("Apportez-les-moi"), ["moi", "les"]);
  assert.deepEqual(gluedClitics("va-t-il"), ["il"]);
  assert.deepEqual(gluedClitics("celui-ci"), []);
  assert.deepEqual(gluedClitics("aujourd'hui"), []);
  assert.deepEqual(gluedClitics("petits-enfants"), []);
});

test("a witness clitic is carried by the target word it is glued to only when enabled", () => {
  const pronoun = [
    witness('vous <w strong="G3165">m</w>’avez <w strong="G4016">vêtu</w>')
  ];
  const target = "vous m'avez vêtu";
  assert.deepEqual([...alignVerse(target, pronoun).assignments.keys()], [2]);
  const on = alignVerse(target, pronoun, undefined, undefined, {
    cliticHosts: true
  });
  assert.deepEqual(on.assignments.get(1)?.strong, ["G3165"]);
  // The host keeps its own number and gains the clitic's.
  const host = [
    witness('<w strong="G1581">Coupe</w>-<w strong="G0846">le</w> :')
  ];
  const both = alignVerse("Coupe-le:", host, undefined, undefined, {
    encliticHosts: true,
    cliticHosts: true
  });
  assert.deepEqual(both.assignments.get(0)?.strong, ["G1581", "G0846"]);
});

test("identifier families are conventions the lexicon relates and verses keep apart", () => {
  const candidate = (overrides: Partial<FamilyCandidate>): FamilyCandidate => ({
    step: "G1492",
    witness: "G3708",
    tags: 40,
    verses: 12,
    share: 0.032,
    relation: "same-ustrong",
    cooccurrence: 0.012,
    ...overrides
  });
  assert.equal(isFamily(candidate({})), true);
  // Jésus and Christ: related, but two words of one verse.
  assert.equal(isFamily(candidate({ cooccurrence: 0.219 })), false);
  assert.equal(isFamily(candidate({ relation: null })), false);
  assert.equal(isFamily(candidate({ verses: 4 })), false);
  assert.equal(isFamily(candidate({ share: 0.01 })), false);
  assert.equal(isFamily(candidate({ witness: "H3708" })), false);
});

test("a family identifier joins STEP's identifiers of the source word only when asked", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "step-families-"));
  const file = path.join(directory, "TAGNT fixture.txt");
  await writeFile(
    file,
    "Luk.13.35#15=NKO\tἴδητέ (idēte)\tshall you see\tG1492H=V-2AAS-2P\tεἴδω=to perceive\tNA28+NA27+Tyn+SBL+WH+Treg+TR+Byz\t\t\t\t\t#15\tG1492\n"
  );
  const [plain] = await readStepOriginalTokens(file);
  assert.deepEqual([...plain!.strongByBase.keys()], ["G1492"]);
  const [aliased] = await readStepOriginalTokens(file, {
    identifierAliases: new Map([["G1492", ["G3708"]]])
  });
  assert.deepEqual([...aliased!.strongByBase.keys()], ["G1492", "G3708"]);
  assert.deepEqual([...aliased!.strongByBase.get("G3708")!], ["G1492H"]);
});

test("a family identifier is a name of the word, not a STEP reading of it", () => {
  const make = () =>
    resolutionFixture({
      rows: [
        "Gen.14.17#07=L\tלִקְרָאתוֹ\tlik.ra.to\tto meet him\t{H7122}\tHVqc\t\t\tH7122\t\t\t"
      ],
      strongs: [["H7122", "H7125"]],
      carriers: [
        {
          occurrence: [0, 1],
          wordIndex: 2,
          source: "reference-transfer",
          diagnostic: "exact",
          confidence: 0.99
        }
      ],
      words: ["pour", "le", "rencontrer"]
    });
  const before = resolveCanonicalVerse(make());
  assert.equal(before.decisions[0]!.state, "unresolved");
  const after = resolveCanonicalVerse({
    ...make(),
    policy: { strongIdentifierFamilies: true }
  });
  assert.equal(after.decisions[0]!.state, "visible");
  assert.deepEqual(after.decisions[0]!.targetWordIndices, [2]);
  assert.deepEqual(after.decisions[0]!.strong, ["H7122", "H7125"]);
});

test("a conjunction opening the witness verse is carried only by the opening of the target", () => {
  const references = [
    witness(
      '<w strong="G2532">Et</w> il <w strong="G0450">se leva</w> et <w strong="G2064">vint</w> vers eux.'
    )
  ];
  // The target adds its own « et » further on: « Et » renders nothing there.
  const added = "Après avoir prié, il se releva et vint vers eux.";
  assert.deepEqual(alignVerse(added, references).assignments.get(6)?.strong, [
    "G2532"
  ]);
  const on = alignVerse(added, references, undefined, undefined, {
    openingConjunctions: true
  });
  assert.equal(on.assignments.get(6), undefined);
  // A target opening with the conjunction still receives it.
  const opening = alignVerse(
    "Et il se releva et vint vers eux.",
    references,
    undefined,
    undefined,
    { openingConjunctions: true }
  );
  assert.deepEqual(opening.assignments.get(0)?.strong, ["G2532"]);
});

test("the witness locution lexicon keeps locutions the witnesses tag repeatedly", () => {
  const verse = (tagged: string) => ({ tokens: parseStrongTokens(tagged) });
  const lexicon = buildWitnessLocutionLexicon([
    verse('<w strong="G1063">En effet</w>, il vint.'),
    verse('<w strong="G1063">En effet</w>, il partit.'),
    verse('<w strong="H5704">jusqu’à ce que</w> le jour vienne.'),
    verse('<w strong="G1063">en effet</w> nous savons.'),
    verse('<w strong="H5704">jusqu’à ce que</w> tu viennes.')
  ]);
  assert.deepEqual(
    lexicon
      .get("en")
      ?.map((locution) => [
        locution.words.join(" "),
        [...locution.strongs],
        locution.count
      ]),
    [["en effet", ["G1063"], 3]]
  );
  // Two uses are not enough.
  assert.equal(lexicon.get("jusqu’a"), undefined);
});

test("a word carrying a locution's number covers the locution the witnesses tag elsewhere", () => {
  const elsewhere = {
    tokens: parseStrongTokens('<w strong="G1063">En effet</w>, il vint.')
  };
  const lexicon = buildWitnessLocutionLexicon([
    elsewhere,
    elsewhere,
    elsewhere
  ]);
  const references = [
    witness('En <w strong="G1063">effet</w>, il <w strong="G2064">vint</w>.')
  ];
  const policy = (locutionLexicon?: typeof lexicon) => ({
    maxStrongPerWord: 3,
    minEmptySourceAgreement: 2,
    learnedTranslationMinScore: 0.38,
    learnedFunctionWordMode: "restricted" as const,
    transferMatching: {
      witnessLocutions: true,
      ...(locutionLexicon ? { locutionLexicon } : {})
    }
  });
  const target = "En effet, il vint.";
  const off = alignReaderVerse({
    targetText: target,
    references,
    readerPolicy: policy()
  });
  assert.deepEqual(off.assignments.get(1)?.strong, ["G1063"]);
  assert.deepEqual(off.phraseAssignments, []);
  const on = alignReaderVerse({
    targetText: target,
    references,
    readerPolicy: policy(lexicon)
  });
  assert.equal(on.assignments.has(1), false);
  assert.deepEqual(
    on.phraseAssignments.map((phrase) => [
      phrase.startWordIndex,
      phrase.endWordIndex,
      phrase.strong
    ]),
    [[0, 1, ["G1063"]]]
  );
});
