import React from 'react'

import Back from '~common/Back'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

interface Props {
  title: string
  subTitle?: string
  children?: JSX.Element
  hasBackButton?: boolean
  onBackPress?: () => void
  rightComponent?: JSX.Element
}

const ModalHeader = ({
  title,
  subTitle,
  children,
  hasBackButton,
  onBackPress,
  rightComponent,
}: Props) => {
  return (
    <Box bg="reverse" borderColor="border" borderBottomWidth={1}>
      <Box minH={54} row alignItems="center">
        {hasBackButton && (
          <Back
            onCustomPress={onBackPress}
            style={{ width: 54, minHeight: 54, alignItems: 'center', justifyContent: 'center' }}
          >
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        )}
        <Box flex paddingLeft={hasBackButton ? 0 : 20} justifyContent="center">
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
