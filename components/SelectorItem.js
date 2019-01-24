import React from 'react'
import styled from '@emotion/native'
import { pure } from 'recompose'

const TouchableOpacity = styled.TouchableOpacity(({ isSelected, theme }) => ({
  width: 50,
  height: 50,
  margin: 3,
  borderRadius: 8,
  alignItems: 'center',
  justifyContent: 'center',
  alignSelf: 'flex-start',
  backgroundColor: isSelected ? theme.colors.primary : theme.colors.white
}))

const Text = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? 'white' : 'black',
  fontSize: 16,
  backgroundColor: 'transparent'
}))

const SelectorItem = ({ item, isSelected, onChange }) => (
  <TouchableOpacity onPress={() => onChange(item)} isSelected={isSelected}>
    <Text isSelected={isSelected}>{item}</Text>
  </TouchableOpacity>
)

export default pure(SelectorItem)
