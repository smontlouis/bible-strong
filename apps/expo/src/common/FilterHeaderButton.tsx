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
      <HStack className="overflow-hidden border-continuous items-center justify-end px-[15px] py-[15px] min-h-[48px]">
        {activeFilterCount ? (
          <HStack className="overflow-hidden border-continuous bg-primary min-w-[50px] h-[22px] rounded-[13px] items-stretch">
            <HStack className="overflow-hidden border-continuous min-w-[28px] pl-[8px] pr-[6px] items-center justify-center">
              {activeFilterCount === 1 && activeFilterIcon ? (
                <FeatherIcon name={activeFilterIcon} size={14} color="reverse" />
              ) : (
                <Text
                  className="text-reverse text-[14px] font-bold"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {activeFilterCount}
                </Text>
              )}
            </HStack>
            <HStack className="overflow-hidden border-continuous pl-[4px] pr-[6px] border-l-[2px] items-center justify-center">
              <FeatherIcon name="chevron-down" size={13} color="reverse" />
            </HStack>
          </HStack>
        ) : (
          <>
            <Text className="text-[14px] mr-[5px]" numberOfLines={1}>
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
