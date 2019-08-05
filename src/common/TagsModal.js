import React, { useState } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useSelector, useDispatch } from 'react-redux'

import TextInput from '~common/ui/TextInput'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import { addTag } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'center'
})

const Container = styled.View(({ theme }) => ({
  width: 250,
  maxHeight: 210,
  backgroundColor: theme.colors.reverse,
  borderRadius: 3,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2
}))

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary
}))

const TagsModal = ({ isVisible, onClosed, onSelected, selectedChip }) => {
  const [newTag, setNewTag] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(state => Object.values(state.user.bible.tags))

  const saveTag = () => {
    if (!newTag.trim()) {
      return
    }
    dispatch(addTag(newTag.trim()))
    setNewTag('')
  }

  return (
    <StylizedModal
      isVisible={isVisible}
      animationIn='fadeInDown'
      animationOut='fadeOutUp'
      animationInTiming={300}
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
      avoidKeyboard
    >
      <Container>
        <ScrollView style={{ flex: 1, padding: 20 }}>
          <Box row wrap>
            <Chip
              label='Tout'
              isSelected={!selectedChip}
              onPress={() => onSelected(null)}
            />
            {
              tags.map(chip =>
                <Chip
                  key={chip.id}
                  label={chip.name}
                  isSelected={selectedChip && chip.name === selectedChip.name}
                  onPress={() => onSelected(chip)}
                />
              )
            }
          </Box>
        </ScrollView>
        <Box row center marginBottom={10} marginLeft={20} marginRight={20}>
          <TextInput
            placeholder='Créer un nouveau tag'
            onChangeText={setNewTag}
            onSubmitEditing={saveTag}
            returnKeyType='send'
            style={{ flex: 1 }}
            value={newTag}
          />
          <TouchableOpacity onPress={saveTag}>
            <StyledIcon
              isDisabled={!newTag}
              name={'check'}
              size={30}
            />
          </TouchableOpacity>
        </Box>
      </Container>
    </StylizedModal>
  )
}

export default TagsModal
