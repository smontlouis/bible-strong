import { createHash } from "node:crypto";

export const SDABC_TRANSLATION_PLAN_SCHEMA = "sdabc-french-translation-plan@1";
export const SDABC_TRANSLATION_BATCH_SCHEMA =
  "sdabc-french-translation-batch@1";
export const SDABC_TRANSLATION_RESPONSE_SCHEMA =
  "sdabc-french-translation-response@4";
export const SDABC_TRANSLATION_RESULT_SCHEMA =
  "sdabc-french-translation-result@1";
export const SDABC_CODEX_RUN_SCHEMA = "sdabc-french-codex-run@2";
export const SDABC_TRANSLATOR = Object.freeze({
  provider: "OpenAI",
  model: "gpt-5.6-luna",
  reasoningEffort: "high"
});

const VOID_TAGS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr"
]);
const BLOCKED_TAGS = new Set([
  "a",
  "applet",
  "embed",
  "iframe",
  "object",
  "script",
  "style",
  "svg"
]);
const PROTECTED_CLASSES = new Set(["source-ref", "lang-x-tl"]);
const TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu;
const PASSAGE_PATTERN = /^(\d+)-(\d+)-(\d+)$/u;

export const sha256 = (value) =>
  createHash("sha256").update(value).digest("hex");

export const canonicalJson = (value) => JSON.stringify(sortValue(value));

const sortValue = (value) => {
  if (Array.isArray(value)) return value.map(sortValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortValue(value[key])])
  );
};

const decodeEntities = (value) =>
  String(value)
    .replace(/&nbsp;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&quot;/giu, '"')
    .replace(/&apos;|&#39;/giu, "'")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&#(\d+);/gu, (_, decimal) =>
      String.fromCodePoint(Number(decimal))
    )
    .replace(/&#x([\da-f]+);/giu, (_, hexadecimal) =>
      String.fromCodePoint(Number.parseInt(hexadecimal, 16))
    );

const escapeHtml = (value) =>
  String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

const tagName = (token) =>
  /^<\/?\s*([a-z][a-z0-9-]*)/iu.exec(token)?.[1]?.toLowerCase() ?? null;
const isClosingTag = (token) => /^<\//u.test(token);
const isSelfClosing = (token) => /\/\s*>$/u.test(token);
const classNames = (token) => {
  const match = /\bclass=(?:"([^"]*)"|'([^']*)')/iu.exec(token);
  return new Set(
    (match?.[1] ?? match?.[2] ?? "").split(/\s+/u).filter(Boolean)
  );
};

const splitText = (text, maxSegmentCharacters) => {
  if (text.length <= maxSegmentCharacters) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxSegmentCharacters) {
    const window = remaining.slice(0, maxSegmentCharacters + 1);
    let end = Math.max(
      window.lastIndexOf(" "),
      window.lastIndexOf("\n"),
      window.lastIndexOf("\t")
    );
    if (end < Math.floor(maxSegmentCharacters / 2)) end = maxSegmentCharacters;
    chunks.push(remaining.slice(0, end));
    remaining = remaining.slice(end);
  }
  if (remaining) chunks.push(remaining);
  return chunks;
};

/** Split only text nodes. Tags and every attribute remain in the immutable template. */
export const tokenizeTranslatableHtml = (
  html,
  { maxSegmentCharacters = 6_000 } = {}
) => {
  const source = String(html ?? "");
  const segments = [];
  const template = [];
  const stack = [];
  let cursor = 0;
  let protectedDepth = 0;

  const addText = (text) => {
    if (!text) return;
    if (protectedDepth || !/[\p{L}\p{N}]/u.test(decodeEntities(text))) {
      template.push(text);
      return;
    }
    for (const chunk of splitText(text, maxSegmentCharacters)) {
      if (!/[\p{L}\p{N}]/u.test(decodeEntities(chunk))) {
        template.push(chunk);
        continue;
      }
      const id = `t${segments.length + 1}`;
      segments.push({
        id,
        sourceText: decodeEntities(chunk),
        sourceTextSha256: sha256(decodeEntities(chunk))
      });
      template.push(`{{${id}}}`);
    }
  };

  for (const match of source.matchAll(TOKEN_PATTERN)) {
    addText(source.slice(cursor, match.index));
    const token = match[0];
    template.push(token);
    cursor = match.index + token.length;
    const name = tagName(token);
    if (!name || token.startsWith("<!--")) continue;
    if (isClosingTag(token)) {
      const frame = stack.pop();
      if (frame?.protected) protectedDepth -= 1;
      continue;
    }
    if (VOID_TAGS.has(name) || isSelfClosing(token)) continue;
    const protectedNode = [...classNames(token)].some((value) =>
      PROTECTED_CLASSES.has(value)
    );
    stack.push({ name, protected: protectedNode });
    if (protectedNode) protectedDepth += 1;
  }
  addText(source.slice(cursor));
  return { template: template.join(""), segments };
};

