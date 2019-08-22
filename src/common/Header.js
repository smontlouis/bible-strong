import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Back from '~common/Back'

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: 15,
  paddingRight: 15
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({ hasBackButton, isModal, title, onTitlePress, noBorder, rightComponent }) => {
  return (
    <HeaderBox noBorder={noBorder} row overflow="visibility">
      <Box flex justifyContent="center">
        {hasBackButton && (
          <Back style={{ marginRight: 15 }}>
            <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
          </Back>
        )}
      </Box>
      <Box grow center>
        <Text fontSize={16} onPress={onTitlePress} bold>
          {title}
        </Text>
      </Box>
      {rightComponent ? (
        <Box flex alignItems="flex-end" overflow="visibility">
          {rightComponent}
        </Box>
      ) : (
        <Box flex />
      )}
    </HeaderBox>
  )
}

export default pure(Header)
