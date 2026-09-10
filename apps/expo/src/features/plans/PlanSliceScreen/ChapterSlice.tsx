import { getUniverseColor } from '~themes/universeColors'
import React from 'react'
import { ChapterSlice as ChapterSliceProps } from 'src/common/types'
import Box from '~common/ui/Box'
import Link from '~common/Link'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import { useChapterToContent } from '../plan.hooks'
import PauseText from './PauseText'
import Loading from '~common/Loading'
import { useTranslation } from 'react-i18next'
const ChapterSlice = ({ id, chapters, subType }: ChapterSliceProps) => {
  const { t } = useTranslation()
  const { status, content } = useChapterToContent(chapters)

  if (status === 'Pending') {
    return (
      <Box className="overflow-hidden border-continuous h-[200px]">
        <Loading />
      </Box>
    )
  }

  if (status === 'Rejected') {
    return (
      <Box className="overflow-hidden border-continuous items-center justify-center p-[20px]">
        <Paragraph scaleLineHeight={1}>
          {t("Il semblerait que ce chapitre n'existe pas dans cette version.")}
        </Paragraph>
      </Box>
    )
  }

  if (content) {
    return (
      <Box className="overflow-hidden border-continuous p-[20px]">
        {subType === 'pray' && (
          <PauseText>
            {t('Entrez dans un temps de prière\n et méditez sur le psaume\nsuivant')}
          </PauseText>
        )}
        <Box className="overflow-hidden border-continuous">
          <Paragraph scale={5}>{content.bookName}</Paragraph>
        </Box>
        {content.chapters.map(chapter => (
          <Box className="overflow-hidden border-continuous" key={chapter.title}>
            <Box className="overflow-hidden border-continuous mt-[20px] mb-[5px]">
              <Paragraph className="text-grey" scale={-2} fontFamily="text">
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
                        <Paragraph scaleLineHeight={1}>
                          {c.Texte}
                          {isLast ? '' : ' '}
                        </Paragraph>
                      </React.Fragment>
                    )
                  })}
                </Paragraph>
                <Link {...chapter.viewMore} style={{ marginBottom: 50 }}>
                  <Box className="overflow-hidden border-continuous flex-row items-center justify-end">
                    <FeatherIcon
                      name="book-open"
                      size={15}
                      style={{ marginRight: 10 }}
                      color={getUniverseColor('bible')}
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