export const sourceContentHash = (entry) =>
  sha256(
    canonicalJson({
      html: entry.source.html,
      references: entry.source.references ?? [],
      externalSources: entry.source.externalSources ?? []
    })
  );

const markerIds = (html) =>
  [
    ...String(html).matchAll(/\bdata-reference-id=(?:"([^"]+)"|'([^']+)')/giu)
  ].map((match) => match[1] ?? match[2]);

const validReference = (reference) =>
  reference &&
  typeof reference.id === "string" &&
  reference.kind === "bible" &&
  typeof reference.osis === "string" &&
  reference.osis.length > 0;

const referencesInMarkerOrder = (entry) => {
  const references = entry.source?.references ?? [];
  const byId = new Map(
    references.map((reference) => [reference.id, reference])
  );
  return markerIds(entry.source?.html).map((id) => byId.get(id));
};

export const sourceAnomalies = (entry) => {
  const issues = [];
  const passage = PASSAGE_PATTERN.exec(String(entry.passage ?? ""));
  if (!passage) issues.push("invalid-passage");
  if (entry.anchor !== entry.passage) issues.push("anchor-passage-mismatch");
  if (entry.scope?.start && entry.scope.start !== entry.passage)
    issues.push("scope-start-passage-mismatch");
  if (
    passage &&
    Number.isInteger(entry.passageEndVerse) &&
    entry.passageEndVerse < Number(passage[3])
  ) {
    issues.push("passage-end-before-anchor");
  }
  const markers = markerIds(entry.source?.html);
  const references = entry.source?.references ?? [];
  if (
    new Set(markers).size !== markers.length ||
    new Set(references.map((value) => value.id)).size !== references.length
  ) {
    issues.push("duplicate-reference-id");
  }
  const referenceIds = new Set(references.map((reference) => reference.id));
  if (
    markers.length !== references.length ||
    markers.some((id) => !referenceIds.has(id))
  ) {
    issues.push("reference-set-mismatch");
  }
  if (!references.every(validReference)) issues.push("invalid-reference");
  return [...new Set(issues)].sort();
};

const buildEntry = (entry, maxSegmentCharacters) => {
  const tokenized = tokenizeTranslatableHtml(entry.source.html, {
    maxSegmentCharacters
  });
  const contentHash = sourceContentHash(entry);
  const record = {
    id: entry.id,
    layer: entry.layer,
    passage: entry.passage,
    anchor: entry.anchor,
    sourceSha256: entry.source.sha256,
    sourceContentHash: contentHash,
    template: tokenized.template,
    references: referencesInMarkerOrder(entry),
    externalSources: entry.source.externalSources ?? [],
    segments: tokenized.segments
  };
  return { ...record, inputHash: sha256(canonicalJson(record)) };
};

const taskParts = (entry, maxSourceCharacters) => {
  const parts = [];
  let current = [];
  let characters = 0;
  for (const segment of entry.segments) {
    if (
      current.length &&
      characters + segment.sourceText.length > maxSourceCharacters
    ) {
      parts.push(current);
      current = [];
      characters = 0;
    }
    current.push(segment);
    characters += segment.sourceText.length;
  }
  if (current.length) parts.push(current);
  return parts.map((segments, index) => ({
    entryId: entry.id,
    inputHash: entry.inputHash,
    partIndex: index,
    partCount: parts.length,
    sourceCharacters: segments.reduce(
      (sum, value) => sum + value.sourceText.length,
      0
    ),
    segments
  }));
};

