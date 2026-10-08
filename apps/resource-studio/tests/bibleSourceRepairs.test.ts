import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { describe, it } from "node:test";

import {
  applyBibleSourceRepairs,
  carryWordsOfJesusThroughRepairs,
  hashVerseTexts,
  type BibleSourceRepair,
  type BibleSourceRepairs
} from "../src/bibleSourceRepairs.js";
import {
  hashVerseText,
  type WordsOfJesusDataset
} from "../src/wordsOfJesus.js";

const SOURCE_SHA256 = "a".repeat(64);
const EVIDENCE = "fixture";

const repair = (bible: unknown, repairs: BibleSourceRepair[]) =>
  applyBibleSourceRepairs({
    versionId: "TEST",
    sourceSha256: SOURCE_SHA256,
    bible,
    repairs: { sourceSha256: SOURCE_SHA256, repairs }
  });

const datasetOf = (
  verses: WordsOfJesusDataset["verses"]
): WordsOfJesusDataset => ({
  format: "bible-strong-words-of-jesus",
  schemaVersion: 1,
  versionId: "TEST",
  verses
});

const textOf = (bible: unknown) => (ref: string) => {
  const [book, chapter, verse] = ref.split("-") as [string, string, string];
  return (bible as Record<string, Record<string, Record<string, string>>>)[
    book
  ]?.[chapter]?.[verse];
};

