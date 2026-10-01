/** New prospective sample for the French bare-object-particle rule; no manual reviews. */
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdir,
  readFile,
  readdir,
  copyFile,
  writeFile
} from "node:fs/promises";
import path from "node:path";
import { BOOK_IDS } from "../../src/books.js";
import { contentFingerprint } from "../../src/contentAddressedCache.js";
import { buildStrongVerseMap, readStrongCsv } from "../../src/strongCsv.js";
import {
  excludedReferenceNamesForGold,
  extractGoldCarrierPlacements,
  selectStratifiedRefs
} from "../../src/evaluateStrongGold.js";
import { generateStrongLedgerWithDictionary } from "../../src/strongLedger.js";
import { stripTags } from "../../src/tokenize.js";
import {
  resolveDossier,
  type ResolutionDossier
} from "../../src/strongResolutionWorkflow.js";
import { GRAMMATICAL_EMPTY_RULE } from "../../src/strongGrammaticalEmpty.js";
import { withoutPublisherNotes } from "../strong-arbitration-benchmark/reader-text.js";
import {
  GOLDS,
  sha,
  chapter,
  carrierKey
} from "../strong-alignment-benchmark/shared.js";

interface Plan {
  evalRefs: string[];
  reserveRefs: string[];
  oldExcludedChapters: string[];
  dictionaryPath: string;
  dictionarySha256: string;
  sources: Array<{ file: string; sha256: string }>;
  manifests: Array<{ gold: string; goldSha256: string }>;
}
const root = path.resolve(process.argv[2]);
await mkdir(path.dirname(root), { recursive: true });
await mkdir(root);
const planFile = "outputs/strong-alignment-benchmark/v2-reader-text/plan.json";
const plan: Plan = JSON.parse(await readFile(planFile, "utf8"));
const inputs = {
  [planFile]: sha(await readFile(planFile)),
  [plan.dictionaryPath]: plan.dictionarySha256,
  ...Object.fromEntries(plan.sources.map((s) => [s.file, s.sha256])),
  ...Object.fromEntries(
    plan.manifests.map((m) => [`data/strongs/${m.gold}.csv`, m.goldSha256])
  )
};
for (const [file, hash] of Object.entries(inputs))
  assert.equal(sha(await readFile(file)), hash, `input-drift:${file}`);
const maps = new Map(
  await Promise.all(
    GOLDS.map(
      async (g) =>
        [
          g,
          buildStrongVerseMap(await readStrongCsv(`data/strongs/${g}.csv`))
        ] as const
    )
  )
);
const excludedChapters = new Set([
  ...plan.oldExcludedChapters,
  ...plan.evalRefs.map(chapter),
  ...plan.reserveRefs.map(chapter)
]);
const otBooks = new Set<string>(BOOK_IDS.slice(0, 39));
const available = [...maps.get("Sg1910")!.keys()].filter(
  (ref) =>
    otBooks.has(ref.split(".")[0]) &&
    !excludedChapters.has(chapter(ref)) &&
    GOLDS.every((g) => maps.get(g)!.has(ref))
);
const refs = selectStratifiedRefs(available, 200);
assert.equal(refs.length, 200);
assert.equal(new Set(refs).size, 200);
const codeFiles = [
  ...new Set([
    ...(await readdir("src", { recursive: true }))
      .filter((f) => f.endsWith(".ts"))
      .map((f) => path.join("src", f)),
    ...["run.ts", "viewer.ts", "grammar-check.ts"].map(
      (f) => `scripts/strong-resolution-workflow/${f}`
    ),
    "scripts/strong-occurrence-prototype/model.ts",
    "scripts/strong-arbitration-benchmark/reader-text.ts",
    "scripts/strong-alignment-benchmark/shared.ts",
    "scripts/strong-decision-benchmark/prepare.ts"
  ])
];
const code = Object.fromEntries(
  await Promise.all(codeFiles.map(async (f) => [f, sha(await readFile(f))]))
);
const lexical = () =>
  contentFingerprint({
    namespace: "grammar-empty-check-v1",
    inputPaths: [
      "data/external/french-lexical/kaikki",
      "data/external/french-lexical/rezojdm-cache",
      "data/external/french-lexical/openoffice/synonymes/handler/dictionary.go",
      "data/external/french-lexical/wolf/wolf-1.0b4.xml.bz2"
    ]
  });
