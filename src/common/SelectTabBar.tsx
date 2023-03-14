import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const TabItem = styled.TouchableOpacity(
  ({ theme, isRouteActive, isFirst, isLast }) => ({
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
    marginVertical: 5,
    marginHorizontal: 10,
    ...(isFirst && {
      marginRight: 0,
    }),
    ...(isLast && {
      marginLeft: 0,
    }),
    ...(isRouteActive && {
      borderRadius: 8,
      backgroundColor: theme.colors.reverse,
      shadowColor: 'rgb(89,131,240)',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 7,
      elevation: 1,
      overflow: 'visible',
    }),
  })
)

const SelectTabBar = props => {
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
            isFirst={routeIndex === 0}
            isLast={routeIndex === routes.length - 1}
            isRouteActive={isRouteActive}
            onPress={() => {
              onTabPress({ route })
            }}
            onLongPress={() => {
              onTabLongPress({ route })
            }}
            accessibilityLabel={getAccessibilityLabel({ route })}
          >
            <Text color={isRouteActive ? 'primary' : 'grey'} bold>
              {getLabelText({ route })}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default SelectTabBar