export const buildSdabcTranslationPlan = (
  canonicalEntries,
  { maxSourceCharacters = 5_000, maxSegmentCharacters = 6_000 } = {}
) => {
  if (!Number.isInteger(maxSourceCharacters) || maxSourceCharacters < 1)
    throw new Error("invalid-max-source-characters");
  const entries = [];
  const reviews = [];
  const mechanical = [];
  for (const entry of [...canonicalEntries].sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true })
  )) {
    if (
      !["general-commentary", "egw-supplement"].includes(entry.layer) ||
      entry.translation
    )
      continue;
    if (
      typeof entry.source?.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/u.test(entry.source.sha256)
    ) {
      throw new Error(`source-provenance-hash-invalid:${entry.id}`);
    }
    const issues = sourceAnomalies(entry);
    if (issues.length) {
      reviews.push({
        id: entry.id,
        layer: entry.layer,
        passage: entry.passage,
        sourceSha256: entry.source.sha256,
        issues
      });
      continue;
    }
    const prepared = buildEntry(entry, maxSegmentCharacters);
    if (!prepared.segments.length) {
      mechanical.push({
        id: entry.id,
        layer: entry.layer,
        passage: entry.passage,
        sourceSha256: entry.source.sha256,
        sourceContentHash: prepared.sourceContentHash,
        translatedHtml: entry.source.html,
        reason: "no-translatable-text"
      });
      continue;
    }
    entries.push(prepared);
  }

  const tasks = entries.flatMap((entry) =>
    taskParts(entry, maxSourceCharacters)
  );
  const grouped = [];
  let current = [];
  let characters = 0;
  for (const task of tasks) {
    if (
      current.length &&
      characters + task.sourceCharacters > maxSourceCharacters
    ) {
      grouped.push(current);
      current = [];
      characters = 0;
    }
    current.push(task);
    characters += task.sourceCharacters;
  }
  if (current.length) grouped.push(current);

  const batches = grouped.map((tasksInBatch) => {
    const identity = tasksInBatch.map((task) => ({
      entryId: task.entryId,
      inputHash: task.inputHash,
      partIndex: task.partIndex,
      segmentIds: task.segments.map((segment) => segment.id)
    }));
    const batchId = `sdabc-fr-${sha256(canonicalJson(identity)).slice(0, 16)}`;
    const content = {
      schemaVersion: SDABC_TRANSLATION_BATCH_SCHEMA,
      batchId,
      resourceId: "sdabc",
      targetLanguage: "fr",
      requestedTranslator: SDABC_TRANSLATOR,
      sourceCharacters: tasksInBatch.reduce(
        (sum, task) => sum + task.sourceCharacters,
        0
      ),
      tasks: tasksInBatch
    };
    return { ...content, batchHash: sha256(canonicalJson(content)) };
  });

  const content = {
    schemaVersion: SDABC_TRANSLATION_PLAN_SCHEMA,
    resourceId: "sdabc",
    targetLanguage: "fr",
    requestedTranslator: SDABC_TRANSLATOR,
    policy: {
      maxSourceCharacters,
      maxSegmentCharacters,
      html: "immutable-template-text-nodes-only",
      modelOutput: "required-ordinal-keyed-text-only",
      sourceAnomalies: "review-only-no-heuristic-repair"
    },
    entries,
    reviews,
    mechanical,
    batches: batches.map((batch) => ({
      batchId: batch.batchId,
      batchHash: batch.batchHash
    })),
    counts: {
      entries: entries.length,
      tasks: tasks.length,
      segments: entries.reduce((sum, entry) => sum + entry.segments.length, 0),
      batches: batches.length,
      review: reviews.length,
      mechanical: mechanical.length
    }
  };
  return {
    manifest: { ...content, manifestHash: sha256(canonicalJson(content)) },
    batches
  };
};

export const batchSegmentBindings = (batch) => {
  let index = 0;
  return batch.tasks.flatMap((task, taskIndex) =>
    task.segments.map((segment) => ({
      key: `s${String(++index).padStart(4, "0")}`,
      task,
      taskIndex,
      segment
    }))
  );
};

export const legacyResponseJsonSchema = (batch) => {
  const bindings = batchSegmentBindings(batch);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["translations"],
    properties: {
      translations: {
        type: "object",
        additionalProperties: false,
        required: bindings.map((binding) => binding.key),
        properties: Object.fromEntries(
          bindings.map((binding) => [
            binding.key,
            { type: "string", minLength: 1 }
          ])
        )
      }
    }
  };
};

export const exactSourceResponseJsonSchema = (batch) => {
  const bindings = batchSegmentBindings(batch);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["translations"],
    properties: {
      translations: {
        type: "object",
        additionalProperties: false,
        required: bindings.map((binding) => binding.key),
        properties: Object.fromEntries(
          bindings.map((binding) => [
            binding.key,
            {
              type: "object",
              additionalProperties: false,
              required: ["sourceText", "text"],
              properties: {
                sourceText: {
                  type: "string",
                  const: binding.segment.sourceText
                },
                text: { type: "string", minLength: 1 }
              }
            }
          ])
        )
      }
    }
  };
};

