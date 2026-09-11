import { twMerge } from '~common/ui/classNames'

import { forwardRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { SearchItemFilters, SearchItemType } from '~state/searchFilters'
import { searchItemFilterConfig, searchItemFilterOrder } from './shared/SearchItemFilterBar'
import SearchTypeIcon from './shared/SearchTypeIcon'
export type SearchSourceFiltersProps = {
  itemFilters: SearchItemFilters
  enabledTypes?: SearchItemType[]
  emptyMeansAll?: boolean
  showPassageFilters?: boolean
  passageFilterCount: number
  onToggle: (type: SearchItemType) => void
  onReset: () => void
  onOpenPassageFilters: () => void
}

const SearchSourceFiltersSheet = forwardRef<SheetRef, SearchSourceFiltersProps>(
  (
    {
      itemFilters,
      passageFilterCount,
      onToggle,
      onReset,
      onOpenPassageFilters,
      enabledTypes = searchItemFilterOrder,
      emptyMeansAll = false,
      showPassageFilters = true,
    },
    ref
  ) => {
    const { t } = useTranslation()
    const allSelected = enabledTypes.every(type => itemFilters[type])

    return (
      <Sheet
        ref={ref}
        header={
          <SheetHeader
            title={t('search.sourceFilters.title')}
            rightComponent={
              !allSelected ? (
                <Box className="overflow-hidden border-continuous mr-[12px]">
                  <TouchableBox
                    className="overflow-hidden border-continuous px-[8px] py-[8px]"
                    onPress={onReset}
                  >
                    <Text className="text-primary text-[14px]">{t('Réinitialiser')}</Text>
                  </TouchableBox>
                </Box>
              ) : undefined
            }
          />
        }
      >
        <SheetScrollView>
          {enabledTypes.map(type => {
            const config = searchItemFilterConfig[type]
            const checked =
              !!itemFilters[type] && (!emptyMeansAll || !allSelected || enabledTypes.length === 1)

            return (
              <HStack
                className="border-continuous overflow-hidden min-h-[56px] items-stretch border-b-[1px] border-border"
                key={type}
              >
                <TouchableBox
                  className="overflow-hidden border-continuous flex-[1] flex-row items-center px-[16px] py-[12px]"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => onToggle(type)}
                >
                  <Checkbox
                    className="mr-[12px]"
                    checked={checked}
                    fillChecked
                    checkColor="reverse"
                  />
                  <SearchTypeIcon type={type} color={checked ? config.color : 'tertiary'} />
                  <Text
                    className={twMerge(
                      checked ? 'text-default' : 'text-tertiary',
                      'ml-[12px] text-[16px]'
                    )}
                  >
                    {t(config.labelKey)}
                  </Text>
                </TouchableBox>

                {showPassageFilters && type === 'passages' ? (
                  <TouchableBox
                    className="overflow-hidden border-continuous min-w-[64px] items-center justify-center"
                    accessibilityLabel={t('search.passageFilters.title')}
                    onPress={onOpenPassageFilters}
                  >
                    {passageFilterCount ? (
                      <HStack className="overflow-hidden border-continuous bg-primary min-w-[42px] h-[24px] rounded-[12px] items-center justify-center gap-[3px] px-[7px]">
                        <Text
                          className="text-reverse text-[13px] font-bold"
                          style={{ fontVariant: ['tabular-nums'] }}
                        >
                          {passageFilterCount}
                        </Text>
                        <FeatherIcon name="sliders" size={13} color="reverse" />
                      </HStack>
                    ) : (
                      <FeatherIcon name="sliders" size={19} color="tertiary" />
                    )}
                  </TouchableBox>
                ) : null}
              </HStack>
            )
          })}
        </SheetScrollView>
      </Sheet>
    )
  }
)

SearchSourceFiltersSheet.displayName = 'SearchSourceFiltersSheet'

export default SearchSourceFiltersSheet
