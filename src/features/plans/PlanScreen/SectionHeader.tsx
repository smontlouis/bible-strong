import React from 'react'
import { useTheme } from 'emotion-theming'
import * as Animatable from 'react-native-animatable'
import ProgressCircle from 'react-native-progress/Circle'
import FastImage from 'react-native-fast-image'

import styled from '~styled'
import Link from '~common/Link'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { ComputedSection } from '~common/types'
import { Theme } from '~themes'

const AFeatherIcon = Animatable.createAnimatableComponent(FeatherIcon) as any

const CircleImage = styled(Box)(() => ({
  position: 'absolute',
  top: 2,
  right: 0,
  left: 2,
  bottom: 0,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: '#F4F7FF',
}))

const Section = ({
  id,
  title,
  subTitle,
  progress,
  toggle,
  isCollapsed,
  image,
}: Omit<ComputedSection, 'data'> & {
  toggle: (id: string) => void
  isCollapsed: boolean
}) => {
  const theme: Theme = useTheme()
  return (
    <Link onPress={() => toggle(id)}>
      <Box row paddingLeft={20} paddingVertical={20} backgroundColor="reverse">
        <ProgressCircle
          size={38}
          progress={progress}
          borderWidth={0}
          color={progress === 1 ? theme.colors.success : theme.colors.primary}
          unfilledColor={progress ? 'rgb(230,230,230)' : undefined}
        >
          <CircleImage center>
            {image && (
              <FastImage
                style={{ width: 26, height: 26 }}
                source={{
                  uri: image,
                }}
              />
            )}
          </CircleImage>
        </ProgressCircle>

        <Box flex paddingLeft={20}>
          <Text>{title}</Text>
          <Text opacity={0.6}>{subTitle}</Text>
        </Box>
        <Box width={40} center>
          <AFeatherIcon
            color="grey"
            duration={500}
            name="chevron-down"
            size={17}
            animation={{
              from: {
                rotate: !isCollapsed ? '180deg' : '0deg',
              },
              to: {
                rotate: isCollapsed ? '180deg' : '0deg',
              },
            }}
          />
        </Box>
      </Box>
      <Border />
    </Link>
  )
}

export default Section
