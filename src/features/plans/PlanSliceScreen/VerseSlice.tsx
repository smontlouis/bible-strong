import React from 'react'

import { VerseSlice as VerseSliceProps } from 'src/common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'

import { useVersesToContent } from '../plan.hooks'
import PauseText from './PauseText'

const VerseSlice = ({ id, verses, subType }: VerseSliceProps) => {
  const { status, content } = useVersesToContent(verses)
  if (status === 'Resolved' && content) {
    return (
      <Box padding={20}>
        {subType === 'pray' && (
          <PauseText>
            {
              'Entrez dans un temps de prière\n et méditez sur le psaume\nsuivant'
            }
          </PauseText>
        )}
        <Box>
          <Paragraph scale={5}>{content.bookName}</Paragraph>
        </Box>
        <Paragraph>
          {content.verses.map(c => {
            const { h1, h2, h3, h4 } = c.Pericope
            return (
              <React.Fragment key={`${c.Verset}`}>
                {h1 && (
                  <Paragraph scale={3}>
                    {h1}
                    {'\n\n'}
                  </Paragraph>
                )}
                {h2 && (
                  <Paragraph scale={2}>
                    {h2}
                    {'\n\n'}
                  </Paragraph>
                )}
                {h3 && (
                  <Paragraph scale={1}>
                    {h3}
                    {'\n\n'}
                  </Paragraph>
                )}
                {h4 && (
                  <Paragraph>
                    {h4}
                    {'\n\n'}
                  </Paragraph>
                )}
                {/* <Paragraph>{c.Verset}</Paragraph> */}
                <Paragraph scaleLineHeight={1}>{c.Texte} </Paragraph>
              </React.Fragment>
            )
          })}
        </Paragraph>
      </Box>
    )
  }

  return null
}

export default VerseSlice
