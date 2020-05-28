import { useTheme } from 'emotion-theming'
import React from 'react'
import { StyleSheet } from 'react-native'
import FastImage from 'react-native-fast-image'
import ProgressCircle from 'react-native-progress/Circle'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import CircleImage from '~common/ui/CircleImage'
import { MaterialIcon } from '~common/ui/Icon'
import Paragraph from '~common/ui/Paragraph'
import Text from '~common/ui/Text'
import {
  useComputedPlanItems,
  useFireStorage,
  useUpdatePlans,
} from '~features/plans/plan.hooks'
import { Theme } from '~themes'
import { LinearGradient } from 'expo-linear-gradient'
import PlanIcon from '~common/PlanIcon'

const LinkBox = Box.withComponent(Link)

const color1 = 'rgb(69,150,220)'
const color2 = 'rgb(89,131,240)'

const PlanHome = () => {
  const plans = useComputedPlanItems()
  const { id, title, image, description, author, progress, status } =
    plans.find(p => p.status === 'Progress') || plans[0] || {}
  const cacheImage = useFireStorage(image)
  const theme: Theme = useTheme()

  useUpdatePlans()

  return (
    <Box grey px={20} bg="red" pt={30}>
      <LinkBox
        route="Plans"
        backgroundColor="primary"
        rounded
        lightShadow
        row
        p={20}
        pl={30}
        height={100}
        position="relative"
        overflow="hidden"
      >
        <Box
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 0,
            height: 100,
            borderRadius: 10,
          }}
        >
          <LinearGradient
            start={[0.1, 0.2]}
            style={{ height: 130 }}
            colors={[color1, color2]}
          />
        </Box>
        <Box
          center
          size={50}
          mb={20}
          bg="rgba(255, 255, 255, 0.2)"
          borderRadius={25}
        >
          <PlanIcon style={{ marginTop: 5 }} color="white" size={32} />
        </Box>
        <Text title fontSize={17} color="white" ml={20} mt={15}>
          Plans & Méditations
        </Text>
      </LinkBox>
      <Box rounded height={60} bg="reverse" lightShadow mx={20} mt={-20}>
        {id ? (
          <LinkBox
            flex
            row
            center
            route="Plan"
            params={{ plan: { id, title, image, description, author } }}
          >
            <ProgressCircle
              style={{ marginHorizontal: 15 }}
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
            >
              <Box style={StyleSheet.absoluteFillObject} center>
                <CircleImage size={35} center>
                  {cacheImage && (
                    <FastImage
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
                Continuer ce plan
              </Paragraph>
            </Box>
          </LinkBox>
        ) : (
          <Box flex center>
            <Text color="grey">Vous n'avez aucun plan</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
}

export default PlanHome
