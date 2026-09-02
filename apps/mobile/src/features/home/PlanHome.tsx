import { useTheme } from '@emotion/react'
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

const LinkBox = Box.withComponent(Link)

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
const PlanHome = () => {
  const { t } = useTranslation()
  const plans = useComputedPlanItems()
  const currentPlan = plans.find(p => p.status === 'Progress') || plans[0]
  const { id, title, image, progress, status } = currentPlan || {}
  const cacheImage = useFireStorage(image)
  const theme: Theme = useTheme()

  useUpdatePlans()
  useGetFirstPlans()

  return (
    <Box bg="lightGrey" px={20} pt={20}>
      <LinkBox
        route="Plans"
        rounded
        lightShadow
        bg="reverse"
        row
        p={20}
        pl={20}
        height={80}
        position="relative"
        overflow="hidden"
        alignItems="center"
      >
        <Box center size={50} bg="lightPrimary" borderRadius={10}>
          <PlanIcon style={{ marginTop: 5 }} color="primary" size={32} />
        </Box>
        <Text flex title fontSize={18} color="default" ml={20}>
          {t('Plans & Méditations')}
        </Text>
        <Box>
          <FeatherIcon color="default" name="chevron-right" size={20} />
        </Box>
      </LinkBox>
      <Box rounded height={60} bg="reverse" lightShadow mt={10}>
        {id ? (
          <LinkBox
            flex
            row
            center
            route="Plan"
            params={{ planId: id!, plan: currentPlan! }}
            px={20}
          >
            <PlanProgressCircle
              size={40}
              progress={progress}
              color={status === 'Completed' ? theme.colors.success : theme.colors.primary}
              unfilledColor={theme.colors.lightGrey}
              thickness={2}
            >
              <Box style={StyleSheet.absoluteFill} center>
                <CircleImage size={35} center>
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
            <Box flex justifyContent="center" ml={15}>
              <Paragraph fontFamily="title" scale={-2} scaleLineHeight={-2}>
                {title}
              </Paragraph>
              <Paragraph scale={-3} scaleLineHeight={-1} fontFamily="text" color="grey">
                {t('Continuer ce plan')}
              </Paragraph>
            </Box>
            <Box>
              <FeatherIcon color="default" name="chevron-right" size={20} />
            </Box>
          </LinkBox>
        ) : (
          <Box flex center>
            <Text color="grey">{t("Vous n'avez aucun plan")}</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default PlanHome
