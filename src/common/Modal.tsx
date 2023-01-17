import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import React, { forwardRef, useEffect } from 'react'
import {
  getBottomSpace,
  getStatusBarHeight,
} from 'react-native-iphone-x-helper'
import { Modalize, ModalizeProps } from 'react-native-modalize'
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

interface MenuProps {
  isOpen: boolean
  onClose: () => void
  children: React.ReactNode
}

interface ItemProps {
  children: string
  tag?: string
  onPress: () => void
}

const Container = forwardRef<Modalize, ModalizeProps>((props, ref) => {
  const theme = useTheme()

  return (
    <Modalize
      ref={ref}
      handleStyle={{ backgroundColor: theme.colors.default, opacity: 0.5 }}
      modalTopOffset={getStatusBarHeight() + 40}
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
  )
})

const Body = ({
  isOpen,
  onClose,
  children,
  modalRef,
  ...props
}: MenuProps &
  ModalizeProps & {
    modalRef?: React.RefObject<Modalize>
  }) => {
  const ref = React.useRef<Modalize>(null)
  useEffect(() => {
    if (isOpen) {
      modalRef ? modalRef?.current?.open() : ref.current?.open()
    }
  }, [isOpen, modalRef])

  return (
    <Container ref={modalRef || ref} onClose={onClose} {...props}>
      {children}
    </Container>
  )
}

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
  Container,
}
