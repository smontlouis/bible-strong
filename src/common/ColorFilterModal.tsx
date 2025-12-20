import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useAllColors } from '~helpers/useColorName'

const ColorCircle = styled.View<{ color: string }>(({ color }) => ({
  width: 24,
  height: 24,
  borderRadius: 6,
  backgroundColor: color,
  marginRight: 12,
}))

const ColorRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const Header = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

type Props = {
  selectedColorId?: string
  onSelect: (colorId: string | undefined) => void
}

const ColorFilterModal = forwardRef<BottomSheetModal, Props>(
  ({ selectedColorId, onSelect }, ref) => {
    const { t } = useTranslation()
    const insets = useSafeAreaInsets()
    const { key, ...bottomSheetStyles } = useBottomSheetStyles()
    const { bottomBarHeight } = useBottomBarHeightInTab()
    const allColors = useAllColors()

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
          <Text bold fontSize={18}>
            {t('Filtrer par couleur')}
          </Text>
        </Header>
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight,
          }}
        >
          {/* Option "Toutes les couleurs" */}
          <ColorRow onPress={() => onSelect(undefined)}>
            <Box
              width={24}
              height={24}
              borderRadius={12}
              marginRight={12}
              borderWidth={2}
              borderColor="border"
              center
            >
              {!selectedColorId && <FeatherIcon name="check" size={14} color="primary" />}
            </Box>
            <Text flex={1} fontSize={16}>
              {t('Toutes les couleurs')}
            </Text>
            {!selectedColorId && <FeatherIcon name="check" size={20} color="primary" />}
          </ColorRow>

          {/* Liste des couleurs */}
          {allColors.map(color => (
            <ColorRow key={color.id} onPress={() => onSelect(color.id)}>
              <ColorCircle color={color.hex} />
              <Text flex={1} fontSize={16}>
                {color.name}
              </Text>
              {selectedColorId === color.id && (
                <FeatherIcon name="check" size={20} color="primary" />
              )}
            </ColorRow>
          ))}
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  }
)

ColorFilterModal.displayName = 'ColorFilterModal'

export default ColorFilterModal
