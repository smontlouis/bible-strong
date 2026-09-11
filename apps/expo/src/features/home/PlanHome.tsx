import { getUniverseColor } from '~themes/universeColors'
import { resolveFontFamily } from '~themes/styleValues'
import { useTheme as useStylingTheme, useTheme } from '~themes/ThemeProvider'
import { twMerge } from '~common/ui/classNames'
import { Asset } from 'expo-asset'
import { Image } from 'expo-image'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Platform, StyleSheet } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import PlanIcon from '~common/PlanIcon'
import { Plan } from '~common/types'
import Box from '~common/ui/Box'
import CircleImage from '~common/ui/CircleImage'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import { useComputedPlanItems, useFireStorage, useUpdatePlans } from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'
import { addPlan } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { Theme } from '~themes'
import PlanProgressCircle from './PlanProgressCircle'
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

const readResponseText = async (response: Response): Promise<string> => {
  if (!response.ok) {
    throw new Error(`Failed to load bundled plan: HTTP ${response.status}`)
  }
  return response.text()
}

const loadBibleProjectPlan = async (lang: string): Promise<Plan | undefined> => {
  const [asset] = await Asset.loadAsync(
    lang === 'fr'
      ? // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan.txt')
      : // eslint-disable-next-line @typescript-eslint/no-require-imports
        require('~assets/plans/bible-project-plan-en.txt')
  )

  let serialized: string | undefined
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri)
    serialized = await readResponseText(response)
  } else if (asset.localUri) {
    const FileSystem = await import('expo-file-system/legacy')
    serialized = await FileSystem.readAsStringAsync(asset.localUri)
  }

  return serialized ? (JSON.parse(serialized) as Plan) : undefined
}

const useGetFirstPlans = () => {
  const hasPlans = useSelector((state: RootState) => state.plan.myPlans.length)
  const lang = useLanguage()
  const dispatch = useDispatch()

  const getBibleProjectPlan = async () => {
    try {
      const plan = await loadBibleProjectPlan(lang)
      if (!plan) return
      dispatch(addPlan(plan))
    } catch (error) {
      console.log('[Home] Error loading plan:', error)
    }
  }

  useEffect(() => {
    if (!hasPlans) {
      ;(async () => {
        await getBibleProjectPlan()
      })()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}
const PlanHome = ({ compact = false }: { compact?: boolean }) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const plans = useComputedPlanItems()
  const currentPlan = plans.find(p => p.status === 'Progress') || plans[0]
  const { id, title, image, progress, status } = currentPlan || {}
  const cacheImage = useFireStorage(image)
  const theme: Theme = useTheme()

  useUpdatePlans()
  useGetFirstPlans()

  if (compact) {
    const percent = Math.round(Math.max(0, Math.min(1, progress ?? 0)) * 100)
    return (
      <Box className="gap-[20px]">
        <Box className="flex-row flex-wrap items-center justify-between gap-[12px]">
          <Text className="font-bold text-[16px]">{t('home.dashboard.currentPlan')}</Text>
        </Box>
        {id && currentPlan ? (
          <LinkBox route="Plan" params={{ planId: id, plan: currentPlan }} className="gap-[20px]">
            <Box className="flex-row items-center gap-[16px]">
              <Box className="w-[80px] h-[80px] rounded-[12px] bg-light-primary overflow-hidden items-center justify-center">
                {cacheImage ? (
                  <Image
                    source={{ uri: cacheImage }}
                    contentFit="cover"
                    style={{ width: '100%', height: '100%' }}
                    accessible={false}
                  />
                ) : (
                  <FeatherIcon name="book-open" size={32} color={getUniverseColor('bible')} />
                )}
              </Box>
              <Box className="flex-1 gap-[10px]">
                <Text className="text-[16px] font-bold">{title}</Text>
                <Text className="text-grey text-[12px]">
                  {t('home.dashboard.planProgress', { percent })}
                </Text>
                <Box
                  accessibilityRole="progressbar"
                  accessibilityValue={{ min: 0, max: 100, now: percent }}
                  className="h-[5px] rounded-full bg-light-primary overflow-hidden"
                >
                  <Box
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${percent}%` }}
                  />
                </Box>
              </Box>
              <Box className="bg-light-primary rounded-full w-[28px] h-[28px] shrink-0 self-end items-center justify-center">
                <FeatherIcon name="chevron-right" size={17} color="primary" />
              </Box>
            </Box>
          </LinkBox>
        ) : (
          <Text className="text-grey text-[13px]">{t("Vous n'avez aucun plan")}</Text>
        )}
      </Box>
    )
  }

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey px-[20px] pt-[20px]">
      <LinkBox
        className="p-[20px] pl-[20px] h-[80px] relative items-center bg-reverse flex-row rounded-[20px] overflow-visible"
        route="Plans"
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        <Box
          className="overflow-hidden border-continuous items-center justify-center bg-light-primary rounded-[10px]"
          style={{ width: 50, height: 50 }}
        >
          <PlanIcon style={{ marginTop: 5 }} color="primary" size={32} />
        </Box>
        <Text
          className="flex-[1] text-[18px] text-default ml-[20px]"
          style={{ fontFamily: resolveFontFamily(stylingTheme.fontFamily.title) }}
        >
          {t('Plans & Méditations')}
        </Text>
        <Box className="overflow-hidden border-continuous">
          <FeatherIcon color="default" name="chevron-right" size={20} />
        </Box>
      </LinkBox>
      <Box
        className="overflow-hidden border-continuous rounded-[20px] h-[60px] bg-reverse mt-[10px]"
        style={{
          shadowColor: 'rgb(89,131,240)',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 7,
          elevation: 1,
          overflow: 'visible',
        }}
      >
        {id ? (
          <LinkBox
            className="px-[20px] items-center justify-center flex-row flex-[1]"
            route="Plan"
            params={{ planId: id!, plan: currentPlan! }}
          >
            <PlanProgressCircle
              size={40}
              progress={progress}
              color={status === 'Completed' ? theme.colors.success : theme.colors.primary}
              unfilledColor={theme.colors.lightGrey}
              thickness={2}
            >
              <Box
                className="overflow-hidden border-continuous items-center justify-center"
                style={StyleSheet.absoluteFill}
              >
                <CircleImage className="items-center justify-center" size={35}>
                  {cacheImage && (
                    <Image
                      style={{ width: 35, height: 35 }}
                      source={{
                        uri: cacheImage,
                      }}
                    />
                  )}
                </CircleImage>
              </Box>
            </PlanProgressCircle>
            <Box className="overflow-hidden border-continuous flex-[1] justify-center ml-[15px]">
              <Paragraph fontFamily="title" scale={-2} scaleLineHeight={-2}>
                {title}
              </Paragraph>
              <Paragraph className="text-grey" scale={-3} scaleLineHeight={-1} fontFamily="text">
                {t('Continuer ce plan')}
              </Paragraph>
            </Box>
            <Box className="overflow-hidden border-continuous">
              <FeatherIcon color="default" name="chevron-right" size={20} />
            </Box>
          </LinkBox>
        ) : (
          <Box className="overflow-hidden border-continuous flex-[1] items-center justify-center">
            <Text className="text-grey">{t("Vous n'avez aucun plan")}</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default PlanHome
