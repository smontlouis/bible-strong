import assert from "node:assert/strict";
import { chmod, mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assemblePlanResponses,
  batchSegmentBindings,
  buildSdabcTranslationPlan,
  canonicalizeDuplicateSourceTranslations,
  canonicalJson,
  localizeSdabcFrenchMetadata,
  sha256,
  sourceAnomalies,
  validateBatchResponse
} from "./sdabc-french-translation-pipeline.mjs";
import {
  buildSdabcTranslationPrompt,
  parseCodexEvents,
  runSdabcBatches,
  sdabcCodexExecArgs
} from "./run-sdabc-french-codex-translations.mjs";
import {
  assertSdabcCodexBinary,
  ensureSdabcCodexBinary
} from "./sdabc-codex-runtime.mjs";
import { validateSdabcRunDirectory } from "./validate-sdabc-french-codex-translations.mjs";
import { persistValidatedSdabcTranslations } from "./persist-sdabc-french-codex-translations.mjs";
import { loadPublishedTranslations } from "./published-translations.mjs";
import { applySdabcMechanicalCopies } from "./sdabc-translations.mjs";
import { inspectSdabcSegmentTranslation } from "./audit-sdabc-french-codex-translations.mjs";

const entry = ({
  id = "sdabc:43-3-16:1",
  passage = "43-3-16",
  layer = "general-commentary",
  html = '<p>God loved <span class="bible-ref" data-reference-id="r1">John 3:16</span>.</p>',
  references = [
    {
      id: "r1",
      kind: "bible",
      osis: "John.3.16",
      label: "John 3:16",
      source: "bcv-text",
      confidence: "high"
    }
  ]
} = {}) => ({
  schemaVersion: 2,
  id,
  passage,
  passageEndVerse: Number(passage.split("-")[2]),
  anchor: passage,
  layer,
  scope: {
    kind: "verse",
    start: passage,
    source: "source-anchor",
    confidence: "exact"
  },
  source: { language: "en", html, sha256: sha256(html), references },
  translation: null
});

const responseFor = (
  batch,
  textOf = (segment) => `FR ${segment.sourceText}`
) => ({
  translations: Object.fromEntries(
    batchSegmentBindings(batch).map((binding) => [
      binding.key,
      {
        sourceText: binding.segment.sourceText,
        text: textOf(binding.segment)
      }
    ])
  )
});

test("le plan garde balises, attributs et citations hors du modèle", () => {
  const source = entry({
    layer: "egw-supplement",
    html: '<span><strong>Creation</strong> — See <span class="source-ref">Letter 1, 1900</span>; <span class="bible-ref" data-reference-id="r1">John 3:16</span>.</span>'
  });
  const first = buildSdabcTranslationPlan([source], {
    maxSourceCharacters: 20
  });
  const second = buildSdabcTranslationPlan([source], {
    maxSourceCharacters: 20
  });
  assert.deepEqual(first, second);
  assert.equal(first.manifest.counts.entries, 1);
  assert.ok(
    first.manifest.entries[0].template.includes(
      'class="source-ref">Letter 1, 1900</span>'
    )
  );
  assert.ok(
    !first.manifest.entries[0].segments.some((value) =>
      value.sourceText.includes("Letter 1, 1900")
    )
  );
  assert.ok(first.batches.length > 1);
  assert.match(first.batches[0].batchId, /^sdabc-fr-[a-f0-9]{16}$/u);
});

test("le gate place les anomalies structurelles en review", () => {
  const broken = { ...entry(), anchor: "43-3-15" };
  assert.ok(sourceAnomalies(broken).includes("anchor-passage-mismatch"));
  const plan = buildSdabcTranslationPlan([broken]);
  assert.equal(plan.manifest.counts.entries, 0);
  assert.equal(plan.manifest.counts.review, 1);
});

test("assemblage conserve exactement enveloppe HTML et identité OSIS", () => {
  const plan = buildSdabcTranslationPlan([entry()]);
  const responses = plan.batches.map((batch) =>
    responseFor(batch, (segment) =>
      segment.id === "t1" ? "Dieu a aimé " : "Jean 3:16"
    )
  );
  for (const [index, batch] of plan.batches.entries())
    validateBatchResponse(batch, responses[index]);
  const [result] = assemblePlanResponses(
    plan.manifest,
    plan.batches,
    responses
  );
  assert.match(
    result.translation.html,
    /<span class="bible-ref" data-reference-id="r1">/u
  );
  assert.equal(result.translation.references[0].osis, "John.3.16");
  assert.equal(result.translation.references[0].label, "Jean 3:16");
});

