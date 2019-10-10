import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/formatDistance'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Spacer from '~common/ui/Spacer'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import Link from '~common/Link'
import TagList from '~common/TagList'
import { deltaToPlainText } from '~helpers/deltaToPlainText'
import truncate from '~helpers/truncate'

const StudyLink = styled(Link)(({ theme }) => ({
  marginHorizontal: 20,
  paddingVertical: 20,
  paddingHorizontal: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  position: 'relative',
  flexDirection: 'row'
}))

const StudyItem = ({ study, theme, setStudySettings }) => {
  const formattedDate = distanceInWords(Number(study.modified_at), Date.now(), { locale: frLocale })

  return (
    <StudyLink key={study.id} route="EditStudy" params={{ studyId: study.id }}>
      <Box flex>
        <Text color="darkGrey" fontSize={12}>
          Modifié il y a {formattedDate}
        </Text>
        <Text bold scale={-2} marginTop={4}>
          {study.title}
        </Text>
        {study.content && (
          <Paragraph marginTop={10} scale={-3}>
            {truncate(deltaToPlainText(study.content.ops), 180)}
          </Paragraph>
        )}
        <Spacer size={1 / 2} />
        <TagList tags={study.tags} />
      </Box>
      {setStudySettings && (
        <Link onPress={() => setStudySettings(study.id)} padding>
          <Icon.Feather name="more-vertical" size={20} color={theme.colors.tertiary} />
        </Link>
      )}
    </StudyLink>
  )
}

export default withTheme(StudyItem)
