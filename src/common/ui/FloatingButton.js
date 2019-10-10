import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'

const Wrapper = styled.View(({ theme }) => ({
  position: 'absolute',
  bottom: 40,
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
  height: 40,
  pointerEvents: 'box-none'
}))

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  paddingHorizontal: 15,
  height: 40,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row'
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: 'white',
  marginRight: 10
}))

const TextButton = styled.Text(({ theme }) => ({
  fontSize: 15,
  color: 'white'
}))

const FloatingButton = ({ label, icon, onPress, route, params }) => {
  return (
    <Wrapper>
      <StyledLink route={route} params={params} onPress={onPress}>
        <StyledIcon name={icon} size={20} />
        <TextButton>{label}</TextButton>
      </StyledLink>
    </Wrapper>
  )
}

export default FloatingButton
