import { useTheme } from '@emotion/react'
import { useNavigation } from '@react-navigation/native'
import { StackNavigationProp } from '@react-navigation/stack'
import { Asset } from 'expo-asset'
import * as FileSystem from 'expo-file-system'
import { Image } from 'expo-image'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StyleSheet } from 'react-native'
import { Circle as ProgressCircle } from 'react-native-progress'
import { useDispatch, useSelector } from 'react-redux'
import Link from '~common/Link'
import PlanIcon from '~common/PlanIcon'
import { Plan } from '~common/types'
import Box from '~common/ui/Box'
import CircleImage from '~common/ui/CircleImage'
import { FeatherIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  useComputedPlanItems,
  useFireStorage,
  useUpdatePlans,
} from '~features/plans/plan.hooks'
import useLanguage from '~helpers/useLanguage'
import { MainStackProps } from '~navigation/type'
import { addPlan } from '~redux/modules/plan'
import { RootState } from '~redux/modules/reducer'
import { Theme } from '~themes'

const LinkBox = Box.withComponent(Link)

const useGetFirstPlans = () => {
  const hasPlans = useSelector((state: RootState) => state.plan.myPlans.length)
  const isFR = useLanguage()
  const dispatch = useDispatch()

  const getBibleProjectPlan = async () => {
    const [{ localUri }] = await Asset.loadAsync(
      isFR
        ? require('~assets/plans/bible-project-plan.txt')
        : require('~assets/plans/bible-project-plan-en.txt')
    )
    if (!localUri) return
    try {
      const plan: Plan = JSON.parse(
        await FileSystem.readAsStringAsync(localUri)
      )
      dispatch(addPlan(plan))
    } catch (error) {
      console.log(error)
    }
  }

  useEffect(() => {
    if (!hasPlans) {
      ;(async () => {
        await getBibleProjectPlan()
      })()
    }
  }, [])
}
const PlanHome = () => {
  const { t } = useTranslation()
  const plans = useComputedPlanItems()
  const { id, title, image, description, author, progress, status } =
    plans.find(p => p.status === 'Progress') || plans[0] || {}
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
        <Box center size={50} bg="lightPrimary" borderRadius={25}>
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
            params={{ plan: { id, title, image, description, author } }}
            px={20}
          >
            <ProgressCircle
              style={{ marginRight: 15 }}
              size={40}
              progress={progress}
              borderWidth={0}
              color={
                status === 'Completed'
                  ? theme.colors.success
                  : theme.colors.primary
              }
              unfilledColor={theme.colors.lightGrey}
              thickness={2}
              fill="none"
            >
              <Box style={StyleSheet.absoluteFillObject} center>
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
            </ProgressCircle>
            <Box flex justifyContent="center">
              <Paragraph fontFamily="title" scale={-2} scaleLineHeight={-2}>
                {title}
              </Paragraph>
              <Paragraph
                scale={-3}
                scaleLineHeight={-1}
                fontFamily="text"
                color="grey"
              >
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