const lexicalFingerprint = lexical();
async function write(file: string, data: unknown) {
  await writeFile(path.join(root, file), JSON.stringify(data, null, 2) + "\n", {
    flag: "wx"
  });
}
await write("freeze.json", {
  rule: GRAMMATICAL_EMPTY_RULE,
  refs,
  inputs,
  code,
  lexicalFingerprint,
  protocol:
    "200 OT references in chapters excluded from all earlier evaluated sets and initial pilot. Selection without target tags. Fixed rule and anchor convention before generation. Baseline excludes target editorial family. No semantic labels, remote calls or manual reviews. Exact/range CSV agreement is an editorial diagnostic, never an independent proof of absence."
});
for (const file of codeFiles) {
  const destination = path.join(root, "code", file);
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(file, destination);
}
const dossiers: ResolutionDossier[] = [];
for (const edition of GOLDS) {
  const dir = path.join(root, edition);
  await mkdir(dir);
  const bible: Record<string, Record<string, Record<string, string>>> = {};
  for (const ref of refs) {
    const [book, c, v] = ref.split(".");
    const number = String(
      BOOK_IDS.indexOf(book as (typeof BOOK_IDS)[number]) + 1
    );
    bible[number] ??= {};
    bible[number][c] ??= {};
    bible[number][c][v] = stripTags(
      withoutPublisherNotes(maps.get(edition)!.get(ref)!.row.text)
    );
  }
  const biblePath = path.join(dir, "masked-input.json");
  await writeFile(biblePath, JSON.stringify(bible) + "\n", { flag: "wx" });
  console.log(
    JSON.stringify({ phase: "baseline", edition, refs: refs.length })
  );
  const ledger = await generateStrongLedgerWithDictionary(
    {
      bible: edition,
      profileBible: edition === "Sg1910" ? "nbs" : "fmar",
      biblePath,
      outputDir: dir,
      writeArtifacts: false,
      writeLexicalReport: false,
      applyCuratedOverrides: false,
      excludedReferenceNames: excludedReferenceNamesForGold(edition, false)
    },
    {
      path: plan.dictionaryPath,
      activation: { mode: "legacy", path: plan.dictionaryPath }
    }
  );
  assert(
    ledger.references.every(
      (r) => !excludedReferenceNamesForGold(edition, false).includes(r.name)
    )
  );
  const ledgerPath = path.join(dir, "baseline-ledger.json");
  await writeFile(ledgerPath, JSON.stringify(ledger) + "\n", { flag: "wx" });
  const packet = path.join(dir, "packet");
  const child = spawnSync(
    "yarn",
    [
      "exec",
      "tsx",
      "scripts/strong-resolution-workflow/run.ts",
      "prepare-ledger",
      ledgerPath,
      packet
    ],
    { encoding: "utf8", maxBuffer: 2 ** 20 }
  );
  assert.equal(child.status, 0, child.stderr + child.stdout);
  const part: ResolutionDossier[] = JSON.parse(
    await readFile(path.join(packet, "dossiers.json"), "utf8")
  );
  assert.equal(part.length, 200);
  assert(part.every((d) => refs.includes(d.ref)));
  dossiers.push(...part);
}
for (const [file, hash] of Object.entries(code))
  assert.equal(
    sha(await readFile(file)),
    hash,
    `code-changed-before-prediction:${file}`
  );
