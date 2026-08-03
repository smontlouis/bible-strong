import React from 'react'
import type { TextStyle } from 'react-native'

import type { Verse } from '~common/types'
import Paragraph from '~common/ui/Paragraph'
import { buildCanonicalStrongVerseRuns } from '~helpers/canonicalStrongVerse'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import BibleStrongReference from './BibleStrongReference'

type Props = {
  verse: Pick<Verse, 'Texte' | 'Livre' | 'StrongSpans'>
  concordanceFor?: string | number
  small?: boolean
  textStyle?: TextStyle
}

const splitTextRun = (text: string): string[] => text.match(/\S+\s*|\s+/gu) || []

const CanonicalStrongVerseText = ({ verse, concordanceFor, small, textStyle }: Props) => {
  let textOffset = 0
  return buildCanonicalStrongVerseRuns(verse.Texte, verse.StrongSpans, concordanceFor).flatMap(
    (run, runIndex) => {
      if (run.kind === 'text') {
        return splitTextRun(run.text).map(chunk => {
          const key = `text-${runIndex}-${textOffset}`
          textOffset += chunk.length
          return (
            <Paragraph small={small} key={key} style={textStyle}>
              {chunk}
            </Paragraph>
          )
        })
      }

      return run.identities.flatMap((identity, identityIndex) => {
        const reference = getStrongReferenceNumber(identity.code)
        if (!reference) return []
        return [
          <BibleStrongReference
            small={small}
            concordanceFor={concordanceFor}
            book={verse.Livre}
            textStyle={textStyle}
            word={identityIndex === 0 ? run.word || undefined : undefined}
            reference={reference}
            key={`strong-${runIndex}-${identity.kind}-${identity.code}`}
          />,
        ]
      })
    }
  )
}

export default CanonicalStrongVerseText
