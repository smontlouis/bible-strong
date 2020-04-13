import React from 'react'

import { ChapterSlice as ChapterSliceProps } from 'src/common/types'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'

import { useChapterToContent } from '../plan.hooks'
import PauseText from './PauseText'
import Loading from '~common/Loading'

const ChapterSlice = ({ id, chapters, subType }: ChapterSliceProps) => {
  const { status, content } = useChapterToContent(chapters)

  if (status === 'Pending') {
    return (
      <Box height={200}>
        <Loading />
      </Box>
    )
  }

  if (status === 'Rejected') {
    return (
      <Box center padding={20}>
        <Paragraph scaleLineHeight={1}>
          Il semblerait que ce chapitre n'existe pas dans cette version.
        </Paragraph>
      </Box>
    )
  }

  if (content) {
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
            {status === 'Resolved' && (
              <>
                <Paragraph>
                  {chapter.verses.map((c, i) => {
                    const isLast = i === chapter.verses.length - 1
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
                        <Paragraph scaleLineHeight={1}>
                          {c.Texte}
                          {isLast ? '' : ' '}
                        </Paragraph>
                      </React.Fragment>
                    )
                  })}
                </Paragraph>
                <Link {...chapter.viewMore} style={{ marginBottom: 50 }}>
                  <Box row center justifyContent="flex-end">
                    <FeatherIcon
                      name="book-open"
                      size={15}
                      style={{ marginRight: 10 }}
                      color="grey"
                    />
                    <FeatherIcon name="chevron-right" color="grey" />
                  </Box>
                </Link>
              </>
            )}
          </Box>
        ))}
      </Box>
    )
  }

  return null
}

export default ChapterSlice
