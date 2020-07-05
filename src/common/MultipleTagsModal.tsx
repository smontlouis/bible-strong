import React, { useState, useEffect } from 'react'
import { ScrollView, TouchableOpacity } from 'react-native'
import Modal from 'react-native-modal'
import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useSelector, useDispatch } from 'react-redux'
import { getBottomSpace } from 'react-native-iphone-x-helper'
import verseToReference from '~helpers/verseToReference'

import TextInput from '~common/ui/TextInput'
import Text from '~common/ui/Text'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { useTranslation } from 'react-i18next'

const StylizedModal = styled(Modal)({
  justifyContent: 'flex-end',
  margin: 0,
  alignItems: 'center',
})

const Container = styled.View(({ theme }) => ({
  height: 260,
  maxWidth: 600,
  minWidth: 250,
  borderTopLeftRadius: 30,
  borderTopRightRadius: 30,
  backgroundColor: theme.colors.reverse,
  shadowColor: theme.colors.default,
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.3,
  shadowRadius: 4,
  elevation: 2,
  paddingBottom: getBottomSpace(),
}))

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const MultipleTagsModal = ({ item = {}, onClosed }) => {
  const { t } = useTranslation()
  const [newTag, setNewTag] = useState('')
  const [highlightTitle, setHighlightTitle] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(state => Object.values(state.user.bible.tags))

  let currentItems = []

  currentItems = useSelector(state => {
    if (item.ids) {
      return Object.keys(item.ids).map(id => ({
        id,
        ...state.user.bible[item.entity][id],
      }))
    }

    return [
      state.user.bible[item.entity]
        ? { id: item.id, ...state.user.bible[item.entity][item.id] }
        : {},
    ]
  })

  const selectedChips = currentItems.reduce(
    (acc, curr) => ({ ...acc, ...(curr.tags && curr.tags) }),
    {}
  )

  const saveTag = () => {
    if (!newTag.trim()) {
      return
    }
    dispatch(addTag(newTag.trim()))
    setNewTag('')
  }

  useEffect(() => {
    if (item.ids) {
      const title = verseToReference(item.ids)
      setHighlightTitle(title)
    }
  }, [item])

  return (
    <StylizedModal
      backdropOpacity={0.3}
      isVisible={!!item}
      onBackButtonPress={onClosed}
      onBackdropPress={onClosed}
      avoidKeyboard
    >
      <Container>
        <Box padding={20} paddingBottom={0}>
          <Text bold>
            {item.entity !== 'highlights'
              ? `${t('Étiquettes pour')} "${currentItems[0].title ||
                  item.title ||
                  ''}"`
              : `${t('Étiquettes pour')} ${highlightTitle}`}
          </Text>
        </Box>
        <Box flex>
          {tags.length ? (
            <ScrollView
              contentContainerStyle={{ padding: 20 }}
              style={{ flex: 1 }}
            >
              <Box row wrap>
                {tags.map(chip => (
                  <Chip
                    key={chip.id}
                    label={chip.name}
                    isSelected={selectedChips && selectedChips[chip.id]}
                    onPress={() =>
                      dispatch(toggleTagEntity({ item, tagId: chip.id }))
                    }
                  />
                ))}
              </Box>
            </ScrollView>
          ) : (
            <Box flex center>
              <Text textAlign="center" width={200} bold color="lightPrimary">
                {t('Créez votre premier tag puis sélectionnez-le !')}
              </Text>
            </Box>
          )}
        </Box>
        <Box row center marginBottom={10} marginLeft={20} marginRight={20}>
          <Box flex>
            <TextInput
              placeholder={t('Créer un nouveau tag')}
              onChangeText={setNewTag}
              onSubmitEditing={saveTag}
              returnKeyType="send"
              value={newTag}
            />
          </Box>
          <TouchableOpacity onPress={saveTag}>
            <StyledIcon isDisabled={!newTag} name="check" size={30} />
          </TouchableOpacity>
        </Box>
      </Container>
    </StylizedModal>
  )
}

export default MultipleTagsModal
