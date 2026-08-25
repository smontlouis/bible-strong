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

type Props = {
  itemFilters: SearchItemFilters
  passageFilterCount: number
  onToggle: (type: SearchItemType) => void
  onReset: () => void
  onOpenPassageFilters: () => void
}

const SearchSourceFiltersSheet = forwardRef<SheetRef, Props>(
  ({ itemFilters, passageFilterCount, onToggle, onReset, onOpenPassageFilters }, ref) => {
    const { t } = useTranslation()
    const allSelected = searchItemFilterOrder.every(type => itemFilters[type])

    return (
      <Sheet
        ref={ref}
        header={
          <SheetHeader
            title={t('search.sourceFilters.title')}
            rightComponent={
              !allSelected ? (
                <Box mr={12}>
                  <TouchableBox onPress={onReset} px={8} py={8}>
                    <Text color="primary" fontSize={14}>
                      {t('Réinitialiser')}
                    </Text>
                  </TouchableBox>
                </Box>
              ) : undefined
            }
          />
        }
      >
        <SheetScrollView>
          {searchItemFilterOrder.map(type => {
            const config = searchItemFilterConfig[type]
            const checked = itemFilters[type]

            return (
              <HStack
                key={type}
                minHeight={56}
                alignItems="stretch"
                borderBottomWidth={1}
                borderColor="border"
              >
                <TouchableBox
                  flex={1}
                  row
                  alignItems="center"
                  px={16}
                  py={12}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => onToggle(type)}
                >
                  <Checkbox checked={checked} fillChecked checkColor="reverse" mr={12} />
                  <SearchTypeIcon type={type} color={checked ? config.color : 'tertiary'} />
                  <Text ml={12} fontSize={16} color={checked ? undefined : 'tertiary'}>
                    {t(config.labelKey)}
                  </Text>
                </TouchableBox>

                {type === 'passages' ? (
                  <TouchableBox
                    minWidth={64}
                    center
                    accessibilityLabel={t('search.passageFilters.title')}
                    onPress={onOpenPassageFilters}
                  >
                    {passageFilterCount ? (
                      <HStack
                        bg="primary"
                        minWidth={42}
                        height={24}
                        borderRadius={12}
                        center
                        gap={3}
                        px={7}
                      >
                        <Text
                          color="reverse"
                          fontSize={13}
                          bold
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
