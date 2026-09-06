import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import React from 'react'
import { Image } from 'expo-image'
import { useTranslation } from 'react-i18next'
import Link from '~common/Link'
import Box, { VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useComputedPlanItems } from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'
const LinkBox = (props: React.ComponentProps<typeof Box> & React.ComponentProps<typeof Link>) => (
  <Box
    as={Link}
    {...props}
    className={twMerge(
      'overflow-hidden border-continuous',
      twMerge('overflow-hidden border-continuous', props.className)
    )}
  />
)

const TheBibleProject = () => {
  const stylingTheme = useStylingTheme()

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
    <Box
      className="border-continuous overflow-visible flex-[1] rounded-[20px]"
      style={{
        shadowColor: 'rgb(89,131,240)',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 7,
        elevation: 1,
        overflow: 'visible',
      }}
    >
      <LinkBox
        className="bg-reverse rounded-[20px] flex-[1]"
        route="Plan"
        params={{ planId: id, plan: plan! }}
      >
        <Box className="overflow-hidden border-continuous h-[92px] bg-light-grey">
          <Image
            source={require('~assets/images/home/bible-project-plan.jpg')}
            contentFit="cover"
            style={{ width: '100%', height: '100%' }}
          />
        </Box>
        <VStack className="overflow-hidden border-continuous flex-[1] p-[12px] pr-[48px]">
          <Text
            className="text-[15px] leading-[18px]"
            numberOfLines={2}
            style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
          >
            {t('home.learning.bibleProjectPlan')}
          </Text>
          <Box
            className="overflow-hidden border-continuous absolute right-[10px] bottom-[10px] rounded-[17px] bg-light-primary items-center justify-center"
            style={{ width: 32, height: 32 }}
          >
            <FeatherIcon color="primary" name="chevron-right" size={18} />
          </Box>
        </VStack>
      </LinkBox>
    </Box>
  )
}

export default TheBibleProject
