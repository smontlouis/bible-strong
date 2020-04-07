import React from 'react'
import styled from '@emotion/native'
import * as Animatable from 'react-native-animatable'
import ProgressCircle from 'react-native-progress/Circle'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { MySection, SliceType } from '~common/types'
import ReadingSlice from '../ReadingSlice/ReadingSlice'

const AFeatherIcon = Animatable.createAnimatableComponent(FeatherIcon) as any

const CircleImage = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 2,
  right: 0,
  left: 2,
  bottom: 0,
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: theme.colors.lightPrimary,
}))

const Section = ({
  id,
  title,
  subTitle,
  readingSlices,
  progress,
}: MySection) => {
  const isDefault = id === 'default'
  const [isCollapsed, setIsCollapsible] = React.useState(
    isDefault ? false : true
  )
  return (
    <Box>
      {!isDefault && (
        <Link onPress={() => setIsCollapsible(c => !c)}>
          <Box row paddingLeft={20} paddingVertical={20}>
            <ProgressCircle
              size={38}
              progress={progress}
              borderWidth={0}
              unfilledColor="rgb(230,230,230)"
            >
              <CircleImage />
            </ProgressCircle>

            <Box flex paddingLeft={20}>
              <Text>{title}</Text>
              <Text opacity={0.6}>{subTitle}</Text>
            </Box>
            <Box width={40} center>
              <AFeatherIcon
                duration={500}
                name="chevron-down"
                size={20}
                animation={{
                  from: {
                    rotate: isCollapsed ? '180deg' : '0deg',
                  },
                  to: {
                    rotate: !isCollapsed ? '180deg' : '0deg',
                  },
                }}
              />
            </Box>
          </Box>
          <Border />
        </Link>
      )}
      {!isCollapsed && (
        <Box>
          {readingSlices.map((slice, i) => (
            <ReadingSlice
              key={slice.id}
              id={slice.id}
              description={slice.description}
              slices={slice.slices.filter(f => f.type !== SliceType.Image)}
              status={slice.status}
              isLast={i === readingSlices.length - 1}
            />
          ))}
          <Border />
        </Box>
      )}
    </Box>
  )
}

export default Section
