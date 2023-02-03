import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import { Portal } from '@gorhom/portal'
import React, { forwardRef } from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { Modalize, ModalizeProps } from 'react-native-modalize'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Text, { TextProps } from '~common/ui/Text'

const Touchy = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden',
}))

const Tag = styled.View(({ theme }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: theme.colors.lightGrey,
  borderRadius: 3,
}))

interface ModalBodyProps extends ModalizeProps {
  children: React.ReactNode
  withPortal?: boolean
  modalRef?: React.RefObject<Modalize>
  style?: any
}

interface ItemProps {
  children: string
  tag?: string
  onPress: () => void
}

const Body = forwardRef<Modalize, ModalBodyProps>(
  ({ withPortal, ...props }, ref) => {
    const Wrapper = withPortal ? Portal : React.Fragment
    const theme = useTheme()
    const insets = useSafeAreaInsets()

    return (
      <Wrapper>
        <Modalize
          ref={ref}
          handleStyle={{ backgroundColor: theme.colors.default, opacity: 0.5 }}
          modalTopOffset={insets.top + 40}
          modalStyle={{
            marginLeft: 'auto',
            marginRight: 'auto',
            maxWidth: 600,
            maxHeight: '50%',
            width: '100%',
            overflow: 'hidden',
            borderTopLeftRadius: 30,
            borderTopRightRadius: 30,
            backgroundColor: theme.colors.reverse,

            shadowColor: theme.colors.default,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.3,
            shadowRadius: 4,
            elevation: 2,
            paddingBottom: getBottomSpace(),
            ...props.style,
          }}
          handlePosition="inside"
          {...props}
        />
      </Wrapper>
    )
  }
)

const Item = ({ children, tag, onPress, ...props }: ItemProps & TextProps) => (
  <Touchy onPress={onPress}>
    <Text {...props}>{children}</Text>
    {tag && (
      <Tag>
        <Text fontSize={12} color="grey" reverse>
          {tag}
        </Text>
      </Tag>
    )}
  </Touchy>
)

export default {
  Body,
  Item,
}
