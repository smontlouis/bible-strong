import React from 'react'
import styled from '@emotion/native'
import Collapsible from 'react-native-collapsible'
import * as Animatable from 'react-native-animatable'

import Link from '~common/Link'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { MySection } from '~common/types'
import ReadingSlice from '../ReadingSlice/ReadingSlice'

const AFeatherIcon = Animatable.createAnimatableComponent(FeatherIcon) as any

const CircleImage = styled(Box)(() => ({
  width: 34,
  height: 34,
  borderRadius: 17,
  backgroundColor: 'blue',
}))

const Section = ({ id, title, subTitle, readingSlices }: MySection) => {
  const isDefault = id === 'default'
  const [isCollapsed, setIsCollapsible] = React.useState(
    isDefault ? false : true
  )
  return (
    <Box>
      {!isDefault && (
        <Link onPress={() => setIsCollapsible(c => !c)}>
          <Box row paddingLeft={20} paddingVertical={20}>
            <CircleImage />
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
      <Collapsible collapsed={isCollapsed}>
        {readingSlices.map((slice, i) => (
          <ReadingSlice
            key={slice.id}
            id={slice.id}
            description={slice.description}
            slices={slice.slices}
            isComplete={slice.isComplete}
            isLast={i === readingSlices.length - 1}
          />
        ))}
        <Border />
      </Collapsible>
    </Box>
  )
}

export default Section
