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
  position: 'absolute',
  bottom: 30,
  right: 30,
}))

const StyledIcon = styled(Icon.MaterialIcons)(({ theme }) => ({
  color: 'white',
}))

const Fab = ({ icon, onPress, route, params, component: Component }) => {
  return (
    <StyledLink route={route} params={params} onPress={onPress}>
      {Component ? (
        <Component color="white" />
      ) : (
        <StyledIcon name={icon} size={22} />
      )}
    </StyledLink>
  )
}

export default Fab
