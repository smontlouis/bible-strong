import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { NavigationState, SceneRendererProps } from 'react-native-tab-view'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface TabItemProps {
  isRouteActive: boolean
  isFirst: boolean
  isLast: boolean
}

const TabItem = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof TabItemProps | 'theme'
  > &
    Omit<TabItemProps, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isRouteActive, isFirst, isLast } = props
  const resolvedClassName = twMerge(
    'flex-[1] items-center justify-center h-[35px] my-[5px] mx-[10px]',
    className
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      className={resolvedClassName}
      style={
        [
          {
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
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

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
    <Box className="overflow-hidden border-continuous flex-row">
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
            <Text className={twMerge(isRouteActive ? 'text-primary' : 'text-grey', 'font-bold')}>
              {route.title}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default EventDetailsTab
