import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import TagList from '~common/TagList'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import truncate from '~helpers/truncate'
import { useMediaQueriesArray } from '~helpers/useMediaQueries'

const StudyLink = styled(Link)(({ theme }) => ({
  position: 'relative',
  flexDirection: 'row',
  margin: 10,
}))

const StudyItem = ({ study, theme, setStudySettings }) => {
  const formattedDate = distanceInWords(Number(study.modified_at), Date.now(), {
    locale: frLocale,
  })
  const r = useMediaQueriesArray()

  return (
    <Box width={r(['50%', '50%', '33%', '33%'])}>
      <StudyLink
        onLongPress={() => setStudySettings(study.id)}
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
        >
          <Text color="darkGrey" fontSize={10}>
            Il y a {formattedDate}
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
                Étude vide
              </Text>
            </>
          )}

          <Box marginTop="auto">
            <TagList limit={1} tags={study.tags} />
          </Box>
        </Box>
      </StudyLink>
    </Box>
  )
}

export default withTheme(StudyItem)
