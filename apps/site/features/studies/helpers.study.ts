import { QuillDeltaToHtmlConverter } from 'quill-delta-to-html'
import { firestore } from '../../lib/firebase'
import { escapeHtml, sanitizeEditorialHtml } from '../resources/editorialHtml'
import {
  getStudyEntityInlineAttributes,
  getStudyEntityInlineClasses,
  renderStudyEntityBlock,
} from './study-entities'

// A study is written by its author, through the application or straight into the database:
// nothing it holds is trusted. Every value it gives the page is escaped, and the only markup
// kept is the lexicon definition the site reads itself, rebuilt by the editorial sanitizer.

/** What the database holds of a study, as far as its page reads it. */
interface FirebaseStudy {
  title?: unknown
  modified_at?: unknown
  published?: boolean
  content?: { ops?: unknown }
  user?: { displayName?: unknown }
}

export type OpsInlineType = 'inline-strong' | 'inline-verse'

export interface OpsInlineStrong {
  type: 'inline-strong'
  Mot: string
  /** Sanitized lexicon markup. */
  Definition: string
  Code: string
}

export interface OpsInlineVerse {
  id: string
  type: 'inline-verse'
  title: string
  verses: { id: string; content: string }[]
}

export type OpsInline = OpsInlineStrong | OpsInlineVerse

export type Annexe = OpsInline[]

/** What the page of a study is given: what it shows, and nothing else of the document. */
export interface StudyPageData {
  title: string
  modified_at: number
  user: { displayName: string }
  html: string
  annexe: Annexe
  imageUrl: string
}

type StoredRecord = Record<string, unknown>

const isRecord = (value: unknown): value is StoredRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/** A stored value as text: anything but a string or a number reads as nothing. */
const textOf = (value: unknown): string =>
  typeof value === 'string' || typeof value === 'number' ? String(value) : ''

// A verse is named by its book, chapter and verse numbers: `43-3-16`.
const VERSE_ID_PATTERN = /^\d{1,3}-\d{1,3}-\d{1,3}$/u

/**
 * The verses an inline or block verse names. The editor stores a list, older studies the
 * JSON of one; anything that is not a verse name is left out.
 */
export const readStudyVerseIds = (value: unknown): string[] => {
  let verses = value
  if (typeof value === 'string') {
    try {
      verses = JSON.parse(value)
    } catch {
      verses = value.split(',')
    }
  }
  return (Array.isArray(verses) ? verses : [])
    .map(textOf)
    .filter(id => VERSE_ID_PATTERN.test(id))
}

// The documents of the lexicon are named by their number.
const STRONG_DOCUMENT_PATTERN = /^[A-Za-z]?\d{1,5}[A-Za-z]?$/u

const strongDocumentId = (codeStrong: unknown): string | undefined => {
  const id = textOf(codeStrong).trim()
  return STRONG_DOCUMENT_PATTERN.test(id) ? id : undefined
}

