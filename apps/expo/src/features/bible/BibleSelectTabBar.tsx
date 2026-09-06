import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

const TabItem = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof { isRouteActive?: boolean } | 'theme'
  > &
    Omit<{ isRouteActive?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isRouteActive } = props
  const classStyles = useResolveClassNames(
    twMerge(
      'flex-[1] items-center justify-center h-[35px] my-[5px] mx-[10px] border-[2px] border-[transparent]',
      className
    )
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          {
            ...(isRouteActive && {
              borderRadius: 8,
              backgroundColor: theme.colors.reverse,
              borderColor: theme.colors.lightPrimary,
              overflow: 'visible',
            }),
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const routes = ['Livres', 'Chapitres', 'Versets']

type Props = {
  index: number
  onChange: (index: number) => void
}

const BibleSelectTabBar = ({ index, onChange }: Props) => {
  const { t } = useTranslation()
  return (
    <Box className="overflow-hidden border-continuous flex-row">
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
            <Text className={twMerge(isRouteActive ? 'text-primary' : 'text-grey', 'font-bold')}>
              {t(route)}
            </Text>
          </TabItem>
        )
      })}
    </Box>
  )
}

export default BibleSelectTabBar
