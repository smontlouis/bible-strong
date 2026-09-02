import { bcv_parser } from '../esm/bcv_parser.js'
import * as en from '../esm/lang/en.js'
import * as fr from '../esm/lang/fr.js'

export const BIBLE_REFERENCE_PARSER_VERSION = '3.2.0-bible-strong.2'

const languages = { en, fr }

export const createBibleReferenceParser = language => {
  if (!(language in languages)) {
    throw new Error(`BIBLE_REFERENCE_PARSER_LANGUAGE_UNSUPPORTED:${language}`)
  }
  const parser = new bcv_parser(languages[language])
  parser.set_options({
    book_match_strategy: 'strict',
    consecutive_combination_strategy: 'separate',
    sequence_combination_strategy: 'separate',
    passage_existence_strategy: 'bcv',
    testaments: 'ona',
  })

  return {
    language,
    parse: text => parser.parse(text),
    parseWithContext: (text, context) => parser.parse_with_context(text, context),
    lastVerse: (book, chapter) => parser.translations.systems.default.chapters[book]?.[chapter - 1],
  }
}
