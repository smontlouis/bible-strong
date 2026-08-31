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
