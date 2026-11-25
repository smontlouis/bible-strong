import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  hostedChapterKey,
  planHostedChapters,
  type HostedRecordingConfig
} from "../src/bibleAudioHosting.ts";
import { BOOK_CHAPTER_COUNTS } from "../src/bibleAudioPlaces.ts";

const BOOK_NAMES = BOOK_CHAPTER_COUNTS.map((_, index) => `book_${index + 1}`);

const config: HostedRecordingConfig = {
  recording: "lsg-test",
  prefix: "bible-audio/lsg-test/v1",
  books: Object.fromEntries(BOOK_NAMES.map((name, index) => [name, index + 1])),
  leftOut: { with_music: "replaced" }
};

/** One file per chapter of the Bible, a one-chapter book without a number. */
const everyChapter = () =>
  BOOK_CHAPTER_COUNTS.flatMap((count, index) =>
    count === 1
      ? [`folder/${BOOK_NAMES[index]}.mp3`]
      : Array.from(
          { length: count },
          (_, chapter) =>
            `folder/${BOOK_NAMES[index]}_${String(chapter + 1).padStart(2, "0")}.mp3`
        )
  );

const same = () => true;

describe("planHostedChapters", () => {
  it("gives every chapter of the Bible one key", () => {
    const { chapters, unknown } = planHostedChapters(
      config,
      everyChapter(),
      same
    );
    assert.equal(chapters.length, 1189);
    assert.deepEqual(unknown, []);
    assert.equal(chapters[0]?.key, "bible-audio/lsg-test/v1/01_001.mp3");
    assert.equal(
      chapters.find((chapter) => chapter.book === 31)?.key,
      hostedChapterKey(config.prefix, 31, 1)
    );
  });

  it("reports a file it does not know, and passes over one left out", () => {
    const { unknown } = planHostedChapters(
      config,
      [...everyChapter(), "x/with_music_01.mp3", "x/stray_01.mp3"],
      same
    );
    assert.deepEqual(unknown, ["x/stray_01.mp3"]);
  });

  it("refuses a missing chapter, one past the end, and two different files for one", () => {
    const files = everyChapter();
    assert.throws(
      () => planHostedChapters(config, files.slice(1), same),
      /BIBLE_AUDIO_HOSTED_MISSING: no file for 1:1/
    );
    assert.throws(
      () => planHostedChapters(config, [...files, "x/book_1_51.mp3"], same),
      /BIBLE_AUDIO_HOSTED_CHAPTER/
    );
    assert.throws(
      () =>
        planHostedChapters(config, [...files, "y/book_1_01.mp3"], () => false),
      /BIBLE_AUDIO_HOSTED_TWICE/
    );
    assert.equal(
      planHostedChapters(config, [...files, "y/book_1_01.mp3"], same).chapters
        .length,
      1189
    );
  });

  it("finds only the books of a partial recording, and passes over the others' files", () => {
    const partial = {
      ...config,
      books: { book_20: 20, book_43: 43 },
      covers: [20, 43]
    };
    const { chapters, unknown } = planHostedChapters(
      partial,
      everyChapter(),
      same
    );
    assert.equal(chapters.length, 31 + 21);
    assert.deepEqual(unknown, []);
    assert.throws(
      () =>
        planHostedChapters(
          partial,
          everyChapter().filter((file) => !file.includes("book_43_21")),
          same
        ),
      /no file for 43:21/
    );
  });
});
