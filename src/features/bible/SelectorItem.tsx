import styled from '@emotion/native'
import React from 'react'
import { pure } from 'recompose'

import { wp } from '~helpers/utils'

const TouchableOpacity = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'center',
  justifyContent: 'center',
  height: 45,
  width: wp(99) / 5,
}))

const Text = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : theme.colors.default,
  fontWeight: isSelected ? 'bold' : 'normal',
  fontSize: 16,
}))

const SelectorItem = ({ item, isSelected, onChange }) => (
  <TouchableOpacity onPress={() => onChange(item)}>
    <Text isSelected={isSelected}>{item}</Text>
  </TouchableOpacity>
)

export default pure(SelectorItem)
