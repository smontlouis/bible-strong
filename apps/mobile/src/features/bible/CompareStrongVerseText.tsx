import React from 'react'

import type { Verse } from '~common/types'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { buildCanonicalStrongVerseRuns } from '~helpers/canonicalStrongVerse'
import {
  areStrongIdentitiesEqual,
  getStrongReferenceNumber,
  type StrongIdentity,
} from '~helpers/strongIdentities'
import { createStrongSelection, type StrongSelection } from '~helpers/strongSelection'

type CompareStrongVerseTextProps = {
  verse: Verse
  version: string
  selectedStrongReference?: string
  onStrongSelect: (selection: StrongSelection) => void
}

const CompareStrongVerseText = ({
  verse,
  version,
  selectedStrongReference,
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

      const openStrong = (selectedIdentity: StrongIdentity) => {
        const identities = [
          selectedIdentity,
          ...run.identities.filter(
            identity => !areStrongIdentitiesEqual(identity, selectedIdentity)
          ),
        ]
        const selection = createStrongSelection(identities, verse.Livre, version, {
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
        <React.Fragment key={`strong-${index}-${codes}`}>
          {run.word ? `${run.word} ` : ''}
          {run.identities.map((identity, identityIndex) => {
            const isSelected =
              getStrongReferenceNumber(identity.code) ===
              getStrongReferenceNumber(selectedStrongReference ?? '')
            return (
              <React.Fragment key={`${identity.kind}-${identity.code}`}>
                <Text
                  onPress={() => openStrong(identity)}
                  color={isSelected ? 'reverse' : 'primary'}
                  bg={isSelected ? 'primary' : undefined}
                  borderRadius={8}
                  px={4}
                  fontSize={12}
                >
                  {identity.code}
                </Text>
                {identityIndex < run.identities.length - 1 ? ' · ' : ''}
              </React.Fragment>
            )
          })}
        </React.Fragment>
      )
    })}
  </Paragraph>
)

export default CompareStrongVerseText
