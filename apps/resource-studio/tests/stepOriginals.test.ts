import { existsSync } from "node:fs";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  readStepOriginalData,
  readStepOriginalEvidenceIndex,
  readStepOriginalTokensForRefs,
  readStepOriginalTokens,
  readStepOriginalVerseMap,
  selectStepEvidenceForRefs,
  selectStepEvidenceForOccurrence,
  selectStepOriginalTokensForRefs
} from "../src/stepOriginals.js";
import { getOriginalStrongOccurrences } from "../src/completeAlignment.js";

test("uses TAGNT dStrong as the STEP candidate instead of simple Strong", async () => {
  const filePath = await writeTempStepFile("TAGNT Mat-Jhn.txt", [
    [
      "Mat.1.1#03=NKO",
      "Ἰησοῦ (Iēsou)",
      "of Jesus",
      "G2424G=N-GSM-P",
      "Ἰησοῦς=Jesus/Joshua",
      "NA28+TR",
      "",
      "",
      "",
      "",
      "",
      "G2424",
      ""
    ].join("\t")
  ]);

  const [token] = await readStepOriginalTokens(filePath);
  assert.deepEqual([...(token?.strongByBase.get("G2424") ?? [])], ["G2424G"]);
});

test("uses simple TAGNT alternates as aliases to the dStrong", async () => {
  const filePath = await writeTempStepFile("TAGNT Mat-Jhn.txt", [
    [
      "Mat.7.12#12=NKO",
      "ὑμᾶς (hymas)",
      "you",
      "G4771=P-2AP",
      "σύ=you",
      "NA28+TR",
      "",
      "",
      "",
      "",
      "",
      "G5213",
      ""
    ].join("\t")
  ]);

  const [token] = await readStepOriginalTokens(filePath);
  assert.deepEqual([...(token?.strongByBase.get("G5213") ?? [])], ["G4771"]);
});

test("filters TAHOT technical H90xx markers before alias mapping", async () => {
  const filePath = await writeTempStepFile("TAHOT Gen-Deu.txt", [
    [
      "Gen.1.10#12=L",
      "טֽוֹב\\׃",
      "Tov",
      "[it was] good",
      "{H2895}\\H9016",
      "HVqp3ms",
      "",
      "",
      "H2895",
      "H2896A",
      "",
      "{H2895=טוֹב=be pleasing}\\H9016=׃=verseEnd"
    ].join("\t")
  ]);

  const [token] = await readStepOriginalTokens(filePath);
  assert.deepEqual([...(token?.strongByBase.get("H2896") ?? [])], ["H2895"]);
  assert.equal(token?.strongByBase.has("H9016"), false);
});

test(
  "filters the real H9033_b technical alias from 1Sam.20.2",
  {
    skip: !existsSync("data/external/stepbible/amalgamated/TAHOT Jos-Est.txt")
  },
  async () => {
    const josEst = await readFile(
      "data/external/stepbible/amalgamated/TAHOT Jos-Est.txt",
      "utf8"
    );
    const realLine = josEst
      .split(/\r?\n/u)
      .find((line) => line.startsWith("1Sa.20.2#07="));
    assert.ok(realLine);
    assert.match(realLine, /\bH9033_b\b/u);

    const filePath = await writeTempStepFile("TAHOT H9033 fixture.txt", [
      realLine
    ]);
    const [token] = await readStepOriginalTokens(filePath);

    assert.equal(token?.ref, "1Sam.20.2");
    assert.deepEqual([...(token?.strongByBase.get("H3808") ?? [])], ["H3808"]);
    assert.equal(token?.strongByBase.has("H9033"), false);
  }
);

