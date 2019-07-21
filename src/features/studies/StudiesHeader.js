import React from 'react'
import { Platform, StyleSheet, ScrollView } from 'react-native'
import * as Icon from '@expo/vector-icons'
import { pure } from 'recompose'
import styled from '@emotion/native'
import { Dialog, Portal } from 'react-native-paper'

import Text from '~common/ui/Text'
import Box from '~common/ui/Box'

const TouchableBox = styled.TouchableOpacity({
  flexDirection: 'row',
  alignItems: 'center',
  paddingRight: 15,
  paddingVertical: 15
})

const StyledText = styled(Text)({
  fontSize: 16,
  fontWeight: 'bold',
  marginRight: 5
})

const HeaderBox = styled(Box)(({ noBorder, theme }) => ({
  marginTop: Platform.OS === 'ios' ? 0 : 25,
  height: 50,
  alignItems: 'center',
  borderBottomWidth: noBorder ? 0 : 1,
  borderBottomColor: theme.colors.border,
  paddingLeft: 15,
  paddingRight: 15
  // width: theme.measures.maxWidth,
  // marginLeft: 'auto',
  // marginRight: 'auto'
}))

const StyledIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.default
}))

const Header = ({ noBorder }) => {
  const [isOpen, setIsOpen] = React.useState(false)
  return (
    <HeaderBox noBorder={noBorder} row>
      <TouchableBox onPress={() => setIsOpen(true)}>
        <StyledText>
          Toutes les notes
        </StyledText>
        <StyledIcon name='chevron-down' size={15} />
      </TouchableBox>
      <Portal>
        <Dialog
          visible={isOpen}
          onDismiss={() => setIsOpen(false)}>
          <Dialog.Title>Alert</Dialog.Title>
          <Dialog.ScrollArea>
            <ScrollView>
              <Text>This is a scrollable area</Text>
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </HeaderBox>
  )
}

export default pure(Header)
