import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import { useAtomValue } from 'jotai/react'
import React, { memo, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ScrollView, TouchableOpacity } from 'react-native'
import { useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import useFuzzy from '~helpers/useFuzzy'
import verseToReference from '~helpers/verseToReference'
import { RootState } from '~redux/modules/reducer'
import { addTag, toggleTagEntity } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import { multipleTagsModalAtom } from '../state/app'
import BottomSheetSearchInput from './BottomSheetSearchInput'
import Modal from './Modal'
import { FeatherIcon } from './ui/Icon'
import Spacer from './ui/Spacer'

// @ts-ignore
const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const MultipleTagsModal = () => {
  const item = useAtomValue(multipleTagsModalAtom)
  const { ref, open } = useBottomSheetModal()

  const { t } = useTranslation()
  const [highlightTitle, setHighlightTitle] = useState('')
  const dispatch = useDispatch()
  const tags = useSelector(sortedTagsSelector)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })

  useEffect(() => {
    if (item) {
      open()
    }
  }, [item])

  // Select entity data based on item.entity (already memoized at store level)
  const entityData = useSelector((state: RootState) =>
    // @ts-ignore
    item?.entity ? state.user.bible[item.entity] : undefined
  )

  const currentItems = useMemo(() => {
    // @ts-ignore
    if (item.ids) {
      // @ts-ignore
      return Object.keys(item.ids).map((id: any) => ({
        id,
        ...entityData?.[id],
      }))
    }

    return [
      entityData
        ? // @ts-ignore
          { id: item.id, ...entityData[item.id] }
        : {},
    ]
    // @ts-ignore
  }, [item.ids, item.id, entityData])

  const selectedChips = currentItems.reduce(
    (acc: any, curr: any) => ({ ...acc, ...(curr.tags && curr.tags) }),
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
    // @ts-ignore
    if (item.ids) {
      // @ts-ignore
      const title = verseToReference(item.ids)
      setHighlightTitle(title)
    }
  }, [item])

  return (
    <Modal.Body
      ref={ref}
      snapPoints={['70%']}
      headerComponent={
        <Box px={20} pt={10} gap={5}>
          <Text bold>
            {/* @ts-ignore */}
            {item.entity !== 'highlights'
              ? // @ts-ignore
                `${t('Étiquettes pour')} "${
                  currentItems[0].title ||
                  // @ts-ignore
                  item.title ||
                  ''
                }"`
              : `${t('Étiquettes pour')} ${(highlightTitle || '').replace(/[\r\n]+/g, ' ')}`}
          </Text>
          <BottomSheetSearchInput
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
          <Box row wrap p={20}>
            {result.map((chip: any) => (
              <Chip
                key={chip.id}
                label={chip.name}
                isSelected={selectedChips && selectedChips[chip.id]}
                onPress={() => dispatch(toggleTagEntity({ item, tagId: chip.id }))}
              />
            ))}
          </Box>
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
