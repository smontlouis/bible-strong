import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import BibleProjectIcon from '~common/BibleProjectIcon'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'
import { Theme } from '~themes'

const LinkBox = Box.withComponent(Link)

const TheBibleProject = () => {
  const { t } = useTranslation()
  const isFR = useLanguage()

  const plans = useComputedPlanItems()
  const { id, title, image, description, author, progress } =
    plans.find(
      p => p.id === (isFR ? 'bible-project-plan' : 'bible-project-plan-en')
    ) || {}
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
            <Text title fontSize={18} mb={10}>
              {t('The Bible Project')}
            </Text>
            <ProgressBar progress={progress || 0} />
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
