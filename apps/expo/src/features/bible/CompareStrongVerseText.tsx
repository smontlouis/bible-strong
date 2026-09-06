import { twMerge } from '~common/ui/classNames'

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
}: CompareStrongVerseTextProps) => {
  return (
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
                    className={twMerge(
                      isSelected ? 'bg-primary' : '',
                      isSelected ? 'text-reverse' : 'text-primary',
                      'rounded-[8px] px-[4px] text-[12px]'
                    )}
                    onPress={() => openStrong(identity)}
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
}

export default CompareStrongVerseText
