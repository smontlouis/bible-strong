import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import { HStack } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
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
      <FilterHeaderButtonContent
        activeFilterCount={activeFilterCount}
        activeFilterIcon={activeFilterIcon}
      />
    </TouchableOpacity>
  )
}

export default FilterHeaderButton

export const FilterHeaderButtonContent = ({
  activeFilterCount,
  activeFilterIcon,
}: Omit<Props, 'onPress'>) => {
  return (
    <HStack
      testID="filter-header-button-content"
      className={
        activeFilterCount
          ? 'overflow-hidden border-continuous items-center justify-center px-[15px] h-[48px]'
          : 'overflow-hidden border-continuous items-center justify-center w-[48px] h-[48px] mr-2.5'
      }
    >
      {activeFilterCount ? (
        <HStack className="bg-primary min-w-[50px] h-[22px] rounded-[13px] items-stretch">
          <HStack className="min-w-[28px] pl-[8px] pr-[6px] items-center justify-center">
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
          <HStack className="pl-[4px] pr-[6px] border-l-[2px] border-l-reverse items-center justify-center">
            <FeatherIcon name="chevron-down" size={13} color="reverse" />
          </HStack>
        </HStack>
      ) : (
        <IonIcon name="filter" size={20} color="default" />
      )}
    </HStack>
  )
}
