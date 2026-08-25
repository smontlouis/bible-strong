import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'

import { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

type Props = {
  activeFilterCount: number
  activeFilterIcon?: React.ComponentProps<typeof FeatherIcon>['name']
  onPress: () => void
}

const FilterHeaderButton = ({ activeFilterCount, activeFilterIcon, onPress }: Props) => {
  const { t } = useTranslation()
  const accessibilityLabel =
    activeFilterCount === 0
      ? t('Filtrer')
      : activeFilterCount === 1
        ? t('filters.activeCount_one', { count: activeFilterCount })
        : t('filters.activeCount_other', { count: activeFilterCount })

  return (
    <TouchableOpacity
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
    >
      <HStack alignItems="center" justifyContent="flex-end" px={15} py={15} minHeight={48}>
        {activeFilterCount ? (
          <HStack bg="primary" minWidth={50} height={22} borderRadius={13} alignItems="stretch">
            <HStack minWidth={28} pl={8} pr={6} center>
              {activeFilterCount === 1 && activeFilterIcon ? (
                <FeatherIcon name={activeFilterIcon} size={14} color="reverse" />
              ) : (
                <Text color="reverse" fontSize={14} bold style={{ fontVariant: ['tabular-nums'] }}>
                  {activeFilterCount}
                </Text>
              )}
            </HStack>
            <HStack pl={4} pr={6} borderLeftWidth={2} borderLeftColor="reverse" center>
              <FeatherIcon name="chevron-down" size={13} color="reverse" />
            </HStack>
          </HStack>
        ) : (
          <>
            <Text fontSize={14} mr={5} numberOfLines={1}>
              {t('Filtrer')}
            </Text>
            <FeatherIcon name="chevron-down" size={15} />
          </>
        )}
      </HStack>
    </TouchableOpacity>
  )
}

export default FilterHeaderButton
