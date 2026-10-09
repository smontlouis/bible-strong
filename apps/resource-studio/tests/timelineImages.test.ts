import assert from "node:assert/strict";
import test from "node:test";

import {
  isTimelineImageFile,
  readImageSize,
  resizedWidth,
  timelineImageFiles,
  timelineImageKey,
  timelineImageSourceUrl
} from "../src/timelineImages.js";

const png = (width: number, height: number) => {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  new DataView(bytes.buffer).setUint32(16, width);
  new DataView(bytes.buffer).setUint32(20, height);
  return bytes;
};

// SOI, an application segment to skip, then a baseline frame of 640 by 426.
const jpeg = new Uint8Array([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x04, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x11,
  0x08, 0x01, 0xaa, 0x02, 0x80, 0x03, 0x01, 0x22, 0x00
]);

test("a picture is known by its first bytes, whatever its name says", () => {
  assert.deepEqual(readImageSize(png(1000, 800)), {
    kind: "png",
    width: 1000,
    height: 800
  });
  assert.deepEqual(readImageSize(jpeg), {
    kind: "jpeg",
    width: 640,
    height: 426
  });
});

test("a page answered instead of a picture is not a picture", () => {
  const page = new TextEncoder().encode(
    "<!doctype html><title>Just a moment</title>"
  );
  assert.equal(readImageSize(page), undefined);
});

test("only plain file names are pictures of the timeline", () => {
  assert.equal(isTimelineImageFile("Adam_4-4-2013 10-22-05 AM.jpg"), true);
  assert.equal(isTimelineImageFile("../secret.jpg"), false);
  assert.equal(isTimelineImageFile("notes.txt"), false);
});

test("each picture the events name is listed once", () => {
  assert.deepEqual(
    timelineImageFiles([
      { images: [{ file: "b.jpg" }, { file: "a.png" }] },
      { images: [{ file: "b.jpg" }, { file: "folder/c.jpg" }, {}] },
      {}
    ]),
    ["a.png", "b.jpg"]
  );
});

test("a file name with spaces is encoded in the address of its source", () => {
  assert.equal(
    timelineImageSourceUrl("Adam_4-4-2013 10-22-05 AM.jpg"),
    "https://timeline.biblehistory.com/media/images/original/Adam_4-4-2013%2010-22-05%20AM.jpg"
  );
});

test("a resized copy keeps the name the events know and adds its format", () => {
  assert.equal(
    timelineImageKey("original", "Adam.jpg"),
    "timeline-images/original/Adam.jpg"
  );
  assert.equal(
    timelineImageKey("w480", "Adam.jpg"),
    "timeline-images/w480/Adam.jpg.webp"
  );
});

test("a copy is never wider than its original", () => {
  assert.equal(resizedWidth(583, 1200), 583);
  assert.equal(resizedWidth(2000, 1200), 1200);
});
