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
  fontSize = 20,
  onTitlePress,
  rightComponent,
  onCustomBackPress,
  children,
  ...props
}: Props) => {
  return (
    <Box {...props}>
      <Box height={60} row>
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
          <Text
            numberOfLines={1}
            title
            fontSize={smallSize ? 16 : fontSize}
            onPress={onTitlePress}
          >
            {title}
          </Text>
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
