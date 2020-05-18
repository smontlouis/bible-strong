import React from 'react'

import { VerseSlice as VerseSliceProps } from 'src/common/types'
import Box from '~common/ui/Box'
import Paragraph from '~common/ui/Paragraph'

import { useVersesToContent } from '~features/plans/plan.hooks'
import Loading from '~common/Loading'
import { FeatherIcon } from '~common/ui/Icon'
import Link from '~common/Link'

const EventDetailVerse = ({ verses }: VerseSliceProps) => {
  const { status, content } = useVersesToContent(verses)

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

  if (status === 'Resolved' && content) {
    return (
      <Link {...content.viewMore}>
        <Box pb={20}>
          <Box>
            <Paragraph fontFamily="title" scale={-1} color="grey">
              {content.bookName}
            </Paragraph>
          </Box>
          <Paragraph>
            {content.verses.map(c => {
              const { h1, h2, h3, h4 } = c.Pericope
              return (
                <React.Fragment key={`${c.Verset}`}>
                  {h1 && (
                    <Paragraph scale={1.5}>
                      {h1}
                      {'\n\n'}
                    </Paragraph>
                  )}
                  {h2 && (
                    <Paragraph scale={1.3}>
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
                  <Paragraph scale={-1} scaleLineHeight={1}>
                    {c.Texte.replace(/\n/g, '')}
                  </Paragraph>
                </React.Fragment>
              )
            })}
          </Paragraph>
        </Box>
      </Link>
    )
  }

  return null
}

export default EventDetailVerse
