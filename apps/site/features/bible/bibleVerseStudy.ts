import type { BibleVerseTextsDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { StrongBibleChapterDto } from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongLexiconEntryCardsDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { listCommentaries } from '../commentary/commentaryCatalog'
import { readCommentarySections } from '../commentary/commentaryChapter'
import { commentaryExcerpt, renderCommentaryHtml } from '../commentary/commentaryHtml'
import type { CommentaryLink } from '../commentary/commentaryLinks'
import { buildCommentarySectionPath } from '../commentary/commentaryRoutes'
import { buildDictionaryEntryPath } from '../dictionary/dictionaryRoutes'
import { buildNavePath } from '../nave/naveRoutes'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { parseStrongCode } from '../strong/strongRoutes'
import { bibleBookName } from './bibleBooks'
import { commentVersesLabel } from './bibleCommentaries'
import { buildBiblePath, INTERLINEAR_VERSION_ID, isBiblePresentationSupported } from './bibleRoutes'
import { bibleStrongLinks } from './bibleStrongLinks'
import {
  closestCommentarySection,
  crossReferenceVerses,
  otherMainVersions,
  quoteVerseText,
  VERSE_COMMENTARY_COUNT,
  verseDictionaryEntries,
  verseKey,
  type VerseKey,
} from './bibleVerseRules'
import { bibleVersionName, defaultBibleVersionId, findBibleVersion } from './bibleVersions'

// A comment is quoted for a few lines; the whole of it is a click away.
const COMMENT_EXCERPT_LENGTH = 460

type CrossReferencesDto = { references: string[] }
type NaveVerseTopicsDto = { verseTopics: { normalizedName: string; name: string }[] }
type DictionaryVerseEntriesDto = {
  entries: {
    resource: { work: string }
    id: number
    word: string
    normalizedWord: string
    evidenceKind: string
  }[]
}

export type VerseQuote = { label: string; path: string; text: string }

/** One word of the verse, with the original word behind it. */
export type VerseWord = {
  /** The sense the word has in the verse, which names its entry. */
  code: string
  path: string
  /** The classical number shown to the reader. */
  label: string
  /** The word as the translation writes it; an original word left untranslated has none. */
  word?: string
  original: string
  transliteration: string
  gloss: string
}

export type VerseComment = {
  /** The Resource identity of the commentary. */
  commentary: string
  title: string
  /** The section of the commentary, which the dialog of a Bible page reads whole. */
  section: string
  path: string
  /** The verses the comment bears on. */
  verses: string
  excerpt: string
}

/** What a verse page gathers around its verse. Every part may be empty: none is required. */
export type VerseStudyData = {
  versions: VerseQuote[]
  /** The verse in its original language, with the page that reads it word by word. */
  original?: { text: string; path: string }
  words: VerseWord[]
  /** The Bible the words are taken from, when the one being read is not Strong-tagged. */
  wordsVersion?: string
  crossReferences: VerseQuote[]
  comments: VerseComment[]
  topics: { name: string; path: string }[]
  dictionary: { word: string; path: string }[]
}

/** A part of the study that cannot be read is left out: it never keeps the verse from being read. */
const optional = <Result>(read: Promise<Result>): Promise<Result | undefined> =>
  read.catch(() => undefined)

const readVerseTexts = (versionId: string, verses: readonly VerseKey[]) =>
  readResource<BibleVerseTextsDto>(`/v1/bibles/${versionId}/verses`, {
    references: verses.map(verseKey).join(','),
  })

const loadOtherVersions = async (
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey
): Promise<VerseQuote[]> => {
  const quotes = await Promise.all(
    otherMainVersions(language, versionId).map(async id => {
      const text = (await optional(readVerseTexts(id, [verse])))?.verses[0]?.text
      const version = findBibleVersion(id)
      return text && version
        ? [
            {
              label: `${bibleVersionName(version, language)} (${id})`,
              path: buildBiblePath({
                versionId: id,
                book: verse.book,
                chapter: verse.chapter,
                passage: { startVerse: verse.verse },
              }),
              text: quoteVerseText(text),
            },
          ]
        : []
    })
  )
  return quotes.flat()
}

const loadOriginal = async (
  language: ResourceLanguage,
  verse: VerseKey
): Promise<VerseStudyData['original']> => {
  const text = (await optional(readVerseTexts(INTERLINEAR_VERSION_ID, [verse])))?.verses[0]?.text
  return text
    ? {
        text: quoteVerseText(text),
        path: buildBiblePath({
          versionId: INTERLINEAR_VERSION_ID,
          presentation: 'interlinear',
          book: verse.book,
          chapter: verse.chapter,
          passage: { startVerse: verse.verse },
          gloss: language,
        }),
      }
    : undefined
}

/**
 * The words of the verse behind which a Strong number stands. A Bible that is not tagged
 * borrows them from the reference Bible of its language.
 */
const loadWords = async (
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey,
  verseText: string
): Promise<Pick<VerseStudyData, 'words' | 'wordsVersion'>> => {
  const tagged = isBiblePresentationSupported(versionId, 'strong')
    ? versionId
    : defaultBibleVersionId(language)
  const borrowed = tagged !== versionId
  const [chapter, borrowedText] = await Promise.all([
    optional(
      readResource<StrongBibleChapterDto>(
        `/v1/strong-bibles/${tagged}/books/${verse.book}/chapters/${verse.chapter}`
      )
    ),
    borrowed ? optional(readVerseTexts(tagged, [verse])) : undefined,
  ])
  const spans = chapter?.verses.find(candidate => candidate.number === verse.verse)?.spans ?? []
  const text = borrowed ? (borrowedText?.verses[0]?.text ?? '') : verseText

  const taggedWords = spans.flatMap(span =>
    bibleStrongLinks(span.identities, language).map(link => ({
      ...link,
      word: text.slice(span.startOffset, span.startOffset + span.length).trim() || undefined,
    }))
  )
  const unique = taggedWords.filter(
    (word, index) => taggedWords.findIndex(other => other.code === word.code) === index
  )
  if (!unique.length) return { words: [] }

  const cards = await optional(
    readResource<StrongLexiconEntryCardsDto>('/v1/strong-lexicon/entries/batch', {
      language,
      level: 'simple',
      identities: unique.map(word => `dstrong:${word.code}`).join(','),
    })
  )
  const cardByCode = new Map(
    (cards?.entries ?? []).map(card => [parseStrongCode(card.selectedIdentity.code)?.code, card])
  )
  return {
    words: unique.flatMap(word => {
      const card = cardByCode.get(word.code)
      return card
        ? [
            {
              ...word,
              original: card.original,
              transliteration: card.transliteration,
              gloss: card.gloss,
            },
          ]
        : []
    }),
    wordsVersion: borrowed ? tagged : undefined,
  }
}

const loadCrossReferences = async (
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey
): Promise<VerseQuote[]> => {
  // The references are the same in every language; the list is published once.
  const list = await optional(
    readResource<CrossReferencesDto>(`/v1/cross-references/fr/verses/${verseKey(verse)}`)
  )
  const verses = crossReferenceVerses(list?.references ?? [], verse)
  if (!verses.length) return []
  const texts = await optional(readVerseTexts(versionId, verses))
  const textByKey = new Map(
    (texts?.verses ?? []).map(found => [
      verseKey({ book: found.book, chapter: found.chapter, verse: found.number }),
      found.text,
    ])
  )
  return verses.flatMap(reference => {
    const text = textByKey.get(verseKey(reference))
    return text
      ? [
          {
            label: `${bibleBookName(reference.book, language)} ${reference.chapter}:${reference.verse}`,
            path: buildBiblePath({
              versionId,
              book: reference.book,
              chapter: reference.chapter,
              passage: { startVerse: reference.verse },
            }),
            text: quoteVerseText(text),
          },
        ]
      : []
  })
}

/** How the first commentaries of the chapter begin on this verse. */
const loadComments = async (
  language: ResourceLanguage,
  verse: VerseKey,
  commenting: readonly CommentaryLink[]
): Promise<VerseComment[]> => {
  const catalog = new Map(listCommentaries(language).map(commentary => [commentary.id, commentary]))
  const comments = await Promise.all(
    commenting.slice(0, VERSE_COMMENTARY_COUNT).map(async link => {
      const commentary = catalog.get(link.id)
      if (!commentary) return []
      const sections = await optional(
        readCommentarySections(commentary, language, { book: verse.book, chapter: verse.chapter })
      )
      const section = closestCommentarySection(sections ?? [], verse.verse)
      const excerpt =
        section &&
        commentaryExcerpt(
          renderCommentaryHtml(section.content, { language }),
          COMMENT_EXCERPT_LENGTH
        )
      return section && excerpt
        ? [
            {
              commentary: commentary.id,
              title: commentary.title,
              section: section.slug,
              path: buildCommentarySectionPath(
                { language, resource: commentary.id, book: verse.book, chapter: verse.chapter },
                section.slug
              ),
              verses: commentVersesLabel(section, language),
              excerpt,
            },
          ]
        : []
    })
  )
  return comments.flat()
}

const loadTopics = async (
  language: ResourceLanguage,
  verse: VerseKey
): Promise<VerseStudyData['topics']> => {
  const found = await optional(
    readResource<NaveVerseTopicsDto>(`/v1/naves/${language}/verses/${verseKey(verse)}/topics`)
  )
  return (found?.verseTopics ?? []).flatMap(topic => {
    try {
      return [{ name: topic.name, path: buildNavePath(language, topic.normalizedName) }]
    } catch {
      return []
    }
  })
}

const loadDictionary = async (
  language: ResourceLanguage,
  verse: VerseKey
): Promise<VerseStudyData['dictionary']> => {
  const found = await optional(
    readResource<DictionaryVerseEntriesDto>(`/v1/dictionaries/verses/${verseKey(verse)}/entries`, {
      language,
    })
  )
  return verseDictionaryEntries(found?.entries ?? []).flatMap(entry => {
    try {
      return [
        {
          word: entry.word,
          path: buildDictionaryEntryPath({
            language,
            work: entry.resource.work,
            entryId: entry.id,
            word: entry.word,
          }),
        },
      ]
    } catch {
      return []
    }
  })
}

/**
 * Everything a verse page shows around its verse: the verse in a few other Bibles and in its
 * original language, its words, the passages it is read with, how commentaries begin on it,
 * and the topics and dictionary articles that name it.
 */
export const loadVerseStudy = async ({
  language,
  versionId,
  verse,
  verseText,
  commenting,
}: {
  language: ResourceLanguage
  versionId: string
  verse: VerseKey
  verseText: string
  /** The commentaries of the page language that comment the chapter. */
  commenting: readonly CommentaryLink[]
}): Promise<VerseStudyData> => {
  const [versions, original, words, crossReferences, comments, topics, dictionary] =
    await Promise.all([
      loadOtherVersions(language, versionId, verse),
      versionId === INTERLINEAR_VERSION_ID ? undefined : loadOriginal(language, verse),
      loadWords(language, versionId, verse, verseText),
      loadCrossReferences(language, versionId, verse),
      loadComments(language, verse, commenting),
      loadTopics(language, verse),
      loadDictionary(language, verse),
    ])
  return { versions, original, ...words, crossReferences, comments, topics, dictionary }
}
