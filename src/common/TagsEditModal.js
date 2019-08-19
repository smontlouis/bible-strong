import React, { useState, useEffect } from 'react'
import { ScrollView, TouchableOpacity, Alert } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useSelector, useDispatch } from 'react-redux'
import { getBottomSpace } from 'react-native-iphone-x-helper'

import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import { addTag, updateTag, removeTag } from '~redux/modules/user'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0
})

const Container = styled.View(({ theme }) => ({
  height: 200,
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace()
}))

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled, color }) => ({
  marginLeft: 10,
  color: color ? theme.colors[color] : isDisabled ? theme.colors.border : theme.colors.primary
}))

const TagsModal = ({ isVisible, onClosed }) => {
  const [newTag, setNewTag] = useState('')
  const [selectedChip, setSelectedChip] = useState(null)
  const dispatch = useDispatch()
  const tags = useSelector(state => Object.values(state.user.bible.tags))

  const saveTag = () => {
    if (!newTag.trim()) {
      return
    }
    if (selectedChip) {
      dispatch(updateTag(selectedChip.id, newTag.trim()))
    } else {
      dispatch(addTag(newTag.trim()))
    }
    setNewTag('')
    setSelectedChip(null)
  }

  useEffect(() => {
    setNewTag(selectedChip ? selectedChip.name : '')
  }, [selectedChip])

  const promptLogout = () => {
    Alert.alert('Attention', 'Êtes-vous vraiment sur de supprimer ce tag ?', [
      { text: 'Non', onPress: () => null, style: 'cancel' },
      {
        text: 'Oui',
        onPress: () => {
          dispatch(removeTag(selectedChip.id))
          setNewTag('')
          setSelectedChip(null)
        },
        style: 'destructive'
      }
    ])
  }

  return (
    <StylizedModal
      isVisible={isVisible}
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
      avoidKeyboard>
      <Container>
        <Box flex>
          {tags.length ? (
            <ScrollView style={{ padding: 20, flex: 1 }}>
              <Box row wrap>
                {tags.map(chip => (
                  <Chip
                    isSelected={selectedChip && chip.id === selectedChip.id}
                    key={chip.id}
                    label={chip.name}
                    onPress={() =>
                      selectedChip && chip.id === selectedChip.id
                        ? setSelectedChip(null)
                        : setSelectedChip(chip)
                    }
                  />
                ))}
              </Box>
            </ScrollView>
          ) : (
            <Box flex center>
              <Text bold color="lightPrimary">
                Vous n'avez pas encore de tags
              </Text>
            </Box>
          )}
        </Box>
        <Box row center marginBottom={10} marginLeft={20} marginRight={20}>
          <TextInput
            placeholder="Créer un nouveau tag"
            onChangeText={setNewTag}
            onSubmitEditing={saveTag}
            returnKeyType="send"
            style={{ flex: 1 }}
            value={newTag}
          />
          <TouchableOpacity onPress={saveTag}>
            <StyledIcon isDisabled={!newTag} name="check" size={30} />
          </TouchableOpacity>
          {selectedChip && (
            <TouchableOpacity onPress={promptLogout}>
              <StyledIcon name="trash-2" size={25} color="quart" />
            </TouchableOpacity>
          )}
        </Box>
      </Container>
    </StylizedModal>
  )
}

export default TagsModal
