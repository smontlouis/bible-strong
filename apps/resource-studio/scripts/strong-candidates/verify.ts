/** Independent disk read-back. Quality-risk flags are diagnostics, not new predictions. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { once } from "node:events";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CanonicalVerseResolution } from "../../src/strongCanonicalResolution.js";
import { canonicalCarrier } from "../../src/strongCanonicalResolution.js";
import { readBibleJson } from "../../src/bibleJson.js";
import { readStrongLedgerSqlite } from "../../src/strongLedgerStore.js";
import {
  assertRenderedStrongInventory,
  type StrongLedgerAnnotation
} from "../../src/strongLedger.js";
import { CONCORDANCE_GENERATION_POLICY } from "../../src/strongConcordanceGeneration.js";
import {
  getStepSourceIdentity,
  readStepOriginalData
} from "../../src/stepOriginals.js";
import {
  loadDefaultStepIdentityIndex,
  writeGeneratedStrongJsonl
} from "../../src/generatedStrongJsonl.js";
import {
  escapeHtml,
  normalizeWord,
  stripTags,
  tokenizeText
} from "../../src/tokenize.js";
import { readUnparsedSourceRows } from "../../src/strongSourceCoverage.js";

const [rootArg, edition] = process.argv.slice(2);
assert(rootArg && ["neg79", "s21"].includes(edition));
const root = path.resolve(rootArg),
  env = path.join(root, "environment");
globalThis.fetch = async () => {
  throw new Error("network-forbidden");
};
process.chdir(env);
const inputManifest = JSON.parse(
  await readFile(path.join(root, "input-manifest.json"), "utf8")
);
for (const [file, expectedHash] of Object.entries(inputManifest.files)) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path.join(env, file)))
    hash.update(chunk);
  assert.equal(hash.digest("hex"), expectedHash, `input-drift:${file}`);
}
const out = path.join(root, "generated", edition),
  auditDir = path.join(root, "audit", edition);
await mkdir(auditDir, { recursive: true });
const sqlitePath = path.join(out, `bible-${edition}-strong.sqlite`);
const ledger = readStrongLedgerSqlite({ sqlitePath, includeVerses: false });
assert.equal(ledger.concordanceDisplay, "expressions");
assert.equal(ledger.generationOptions?.applyCuratedOverrides, false);
assert.deepEqual(
  ledger.references.map((r) => r.name),
  ["Sg1910", "Darby", "DarbyR"]
);
const expected = await readBibleJson(`data/bibles/bible-${edition}.json`);
const physical = new Map<string, { strong: string[]; ref: string }>();
const sourceDir = "data/external/stepbible/amalgamated";
const sourceFiles = (await readdir(sourceDir))
  .filter((f) => /^(TAHOT|TAGNT).*\.txt$/u.test(f))
  .sort()
  .map((f) => path.join(sourceDir, f));
const unparsedRows = await readUnparsedSourceRows(sourceFiles);
assert.deepEqual(
  [...(ledger.unparsedCanonicalSource ?? [])].sort((a, b) =>
    a.id.localeCompare(b.id)
  ),
  [...unparsedRows].sort((a, b) => a.id.localeCompare(b.id)),
  "raw-source-coverage-drift"
);
for (const name of (await readdir(sourceDir))
  .filter((f) => /^(TAHOT|TAGNT).*\.txt$/u.test(f))
  .sort()) {
  const data = await readStepOriginalData([path.join(sourceDir, name)]);
  for (const [ref, verse] of data.verseMap)
    for (const token of verse.tokens) {
      const id = getStepSourceIdentity(token)!;
      assert(id);
      const prior = physical.get(id);
      if (prior)
        assert.deepEqual(
          prior.strong,
          token.strong,
          `source-alias-disagreement:${id}`
        );
      else physical.set(id, { strong: token.strong, ref });
    }
}
const sourceOwners = new Map<string, string>();
const db = new DatabaseSync(sqlitePath, { readOnly: true });
assert.equal(
  Object.values(db.prepare("PRAGMA integrity_check").get()!)[0],
  "ok"
);
const streams = Object.fromEntries(
  ["resolutions", "risks", "unassigned-source"].map((n) => [
    n,
    createWriteStream(path.join(auditDir, n + ".jsonl"), { flags: "w" })
  ])
);
async function emit(name: string, item: unknown) {
  if (!streams[name].write(JSON.stringify(item) + "\n"))
    await once(streams[name], "drain");
}
const counts = {
  verses: 0,
  sourceUnits: 0,
  sourceOccurrences: 0,
  visible: 0,
  empty: 0,
  unresolved: 0,
  fullyAccountedVerses: 0,
  sourceIssueVerses: 0,
  readerCarriers: 0,
  readerEmpties: 0,
  unassignedSourceOccurrences: 0,
  unassignedSourceUnits: 0,
  sourceCorpusOccurrences: 0,
  explicitUnassignedOccurrences: 0,
  unparsedSourceRows: unparsedRows.length,
  sourceModelIncompleteVerses: 0
};
const risks: Record<string, number> = {},
  byBook: Record<
    string,
    { verses: number; visible: number; empty: number; unresolved: number }
  > = {};
const semanticHash = createHash("sha256");
const statement = db.prepare(
  "SELECT * FROM verses WHERE bible=? ORDER BY book_order,chapter,verse"
);
for (const row of statement.iterate(edition) as Iterable<
  Record<string, string>
>) {
  const input = expected[counts.verses];
  assert(input, `extra-verse:${row.ref}`);
  assert.equal(row.ref, `${input.bookId}.${input.chapter}.${input.verse}`);
  assert.equal(row.text, input.text, `text-drift:${row.ref}`);
  const tokens = tokenizeText(input.text).filter((t) => t.kind === "word");
  const annotations = JSON.parse(
    row.annotations_json
  ) as StrongLedgerAnnotation[];
  const r = JSON.parse(row.resolution_json) as CanonicalVerseResolution;
  assert.equal(r.concordance?.policy, CONCORDANCE_GENERATION_POLICY);
  assert.equal(
    r.targetTextSha256,
    createHash("sha256").update(input.text).digest("hex")
  );
  assert.equal(
    stripTags(row.reader_html),
    escapeHtml(input.text),
    `reader-text-drift:${row.ref}`
  );
  assertRenderedStrongInventory({
    ref: row.ref,
    wordCount: tokens.length,
    annotations,
    views: {
      readerHtml: row.reader_html,
      advancedHtml: row.advanced_html,
      debugHtml: row.debug_html
    }
  });
  const units = new Map(
    r.decisions.flatMap((u) => u.occurrenceIds.map((id) => [id, u] as const))
  );
  assert.equal(
    units.size,
    r.decisions.reduce((n, u) => n + u.occurrenceIds.length, 0),
    "duplicate-native-source-occurrence"
  );
  assert.equal(
    units.size,
    JSON.parse(row.inventories_json).original.length,
    `source-inventory-drift:${row.ref}`
  );
  for (const u of r.decisions) {
    const source = physical.get(u.sourceUnitId);
    assert(source, `unknown-source-unit:${u.sourceUnitId}`);
    for (const id of u.occurrenceIds) {
      const index = Number(id.slice(id.lastIndexOf(":") + 1));
      const key = `${u.sourceUnitId}:${index}`;
      assert(
        source.strong[index] && u.strong.includes(source.strong[index]),
        `source-component-drift:${key}`
      );
      assert(
        !sourceOwners.has(key),
        `source-used-in-two-native-verses:${key}:${sourceOwners.get(key)}:${row.ref}`
      );
      sourceOwners.set(key, row.ref);
    }
    assert(["visible", "empty", "unresolved"].includes(u.state));
    if (u.state === "empty")
      assert(
        u.anchor?.absenceEstablished && u.assurance === "linguistic-rule",
        "unsupported-empty"
      );
    if (u.state === "unresolved")
      assert(!u.anchor?.absenceEstablished, "failed-search-is-not-absence");
    counts[u.state]++;
  }
  const verseRisks: Array<{
    kind: string;
    unitId?: string;
    annotationId?: string;
    indices?: number[];
  }> = [];
  for (const a of annotations.filter((a) => a.visibility === "reader")) {
    const unit = units.get(a.originalOccurrenceId ?? "");
    assert(
      unit && unit.state !== "unresolved" && !unit.source.readingUnresolved,
      `uncertain-reader:${row.ref}:${a.id}`
    );
    const carrier = canonicalCarrier(a);
    assert(carrier);
    counts.readerCarriers++;
    if (carrier.kind === "empty") {
      assert(
        unit.state === "empty" &&
          unit.anchor?.absenceEstablished &&
          a.emptyEvidence?.absence.status === "linguistic-rule"
      );
      assert.equal(
        carrier.insertAfterWordIndex,
        unit.anchor.insertAfterWordIndex
      );
      counts.readerEmpties++;
    } else {
      assert(unit.state === "visible");
      assert(
        carrier.startWordIndex! >= 0 && carrier.endWordIndex! < tokens.length
      );
      if (unit.source.readingAssessment?.classification === "minor-same-lexeme")
        verseRisks.push({
          kind: "minor-reading-existing-carrier",
          unitId: unit.sourceUnitId,
          annotationId: a.id
        });
      if (r.decisions.filter((u) => u.strong.includes(a.strong)).length > 1)
        verseRisks.push({
          kind: "repeated-source-lexeme",
          unitId: unit.sourceUnitId,
          annotationId: a.id
        });
      if (carrier.kind === "word") {
        const word = normalizeWord(tokens[carrier.startWordIndex!].text);
        const matches = tokens.flatMap((t, i) =>
          normalizeWord(t.text) === word ? [i] : []
        );
        if (matches.length > 1)
          verseRisks.push({
            kind: "repeated-target-form",
            unitId: unit.sourceUnitId,
            annotationId: a.id,
            indices: matches
          });
      }
    }
  }
  if (r.issues.length)
    verseRisks.push({ kind: "source-or-correspondence-issue" });
  if (!r.decisions.length)
    verseRisks.push({ kind: "text-without-assigned-source" });
  for (const risk of verseRisks) risks[risk.kind] = (risks[risk.kind] ?? 0) + 1;
  if (verseRisks.length)
    await emit("risks", { ref: row.ref, risks: verseRisks });
  await emit("resolutions", { ref: row.ref, ...r });
  semanticHash.update(
    JSON.stringify({
      ref: row.ref,
      text: row.text,
      annotations,
      resolution: r
    }) + "\n"
  );
  const book = (byBook[input.bookId] ??= {
    verses: 0,
    visible: 0,
    empty: 0,
    unresolved: 0
  });
  book.verses++;
  for (const u of r.decisions) book[u.state]++;
  counts.verses++;
  counts.sourceUnits += r.decisions.length;
  counts.sourceOccurrences += units.size;
  counts.fullyAccountedVerses += r.metrics.fullyAccountedVerses;
  counts.sourceIssueVerses += r.issues.length > 0 ? 1 : 0;
  counts.sourceModelIncompleteVerses += r.issues.includes(
    "unparsed-step-source-rows"
  )
    ? 1
    : 0;
}
// Reuse the native statement after all awaited drains. Node 23 can finalize an
// otherwise dead statement while its iterator is still active.
assert(
  statement.get(edition),
  "statement-must-remain-live-until-readback-completes"
);
db.close();
assert.equal(counts.verses, expected.length);
assert.equal(
  counts.visible + counts.empty + counts.unresolved,
  counts.sourceUnits
);
const explicitUnassigned = new Map<string, string>();
for (const block of ledger.unassignedCanonicalSource ?? [])
  for (const occurrence of block.occurrences) {
    const index = Number(
      occurrence.occurrenceId.slice(
        occurrence.occurrenceId.lastIndexOf(":") + 1
      )
    );
    const key = `${occurrence.sourceIdentity}:${index}`;
    assert(
      !sourceOwners.has(key) && !explicitUnassigned.has(key),
      `duplicate-unassigned-owner:${key}`
    );
    assert(
      physical.get(occurrence.sourceIdentity!)?.strong[index] ===
        occurrence.strong,
      `unknown-unassigned-source:${key}`
    );
    explicitUnassigned.set(key, block.reason);
  }
counts.explicitUnassignedOccurrences = explicitUnassigned.size;
for (const [id, source] of physical) {
  counts.sourceCorpusOccurrences += source.strong.length;
  const pending = source.strong.flatMap((strong, index) =>
    sourceOwners.has(`${id}:${index}`)
      ? []
      : [
          {
            index,
            strong,
            reason:
              explicitUnassigned.get(`${id}:${index}`) ??
              "source-not-covered-by-native-correspondence"
          }
        ]
  );
  if (!pending.length) continue;
  counts.unassignedSourceUnits++;
  counts.unassignedSourceOccurrences += pending.length;
  await emit("unassigned-source", {
    sourceUnitId: id,
    sourceReference: source.ref,
    state: "unresolved-correspondence",
    absenceEstablished: false,
    components: pending
  });
}
assert.equal(
  counts.sourceOccurrences + counts.unassignedSourceOccurrences,
  counts.sourceCorpusOccurrences
);
for (const row of unparsedRows) await emit("unassigned-source", row);
for (const stream of Object.values(streams)) {
  stream.end();
  await once(stream, "finish");
}
const identity = await loadDefaultStepIdentityIndex();
const exportResult = await writeGeneratedStrongJsonl({
  bible: edition,
  version: `${edition.toUpperCase()}-CANDIDATE`,
  sqlitePath,
  outputPath: path.join(out, `bible-${edition}-strong.jsonl`),
  manifestPath: path.join(out, `bible-${edition}-strong.manifest.json`),
  ...identity
});
const hashes: Record<string, string> = {};
for (const file of [
  sqlitePath,
  exportResult.outputPath,
  ...Object.keys(streams).map((n) => path.join(auditDir, n + ".jsonl"))
]) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  hashes[path.relative(root, file)] = hash.digest("hex");
}
const summary = {
  edition,
  status: "local-candidate-structurally-verified",
  counts,
  byBook,
  riskFlags: risks,
  semanticSha256: semanticHash.digest("hex"),
  hashes,
  exportMetrics: exportResult.metrics,
  quality:
    "Not independently certified; risk flags are an audit queue, not demonstrated errors.",
  sourceAccountability:
    "Each modeled STEP component has one native owner or an unresolved-correspondence record. Raw records outside the importer's grammar are inventoried separately as unresolved-source-notation; their component identities are not guessed.",
  remoteModels: false,
  published: false
};
await writeFile(
  path.join(auditDir, "verification.json"),
  JSON.stringify(summary, null, 2) + "\n"
);
console.log(JSON.stringify({ edition, counts, riskFlags: risks }));
