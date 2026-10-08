import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";

import {
  alignChapterWithProvider,
  applyBibleSourcePatch,
  assertPatchedSourceLoaded,
  bibleComChapterUrl,
  parseProviderChapterHtml,
  patchedSourceLocation,
  publishedTextSourceUrl,
  sha256Hex,
  styleProviderChapter,
  type BibleSourcePatches,
  type BibleSourcePatchSet
} from "../src/bibleSourcePatches.js";
import { adoptPatchedSources } from "../src/bibleSourcePatchesCli.js";
import { hashVerseTexts } from "../src/bibleSourceRepairs.js";
import { hashVerseText } from "../src/wordsOfJesus.js";

const verse = (usfm: string, label: string, body: string) =>
  `<span class="verse v${label}" data-usfm="${usfm}">` +
  `<span class="label">${label}</span>${body}</span>`;
const content = (text: string) => `<span class="content">${text}</span>`;
const note = (text: string) =>
  `<span class="note f"><span class="label">#</span>` +
  `<span class=" body"><span class="ft">${text}</span></span></span>`;
const chapterHtml = (usfm: string, body: string) =>
  `<div class="version vid7" data-vid="7"><div class="book bkTST">` +
  `<div class="chapter ch1" data-usfm="${usfm}"><div class="label">1</div>` +
  `${body}</div></div></div>`;
const answer = (usfm: string, body: string, versionId = 7) =>
  JSON.stringify({
    reference: { usfm: [usfm], human: "Test 1", version_id: versionId },
    content: chapterHtml(usfm, body)
  });

describe("Provider chapter markup", () => {
  it("reads verses without notes, grouped under their first number", () => {
    const html = chapterHtml(
      "TST.1",
      `<div class="s1"><span class="heading">A heading</span></div>` +
        `<div class="p">${verse(
          "TST.1.1",
          "1",
          content("First&#160;row ") +
            note("a note") +
            content("goes  on &amp; on.")
        )}${verse("TST.1.2+TST.1.3", "2-3", content("Two as one."))}</div>` +
        `<div class="q1">${verse("TST.1.4", "4", content("A line"))}</div>` +
        `<div class="q1"><span class="verse v4" data-usfm="TST.1.4">` +
        `${content("and its end. ")}</span>` +
        `${verse("TST.1.5", "5", content("&#8220;Last.&#8221;"))}</div>`
    );

    assert.deepEqual(parseProviderChapterHtml(html), {
      1: "First row goes on & on.",
      2: "Two as one.\n",
      // A verse that runs over two paragraphs keeps the break between them.
      4: "A line\nand its end.",
      5: "\u201cLast.\u201d\n"
    });
  });

  it("fails on markup it does not understand", () => {
    assert.throws(
      () => parseProviderChapterHtml("<div><span>open</div>"),
      /bible-provider-markup-unbalanced/u
    );
    assert.throws(
      () => parseProviderChapterHtml("<div>a &eacute; b</div>"),
      /bible-provider-markup-entity-unsupported/u
    );
  });

  it("writes paragraph breaks the way each source does", () => {
    const verses = { 1: "a\nb\n", 2: "c", 3: "d\n" };

    assert.deepEqual(styleProviderChapter(verses, "provider"), verses);
    // Every break is followed by a space, except the one ending the chapter.
    assert.deepEqual(styleProviderChapter(verses, "space-after-break"), {
      1: "a\n b\n ",
      2: "c",
      3: "d\n"
    });
    assert.deepEqual(styleProviderChapter(verses, "no-breaks"), {
      1: "a b",
      2: "c",
      3: "d"
    });
  });
});

describe("Chapter alignment with the provider", () => {
  it("supplies the verses a chapter lacks and keeps the others byte for byte", () => {
    const aligned = alignChapterWithProvider({
      base: { 1: "one  \u2019tis", 2: "two", 5: "five" },
      provider: {
        1: "one 'tis\n",
        2: "two\n",
        3: "three",
        4: "four",
        5: "five"
      }
    });

    assert.deepEqual(aligned.verses, {
      1: "one  \u2019tis",
      2: "two",
      3: "three",
      4: "four",
      5: "five"
    });
    assert.deepEqual(aligned.supplied, {
      3: hashVerseText("three"),
      4: hashVerseText("four")
    });
    assert.deepEqual(aligned.renumbered, []);
    assert.deepEqual(aligned.dropped, {});
    assert.equal(aligned.kept, 3);
  });

  it("replaces a verse cut in two and renumbers the rows that follow", () => {
    const aligned = alignChapterWithProvider({
      base: { 1: "a", 2: "I", 3: "rest", 4: "c", 5: "d" },
      provider: { 1: "a", 2: "I1 rest", 3: "c", 4: "d" }
    });

    assert.deepEqual(aligned.verses, { 1: "a", 2: "I1 rest", 3: "c", 4: "d" });
    assert.deepEqual(aligned.supplied, { 2: hashVerseText("I1 rest") });
    assert.deepEqual(aligned.dropped, {
      2: hashVerseText("I"),
      3: hashVerseText("rest")
    });
    assert.deepEqual(aligned.renumbered, [
      { first: 4, last: 5, by: -1, expect: hashVerseTexts(["c", "d"]) }
    ]);
    assert.equal(aligned.kept, 1);
  });

  it("takes the whole chapter when the source has none", () => {
    const aligned = alignChapterWithProvider({
      base: undefined,
      provider: { 1: "a", 2: "b" }
    });

    assert.deepEqual(aligned.verses, { 1: "a", 2: "b" });
    assert.equal(Object.keys(aligned.supplied).length, 2);
  });

  it("refuses a chapter whose rows are not plain verse numbers", () => {
    assert.throws(
      () =>
        alignChapterWithProvider({
          base: { "1+TST": "a" },
          provider: { 1: "a" }
        }),
      /bible-source-patch-base-key-unsupported/u
    );
  });
});

