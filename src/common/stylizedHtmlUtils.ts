const STRONG_REF_PATTERN = /\b([HG])(\d{4}[A-Z]|\d+)\b/g
const HTML_TOKEN_PATTERN = /<!--[\s\S]*?-->|<[^>]*>/g
const WIDTH_SENSITIVE_CONTENT_PATTERN = /<(?:iframe|img|svg|table|video)(?:\s|>)/i

const STRONG_BOOK_ATTRIBUTE = 'data-strong-book'
const STRONG_NUMBER_ATTRIBUTE = 'data-strong-number'
export const LINK_TEXT_ATTRIBUTE = 'data-native-link-text'

export const hasWidthSensitiveHtmlContent = (html: string) =>
  WIDTH_SENSITIVE_CONTENT_PATTERN.test(html)

export const getLegacyLinkPressArguments = (
  href: string,
  attributes: Record<string, string>
): [string, string | number, string?] => {
  const strongBook = attributes[STRONG_BOOK_ATTRIBUTE]
  if (strongBook) {
    return [attributes[STRONG_NUMBER_ATTRIBUTE] ?? href, Number(strongBook)]
  }

  return [href, attributes[LINK_TEXT_ATTRIBUTE] ?? href, attributes.class ?? '']
}

/**
 * Native HTML only treats anchors as links. Strong definitions also contain
 * bare references such as H7225, so turn those text fragments into anchors
 * while leaving tags, attributes and existing anchors untouched.
 */
export const linkifyStrongReferences = (html: string) => {
  let anchorDepth = 0
  let cursor = 0
  let result = ''

  const linkifyText = (text: string) =>
    anchorDepth > 0
      ? text
      : text.replace(
          STRONG_REF_PATTERN,
          (_match, prefix: 'H' | 'G', reference: string) =>
            `<a href="strong://${prefix}${reference}" ${STRONG_NUMBER_ATTRIBUTE}="${reference}" ${STRONG_BOOK_ATTRIBUTE}="${
              prefix === 'H' ? 1 : 40
            }">${prefix}${reference}</a>`
        )

  for (const match of html.matchAll(HTML_TOKEN_PATTERN)) {
    const index = match.index ?? 0
    result += linkifyText(html.slice(cursor, index))

    const token = match[0]
    if (/^<a(?:\s|>)/i.test(token) && !/\/\s*>$/.test(token)) {
      anchorDepth += 1
    } else if (/^<\/a\s*>/i.test(token)) {
      anchorDepth = Math.max(0, anchorDepth - 1)
    }

    result += token
    cursor = index + token.length
  }

  return result + linkifyText(html.slice(cursor))
}