test("canonicalise l’ordre des références depuis les marqueurs HTML", () => {
  const source = entry({
    html: '<p><span class="bible-ref" data-reference-id="r2">John 3:17</span> puis <span class="bible-ref" data-reference-id="r1">John 3:16</span>.</p>',
    references: [
      {
        id: "r1",
        kind: "bible",
        osis: "John.3.16",
        label: "John 3:16",
        source: "bcv-text",
        confidence: "high"
      },
      {
        id: "r2",
        kind: "bible",
        osis: "John.3.17",
        label: "John 3:17",
        source: "bcv-text",
        confidence: "high"
      }
    ]
  });
  assert.deepEqual(sourceAnomalies(source), []);
  const plan = buildSdabcTranslationPlan([source]);
  assert.deepEqual(
    plan.manifest.entries[0].references.map((reference) => reference.id),
    ["r2", "r1"]
  );
  const [result] = assemblePlanResponses(
    plan.manifest,
    plan.batches,
    plan.batches.map((batch) => responseFor(batch))
  );
  assert.deepEqual(
    result.translation.references.map((reference) => reference.id),
    ["r2", "r1"]
  );
});

test("le validateur refuse le HTML produit par le modèle et les cardinalités fausses", () => {
  const plan = buildSdabcTranslationPlan([entry()]);
  const response = responseFor(plan.batches[0], () => "<em>interdit</em>");
  assert.throws(
    () => validateBatchResponse(plan.batches[0], response),
    /response-segment-markup/u
  );
  delete response.translations[Object.keys(response.translations).at(-1)];
  assert.throws(
    () => validateBatchResponse(plan.batches[0], response),
    /response-segment-cardinality/u
  );
});

test("le contrat source-bound refuse une traduction attachée au mauvais segment", () => {
  const plan = buildSdabcTranslationPlan([entry()]);
  const response = responseFor(plan.batches[0]);
  const first = Object.keys(response.translations)[0];
  response.translations[first].sourceText = "another source";
  assert.throws(
    () => validateBatchResponse(plan.batches[0], response),
    /response-segment-source/u
  );
  const prefixBound = responseFor(plan.batches[0]);
  const prefixKey = Object.keys(prefixBound.translations)[0];
  prefixBound.translations[prefixKey].sourceText =
    prefixBound.translations[prefixKey].sourceText.slice(0, 12);
  assert.equal(validateBatchResponse(plan.batches[0], prefixBound), true);
  const legacy = {
    translations: Object.fromEntries(
      batchSegmentBindings(plan.batches[0]).map((binding) => [
        binding.key,
        `FR ${binding.segment.sourceText}`
      ])
    )
  };
  assert.equal(validateBatchResponse(plan.batches[0], legacy), true);
});

test("arguments et prompt verrouillent luna high en lecture seule", () => {
  const plan = buildSdabcTranslationPlan([entry()]);
  const args = sdabcCodexExecArgs({
    schemaPath: "/tmp/schema.json",
    responsePath: "/tmp/response.json",
    cwd: "/tmp"
  });
  assert.ok(args.includes("gpt-5.6-luna"));
  assert.ok(args.includes('model_reasoning_effort="high"'));
  assert.deepEqual(args.slice(args.indexOf("-s"), args.indexOf("-s") + 2), [
    "-s",
    "read-only"
  ]);
  const prompt = buildSdabcTranslationPrompt(plan.batches[0]);
  assert.match(prompt, /aucun HTML/u);
  assert.match(prompt, /ne complète jamais le fragment/u);
});

test("événements Codex lient thread et réponse structurée", () => {
  const response = JSON.stringify({ ok: true });
  const stdout = [
    JSON.stringify({
      type: "thread.started",
      thread_id: "00000000-0000-4000-8000-000000000000"
    }),
    JSON.stringify({
      type: "item.completed",
      item: {
        type: "error",
        message:
          "Code Mode is unavailable because code-mode host is disabled. Code mode will fail closed; enable `features.code_mode_host` and install `codex-code-mode-host`."
      }
    }),
    JSON.stringify({ type: "turn.started" }),
    JSON.stringify({
      type: "item.completed",
      item: { type: "agent_message", text: response }
    }),
    JSON.stringify({ type: "turn.completed", usage: { output_tokens: 4 } })
  ].join("\n");
  assert.equal(parseCodexEvents(stdout, response).usage.output_tokens, 4);
});

