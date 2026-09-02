export type BibleReferenceParserLanguage = 'fr' | 'en'

export interface BibleReferenceMatch {
  osis: string
  indices: number[]
  translations: string[]
}

export interface BibleReferenceParseResult {
  osis(): string
  osis_and_indices(): BibleReferenceMatch[]
}

export interface BibleReferenceParser {
  readonly language: BibleReferenceParserLanguage
  parse(text: string): BibleReferenceParseResult
  parseWithContext(text: string, context: string): BibleReferenceParseResult
  lastVerse(book: string, chapter: number): number | undefined
}

export const BIBLE_REFERENCE_PARSER_VERSION: string

export function createBibleReferenceParser(
  language: BibleReferenceParserLanguage
): BibleReferenceParser
