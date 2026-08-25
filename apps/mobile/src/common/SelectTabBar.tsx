import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const TabItem = styled.TouchableOpacity<{ isRouteActive?: boolean }>(
  ({ theme, isRouteActive }) => ({
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
    marginVertical: 5,
    marginHorizontal: 10,
    borderWidth: 2,
    borderColor: 'transparent',
    ...(isRouteActive && {
      borderRadius: 8,
      backgroundColor: theme.colors.reverse,
      borderColor: theme.colors.lightPrimary,
      overflow: 'visible',
    }),
  })
)

const routes = ['Plans', 'Explorer']

type Props = {
  index: number
  onChange: (index: number) => void
}

const BibleSelectTabBar = ({ index, onChange }: Props) => {
  return (
    <Box row>
      {routes.map((route, routeIndex) => {
        const isRouteActive = routeIndex === index

        return (
          <TabItem
            key={routeIndex}
            isRouteActive={isRouteActive}
            onPress={() => {
              onChange(routeIndex)
            }}
          >
            <Text color={isRouteActive ? 'primary' : 'grey'} bold>
              {route}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default BibleSelectTabBar
