import React from 'react'

import type { Verse } from '~common/types'
import Paragraph from '~common/ui/Paragraph'
import { buildCanonicalStrongVerseRuns } from '~helpers/canonicalStrongVerse'
import { getStrongReferenceNumber } from '~helpers/strongIdentities'
import BibleStrongReference, { type StrongVerseTextStyle } from './BibleStrongReference'

type Props = {
  verse: Pick<Verse, 'Texte' | 'Livre' | 'StrongSpans'>
  concordanceFor?: string | number
  small?: boolean
  textStyle?: StrongVerseTextStyle
}

const splitTextRun = (text: string): string[] => text.match(/\S+\s*|\s+/gu) || []

const CanonicalStrongVerseText = ({ verse, concordanceFor, small, textStyle }: Props) => {
  let textOffset = 0
  let occurrenceIndex = 0
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

      const selectionTargets = run.identities.flatMap(identity => {
        const currentOccurrenceIndex = occurrenceIndex
        occurrenceIndex += 1
        const reference = getStrongReferenceNumber(identity.code)
        return reference ? [{ reference, occurrenceIndex: currentOccurrenceIndex }] : []
      })
      const firstTarget = selectionTargets[0]
      if (!firstTarget) return []

      return [
        <BibleStrongReference
          small={small}
          concordanceFor={concordanceFor}
          book={verse.Livre}
          textStyle={textStyle}
          word={run.word || undefined}
          reference={firstTarget.reference}
          occurrenceIndex={firstTarget.occurrenceIndex}
          selectionTargets={selectionTargets}
          key={`strong-${runIndex}-${selectionTargets.map(target => target.reference).join('-')}`}
        />,
      ]
    }
  )
}

export default CanonicalStrongVerseText
