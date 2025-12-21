import React from 'react'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

const StyledLink = styled(Link)(({ theme }) => ({
  backgroundColor: theme.colors.primary,
  width: 50,
  height: 50,
  borderRadius: 30,
  justifyContent: 'center',
  alignItems: 'center',
  flexDirection: 'row',
  position: 'absolute',
  right: 30,
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: 'white',
}))

const Fab = ({ icon, onPress, route, params, component: Component }) => {
  const { bottomBarHeight } = useBottomBarHeightInTab()
  return (
    <StyledLink
      route={route}
      params={params}
      onPress={onPress}
      style={{
        bottom: bottomBarHeight + 30,
      }}
    >
      {Component ? <Component color="white" /> : <StyledIcon name={icon} size={18} />}
    </StyledLink>
  )
}

export default Fab
