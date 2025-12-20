import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Box from '~common/ui/Box'
import Chip from '~common/ui/Chip'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import Spacer from '~common/ui/Spacer'
import BottomSheetSearchInput from '~common/BottomSheetSearchInput'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import useFuzzy from '~helpers/useFuzzy'
import { addTag } from '~redux/modules/user'
import { sortedTagsSelector } from '~redux/selectors/tags'

const Header = styled.View(({ theme }) => ({
  paddingTop: 20,
  paddingBottom: 10,
  paddingHorizontal: 20,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

interface Tag {
  id: string
  name: string
}

type Props = {
  selectedTag?: Tag
  onSelect: (tag?: Tag) => void
}

const TagsFilterModal = forwardRef<BottomSheetModal, Props>(({ selectedTag, onSelect }, ref) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const dispatch = useDispatch()
  const tags = useSelector(sortedTagsSelector, shallowEqual)
  const { keyword, result, search, resetSearch } = useFuzzy(tags, {
    keys: ['name'],
  })

  const saveTag = () => {
    if (!keyword.trim()) return
    dispatch(addTag(keyword.trim()))
    resetSearch()
  }

  return (
    <BottomSheetModal
      ref={ref}
      topInset={insets.top}
      enablePanDownToClose
      snapPoints={['50%']}
      backdropComponent={renderBackdrop}
      activeOffsetY={[-20, 20]}
      key={key}
      {...bottomSheetStyles}
    >
      <Header>
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
      </Header>
      <BottomSheetScrollView
        contentContainerStyle={{
          paddingBottom: bottomBarHeight,
        }}
      >
        <Box row wrap p={20}>
          {result.length || !keyword ? (
            <>
              <Chip
                label={t('Tout')}
                isSelected={!selectedTag}
                onPress={() => onSelect(undefined)}
              />
              {result.map((chip: Tag) => (
                <Chip
                  key={chip.id}
                  label={chip.name}
                  isSelected={selectedTag?.id === chip.id}
                  onPress={() => onSelect(chip)}
                />
              ))}
            </>
          ) : (
            <TouchableOpacity onPress={saveTag}>
              <Box row flex alignItems="center" py={10} px={30}>
                <FeatherIcon size={20} color="primary" name="tag" />
                <Text ml={5} width={200} bold color="primary">
                  {t('Créer')} &quot;{keyword}&quot;
                </Text>
              </Box>
            </TouchableOpacity>
          )}
        </Box>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
})

TagsFilterModal.displayName = 'TagsFilterModal'

export default TagsFilterModal