test("runtime SDABC possède son pin indépendant et refuse un binaire modifié", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdabc-runtime-"));
  const source = path.join(root, "source");
  const target = path.join(root, "runtime", "codex");
  await writeFile(source, "#!/bin/sh\necho codex-test\n");
  await chmod(source, 0o755);
  const hash = sha256(await readFile(source));
  const identity = ensureSdabcCodexBinary({
    destination: target,
    source,
    expectedVersion: "codex-test",
    expectedSha256: hash
  });
  assert.equal(identity.sha256, hash);
  await chmod(target, 0o755);
  assert.throws(
    () =>
      assertSdabcCodexBinary(target, {
        expectedVersion: "codex-test",
        expectedSha256: hash
      }),
    /binary-writable/u
  );
});

test("runner installe un receipt en dernier et reprend sans rappeler le modèle", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "sdabc-runner-"));
  const planRoot = path.join(root, "plan");
  const outputRoot = path.join(root, "runs");
  const plan = buildSdabcTranslationPlan([entry()]);
  await mkdir(path.join(planRoot, "batches"), { recursive: true });
  await writeFile(
    path.join(planRoot, "manifest.json"),
    JSON.stringify(plan.manifest)
  );
  await writeFile(path.join(planRoot, "response.schema.json"), "{}");
  for (const batch of plan.batches)
    await writeFile(
      path.join(planRoot, "batches", `${batch.batchId}.json`),
      JSON.stringify(batch)
    );
  let calls = 0;
  const executor = async ({ batch }) => {
    calls += 1;
    const response = responseFor(batch);
    const responseText = JSON.stringify(response);
    return {
      response,
      responseText,
      stdout: [
        JSON.stringify({
          type: "thread.started",
          thread_id: "00000000-0000-4000-8000-000000000000"
        }),
        JSON.stringify({ type: "turn.started" }),
        JSON.stringify({
          type: "item.completed",
          item: { type: "agent_message", text: responseText }
        }),
        JSON.stringify({ type: "turn.completed", usage: {} })
      ].join("\n"),
      stderr: "",
      threadId: "00000000-0000-4000-8000-000000000000",
      usage: null
    };
  };
  const options = {
    planRoot,
    outputRoot,
    codexHome: root,
    binary: { path: "/fake/codex", version: "test", sha256: "0".repeat(64) },
    concurrency: 4,
    maxAttempts: 2,
    timeoutMs: 1000,
    batchIds: []
  };
  await runSdabcBatches(options, { executor });
  await runSdabcBatches(options, { executor });
  assert.equal(calls, plan.batches.length);
  const receipt = JSON.parse(
    await readFile(
      path.join(outputRoot, plan.batches[0].batchId, "receipt.json")
    )
  );
  assert.equal(receipt.model, "gpt-5.6-luna");
  assert.equal(receipt.reasoningEffort, "high");
  assert.equal(receipt.batchHash, plan.batches[0].batchHash);
  assert.equal(
    receipt.runHash,
    sha256(
      canonicalJson(
        Object.fromEntries(
          Object.entries(receipt).filter(([key]) => key !== "runHash")
        )
      )
    )
  );
  const validation = await validateSdabcRunDirectory({
    planRoot,
    runsRoot: outputRoot,
    outputPath: path.join(root, "validated.jsonl")
  });
  assert.equal(validation.translations, 1);
  assert.equal(validation.reviews, 0);

  const libraryRoot = path.join(root, "library");
  const chunkPath = path.join(libraryRoot, "chunks/43/3/sdabc.json");
  const chunk = JSON.stringify({
    schemaVersion: 1,
    resourceId: "sdabc",
    entries: [entry()]
  });
  await mkdir(path.dirname(chunkPath), { recursive: true });
  await writeFile(chunkPath, chunk);
  await writeFile(
    path.join(libraryRoot, "index.json"),
    JSON.stringify({
      chapters: [
        {
          book: 43,
          chapter: 3,
          resources: {
            sdabc: { path: "chunks/43/3/sdabc.json", sha256: sha256(chunk) }
          }
        }
      ]
    })
  );
  const publishedRoot = path.join(root, "published");
  const persisted = await persistValidatedSdabcTranslations({
    planRoot,
    runsRoot: outputRoot,
    validatedOutput: path.join(root, "persisted.validated.jsonl"),
    libraryRoot,
    publishedRoot,
    batchSize: 1
  });
  assert.equal(persisted.store.entries, 1);
  assert.equal(persisted.quality.blockingIssues, 0);
  const published = await loadPublishedTranslations(publishedRoot, "sdabc");
  assert.equal(published.translations.size, 1);
  assert.equal(
    published.translations.get(entry().id).translator.model,
    "gpt-5.6-luna"
  );
});

