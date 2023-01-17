import React from 'react'
import { smallSize } from '~helpers/utils'

import Back from '~common/Back'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from './ui/Icon'

interface Props {
  background?: boolean
  title?: string
  fontSize?: number
  onTitlePress?: () => void
  leftComponent?: JSX.Element
  onClose?: () => void
  children?: JSX.Element
}

const ModalHeader = ({
  background,
  title,
  fontSize = 18,
  onTitlePress,
  leftComponent,
  onClose,
  children,
  ...props
}: Props) => {
  return (
    <Box
      mt={10}
      bg={background ? 'reverse' : undefined}
      borderColor="border"
      borderBottomWidth={1}
      {...props}
    >
      <Box height={54} row>
        {leftComponent ? (
          <Box justifyContent="center" alignItems="flex-end" overflow="visible">
            {leftComponent}
          </Box>
        ) : (
          <Box width={54} />
        )}
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
        <TouchableBox onPress={onClose} center w={54} h={54}>
          <FeatherIcon name={'x'} size={20} />
        </TouchableBox>
      </Box>
      {children}
    </Box>
  )
}

export default ModalHeader
