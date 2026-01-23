import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'

const Header = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const FilterRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const ColorCircle = styled.View<{ color: string }>(({ color }) => ({
  width: 20,
  height: 20,
  borderRadius: 10,
  backgroundColor: color,
  marginRight: 8,
}))

const ResetButton = styled(TouchableOpacity)({
  paddingVertical: 4,
  paddingHorizontal: 8,
})

type Props = {
  selectedColorId?: string
  selectedColorName?: string
  selectedColorHex?: string
  onColorPress: () => void
  selectedTagName?: string
  onTagPress: () => void
  selectedTypeLabel?: string
  onTypePress: () => void
  onReset: () => void
  hasActiveFilters: boolean
}

const FilterModal = forwardRef<BottomSheetModal, Props>(
  (
    {
      selectedColorId,
      selectedColorName,
      selectedColorHex,
      onColorPress,
      selectedTagName,
      onTagPress,
      selectedTypeLabel,
      onTypePress,
      onReset,
      hasActiveFilters,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const insets = useSafeAreaInsets()
    const { key, ...bottomSheetStyles } = useBottomSheetStyles()

    return (
      <BottomSheetModal
        ref={ref}
        topInset={insets.top}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        activeOffsetY={[-20, 20]}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetView>
          <Header>
            <Text bold fontSize={18}>
              {t('Filtres')}
            </Text>
            {hasActiveFilters && (
              <ResetButton onPress={onReset}>
                <Text color="primary" fontSize={14}>
                  {t('Réinitialiser')}
                </Text>
              </ResetButton>
            )}
          </Header>

          {/* Filtre Type */}
          <FilterRow onPress={onTypePress}>
            <Box row flex={1}>
              <FeatherIcon name="layers" size={20} color="tertiary" />
              <Text marginLeft={12} fontSize={16}>
                {t('Type')}
              </Text>
            </Box>
            <Box row center>
              <Text color="tertiary" fontSize={14} marginRight={8} numberOfLines={1} maxWidth={200}>
                {selectedTypeLabel || t('Tout')}
              </Text>
              <FeatherIcon name="chevron-right" size={20} color="tertiary" />
            </Box>
          </FilterRow>

          {/* Filtre Couleur */}
          <FilterRow onPress={onColorPress}>
            <Box row flex={1}>
              <FeatherIcon name="droplet" size={20} color="tertiary" />
              <Text marginLeft={12} fontSize={16}>
                {t('Couleur')}
              </Text>
            </Box>
            <Box row center>
              {selectedColorId && selectedColorHex && <ColorCircle color={selectedColorHex} />}
              <Text color="tertiary" fontSize={14} marginRight={8} numberOfLines={1} maxWidth={200}>
                {selectedColorName || t('Toutes')}
              </Text>
              <FeatherIcon name="chevron-right" size={20} color="tertiary" />
            </Box>
          </FilterRow>

          {/* Filtre Tags */}
          <FilterRow onPress={onTagPress}>
            <Box row flex={1}>
              <FeatherIcon name="tag" size={20} color="tertiary" />
              <Text marginLeft={12} fontSize={16}>
                {t('Tags')}
              </Text>
            </Box>
            <Box row center>
              <Text color="tertiary" fontSize={14} marginRight={8} numberOfLines={1} maxWidth={200}>
                {selectedTagName || t('Tous')}
              </Text>
              <FeatherIcon name="chevron-right" size={20} color="tertiary" />
            </Box>
          </FilterRow>

          {/* Bottom padding for safe area */}
          <Box height={insets.bottom + 16} />
        </BottomSheetView>
      </BottomSheetModal>
    )
  }
)

FilterModal.displayName = 'FilterModal'

export default FilterModal