test("l’audit linguistique bloque les longues copies anglaises et les troncatures", () => {
  const english =
    "The Lord is with his people and the faithful servant walks in the way of truth because God has given this command to all who hear his voice. ";
  assert.ok(
    inspectSdabcSegmentTranslation(english, english).includes(
      "identical-long-segment"
    )
  );
  assert.ok(
    inspectSdabcSegmentTranslation(english.repeat(3), "Très court.").includes(
      "suspiciously-short-translation"
    )
  );
  assert.deepEqual(
    inspectSdabcSegmentTranslation(
      english,
      "Le Seigneur est avec son peuple, et le serviteur fidèle marche dans la voie de la vérité parce que Dieu a donné ce commandement à tous ceux qui entendent sa voix."
    ),
    []
  );
  assert.ok(
    inspectSdabcSegmentTranslation(
      "See 12:4 and 40:2 for the two witnesses.",
      "Voir 12:4 pour les deux témoins."
    ).includes("numeric-token-mismatch")
  );
  const citation =
    "Nichol, F. D. (1978). The Seventh-day Adventist Bible Commentary : The Holy Bible with exegetical and expository comment. Commentary Reference Series (";
  assert.deepEqual(inspectSdabcSegmentTranslation(citation, citation), []);
  assert.deepEqual(
    inspectSdabcSegmentTranslation(
      `). Washington, D.C.: Review and Herald Publishing Association. ${citation}`,
      `). Washington, D.C.: Review and Herald Publishing Association. ${citation}`
    ),
    []
  );
  assert.deepEqual(
    inspectSdabcSegmentTranslation(
      "Ravished my heart. The Hebrew verb is derived from the noun heart. Solomon said literally that you have hearted me and perhaps meant that you have encouraged me.",
      "Tu as ravi mon cœur. Le verbe hébreu est dérivé du nom cœur. Salomon a dit littéralement : tu m’as donné un cœur. Ce qu’il voulait peut-être dire était : tu m’as encouragé."
    ),
    []
  );
});

test("copie seulement les marqueurs EGW non linguistiques", () => {
  const marker = entry({
    id: "egw:marker",
    layer: "egw-supplement",
    html: "<span>*****</span>"
  });
  const prose = entry({
    id: "egw:prose",
    layer: "egw-supplement",
    html: "<span>Words.</span>"
  });
  const result = applySdabcMechanicalCopies([marker, prose]);
  assert.equal(result.applied, 1);
  assert.equal(result.entries[0].translation.origin.kind, "mechanical-copy");
  assert.equal(result.entries[1].translation, null);
});

test("réemploie une traduction canonique pour une source anglaise identique", () => {
  const sourceSha256 = "a".repeat(64);
  const records = canonicalizeDuplicateSourceTranslations([
    {
      id: "sdabc:6-21-15:13",
      sourceSha256,
      translation: {
        html: "<p>Deuxième variante.</p>",
        sha256: sha256("<p>Deuxième variante.</p>")
      }
    },
    {
      id: "sdabc:6-15-15:14",
      sourceSha256,
      translation: {
        html: "<p>Variante canonique.</p>",
        sha256: sha256("<p>Variante canonique.</p>")
      }
    }
  ]);
  assert.equal(records[0].translation.html, "<p>Variante canonique.</p>");
  assert.deepEqual(records[0].origin, {
    kind: "identical-source-reuse",
    sourceId: "sdabc:6-15-15:14"
  });
  assert.equal(records[1].origin, undefined);
});

test("localise les renvois éditoriaux EGW sans toucher aux citations", () => {
  assert.equal(
    localizeSdabcFrenchMetadata(
      '<span>Voir <span class="source-ref">EGW comments on ch. 5:18-23</span> et <span class="source-ref">Manuscript 1, 1901</span>.</span>'
    ),
    '<span>Voir <span class="source-ref">les commentaires d’EGW sur le chap. 5:18-23</span> et <span class="source-ref">Manuscript 1, 1901</span>.</span>'
  );
  assert.equal(
    localizeSdabcFrenchMetadata(
      '<span>voir <span class="source-ref">EGW on Ephesians 4:30</span>, <span class="source-ref">EGW on chs. 12:17</span> et <span class="source-ref">The Review and Herald, July 13, 1897</span>.</span>'
    ),
    '<span>voir <span class="source-ref">les commentaires d’EGW sur Éphésiens 4:30</span>, <span class="source-ref">les commentaires d’EGW sur les chap. 12:17</span> et <span class="source-ref">The Review and Herald, July 13, 1897</span>.</span>'
  );
});
