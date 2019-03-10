import React from 'react'
import { Platform } from 'react-native'
import { Icon } from 'expo'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Back from '~common/Back'

const Text = styled.Text({
  fontSize: 16,
  fontWeight: 'bold'
})

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: 15,
  paddingRight: 15
}))

const Header = ({ hasBackButton, isModal, title, noBorder }) => {
  return (
    <HeaderBox noBorder={noBorder} row>
      <Box flex justifyContent='center'>
        {hasBackButton && (
          <Back underlayColor='transparent' style={{ marginRight: 15 }}>
            <Icon.AntDesign
              name={isModal ? 'close' : 'arrowleft'}
              size={isModal ? 20 : 20}
              color='black'
            />
          </Back>
        )}
      </Box>
      <Box grow center>
        <Text>{title}</Text>
      </Box>
      <Box flex />
    </HeaderBox>
  )
}

export default pure(Header)
