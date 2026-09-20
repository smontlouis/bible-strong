import { twMerge } from '~common/ui/classNames'

import React from 'react'
import PageContent from '~common/ui/PageContent'
import Back from '~common/Back'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from './ui/Icon'
import { usePublicShell } from '~navigation/PublicShellContext'
interface Props {
  maxWidth?: number
  background?: boolean
  hasBackButton?: boolean
  isModal?: boolean
  title?: string
  detail?: string
  subTitle?: string
  fontSize?: number
  onTitlePress?: () => void
  rightComponent?: React.ReactNode
  onCustomBackPress?: () => void
  children?: React.ReactNode
}

const Header = ({
  maxWidth,
  background,
  hasBackButton,
  isModal,
  title,
  detail,
  subTitle,
  fontSize = 14,
  onTitlePress,
  rightComponent,
  onCustomBackPress,
  children,
  ...props
}: Props) => {
  const publicShell = usePublicShell()
  const showBackButton = hasBackButton && !publicShell.active
  if (publicShell.active) return null
  return (
    <Box
      {...props}
      testID="workspace-page-header"
      className={twMerge(
        'overflow-hidden border-continuous border-border',
        twMerge(
          background ? 'bg-reverse' : '',
          'border-border',
          'overflow-hidden border-continuous border-b-[1px]'
        )
      )}
    >
      <PageContent style={maxWidth ? { maxWidth } : undefined}>
        <Box
          className="overflow-hidden border-continuous flex-row items-center"
          style={{ minHeight: 54 }}
        >
          {showBackButton && (
            <Back onCustomPress={onCustomBackPress} padding>
              <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
            </Back>
          )}
          <VStack
            className="overflow-hidden border-continuous flex-[1]"
            style={{ paddingLeft: showBackButton ? 0 : 20 }}
          >
            <HStack className="overflow-hidden border-continuous">
              <Text
                className="font-bold"
                accessibilityRole={onTitlePress ? 'button' : 'header'}
                numberOfLines={1}
                onPress={onTitlePress}
                style={{ fontSize: fontSize || 14, flexShrink: 1 }}
              >
                {title}
              </Text>
              {!!detail && (
                <Text
                  className="font-bold text-grey"
                  numberOfLines={1}
                  style={{ fontSize: fontSize || 14, flexShrink: 1 }}
                >
                  {` ${detail}`}
                </Text>
              )}
            </HStack>
            {!!subTitle && (
              <Text className="text-[12px] text-grey" numberOfLines={1}>
                {subTitle}
              </Text>
            )}
          </VStack>
          {rightComponent && (
            <Box className="border-continuous overflow-visible justify-center items-end">
              {rightComponent}
            </Box>
          )}
        </Box>
        {children}
      </PageContent>
    </Box>
  )
}

export default Header
