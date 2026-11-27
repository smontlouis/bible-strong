import type {
  BibleChaptersDto,
  BibleVerseTextsDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { StrongBibleChapterDto } from '@bible-strong/resource-domain/contracts/strongBibleContract'
import type {
  StrongLexiconChapterEntitiesResponseDto,
  StrongLexiconEntryCardsDto,
} from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import { TIPNR_BOOK_CODES } from '@bible-strong/resource-domain/strong-lexicon'
import { MAIN_BIBLE_VERSIONS } from '@bible-strong/resource-domain/verse-study'
import {
  bibleVerseKeyInBible,
  bibleVersification,
  convertVerseKey,
  convertVerseKeyToOne,
  parseVerseKey,
  RESOURCE_VERSIFICATIONS,
  type VersificationId,
} from '@bible-strong/resource-domain/versification'
import type { CommentaryVerseSectionsResponseDto } from '@bible-strong/resource-domain/contracts/supplementaryContract'
import type { VerseStudyResponseDto } from '@bible-strong/resource-domain/contracts/verseStudyContract'
import { readAtlasPortraitCatalog } from '../atlas/atlas.functions'
import { entityClayUrl, entityPortraitUrl } from '../atlas/atlasPortraits'
import { buildAtlasEntityPath } from '../atlas/atlasRoutes'
import { listCommentaries, type Commentary } from '../commentary/commentaryCatalog'
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
type NaveVerseTopicsDto = { verseTopics: NaveTopic[] }
type NaveTopic = { normalizedName: string; name: string }
type DictionaryVerseEntriesDto = { entries: DictionaryVerseEntry[] }
type DictionaryVerseEntry = {
  resource: { work: string }
  id: number
  word: string
  normalizedWord: string
  evidenceKind: string
  correspondenceId?: string
}
type StrongSpan = {
  startOffset: number
  length: number
  identities: readonly { kind: string; code: string }[]
}
type LexiconCard = Pick<
  StrongLexiconEntryCardsDto['entries'][number],
  'selectedIdentity' | 'original' | 'transliteration' | 'gloss'
>
type CommentarySection = CommentaryVerseSectionsResponseDto['sections'][number]
type ChapterEntity = StrongLexiconChapterEntitiesResponseDto['entities'][number]

/**
 * What the Resource API gathers around a verse that is the same in every Bible of a language
 * (ADR-0115), in one read: the parts this page reads otherwise one by one.
 */
type SharedVerseStudy = Pick<
  VerseStudyResponseDto,
  'words' | 'crossReferences' | 'commentaries' | 'topics' | 'dictionary' | 'entities'
>

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
  /** The people, places and nations the verse names, each leading to its page in the atlas. */
  entities: { name: string; path: string; picture: string }[]
}

// Every part of the study is read through `reads.optional` or marks the page with `missed`:
// a part that cannot be read is left out, and never keeps the verse from being read.

const readVerseTexts = (versionId: string, verses: readonly VerseKey[]) =>
  readResource<BibleVerseTextsDto>(`/v1/bibles/${versionId}/verses`, {
    references: verses.map(verseKey).join(','),
  })

/** A study the Resource API failed to answer: each part is left out, and the page knows it. */
const UNREAD = null

const TRESOR = 'cross-references:TRESOR'

/**
 * How the page asks for its study. Bibles number their verses differently (LSG counts a Psalm
 * title as verses 1-2, the KJV does not), and so do the resources a study gathers. When the
 * numbering of the page's Bible is known, the study is asked in the pivot numbering `org`, the
 * Resource API reads each part at its own verse, and what comes back is turned into the page's
 * verses. Otherwise every part is read at the page's verse, as before.
 */
type StudyNumbering = {
  /** The verse the study is asked for: in `org` when the page's numbering is known. */
  studyVerse: VerseKey
  numbering?: 'org'
  /** With `numbering`, the page's numbering: an unmeasured resource is read at the page's verse. */
  reader?: VersificationId
  /** A verse of the study, in the page's Bible; undefined when it has no equivalent there. */
  toPage: (key: string) => string | undefined
  /** The studied verse in a resource's numbering, for a part read on its own. */
  inResource: (resource: string) => string | undefined
  /** A verse key a part read on its own returned, in the study's numbering. */
  fromResource: (resource: string, key: string) => string | undefined
}

