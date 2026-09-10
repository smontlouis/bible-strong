import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import Box from './Box'
import PageContent from './PageContent'

import Link from '~common/Link'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { MainStackProps } from '~navigation/type'

const StyledLink = (
  componentProps: Omit<UIComponentProps<typeof Link>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge(
    'bg-primary w-[50px] h-[50px] rounded-[30px] justify-center items-center flex-row absolute right-[30px]',
    className
  )
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Link>['style']}
    />
  )
}

const StyledIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-[white]', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

interface FabProps {
  accessibilityLabel: string
  icon?: string
  onPress?: () => void
  route?: keyof MainStackProps
  params?: Record<string, unknown>
  component?: React.ComponentType<{ color: string }>
}

const Fab = ({
  accessibilityLabel,
  icon,
  onPress,
  route,
  params,
  component: Component,
}: FabProps) => {
  const { bottomBarHeight } = useBottomBarHeightInTab()
  return (
    <Box
      className="overflow-hidden border-continuous absolute left-[0px] right-[0px]"
      pointerEvents="box-none"
      style={{ bottom: bottomBarHeight + 30 }}
    >
      <PageContent className="h-[50px]" pointerEvents="box-none">
        <StyledLink
          route={route}
          params={params}
          onPress={onPress}
          accessibilityLabel={accessibilityLabel}
          style={{
            bottom: 0,
          }}
        >
          {Component ? (
            <Component color="white" />
          ) : (
            <StyledIcon name={icon as keyof typeof Icon.Feather.glyphMap} size={18} />
          )}
        </StyledLink>
      </PageContent>
    </Box>
  )
}

export default Fab
