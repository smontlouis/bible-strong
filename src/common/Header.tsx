import React from 'react'

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
  onTitlePress,
  rightComponent,
  onCustomBackPress,
  children,
  ...props
}: Props) => {
  return (
    <Box
      bg={background ? 'reverse' : undefined}
      borderColor="border"
      borderBottomWidth={1}
      {...props}
    >
      <Box minH={children ? 40 : 54} row alignItems="center">
        {hasBackButton && (
          <Back onCustomPress={onCustomBackPress} padding>
            <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
          </Back>
        )}
        <VStack flex pl={hasBackButton ? 0 : 20}>
          <HStack>
            <Text numberOfLines={1} bold fontSize={16} onPress={onTitlePress} shrink={1}>
              {title}
            </Text>
            {!!detail && (
              <Text numberOfLines={1} bold fontSize={16} color="grey" shrink={1}>
                {` ${detail}`}
              </Text>
            )}
          </HStack>
          {!!subTitle && (
            <Text numberOfLines={1} fontSize={13} color="grey">
              {subTitle}
            </Text>
          )}
        </VStack>
        {rightComponent && (
          <Box justifyContent="center" alignItems="flex-end" overflow="visible">
            {rightComponent}
          </Box>
        )}
      </Box>
      {children}
    </Box>
  )
}

export default Header
