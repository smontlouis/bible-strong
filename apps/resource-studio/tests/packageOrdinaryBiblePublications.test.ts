import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

import {
  deliveredOfflineEntry,
  deliversSourceAsOfflineCopy
} from "../src/packageOrdinaryBiblePublications.js";

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

describe("the canonical JSON inside an ordinary Bible's Offline copy", () => {
  it("keeps the name every delivered Bible already has", async () => {
    const [config, inventory, catalog] = await Promise.all([
      readFile(path.resolve("config/ordinary-bible-publications.json"), "utf8"),
      readFile(path.resolve("config/mobile-resource-inventory.json"), "utf8"),
      readFile(
        path.resolve(
          "../../packages/resource-catalog/src/mobile-resource-catalog.json"
        ),
        "utf8"
      )
    ]).then((texts) => texts.map((text) => JSON.parse(text)));
    const bibles = (config as { bibles: Array<{ id: string }> }).bibles;
    assert.equal(bibles.length, 47);
    for (const { id } of bibles) {
      const inventoryEntry = (
        inventory as Array<{
          id: string;
          sources: Array<{ role: string; entry: string }>;
        }>
      )
        .find((resource) => resource.id === `bible:${id}`)!
        .sources.find((source) => source.role === "canonical")!.entry;
      assert.equal(deliveredOfflineEntry(catalog, id), inventoryEntry, id);
      assert.equal(
        deliveredOfflineEntry(catalog, id),
        catalog.resources[`bible:${id}`].entry,
        id
      );
    }
    assert.equal(deliveredOfflineEntry(catalog, "BHS"), "bible-hebrew.json");
    assert.equal(deliveredOfflineEntry(catalog, "OST"), "bible-ost.json");
  });

  it("is named after the version for a Bible not delivered yet", () => {
    assert.equal(
      deliveredOfflineEntry({ resources: {} }, "NEW"),
      "bible-new.json"
    );
  });
});
