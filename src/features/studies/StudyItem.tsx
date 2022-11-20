import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'

import { withTheme } from '@emotion/react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import TagList from '~common/TagList'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import truncate from '~helpers/truncate'
import { FeatherIcon } from '~common/ui/Icon'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'

export const LinkBox = Box.withComponent(Link)

const StudyLink = styled(Link)(({ theme }) => ({
  position: 'relative',
  flexDirection: 'row',
  margin: 10,
}))

const StudyItem = ({ study, theme, setStudySettings }) => {
  const { t } = useTranslation()
  const isFR = useLanguage()

  const formattedDate = distanceInWords(Number(study.modified_at), Date.now(), {
    locale: isFR ? fr : enGB,
  })
  const r = useMediaQueriesArray()

  return (
    <Box width={r(['50%', '50%', '33%', '33%'])}>
      <StudyLink
        key={study.id}
        route="EditStudy"
        params={{ studyId: study.id }}
      >
        <Box
          flex
          backgroundColor="reverse"
          lightShadow
          padding={10}
          height={230}
          borderRadius={8}
          position="relative"
        >
          <Text color="darkGrey" fontSize={10} marginTop={10}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </Text>
          {study.content ? (
            <>
              <Text bold scale={-2} marginTop={4}>
                {study.title}
              </Text>

              <Paragraph marginTop={10} scale={-3}>
                {truncate(deltaToPlainText(study.content.ops), 80)}
              </Paragraph>
            </>
          ) : (
            <>
              <Text bold scale={-2} marginTop={4} color="border">
                {t('Étude vide')}
              </Text>
            </>
          )}

          <Box marginTop="auto">
            <TagList limit={1} tags={study.tags} />
          </Box>
          {!!setStudySettings && (
            <LinkBox
              position="absolute"
              right={0}
              top={0}
              p={10}
              onPress={() => setStudySettings(study.id)}
            >
              <FeatherIcon color="tertiary" name="more-vertical" size={20} />
            </LinkBox>
          )}
        </Box>
      </StudyLink>
    </Box>
  )
}

export default withTheme(StudyItem)