test("builds STEP evidence by verse and classical Strong", async () => {
  const filePath = await writeTempStepFile("TAGNT Mat-Jhn.txt", [
    [
      "Mat.1.1#03=NKO",
      "Ἰησοῦ (Iēsou)",
      "of Jesus",
      "G2424G=N-GSM-P",
      "Ἰησοῦς=Jesus/Joshua",
      "NA28+TR",
      "",
      "",
      "",
      "",
      "",
      "G2424",
      ""
    ].join("\t")
  ]);

  const index = await readStepOriginalEvidenceIndex([filePath]);
  const evidence = index.get("Matt.1.1")?.get("G2424")?.[0];

  assert.equal(evidence?.baseStrong, "G2424");
  assert.equal(evidence?.stepStrong, "G2424G");
  assert.equal(evidence?.source, "TAGNT");
  assert.equal(evidence?.tokenIndex, 3);
  assert.equal(evidence?.gloss, "of Jesus");
  assert.equal(evidence?.morphology, "N-GSM-P");
});

test("selects STEP evidence for the exact repeated dStrong occurrence", () => {
  const evidence = [
    {
      baseStrong: "H0001",
      stepStrong: "H0001A",
      source: "TAHOT" as const,
      tokenIndex: 3,
      type: "N",
      surface: "first",
      transliteration: "first",
      gloss: "first sense",
      morphology: "N",
      editions: ""
    },
    {
      baseStrong: "H0001",
      stepStrong: "H0001B",
      source: "TAHOT" as const,
      tokenIndex: 9,
      type: "N",
      surface: "second",
      transliteration: "second",
      gloss: "second sense",
      morphology: "N",
      editions: ""
    }
  ];

  const selected = selectStepEvidenceForOccurrence(evidence, {
    tokenIndex: 9,
    sourceStrong: "H0001B"
  });

  assert.deepEqual(
    selected.map((item) => item.gloss),
    ["second sense"]
  );
});

test("keeps STEP source indexes separate from alignment ordinals", async () => {
  const filePath = await writeTempStepFile("TAHOT Gen-Deu.txt", [
    tahotSenseLine(1, "first", "H0001A"),
    tahotSenseLine(2, "second", "H0001B")
  ]);
  const data = await readStepOriginalData([filePath]);
  const verse = data.verseMap.get("Gen.1.1");
  assert.ok(verse);
  const occurrences = getOriginalStrongOccurrences(verse);

  assert.deepEqual(
    occurrences.map((occurrence) => ({
      tokenIndex: occurrence.tokenIndex,
      ordinalTokenIndex: occurrence.ordinalTokenIndex,
      sourceTokenIndex: occurrence.sourceTokenIndex,
      sourceStrong: occurrence.sourceStrong
    })),
    [
      {
        tokenIndex: 1,
        ordinalTokenIndex: 0,
        sourceTokenIndex: 1,
        sourceStrong: "H0001A"
      },
      {
        tokenIndex: 2,
        ordinalTokenIndex: 1,
        sourceTokenIndex: 2,
        sourceStrong: "H0001B"
      }
    ]
  );

  const second = occurrences[1]!;
  const selected = selectStepEvidenceForOccurrence(
    data.evidenceIndex.get("Gen.1.1")?.get("H0001") ?? [],
    {
      tokenIndex: second.tokenIndex,
      sourceStrong: second.sourceStrong
    }
  );
  assert.deepEqual(
    selected.map((item) => [item.tokenIndex, item.stepStrong, item.gloss]),
    [[2, "H0001B", "second"]]
  );
});

test("builds original inventory from STEP dStrong without WLC suffix normalization", async () => {
  const filePath = await writeTempStepFile("TAHOT Gen-Deu.txt", [
    [
      "Gen.1.1#01=N",
      "בְּרֵאשִׁ֖ית",
      "be.re.Shit",
      "in beginning",
      "H7225A",
      "HNcfsa",
      "",
      "",
      "H7225",
      "",
      "",
      "{H7225=רֵאשִׁית=beginning}"
    ].join("\t")
  ]);

  const map = await readStepOriginalVerseMap([filePath]);
  const verse = map.get("Gen.1.1");
  const token = verse?.tokens[0];

  assert.deepEqual(token?.strong, ["H7225"]);
  assert.deepEqual(token?.sourceStrong, ["H7225A"]);
  assert.equal(verse?.strongSet.has("H1886"), false);
});

