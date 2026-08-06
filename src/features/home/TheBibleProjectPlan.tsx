import React from 'react'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'

const LinkBox = Box.withComponent(Link)

const TheBibleProject = () => {
  const { t } = useTranslation()
  const lang = useLanguage()

  const plans = useComputedPlanItems()
  const plan = plans.find(
    p => p.id === (lang === 'fr' ? 'bible-project-plan' : 'bible-project-plan-en')
  )
  const { id } = plan || {}
  if (!id) {
    return null
  }

  return (
    <Box flex borderRadius={20} lightShadow overflow="visible">
      <LinkBox flex rounded bg="reverse" route="Plan" params={{ planId: id, plan: plan! }}>
        <Box height={92} bg="lightGrey">
          <Image
            source={require('~assets/images/home/bible-project-plan.jpg')}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
        <VStack flex p={12} pr={48}>
          <Text title fontSize={15} lineHeight={18} numberOfLines={2}>
            {t('home.learning.bibleProjectPlan')}
          </Text>
          <Box
            pos="absolute"
            right={10}
            bottom={10}
            size={32}
            borderRadius={17}
            bg="lightPrimary"
            center
          >
            <FeatherIcon color="primary" name="chevron-right" size={18} />
          </Box>
        </VStack>
      </LinkBox>
    </Box>
  )
}

export default TheBibleProject
