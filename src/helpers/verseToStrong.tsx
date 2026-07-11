import * as Sentry from '@sentry/react-native'
import React from 'react'

import Paragraph from '~common/ui/Paragraph'
import BibleStrongReference from '~features/bible/BibleStrongReference'

import {
  parseStrongVerse,
  type StrongLexiconEntry,
  type StrongVerseModel,
} from './strongVerseParser'

interface VerseData {
  Texte: string
  Livre: number
}

interface VerseToStrongResult {
  formattedTexte: React.JSX.Element[]
  references: string[]
  model: StrongVerseModel
}

const splitTextRun = (text: string): string[] => text.match(/\S+\s*|\s+/gu) || []

const verseToStrong = async (
  { Texte, Livre }: VerseData,
  concordanceFor?: string,
  isSmall?: boolean,
  lexiconEntries: StrongLexiconEntry[] = []
): Promise<VerseToStrongResult> => {
  try {
    const model = parseStrongVerse(Texte, Livre, lexiconEntries)
    const formattedTexte = model.runs.flatMap(run => {
      if (run.type === 'text') {
        let offset = 0
        return splitTextRun(run.text).map(text => {
          const key = `${run.id}-${offset}`
          offset += text.length
          return (
            <Paragraph small={isSmall} key={key}>
              {text}
            </Paragraph>
          )
        })
      }

      if (run.type === 'standalone') {
        return (
          <BibleStrongReference
            small={isSmall}
            concordanceFor={concordanceFor}
            book={Livre}
            reference={run.reference}
            key={run.id}
          />
        )
      }

      return (
        <BibleStrongReference
          small={isSmall}
          concordanceFor={concordanceFor}
          book={Livre}
          word={run.text}
          reference={run.reference}
          key={run.id}
        />
      )
    })

    return { formattedTexte, references: model.references, model }
  } catch (error) {
    Sentry.withScope(scope => {
      scope.setExtra('Reference', `${Texte}-${Livre}`)
      Sentry.captureException(error)
    })

    throw error
  }
}

export default verseToStrong