test(
  "preserves the real H2148V and H2148v STEP occurrences as distinct",
  {
    skip:
      !existsSync("data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt") ||
      !existsSync("data/external/stepbible/amalgamated/TAHOT Jos-Est.txt")
  },
  async () => {
    const [isaMal, josEst] = await Promise.all([
      readFile("data/external/stepbible/amalgamated/TAHOT Isa-Mal.txt", "utf8"),
      readFile("data/external/stepbible/amalgamated/TAHOT Jos-Est.txt", "utf8")
    ]);
    const lowercase = isaMal
      .split(/\r?\n/u)
      .find((line) => line.startsWith("Zec.1.1#10="));
    const uppercase = josEst
      .split(/\r?\n/u)
      .find((line) => line.startsWith("Neh.11.4#13="));
    assert.ok(lowercase);
    assert.ok(uppercase);
    const filePath = await writeTempStepFile("TAHOT case fixture.txt", [
      lowercase,
      uppercase
    ]);

    const tokens = await readStepOriginalTokens(filePath);
    assert.deepEqual(
      tokens.map((token) => [
        token.ref,
        [...(token.strongByBase.get("H2148") ?? [])]
      ]),
      [
        ["Zech.1.1", ["H2148v"]],
        ["Neh.11.4", ["H2148V"]]
      ]
    );
  }
);

test("maps observed TAHOT book aliases and alternate references", async () => {
  const filePath = await writeTempStepFile("TAHOT Isa-Mal.txt", [
    [
      "Ezk.1.1#01=L",
      "וַ/יְהִ֣י\\׀",
      "va/y.Hi",
      "and/ it was",
      "H9001/{H1961}\\H9015",
      "Hc/Vqw3ms",
      "",
      "",
      "H1961",
      "",
      "",
      "H9001=ו=&/{H1961=הָיָה=to be}\\H9015=׀=separate"
    ].join("\t"),
    [
      "Jol.2.28(3.1)#01=L",
      "וְ/הָיָ֣ה",
      "ve/ha.Yah",
      "and/ it shall happen",
      "H9001/{H1961}",
      "Hc/Vqq3ms",
      "",
      "",
      "H1961",
      "",
      "",
      "H9001=ו=&/{H1961=הָיָה=to be}"
    ].join("\t"),
    [
      "Nam.1.1#01=N",
      "מַשָּׂ֖א",
      "ma.Sa",
      "burden",
      "{H4853A}",
      "HNcmsa",
      "",
      "",
      "H4853",
      "",
      "",
      "{H4853A=מַשָּׂא=burden}"
    ].join("\t")
  ]);

  const map = await readStepOriginalVerseMap([filePath]);

  assert.equal(map.get("Ezek.1.1")?.strongSet.has("H1961"), true);
  assert.equal(map.get("Joel.2.28")?.strongSet.has("H1961"), true);
  assert.equal(map.get("Joel.3.1")?.strongSet.has("H1961"), true);
  assert.equal(map.get("Nah.1.1")?.strongSet.has("H4853"), true);
});

