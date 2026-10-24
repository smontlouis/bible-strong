import type {
  BibleChapterDto,
  BibleVerseTextsDto,
} from '@bible-strong/resource-domain/contracts/bibleChapterContract'
import type { InterlinearBibleChapterDto } from '@bible-strong/resource-domain/contracts/interlinearBibleContract'
import type { StrongLexiconMorphologyResponseDto } from '@bible-strong/resource-domain/contracts/strongLexiconContract'
import * as z from 'zod/v4'
import { quoteText } from '../bible/layout'
import { formatPassage, formatVerse, passageOsis, verseKey, verseOsis } from '../bible/reference'
import { defaultVersionId, ORIGINAL_VERSION_ID } from '../bible/versions'
import type { VerseWordsCard, WordView } from '../cards/types'
import type { StudyLanguage } from '../language'
import { displayedStrongCode } from '../strong/codes'
import {
  languageInput,
  lines,
  referenceInput,
  sourceLine,
  StudyError,
  type StudyContext,
  type StudyResult,
} from '../study'
import { requirePassages } from './passage'

/** A verse of Hebrew holds some fifteen words; three verses are what a card reads well. */
const MAX_VERSES = 3

export const wordsInput = {
  reference: referenceInput(
    `The verse to read word by word in Hebrew or Greek (up to ${MAX_VERSES} consecutive verses)`
  ),
  language: languageInput,
}

export const wordsOutput = z.object({
  reference: z.string(),
  osis: z.string(),
  originalLanguage: z.enum(['hebrew', 'greek']),
  url: z.string().optional(),
  verses: z.array(
    z.object({
      reference: z.string(),
      translation: z.string().optional().describe('The verse in a Bible of the answer language.'),
      words: z.array(
        z.object({
          original: z.string(),
          transliteration: z.string(),
          gloss: z.string().describe('What the word means here, in the answer language.'),
          strong: z.string().optional().describe('Its Strong number, for get_strong_entry.'),
          morphology: z.string().optional().describe('Its grammatical form, in words.'),
        })
      ),
    })
  ),
})

type WordsModel = z.infer<typeof wordsOutput>

