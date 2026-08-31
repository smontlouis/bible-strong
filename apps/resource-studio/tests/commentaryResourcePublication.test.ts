import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildCanonicalCommentary,
  loadCommentaryLibraryEntries
} from "../src/packageCommentaryResourcePublications.js";

const sha256 = (value: string): string =>
  createHash("sha256").update(value).digest("hex");

test("publishes one canonical Barnes unit across its complete range", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "commentary-publication-"));
  try {
    await mkdir(path.join(root, "chunks/1/1"), { recursive: true });
    const entry = {
      id: "barnes-3",
      passage: "1-1-3" as const,
      passageEnd: "1-1-5" as const,
      source: { language: "en" as const, html: "<p>Verses 3–5.</p>" },
      translation: {
        language: "fr" as const,
        html: "<p>Versets 3–5.</p>"
      },
      scope: {
        kind: "range",
        start: "1-1-3" as const,
        end: "1-1-5" as const
      },
      sourceAnchors: [
        { id: "barnes-3", passage: "1-1-3" as const },
        { id: "barnes-4", passage: "1-1-4" as const },
        { id: "barnes-5", passage: "1-1-5" as const }
      ],
      translationVariants: [
        {
          id: "barnes-4",
          passage: "1-1-4" as const,
          translation: { language: "fr" as const, html: "<p>Variante 4.</p>" }
        },
        {
          id: "barnes-5",
          passage: "1-1-5" as const,
          translation: { language: "fr" as const, html: "<p>Variante 5.</p>" }
        }
      ]
    };
    const payload = JSON.stringify({ resourceId: "barnes", entries: [entry] });
    await writeFile(path.join(root, "chunks/1/1/barnes.json"), payload);
    const index = {
      generatedAt: "2026-08-31T00:00:00.000Z",
      sourceRevision: "fixture",
      resources: { barnes: {} },
      chapters: [
        {
          book: 1,
          chapter: 1,
          passages: ["1-1-3", "1-1-4", "1-1-5"],
          resources: {
            barnes: {
              path: "chunks/1/1/barnes.json",
              sha256: sha256(payload)
            }
          }
        }
      ]
    };

    const loaded = await loadCommentaryLibraryEntries(index, root);
    assert.equal(loaded.get("barnes")?.length, 1);

    const canonical = buildCanonicalCommentary(
      {
        id: "barnes",
        title: "Barnes’ Notes on the Bible",
        author: "Albert Barnes",
        languages: ["fr"],
        rights: "Public domain",
        source: "fixture"
      },
      "fr",
      index,
      loaded.get("barnes") ?? []
    );
    assert.deepEqual(
      canonical.verses.map((verse) => [verse.verseKey, verse.content]),
      [
        ["1-1-3", "<p>Versets 3–5.</p>"],
        ["1-1-4", "<p>Versets 3–5.</p>"],
        ["1-1-5", "<p>Versets 3–5.</p>"]
      ]
    );
    assert.ok(
      canonical.verses.every((verse) => !verse.content.includes("Variante"))
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("keeps overlapping editorial sections distinct", () => {
  const index = {
    generatedAt: "2026-08-31T00:00:00.000Z",
    sourceRevision: "fixture",
    resources: { "bible-annotee": {} },
    chapters: [
      {
        book: 1,
        chapter: 1,
        passages: ["1-1-1", "1-1-2"],
        resources: {}
      }
    ]
  };
  const canonical = buildCanonicalCommentary(
    {
      id: "bible-annotee",
      title: "Bible Annotée de Neuchâtel",
      author: "Collectif",
      languages: ["fr"],
      rights: "Authorised",
      source: "fixture"
    },
    "fr",
    index,
    [
      {
        id: "section-1-2",
        passage: "1-1-1",
        source: { language: "fr", html: "<p>Section 1–2</p>" },
        scope: { kind: "section", start: "1-1-1", end: "1-1-2" }
      },
      {
        id: "verse-2",
        passage: "1-1-2",
        source: { language: "fr", html: "<p>Note du verset 2</p>" }
      }
    ]
  );

  assert.equal(canonical.verses[0]?.content, "<p>Section 1–2</p>");
  assert.equal(
    canonical.verses[1]?.content,
    "<p>Section 1–2</p><hr><p>Note du verset 2</p>"
  );
});

test("introduces Ellen G. White supplements once after the general SDA commentary", () => {
  const index = {
    generatedAt: "2026-08-31T00:00:00.000Z",
    sourceRevision: "fixture",
    resources: { sdabc: {} },
    chapters: [
      {
        book: 1,
        chapter: 1,
        passages: ["1-1-1"],
        resources: {}
      }
    ]
  };
  const canonical = buildCanonicalCommentary(
    {
      id: "sdabc",
      title: "Seventh-day Adventist Bible Commentary",
      author: "Francis D. Nichol",
      languages: ["en"],
      rights: "Authorised",
      source: "fixture"
    },
    "en",
    index,
    [
      {
        id: "egw-2",
        passage: "1-1-1",
        layer: "egw-supplement",
        source: { language: "en", html: "<p>Second EGW excerpt.</p>" }
      },
      {
        id: "general",
        passage: "1-1-1",
        layer: "general-commentary",
        source: { language: "en", html: "<p>General commentary.</p>" }
      },
      {
        id: "egw-1",
        passage: "1-1-1",
        layer: "egw-supplement",
        source: { language: "en", html: "<p>First EGW excerpt.</p>" }
      }
    ]
  );

  assert.equal(
    canonical.verses[0]?.content,
    "<p>General commentary.</p><hr><br><br><h3>Ellen G. White</h3><br><p>Second EGW excerpt.</p><hr><p>First EGW excerpt.</p>"
  );
  assert.equal(
    canonical.verses[0]?.content.match(/<h3>Ellen G\. White<\/h3>/gu)
      ?.length,
    1
  );
});
