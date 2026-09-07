import { twMerge } from '~common/ui/classNames'
import { resolveThemeColor } from '~themes/colorValues'
import { useTheme as useStylingTheme } from '~themes/ThemeProvider'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import PageContent from '~common/ui/PageContent'
import Back from '~common/Back'
import FilterHeaderButton from '~common/FilterHeaderButton'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
export type FiltersHeaderItem = {
  key: string
  icon: React.ComponentProps<typeof FeatherIcon>['name']
  label: string
  value?: string
  color?: string
  active?: boolean
  onPress: () => void
}

type Props = {
  title: string
  hasBackButton?: boolean
  filters: FiltersHeaderItem[]
  onReset?: () => void
}

const FiltersHeader = ({ title, hasBackButton, filters, onReset }: Props) => {
  const stylingTheme = useStylingTheme()

  const { t } = useTranslation()
  const filtersRef = useRef<SheetRef>(null)
  const activeFilters = filters.filter(filter => filter.active)
  const activeFilterCount = activeFilters.length
  const activeFilterIcon = activeFilters[0]?.icon
  const openFilters = () => {
    filtersRef.current?.present()
  }

  return (
    <>
      <Box className="border-continuous overflow-hidden bg-reverse border-b-[1px] border-border">
        <PageContent className="min-h-[54px] items-center flex-row">
          {hasBackButton ? (
            <Back padding>
              <FeatherIcon name="arrow-left" size={20} />
            </Back>
          ) : (
            <Box className="overflow-hidden border-continuous w-[15px]" />
          )}
          <Box className="overflow-hidden border-continuous flex-[1] justify-center">
            <Text className="text-[14px] font-bold" numberOfLines={1}>
              {title}
            </Text>
          </Box>
          <Box className="overflow-hidden border-continuous items-end">
            <FilterHeaderButton
              activeFilterCount={activeFilterCount}
              activeFilterIcon={activeFilterIcon}
              onPress={openFilters}
            />
          </Box>
        </PageContent>
      </Box>
      <Sheet
        ref={filtersRef}
        header={
          <SheetHeader
            title={t('Filtres')}
            rightComponent={
              activeFilterCount > 0 && onReset ? (
                <Box className="overflow-hidden border-continuous mr-[12px]">
                  <TouchableOpacity accessibilityRole="button" onPress={onReset}>
                    <Box className="overflow-hidden border-continuous py-[4px] px-[8px]">
                      <Text className="text-primary text-[14px]">{t('Réinitialiser')}</Text>
                    </Box>
                  </TouchableOpacity>
                </Box>
              ) : undefined
            }
          />
        }
      >
        <SheetView>
          {filters.map(filter => (
            <TouchableOpacity accessibilityRole="button" key={filter.key} onPress={filter.onPress}>
              <HStack className="border-continuous overflow-hidden items-center p-[16px] border-b-[1px] border-border">
                <Box className="overflow-hidden border-continuous flex-row flex-[1]">
                  <FeatherIcon
                    name={filter.icon}
                    size={20}
                    color={filter.active ? 'primary' : 'tertiary'}
                  />
                  <Text
                    className={twMerge(
                      filter.active ? 'text-primary' : 'text-default',
                      'ml-[12px] text-[16px]'
                    )}
                  >
                    {filter.label}
                  </Text>
                </Box>
                <Box className="overflow-hidden border-continuous flex-row items-center justify-center">
                  {!!filter.color && (
                    <Box
                      className="overflow-hidden border-continuous rounded-[10px] mr-[8px]"
                      style={{
                        backgroundColor: resolveThemeColor(stylingTheme, filter.color),
                        width: 20,
                        height: 20,
                      }}
                    />
                  )}
                  {!!filter.value && (
                    <Text
                      className="text-tertiary text-[14px] mr-[8px] max-w-[200px]"
                      numberOfLines={1}
                    >
                      {filter.value}
                    </Text>
                  )}
                  <FeatherIcon name="chevron-right" size={20} color="tertiary" />
                </Box>
              </HStack>
            </TouchableOpacity>
          ))}
        </SheetView>
      </Sheet>
    </>
  )
}

export default FiltersHeader
