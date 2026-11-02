import assert from "node:assert/strict";
import test from "node:test";

import {
  missingPeriods,
  parseTimelinePaintingSelection,
  timelinePaintingCatalog,
  timelinePaintingHash,
  timelinePaintingKey,
  timelinePaintingShareUrl,
  timelinePaintingUrl
} from "../src/timelinePaintings.js";

test("a painting is stored under its event and the hash of its original", () => {
  assert.equal(
    timelinePaintingKey("isaac", "0123456789ab", 256),
    "timeline-paintings/isaac/0123456789ab/w256.webp"
  );
  assert.equal(
    timelinePaintingUrl("isaac", "0123456789ab", 1254),
    "https://media.bible-strong.app/timeline-paintings/isaac/0123456789ab/w1254.webp"
  );
  assert.equal(
    timelinePaintingShareUrl("isaac", "0123456789ab"),
    "https://media.bible-strong.app/timeline-paintings/isaac/0123456789ab/w768.jpg"
  );
});

test("another original gives another address", () => {
  const first = timelinePaintingHash(new Uint8Array([1, 2, 3]));
  assert.match(first, /^[0-9a-f]{12}$/u);
  assert.equal(timelinePaintingHash(new Uint8Array([1, 2, 3])), first);
  assert.notEqual(timelinePaintingHash(new Uint8Array([1, 2, 4])), first);
});

test("a selection separates events and periods", () => {
  const selection = parseTimelinePaintingSelection({
    isaac: { source: "isaac.png", documents: ["Isaac's Tomb.jpg"] },
    "1260-day-prophecy": { source: "prophecy.png" },
    "period:13": { source: "period.png" }
  });
  assert.deepEqual(selection.events, [
    {
      slug: "isaac",
      source: "isaac.png",
      documents: ["Isaac's Tomb.jpg"]
    },
    { slug: "1260-day-prophecy", source: "prophecy.png", documents: [] }
  ]);
  assert.deepEqual(selection.periods, [{ number: 13, source: "period.png" }]);
});

test("a selection refuses what the bucket or the application cannot hold", () => {
  const entry = { source: "a.png" };
  assert.throws(
    () => parseTimelinePaintingSelection([]),
    /SELECTION_NOT_AN_OBJECT/u
  );
  assert.throws(
    () => parseTimelinePaintingSelection({ "a/b": entry }),
    /INVALID_NAME/u
  );
  assert.throws(
    () => parseTimelinePaintingSelection({ Isaac: entry }),
    /INVALID_NAME/u
  );
  assert.throws(
    () => parseTimelinePaintingSelection({ "period:14": entry }),
    /UNKNOWN_PERIOD/u
  );
  assert.throws(
    () => parseTimelinePaintingSelection({ isaac: {} }),
    /SOURCE_MISSING/u
  );
  assert.throws(
    () =>
      parseTimelinePaintingSelection({
        isaac: { source: "a.png", documents: "a.jpg" }
      }),
    /DOCUMENTS_INVALID/u
  );
});

test("the application needs all its periods", () => {
  const given = Array.from({ length: 12 }, (_, index) => ({
    number: index + 1,
    source: "a.png"
  }));
  assert.deepEqual(missingPeriods(given), [13]);
});

test("the catalog is stable and names documents only where there are some", () => {
  assert.deepEqual(
    timelinePaintingCatalog([
      { slug: "jacob", hash: "b", documents: [] },
      { slug: "isaac", hash: "a", documents: ["tomb.jpg"] }
    ]),
    {
      version: 1,
      events: {
        isaac: { hash: "a", documents: ["tomb.jpg"] },
        jacob: { hash: "b" }
      }
    }
  );
});
