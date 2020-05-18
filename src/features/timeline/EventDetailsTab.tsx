import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { SceneRendererProps, NavigationState } from 'react-native-tab-view'
import { Theme } from '~themes'

const TabItem = styled.TouchableOpacity(
  ({
    theme,
    isRouteActive,
    isFirst,
    isLast,
  }: {
    theme: Theme
    isRouteActive: boolean
    isFirst: boolean
    isLast: boolean
  }) => ({
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

const EventDetailsTab = ({
  setIndex,
  navigationState,
}: SceneRendererProps & {
  setIndex: React.Dispatch<React.SetStateAction<number>>
  navigationState: NavigationState<{
    key: string
    title: string
  }>
}) => {
  const { routes, index: activeRouteIndex } = navigationState

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
              setIndex(routeIndex)
            }}
            onLongPress={() => {
              setIndex(routeIndex)
            }}
          >
            <Text color={isRouteActive ? 'primary' : 'grey'} bold>
              {route.title}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default EventDetailsTab
