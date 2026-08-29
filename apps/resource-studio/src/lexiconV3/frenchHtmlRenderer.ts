import { createHash } from "node:crypto";

import { stripLexiconHtml } from "./frenchValidation.js";

export const FRENCH_HTML_TEMPLATE_SCHEMA_VERSION =
  "lexicon-v3-french-html-template@2" as const;
export const FRENCH_HTML_RENDERER_VERSION =
  "lexicon-v3-french-html-renderer@3" as const;

const SAFE_TAGS = new Set([
  "b",
  "br",
  "def",
  "em",
  "greek",
  "i",
  "lb",
  "note",
  "p",
  "ref",
  "span",
  "strong",
  "sup",
  "u"
]);
const VOID_TAGS = new Set(["br", "lb"]);
const LEGACY_STEP_TAG_MAP = new Map<string, string>([
  ["a", "span"],
  ["author", "span"],
  ["corr", "span"],
  ["date", "span"],
  ["level1", "span"],
  ["level2", "span"],
  ["level3", "span"],
  ["level4", "span"],
  ["re", "span"]
]);

export interface FrenchHtmlTextToken {
  kind: "text";
  id: string;
  sourceText: string;
  prefixWhitespace: string;
  suffixWhitespace: string;
  translatable: boolean;
}

export interface FrenchHtmlTagToken {
  kind: "tag";
  value: string;
}

export type FrenchHtmlTemplateToken = FrenchHtmlTextToken | FrenchHtmlTagToken;

export interface FrenchHtmlTemplate {
  schemaVersion: typeof FRENCH_HTML_TEMPLATE_SCHEMA_VERSION;
  rendererVersion: typeof FRENCH_HTML_RENDERER_VERSION;
  sourceHtmlHash: string;
  templateHash: string;
  tokens: FrenchHtmlTemplateToken[];
  sourceNormalizations: FrenchHtmlSourceNormalization[];
}

export interface FrenchHtmlSourceNormalization {
  tokenIndex: number;
  sourceToken: string;
  renderedToken: string | null;
  reasons: string[];
}

export interface FrenchHtmlSegmentTranslation {
  id: string;
  text: string;
}

export interface FrenchHtmlRenderResult {
  meaningFr: string;
  meaningHtmlFr: string;
  renderedSegmentIds: string[];
}

/**
 * Converts trusted source HTML into a content-addressed token template. Agents
 * see and translate text slots only; tags are parsed and owned by this module.
 */
export function buildFrenchHtmlTemplate(
  sourceHtml: string
): FrenchHtmlTemplate {
  const rawTokens = sourceHtml.split(/(<[^>]*>)/gu).filter(Boolean);
  const tokens: FrenchHtmlTemplateToken[] = [];
  const sourceNormalizations: FrenchHtmlSourceNormalization[] = [];
  const openTags: Array<{ sourceTag: string; outputTag: string }> = [];
  let textIndex = 0;

  for (const [tokenIndex, raw] of rawTokens.entries()) {
    if (!raw.startsWith("<")) {
      const prefixWhitespace = raw.match(/^\s*/u)?.[0] ?? "";
      const suffixWhitespace = raw.match(/\s*$/u)?.[0] ?? "";
      const end = Math.max(
        prefixWhitespace.length,
        raw.length - suffixWhitespace.length
      );
      const sourceText = decodeLexiconEntities(
        raw.slice(prefixWhitespace.length, end)
      );
      tokens.push({
        kind: "text",
        id: `t${textIndex}`,
        sourceText,
        prefixWhitespace,
        suffixWhitespace,
        translatable: /[\p{L}\p{N}]/u.test(sourceText)
      });
      textIndex += 1;
      continue;
    }

    const parsed = parseSourceTag(raw);
    if (!parsed) throw new Error(`unsafe-source-html-token:${raw}`);
    const { closing, selfClosing } = parsed;
    const sourceTag = parsed.tag;
    const tag = LEGACY_STEP_TAG_MAP.get(sourceTag) ?? sourceTag;
    if (!SAFE_TAGS.has(tag)) throw new Error(`unsafe-source-html-tag:${tag}`);
    if (
      closing &&
      sourceTag === "ref" &&
      !openTags.some((openTag) => openTag.sourceTag === sourceTag)
    ) {
      sourceNormalizations.push({
        tokenIndex,
        sourceToken: raw,
        renderedToken: null,
        reasons: ["drop-unmatched-step-ref-close"]
      });
      continue;
    }
    if (VOID_TAGS.has(tag)) {
      if (closing) throw new Error(`invalid-source-void-close:${tag}`);
      tokens.push({ kind: "tag", value: `<${tag}>` });
      continue;
    }
    if (selfClosing) throw new Error(`invalid-source-self-closing-tag:${tag}`);
    if (closing) {
      if (openTags.at(-1)?.sourceTag !== sourceTag) {
        throw new Error(`invalid-source-html-nesting:${sourceTag}`);
      }
      openTags.pop();
      tokens.push({ kind: "tag", value: `</${tag}>` });
    } else {
      openTags.push({ sourceTag, outputTag: tag });
      tokens.push({ kind: "tag", value: `<${tag}>` });
    }
    const normalizationReasons = [
      ...(sourceTag !== tag ? ["map-step-legacy-tag"] : []),
      ...(parsed.attributesStripped ? ["strip-step-source-attributes"] : [])
    ];
    if (normalizationReasons.length > 0) {
      sourceNormalizations.push({
        tokenIndex,
        sourceToken: raw,
        renderedToken: closing ? `</${tag}>` : `<${tag}>`,
        reasons: normalizationReasons
      });
    }
  }
  if (openTags.length > 0) {
    throw new Error(
      `unclosed-source-html-tags:${openTags.map((tag) => tag.sourceTag).join(",")}`
    );
  }

  const content = {
    schemaVersion: FRENCH_HTML_TEMPLATE_SCHEMA_VERSION,
    rendererVersion: FRENCH_HTML_RENDERER_VERSION,
    sourceHtmlHash: sha256(sourceHtml),
    tokens,
    sourceNormalizations
  };
  return { ...content, templateHash: hashCanonical(content) };
}