describe("Bible source repairs", () => {
  it("splits a verse at the literal number of the missing next verse", () => {
    const source = {
      24: { 23: { 18: "Who heard?\n 19 The storm.", 20: "x" } }
    };
    const applied = repair(source, [
      {
        op: "split",
        ref: "24-23-18",
        at: 11,
        marker: " 19 ",
        expect: hashVerseText("Who heard?\n 19 The storm."),
        result: [hashVerseText("Who heard?\n"), hashVerseText("The storm.")],
        evidence: EVIDENCE
      }
    ]);

    assert.deepEqual(applied.bible, {
      24: { 23: { 18: "Who heard?\n", 19: "The storm.", 20: "x" } }
    });
    // The source value is left untouched.
    assert.equal(source[24][23][18], "Who heard?\n 19 The storm.");
    assert.deepEqual(applied.origins["24-23-19"], [
      { sourceRef: "24-23-18", sourceStart: 15, sourceEnd: 25, targetStart: 0 }
    ]);
  });

  it("joins a verse cut in two and renumbers the rows that follow", () => {
    const applied = repair(
      { 48: { 3: { 27: "a", 28: "I", 29: "rest", 30: "last" } } },
      [
        {
          op: "join",
          ref: "48-3-28",
          separator: " ",
          expect: [hashVerseText("I"), hashVerseText("rest")],
          result: hashVerseText("I rest"),
          evidence: EVIDENCE
        },
        {
          op: "shift",
          chapter: "48-3",
          first: 30,
          last: 30,
          by: -1,
          expect: hashVerseTexts(["last"]),
          evidence: EVIDENCE
        }
      ]
    );

    assert.deepEqual(applied.bible, {
      48: { 3: { 27: "a", 28: "I rest", 29: "last" } }
    });
  });

  it("reads a letter where the source prints a digit", () => {
    const misprint = {
      op: "misprint",
      ref: "48-3-28",
      at: 1,
      printed: "1",
      reads: "l",
      expect: hashVerseText("I1 rest"),
      result: hashVerseText("Il rest"),
      evidence: EVIDENCE
    } as const;
    const applied = repair({ 48: { 3: { 28: "I1 rest" } } }, [misprint]);

    assert.deepEqual(applied.bible, { 48: { 3: { 28: "Il rest" } } });
    // One character for another: decisions keep their offsets.
    assert.deepEqual(applied.origins["48-3-28"], [
      { sourceRef: "48-3-28", sourceStart: 0, sourceEnd: 7, targetStart: 0 }
    ]);
    // Only a digit may be read as a letter, where the source prints it.
    for (const change of [{ at: 0 }, { printed: "I" }, { reads: "2" }]) {
      assert.throws(
        () =>
          applyBibleSourceRepairs({
            versionId: "TEST",
            sourceSha256: SOURCE_SHA256,
            bible: { 48: { 3: { 28: "I1 rest" } } },
            repairs: {
              sourceSha256: SOURCE_SHA256,
              repairs: [{ ...misprint, ...change }]
            },
            anchored: false
          }),
        /bible-source-repair-misprint-invalid:TEST:48-3-28/u
      );
    }
  });

  it("renumbers a run of rows numbered one too low", () => {
    const applied = repair({ 45: { 3: { 22: "a and b", 23: "c", 24: "d" } } }, [
      {
        op: "shift",
        chapter: "45-3",
        first: 23,
        last: 24,
        by: 1,
        expect: hashVerseTexts(["c", "d"]),
        evidence: EVIDENCE
      }
    ]);

    assert.deepEqual(applied.bible, {
      45: { 3: { 22: "a and b", 24: "c", 25: "d" } }
    });
  });

  it("moves a row filed under another book", () => {
    const applied = repair(
      { 16: { 7: { 64: "a", 66: "c" } }, 17: { 7: { 10: "z", 65: "b" } } },
      [
        {
          op: "move",
          ref: "17-7-65",
          to: "16-7-65",
          expect: hashVerseText("b"),
          evidence: EVIDENCE
        }
      ]
    );

    assert.deepEqual(applied.bible, {
      16: { 7: { 64: "a", 65: "b", 66: "c" } },
      17: { 7: { 10: "z" } }
    });
  });

  it("fails when the source is not the one the repairs were reviewed against", () => {
    const move: BibleSourceRepair = {
      op: "move",
      ref: "1-1-2",
      to: "1-1-3",
      expect: hashVerseText("b"),
      evidence: EVIDENCE
    };

    assert.throws(
      () =>
        applyBibleSourceRepairs({
          versionId: "TEST",
          sourceSha256: "b".repeat(64),
          bible: { 1: { 1: { 2: "b" } } },
          repairs: { sourceSha256: SOURCE_SHA256, repairs: [move] }
        }),
      /bible-source-repairs-source-mismatch:TEST/u
    );
    assert.throws(
      () => repair({ 1: { 1: { 2: "changed" } } }, [move]),
      /bible-source-repair-anchor-mismatch:TEST:1-1-2/u
    );
    assert.throws(
      () => repair({ 1: { 1: { 2: "b", 3: "c" } } }, [move]),
      /bible-source-repair-target-occupied:TEST:1-1-3/u
    );
    assert.throws(
      () => repair({ 1: { 1: { 1: "a" } } }, [move]),
      /bible-source-repair-verse-missing:TEST:1-1-2/u
    );
    assert.throws(
      () =>
        repair({ 1: { 1: { 1: "One. 2 Two." } } }, [
          {
            op: "split",
            ref: "1-1-1",
            at: 4,
            marker: " 3 ",
            expect: hashVerseText("One. 2 Two."),
            result: ["", ""],
            evidence: EVIDENCE
          }
        ]),
      /bible-source-repair-marker-missing:TEST:1-1-1/u
    );
  });

  it("carries words-of-Jesus decisions to the verse their text now belongs to", () => {
    const source = {
      40: {
        9: { 37: "He said: Pray. 38 Go now.", 39: "Narration.", 40: "Come." }
      }
    };
    const applied = repair(source, [
      {
        op: "split",
        ref: "40-9-37",
        at: 14,
        marker: " 38 ",
        expect: hashVerseText("He said: Pray. 38 Go now."),
        result: [hashVerseText("He said: Pray."), hashVerseText("Go now.")],
        evidence: EVIDENCE
      },
      {
        op: "shift",
        chapter: "40-9",
        first: 39,
        last: 40,
        by: 1,
        expect: hashVerseTexts(["Narration.", "Come."]),
        evidence: EVIDENCE
      }
    ]);
    const dataset = datasetOf([
      {
        ref: "40-9-37",
        verseSha256: hashVerseText("He said: Pray. 38 Go now."),
        spans: [[9, 25]],
        origin: "aligned"
      },
      {
        ref: "40-9-39",
        verseSha256: hashVerseText("Narration."),
        spans: [],
        origin: "aligned"
      },
      {
        ref: "40-9-40",
        verseSha256: hashVerseText("Come."),
        spans: [[0, 5]],
        origin: "manual"
      }
    ]);

    const carried = carryWordsOfJesusThroughRepairs(
      dataset,
      applied,
      textOf(applied.bible)
    );

    assert.deepEqual(carried.dataset.verses, [
      {
        ref: "40-9-37",
        verseSha256: hashVerseText("He said: Pray."),
        spans: [[9, 14]],
        origin: "aligned"
      },
      {
        ref: "40-9-38",
        verseSha256: hashVerseText("Go now."),
        spans: [[0, 7]],
        origin: "aligned"
      },
      {
        ref: "40-9-40",
        verseSha256: hashVerseText("Narration."),
        spans: [],
        origin: "aligned"
      },
      {
        ref: "40-9-41",
        verseSha256: hashVerseText("Come."),
        spans: [[0, 5]],
        origin: "manual"
      }
    ]);
    assert.deepEqual(carried.carried, [
      "40-9-37",
      "40-9-38",
      "40-9-40",
      "40-9-41"
    ]);
    // Carrying twice changes nothing.
    assert.deepEqual(
      carryWordsOfJesusThroughRepairs(
        carried.dataset,
        applied,
        textOf(applied.bible)
      ),
      { dataset: carried.dataset, carried: [] }
    );
  });

  it("keeps Bible text out of the reviewed repair file", async () => {
    const repairs = JSON.parse(
      await readFile("config/ordinary-bible-source-repairs.json", "utf8")
    ) as BibleSourceRepairs;
    const anchor = /^[a-f0-9]{16}$/u;

    assert.equal(repairs.schemaVersion, 1);
    for (const [versionId, set] of Object.entries(repairs.bibles)) {
      assert.match(set.sourceSha256, /^[a-f0-9]{64}$/u, versionId);
      for (const entry of set.repairs) {
        assert.ok(entry.evidence.length > 0, versionId);
        const anchors = [entry.expect, "result" in entry ? entry.result : []];
        for (const value of anchors.flat()) assert.match(value, anchor);
        // A marker is a verse number and its spacing, a separator is spacing.
        if (entry.op === "split") assert.doesNotMatch(entry.marker, /\p{L}/u);
        if (entry.op === "join") assert.match(entry.separator, /^\s*$/u);
        // A misprint is one digit read as one letter.
        if (entry.op === "misprint") {
          assert.match(entry.printed, /^\d$/u);
          assert.match(entry.reads, /^\p{L}$/u);
        }
      }
    }
  });
});
