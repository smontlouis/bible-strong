import * as z from 'zod/v4'
import type { Card } from './cards/types'
import { STUDY_LANGUAGES, type StudyLanguage } from './language'
import type { SiteLinks } from './links'
import type { ResourceReader } from './resourceApi'

/** What every reading of a resource is given. */
export type StudyContext = {
  api: ResourceReader
  links: SiteLinks
  /** The language of the host, used when a tool is asked for none. */
  language: StudyLanguage
}

/**
 * What a reading answers: the words the model reads, the fields it can reuse in a following
 * call, and the card shown to the person.
 */
export type StudyResult<Model extends Record<string, unknown>> = {
  text: string
  model: Model
  card?: Card
}

/**
 * Something the person or the model can act on: a reference that reads as none, a version
 * that does not exist, a verse without comment. Its message is shown as it is written.
 */
export class StudyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StudyError'
  }
}

export const languageInput = z
  .enum(STUDY_LANGUAGES)
  .optional()
  .describe(
    'Language of the study resources and of the answer: "fr" (French) or "en" (English). ' +
      'Use the language the user writes in. Defaults to the language of the user\'s app.'
  )

export const referenceInput = (what: string) =>
  z
    .string()
    .min(2)
    .max(200)
    .describe(
      `${what}, written as people write it in French or English ("Jean 3:16", "John 3:16-18", ` +
        '"1 Cor 13", "Ps 23") or as an OSIS reference returned by another tool ("John.3.16").'
    )

/** Joins the parts of an answer, leaving out the empty ones. */
export const lines = (...parts: (string | undefined | false)[]): string =>
  parts.filter((part): part is string => Boolean(part)).join('\n')

export const sourceLine = (url: string | undefined): string | undefined =>
  url ? `Source: ${url}` : undefined