export const responseJsonSchema = (batch) => {
  const bindings = batchSegmentBindings(batch);
  return {
    $schema: "https://json-schema.org/draft/2020-12/schema",
    type: "object",
    additionalProperties: false,
    required: ["translations"],
    properties: {
      translations: {
        type: "object",
        additionalProperties: false,
        required: bindings.map((binding) => binding.key),
        properties: Object.fromEntries(
          bindings.map((binding) => [
            binding.key,
            {
              type: "object",
              additionalProperties: false,
              required: ["sourceText", "text"],
              properties: {
                sourceText: {
                  type: "string",
                  minLength: Math.min(12, binding.segment.sourceText.length),
                  maxLength: binding.segment.sourceText.length
                },
                text: { type: "string", minLength: 1 }
              }
            }
          ])
        )
      }
    }
  };
};

export const translatedTextFor = (response, key) => {
  const value = response?.translations?.[key];
  return typeof value === "string" ? value : value?.text;
};

export const normalizedSourceBinding = (value) =>
  String(value)
    .normalize("NFKC")
    .toLocaleLowerCase("en")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export const sourceBindingMatches = (sourceText, echoedSourceText) => {
  const expected = normalizedSourceBinding(sourceText);
  const actual = normalizedSourceBinding(echoedSourceText);
  return (
    actual.length >= Math.min(12, expected.length) &&
    expected.startsWith(actual)
  );
};

export const validateBatchResponse = (batch, response) => {
  const bindings = batchSegmentBindings(batch);
  if (
    !response?.translations ||
    typeof response.translations !== "object" ||
    Array.isArray(response.translations) ||
    Object.keys(response.translations).length !== bindings.length
  ) {
    throw new Error(`response-segment-cardinality:${batch.batchId}`);
  }
  const values = Object.values(response.translations);
  const legacy = values.every((value) => typeof value === "string");
  const sourceBound = values.every(
    (value) => value && typeof value === "object" && !Array.isArray(value)
  );
  if (!legacy && !sourceBound) {
    throw new Error(`response-segment-shape:${batch.batchId}`);
  }
  for (const binding of bindings) {
    const value = response.translations[binding.key];
    if (
      sourceBound &&
      (Object.keys(value).length !== 2 ||
        typeof value.sourceText !== "string" ||
        !sourceBindingMatches(binding.segment.sourceText, value.sourceText))
    ) {
      throw new Error(
        `response-segment-source:${batch.batchId}:${binding.key}:${binding.segment.id}`
      );
    }
    const output = translatedTextFor(response, binding.key);
    if (typeof output !== "string" || !output.trim()) {
      throw new Error(
        `response-segment-cardinality:${batch.batchId}:${binding.key}`
      );
    }
    if (/<[^>]*>|\{\{[^}]+\}\}/u.test(output)) {
      throw new Error(
        `response-segment-markup:${batch.batchId}:${binding.key}:${binding.segment.id}`
      );
    }
  }
  return true;
};

const htmlTags = (html) =>
  [...String(html).matchAll(TOKEN_PATTERN)].map((match) => match[0]);

export const assertBalancedHtml = (html) => {
  const stack = [];
  for (const token of htmlTags(html)) {
    if (token.startsWith("<!--")) continue;
    const name = tagName(token);
    if (!name) throw new Error("invalid-html-token");
    if (BLOCKED_TAGS.has(name)) throw new Error(`blocked-html-tag:${name}`);
    if (isClosingTag(token)) {
      if (stack.pop() !== name) throw new Error(`unbalanced-html-tag:${name}`);
    } else if (!VOID_TAGS.has(name) && !isSelfClosing(token)) stack.push(name);
  }
  if (stack.length) throw new Error(`unclosed-html-tag:${stack.at(-1)}`);
  return true;
};

