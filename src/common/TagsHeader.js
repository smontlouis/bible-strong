import React from 'react'
import { Platform } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Back from '~common/Back'

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
  borderBottomColor: theme.colors.border
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({ title, noBorder, setIsOpen, isOpen, selectedChip, hasBackButton }) => {
  return (
    <HeaderBox noBorder={noBorder} row>
      {hasBackButton && (
        <Back padding>
          <FeatherIcon name="arrow-left" size={20} />
        </Back>
      )}
      <Box flex justifyContent="center">
        <Text fontSize={16} bold>
          {title}{' '}
        </Text>
      </Box>
      <TouchableBox onPress={() => setIsOpen(!isOpen)}>
        <StyledText>{selectedChip ? selectedChip.name : 'Tout'}</StyledText>
        <StyledIcon name="chevron-down" size={15} />
      </TouchableBox>
    </HeaderBox>
  )
}

export default pure(Header)