/** Canonical tag sequence emitted by the trusted local renderer. */
export function frenchSourceHtmlSkeleton(sourceHtml: string): string[] {
  return buildFrenchHtmlTemplate(sourceHtml).tokens.flatMap((token) =>
    token.kind === "tag" ? [token.value] : []
  );
}

/**
 * Reads the HTML emitted by the local renderer without applying source-side
 * repairs. Legacy STEP elements are accepted only on the trusted English
 * source path above; a French artifact must already contain the canonical
 * safe tags (not `<re>`, `<Level*>`, `<date>`, `<author>`, or attributed
 * elements). This makes the skeleton comparison directional and fail-closed.
 */
export function frenchRenderedHtmlSkeleton(renderedHtml: string): string[] {
  const tokens = [...renderedHtml.matchAll(/<[^>]*>/gu)];
  const skeleton: string[] = [];
  const openTags: string[] = [];
  for (const match of tokens) {
    const raw = match[0];
    const parsed = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)\s*(\/?)\s*>$/iu.exec(raw);
    if (!parsed) throw new Error(`unsafe-rendered-html-token:${raw}`);
    const closing = parsed[1] === "/";
    const tag = (parsed[2] ?? "").toLowerCase();
    const selfClosing = parsed[3] === "/";
    if (!SAFE_TAGS.has(tag)) {
      throw new Error(`unsafe-rendered-html-tag:${tag}`);
    }
    if (VOID_TAGS.has(tag)) {
      if (closing) throw new Error(`invalid-rendered-void-close:${tag}`);
      skeleton.push(`<${tag}>`);
      continue;
    }
    if (selfClosing) {
      throw new Error(`invalid-rendered-self-closing-tag:${tag}`);
    }
    if (closing) {
      if (openTags.at(-1) !== tag) {
        throw new Error(`invalid-rendered-html-nesting:${tag}`);
      }
      openTags.pop();
      skeleton.push(`</${tag}>`);
      continue;
    }
    openTags.push(tag);
    skeleton.push(`<${tag}>`);
  }
  const outsideTags = renderedHtml.replace(/<[^>]*>/gu, "");
  if (/[<>]/u.test(outsideTags)) {
    throw new Error("unsafe-rendered-html-syntax");
  }
  if (openTags.length > 0) {
    throw new Error(`unclosed-rendered-html-tags:${openTags.join(",")}`);
  }
  return skeleton;
}

export function verifyFrenchHtmlTemplate(
  template: FrenchHtmlTemplate,
  sourceHtml?: string
): string[] {
  const issues: string[] = [];
  if (template.schemaVersion !== FRENCH_HTML_TEMPLATE_SCHEMA_VERSION) {
    issues.push("invalid-html-template-schema");
  }
  if (template.rendererVersion !== FRENCH_HTML_RENDERER_VERSION) {
    issues.push("invalid-html-renderer-version");
  }
  if (
    sourceHtml !== undefined &&
    template.sourceHtmlHash !== sha256(sourceHtml)
  ) {
    issues.push("html-template-source-drift");
  }
  const { templateHash: _templateHash, ...content } = template;
  void _templateHash;
  if (template.templateHash !== hashCanonical(content)) {
    issues.push("html-template-hash-mismatch");
  }
  const textIds = template.tokens
    .filter((token): token is FrenchHtmlTextToken => token.kind === "text")
    .map((token) => token.id);
  if (new Set(textIds).size !== textIds.length) {
    issues.push("duplicate-html-text-segment-id");
  }
  return [...new Set(issues)].sort();
}

