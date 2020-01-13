import React from 'react'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'
import { smallSize } from '~helpers/utils'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Back from '~common/Back'

const HeaderBox = styled(Box)(({ theme, background }) => ({
  height: 60,
  borderBottomColor: theme.colors.border,
  alignItems: 'stretch',
  ...(background && {
    backgroundColor: theme.colors.reverse
  })
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({
  background,
  hasBackButton,
  isModal,
  title,
  fontSize = 20,
  onTitlePress,
  rightComponent,
  ...props
}) => {
  return (
    <HeaderBox background={background} row overflow="visibility" {...props}>
      <Box flex>
        {hasBackButton && (
          <Back padding>
            <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
          </Back>
        )}
      </Box>
      <Box grow center>
        <Text title fontSize={smallSize ? 16 : fontSize} onPress={onTitlePress}>
          {title}
        </Text>
      </Box>
      {rightComponent ? (
        <Box flex justifyContent="center" alignItems="flex-end" overflow="visibility">
          {rightComponent}
        </Box>
      ) : (
        <Box flex />
      )}
    </HeaderBox>
  )
}

export default pure(Header)
