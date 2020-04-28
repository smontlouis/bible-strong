import React from 'react'
import * as Icon from '@expo/vector-icons'
import styled from '~styled'

import Box from '~common/ui/Box'
import Link from '~common/Link'
import Text from '~common/ui/Text'
import Back from '~common/Back'
import { getStatusBarHeight } from 'react-native-iphone-x-helper'

const HeaderBox = styled(Box)(({ theme }) => ({
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  height: 60,
  paddingTop: getStatusBarHeight(),
  borderBottomColor: theme.colors.border,
  alignItems: 'stretch',
  zIndex: 1,
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface Props {
  title: string
  fontSize?: number
  hasBackButton?: boolean
  onPress: () => void
}

const TimelineHeader = ({
  title,
  fontSize = 20,
  hasBackButton,
  onPress,
}: Props) => {
  return (
    <HeaderBox row>
      <Box flex center>
        {hasBackButton && (
          <Back padding>
            <FeatherIcon name={'grid'} size={20} />
          </Back>
        )}
      </Box>
      <Box grow center>
        <Text title fontSize={fontSize}>
          {title}
        </Text>
      </Box>
      <Box flex center>
        <Link paddingSmall onPress={onPress}>
          <FeatherIcon name="info" size={20} />
        </Link>
      </Box>
    </HeaderBox>
  )
}

export default TimelineHeader
