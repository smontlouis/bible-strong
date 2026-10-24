import type { BibleChapterDto } from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import * as z from 'zod/v4'
import { hasText, quoteText, readVerses } from '../bible/layout'
import {
  formatPassage,
  formatPassages,
  formatVerse,
  MAX_READING_CHAPTERS,
  MAX_READING_VERSES,
  parsePassages,
  passageOsis,
  verseCount,
  type Passage,
} from '../bible/reference'
import {
  BIBLE_VERSIONS,
  defaultVersionId,
  findVersion,
  hasStrongNumbers,
  versionDirection,
  versionName,
  type BibleVersion,
} from '../bible/versions'
import type { PassageCard, PassageColumn, PassageSection } from '../cards/types'
import type { StudyLanguage } from '../language'
import {
  languageInput,
  lines,
  referenceInput,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'

const MAX_VERSIONS = 4

export const passageInput = {
  reference: referenceInput('The Bible passage to read: a verse, a range of verses or a chapter'),
  versions: z
    .array(z.string().min(2).max(32))
    .min(1)
    .max(MAX_VERSIONS)
    .optional()
    .describe(
      'Bible version codes to read the passage in, such as ["LSG"] or ["KJV", "ESV"]. ' +
        `Up to ${MAX_VERSIONS}; several versions are read side by side. Defaults to LSG in ` +
        'French and KJV in English. list_bible_versions gives every code.'
    ),
  language: languageInput,
}

export const passageOutput = z.object({
  reference: z.string().describe('The passage as it is printed, in the language of the answer.'),
  osis: z.string().describe('The same passage as an OSIS reference, for other tools.'),
  url: z.string().optional().describe('The page of this passage on bible-strong.app.'),
  readings: z.array(
    z.object({
      version: z.string(),
      versionName: z.string(),
      verses: z.array(z.object({ reference: z.string(), text: z.string() })),
      missing: z
        .array(z.string())
        .optional()
        .describe('Passages this version does not hold, such as the New Testament in a Hebrew Bible.'),
    })
  ),
})

type PassageModel = z.infer<typeof passageOutput>

/** The versions a passage is read in, however their codes were written. */
export const resolveVersions = (
  asked: readonly string[] | undefined,
  language: StudyLanguage
): BibleVersion[] => {
  const codes = asked?.length ? asked : [defaultVersionId(language)]
  const versions = codes.map(code => {
    const version = findVersion(code)
    if (!version) {
      throw new StudyError(
        `"${code}" is not a Bible version Bible Strong reads. Use a code such as LSG, S21, ` +
          'KJV or ESV; list_bible_versions gives them all.'
      )
    }
    return version
  })
  return [...new Map(versions.map(version => [version.id, version])).values()]
}

export const requirePassages = (reference: string, language: StudyLanguage): Passage[] => {
  const passages = parsePassages(reference, language)
  if (!passages.length) {
    throw new StudyError(
      `"${reference}" does not read as a Bible reference. Write it like "John 3:16", ` +
        '"Jean 3:16-18" or "Psalm 23".'
    )
  }
  return passages
}

const readChapter = (context: StudyContext, version: string, { book, chapter }: Passage) =>
  context.api.get<BibleChapterDto>(`/v1/bibles/${version}/books/${book}/chapters/${chapter}`)

export const loadPassage = async (
  context: StudyContext,
  input: { reference: string; versions?: string[]; language?: StudyLanguage }
): Promise<StudyResult<PassageModel>> => {
  const language = input.language ?? context.language
  const passages = requirePassages(input.reference, language)
  if (passages.length > MAX_READING_CHAPTERS || verseCount(passages) > MAX_READING_VERSES) {
    throw new StudyError(
      `That is more than one reading holds (${MAX_READING_VERSES} verses). Ask for a shorter passage, ` +
        'or read it chapter by chapter.'
    )
  }
  const versions = resolveVersions(input.versions, language)
  const single = versions.length === 1

  const columns = await Promise.all(
    versions.map(async (version): Promise<PassageColumn> => {
      const sections = await Promise.all(
        passages.map(async (passage): Promise<PassageSection> => {
          const chapter = await readChapter(context, version.id, passage)
          const verses = (chapter?.verses ?? []).filter(
            verse =>
              verse.number >= passage.startVerse &&
              verse.number <= passage.endVerse &&
              hasText(verse.text)
          )
          return {
            label: formatPassage(passage, language),
            osis: passageOsis(passage),
            book: passage.book,
            chapter: passage.chapter,
            // Section titles belong to a chapter being read, not to a quoted passage.
            verses: readVerses(verses, { headings: passage.wholeChapter && single }),
            ...(verses.length ? {} : { missing: true as const }),
            url: context.links.passage(version.id, passage),
          }
        })
      )
      return {
        version: version.id,
        versionName: versionName(version, language),
        direction: versionDirection(version, passages[0]!.book),
        sections,
      }
    })
  )

  if (columns.every(column => column.sections.every(section => section.missing))) {
    throw new StudyError(
      `${formatPassages(passages, language)} was not found in ${versions
        .map(version => version.id)
        .join(', ')}. The passage may not exist, or the version may not hold this book.`
    )
  }

  const title = formatPassages(passages, language)
  const osis = passages.map(passageOsis).join(',')
  // The page of the first version that holds the passage.
  const readable = columns.find(column => column.sections.some(section => !section.missing))
  const url = context.links.passage(readable?.version ?? versions[0]!.id, passages[0]!)

  const readings = columns.map(column => ({
    version: column.version,
    versionName: column.versionName,
    verses: column.sections.flatMap(section =>
      section.verses.map(verse => ({
        reference: formatVerse(
          { book: section.book, chapter: section.chapter, verse: verse.number },
          language
        ),
        text: quoteText(verse.parts.map(part => ('text' in part ? part.text : ' ')).join('')),
      }))
    ),
    ...(column.sections.some(section => section.missing)
      ? { missing: column.sections.filter(section => section.missing).map(s => s.label) }
      : {}),
  }))

  const card: PassageCard = {
    kind: 'passage',
    language,
    title,
    osis,
    columns,
    // The original text is read word by word in the 66 books of the Hebrew and Greek Bible.
    words: passages.every(passage => passage.book <= 66),
    url,
  }

  return {
    text: lines(
      ...readings.flatMap(reading => [
        `${title} — ${reading.versionName} (${reading.version})`,
        ...reading.verses.map(verse => `${verse.reference.split(' ').at(-1)} ${verse.text}`),
        reading.missing ? `Not in this version: ${reading.missing.join(', ')}` : undefined,
        '',
      ]),
      sourceLine(url)
    ),
    model: { reference: title, osis, url, readings },
    card,
  }
}

// --- The versions --------------------------------------------------------------

export const versionsInput = {
  language: z
    .enum(['fr', 'en', 'original'])
    .optional()
    .describe(
      'Only the versions of one language: "fr", "en", or "original" for Hebrew, Greek and Latin texts.'
    ),
}

export const versionsOutput = z.object({
  versions: z.array(
    z.object({
      code: z.string(),
      name: z.string(),
      language: z.string().describe('BCP 47 language of the text.'),
      strongNumbers: z.boolean().describe('Its words carry Strong numbers.'),
    })
  ),
})

export const loadVersions = async (
  context: StudyContext,
  input: { language?: 'fr' | 'en' | 'original' }
): Promise<StudyResult<z.infer<typeof versionsOutput>>> => {
  const versions = BIBLE_VERSIONS.filter(version =>
    input.language === undefined
      ? true
      : input.language === 'original'
        ? version.language !== 'fr' && version.language !== 'en'
        : version.language === input.language
  ).map(version => ({
    code: version.id,
    name: versionName(version, context.language),
    language: version.language,
    strongNumbers: hasStrongNumbers(version.id),
  }))
  return {
    text: versions
      .map(
        version =>
          `${version.code} — ${version.name} (${version.language})${
            version.strongNumbers ? ', Strong numbers' : ''
          }`
      )
      .join('\n'),
    model: { versions },
  }
}
