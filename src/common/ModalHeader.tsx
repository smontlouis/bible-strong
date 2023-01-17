import React from 'react'

import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from './ui/Icon'

interface Props {
  title: string
  subTitle: string
  onClose?: () => void
  children?: JSX.Element
  rightComponent?: JSX.Element
}

const ModalHeader = ({
  title,
  subTitle,
  onClose,
  children,
  rightComponent,
}: Props) => {
  return (
    <Box mt={10} bg="reverse" borderColor="border" borderBottomWidth={1}>
      <Box height={54} row>
        <Box flex paddingLeft={20}>
          <Text numberOfLines={1} bold fontSize={16} marginTop={10}>
            {title}
          </Text>
          <Text fontSize={13} color="grey">
            {subTitle}
          </Text>
        </Box>
        {rightComponent}
        <TouchableBox onPress={onClose} center w={54} h={54}>
          <FeatherIcon name={'x'} size={20} />
        </TouchableBox>
      </Box>
      {children}
    </Box>
  )
}

export default ModalHeader
