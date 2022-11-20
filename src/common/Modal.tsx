import { useTheme } from '@emotion/react'
import React, { forwardRef, useEffect } from 'react'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import { Modalize, ModalizeProps } from 'react-native-modalize'
import { Portal } from 'react-native-paper'
import Text, { TextProps } from '~common/ui/Text'
import styled from '@emotion/native'

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
      modalStyle={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 600,
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
      }}
      handlePosition="inside"
      {...props}
    />
  )
})

const Menu = ({
  isOpen,
  onClose,
  children,
  ...props
}: MenuProps & ModalizeProps) => {
  const modalRef = React.useRef<Modalize>(null)
  useEffect(() => {
    if (isOpen) {
      modalRef?.current?.open()
    } else {
      modalRef?.current?.close()
    }
  }, [isOpen])

  return (
    <Portal>
      <Container ref={modalRef} onClose={onClose} {...props}>
        {children}
      </Container>
    </Portal>
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
  Menu,
  Item,
  Container,
}
