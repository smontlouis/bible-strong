import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import React, { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'

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
      <HStack
        bg="reverse"
        alignItems="center"
        minHeight={54}
        borderBottomWidth={1}
        borderColor="border"
      >
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
        <Box flex alignItems="flex-end">
          <FilterHeaderButton
            activeFilterCount={activeFilterCount}
            activeFilterIcon={activeFilterIcon}
            onPress={openFilters}
          />
        </Box>
      </HStack>
      <Sheet
        ref={filtersRef}
        header={
          <SheetHeader
            title={t('Filtres')}
            rightComponent={
              activeFilterCount > 0 && onReset ? (
                <Box mr={12}>
                  <TouchableOpacity onPress={onReset}>
                    <Box py={4} px={8}>
                      <Text color="primary" fontSize={14}>
                        {t('Réinitialiser')}
                      </Text>
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
            <TouchableOpacity key={filter.key} onPress={filter.onPress}>
              <HStack alignItems="center" p={16} borderBottomWidth={1} borderColor="border">
                <Box row flex={1}>
                  <FeatherIcon
                    name={filter.icon}
                    size={20}
                    color={filter.active ? 'primary' : 'tertiary'}
                  />
                  <Text color={filter.active ? 'primary' : undefined} marginLeft={12} fontSize={16}>
                    {filter.label}
                  </Text>
                </Box>
                <Box row center>
                  {!!filter.color && <Box size={20} borderRadius={10} bg={filter.color} mr={8} />}
                  {!!filter.value && (
                    <Text
                      color="tertiary"
                      fontSize={14}
                      marginRight={8}
                      numberOfLines={1}
                      maxWidth={200}
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
