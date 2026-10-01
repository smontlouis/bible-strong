import { readdir, copyFile } from "node:fs/promises";
import { generateVerseCorrespondenceManifest } from "./generateVerseCorrespondence.js";
import { prepareAutonomousInput } from "./strongAutonomousInputs.js";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, writeFile, rename, stat } from "node:fs/promises";
import { once } from "node:events";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { readBibleJson } from "./bibleJson.js";
import { CANONICAL_RESOLUTION_POLICY } from "./strongCanonicalResolution.js";
import {
  generateStrongLedger,
  strongLedgerInputFingerprint
} from "./strongLedger.js";
import { readStrongLedgerSqlite } from "./strongLedgerStore.js";
import {
  loadDefaultStepIdentityIndex,
  writeGeneratedStrongJsonl
} from "./generatedStrongJsonl.js";

export const AUTONOMOUS_FRENCH_BIBLES = [
  "nbs",
  "bds",
  "bfc",
  "fmar",
  "frc97",
  "nfc",
  "nvs78p",
  "ost",
  "s21"
] as const;
const DICTIONARY =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
interface Entry {
  status: "generating" | "verified" | "failed";
  attempt: number;
  directory: string;
  error?: string;
  hashes?: Record<string, string>;
  summary?: unknown;
  codeFingerprint?: string;
}
interface Run {
  policy: string;
  dictionary: string;
  bibles: Record<string, Entry>;
}
async function hash(file: string) {
  const h = createHash("sha256");
  for await (const chunk of createReadStream(file)) h.update(chunk);
  return h.digest("hex");
}
async function atomicJson(file: string, value: unknown) {
  const temp = `${file}.tmp`;
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n");
  await rename(temp, file);
}
const plain = (s: string) =>
  s
    .replace(/<[^>]+>/gu, "")
    .replace(
      /&(amp|lt|gt|quot);/gu,
      (_, key: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"' })[key]!
    );

/** Independent read-back from the canonical SQLite, bounded to one verse at a time. */
export async function verifyAutonomousBible(options: {
  bible: string;
  sqlitePath: string;
  inputPath: string;
  resolutionOutput: string;
}) {
  const expected = await readBibleJson(options.inputPath);
  const db = new DatabaseSync(options.sqlitePath, { readOnly: true });
  const stream = createWriteStream(options.resolutionOutput, { flags: "wx" });
  const counts = {
    verses: 0,
    sourceOccurrences: 0,
    sourceUnits: 0,
    visible: 0,
    empty: 0,
    unresolved: 0,
    unownedAnnotations: 0,
    sourceIssues: 0,
    policySupportedVerses: 0
  };
  try {
    assert.equal(
      Object.values(db.prepare("pragma integrity_check").get()!)[0],
      "ok"
    );
    const statement = db.prepare(
      "select ref,text,book_id,annotations_json,inventories_json,resolution_json,reader_html,advanced_html from verses where bible=? order by book_order,chapter,verse"
    );
    for (const row of statement.iterate(options.bible) as Iterable<
      Record<string, string>
    >) {
      const input = expected[counts.verses];
      assert(input, `extra-verse:${row.ref}`);
      assert.equal(
        row.ref,
        `${input.bookId}.${input.chapter}.${input.verse}`,
        "native-reference-order-drift"
      );
      assert.equal(row.text, input.text, `canonical-text-drift:${row.ref}`);
      assert.equal(
        plain(row.reader_html),
        input.text,
        `reader-text-drift:${row.ref}`
      );
      assert.equal(
        plain(row.advanced_html),
        input.text,
        `advanced-text-drift:${row.ref}`
      );
      const r = JSON.parse(row.resolution_json);
      assert.equal(r.policy, CANONICAL_RESOLUTION_POLICY);
      assert.equal(
        r.targetTextSha256,
        createHash("sha256").update(input.text).digest("hex")
      );
      const decisions = r.decisions as Array<{
        sourceUnitId: string;
        occurrenceIds: string[];
        state: string;
        assurance: string;
        targetWordIndices: number[];
        exploration: { status: string };
        anchor?: { insertAfterWordIndex: number; absenceEstablished: boolean };
      }>;
      const ids = decisions.flatMap((d) => d.occurrenceIds);
      assert.equal(
        new Set(ids).size,
        ids.length,
        `duplicate-source-owner:${row.ref}`
      );
      assert.equal(
        ids.length,
        JSON.parse(row.inventories_json).original.length,
        `source-inventory-drift:${row.ref}`
      );
      for (const d of decisions) {
        assert(["visible", "empty", "unresolved"].includes(d.state));
        assert.equal(d.exploration.status, "completed-locally");
        if (d.state === "empty")
          assert(
            d.assurance === "linguistic-rule" && d.anchor?.absenceEstablished,
            "unsupported-established-empty"
          );
        if (d.state === "unresolved")
          assert(
            !d.anchor?.absenceEstablished,
            "uncertainty-labeled-as-absence"
          );
      }
      counts.verses++;
      counts.sourceOccurrences += ids.length;
      counts.sourceUnits += decisions.length;
      for (const key of ["visible", "empty", "unresolved"] as const)
        counts[key] += decisions.filter((d) => d.state === key).length;
      counts.unownedAnnotations += r.unownedAnnotationIds.length;
      counts.sourceIssues += r.issues.length;
      counts.policySupportedVerses += r.metrics.policySupportedVerses ?? 0;
      const line =
        JSON.stringify({ ref: row.ref, bible: options.bible, ...r }) + "\n";
      if (!stream.write(line)) await once(stream, "drain");
    }
    assert.equal(counts.verses, expected.length, "native-verse-coverage-drift");
    assert.equal(
      counts.visible + counts.empty + counts.unresolved,
      counts.sourceUnits
    );
    stream.end();
    await once(stream, "finish");
  } catch (error) {
    stream.destroy();
    throw error;
  } finally {
    db.close();
  }
  return counts;
}

export async function runAutonomousBibles(
  root: string,
  bibles: readonly string[] = AUTONOMOUS_FRENCH_BIBLES
) {
  await mkdir(root, { recursive: true });
  const manifestFile = path.join(root, "run.json");
  const run: Run = existsSync(manifestFile)
    ? JSON.parse(await readFile(manifestFile, "utf8"))
    : {
        policy: CANONICAL_RESOLUTION_POLICY,
        dictionary: DICTIONARY,
        bibles: {}
      };
  assert.equal(run.policy, CANONICAL_RESOLUTION_POLICY);
  assert.equal(run.dictionary, DICTIONARY);
  const sourceFiles = (await readdir("src", { recursive: true }))
    .filter((f) => f.endsWith(".ts"))
    .map((f) => path.join("src", f))
    .sort();
  const codeHashes: Record<string, string> = {};
  for (const f of sourceFiles) codeHashes[f] = await hash(f);
  const codeFingerprint = createHash("sha256")
    .update(JSON.stringify(codeHashes))
    .digest("hex");
  const snapshot = path.join(root, "code", codeFingerprint);
  if (!existsSync(path.join(snapshot, "manifest.json"))) {
    for (const f of sourceFiles) {
      const dest = path.join(snapshot, f);
      await mkdir(path.dirname(dest), { recursive: true });
      await copyFile(f, dest);
    }
    await atomicJson(path.join(snapshot, "manifest.json"), {
      codeHashes,
      runtime: {
        node: process.version,
        icu: process.versions.icu,
        platform: process.platform,
        arch: process.arch
      }
    });
  }
  const failures: string[] = [];
  for (const bible of bibles) {
    assert(
      AUTONOMOUS_FRENCH_BIBLES.some((b) => b === bible),
      `unknown-autonomous-bible:${bible}`
    );
    const input = await prepareAutonomousInput(bible, root);
    const inputPath = input.inputPath;
    const detected = path.join(root, "correspondence", `${bible}.json`);
    let verseCorrespondencePath = existsSync(detected) ? detected : undefined;
    const old = run.bibles[bible];
    if (
      old?.status === "verified" &&
      old.hashes &&
      old.codeFingerprint === codeFingerprint
    ) {
      let valid = true;
      for (const [file, digest] of Object.entries(old.hashes))
        if (!existsSync(file) || (await hash(file)) !== digest) valid = false;
      if (valid) {
        const prior = readStrongLedgerSqlite({
          sqlitePath: path.join(old.directory, `bible-${bible}-strong.sqlite`),
          includeVerses: false
        });
        valid =
          strongLedgerInputFingerprint(
            {
              bible,
              biblePath: inputPath,
              outputDir: old.directory,
              verseCorrespondencePath: prior.verseCorrespondencePath
            },
            prior.translationProfile,
            prior.dictionaryInput
          ) === prior.inputFingerprint;
      }
      if (valid) {
        console.log(JSON.stringify({ bible, status: "verified-reused" }));
        continue;
      }
    }
    const attempt = (old?.attempt ?? 0) + 1,
      directory = path.join(root, bible, `attempt-${attempt}`);
    await mkdir(directory, { recursive: true });
    run.bibles[bible] = { status: "generating", attempt, directory };
    await atomicJson(manifestFile, run);
    try {
      if (
        !verseCorrespondencePath &&
        !existsSync(`data/bibles/bible-${bible}-verse-correspondence.json`)
      ) {
        console.log(
          JSON.stringify({ bible, phase: "native-verse-correspondence" })
        );
        const report = await generateVerseCorrespondenceManifest({
          bible,
          input: inputPath,
          output: detected,
          report: path.join(root, "correspondence", `${bible}-report.json`),
          minimumBlockScore: 0.34,
          ambiguityMargin: 0.06,
          partitionByChapter: bible !== "ost"
        });
        assert.equal(
          report.status,
          "accepted",
          `unresolved-verse-correspondence:${bible}:${report.reportPath}`
        );
        verseCorrespondencePath = detected;
      }
      console.log(
        JSON.stringify({ bible, phase: "generating-full-bible", directory })
      );
      const ledger = await generateStrongLedger({
        bible,
        biblePath: inputPath,
        outputDir: directory,
        dictionaryPath: DICTIONARY,
        verseCorrespondencePath,
        lexicalReportOutputDir: path.join(directory, "lexical")
      });
      assert.equal(ledger.scope, "all");
      assert.equal(ledger.lexicalResolutionMetrics?.autoSafeItems, 0);
      assert.equal(ledger.lexicalResolutionMetrics?.groupAutoSafeItems, 0);
      assert(
        ledger.resolutionSummary &&
          ledger.resolutionSummary.verses === ledger.metrics.verseCount
      );
      const baseline = ledger.resolutionBaselineMetrics!;
      for (const key of [
        "verseCount",
        "wordCount",
        "readerVisibleStrongCount",
        "readerTaggedTokenCount",
        "readerOverBudgetStrongCount"
      ] as const)
        assert.equal(
          ledger.metrics[key],
          baseline[key],
          `reader-regression:${bible}:${key}`
        );
      const sqlitePath = ledger.outputPaths.sqlite;
      const summary = {
        bible,
        input,
        translationProfile: ledger.translationProfile,
        resolution: ledger.resolutionSummary,
        metrics: ledger.metrics,
        baselineMetrics: baseline,
        lexicalMetrics: ledger.lexicalResolutionMetrics
      };
      ledger.verses.length = 0;
      console.log(JSON.stringify({ bible, phase: "verify-and-export" }));
      const validation = await verifyAutonomousBible({
        bible,
        sqlitePath,
        inputPath,
        resolutionOutput: path.join(directory, "resolution.jsonl")
      });
      const identity = await loadDefaultStepIdentityIndex();
      const compact = await writeGeneratedStrongJsonl({
        bible,
        version: bible.toUpperCase(),
        sqlitePath,
        outputPath: path.join(directory, `bible-${bible}-strong.jsonl`),
        manifestPath: path.join(directory, "compact-manifest.json"),
        identityIndex: identity.identityIndex,
        identityFiles: identity.identityFiles
      });
      const result = {
        ...summary,
        validation,
        compact,
        assurance:
          "All native verses and modeled source occurrences accounted for. Policy support and structural completeness do not assert independent semantic certainty."
      };
      const report = path.join(directory, "summary.json");
      await atomicJson(report, result);
      const files = [
        sqlitePath,
        report,
        path.join(directory, "resolution.jsonl"),
        compact.outputPath,
        compact.manifestPath,
        ledger.outputPaths.readerTsv,
        ledger.outputPaths.advancedTsv
      ];
      const hashes: Record<string, string> = {};
      for (const file of files) hashes[file] = await hash(file);
      for (const f of sourceFiles)
        assert.equal(
          await hash(f),
          codeHashes[f],
          `pipeline-code-changed-during-run:${f}`
        );
      run.bibles[bible] = {
        status: "verified",
        codeFingerprint,
        attempt,
        directory,
        hashes,
        summary: {
          verses: validation.verses,
          units: validation.sourceUnits,
          visible: validation.visible,
          empty: validation.empty,
          unresolved: validation.unresolved,
          policySupportedVerses: validation.policySupportedVerses,
          compactBytes: (await stat(compact.outputPath)).size
        }
      };
      await atomicJson(manifestFile, run);
      console.log(
        JSON.stringify({
          bible,
          status: "verified",
          summary: run.bibles[bible].summary
        })
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? `${error.message}\n${error.stack ?? ""}`
          : String(error);
      run.bibles[bible] = {
        status: "failed",
        attempt,
        directory,
        error: message
      };
      failures.push(bible);
      await atomicJson(manifestFile, run);
      console.error(
        JSON.stringify({ bible, status: "failed", error: message })
      );
    }
  }
  if (failures.length)
    throw new Error(`autonomous-run-incomplete:${failures.join(",")}`);
  return run;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
) {
  await runAutonomousBibles(
    path.resolve(process.argv[2] ?? "outputs/strong-autonomous/v1"),
    process.argv[3] ? process.argv[3].split(",") : undefined
  );
}
