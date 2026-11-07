// Plain text for the library search index (ADR-0103): published resources are HTML with
// entities; the index stores and embeds readable text, cut into passages of a few hundred
// tokens so that a hit points to the paragraph that answers, not to a whole chapter.

const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  laquo: '«',
  raquo: '»',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  shy: '',
  thinsp: ' ',
  eacute: 'é',
  egrave: 'è',
  ecirc: 'ê',
  euml: 'ë',
  agrave: 'à',
  acirc: 'â',
  auml: 'ä',
  icirc: 'î',
  iuml: 'ï',
  ocirc: 'ô',
  ouml: 'ö',
  ugrave: 'ù',
  ucirc: 'û',
  uuml: 'ü',
  ccedil: 'ç',
  oelig: 'œ',
  aelig: 'æ',
  Eacute: 'É',
  Egrave: 'È',
  Ecirc: 'Ê',
  Agrave: 'À',
  Acirc: 'Â',
  Icirc: 'Î',
  Ocirc: 'Ô',
  Ucirc: 'Û',
  Ccedil: 'Ç',
  OElig: 'Œ',
}

const codePoint = (value: number) =>
  Number.isInteger(value) && value > 0 && value <= 0x10ffff ? String.fromCodePoint(value) : ''

/** Decodes numeric and common named entities in a single pass. */
export const decodeHtmlEntities = (value: string) =>
  value.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/giu, (whole, name: string) => {
    if (name[0] === '#')
      return codePoint(
        name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      )
    return NAMED_ENTITIES[name] ?? whole
  })

const BLOCK_TAGS = /<\/?(?:p|div|br|h[1-6]|li|ul|ol|blockquote|tr|table|section|article)\b[^>]*>/giu

/** Readable text: block tags become line breaks, other tags disappear, spaces are folded. */
export const htmlToPlainText = (html: string) =>
  decodeHtmlEntities(
    html
      .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/giu, ' ')
      .replace(BLOCK_TAGS, '\n')
      .replace(/<[^>]*>/gu, '')
  )
    .replace(/ /gu, ' ')
    .replace(/[ \t\f\v]+/gu, ' ')
    .replace(/ *\n */gu, '\n')
    .replace(/\n{3,}/gu, '\n\n')
    .trim()

/** About 400 tokens: long enough to carry an argument, short enough to point to it. */
export const LIBRARY_PASSAGE_MAX_CHARACTERS = 1_800
/** A shorter last piece joins the previous one rather than standing alone. */
const LIBRARY_PASSAGE_MIN_CHARACTERS = 400

const sentences = (paragraph: string) =>
  paragraph
    .match(/[^.!?;:]+(?:[.!?;:]+["»”’)\]]*|$)\s*/gu)
    ?.map(part => part.trim())
    .filter(Boolean) ?? [paragraph]

/**
 * Cuts text into passages at paragraph boundaries, then at sentence boundaries, and as a
 * last resort at a space. Every passage is at most LIBRARY_PASSAGE_MAX_CHARACTERS long.
 */
export const splitIntoPassages = (text: string, maxCharacters = LIBRARY_PASSAGE_MAX_CHARACTERS) => {
  const pieces: string[] = []
  for (const paragraph of text
    .split(/\n+/u)
    .map(part => part.trim())
    .filter(Boolean)) {
    if (paragraph.length <= maxCharacters) {
      pieces.push(paragraph)
      continue
    }
    for (const sentence of sentences(paragraph)) {
      if (sentence.length <= maxCharacters) {
        pieces.push(sentence)
        continue
      }
      for (let start = 0; start < sentence.length; ) {
        let end = Math.min(sentence.length, start + maxCharacters)
        if (end < sentence.length) {
          const space = sentence.lastIndexOf(' ', end)
          if (space > start + maxCharacters / 2) end = space
        }
        pieces.push(sentence.slice(start, end).trim())
        start = end
      }
    }
  }
  const passages: string[] = []
  let current = ''
  for (const piece of pieces) {
    if (!current) current = piece
    else if (current.length + 1 + piece.length <= maxCharacters) current += `\n${piece}`
    else {
      passages.push(current)
      current = piece
    }
  }
  if (current) {
    const previous = passages.at(-1)
    if (
      previous !== undefined &&
      current.length < LIBRARY_PASSAGE_MIN_CHARACTERS &&
      previous.length + 1 + current.length <= maxCharacters
    )
      passages[passages.length - 1] = `${previous}\n${current}`
    else passages.push(current)
  }
  return passages
}
