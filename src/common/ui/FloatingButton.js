import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'

const Wrapper = styled.View(({ theme }) => ({
  position: 'absolute',
  bottom: 30,
  left: 0,
  right: 0,
  justifyContent: 'center',
  alignItems: 'center',
  height: 30,
  pointerEvents: 'box-none'
}))

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.lightPrimary,
  paddingHorizontal: 15,
  height: 30,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  width: 80
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.primary
}))

const TextButton = styled.Text(({ theme }) => ({
  fontSize: 13,
  color: theme.colors.primary
}))

const FloatingButton = ({ label, icon, onPress, route, params }) => {
  return (
    <Wrapper>
      <StyledLink route={route} params={params} onPress={onPress}>
        <StyledIcon name={icon} size={20} />
        {/* <TextButton>{label}</TextButton> */}
      </StyledLink>
    </Wrapper>
  )
}

export default FloatingButton