const SDABC_FRENCH_BIBLE_BOOKS = new Map([
  ["Genesis", "Genèse"],
  ["Exodus", "Exode"],
  ["Leviticus", "Lévitique"],
  ["Numbers", "Nombres"],
  ["Deuteronomy", "Deutéronome"],
  ["Joshua", "Josué"],
  ["Judges", "Juges"],
  ["Ruth", "Ruth"],
  ["1 Samuel", "1 Samuel"],
  ["2 Samuel", "2 Samuel"],
  ["1 Kings", "1 Rois"],
  ["2 Kings", "2 Rois"],
  ["1 Chronicles", "1 Chroniques"],
  ["2 Chronicles", "2 Chroniques"],
  ["Ezra", "Esdras"],
  ["Nehemiah", "Néhémie"],
  ["Esther", "Esther"],
  ["Job", "Job"],
  ["Psalms", "Psaumes"],
  ["Psalm", "Psaume"],
  ["Proverbs", "Proverbes"],
  ["Ecclesiastes", "Ecclésiaste"],
  ["Song of Solomon", "Cantique des cantiques"],
  ["Isaiah", "Ésaïe"],
  ["Jeremiah", "Jérémie"],
  ["Lamentations", "Lamentations"],
  ["Ezekiel", "Ézéchiel"],
  ["Daniel", "Daniel"],
  ["Hosea", "Osée"],
  ["Joel", "Joël"],
  ["Amos", "Amos"],
  ["Obadiah", "Abdias"],
  ["Jonah", "Jonas"],
  ["Micah", "Michée"],
  ["Nahum", "Nahum"],
  ["Habakkuk", "Habacuc"],
  ["Zephaniah", "Sophonie"],
  ["Haggai", "Aggée"],
  ["Zechariah", "Zacharie"],
  ["Malachi", "Malachie"],
  ["Matthew", "Matthieu"],
  ["Mark", "Marc"],
  ["Luke", "Luc"],
  ["John", "Jean"],
  ["Acts", "Actes"],
  ["Romans", "Romains"],
  ["1 Corinthians", "1 Corinthiens"],
  ["2 Corinthians", "2 Corinthiens"],
  ["Galatians", "Galates"],
  ["Ephesians", "Éphésiens"],
  ["Philippians", "Philippiens"],
  ["Colossians", "Colossiens"],
  ["1 Thessalonians", "1 Thessaloniciens"],
  ["2 Thessalonians", "2 Thessaloniciens"],
  ["1 Timothy", "1 Timothée"],
  ["2 Timothy", "2 Timothée"],
  ["Titus", "Tite"],
  ["Philemon", "Philémon"],
  ["Hebrews", "Hébreux"],
  ["James", "Jacques"],
  ["1 Peter", "1 Pierre"],
  ["2 Peter", "2 Pierre"],
  ["1 John", "1 Jean"],
  ["2 John", "2 Jean"],
  ["3 John", "3 Jean"],
  ["Jude", "Jude"],
  ["Revelation", "Apocalypse"]
]);

const localizeEgwReferenceTarget = (target) => {
  const structural = String(target)
    .replace(/^chs\.\s*/u, "les chap. ")
    .replace(/^ch\.\s*/u, "le chap. ")
    .replace(/^vs\.\s*/u, "les v. ")
    .replace(/^v\.\s*/u, "le v. ");
  for (const [english, french] of SDABC_FRENCH_BIBLE_BOOKS) {
    if (structural === english || structural.startsWith(`${english} `)) {
      return `${french}${structural.slice(english.length)}`;
    }
  }
  return structural;
};

export const localizeSdabcFrenchMetadata = (html) =>
  String(html).replace(
    /(<span\b[^>]*\bclass=(?:"[^"]*\bsource-ref\b[^"]*"|'[^']*\bsource-ref\b[^']*')[^>]*>)EGW(?: comments)? on ([^<]+)(<\/span>)/gu,
    (_, opening, target, closing) =>
      `${opening}les commentaires d’EGW sur ${localizeEgwReferenceTarget(target)}${closing}`
  );

const labelsByReferenceId = (html) => {
  const labels = new Map();
  const pattern =
    /<span\b([^>]*)\bdata-reference-id=(?:"([^"]+)"|'([^']+)')([^>]*)>([\s\S]*?)<\/span>/giu;
  for (const match of String(html).matchAll(pattern)) {
    const id = match[2] ?? match[3];
    const label = decodeEntities(
      match[5]
        .replace(/<[^>]*>/gu, " ")
        .replace(/\s+/gu, " ")
        .trim()
    );
    if (labels.has(id)) throw new Error(`duplicate-assembled-reference:${id}`);
    labels.set(id, label);
  }
  return labels;
};

