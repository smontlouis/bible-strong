import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import {
  applyCertainCorrespondences,
  buildCorrespondenceReport,
  correspondenceText,
  structuredReferenceSequence
} from "./import-sdabc-firestore-translations.mjs";
import { sha256 } from "./firestore.mjs";

const source = (html, extra = {}) => ({
  language: "en",
  html,
  sha256: sha256(html),
  ...extra
});
const translation = (html, issues = []) => ({
  language: "fr",
  html,
  sha256: sha256(html),
  quality: { issues }
});
const canonical = ({
  id,
  passage,
  html,
  layer = "general-commentary",
  translated = null
}) => ({
  id,
  passage,
  layer,
  editorialKind: layer,
  source: source(html),
  translation: translated
});
const legacy = ({ id, passage, html, translated = null }) => ({
  id,
  passage,
  source: source(html),
  translation: translated
});

test("normalise seulement les différences éditoriales SDABC attestées", () => {
  const oldHtml =
    ' <p><b>1. In the beginning.</b> These words&mdash;with <a href="/Heb_1.1">Heb. 1:1</a>.</p>';
  const newHtml =
    '<p>In the beginning. These words—with <span class="bible-ref">Heb. 1:1</span>.</p>';
  assert.equal(
    correspondenceText(oldHtml, "1-1-1"),
    correspondenceText(newHtml, "1-1-1")
  );
  assert.notEqual(
    correspondenceText("<p>A genuinely different text.</p>", "1-1-1"),
    correspondenceText(newHtml, "1-1-1")
  );
});

test("classe de façon déterministe les correspondances certaines, absentes, ambiguës et EGW", () => {
  const canonicalEntries = [
    canonical({ id: "sdabc:1-1-1:1", passage: "1-1-1", html: "<p>Alpha.</p>" }),
    canonical({ id: "sdabc:1-1-2:2", passage: "1-1-2", html: "<p>Beta.</p>" }),
    canonical({ id: "sdabc:1-1-3:3", passage: "1-1-3", html: "<p>Gamma.</p>" }),
    canonical({
      id: "egw:1",
      passage: "1-1-1",
      html: "<p>EGW.</p>",
      layer: "egw-supplement"
    })
  ];
  const legacyEntries = [
    legacy({
      id: "10",
      passage: "1-1-1",
      html: "<p><b>1. Alpha.</b></p>",
      translated: translation("<p>Alpha FR.</p>")
    }),
    legacy({ id: "20", passage: "1-1-2", html: "<p><b>2. Beta.</b></p>" }),
    legacy({
      id: "30",
      passage: "1-1-3",
      html: "<p><b>3. Other.</b></p>",
      translated: translation("<p>Autre.</p>")
    })
  ];
  const report = buildCorrespondenceReport({
    canonicalEntries,
    legacyEntries,
    snapshotSha256: "snapshot"
  });
  assert.deepEqual(report.summary, {
    canonicalGeneral: 3,
    canonicalEgwSupplements: 1,
    historicalEntries: 3,
    historicalTranslated: 2,
    recoveredCertain: 1,
    alreadyApplied: 0,
    ambiguous: 1,
    absent: 1,
    collisions: 0,
    egwMissing: 1,
    egwNonLinguisticMarkers: 0
  });
  assert.equal(report.certain[0].legacyId, "10");
  assert.equal(report.absent[0].reason, "historical-translation-missing");
  assert.equal(report.ambiguous[0].reason, "source-mismatch");
});

test("rétrograde une traduction dont la séquence structurée de références diverge", () => {
  const canonicalEntries = [
    canonical({
      id: "one",
      passage: "43-3-16",
      html: "<p>Alpha. John 3:16</p>"
    })
  ];
  const legacyEntries = [
    legacy({
      id: "10",
      passage: "43-3-16",
      html: '<p><b>16. Alpha.</b> <a data-reference="Jn3.16">John 3:16</a></p>',
      translated: translation(
        '<p>Alpha. <a data-reference="Jn3.17">Jean 3:17</a></p>'
      )
    })
  ];
  assert.deepEqual(structuredReferenceSequence(legacyEntries[0].source.html), [
    "Jn3.16"
  ]);
  const report = buildCorrespondenceReport({
    canonicalEntries,
    legacyEntries,
    snapshotSha256: "snapshot"
  });
  assert.equal(report.summary.recoveredCertain, 0);
  assert.equal(
    report.ambiguous[0].reason,
    "historical-reference-sequence-mismatch"
  );
  assert.deepEqual(report.ambiguous[0].historicalSourceReferences, ["Jn3.16"]);
  assert.deepEqual(report.ambiguous[0].historicalTranslationReferences, [
    "Jn3.17"
  ]);
});

