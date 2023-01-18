import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useAtom } from 'jotai'
import React, { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import useFuzzy from '~helpers/useFuzzy'
import { useModalize } from '~helpers/useModalize'
import { hp } from '~helpers/utils'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { multipleTagsModalAtom } from '../state/app'
import Modal from './Modal'
import SearchInput from './SearchInput'
import Spacer from './ui/Spacer'

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const MultipleTagsModal = () => {
  const [item, setItem] = useAtom(multipleTagsModalAtom)
  const { ref, open } = useModalize()

  const onClose = () => setItem(false)

  const { t } = useTranslation()
  const [newTag, setNewTag] = useState('')
  const [highlightTitle, setHighlightTitle] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(
    (state: RootState) =>
      Object.values(state.user.bible.tags).sort((a, b) =>
        a.name.localeCompare(b.name)
      ),
    shallowEqual
  )
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })

  useEffect(() => {
    if (item) {
      open()
    }
  }, [item])

  let currentItems = []

  currentItems = useSelector((state: RootState) => {
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
    <Modal.Body
      ref={ref}
      onClose={onClose}
      modalHeight={hp(80, 600)}
      HeaderComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text bold>
            {item.entity !== 'highlights'
              ? `${t('Étiquettes pour')} "${currentItems[0].title ||
                  item.title ||
                  ''}"`
              : `${t('Étiquettes pour')} ${highlightTitle}`}
          </Text>
          <Spacer />
          <SearchInput
            placeholder={t('Chercher une étiquette')}
            onChangeText={search}
            onDelete={resetSearch}
            value={keyword}
            returnKeyType="done"
          />
        </Box>
      }
      FooterComponent={
        <Box
          row
          center
          marginBottom={10}
          marginLeft={20}
          marginRight={20}
          paddingTop={10}
          paddingBottom={10}
        >
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
      }
    >
      <Box flex>
        {result.length ? (
          <ScrollView
            contentContainerStyle={{ padding: 20 }}
            style={{ flex: 1 }}
          >
            <Box row wrap>
              {result.map(chip => (
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
          <Box flex center paddingVertical={10}>
            <Text textAlign="center" width={200} bold color="lightPrimary">
              {t('Créez votre premier tag puis sélectionnez-le !')}
            </Text>
          </Box>
        )}
      </Box>
    </Modal.Body>
  )
}

export default memo(MultipleTagsModal)
