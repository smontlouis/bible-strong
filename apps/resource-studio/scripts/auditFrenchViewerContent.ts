import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

import { containsEquivalentBibleReference } from "../src/lexiconV3/frenchValidation.js";

const DEFAULT_LEXICON =
  "data/dictionaries/strong_lexicon.en-fr.full.production.sqlite";
const DEFAULT_ENTITIES = "data/entities/bible_entities.sqlite";
const DEFAULT_OUTPUT = "outputs/lexicon-fr-quality/audit";
const POLICY_VERSION = "viewer-fr-quality-audit@1";

type Layer = "tipnr" | "lsj" | "core";
type Severity = "warning" | "blocking";

interface Issue {
  code: string;
  severity: Severity;
  field: string;
  details?: Record<string, unknown>;
}

interface AuditRecord {
  schemaVersion: "viewer-fr-quality-record@1";
  policyVersion: typeof POLICY_VERSION;
  layer: Layer;
  key: string;
  sourceId: number;
  stepCode: string | null;
  sourceHash: string;
  translationHash: string;
  issues: Issue[];
  protectedContent: {
    strongCodes: string[];
    references: string[];
    originalTokens: string[];
  };
  fields: Record<string, { source: string; translation: string }>;
  recordHash: string;
}

interface StepRow {
  id: number;
  stepCode: string;
  original: string;
  gloss: string;
  meaning: string;
  meaningHtml: string;
  glossFr: string;
  meaningFr: string;
  meaningHtmlFr: string;
}

interface ResourceRow {
  id: number;
  stepCode: string;
  contentHtml: string;
  contentHtmlFr: string;
  contentTextFr: string;
}

interface EntityRow {
  id: number;
  uniqueName: string;
  uStrong: string;
  displayName: string;
  description: string;
  summaryHtml: string;
  briefest: string;
  brief: string;
  shortDescription: string;
  articleHtml: string;
  displayNameFr: string;
  descriptionFr: string;
  summaryHtmlFr: string;
  briefestFr: string;
  briefFr: string;
  shortDescriptionFr: string;
  articleHtmlFr: string;
}

const ENGLISH_PROSE =
  /\b(?:according|also|among|and|another|because|being|called|chiefly|city|concerning|derived|especially|except|figuratively|from|hence|including|meaning|metaphorically|namely|outside|perhaps|possibly|probably|properly|refers|spelling|therefore|through|uncertain|usually|whereas|which|without|within)\b/giu;