test("sépare et copie mécaniquement les marqueurs EGW non linguistiques", () => {
  const marker = canonical({
    id: "egw-marker",
    passage: "1-1-1",
    html: "<span>*****</span>",
    layer: "egw-supplement"
  });
  const report = buildCorrespondenceReport({
    canonicalEntries: [marker],
    legacyEntries: [],
    snapshotSha256: "snapshot"
  });
  assert.equal(report.summary.egwMissing, 0);
  assert.equal(report.summary.egwNonLinguisticMarkers, 1);
  assert.equal(report.egwNonLinguisticMarkers[0].action, "copy-mechanically");
  const result = applyCertainCorrespondences({
    canonicalEntries: [marker],
    legacyEntries: [],
    report
  });
  assert.equal(result.appliedMechanicalMarkers, 1);
  assert.equal(result.entries[0].translation.html, "<span>*****</span>");
  assert.equal(
    result.entries[0].translation.sha256,
    sha256("<span>*****</span>")
  );
});

test("refuse les candidats multiples, les traductions signalées et les écrasements", () => {
  const existing = translation("<p>Déjà traduit.</p>");
  const canonicalEntries = [
    canonical({ id: "one", passage: "1-1-1", html: "<p>Alpha.</p>" }),
    canonical({ id: "two", passage: "1-1-2", html: "<p>Beta.</p>" }),
    canonical({
      id: "three",
      passage: "1-1-3",
      html: "<p>Gamma.</p>",
      translated: existing
    })
  ];
  const legacyEntries = [
    legacy({
      id: "1",
      passage: "1-1-1",
      html: "<p><b>1. Alpha.</b></p>",
      translated: translation("<p>A.</p>")
    }),
    legacy({
      id: "2",
      passage: "1-1-1",
      html: "<p><b>1. Alpha.</b></p>",
      translated: translation("<p>A.</p>")
    }),
    legacy({
      id: "3",
      passage: "1-1-2",
      html: "<p><b>2. Beta.</b></p>",
      translated: translation("<p>B.</p>", ["mixed-language"])
    }),
    legacy({
      id: "4",
      passage: "1-1-3",
      html: "<p><b>3. Gamma.</b></p>",
      translated: translation("<p>C.</p>")
    })
  ];
  const report = buildCorrespondenceReport({
    canonicalEntries,
    legacyEntries,
    snapshotSha256: "snapshot"
  });
  assert.equal(report.collisions[0].reason, "multiple-exact-source-candidates");
  assert.equal(
    report.ambiguous[0].reason,
    "historical-translation-quality-issues"
  );
  assert.equal(report.collisions[1].reason, "different-canonical-translation");
  assert.equal(report.summary.recoveredCertain, 0);
});

test("applique uniquement les certitudes avec hashes et provenance, de manière idempotente", () => {
  const canonicalEntries = [
    canonical({ id: "one", passage: "1-1-1", html: "<p>Alpha.</p>" })
  ];
  const legacyEntries = [
    legacy({
      id: "10",
      passage: "1-1-1",
      html: "<p><b>1. Alpha.</b></p>",
      translated: translation("<p>Alpha FR.</p>")
    })
  ];
  const report = buildCorrespondenceReport({
    canonicalEntries,
    legacyEntries,
    snapshotSha256: "snapshot-hash"
  });
  const first = applyCertainCorrespondences({
    canonicalEntries,
    legacyEntries,
    report
  });
  assert.equal(first.applied, 1);
  assert.equal(first.entries[0].translation.sha256, sha256("<p>Alpha FR.</p>"));
  assert.match(
    first.entries[0].translation.provenance,
    /snapshot-hash; legacy 10;/
  );
  const second = applyCertainCorrespondences({
    canonicalEntries: first.entries,
    legacyEntries,
    report
  });
  assert.equal(second.applied, 0);
  assert.equal(second.unchanged, 1);
  assert.deepEqual(second.entries, first.entries);
});

