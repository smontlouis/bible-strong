import React from 'react'
import { Platform } from 'react-native'
import { Icon } from 'expo'
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

const Header = ({ hasBackButton, isModal, title, noBorder }) => {
  return (
    <HeaderBox noBorder={noBorder} row>
      <Box flex justifyContent='center'>
        {hasBackButton && (
          <Back underlayColor='transparent' style={{ marginRight: 15 }}>
            <FeatherIcon
              name={isModal ? 'x' : 'arrow-left'}
              size={20}
            />
          </Back>
        )}
      </Box>
      <Box grow center>
        <Text fontSize={16} bold>{title}</Text>
      </Box>
      <Box flex />
    </HeaderBox>
  )
}

export default pure(Header)