const LSJ_EDITORIAL_RESIDUE =
  /(?:\[\s*(?:Refs?|prev\.?\s*work|near\s+the\s+(?:start|end)|same\s+place)|\bc\.(?:BC|AD)\b|\+\s*others\b|\bLyric\s+poetry\b)/giu;

// Terms that can legitimately occur in scholarly French notices and references.
const SCHOLARLY_WHITELIST = new Set([
  "attic",
  "b.c",
  "codex",
  "heb",
  "kjv",
  "lxx",
  "ms",
  "mss",
  "niv",
  "nt",
  "ot",
  "qere",
  "ketiv",
  "syr",
  "vulg"
]);

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const lexiconPath = resolve(args.lexicon ?? DEFAULT_LEXICON);
  const entitiesPath = resolve(args.entities ?? DEFAULT_ENTITIES);
  const outputDir = resolve(args.output ?? DEFAULT_OUTPUT);
  for (const path of [lexiconPath, entitiesPath]) {
    if (!existsSync(path)) throw new Error(`missing-source:${path}`);
  }
  mkdirSync(outputDir, { recursive: true });

  const lexicon = new DatabaseSync(lexiconPath, { readOnly: true });
  const entities = new DatabaseSync(entitiesPath, { readOnly: true });
  try {
    const termbase = buildTermbase(lexicon);
    const records = [
      ...auditEntities(entities, termbase),
      ...auditResources(lexicon),
      ...auditCore(lexicon)
    ].sort((a, b) =>
      `${a.layer}:${a.key}`.localeCompare(`${b.layer}:${b.key}`, "en")
    );
    const queue = records.filter((record) => record.issues.length > 0);
    const blocking = queue.filter((record) =>
      record.issues.some((issue) => issue.severity === "blocking")
    );
    const reasonCounts: Record<string, number> = {};
    const layerCounts: Record<Layer, { total: number; queued: number; blocking: number }> = {
      tipnr: { total: 0, queued: 0, blocking: 0 },
      lsj: { total: 0, queued: 0, blocking: 0 },
      core: { total: 0, queued: 0, blocking: 0 }
    };
    for (const record of records) {
      layerCounts[record.layer].total += 1;
      if (record.issues.length) layerCounts[record.layer].queued += 1;
      if (record.issues.some((issue) => issue.severity === "blocking")) {
        layerCounts[record.layer].blocking += 1;
      }
      for (const issue of record.issues) {
        reasonCounts[`${record.layer}:${issue.code}`] =
          (reasonCounts[`${record.layer}:${issue.code}`] ?? 0) + 1;
      }
    }

    const recordsPath = resolve(outputDir, "records.jsonl");
    const queuePath = resolve(outputDir, "revision-queue.jsonl");
    writeJsonl(recordsPath, records);
    writeJsonl(queuePath, queue);
    const summary = {
      schemaVersion: "viewer-fr-quality-summary@1",
      policyVersion: POLICY_VERSION,
      generatedAt: new Date().toISOString(),
      sources: {
        lexicon: { path: lexiconPath, sha256: sha256File(lexiconPath) },
        entities: { path: entitiesPath, sha256: sha256File(entitiesPath) }
      },
      counts: {
        records: records.length,
        queued: queue.length,
        blocking: blocking.length,
        byLayer: layerCounts,
        byReason: Object.fromEntries(
          Object.entries(reasonCounts).sort(([a], [b]) => a.localeCompare(b, "en"))
        )
      },
      artifacts: {
        records: { path: recordsPath, sha256: sha256(records.map(stableJson).join("\n") + "\n") },
        queue: { path: queuePath, sha256: sha256(queue.map(stableJson).join("\n") + "\n") }
      }
    };
    const summaryPath = resolve(outputDir, "summary.json");
    writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ ...summary, summaryPath }, null, 2)}\n`);
  } finally {
    lexicon.close();
    entities.close();
  }
}

function buildTermbase(db: DatabaseSync): Map<string, string> {
  const rows = db
    .prepare(`
      SELECT i.stepCode, trim(t.gloss) AS glossFr
      FROM StepEntryIdentities i
      JOIN LexiconTranslations t ON t.stepEntryId=i.stepEntryId AND t.language='fr'
      WHERE trim(t.gloss) <> ''
    `)
    .all() as unknown as Array<{ stepCode: string; glossFr: string }>;
  return new Map(rows.map((row) => [normalizeStrong(row.stepCode), row.glossFr]));
}

function auditCore(db: DatabaseSync): AuditRecord[] {
  const rows = db
    .prepare(`
      SELECT s.id, i.stepCode, s.original, s.gloss, s.meaning,
             s.meaning AS meaningHtml,
             t.gloss AS glossFr, t.meaning AS meaningFr, t.meaningHtml AS meaningHtmlFr
      FROM StepEntries s
      JOIN StepEntryIdentities i ON i.stepEntryId=s.id
      LEFT JOIN LexiconTranslations t ON t.stepEntryId=s.id AND t.language='fr'
      ORDER BY s.id
    `)
    .all() as unknown as StepRow[];
  return rows.map((row) => {
    const fields = {
      gloss: pair(row.gloss, row.glossFr ?? ""),
      meaning: pair(row.meaning, row.meaningFr ?? ""),
      meaningHtml: pair(row.meaningHtml, row.meaningHtmlFr ?? "")
    };
    return finishRecord("core", row.stepCode, row.id, row.stepCode, fields, row.original);
  });
}

function auditResources(db: DatabaseSync): AuditRecord[] {
  const rows = db
    .prepare(`
      SELECT r.id, i.stepCode, r.contentHtml,
             coalesce(t.contentHtml, '') AS contentHtmlFr,
             coalesce(t.contentText, '') AS contentTextFr
      FROM LexiconResources r
      JOIN StepEntryIdentities i ON i.stepEntryId=r.stepEntryId
      LEFT JOIN LexiconResourceTranslations t ON t.resourceId=r.id AND t.language='fr'
      WHERE r.source='TFLSJ'
      ORDER BY r.id
    `)
    .all() as unknown as ResourceRow[];
  const records = rows.map((row) => {
    const fields = {
      contentHtml: pair(row.contentHtml, row.contentHtmlFr),
      contentText: pair(stripHtml(row.contentHtml), row.contentTextFr)
    };
    const record = finishRecord("lsj", row.stepCode, row.id, row.stepCode, fields);
    const tagMismatch = !sameArray(
      htmlTagSequence(row.contentHtml),
      htmlTagSequence(row.contentHtmlFr)
    );
    if (tagMismatch) {
      record.issues.push({
        code: "html-tag-sequence-mismatch",
        severity: "blocking",
        field: "contentHtml"
      });
    }
    const editorialResidues = [
      ...new Set(
        [...row.contentHtmlFr.matchAll(LSJ_EDITORIAL_RESIDUE)].map((match) => match[0])
      )
    ];
    if (editorialResidues.length) {
      record.issues.push({
        code: "english-editorial-residue",
        severity: "blocking",
        field: "contentHtml",
        details: { tokens: editorialResidues }
      });
    }
    if (/,,|<(?:b|i|em|strong)>\s*<\/(?:b|i|em|strong)>/iu.test(row.contentHtmlFr)) {
      record.issues.push({
        code: "typography-artifact",
        severity: "blocking",
        field: "contentHtml"
      });
    }
    record.issues = dedupeIssues(record.issues);
    record.recordHash = hashRecord(record);
    return record;
  });
  const bySource = new Map<string, AuditRecord[]>();
  for (const record of records) {
    const group = bySource.get(record.sourceHash) ?? [];
    group.push(record);
    bySource.set(record.sourceHash, group);
  }
  for (const group of bySource.values()) {
    if (new Set(group.map((record) => record.translationHash)).size <= 1) continue;
    for (const record of group) {
      record.issues.push({
        code: "inconsistent-duplicate-source",
        severity: "blocking",
        field: "contentHtml",
        details: { sourceHash: record.sourceHash, groupSize: group.length }
      });
      record.recordHash = hashRecord(record);
    }
  }
  return records;
}

function auditEntities(db: DatabaseSync, termbase: Map<string, string>): AuditRecord[] {
  const rows = db
    .prepare(`
      SELECT e.id, e.uniqueName, e.uStrong, e.displayName, e.description,
             e.summaryHtml, e.briefest, e.brief, e.shortDescription, e.articleHtml,
             coalesce(t.displayName, '') AS displayNameFr,
             coalesce(t.description, '') AS descriptionFr,
             coalesce(t.summaryHtml, '') AS summaryHtmlFr,
             coalesce(t.briefest, '') AS briefestFr,
             coalesce(t.brief, '') AS briefFr,
             coalesce(t.shortDescription, '') AS shortDescriptionFr,
             coalesce(t.articleHtml, '') AS articleHtmlFr
      FROM Entities e
      LEFT JOIN EntityTranslations t ON t.entityId=e.id AND t.language='fr'
      ORDER BY e.id
    `)
    .all() as unknown as EntityRow[];
  return rows.map((row) => {
    const fields = {
      displayName: pair(row.displayName, row.displayNameFr),
      description: pair(row.description, row.descriptionFr),
      summaryHtml: pair(row.summaryHtml, row.summaryHtmlFr),
      briefest: pair(row.briefest, row.briefestFr),
      brief: pair(row.brief, row.briefFr),
      shortDescription: pair(row.shortDescription, row.shortDescriptionFr),
      articleHtml: pair(row.articleHtml, row.articleHtmlFr)
    };
    const record = finishRecord(
      "tipnr",
      row.uniqueName,
      row.id,
      row.uStrong || null,
      fields
    );
    for (const [field, value] of Object.entries(fields)) {
      for (const link of linkedStrongLabels(value.translation)) {
        const canonical = termbase.get(normalizeStrong(link.code));
        if (!canonical || equivalentLabel(link.label, canonical)) continue;
        const englishMatches = linkedStrongLabels(value.source).some(
          (sourceLink) =>
            normalizeStrong(sourceLink.code) === normalizeStrong(link.code) &&
            equivalentLabel(sourceLink.label, link.label)
        );
        if (englishMatches || englishResidues(link.label).length > 0) {
          record.issues.push({
            code: "linked-strong-label-not-french",
            severity: "blocking",
            field,
            details: { code: link.code, current: link.label, canonical }
          });
        }
      }
    }
    record.recordHash = hashRecord(record);
    return record;
  });
}

function finishRecord(
  layer: Layer,
  key: string,
  sourceId: number,
  stepCode: string | null,
  fields: Record<string, { source: string; translation: string }>,
  original = ""
): AuditRecord {
  const source = Object.values(fields).map((value) => value.source).join("\n");
  const translation = Object.values(fields)
    .map((value) => value.translation)
    .join("\n");
  const issues: Issue[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const sourceText = stripHtml(value.source).trim();
    const translationText = stripHtml(value.translation).trim();
    if (!translationText && sourceText) {
      issues.push({ code: "missing-translation", severity: "blocking", field });
      continue;
    }
    const residues = englishResidues(translationText);
    if (residues.length) {
      issues.push({
        code: "english-residue",
        severity: "blocking",
        field,
        details: { tokens: residues }
      });
    }
    if (
      sourceText.length >= 45 &&
      normalizeText(sourceText) === normalizeText(translationText)
    ) {
      issues.push({ code: "untranslated-prose", severity: "blocking", field });
    }
    if (looksLikeHtml(value.source) || looksLikeHtml(value.translation)) {
      const sourceCodes = strongCodes(value.source);
      const translatedCodes = strongCodes(value.translation);
      const missingCodes = multisetDifference(sourceCodes, translatedCodes);
      if (missingCodes.length) {
        issues.push({
          code: "missing-strong-code",
          severity: "blocking",
          field,
          details: { missing: missingCodes }
        });
      }
      const balance = htmlBalance(value.translation);
      if (!balance.valid) {
        issues.push({
          code: "invalid-html-structure",
          severity: "blocking",
          field,
          details: { reason: balance.reason }
        });
      }
    }
    const missingOriginals = multisetDifference(
      originalTokens(value.source),
      originalTokens(value.translation)
    );
    if (missingOriginals.length) {
      issues.push({
        code: "missing-original-token",
        severity: "blocking",
        field,
        details: { missing: missingOriginals }
      });
    }
    const sourceRefs = references(stripHtml(value.source));
    const translatedRefs = references(stripHtml(value.translation));
    const translatedRefKeys = new Set(translatedRefs.map(referenceKey));
    const missingRefs = sourceRefs.filter((reference) => {
      const canonical = canonicalReference(reference);
      return (
        !containsEquivalentBibleReference(value.translation, canonical) &&
        !translatedRefKeys.has(referenceKey(reference))
      );
    });
    if (missingRefs.length) {
      issues.push({
        code: "missing-reference",
        severity: "blocking",
        field,
        details: { missing: missingRefs }
      });
    }
  }
  const base: Omit<AuditRecord, "recordHash"> = {
    schemaVersion: "viewer-fr-quality-record@1",
    policyVersion: POLICY_VERSION,
    layer,
    key,
    sourceId,
    stepCode,
    sourceHash: sha256(source),
    translationHash: sha256(translation),
    issues: dedupeIssues(issues),
    protectedContent: {
      strongCodes: strongCodes(source),
      references: references(source),
      originalTokens: original ? originalTokens(original) : originalTokens(source)
    },
    fields
  };
  return { ...base, recordHash: sha256(stableJson(base)) };
}

function linkedStrongLabels(html: string): Array<{ code: string; label: string }> {
  const links: Array<{ code: string; label: string }> = [];
  const pattern = /<strong\s*=\s*["']([GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?)["']\s*>([\s\S]*?)<\/strong>/giu;
  for (const match of html.matchAll(pattern)) {
    links.push({ code: match[1], label: stripHtml(match[2]).trim() });
  }
  return links;
}

function strongCodes(value: string): string[] {
  return [...value.matchAll(/(?<![\p{L}\p{N}])(?:[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?|[HG]\d{1,5}[A-Z]?)(?![\p{L}\p{N}])/giu)]
    .map((match) => normalizeStrong(match[0]))
    .sort();
}

function references(value: string): string[] {
  return [...value.matchAll(/\b(?:[1-4]\s*)?[A-Z][a-z]{1,8}\.?(?:\s*)\d{1,3}(?:[.:]\d{1,3})?(?:[-–]\d{1,3})?\b/g)]
    .map((match) => match[0].replace(/\s+/g, ""))
    .sort();
}

function canonicalReference(value: string): string {
  const match = value.replace(/\s+/gu, "").match(/^([1-4]?[A-Za-z]+)\.(\d+)[.:](\d+)/u);
  return match ? `${match[1]}.${match[2]}.${match[3]}` : value;
}

function referenceKey(value: string): string {
  const match = value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/\s+/gu, "")
    .match(/^([1-4]?[A-Za-z]+)\.?(\d+)[.:](\d+)/u);
  if (!match) return normalizeText(value);
  return `${canonicalBook(match[1])}.${match[2]}.${match[3]}`;
}

function canonicalBook(value: string): string {
  const normalized = value.toLowerCase();
  const aliases: Record<string, string> = {
    genesis: "gen", gn: "gen", exod: "exo", exode: "exo",
    lev: "lev", levitique: "lev", num: "num", nombres: "num",
    deut: "deut", dt: "deut", deuteronome: "deut", josh: "josh", jos: "josh",
    judg: "judg", jug: "judg", ruth: "ruth", rut: "ruth",
    matt: "matt", mat: "matt", mt: "matt", matthieu: "matt",
    mark: "mark", mrk: "mark", mk: "mark", mc: "mark", marc: "mark",
    luke: "luk", luc: "luk", lc: "luk", lk: "luk",
    john: "jhn", jean: "jhn", jn: "jhn", jo: "jhn",
    acts: "act", actes: "act", ac: "act", romans: "rom", rm: "rom",
    heb: "heb", hebreux: "heb", he: "heb", james: "jas", jac: "jas", jc: "jas",
    rev: "rev", apocalypse: "rev", apo: "rev", ap: "rev",
    psalm: "ps", psaume: "ps", psaumes: "ps", psa: "ps",
    prov: "prov", proverbes: "prov", pro: "prov", isa: "isa", esaie: "isa", es: "isa",
    jer: "jer", jeremie: "jer", ezek: "ezek", ezk: "ezek", ezechiel: "ezek", eze: "ezek"
  };
  const numbered = normalized.match(/^([1-4])(.+)$/u);
  if (numbered) return `${numbered[1]}${aliases[numbered[2]] ?? numbered[2]}`;
  return aliases[normalized] ?? normalized;
}

function originalTokens(value: string): string[] {
  return [...value.matchAll(/[\p{Script=Hebrew}\p{Script=Greek}][\p{Script=Hebrew}\p{Script=Greek}\p{M}·'’.-]*/gu)]
    .map((match) => match[0])
    .sort();
}

function englishResidues(value: string): string[] {
  const tokens = [...value.matchAll(ENGLISH_PROSE)]
    .map((match) => match[0].toLowerCase())
    .filter((token) => !SCHOLARLY_WHITELIST.has(token));
  return [...new Set(tokens)].sort();
}

function htmlBalance(value: string): { valid: boolean; reason?: string } {
  const stack: string[] = [];
  const voidTags = new Set(["br", "hr", "img", "input", "lb"]);
  const normalized = value
    .replace(/<(ref|strong)=/giu, "<$1 data-value=")
    .replace(/<\/?[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?>/gu, "");
  for (const match of normalized.matchAll(/<\s*(\/)?\s*([a-z][\w-]*)(?:\s[^<>]*)?>/giu)) {
    const closing = Boolean(match[1]);
    const tag = match[2].toLowerCase();
    if (voidTags.has(tag) || /\/\s*>$/u.test(match[0])) continue;
    if (!closing) stack.push(tag);
    else if (stack.pop() !== tag) return { valid: false, reason: `unexpected-closing:${tag}` };
  }
  return stack.length ? { valid: false, reason: `unclosed:${stack.join(",")}` } : { valid: true };
}

function htmlTagSequence(value: string): string[] {
  const normalized = value
    .replace(/<(ref|strong)=/giu, "<$1 data-value=")
    .replace(/<\/?[GH]\d{3,5}[A-Z]?(?:-[A-Za-z]+)?>/gu, "");
  return [...normalized.matchAll(/<\s*(\/)?\s*([a-z][\w-]*)[^<>]*>/giu)].map(
    (match) => `${match[1] ? "/" : ""}${match[2].toLowerCase()}`
  );
}

function sameArray(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function dedupeIssues(issues: Issue[]): Issue[] {
  const seen = new Set<string>();
  return issues.filter((issue) => {
    const key = stableJson(issue);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hashRecord(record: AuditRecord): string {
  const content = { ...record } as Partial<AuditRecord>;
  delete content.recordHash;
  return sha256(stableJson(content));
}

function multisetDifference(required: string[], actual: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of actual) counts.set(value, (counts.get(value) ?? 0) + 1);
  const missing: string[] = [];
  for (const value of required) {
    const remaining = counts.get(value) ?? 0;
    if (!remaining) missing.push(value);
    else counts.set(value, remaining - 1);
  }
  return missing;
}

function equivalentLabel(a: string, b: string): boolean {
  return normalizeText(a) === normalizeText(b);
}

function normalizeStrong(value: string): string {
  const normalized = value.trim().toUpperCase();
  const match = normalized.match(/^([GH])(\d{1,5})([A-Z]?)(.*)$/u);
  return match ? `${match[1]}${match[2].padStart(4, "0")}${match[3]}${match[4]}` : normalized;
}

function normalizeText(value: string): string {
  return stripHtml(value)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLocaleLowerCase("fr")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]*>/gu, " ")
    .replace(/&nbsp;|&#160;/giu, " ")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'")
    .replace(/\s+/g, " ")
    .trim();
}

function looksLikeHtml(value: string): boolean {
  return /<\/?[a-z][^>]*>/iu.test(value);
}

function pair(source: string | null, translation: string | null): { source: string; translation: string } {
  return { source: source ?? "", translation: translation ?? "" };
}

function stableJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableJson(object[key])}`)
    .join(",")}}`;
}

function writeJsonl(path: string, values: unknown[]): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, values.map(stableJson).join("\n") + (values.length ? "\n" : ""), "utf8");
}

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function sha256File(path: string): string {
  return sha256(readFileSync(path));
}

function parseArgs(values: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const [rawKey, inline] = value.slice(2).split("=", 2);
    result[rawKey] = inline ?? values[++index] ?? "";
  }
  return result;
}

main();
