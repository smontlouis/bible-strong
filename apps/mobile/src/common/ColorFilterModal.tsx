import styled from '@emotion/native'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
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

type Props = {
  selectedColorId?: string
  onSelect: (colorId: string | undefined) => void
}

const ColorFilterModal = forwardRef<SheetRef, Props>(({ selectedColorId, onSelect }, ref) => {
  const { t } = useTranslation()
  const { bottomBarHeight } = useBottomBarHeightInTab()
  const allColors = useAllColors()

  return (
    <Sheet ref={ref} snapPoints={[0.5]} header={<SheetHeader title={t('Filtrer par couleur')} />}>
      <SheetScrollView
        contentContainerStyle={{
          paddingBottom: bottomBarHeight,
        }}
      >
        {/* Option "Toutes les couleurs" */}
        <ColorRow onPress={() => onSelect(undefined)}>
          <Checkbox checked={!selectedColorId} marginRight={12} />
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
            {selectedColorId === color.id && <FeatherIcon name="check" size={20} color="primary" />}
          </ColorRow>
        ))}
      </SheetScrollView>
    </Sheet>
  )
})

ColorFilterModal.displayName = 'ColorFilterModal'

export default ColorFilterModal
