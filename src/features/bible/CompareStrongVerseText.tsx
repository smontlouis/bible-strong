import React from 'react'

import type { Verse } from '~common/types'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { buildCanonicalStrongVerseRuns } from '~helpers/canonicalStrongVerse'
import { createStrongSelection, type StrongSelection } from '~helpers/strongSelection'

type CompareStrongVerseTextProps = {
  verse: Verse
  version: string
  onStrongSelect: (selection: StrongSelection) => void
}

const CompareStrongVerseText = ({
  verse,
  version,
  onStrongSelect,
}: CompareStrongVerseTextProps) => (
  <Paragraph scale={-1}>
    {buildCanonicalStrongVerseRuns(verse.Texte, verse.StrongSpans).map((run, index) => {
      if (run.kind === 'text') {
        return (
          <React.Fragment key={`text-${index}`}>
            {run.text.replace(/\s*\n\s*/gu, ' ')}
          </React.Fragment>
        )
      }

      const openStrong = () => {
        const selection = createStrongSelection(run.identities, verse.Livre, version, {
          occurrenceId: `${version}-${verse.Livre}-${verse.Chapitre}-${verse.Verset}-${index}`,
          word: run.contextWord ?? run.word,
          chapter: verse.Chapitre,
          verse: verse.Verset,
          morphologies: run.morphologies,
        })
        if (selection) onStrongSelect(selection)
      }
      const codes = run.identities.map(identity => identity.code).join(' · ')

      return (
        <Text key={`strong-${index}-${codes}`} onPress={openStrong} color="primary">
          {run.word ? `${run.word} ` : ''}
          <Text color="primary" fontSize={12}>
            {codes}
          </Text>
        </Text>
      )
    })}
  </Paragraph>
)

export default CompareStrongVerseText
