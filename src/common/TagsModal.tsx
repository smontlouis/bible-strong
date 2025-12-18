import styled from '@emotion/native'
import * as Icon from '@expo/vector-icons'
import React, { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import { useBottomSheet } from '~helpers/useBottomSheet'
import useFuzzy from '~helpers/useFuzzy'
import { addTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'
import BottomSheetSearchInput from './BottomSheetSearchInput'
import Modal from './Modal'
import { FeatherIcon } from './ui/Icon'
import Spacer from './ui/Spacer'

// @ts-ignore
const StyledIcon = styled(Icon.Feather)(({ theme, isDisabled }) => ({
  marginLeft: 10,
  color: isDisabled ? theme.colors.border : theme.colors.primary,
}))

const TagsModal = ({ isVisible, onClosed, onSelected, selectedChip }: any) => {
  const { ref, open } = useBottomSheet()

  // Refactor this
  useEffect(() => {
    if (isVisible) {
      open()
    }
  }, [isVisible, open])

  const dispatch = useDispatch()
  const tags = useSelector(sortedTagsSelector, shallowEqual)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })
  const { t } = useTranslation()

  const saveTag = () => {
    if (!keyword.trim()) {
      return
    }
    dispatch(addTag(keyword.trim()))
    resetSearch()
  }

  return (
    <Modal.Body
      ref={ref}
      onModalClose={onClosed}
      withPortal
      snapPoints={['50%']}
      headerComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text bold>{t('Étiquettes')}</Text>
          <Spacer />
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
      <Box row wrap p={20}>
        {result.length || !keyword ? (
          <>
            <Chip label={t('Tout')} isSelected={!selectedChip} onPress={() => onSelected(null)} />
            {result.map((chip: any) => (
              <Chip
                key={chip.id}
                label={chip.name}
                isSelected={selectedChip && chip.name === selectedChip.name}
                onPress={() => onSelected(chip)}
              />
            ))}
          </>
        ) : (
          <TouchableOpacity onPress={saveTag}>
            <Box row flex alignItems="center" py={10} px={30}>
              <FeatherIcon size={20} color="primary" name="tag" />
              <Text ml={5} width={200} bold color="primary">
                {t('Créer')} "{keyword}"
              </Text>
            </Box>
          </TouchableOpacity>
        )}
      </Box>
    </Modal.Body>
  )
}

export default TagsModal
