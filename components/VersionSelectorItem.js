// @flow
import React from 'react'
import { pure } from 'recompose'

import styled from '@emotion/native'

const TouchableOpacity = styled.TouchableOpacity({
  padding: 15,
  paddingTop: 10,
  paddingBottom: 10
})

const TextVersion = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : 'black',
  fontSize: 12
}))

const TextName = styled.Text(({ isSelected, theme }) => ({
  color: isSelected ? theme.colors.primary : 'black',
  fontSize: 16,
  backgroundColor: 'transparent'
}))

const VersionSelectorItem = ({ version, isSelected, onChange }) => (
  <TouchableOpacity onPress={() => onChange(version.id)}>
    <TextVersion isSelected={isSelected}>{version.id}</TextVersion>
    <TextName isSelected={isSelected}>{version.name}</TextName>
  </TouchableOpacity>
)

export default pure(VersionSelectorItem)
