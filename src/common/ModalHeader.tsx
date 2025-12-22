import React from 'react'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'

interface Props {
  title: string
  subTitle?: string
  children?: JSX.Element
  rightComponent?: JSX.Element
}

const ModalHeader = ({ title, subTitle, children, rightComponent }: Props) => {
  return (
    <Box bg="reverse" borderColor="border" borderBottomWidth={1}>
      <Box minH={54} row>
        <Box flex paddingLeft={20} justifyContent="center">
          <Text numberOfLines={1} bold fontSize={16}>
            {title}
          </Text>
          {subTitle && (
            <Text fontSize={13} color="grey">
              {subTitle}
            </Text>
          )}
        </Box>
        {rightComponent}
      </Box>
      {children}
    </Box>
  )
}

export default ModalHeader
