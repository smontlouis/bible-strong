import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  width: 60,
  height: 60,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  position: 'absolute',
  bottom: 30,
  right: 30
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: 'white'
}))

const Fab = ({ icon, onPress, route, params, component: Component }) => {
  return (
    <StyledLink route={route} params={params} onPress={onPress}>
      {Component ? <Component color="white" /> : <StyledIcon name={icon} size={22} />}
    </StyledLink>
  )
}

export default Fab
