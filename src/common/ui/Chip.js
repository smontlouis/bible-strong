import React from 'react'
import styled from '@emotion/native'
import { TouchableOpacity } from 'react-native'

import Text from '~common/ui/Text'

const StyledChip = styled.View(({ theme, isSelected }) => ({
  borderRadius: 20,
  backgroundColor: isSelected
    ? theme.colors.primary
    : theme.colors.lightPrimary,
  paddingTop: 5,
  paddingBottom: 5,
  paddingLeft: 12,
  paddingRight: 12,
  marginRight: 5,
  marginBottom: 5,

  ...(isSelected && {
    shadowColor: theme.colors.default,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 2,
    elevation: 1,
  }),
}))

const StyledText = styled(Text)(({ theme, isSelected }) => ({
  color: isSelected ? 'white' : 'black',
}))

const Chip = ({ label, isSelected, onPress }) => (
  <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
    <StyledChip isSelected={isSelected}>
      <StyledText isSelected={isSelected}>{label}</StyledText>
    </StyledChip>
  </TouchableOpacity>
)

export default Chip
