import React from 'react'

import { ChapterSlice as ChapterSliceProps } from 'src/common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'

import { useChapterToContent } from '../plan.hooks'
import PauseText from './PauseText'

const ChapterSlice = ({ id, chapters, subType }: ChapterSliceProps) => {
  const { status, content } = useChapterToContent(chapters)

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
        {content.chapters.map(chapter => (
          <Box key={chapter.title}>
            <Box marginTop={20} marginBottom={5}>
              <Paragraph scale={-2} color="grey" fontFamily="text">
                {chapter.title.toUpperCase()}
              </Paragraph>
            </Box>
            <Paragraph>
              {chapter.verses.map(c => {
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
        ))}
      </Box>
    )
  }

  return null
}

export default ChapterSlice