assert.equal(lexical(), lexicalFingerprint, "lexical-drift");
await write("dossiers.json", dossiers);
const options = {
  applyExactWitness: false,
  applyAssistedReviews: false,
  applyGrammaticalEmpties: true,
  targetLanguage: "fr"
};
const predictions = dossiers.map((d) => resolveDossier(d, [], options));
assert.deepEqual(
  predictions,
  dossiers.map((d) => resolveDossier(d, [], options))
);
await write("predictions.json", predictions);
await write("prediction-manifest.json", {
  inputs,
  code,
  dossiersSha256: sha(await readFile(path.join(root, "dossiers.json"))),
  predictionsSha256: sha(await readFile(path.join(root, "predictions.json"))),
  options
});
// Only now compare predicted empty positions with target editorial labels.
const scores = {
  accepted: 0,
  exactEmptyAnchor: 0,
  emptyWithinObjectBoundary: 0,
  noLocalEmptyTag: 0,
  ambiguousLocalEmptyTags: 0,
  uniqueMarkerVisibleInReference: 0,
  repeatedMarkerUnscorable: 0,
  lostVisible: 0,
  newVisible: 0
};
const audits = [];
for (const [i, d] of dossiers.entries()) {
  const p = predictions[i];
  const before = d.placements
      .filter((x) => x.kind !== "empty")
      .map(carrierKey)
      .sort(),
    after = p.placements
      .filter((x) => x.kind !== "empty")
      .map(carrierKey)
      .sort();
  assert.deepEqual(after, before, "visible-placements-must-be-unchanged");
  const expected = extractGoldCarrierPlacements(
    withoutPublisherNotes(
      maps.get(d.edition as (typeof GOLDS)[number])!.get(d.ref)!.row.text
    )
  );
  const consumed = new Set<number>();
  for (const r of p.decisions.filter(
    (r) => r.assurance === "linguistic-rule"
  )) {
    const g = r.grammaticalDecision!;
    const object = d.placements.find(
      (x) => x.id === g.grammaticalRelation!.objectCarrierId
    )!;
    const afterIndex = g.anchor!.insertAfterWordIndex;
    const near = expected.flatMap((e, n) =>
      e.strong === "H0853" &&
      e.kind === "empty" &&
      e.insertAfterWordIndex! >= afterIndex &&
      e.insertAfterWordIndex! < object.startWordIndex! &&
      !consumed.has(n)
        ? [n]
        : []
    );
    const exact = near.filter(
      (n) => expected[n].insertAfterWordIndex === afterIndex
    );
    const chosen =
      exact.length === 1 ? exact[0] : near.length === 1 ? near[0] : undefined;
    if (chosen !== undefined) consumed.add(chosen);
    const comparison =
      exact.length === 1
        ? "exact"
        : near.length === 1
          ? "within-object-boundary"
          : near.length > 1
            ? "ambiguous"
            : "no-local-empty-tag";
    scores.accepted++;
    if (comparison === "exact") scores.exactEmptyAnchor++;
    if (comparison === "exact" || comparison === "within-object-boundary")
      scores.emptyWithinObjectBoundary++;
    if (comparison === "ambiguous") scores.ambiguousLocalEmptyTags++;
    if (comparison === "no-local-empty-tag") scores.noLocalEmptyTag++;
    const markers = d.units.filter((u) => u.unit.strong.includes("H0853"));
    const targetMarkers = expected.filter((e) => e.strong === "H0853");
    if (
      markers.length === 1 &&
      targetMarkers.length === 1 &&
      targetMarkers[0].kind !== "empty"
    )
      scores.uniqueMarkerVisibleInReference++;
    else if (markers.length !== 1) scores.repeatedMarkerUnscorable++;
    audits.push({
      edition: d.edition,
      ref: d.ref,
      sourceUnitId: r.sourceUnitId,
      text: d.text,
      grammaticalDecision: g,
      comparison,
      nearbyExpected: near.map((n) => expected[n]),
      markerCount: markers.length
    });
  }
}
const accounting = {
  units: predictions.reduce((n, p) => n + p.summary.units, 0),
  visible: predictions.reduce((n, p) => n + p.summary.visible, 0),
  empty: predictions.reduce((n, p) => n + p.summary.empty, 0),
  unresolved: predictions.reduce((n, p) => n + p.summary.unresolved, 0),
  coveredBefore: predictions.filter((p) =>
    p.decisions.every((r) => r.baseline.state !== "unresolved")
  ).length,
  coveredAfter: predictions.filter((p) => p.summary.translationAccountedFor)
    .length
};
const summary = {
  rule: GRAMMATICAL_EMPTY_RULE,
  refs: refs.length,
  texts: dossiers.length,
  accounting,
  scores,
  assurance:
    "Rule-supported lexical absence; anchor is an explicit editorial convention conditional on existing carriers. No independent semantic accuracy measured."
};
await write("summary.json", summary);
await write("audit.json", audits);
console.log(JSON.stringify(summary, null, 2));
