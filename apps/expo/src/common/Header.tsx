import { twMerge } from '~common/ui/classNames'

import React from 'react'
import PageContent from '~common/ui/PageContent'
import Back from '~common/Back'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from './ui/Icon'
interface Props {
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
  background,
  hasBackButton,
  isModal,
  title,
  detail,
  subTitle,
  fontSize = 16,
  onTitlePress,
  rightComponent,
  onCustomBackPress,
  children,
  ...props
}: Props) => {
  return (
    <Box
      {...props}
      className={twMerge(
        'overflow-hidden border-continuous border-border',
        twMerge(
          background ? 'bg-reverse' : '',
          'border-border',
          'overflow-hidden border-continuous border-b-[1px]'
        )
      )}
    >
      <PageContent>
        <Box
          className="overflow-hidden border-continuous flex-row items-center"
          style={{ minHeight: children ? 40 : 54 }}
        >
          {hasBackButton && (
            <Back onCustomPress={onCustomBackPress} padding>
              <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
            </Back>
          )}
          <VStack
            className="overflow-hidden border-continuous flex-[1]"
            style={{ paddingLeft: hasBackButton ? 0 : 20 }}
          >
            <HStack className="overflow-hidden border-continuous">
              <Text
                className="font-bold"
                accessibilityRole={onTitlePress ? 'button' : 'header'}
                numberOfLines={1}
                onPress={onTitlePress}
                style={{ fontSize: fontSize || 16, flexShrink: 1 }}
              >
                {title}
              </Text>
              {!!detail && (
                <Text
                  className="font-bold text-grey"
                  numberOfLines={1}
                  style={{ fontSize: fontSize || 16, flexShrink: 1 }}
                >
                  {` ${detail}`}
                </Text>
              )}
            </HStack>
            {!!subTitle && (
              <Text className="text-[13px] text-grey" numberOfLines={1}>
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