const studyNumbering = (versionId: string, verse: VerseKey): StudyNumbering => {
  const pageKey = verseKey(verse)
  const pageVersification = bibleVersification(versionId)
  const orgKey = pageVersification
    ? convertVerseKeyToOne(pageKey, pageVersification, 'org')
    : undefined
  const orgVerse = orgKey ? parseVerseKey(orgKey) : undefined
  if (!pageVersification || !orgKey || !orgVerse) {
    return {
      studyVerse: verse,
      toPage: key => key,
      inResource: () => pageKey,
      fromResource: (_, key) => key,
    }
  }
  // A resource whose numbering is not measured is read at the page's verse, as before.
  const numberingOf = (resource: string) => RESOURCE_VERSIFICATIONS[resource] ?? pageVersification
  return {
    studyVerse: orgVerse,
    numbering: 'org',
    reader: pageVersification,
    toPage: key => convertVerseKeyToOne(key, 'org', pageVersification),
    inResource: resource => convertVerseKey(orgKey, 'org', numberingOf(resource))[0],
    fromResource: (resource, key) => convertVerseKeyToOne(key, numberingOf(resource), 'org'),
  }
}

/** A verse of the page's chapter, by its number in the study's chapter. */
const pageVerseNumber = (
  numbering: StudyNumbering,
  verse: VerseKey,
  studyNumber: number
): number | undefined => {
  const { book, chapter } = numbering.studyVerse
  const found = parseVerseKey(numbering.toPage(`${book}-${chapter}-${studyNumber}`) ?? '')
  return found && found.chapter === verse.chapter ? found.verse : undefined
}

/**
 * The verse study the page shares with every Bible of its language, in one read. Undefined when
 * the Resource API does not know the route: it is deployed by hand before the site, which
 * deploys itself on a push, and for that while the page reads each part on its own, as it
 * did before. A study that could not be read is not read again part by part: an API already
 * refusing reads would be sent a dozen more.
 */
const readSharedStudy = async (
  reads: PageReads,
  language: ResourceLanguage,
  numbering: StudyNumbering,
  commentaries: readonly Commentary[]
): Promise<SharedVerseStudy | typeof UNREAD | undefined> => {
  try {
    return await reads.queue(() =>
      readResource<SharedVerseStudy>(
        `/v1/verse-studies/${language}/${verseKey(numbering.studyVerse)}`,
        {
          commentaries:
            commentaries.map(commentary => commentary.publicationId).join(',') || undefined,
          numbering: numbering.numbering,
          reader: numbering.reader,
        }
      )
    )
  } catch {
    reads.missed()
    return UNREAD
  }
}

/** A verse quoted from another Bible, at its own number there. */
type VerseInVersion = { text: string; verse: VerseKey }

/**
 * The verse in several Bibles, by Bible, each at the verse that stands for the page's in its
 * own numbering. The chapters are read in one read per chapter, the same for every verse of
 * the chapter: one read instead of one per Bible, which the API answers from its cache for all
 * but the first verse page of the chapter.
 */
