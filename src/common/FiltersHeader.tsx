import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetView } from '~common/bottom-sheet'
import React, { memo, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Back from '~common/Back'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { ContainerComponent } from './Modal'

const TouchableBox = styled.TouchableOpacity({
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'flex-end',
  paddingRight: 15,
  paddingVertical: 15,
})

const StyledText = styled(Text)({
  fontSize: 14,
  marginRight: 5,
})

const HeaderBox = styled(Box)(({ theme }) => ({
  alignItems: 'center',
  minHeight: 54,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const SheetHeader = styled.View(({ theme }) => ({
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

export type FiltersHeaderItem = {
  key: string
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  value: string
  color?: string
  onPress: () => void
}

type Props = {
  title: string
  filterLabel?: string
  hasBackButton?: boolean
  filters: FiltersHeaderItem[]
  hasActiveFilters?: boolean
  onReset?: () => void
}

const FiltersHeader = ({
  title,
  filterLabel,
  hasBackButton,
  filters,
  hasActiveFilters,
  onReset,
}: Props) => {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const filtersRef = useRef<BottomSheetModal>(null)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  const openFilters = () => {
    filtersRef.current?.present()
  }

  return (
    <>
      <HeaderBox row bg="reverse">
        {hasBackButton ? (
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        ) : (
          <Box width={15} />
        )}
        <Box flex justifyContent="center">
          <Text fontSize={16} bold>
            {title}
          </Text>
        </Box>
        <TouchableBox onPress={openFilters}>
          <StyledText numberOfLines={1}>{filterLabel || t('Filtrer')}</StyledText>
          <FeatherIcon name="chevron-down" size={15} />
        </TouchableBox>
      </HeaderBox>
      <BottomSheetModal
        ref={filtersRef}
        topInset={insets.top}
        enablePanDownToClose
        enableDynamicSizing
        backdropComponent={renderBackdrop}
        containerComponent={ContainerComponent}
        activeOffsetY={[-20, 20]}
        key={key}
        {...bottomSheetStyles}
      >
        <BottomSheetView>
          <SheetHeader>
            <Text bold fontSize={18}>
              {t('Filtres')}
            </Text>
            {hasActiveFilters && onReset && (
              <ResetButton onPress={onReset}>
                <Text color="primary" fontSize={14}>
                  {t('Réinitialiser')}
                </Text>
              </ResetButton>
            )}
          </SheetHeader>
          {filters.map(filter => (
            <FilterRow key={filter.key} onPress={filter.onPress}>
              <Box row flex={1}>
                <FeatherIcon name={filter.icon} size={20} color="tertiary" />
                <Text marginLeft={12} fontSize={16}>
                  {filter.label}
                </Text>
              </Box>
              <Box row center>
                {!!filter.color && <ColorCircle color={filter.color} />}
                <Text
                  color="tertiary"
                  fontSize={14}
                  marginRight={8}
                  numberOfLines={1}
                  maxWidth={200}
                >
                  {filter.value}
                </Text>
                <FeatherIcon name="chevron-right" size={20} color="tertiary" />
              </Box>
            </FilterRow>
          ))}
          <Box height={insets.bottom + 16} />
        </BottomSheetView>
      </BottomSheetModal>
    </>
  )
}

export default memo(FiltersHeader)
