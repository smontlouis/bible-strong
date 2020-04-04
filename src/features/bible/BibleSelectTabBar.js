import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const TabItem = styled.TouchableOpacity(({ theme, isRouteActive }) => ({
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  height: 50,
  borderBottomColor: isRouteActive ? theme.colors.primary : theme.colors.border,
  borderBottomWidth: isRouteActive ? 3 : 1,
}))

const BibleSelectTabBar = props => {
  const {
    getLabelText,
    onTabPress,
    onTabLongPress,
    getAccessibilityLabel,
    navigation,
  } = props

  const { routes, index: activeRouteIndex } = navigation.state

  return (
    <Box row>
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === activeRouteIndex

        return (
          <TabItem
            key={routeIndex}
            isRouteActive={isRouteActive}
            onPress={() => {
              onTabPress({ route })
            }}
            onLongPress={() => {
              onTabLongPress({ route })
            }}
            accessibilityLabel={getAccessibilityLabel({ route })}
          >
            <Text bold>{getLabelText({ route })}</Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default BibleSelectTabBar
