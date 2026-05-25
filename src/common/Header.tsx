import React from 'react'
import { smallSize } from '~helpers/utils'

import Back from '~common/Back'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from './ui/Icon'

interface Props {
  background?: boolean
  hasBackButton?: boolean
  isModal?: boolean
  title?: string
  subTitle?: string
  fontSize?: number
  onTitlePress?: () => void
  rightComponent?: JSX.Element
  onCustomBackPress?: () => void
  children?: JSX.Element
}

const Header = ({
  background,
  hasBackButton,
  isModal,
  title,
  subTitle,
  fontSize = 20,
  onTitlePress,
  rightComponent,
  onCustomBackPress,
  children,
  ...props
}: Props) => {
  return (
    <Box bg={background ? 'reverse' : undefined} {...props}>
      <Box height={54} row>
        <Box>
          {hasBackButton ? (
            <Back onCustomPress={onCustomBackPress} padding>
              <FeatherIcon name={isModal ? 'x' : 'arrow-left'} size={20} />
            </Back>
          ) : (
            <Box width={60} />
          )}
        </Box>
        <Box flex center>
          {subTitle ? (
            <Box row alignItems="center" maxWidth="100%">
              <Text numberOfLines={1} title fontSize={smallSize ? 14 : 16} onPress={onTitlePress}>
                {title}
              </Text>
              <Box mx={8} size={4} borderRadius={2} bg="tertiary" />
              <Text numberOfLines={1} title fontSize={smallSize ? 14 : 16} color="grey" shrink={1}>
                {subTitle}
              </Text>
            </Box>
          ) : (
            <Text
              numberOfLines={1}
              title
              fontSize={smallSize ? 16 : fontSize}
              onPress={onTitlePress}
            >
              {title}
            </Text>
          )}
        </Box>
        {rightComponent ? (
          <Box justifyContent="center" alignItems="flex-end" overflow="visible">
            {rightComponent}
          </Box>
        ) : (
          <Box width={60} />
        )}
      </Box>
      {children}
    </Box>
  )
}

export default Header
