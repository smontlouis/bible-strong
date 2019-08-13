import React from 'react'
import styled from '@emotion/native'
import distanceInWords from 'date-fns/distance_in_words'
import frLocale from 'date-fns/locale/fr'
import * as Icon from '@expo/vector-icons'
import { withTheme } from 'emotion-theming'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Link from '~common/Link'
import TagList from '~common/TagList'

const StudyLink = styled(Link)(({ theme }) => ({
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1
}))

const StudyItem = ({ study, theme, setStudySettings }) => {
  const formattedDate = distanceInWords(Number(study.modified_at), Date.now(), { locale: frLocale })

  return (
    <StudyLink key={study.id} route='EditStudy' params={{ studyId: study.id }}>
      <Box row justifyContent='space-between'>
        <Text color='darkGrey' fontSize={12}>
            Modifié il y a {formattedDate}
        </Text>
        <Box row>
          <Icon.Feather
            name={'more-vertical'}
            size={20}
            color={theme.colors.tertiary}
            onPress={() => setStudySettings(study.id)}
          />
        </Box>
      </Box>
      <Box>
        <Text bold scale={-2}>
          {study.title}
        </Text>
        <TagList tags={study.tags} />
      </Box>
    </StudyLink>
  )
}

export default withTheme(StudyItem)
