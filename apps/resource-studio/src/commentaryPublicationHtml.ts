type CommentaryBibleReference = {
  id: string;
  kind: "bible";
  osis: string;
};

type CommentaryHtmlContent = {
  html: string;
  references?: CommentaryBibleReference[];
};

const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/gu;

const readAttribute = (tag: string, name: string): string => {
  const match = new RegExp(
    `\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`,
    "iu"
  ).exec(tag);
  return match ? (match[1] ?? match[2] ?? match[3] ?? "") : "";
};

const escapeAttribute = (value: string): string =>
  value.replace(/&/gu, "&amp;").replace(/"/gu, "&quot;");

const REMOVED_BLOCK_TAGS = [
  "applet",
  "embed",
  "figure",
  "iframe",
  "object",
  "script",
  "style"
] as const;

const REMOVED_VOID_TAGS = ["img", "image"] as const;

const residualPublicationMarkup = new RegExp(
  `<\\/?(?:${[...REMOVED_BLOCK_TAGS, ...REMOVED_VOID_TAGS, "title"].join("|")})(?:\\s|>)`,
  "iu"
);

/**
 * Removes source-document furniture that cannot be rendered from an autonomous
 * commentary bundle. Textual commentary and normalized Bible links are kept.
 */
export const sanitizeCommentaryPublicationHtml = (html: string): string => {
  let sanitized = html;

  for (const tag of REMOVED_BLOCK_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, "giu"),
      " "
    );
    sanitized = sanitized.replace(
      new RegExp(`<${tag}\\b[^>]*\\/?\\s*>`, "giu"),
      " "
    );
  }

  for (const tag of REMOVED_VOID_TAGS) {
    sanitized = sanitized.replace(
      new RegExp(`<${tag}\\b[^>]*\\/?\\s*>`, "giu"),
      " "
    );
    sanitized = sanitized.replace(new RegExp(`<\\/${tag}\\s*>`, "giu"), " ");
  }

  // CrossWire title elements are metadata containers. Some source modules
  // leave them unclosed inside an already-normalized heading, so unwrap them
  // instead of trying to repair their document-level semantics.
  sanitized = sanitized.replace(/<\/?title\b[^>]*>/giu, "");
  sanitized = sanitized.replace(/<lb\b[^>]*\/?>/giu, "<br>");
  sanitized = sanitized.replace(/[ \t]{2,}/gu, " ").trim();

  if (residualPublicationMarkup.test(sanitized)) {
    throw new Error("commentary-publication-unsafe-markup");
  }

  return sanitized;
};

export const materializeCommentaryBibleLinks = ({
  html,
  references = []
}: CommentaryHtmlContent): string => {
  if (!html || !html.includes("data-reference-id")) return html;

  const referencesById = new Map(
    references.map((reference) => [reference.id, reference])
  );
  const spanStack: Array<"span" | "a"> = [];
  let cursor = 0;
  let result = "";

  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const token = match[0];
    const index = match.index ?? 0;
    result += html.slice(cursor, index);
    cursor = index + token.length;

    if (/^<span(?:\s|>)/iu.test(token) && !/\/\s*>$/u.test(token)) {
      const className = readAttribute(token, "class");
      const referenceId = readAttribute(token, "data-reference-id");
      if (/(?:^|\s)bible-ref(?:\s|$)/u.test(className) && referenceId) {
        const reference = referencesById.get(referenceId);
        if (!reference || reference.kind !== "bible" || !reference.osis) {
          throw new Error(`commentary-reference-unresolved:${referenceId}`);
        }
        const osis = escapeAttribute(reference.osis);
        result += `<a class="bible-ref" href="bible://${osis}" data-osis="${osis}">`;
        spanStack.push("a");
        continue;
      }
      spanStack.push("span");
    } else if (/^<\/span\s*>/iu.test(token)) {
      const replacement = spanStack.pop();
      if (replacement === "a") {
        result += "</a>";
        continue;
      }
    }

    result += token;
  }

  result += html.slice(cursor);
  if (/\bdata-reference-id=/u.test(result)) {
    throw new Error("commentary-reference-unresolved");
  }
  return result;
};