const BASE = { 1: { 1: { 1: "one", 3: "three" }, 2: { 1: "caf\u00e9" } } };
const RESPONSES = {
  "TST.1": answer(
    "TST.1",
    `<div class="p">${verse("TST.1.1", "1", content("one"))}` +
      `${verse("TST.1.2", "2", content("two"))}` +
      `${verse("TST.1.3", "3", content("three"))}</div>`
  )
};

const patchFor = (baseRaw: string, patched: string): BibleSourcePatchSet => ({
  provider: { id: "bible.com", versionId: 7, abbreviation: "TST" },
  base: {
    sourceUrl: "https://example.test/bible-tst.json",
    sha256: sha256Hex(baseRaw)
  },
  textStyle: "no-breaks",
  chapters: [
    {
      chapter: "1-1",
      reference: "TST.1",
      evidence: "fixture",
      response: {
        url: bibleComChapterUrl(7, "TST.1"),
        fetchedAt: "2026-01-01T00:00:00.000Z",
        sha256: sha256Hex(RESPONSES["TST.1"])
      },
      supplied: { 2: hashVerseText("two") },
      renumbered: [],
      dropped: {},
      kept: 2
    }
  ],
  patched: {
    fileName: "bible-tst.json",
    sha256: sha256Hex(patched),
    bytes: Buffer.byteLength(patched)
  }
});

