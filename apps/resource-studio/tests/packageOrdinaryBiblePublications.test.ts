import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { deliversSourceAsOfflineCopy } from "../src/packageOrdinaryBiblePublications.js";

const delivered = "a".repeat(64);
const unchanged = {
  gainsPresentation: false,
  sourceIsDeliverable: true,
  sourceSha256: delivered,
  deliveredContentSha256: delivered
};

describe("the Offline copy of an ordinary Bible", () => {
  it("stays the source file readers already hold", () => {
    assert.equal(deliversSourceAsOfflineCopy(unchanged), true);
  });

  it("becomes the canonical JSON when the text changed", () => {
    assert.equal(
      deliversSourceAsOfflineCopy({
        ...unchanged,
        sourceSha256: "b".repeat(64)
      }),
      false
    );
  });

  it("becomes the canonical JSON for a Bible not delivered yet", () => {
    assert.equal(
      deliversSourceAsOfflineCopy({
        ...unchanged,
        deliveredContentSha256: undefined
      }),
      false
    );
  });

  it("becomes the canonical JSON when the Bible gains presentation", () => {
    assert.equal(
      deliversSourceAsOfflineCopy({ ...unchanged, gainsPresentation: true }),
      false
    );
  });

  it("becomes the canonical JSON when the source does not read as the publication", () => {
    assert.equal(
      deliversSourceAsOfflineCopy({ ...unchanged, sourceIsDeliverable: false }),
      false
    );
  });
});