test("normalise le vieux markup biblique avant de calculer le hash stocké", () => {
  const canonicalEntries = [
    canonical({
      id: "one",
      passage: "1-1-1",
      html: "<p>Alpha. John 3.16.</p>"
    })
  ];
  const rawFrench =
    '<p>Voir <a data-reference="Jn3.16" href="/John_3.16" class="bible-ref">Jean 3.16</a>.</p>';
  const legacyEntries = [
    legacy({
      id: "10",
      passage: "1-1-1",
      html: '<p><b>1. Alpha.</b> <a data-reference="Jn3.16" href="/John_3.16">John 3.16</a>.</p>',
      translated: translation(rawFrench)
    })
  ];
  const report = buildCorrespondenceReport({
    canonicalEntries,
    legacyEntries,
    snapshotSha256: "snapshot"
  });
  const result = applyCertainCorrespondences({
    canonicalEntries,
    legacyEntries,
    report
  });
  assert.notEqual(result.entries[0].translation.sha256, sha256(rawFrench));
  assert.match(
    result.entries[0].translation.html,
    /<span class="bible-ref" data-reference-id="r1">Jean 3\.16<\/span>/
  );
  assert.equal(result.entries[0].translation.references[0].osis, "John.3.16");
  assert.equal(
    result.entries[0].translation.sha256,
    sha256(result.entries[0].translation.html)
  );
});

test("le CLI audite de façon déterministe puis applique seulement avec --apply dans une bibliothèque temporaire", async () => {
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "sdabc-import-"));
  const snapshotRoot = path.join(temporaryRoot, "snapshot");
  const libraryRoot = path.join(temporaryRoot, "library");
  const chunkRelativePath = "chunks/1/1/sdabc.json";
  const chunkPath = path.join(libraryRoot, chunkRelativePath);
  const reportOne = path.join(temporaryRoot, "report-one.json");
  const reportTwo = path.join(temporaryRoot, "report-two.json");
  const scriptPath = fileURLToPath(
    new URL("./import-sdabc-firestore-translations.mjs", import.meta.url)
  );
  const canonicalEntry = canonical({
    id: "one",
    passage: "1-1-1",
    html: "<p>Alpha.</p>"
  });
  const legacyEntries = [
    legacy({
      id: "10",
      passage: "1-1-1",
      html: "<p><b>1. Alpha.</b></p>",
      translated: translation("<p>Alpha FR.</p>")
    })
  ];
  const chunkDocument = {
    schemaVersion: 2,
    resourceId: "sdabc",
    entries: [canonicalEntry]
  };
  const serializedChunk = JSON.stringify(chunkDocument);
  const index = {
    schemaVersion: 1,
    resources: {
      sdabc: {
        entryCount: 1,
        translatedCount: 0,
        missingCount: 1,
        translatedAnchorCount: 0
      }
    },
    sourceRevision: {},
    chapters: [
      {
        book: 1,
        chapter: 1,
        resources: {
          sdabc: {
            path: chunkRelativePath,
            count: 1,
            sha256: sha256(serializedChunk)
          }
        }
      }
    ]
  };
  const manifest = {
    schemaVersion: 1,
    outputContainsRemoteSnapshot: true,
    remoteWrites: false,
    resources: {
      sdabc: { contentSha256: sha256(JSON.stringify(legacyEntries)) }
    }
  };
  await mkdir(path.dirname(chunkPath), { recursive: true });
  await mkdir(path.join(snapshotRoot, "comments"), { recursive: true });
  await writeFile(chunkPath, serializedChunk);
  await writeFile(path.join(libraryRoot, "index.json"), JSON.stringify(index));
  await writeFile(
    path.join(snapshotRoot, "manifest.json"),
    JSON.stringify(manifest)
  );
  await writeFile(
    path.join(snapshotRoot, "comments/sdabc.json"),
    JSON.stringify(legacyEntries)
  );
  const run = (report, apply = false) =>
    execFileSync(
      process.execPath,
      [
        scriptPath,
        "--snapshot",
        snapshotRoot,
        "--library",
        libraryRoot,
        "--report",
        report,
        ...(apply ? ["--apply"] : [])
      ],
      { encoding: "utf8" }
    );

  run(reportOne);
  run(reportTwo);
  assert.equal(
    await readFile(reportOne, "utf8"),
    await readFile(reportTwo, "utf8")
  );
  assert.equal(
    JSON.parse(await readFile(chunkPath, "utf8")).entries[0].translation,
    null
  );
  run(reportTwo, true);
  const appliedChunk = JSON.parse(await readFile(chunkPath, "utf8"));
  const appliedIndex = JSON.parse(
    await readFile(path.join(libraryRoot, "index.json"), "utf8")
  );
  assert.equal(appliedChunk.entries[0].translation.html, "<p>Alpha FR.</p>");
  assert.equal(appliedIndex.resources.sdabc.translatedCount, 1);
  assert.equal(appliedIndex.resources.sdabc.missingCount, 0);
  assert.ok(
    appliedIndex.sourceRevision.sdabcHistoricalTranslations.reportSha256
  );
});