test("deduplicates a STEP occurrence selected through main and alt refs", async () => {
  const filePath = await writeTempStepFile("TAGNT Rom.txt", [
    [
      "Rom.3.25(3.26)#01=NKO",
      "δικαιοσύνης (dikaiosynēs)",
      "righteousness",
      "G1343A=N-GSF",
      "δικαιοσύνη=righteousness",
      "NA28+TR",
      "",
      "",
      "",
      "",
      "",
      "G1343",
      ""
    ].join("\t")
  ]);

  const selection = await readStepOriginalTokensForRefs(
    [filePath],
    new Set(["Rom.3.25", "Rom.3.26"])
  );

  assert.equal(selection.tokens.length, 1);
  assert.equal(selection.strongSet.has("G1343"), true);
  assert.equal(selection.tokens[0]?.stepSourceIdentity, "TAGNT.Rom.3.25.1.NKO");
  assert.equal(selection.tokens[0]?.stepMainRef, "Rom.3.25");
  assert.deepEqual(selection.tokens[0]?.stepAlternateRefs, ["Rom.3.26"]);
  assert.deepEqual(selection.tokens[0]?.stepReferenceProvenance, [
    { ref: "Rom.3.25", role: "main" },
    { ref: "Rom.3.26", role: "alt" }
  ]);

  const data = await readStepOriginalData([filePath]);
  const evidence = selectStepEvidenceForRefs(data.evidenceIndex, [
    "Rom.3.25",
    "Rom.3.26"
  ]);
  assert.equal(evidence.get("G1343")?.length, 1);
  assert.equal(
    evidence.get("G1343")?.[0]?.stepSourceIdentity,
    "TAGNT.Rom.3.25.1.NKO"
  );
  assert.equal(
    selectStepOriginalTokensForRefs(data.verseMap, ["Rom.3.26"], {
      requireMainRef: true
    }).tokens.length,
    0
  );
  assert.equal(
    selectStepEvidenceForRefs(data.evidenceIndex, ["Rom.3.26"], {
      requireMainRef: true
    }).get("G1343")?.length ?? 0,
    0
  );
});

test("prefers the alternate STEP projection over a colliding main ref", async () => {
  const filePath = await writeTempStepFile("TAHOT Jos-Est.txt", [
    tahotLine("Neh.10.36(10.37)#01=L", "premiers-nes", "H1060"),
    tahotLine("Neh.10.37(10.38)#01=L", "pate", "H6182")
  ]);
  const data = await readStepOriginalData([filePath]);

  const defaultSelection = selectStepOriginalTokensForRefs(data.verseMap, [
    "Neh.10.37"
  ]);
  assert.deepEqual(
    defaultSelection.tokens.map((token) => token.strong[0]).sort(),
    ["H1060", "H6182"]
  );

  const canonicalSelection = selectStepOriginalTokensForRefs(
    data.verseMap,
    ["Neh.10.37"],
    { preferAlternateRef: true }
  );
  assert.deepEqual(
    canonicalSelection.tokens.map((token) => token.strong[0]),
    ["H1060"]
  );
  assert.equal(canonicalSelection.tokens[0]?.stepMainRef, "Neh.10.36");

  const evidence = selectStepEvidenceForRefs(
    data.evidenceIndex,
    ["Neh.10.37"],
    { preferAlternateRef: true }
  );
  assert.deepEqual([...evidence.keys()], ["H1060"]);
  assert.equal(evidence.get("H1060")?.[0]?.stepMainRef, "Neh.10.36");
});

async function writeTempStepFile(
  fileName: string,
  lines: string[]
): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "step-originals-test-"));
  const filePath = path.join(dir, fileName);
  await writeFile(filePath, `${lines.join("\n")}\n`, "utf8");
  return filePath;
}

function tahotSenseLine(
  tokenIndex: number,
  gloss: string,
  dStrong: string
): string {
  return [
    `Gen.1.1#${String(tokenIndex).padStart(2, "0")}=N`,
    gloss,
    gloss,
    gloss,
    dStrong,
    "HNcmsa",
    "",
    "",
    "",
    "",
    "",
    ""
  ].join("\t");
}

function tahotLine(ref: string, gloss: string, dStrong: string): string {
  return [
    ref,
    gloss,
    gloss,
    gloss,
    `{${dStrong}}`,
    "HNcmsa",
    "",
    "",
    dStrong,
    "",
    "",
    `{${dStrong}=${gloss}}`
  ].join("\t");
}
