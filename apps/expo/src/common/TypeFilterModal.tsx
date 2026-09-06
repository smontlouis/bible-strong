import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { TouchableOpacity } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import type { Theme as AppTheme } from '~themes'

import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

const TypeRow = (
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

const SectionHeader = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('p-[16px] pb-[8px] bg-light-grey', className))
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

type Props = {
  selectedType?: string // 'all' | 'annotations' | VersionCode
  availableVersions: string[] // List of versions with annotations
  onSelect: (type: string | undefined) => void
}

const TypeFilterModal = forwardRef<SheetRef, Props>(
  ({ selectedType, availableVersions, onSelect }, ref) => {
    const { t } = useTranslation()
    const { bottomBarHeight } = useBottomBarHeightInTab()

    const isAllSelected = !selectedType || selectedType === 'all'
    const isAnnotationsSelected = selectedType === 'annotations'
    const isHighlightsSelected = selectedType === 'highlights'

    return (
      <Sheet ref={ref} snapPoints={[0.5]} header={<SheetHeader title={t('Filtrer par type')} />}>
        <SheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight,
          }}
        >
          {/* Option "Tout" */}
          <TypeRow onPress={() => onSelect(undefined)}>
            <Checkbox className="mr-[12px]" checked={isAllSelected} />
            <Text className="flex-[1] text-[16px]">{t('Tout')}</Text>
            {isAllSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </TypeRow>

          <TypeRow onPress={() => onSelect('highlights')}>
            <Checkbox className="mr-[12px]" checked={isHighlightsSelected} />
            <Text className="flex-[1] text-[16px]">{t('Surbrillances')}</Text>
            {isHighlightsSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </TypeRow>

          {/* Option "Annotations" (toutes) */}
          <TypeRow onPress={() => onSelect('annotations')}>
            <Checkbox className="mr-[12px]" checked={isAnnotationsSelected} />
            <Text className="flex-[1] text-[16px]">{t('Annotations')}</Text>
            {isAnnotationsSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </TypeRow>

          {/* Section versions when present */}
          {availableVersions.length > 0 && (
            <>
              <SectionHeader>
                <Text className="text-tertiary text-[13px] font-bold">{t('Par version')}</Text>
              </SectionHeader>

              {availableVersions.map(version => {
                const isSelected = selectedType === version
                return (
                  <TypeRow key={version} onPress={() => onSelect(version)}>
                    <Checkbox className="mr-[12px]" checked={isSelected} />
                    <Text className="flex-[1] text-[16px]">{version}</Text>
                    {isSelected && <FeatherIcon name="check" size={20} color="primary" />}
                  </TypeRow>
                )
              })}
            </>
          )}
        </SheetScrollView>
      </Sheet>
    )
  }
)

TypeFilterModal.displayName = 'TypeFilterModal'

export default TypeFilterModal