// The players the editor embeds; a study frames no other page.
const VIDEO_SOURCE_PATTERN =
  /^https:\/\/(?:www\.youtube(?:-nocookie)?\.com\/embed\/|player\.vimeo\.com\/video\/)[\w-]+(?:[/?][^\s"'<>]*)?$/u

/**
 * The operations of a study as the converter may read them. The converter writes the text
 * and the address of a mention as they are: mentions, which the editor never makes, are
 * dropped, and so is a video that is not an embedded player or a formula that is not text.
 */
const convertibleOps = (ops: unknown): StoredRecord[] =>
  (Array.isArray(ops) ? ops : []).flatMap((op): StoredRecord[] => {
    if (!isRecord(op)) return []
    const { insert, attributes } = op
    if (isRecord(insert)) {
      if ('video' in insert && !VIDEO_SOURCE_PATTERN.test(textOf(insert.video))) return []
      if ('formula' in insert && typeof insert.formula !== 'string') return []
    }
    if (!isRecord(attributes)) return [op]
    const kept = { ...attributes }
    delete kept.mentions
    delete kept.mention
    return [{ ...op, attributes: kept }]
  })

/** The converter writes attribute values as it is given them: they are escaped here. */
const escapeAttributes = (attributes: Record<string, unknown>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(attributes).map(([name, value]) => [name, escapeHtml(textOf(value))])
  )

const readTagAttributes = (op: { attributes: StoredRecord }): Record<string, unknown> => {
  if (op.attributes['inline-entity']) return getStudyEntityInlineAttributes(op)
  const verse = op.attributes['inline-verse']
  if (isRecord(verse)) {
    return {
      title: verse.title,
      'data-title': verse.title,
      'data-verses': readStudyVerseIds(verse.verses).join(','),
    }
  }
  const strong = op.attributes['inline-strong']
  if (isRecord(strong)) {
    return {
      title: strong.title,
      'data-code': strong.codeStrong,
      'data-title': strong.title,
      'data-book': strong.book,
    }
  }
  return { title: '' }
}

const renderVerseBlock = (value: StoredRecord): string => `
      <div class="block-verse" data-verses="${escapeHtml(readStudyVerseIds(value.verses).join(','))}">
        <div class="block-verse__content">${escapeHtml(textOf(value.content))}</div>
        <div class="block-verse__aside">${escapeHtml(textOf(value.title))} ${escapeHtml(textOf(value.version))}</div>
      </div>`

// The definition is the one of the lexicon, which `getStudy` puts in place of the author's.
const renderStrongBlock = (value: StoredRecord): string => `
    <div class="block-strong" data-code="${escapeHtml(textOf(value.codeStrong))}" data-book="${escapeHtml(textOf(value.book))}">
    <div class="block-strong__container">
      <div class="block-strong__title">${escapeHtml(textOf(value.title))}</div>
      <div class="block-strong__phonetique">${escapeHtml(textOf(value.phonetique))}</div>
      <div class="block-strong__original">${escapeHtml(textOf(value.original))}</div>
    </div>
      <div class="block-strong__definition">
        ${sanitizeEditorialHtml(textOf(value.definition))}
      </div>
    </div>`

export const convertStudyOpsToHtml = (ops: unknown = []): string => {
  const converter = new QuillDeltaToHtmlConverter(convertibleOps(ops), {
    // Links open in a new tab, which is given no hold on the study.
    linkRel: 'noopener',
    customTag: format => {
      if (
        format === 'inline-verse' ||
        format === 'inline-strong' ||
        format === 'inline-entity'
      ) {
        return format === 'inline-entity' ? 'button' : 'a'
      }
    },
    //@ts-ignore quill-delta-to-html does not expose custom blot attribute types
    customTagAttributes: op => escapeAttributes(readTagAttributes(op)),
    customCssClasses: op => {
      if (op.attributes?.['inline-entity']) {
        return getStudyEntityInlineClasses(op)
      }
      if (op.attributes['inline-verse']) return ['inline-verse']
      if (op.attributes['inline-strong']) return ['inline-strong']
    },
  })

  converter.renderCustomWith(customOp => {
    const value = isRecord(customOp.insert.value) ? customOp.insert.value : {}

    if (customOp.insert.type === 'block-verse') return renderVerseBlock(value)

    if (customOp.insert.type === 'block-strong') return renderStrongBlock(value)

    if (customOp.insert.type === 'block-entity') {
      return renderStudyEntityBlock(customOp.insert.value)
    }

    if (customOp.insert.type === 'divider') return '<div class="divider"></div>'

    return `<div>${escapeHtml(textOf(customOp.insert.type))}</div>`
  })

  return converter.convert()
}

const readStrongDocument = async (
  book: unknown,
  codeStrong: unknown
): Promise<StoredRecord | undefined> => {
  const id = strongDocumentId(codeStrong)
  if (!id) return undefined
  const isGrec = Number(book) > 39
  const doc = await firestore
    .collection(isGrec ? 'grec' : 'hebreu')
    .doc(id)
    .get()
  const data = doc.exists ? doc.data() : undefined
  return isRecord(data) ? data : undefined
}

export const getStudy = async (id: string): Promise<StudyPageData | null> => {
  const snapshot = await firestore
    .collection('studies')
    .doc(id)
    .get()

  const result = snapshot.data() as unknown as FirebaseStudy | undefined

  if (!result?.published) {
    return null
  }

  const storedOps = result.content?.ops
  const ops: unknown[] = Array.isArray(storedOps) ? storedOps : []

  const annexe = (
    await Promise.all(
      ops.map(async (op): Promise<OpsInline | undefined> => {
        if (!isRecord(op)) return undefined
        const block = isRecord(op.insert) ? op.insert['block-strong'] : undefined
        if (isRecord(block)) {
          // The page shows the definition of the lexicon, never one the author wrote.
          const strong = await readStrongDocument(block.book, block.codeStrong)
          block.definition = strong?.Definition
        }
        const attributes = isRecord(op.attributes) ? op.attributes : {}

        const inlineVerse = attributes['inline-verse']
        if (isRecord(inlineVerse)) {
          const verseIds = readStudyVerseIds(inlineVerse.verses)

          const verses = await Promise.all(
            verseIds.map(async verseId => {
              const doc = await firestore
                .collection('bible-lsg-1910')
                .doc(verseId)
                .get()
              const data = doc.exists ? doc.data() : undefined
              return isRecord(data) ? { id: verseId, content: textOf(data.content) } : undefined
            })
          )

          return {
            type: 'inline-verse',
            id: verseIds.join(','),
            title: textOf(inlineVerse.title),
            verses: verses.filter(verse => verse !== undefined),
          }
        }

        const inlineStrong = attributes['inline-strong']
        if (isRecord(inlineStrong)) {
          const strong = await readStrongDocument(inlineStrong.book, inlineStrong.codeStrong)
          if (!strong) return undefined

          return {
            type: 'inline-strong',
            Mot: textOf(strong.Mot),
            Definition: sanitizeEditorialHtml(textOf(strong.Definition)),
            Code: textOf(strong.Code),
          }
        }
        return undefined
      })
    )
  ).filter((value): value is OpsInline => Boolean(value))

  return {
    title: textOf(result.title),
    modified_at: typeof result.modified_at === 'number' ? result.modified_at : 0,
    user: { displayName: textOf(result.user?.displayName) },
    html: convertStudyOpsToHtml(ops),
    annexe,
    imageUrl: '',
  }
}
