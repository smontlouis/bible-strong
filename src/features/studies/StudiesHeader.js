import React from 'react'
import { Platform, ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'

const TouchableBox = styled.TouchableOpacity({
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 15,
  paddingVertical: 15
})

const StyledText = styled(Text)({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5
})

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: 15,
  paddingRight: 15
  // width: theme.measures.maxWidth,
  // marginLeft: 'auto',
  // marginRight: 'auto'
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({ noBorder, setIsOpen, isOpen, selectedChip }) => {
  return (
    <HeaderBox noBorder={noBorder} row>
      <TouchableBox onPress={() => setIsOpen(!isOpen)}>
        <StyledText>
          {selectedChip ? selectedChip.name : 'Tout'}
        </StyledText>
        <StyledIcon name='chevron-down' size={15} />
      </TouchableBox>
    </HeaderBox>
  )
}

export default pure(Header)