export const assembleTranslation = (entry, segmentTranslations) => {
  if (
    sha256(
      canonicalJson({
        id: entry.id,
        layer: entry.layer,
        passage: entry.passage,
        anchor: entry.anchor,
        sourceSha256: entry.sourceSha256,
        sourceContentHash: entry.sourceContentHash,
        template: entry.template,
        references: entry.references,
        externalSources: entry.externalSources,
        segments: entry.segments
      })
    ) !== entry.inputHash
  )
    throw new Error(`entry-input-hash-mismatch:${entry.id}`);
  const expectedIds = entry.segments.map((value) => value.id);
  if (
    segmentTranslations.size !== expectedIds.length ||
    expectedIds.some((id) => !segmentTranslations.has(id))
  ) {
    throw new Error(`entry-segment-coverage:${entry.id}`);
  }
  const html = localizeSdabcFrenchMetadata(
    entry.template.replace(/\{\{(t\d+)\}\}/gu, (_, id) =>
      escapeHtml(segmentTranslations.get(id))
    )
  );
  if (htmlTags(html).join("\u0000") !== htmlTags(entry.template).join("\u0000"))
    throw new Error(`entry-html-envelope:${entry.id}`);
  assertBalancedHtml(html);
  if (
    markerIds(html).join("\u0000") !==
    entry.references.map((value) => value.id).join("\u0000")
  ) {
    throw new Error(`entry-reference-sequence:${entry.id}`);
  }
  const labels = labelsByReferenceId(html);
  const references = entry.references.map((reference) => ({
    ...reference,
    label: labels.get(reference.id) ?? reference.label
  }));
  const content = {
    language: "fr",
    html,
    sha256: sha256(html),
    ...(references.length ? { references } : {}),
    ...(entry.externalSources.length
      ? { externalSources: entry.externalSources }
      : {})
  };
  return content;
};

export const assemblePlanResponses = (manifest, batches, responses) => {
  const batchById = new Map(batches.map((value) => [value.batchId, value]));
  if (
    batchById.size !== manifest.batches.length ||
    responses.length !== manifest.batches.length
  )
    throw new Error("plan-batch-coverage");
  const translatedSegments = new Map();
  for (const [batchIndex, descriptor] of manifest.batches.entries()) {
    const batch = batchById.get(descriptor.batchId);
    const response = responses[batchIndex];
    if (!batch || batch.batchHash !== descriptor.batchHash || !response)
      throw new Error(`plan-batch-identity:${descriptor.batchId}`);
    validateBatchResponse(batch, response);
    const outputByTask = new Map();
    for (const binding of batchSegmentBindings(batch)) {
      const outputs = outputByTask.get(binding.taskIndex) ?? new Map();
      outputs.set(binding.segment.id, translatedTextFor(response, binding.key));
      outputByTask.set(binding.taskIndex, outputs);
    }
    for (const [taskIndex, task] of batch.tasks.entries()) {
      const bySegment = translatedSegments.get(task.entryId) ?? new Map();
      for (const segment of task.segments) {
        if (bySegment.has(segment.id))
          throw new Error(
            `plan-duplicate-segment:${task.entryId}:${segment.id}`
          );
        bySegment.set(segment.id, outputByTask.get(taskIndex).get(segment.id));
      }
      translatedSegments.set(task.entryId, bySegment);
    }
  }
  const translations = manifest.entries.map((entry) => ({
    schemaVersion: SDABC_TRANSLATION_RESULT_SCHEMA,
    id: entry.id,
    layer: entry.layer,
    passage: entry.passage,
    sourceSha256: entry.sourceSha256,
    sourceContentHash: entry.sourceContentHash,
    inputHash: entry.inputHash,
    translation: assembleTranslation(
      entry,
      translatedSegments.get(entry.id) ?? new Map()
    )
  }));
  return canonicalizeDuplicateSourceTranslations(translations);
};

export const canonicalizeDuplicateSourceTranslations = (records) => {
  const canonicalBySource = new Map();
  for (const record of [...records].sort((left, right) =>
    left.id.localeCompare(right.id, "en", { numeric: true })
  )) {
    if (!canonicalBySource.has(record.sourceSha256)) {
      canonicalBySource.set(record.sourceSha256, record);
    }
  }
  return records.map((record) => {
    const canonical = canonicalBySource.get(record.sourceSha256);
    if (
      canonical.id === record.id ||
      canonical.translation.sha256 === record.translation.sha256
    ) {
      return record;
    }
    const translation = { ...canonical.translation };
    delete translation.externalSources;
    if (record.translation.externalSources?.length) {
      translation.externalSources = record.translation.externalSources;
    }
    return {
      ...record,
      origin: {
        kind: "identical-source-reuse",
        sourceId: canonical.id
      },
      translation
    };
  });
};
