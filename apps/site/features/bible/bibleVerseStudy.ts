import type {
  BibleChaptersDto,
  BibleVerseTextsDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { StrongBibleChapterDto } from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type { StrongLexiconEntryCardsDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import type { CommentaryVerseSectionsResponseDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import { listCommentaries } from '../commentary/commentaryCatalog'
import { commentaryExcerpt, renderCommentaryHtml } from '../commentary/commentaryHtml'
import type { CommentaryLink } from '../commentary/commentaryLinks'
import { buildCommentarySectionPath } from '../commentary/commentaryRoutes'
import { buildDictionaryEntryPath } from '../dictionary/dictionaryRoutes'
import { buildNavePath } from '../nave/naveRoutes'
import type { PageReads } from '../resources/pageReads'
import type { ResourceLanguage } from '../resources/publicSite'
import { readResource } from '../resources/resourceApi'
import { parseStrongCode } from '../strong/strongRoutes'
import { bibleBookName } from './bibleBooks'
import { commentVersesLabel } from './bibleCommentaries'
import { buildBiblePath, INTERLINEAR_VERSION_ID, isBiblePresentationSupported } from './bibleRoutes'
import { bibleStrongLinks } from './bibleStrongLinks'
import {
  crossReferenceVerses,
  hasVerseText,
  otherMainVersions,
  quoteVerseText,
  VERSE_COMMENTARY_COUNT,
  verseDictionaryEntries,
  verseKey,
  verseStudyVersions,
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

// Every part of the study is read through `reads.optional`: a part that cannot be read is
// left out, and never keeps the verse from being read.

const readVerseTexts = (versionId: string, verses: readonly VerseKey[]) =>
  readResource<BibleVerseTextsDto>(`/v1/bibles/${versionId}/verses`, {
    references: verses.map(verseKey).join(','),
  })

/**
 * The verse in several Bibles, by Bible. Their chapters are read in one read, the same for
 * every verse of the chapter: one read instead of one per Bible, which the API answers from
 * its cache for all but the first verse page of the chapter.
 */
const readVerseInVersions = async (
  reads: PageReads,
  versionIds: readonly string[],
  verse: VerseKey
): Promise<Map<string, string>> => {
  if (!versionIds.length) return new Map()
  const chapters = await reads.optional(() =>
    readResource<BibleChaptersDto>('/v1/bibles/chapters', {
      versions: versionIds.join(','),
      book: verse.book,
      chapter: verse.chapter,
    })
  )
  // Chapters are answered together or not at all: when one of them is missing after all,
  // or the read failed, each Bible is asked for the verse on its own.
  const texts = chapters
    ? chapters.chapters.map(
        chapter =>
          [
            chapter.resource.versionId,
            chapter.verses.find(candidate => candidate.number === verse.verse)?.text,
          ] as const
      )
    : await Promise.all(
        versionIds.map(
          async id =>
            [
              id,
              (await reads.optional(() => readVerseTexts(id, [verse])))?.verses[0]?.text,
            ] as const
        )
      )
  // A Bible that leaves the verse blank has no words to quote, and no page for it.
  return new Map(texts.flatMap(([id, text]) => (hasVerseText(text) ? [[id, text] as const] : [])))
}

const presentOtherVersions = (
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey,
  texts: ReadonlyMap<string, string>
): VerseQuote[] =>
  otherMainVersions(language, versionId).flatMap(id => {
    const text = texts.get(id)
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

const presentOriginal = (
  language: ResourceLanguage,
  verse: VerseKey,
  texts: ReadonlyMap<string, string>
): VerseStudyData['original'] => {
  const text = texts.get(INTERLINEAR_VERSION_ID)
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
  reads: PageReads,
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey,
  verseText: Promise<string>,
  texts: Promise<ReadonlyMap<string, string>>
): Promise<Pick<VerseStudyData, 'words' | 'wordsVersion'>> => {
  const tagged = isBiblePresentationSupported(versionId, 'strong')
    ? versionId
    : defaultBibleVersionId(language)
  const borrowed = tagged !== versionId
  const [chapter, text] = await Promise.all([
    reads.optional(() =>
      readResource<StrongBibleChapterDto>(
        `/v1/strong-bibles/${tagged}/books/${verse.book}/chapters/${verse.chapter}`
      )
    ),
    borrowed ? texts.then(found => found.get(tagged) ?? '') : verseText,
  ])
  const spans = chapter?.verses.find(candidate => candidate.number === verse.verse)?.spans ?? []

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

  const cards = await reads.optional(() =>
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
  reads: PageReads,
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey
): Promise<VerseQuote[]> => {
  // The references are the same in every language; the list is published once.
  const list = await reads.optional(() =>
    readResource<CrossReferencesDto>(`/v1/cross-references/fr/verses/${verseKey(verse)}`)
  )
  const verses = crossReferenceVerses(list?.references ?? [], verse)
  if (!verses.length) return []
  const texts = await reads.optional(() => readVerseTexts(versionId, verses))
  const textByKey = new Map(
    (texts?.verses ?? []).map(found => [
      verseKey({ book: found.book, chapter: found.chapter, verse: found.number }),
      found.text,
    ])
  )
  return verses.flatMap(reference => {
    const text = textByKey.get(verseKey(reference))
    return hasVerseText(text)
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

/**
 * How the first commentaries of the chapter begin on this verse: the section of each that
 * bears most closely on it, in one read. The Resource API picks the section; reading the
 * chapters to pick it here cost a read per commentary, and several hundred KB.
 */
const loadComments = async (
  reads: PageReads,
  language: ResourceLanguage,
  verse: VerseKey,
  commenting: readonly CommentaryLink[]
): Promise<VerseComment[]> => {
  const catalog = new Map(listCommentaries(language).map(commentary => [commentary.id, commentary]))
  const commentaries = commenting
    .slice(0, VERSE_COMMENTARY_COUNT)
    .flatMap(link => catalog.get(link.id) ?? [])
  if (!commentaries.length) return []

  const found = await reads.optional(() =>
    readResource<CommentaryVerseSectionsResponseDto>(
      `/v1/commentaries/verses/${verseKey(verse)}/sections`,
      {
        language,
        commentaries: commentaries.map(commentary => commentary.publicationId).join(','),
      }
    )
  )
  const sections = new Map(
    (found?.sections ?? []).map(section => [section.resource.resourceId, section])
  )
  return commentaries.flatMap(commentary => {
    const section = sections.get(commentary.publicationId)
    const excerpt =
      section &&
      commentaryExcerpt(renderCommentaryHtml(section.content, { language }), COMMENT_EXCERPT_LENGTH)
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
}

const loadTopics = async (
  reads: PageReads,
  language: ResourceLanguage,
  verse: VerseKey
): Promise<VerseStudyData['topics']> => {
  const found = await reads.optional(() =>
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
  reads: PageReads,
  language: ResourceLanguage,
  verse: VerseKey
): Promise<VerseStudyData['dictionary']> => {
  const found = await reads.optional(() =>
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
 *
 * Nothing here waits for the chapter of the page: what the study needs from it comes as
 * promises, so its reads leave with the read of the chapter instead of after it.
 */
export const loadVerseStudy = async ({
  reads,
  language,
  versionId,
  verse,
  verseText,
  carrying,
  commenting,
}: {
  reads: PageReads
  language: ResourceLanguage
  versionId: string
  verse: VerseKey
  /** The verse as the Bible being read writes it; it must not reject. */
  verseText: Promise<string>
  /** The Bibles that carry the verse. */
  carrying: Promise<readonly string[]>
  /** The commentaries of the page language that comment the chapter. */
  commenting: Promise<readonly CommentaryLink[]>
}): Promise<VerseStudyData> => {
  const texts = carrying.then(versionIds =>
    readVerseInVersions(
      reads,
      verseStudyVersions(language, INTERLINEAR_VERSION_ID, versionIds),
      verse
    )
  )
  // The reads another read waits for are asked first: the words, then the cross-references.
  const [words, crossReferences, quoted, comments, topics, dictionary] = await Promise.all([
    loadWords(reads, language, versionId, verse, verseText, texts),
    loadCrossReferences(reads, language, versionId, verse),
    texts,
    commenting.then(links => loadComments(reads, language, verse, links)),
    loadTopics(reads, language, verse),
    loadDictionary(reads, language, verse),
  ])
  return {
    versions: presentOtherVersions(language, versionId, verse, quoted),
    original:
      versionId === INTERLINEAR_VERSION_ID ? undefined : presentOriginal(language, verse, quoted),
    ...words,
    crossReferences,
    comments,
    topics,
    dictionary,
  }
}
