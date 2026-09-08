import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import type { Theme as AppTheme } from '~themes'

import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { useAllColors } from '~helpers/useColorName'

const ColorCircle = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { color: string } | 'theme'> &
    Omit<{ color: string }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { color } = props
  const classStyles = useResolveClassNames(
    twMerge('w-[24px] h-[24px] rounded-[6px] mr-[12px]', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={
        [classStyles, { backgroundColor: color }, props.style] as UIComponentProps<
          typeof NativeUI.View
        >['style']
      }
    />
  )
}

const ColorRow = (
  componentProps: Omit<UIComponentProps<typeof TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[16px] border-b-[1px] border-b-border', className)
  )
  return (
    <TouchableOpacity
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof TouchableOpacity>['style']}
    />
  )
}

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
          <Checkbox className="mr-[12px]" checked={!selectedColorId} />
          <Text className="flex-[1] text-[16px]">{t('Toutes les couleurs')}</Text>
          {!selectedColorId && <FeatherIcon name="check" size={20} color="primary" />}
        </ColorRow>

        {/* Liste des couleurs */}
        {allColors.map(color => (
          <ColorRow key={color.id} onPress={() => onSelect(color.id)}>
            <ColorCircle color={color.hex} />
            <Text className="flex-[1] text-[16px]">{color.name}</Text>
            {selectedColorId === color.id && <FeatherIcon name="check" size={20} color="primary" />}
          </ColorRow>
        ))}
      </SheetScrollView>
    </Sheet>
  )
})

ColorFilterModal.displayName = 'ColorFilterModal'

export default ColorFilterModal
