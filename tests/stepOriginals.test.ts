import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  readStepOriginalData,
  readStepOriginalEvidenceIndex,
  readStepOriginalTokens,
  readStepOriginalVerseMap,
  selectStepEvidenceForOccurrence
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
