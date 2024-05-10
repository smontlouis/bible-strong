import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useAtom } from 'jotai/react'
import React, { memo, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import TextInput from '~common/ui/TextInput'
import useFuzzy from '~helpers/useFuzzy'
import { useBottomSheet } from '~helpers/useBottomSheet'
import { hp } from '~helpers/utils'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { multipleTagsModalAtom } from '../state/app'
import Modal from './Modal'
import SearchInput from './SearchInput'
import Spacer from './ui/Spacer'
import { FeatherIcon } from './ui/Icon'

const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const MultipleTagsModal = () => {
  const [item, setItem] = useAtom(multipleTagsModalAtom)
  const { ref, open } = useBottomSheet()

  const onClose = () => setItem(false)

  const { t } = useTranslation()
  const [highlightTitle, setHighlightTitle] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(sortedTagsSelector, shallowEqual)
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
    if (!keyword.trim()) {
      return
    }
    dispatch(addTag(keyword.trim()))
    resetSearch()
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
      snapPoints={['50%']}
      headerComponent={
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
            placeholder={t('Chercher ou créer une étiquette')}
            onChangeText={search}
            onDelete={resetSearch}
            value={keyword}
            returnKeyType="done"
            onSubmitEditing={() => (!result.length ? saveTag() : undefined)}
          />
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
        ) : keyword ? (
          <TouchableOpacity onPress={saveTag}>
            <Box row flex alignItems="center" py={10} px={30}>
              <FeatherIcon size={20} color="primary" name="tag" />
              <Text ml={5} width={200} bold color="primary">
                {t('Créer')} "{keyword}"
              </Text>
            </Box>
          </TouchableOpacity>
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
