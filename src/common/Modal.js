import React from 'react'
import { ScrollView } from 'react-native'
import Modal from 'react-native-modal'

import styled from '@emotion/native'

import { getBottomSpace } from 'react-native-iphone-x-helper'
import Text from '~common/ui/Text'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  display: 'flex',
  maxHeight: 300,
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace()
}))

const Touchy = styled.TouchableOpacity(({ theme }) => ({
  alignItems: 'center',
  flexDirection: 'row',
  justifyContent: 'space-between',
  padding: 20,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
  overflow: 'hidden'
}))

const Tag = styled.View(({ theme }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: theme.colors.lightGrey,
  borderRadius: 3
}))

const Menu = ({ isOpen, onClosed, children }) => {
  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}>
      <Container>
        <ScrollView>{children}</ScrollView>
      </Container>
    </StylizedModal>
  )
}

const Item = ({ children, tag, onPress, ...props }) => (
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
  Item
}