/** Reconstructs HTML locally and derives the plain meaning from that result. */
export function renderFrenchHtmlTemplate(
  template: FrenchHtmlTemplate,
  translations: FrenchHtmlSegmentTranslation[]
): FrenchHtmlRenderResult {
  const templateIssues = verifyFrenchHtmlTemplate(template);
  if (templateIssues.length > 0) {
    throw new Error(`invalid-french-html-template:${templateIssues.join(",")}`);
  }
  const byId = new Map<string, string>();
  for (const translation of translations) {
    if (byId.has(translation.id)) {
      throw new Error(`duplicate-french-html-segment:${translation.id}`);
    }
    byId.set(translation.id, translation.text);
  }
  const expectedIds = new Set(
    template.tokens
      .filter(
        (token): token is FrenchHtmlTextToken =>
          token.kind === "text" && token.translatable
      )
      .map((token) => token.id)
  );
  for (const id of byId.keys()) {
    if (!expectedIds.has(id))
      throw new Error(`unknown-french-html-segment:${id}`);
  }
  for (const id of expectedIds) {
    if (!byId.has(id)) throw new Error(`missing-french-html-segment:${id}`);
  }

  const renderedSegmentIds: string[] = [];
  const meaningHtmlFr = template.tokens
    .map((token) => {
      if (token.kind === "tag") return token.value;
      if (!token.translatable) {
        return `${token.prefixWhitespace}${escapeHtml(token.sourceText)}${token.suffixWhitespace}`;
      }
      const translated = (byId.get(token.id) ?? "").trim();
      if (!translated) throw new Error(`empty-french-html-segment:${token.id}`);
      renderedSegmentIds.push(token.id);
      return `${token.prefixWhitespace}${escapeHtml(translated)}${token.suffixWhitespace}`;
    })
    .join("");

  return {
    meaningFr: stripLexiconHtml(meaningHtmlFr),
    meaningHtmlFr,
    renderedSegmentIds
  };
}

function decodeLexiconEntities(value: string): string {
  return value
    .replace(/&nbsp;/giu, "\u00a0")
    .replace(/&amp;/giu, "&")
    .replace(/&lt;/giu, "<")
    .replace(/&gt;/giu, ">")
    .replace(/&quot;/giu, '"')
    .replace(/&#39;|&apos;/giu, "'");
}

interface ParsedSourceTag {
  closing: boolean;
  selfClosing: boolean;
  tag: string;
  attributesStripped: boolean;
}

/**
 * STEP contains a small, closed set of presentational legacy elements. Their
 * text is useful, but their attributes and custom element names are not part
 * of the public HTML contract. We therefore map them deterministically to a
 * safe span and discard attributes before any agent sees the template.
 */
function parseSourceTag(raw: string): ParsedSourceTag | null {
  const match = /^<\s*(\/?)\s*([a-z][a-z0-9-]*)([\s\S]*?)>$/iu.exec(raw);
  if (!match) return null;
  const closing = match[1] === "/";
  const tag = (match[2] ?? "").toLowerCase();
  let remainder = match[3] ?? "";
  const selfClosing = !closing && /\/\s*$/u.test(remainder);
  if (selfClosing) remainder = remainder.replace(/\/\s*$/u, "");
  const attributes = remainder.trim();

  if (closing && (selfClosing || attributes)) return null;
  if (attributes) {
    const attributesAllowed =
      tag === "a"
        ? /^\s+/u.test(remainder)
        : tag === "ref" && /^(?:\s+|=)/u.test(remainder);
    if (!attributesAllowed) return null;
  }
  if (attributes && !LEGACY_STEP_TAG_MAP.has(tag) && tag !== "ref") {
    return null;
  }
  return { closing, selfClosing, tag, attributesStripped: Boolean(attributes) };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/gu, "&amp;")
    .replace(/</gu, "&lt;")
    .replace(/>/gu, "&gt;")
    .replace(/"/gu, "&quot;");
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function hashCanonical(value: unknown): string {
  return sha256(canonicalJson(value));
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const object = value as Record<string, unknown>;
  return `{${Object.keys(object)
    .filter((key) => object[key] !== undefined)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`)
    .join(",")}}`;
}