export const loadWords = async (
  context: StudyContext,
  input: { reference: string; language?: StudyLanguage }
): Promise<StudyResult<WordsModel>> => {
  const language = input.language ?? context.language
  const asked = requirePassages(input.reference, language)[0]!
  if (asked.book > 66) {
    throw new StudyError(
      'The word-by-word reading covers the 66 books of the Hebrew and Greek Bible; ' +
        'this book is read in translation only.'
    )
  }
  const passage = {
    ...asked,
    endVerse: Math.min(asked.endVerse, asked.startVerse + MAX_VERSES - 1),
    wholeChapter: false,
  }
  const numbers = Array.from(
    { length: passage.endVerse - passage.startVerse + 1 },
    (_, index) => passage.startVerse + index
  )
  const translationVersion = defaultVersionId(language)
  const chapterPath = `books/${passage.book}/chapters/${passage.chapter}`

  const [original, interlinear, translation] = await Promise.all([
    context.api.get<BibleChapterDto>(`/v1/bibles/${ORIGINAL_VERSION_ID}/${chapterPath}`),
    context.api.get<InterlinearBibleChapterDto>(
      `/v1/interlinear-bibles/${ORIGINAL_VERSION_ID}/languages/${language}/${chapterPath}`
    ),
    context.api
      .get<BibleVerseTextsDto>(`/v1/bibles/${translationVersion}/verses`, {
        references: numbers
          .map(verse => verseKey({ book: passage.book, chapter: passage.chapter, verse }))
          .join(','),
      })
      // The words are worth reading without the translation beside them.
      .catch(() => undefined),
  ])
  if (!original || !interlinear) {
    throw new StudyError(`${formatPassage(passage, language)} has no word-by-word reading.`)
  }

  const read = numbers.flatMap(number => {
    const text = original.verses.find(verse => verse.number === number)?.text
    const tokens = interlinear.verses.find(verse => verse.number === number)?.tokens
    if (!text || !tokens?.length) return []
    const words = [...tokens]
      .sort((left, right) => left.ordinal - right.ordinal)
      .map(token => {
        const segments = [...token.segments].sort((left, right) => left.ordinal - right.ordinal)
        // A Hebrew word carries its particles with it: the longest part is the word itself.
        const main = segments.reduce(
          (longest, segment) => (segment.length > (longest?.length ?? -1) ? segment : longest),
          segments[0]
        )
        return {
          // The text keeps its punctuation with the word before it.
          original: text
            .slice(token.startOffset, token.startOffset + token.length)
            .replace(/[\s,.;:·!?׃]+$/u, ''),
          transliteration: segments.map(segment => segment.transliteration).join(''),
          gloss: segments
            .map(segment => segment.gloss.trim())
            .filter(Boolean)
            .join(' '),
          strong: main ? displayedStrongCode(main.identities) : undefined,
          morphologyCode: main?.morphology,
        }
      })
    return [{ number, words }]
  })
  if (!read.length) {
    throw new StudyError(`${formatPassage(passage, language)} has no word-by-word reading.`)
  }

  const morphologyCodes = [
    ...new Set(read.flatMap(verse => verse.words.flatMap(word => word.morphologyCode ?? []))),
  ]
  const morphologies = morphologyCodes.length
    ? await context.api
        .get<StrongLexiconMorphologyResponseDto>('/v1/strong-lexicon/morphologies', {
          language,
          codes: morphologyCodes.join(','),
        })
        .catch(() => undefined)
    : undefined
  // An unknown form is answered by its own code, which says nothing to a reader.
  const meanings = new Map(
    (morphologies?.morphologies ?? [])
      .filter(morphology => morphology.meaning && morphology.meaning !== morphology.code)
      .map(morphology => [morphology.code.toLowerCase(), morphology.meaning])
  )

  const lexicon = passage.book <= 39 ? ('hebrew' as const) : ('greek' as const)
  const shown = { ...passage, endVerse: read.at(-1)!.number, startVerse: read[0]!.number }
  const title = formatPassage(shown, language)
  const url = context.links.interlinear(language, passage.book, passage.chapter, shown.startVerse)

  const verses = read.map(({ number, words }) => {
    const location = { book: passage.book, chapter: passage.chapter, verse: number }
    const translated = translation?.verses.find(verse => verse.number === number)?.text
    return {
      number,
      label: formatVerse(location, language),
      osis: verseOsis(location),
      translation: translated ? quoteText(translated) : undefined,
      words: words.map(
        (word): WordView => ({
          original: word.original,
          transliteration: word.transliteration,
          gloss: word.gloss,
          ...(word.strong ? { code: word.strong.code, label: word.strong.label } : {}),
          ...(word.morphologyCode && meanings.has(word.morphologyCode.toLowerCase())
            ? { morphology: meanings.get(word.morphologyCode.toLowerCase()) }
            : {}),
        })
      ),
    }
  })

  const card: VerseWordsCard = {
    kind: 'verse_words',
    language,
    title,
    osis: passageOsis(shown),
    lexicon,
    direction: lexicon === 'hebrew' ? 'rtl' : 'ltr',
    verses: verses.map(verse => ({
      number: verse.number,
      label: verse.label,
      osis: verse.osis,
      words: verse.words,
      ...(verse.translation
        ? { translation: { version: translationVersion, text: verse.translation } }
        : {}),
    })),
    url,
  }

  return {
    text: lines(
      ...verses.flatMap(verse => [
        `${verse.label} — ${lexicon === 'hebrew' ? 'Hebrew' : 'Greek'}, word by word`,
        verse.translation && `${translationVersion}: ${verse.translation}`,
        ...verse.words.map(
          (word, index) =>
            `${index + 1}. ${word.original} (${word.transliteration}) — ${word.gloss}` +
            (word.label ? ` — Strong ${word.code}` : '') +
            (word.morphology ? ` — ${word.morphology}` : '')
        ),
        '',
      ]),
      asked.endVerse > passage.endVerse &&
        `Only the first ${MAX_VERSES} verses are read; ask for the following ones separately.`,
      sourceLine(url)
    ),
    model: {
      reference: title,
      osis: card.osis,
      originalLanguage: lexicon,
      url,
      verses: verses.map(verse => ({
        reference: verse.label,
        ...(verse.translation ? { translation: verse.translation } : {}),
        words: verse.words.map(word => ({
          original: word.original,
          transliteration: word.transliteration,
          gloss: word.gloss,
          ...(word.code ? { strong: word.code } : {}),
          ...(word.morphology ? { morphology: word.morphology } : {}),
        })),
      })),
    },
    card,
  }
}
