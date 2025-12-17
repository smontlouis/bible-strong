import * as Icon from '@expo/vector-icons'
import React, { useEffect, useState } from 'react'
import { TouchableOpacity } from 'react-native'
import Modal from 'react-native-modal'

import styled from '@emotion/native'
import { withTheme } from '@emotion/react'

import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Box from '~common/ui/Box'
import TextInput from '~common/ui/TextInput'

// @ts-ignore
const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0,
})

const Container = styled.View(({ theme }) => ({
  display: 'flex',
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  padding: 10,
  paddingBottom: useSafeAreaInsets().bottom || 10,
}))

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }: any) => ({
  marginLeft: 10,
  // @ts-ignore
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const TitlePrompt = ({ isOpen, title, onClosed, onSave, placeholder }: any) => {
  const [value, setValue] = useState(title)

  const onSaveTitle = () => {
    if (!value || !value.trim()) {
      return
    }

    onSave(value)
    setValue('')
    onClosed()
  }

  useEffect(() => {
    setValue(title)
  }, [title])

  return (
    // @ts-ignore
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={isOpen}
      avoidKeyboard
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
    >
      <Container>
        <Box row center>
          <Box flex>
            <TextInput
              placeholder={placeholder}
              onChangeText={setValue}
              onSubmitEditing={onSaveTitle}
              returnKeyType="send"
              value={value}
              autoFocus
              selectTextOnFocus
            />
          </Box>
          <TouchableOpacity onPress={onSaveTitle}>
            {/* @ts-ignore */}
            <StyledIcon isDisabled={!value || !value.trim()} name="check" size={30} />
          </TouchableOpacity>
        </Box>
      </Container>
    </StylizedModal>
  )
}

export default withTheme(TitlePrompt)