describe("Bible source patches", () => {
  it("builds the patched source and leaves every other chapter untouched", () => {
    const baseRaw = JSON.stringify(BASE);
    const expected = JSON.stringify({
      1: { 1: { 1: "one", 2: "two", 3: "three" }, 2: { 1: "caf\u00e9" } }
    });
    const result = applyBibleSourcePatch({
      versionId: "TST",
      baseRaw,
      patch: patchFor(baseRaw, expected),
      responses: RESPONSES
    });

    assert.equal(result.serialized, expected);
    assert.deepEqual(
      result.chapters.map(({ chapter, before, after, matched }) => ({
        chapter,
        before,
        after,
        matched
      })),
      [{ chapter: "1-1", before: 2, after: 3, matched: 2 }]
    );
  });

  it("writes the patched source the way the earlier one was written", () => {
    // Some sources escape every non-ASCII character.
    const baseRaw = JSON.stringify(BASE).replace("\u00e9", "\\u00e9");
    const result = applyBibleSourcePatch({
      versionId: "TST",
      baseRaw,
      patch: patchFor(baseRaw, ""),
      responses: RESPONSES,
      anchored: false
    });

    assert.ok(result.serialized.includes('"caf\\u00e9"'));
    assert.deepEqual(JSON.parse(result.serialized)[1][1], {
      1: "one",
      2: "two",
      3: "three"
    });
  });

  it("fails when the source, an answer or the alignment is not the reviewed one", () => {
    const baseRaw = JSON.stringify(BASE);
    const patch = patchFor(baseRaw, "");
    const attempt = (
      changes: Partial<Parameters<typeof applyBibleSourcePatch>[0]>
    ) =>
      applyBibleSourcePatch({
        versionId: "TST",
        baseRaw,
        patch,
        responses: RESPONSES,
        ...changes
      });

    assert.throws(
      () => attempt({ baseRaw: JSON.stringify({ 1: { 1: { 1: "other" } } }) }),
      /bible-source-patch-base-mismatch:TST/u
    );
    assert.throws(
      () => attempt({ responses: { "TST.1": `${RESPONSES["TST.1"]} ` } }),
      /bible-source-patch-response-mismatch:TST:TST\.1/u
    );
    assert.throws(
      () => attempt({ responses: {} }),
      /bible-source-patch-response-missing:TST:TST\.1/u
    );
    assert.throws(
      () =>
        attempt({
          patch: {
            ...patch,
            chapters: [{ ...patch.chapters[0]!, supplied: {}, kept: 3 }]
          }
        }),
      /bible-source-patch-chapter-drift:TST:1-1/u
    );
    // The recorded hash of the patched source is checked last.
    assert.throws(
      () => attempt({}),
      /bible-source-patch-patched-mismatch:TST/u
    );
  });

  it("refuses an answer for another version or another chapter", () => {
    const baseRaw = JSON.stringify(BASE);
    const other = answer("TST.1", content("x"), 8);
    const patch = patchFor(baseRaw, "");

    assert.throws(
      () =>
        applyBibleSourcePatch({
          versionId: "TST",
          baseRaw,
          patch,
          responses: { "TST.1": other },
          anchored: false
        }),
      /bible-source-patch-response-invalid:TST:TST\.1/u
    );
  });

  it("reads a patched Bible from its patched source only", () => {
    const patch = patchFor("{}", "patched");

    assert.doesNotThrow(() =>
      assertPatchedSourceLoaded("TST", patch.patched.sha256, patch)
    );
    assert.doesNotThrow(() =>
      assertPatchedSourceLoaded("TST", patch.base.sha256, undefined)
    );
    assert.throws(
      () => assertPatchedSourceLoaded("TST", patch.base.sha256, patch),
      /bible-source-patch-pending:TST/u
    );
  });

  it("records a patched source under its content-addressed key", () => {
    const patch = patchFor("{}", "patched");
    const location = `r2://bible-strong-resource-artifacts-prod/sources/${patch.patched.sha256}/bible-tst.json`;

    assert.equal(patchedSourceLocation(patch), location);
    assert.equal(
      publishedTextSourceUrl({
        configuredUrl: patch.base.sourceUrl,
        sourceSha256: patch.patched.sha256,
        patch
      }),
      location
    );
    assert.equal(
      publishedTextSourceUrl({
        configuredUrl: patch.base.sourceUrl,
        sourceSha256: patch.base.sha256,
        patch: undefined
      }),
      patch.base.sourceUrl
    );
  });

  it("adopts a patched source only once it reads back from R2", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "bible-source-patches-"));
    try {
      const patch = patchFor("{}", "patched");
      const patches: BibleSourcePatches = {
        schemaVersion: 1,
        bibles: { TST: patch }
      };
      const configPath = path.join(root, "config/ordinary-bible-sources.json");
      const config = {
        schemaVersion: 1,
        bibles: {
          TST: {
            text: { sourceUrl: patch.base.sourceUrl, entry: "bible-tst.json" },
            pericope: {
              sourceUrl: "https://example.test/p.json",
              entry: "p.json"
            }
          }
        }
      };
      await mkdir(path.dirname(configPath), { recursive: true });
      await writeFile(configPath, JSON.stringify(config));

      await assert.rejects(
        adoptPatchedSources({
          root,
          patches,
          bucket: "bucket",
          download: () => Promise.reject(new Error("r2-object-read-failed"))
        }),
        /r2-object-read-failed/u
      );
      assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), config);

      const read: string[] = [];
      const adopted = await adoptPatchedSources({
        root,
        patches,
        bucket: "bucket",
        download: (location) => {
          read.push(location);
          return Promise.resolve();
        }
      });
      const location = `r2://bucket/sources/${patch.patched.sha256}/bible-tst.json`;

      assert.deepEqual(adopted, ["TST"]);
      assert.deepEqual(read, [location]);
      assert.deepEqual(JSON.parse(await readFile(configPath, "utf8")), {
        schemaVersion: 1,
        bibles: {
          TST: {
            text: { sourceUrl: location, entry: "bible-tst.json" },
            pericope: config.bibles.TST.pericope
          }
        }
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("keeps Bible text out of the reviewed patch file", async () => {
    const patches = JSON.parse(
      await readFile("config/ordinary-bible-source-patches.json", "utf8")
    ) as BibleSourcePatches;
    const anchor = /^[a-f0-9]{16}$/u;
    const digest = /^[a-f0-9]{64}$/u;

    assert.equal(patches.schemaVersion, 1);
    for (const [versionId, patch] of Object.entries(patches.bibles)) {
      assert.match(patch.base.sha256, digest, versionId);
      assert.match(patch.patched.sha256, digest, versionId);
      assert.notEqual(patch.patched.sha256, patch.base.sha256, versionId);
      assert.ok(patch.chapters.length > 0, versionId);
      for (const chapter of patch.chapters) {
        assert.ok(chapter.evidence.length > 0, versionId);
        assert.equal(
          chapter.response.url,
          bibleComChapterUrl(patch.provider.versionId, chapter.reference)
        );
        assert.match(chapter.response.sha256, digest);
        assert.ok(!Number.isNaN(Date.parse(chapter.response.fetchedAt)));
        const anchors = [
          ...Object.values(chapter.supplied),
          ...Object.values(chapter.dropped),
          ...chapter.renumbered.map((run) => run.expect)
        ];
        for (const value of anchors) assert.match(value, anchor);
        for (const key of [
          ...Object.keys(chapter.supplied),
          ...Object.keys(chapter.dropped)
        ])
          assert.match(key, /^\d+$/u);
      }
    }
  });
});