const readVerseInVersions = async (
  reads: PageReads,
  versionIds: readonly string[],
  pageVersionId: string,
  verse: VerseKey
): Promise<Map<string, VerseInVersion>> => {
  const located = versionIds.flatMap(id => {
    const key = bibleVerseKeyInBible(verseKey(verse), pageVersionId, id)
    const found = key ? parseVerseKey(key) : undefined
    return found ? [{ id, verse: found }] : []
  })
  if (!located.length) return new Map()
  const byChapter = new Map<string, typeof located>()
  for (const entry of located) {
    const chapterKey = `${entry.verse.book}-${entry.verse.chapter}`
    byChapter.set(chapterKey, [...(byChapter.get(chapterKey) ?? []), entry])
  }
  const texts = (
    await Promise.all(
      [...byChapter.values()].map(async group => {
        const { book, chapter } = group[0].verse
        const chapters = await reads.optional(() =>
          readResource<BibleChaptersDto>('/v1/bibles/chapters', {
            versions: group.map(entry => entry.id).join(','),
            book,
            chapter,
          })
        )
        // Chapters are answered together or not at all: when one of them is missing after all,
        // or the read failed, each Bible is asked for the verse on its own.
        return chapters
          ? group.map(entry => {
              const found = chapters.chapters.find(
                candidate => candidate.resource.versionId === entry.id
              )
              const text = found?.verses.find(
                candidate => candidate.number === entry.verse.verse
              )?.text
              return [entry, text] as const
            })
          : Promise.all(
              group.map(
                async entry =>
                  [
                    entry,
                    (await reads.optional(() => readVerseTexts(entry.id, [entry.verse])))?.verses[0]
                      ?.text,
                  ] as const
              )
            )
      })
    )
  ).flat()
  // A Bible that leaves the verse blank has no words to quote, and no page for it.
  return new Map(
    texts.flatMap(([entry, text]) =>
      hasVerseText(text) ? [[entry.id, { text, verse: entry.verse }] as const] : []
    )
  )
}

const presentOtherVersions = (
  language: ResourceLanguage,
  versionId: string,
  texts: ReadonlyMap<string, VerseInVersion>
): VerseQuote[] =>
  otherMainVersions(language, versionId).flatMap(id => {
    const found = texts.get(id)
    const version = findBibleVersion(id)
    return found && version
      ? [
          {
            label: `${bibleVersionName(version, language)} (${id})`,
            path: buildBiblePath({
              versionId: id,
              book: found.verse.book,
              chapter: found.verse.chapter,
              passage: { startVerse: found.verse.verse },
            }),
            text: quoteVerseText(found.text),
          },
        ]
      : []
  })

const presentOriginal = (
  language: ResourceLanguage,
  texts: ReadonlyMap<string, VerseInVersion>
): VerseStudyData['original'] => {
  const found = texts.get(INTERLINEAR_VERSION_ID)
  return found
    ? {
        text: quoteVerseText(found.text),
        path: buildBiblePath({
          versionId: INTERLINEAR_VERSION_ID,
          presentation: 'interlinear',
          book: found.verse.book,
          chapter: found.verse.chapter,
          passage: { startVerse: found.verse.verse },
          gloss: language,
        }),
      }
    : undefined
}

/** The words of a verse behind which a Strong number stands, each once, in the order of the text. */
const taggedWordsOf = (spans: readonly StrongSpan[], text: string, language: ResourceLanguage) => {
  const taggedWords = spans.flatMap(span =>
    bibleStrongLinks(span.identities, language).map(link => ({
      ...link,
      word: text.slice(span.startOffset, span.startOffset + span.length).trim() || undefined,
    }))
  )
  return taggedWords.filter(
    (word, index) => taggedWords.findIndex(other => other.code === word.code) === index
  )
}

