import { useTheme } from 'emotion-theming'
import React from 'react'
import { StyleSheet } from 'react-native'
import FastImage from 'react-native-fast-image'
import ProgressBar from 'react-native-progress/Bar'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import {
  useComputedPlanItems,
  useFireStorage,
} from '~features/plans/plan.hooks'
import { Theme } from '~themes'
import { FeatherIcon } from '~common/ui/Icon'
import BibleProjectIcon from '~common/BibleProjectIcon'
import { useTranslation } from 'react-i18next'

const LinkBox = Box.withComponent(Link)

const TheBibleProject = () => {
  const { t } = useTranslation()

  const plans = useComputedPlanItems()
  const { id, title, image, description, author, progress, status, subTitle } =
    plans.find(p => p.id === 'bible-project-plan') || {}
  const cacheImage = useFireStorage(image)
  const theme: Theme = useTheme()

  if (!id) {
    return null
  }

  return (
    <Box grey pt={20}>
      <Box lightShadow bg="reverse" rounded height={80} px={20}>
        <LinkBox
          flex
          row
          center
          route="Plan"
          params={{ plan: { id, title, image, description, author } }}
        >
          <Box mr={20} center size={50} bg="lightPrimary" borderRadius={25}>
            <BibleProjectIcon />
          </Box>
          <Box flex justifyContent="center">
            <Text title fontSize={18}>
              {t('The Bible Project')}
            </Text>
            <ProgressBar
              borderWidth={0}
              progress={progress}
              color={theme.colors.primary}
              unfilledColor={theme.colors.opacity5}
              style={{ marginTop: 10 }}
            />
          </Box>
          <Box>
            <FeatherIcon name="chevron-right" size={20} />
          </Box>
        </LinkBox>
      </Box>
    </Box>
  )
}

export default TheBibleProject
