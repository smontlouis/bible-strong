import React from 'react'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'
import { smallSize } from '~helpers/utils'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Back from '~common/Back'

const HeaderBox = styled(Box)(({ theme, background }) => ({
  height: 60,
  borderBottomColor: theme.colors.border,
  alignItems: 'stretch',
  ...(background && {
    backgroundColor: theme.colors.reverse,
  }),
}))

const FeatherIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default,
}))

interface Props {
  background?: boolean
  hasBackButton?: boolean
  isModal?: boolean
  title?: string
  fontSize?: number
  onTitlePress?: () => void
  rightComponent?: JSX.Element
}

const Header = ({
  background,
  hasBackButton,
  isModal,
  title,
  fontSize = 20,
  onTitlePress,
  rightComponent,
  ...props
}: Props) => {
  return (
    <HeaderBox background={background} row overflow="visibility" {...props}>
      <Box>
        {hasBackButton ? (
          <Back padding>
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
        <Box
          justifyContent="center"
          alignItems="flex-end"
          overflow="visibility"
        >
          {rightComponent}
        </Box>
      ) : (
        <Box width={60} />
      )}
    </HeaderBox>
  )
}

export default pure(Header)
