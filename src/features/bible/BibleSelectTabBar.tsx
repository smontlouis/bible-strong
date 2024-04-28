import React from 'react'
import styled from '@emotion/native'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useTranslation } from 'react-i18next'

const TabItem = styled.TouchableOpacity<{ isRouteActive?: boolean }>(
  ({ theme, isRouteActive }) => ({
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: 35,
    marginVertical: 5,
    marginHorizontal: 10,
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

const routes = ['Livres', 'Chapitres', 'Versets']

type Props = {
  index: number
  onChange: (index: number) => void
}

const BibleSelectTabBar = ({ index, onChange }: Props) => {
  const { t } = useTranslation()
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
              {t(route)}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default BibleSelectTabBar
