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
} from '~features/plans/plan.hooks'
import { Theme } from '~themes'

const LinkBox = Box.withComponent(Link)

const PlanHome = () => {
  const plans = useComputedPlanItems()
  const { id, title, image, description, author, progress, status } =
    plans.find(p => p.status === 'Progress') || plans[0]
  const cacheImage = useFireStorage(image)
  const theme: Theme = useTheme()

  return (
    <Box grey>
      <Box row rounded height={80} lightShadow margin={20}>
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
            <Paragraph scale={-3} fontFamily="text" color="grey">
              Continuer ce plan
            </Paragraph>
          </Box>
        </LinkBox>

        <LinkBox
          route="MyPlanList"
          width={80}
          backgroundColor="primary"
          center
          style={{ borderTopRightRadius: 10, borderBottomRightRadius: 10 }}
        >
          <MaterialIcon
            name="playlist-add-check"
            color="white"
            size={30}
            style={{ marginRight: 10 }}
          />
          <Text color="white">Plans</Text>
        </LinkBox>
      </Box>
    </Box>
  )
}

export default PlanHome
