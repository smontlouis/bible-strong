import styled from '@emotion/native'
import React, { memo } from 'react'

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

type Props = {
  item: number
  isSelected?: boolean
  onChange: (item: number) => void
  onLongChange?: (item: number) => void
}

const SelectorItem = ({ item, isSelected, onChange, onLongChange }: Props) => (
  <TouchableOpacity
    onPress={() => onChange(item)}
    onLongPress={() => onLongChange?.(item)}
  >
    <Text isSelected={isSelected}>{item}</Text>
  </TouchableOpacity>
)

export default memo(SelectorItem)