/** The words with the original word of their entry; a word whose entry is missing is left out. */
const presentWords = (
  words: ReturnType<typeof taggedWordsOf>,
  cards: readonly LexiconCard[],
  wordsVersion: string | undefined
): Pick<VerseStudyData, 'words' | 'wordsVersion'> => {
  const cardByCode = new Map(
    cards.map(card => [parseStrongCode(card.selectedIdentity.code)?.code, card])
  )
  return {
    words: words.flatMap(word => {
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
    wordsVersion,
  }
}

/**
 * The words of the verse behind which a Strong number stands. A Bible that is not tagged
 * borrows them from the reference Bible of its language, whose words come with the shared
 * study; a tagged Bible of its own reads its own, in two reads.
 */
const loadWords = async (
  reads: PageReads,
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey,
  verseText: Promise<string>,
  texts: Promise<ReadonlyMap<string, VerseInVersion>>,
  study: Promise<SharedVerseStudy | typeof UNREAD | undefined>
): Promise<Pick<VerseStudyData, 'words' | 'wordsVersion'>> => {
  const tagged = isBiblePresentationSupported(versionId, 'strong')
    ? versionId
    : defaultBibleVersionId(language)
  const borrowed = tagged !== versionId
  const text = () => (borrowed ? texts.then(found => found.get(tagged)?.text ?? '') : verseText)
  // A borrowed Bible may number the verse differently from the page's.
  const taggedVerse = borrowed
    ? (parseVerseKey(bibleVerseKeyInBible(verseKey(verse), versionId, tagged) ?? '') ?? verse)
    : verse

  if (tagged === defaultBibleVersionId(language)) {
    const shared = await study
    if (shared === UNREAD) return { words: [] }
    if (shared && shared.words.versionId === tagged) {
      const words = taggedWordsOf(shared.words.spans, await text(), language)
      if (!words.length) return { words: [] }
      return presentWords(words, shared.words.entries, borrowed ? tagged : undefined)
    }
  }

  const [chapter, verseTextOfTagged] = await Promise.all([
    reads.optional(() =>
      readResource<StrongBibleChapterDto>(
        `/v1/strong-bibles/${tagged}/books/${taggedVerse.book}/chapters/${taggedVerse.chapter}`
      )
    ),
    text(),
  ])
  const spans =
    chapter?.verses.find(candidate => candidate.number === taggedVerse.verse)?.spans ?? []
  const words = taggedWordsOf(spans, verseTextOfTagged, language)
  if (!words.length) return { words: [] }

  const cards = await reads.optional(() =>
    readResource<StrongLexiconEntryCardsDto>('/v1/strong-lexicon/entries/batch', {
      language,
      level: 'simple',
      identities: words.map(word => `dstrong:${word.code}`).join(','),
    })
  )
  return presentWords(words, cards?.entries ?? [], borrowed ? tagged : undefined)
}

/** The passages a verse is read with, in the Bible being read: one read of their texts. */
const loadCrossReferences = async (
  reads: PageReads,
  language: ResourceLanguage,
  versionId: string,
  verse: VerseKey,
  numbering: StudyNumbering,
  references: readonly string[]
): Promise<VerseQuote[]> => {
  // The passages are named in the study's numbering: each is read at its verse in the page's.
  const pageKeys = crossReferenceVerses(references, numbering.studyVerse).flatMap(target => {
    const key = numbering.toPage(verseKey(target))
    return key && key !== verseKey(verse) ? [key] : []
  })
  const verses = [...new Set(pageKeys)].flatMap(key => parseVerseKey(key) ?? [])
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

// The cross-references are the same in every language; the list is published once.
const readCrossReferenceList = async (
  reads: PageReads,
  numbering: StudyNumbering
): Promise<readonly string[]> => {
  const key = numbering.inResource(TRESOR)
  if (!key) return []
  const references =
    (
      await reads.optional(() =>
        readResource<CrossReferencesDto>(`/v1/cross-references/fr/verses/${key}`)
      )
    )?.references ?? []
  return references.flatMap(reference =>
    parseVerseKey(reference) ? (numbering.fromResource(TRESOR, reference) ?? []) : [reference]
  )
}

/** The first commentaries of the chapter, those a verse page quotes. */
const quotedCommentaries = (
  language: ResourceLanguage,
  commenting: readonly CommentaryLink[]
): Commentary[] => {
  const catalog = new Map(listCommentaries(language).map(commentary => [commentary.id, commentary]))
  return commenting.slice(0, VERSE_COMMENTARY_COUNT).flatMap(link => catalog.get(link.id) ?? [])
}

/**
 * How the first commentaries of the chapter begin on this verse: the section of each that
 * bears most closely on it, in one read. The Resource API picks the section; reading the
 * chapters to pick it here cost a read per commentary, and several hundred KB.
 */
const readCommentSections = async (
  reads: PageReads,
  language: ResourceLanguage,
  verse: VerseKey,
  commentaries: readonly Commentary[]
): Promise<readonly CommentarySection[]> => {
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
  return found?.sections ?? []
}

const presentComments = (
  language: ResourceLanguage,
  verse: VerseKey,
  numbering: StudyNumbering,
  commentaries: readonly Commentary[],
  found: readonly CommentarySection[]
): VerseComment[] => {
  const sections = new Map(found.map(section => [section.resource.resourceId, section]))
  // The verses of a section, given in the study's chapter, in the page's.
  const toPage = (studyNumber: number) =>
    studyNumber === 0 ? 0 : (pageVerseNumber(numbering, verse, studyNumber) ?? verse.verse)
  return commentaries.flatMap(commentary => {
    const section = sections.get(commentary.publicationId)
    const excerpt =
      section &&
      commentaryExcerpt(renderCommentaryHtml(section.content, { language }), COMMENT_EXCERPT_LENGTH)
    // The section page is in the commentary's own chapter (KJV Malachi 4 for LSG Malachi 3:23).
    const ownChapter =
      parseVerseKey(numbering.inResource(`commentary:${commentary.publicationId}`) ?? '')
        ?.chapter ?? verse.chapter
    return section && excerpt
      ? [
          {
            commentary: commentary.id,
            title: commentary.title,
            section: section.slug,
            path: buildCommentarySectionPath(
              { language, resource: commentary.id, book: verse.book, chapter: ownChapter },
              section.slug
            ),
            verses: commentVersesLabel(
              { startVerse: toPage(section.startVerse), endVerse: toPage(section.endVerse) },
              language
            ),
            excerpt,
          },
        ]
      : []
  })
}

const readTopics = async (
  reads: PageReads,
  language: ResourceLanguage,
  numbering: StudyNumbering
): Promise<readonly NaveTopic[]> => {
  const key = numbering.inResource(`nave:${language}`)
  if (!key) return []
  return (
    (
      await reads.optional(() =>
        readResource<NaveVerseTopicsDto>(`/v1/naves/${language}/verses/${key}/topics`)
      )
    )?.verseTopics ?? []
  )
}

const presentTopics = (
  language: ResourceLanguage,
  topics: readonly NaveTopic[]
): VerseStudyData['topics'] =>
  topics.flatMap(topic => {
    try {
      return [{ name: topic.name, path: buildNavePath(language, topic.normalizedName) }]
    } catch {
      return []
    }
  })

const readDictionaryEntries = async (
  reads: PageReads,
  language: ResourceLanguage,
  numbering: StudyNumbering
): Promise<readonly DictionaryVerseEntry[]> => {
  const key = numbering.inResource(`dictionary-presence:${language}`)
  if (!key) return []
  return (
    (
      await reads.optional(() =>
        readResource<DictionaryVerseEntriesDto>(`/v1/dictionaries/verses/${key}/entries`, {
          language,
        })
      )
    )?.entries ?? []
  )
}

const presentDictionary = (
  language: ResourceLanguage,
  entries: readonly DictionaryVerseEntry[]
): VerseStudyData['dictionary'] =>
  verseDictionaryEntries(entries).flatMap(entry => {
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

const ENTITIES = 'entities:tipnr'

/** The studied verse as the people and places of the atlas number it. */
const entityVerse = (numbering: StudyNumbering): VerseKey | undefined =>
  parseVerseKey(numbering.inResource(ENTITIES) ?? '')

// The entities of the chapter, as its end lists them in the app, then those of this verse.
const readChapterEntities = async (
  reads: PageReads,
  language: ResourceLanguage,
  verse: VerseKey | undefined
): Promise<readonly ChapterEntity[]> => {
  if (!verse) return []
  const bookCode = TIPNR_BOOK_CODES[verse.book - 1]
  if (!bookCode) return []
  return (
    (
      await reads.optional(() =>
        readResource<StrongLexiconChapterEntitiesResponseDto>(
          `/v1/strong-lexicon/entities/chapters/${bookCode}/${verse.chapter}`,
          { language }
        )
      )
    )?.entities ?? []
  )
}

const presentEntities = (
  language: ResourceLanguage,
  verse: VerseKey | undefined,
  entities: readonly ChapterEntity[],
  portraits: Awaited<ReturnType<typeof readAtlasPortraitCatalog>> | undefined
): VerseStudyData['entities'] =>
  entities
    .filter(entity => verse !== undefined && entity.verses.includes(verse.verse))
    .map(entity => {
      const portrait = portraits?.entities[entity.uniqueName]
      return {
        name: entity.name,
        path: buildAtlasEntityPath(language, entity.uniqueName),
        picture: portrait
          ? entityPortraitUrl(entity.uniqueName, portrait.hash, 'w256')
          : entityClayUrl(entity.category, entity.type, entity.uniqueName),
      }
    })

/**
 * Everything a verse page shows around its verse: the verse in a few other Bibles and in its
 * original language, its words, the people and places it names, the passages it is read with,
 * how commentaries begin on it, and the topics and dictionary articles that name it.
 *
 * What is the same in every Bible of the language comes in one read, the verse study the
 * Resource API gathers (ADR-0115): the 48 Bibles of the site share it. What changes with the
 * Bible is read beside it: the verse in the other Bibles, by chapter, and the texts of the
 * passages it is read with, once the study names them. A tagged Bible other than the one its
 * language borrows from reads its own words.
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
  const numbering = studyNumbering(versionId, verse)
  const texts = carrying.then(versionIds =>
    readVerseInVersions(
      reads,
      verseStudyVersions(
        language,
        INTERLINEAR_VERSION_ID,
        // A Bible whose numbering is known carries the verse at its own number, which may be in
        // another chapter than the page's (KJV Malachi 4:5 for LSG Malachi 3:23).
        numbering.numbering
          ? [
              ...versionIds,
              ...[...MAIN_BIBLE_VERSIONS[language], INTERLINEAR_VERSION_ID].filter(id =>
                bibleVersification(id)
              ),
            ]
          : versionIds
      ),
      versionId,
      verse
    )
  )
  // The commentaries are named in the read of the study: every Bible of the language names
  // the same ones, in the same order, and shares its answer.
  const commentaries = commenting.then(links => quotedCommentaries(language, links))
  const study = commentaries.then(quoted => readSharedStudy(reads, language, numbering, quoted))
  const portraits = reads.optional(readAtlasPortraitCatalog)

  // Each part comes from the study, or, while the Resource API does not know it, from its own
  // read. A study that could not be read leaves every part out.
  const part = <Shared, Part>(
    shared: (found: SharedVerseStudy) => Shared,
    empty: Shared,
    own: () => Promise<Shared>,
    present: (found: Shared) => Part | Promise<Part>
  ): Promise<Part> =>
    study.then(async found =>
      present(found === undefined ? await own() : found === UNREAD ? empty : shared(found))
    )

  const [words, crossReferences, quoted, comments, topics, dictionary, entities] =
    await Promise.all([
      loadWords(reads, language, versionId, verse, verseText, texts, study),
      part(
        found => found.crossReferences,
        [],
        () => readCrossReferenceList(reads, numbering),
        references => loadCrossReferences(reads, language, versionId, verse, numbering, references)
      ),
      texts,
      commentaries.then(quotedOnes =>
        part(
          found => found.commentaries,
          [],
          // Read on its own, every commentary is asked at the study's verse.
          () => readCommentSections(reads, language, numbering.studyVerse, quotedOnes),
          sections => presentComments(language, verse, numbering, quotedOnes, sections)
        )
      ),
      part(
        found => found.topics,
        [],
        () => readTopics(reads, language, numbering),
        found => presentTopics(language, found)
      ),
      part(
        found => found.dictionary,
        [],
        () => readDictionaryEntries(reads, language, numbering),
        found => presentDictionary(language, found)
      ),
      part(
        found => found.entities,
        [],
        // The entities are read and kept at their own number of the verse.
        () => readChapterEntities(reads, language, entityVerse(numbering)),
        async found => presentEntities(language, entityVerse(numbering), found, await portraits)
      ),
    ])
  return {
    versions: presentOtherVersions(language, versionId, quoted),
    original: versionId === INTERLINEAR_VERSION_ID ? undefined : presentOriginal(language, quoted),
    ...words,
    crossReferences,
    comments,
    topics,
    dictionary,
    entities,
  }
}
