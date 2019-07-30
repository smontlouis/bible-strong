import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'

const Wrapper = styled.View(({ theme }) => ({
  position: 'absolute',
  bottom: 20,
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
  height: 45,
  pointerEvents: 'box-none'
}))

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  width: 200,
  height: 45,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: 'white',
  marginRight: 10
}))

const TextButton = styled.Text(({ theme }) => ({
  fontSize: 17,
  color: 'white',
  fontWeight: 'bold'
}))

const FloatingButton = ({ label, icon, onPress, route }) => (
  <Wrapper>
    <StyledLink route='EditStudy'>
      <StyledIcon name={icon} size={20} />
      <TextButton>{label}</TextButton>
    </StyledLink>
  </Wrapper>
)

export default FloatingButton
