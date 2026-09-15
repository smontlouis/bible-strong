import { FilterHeaderButtonContent } from './FilterHeaderButton'
import FilterChoices from './FilterChoices'
import { useTranslation } from 'react-i18next'
import { Platform } from 'react-native'
import { useState, type ComponentProps, type ReactNode } from 'react'
import PanelSearch from './ContextualPanel/PanelSearch'
import { useTheme } from '~themes/ThemeProvider'
import { resolveThemeColor } from '~themes/colorValues'
import { FeatherIcon } from '~common/ui/Icon'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import PageContent from '~common/ui/PageContent'
import Back from './Back'
import ContextualPanel from './ContextualPanel'
import type { PanelScreen } from './ContextualPanel/types'
export type FiltersHeaderItem = {
  key: string
  icon: ComponentProps<typeof FeatherIcon>['name']
  label: string
  value?: string
  color?: string
  active?: boolean
  onPress: () => void
  content?: PanelScreen['content']
  searchable?: boolean
  showCheckbox?: boolean
  options?: {
    key: string
    label: string
    selected: boolean
    color?: string
    onSelect: () => void
  }[]
}
export default function FiltersHeader({
  title,
  children,
  hasBackButton,
  filters,
  onReset,
  buttonOnly = false,
}: {
  title: string
  children?: ReactNode
  buttonOnly?: boolean
  hasBackButton?: boolean
  filters: FiltersHeaderItem[]
  onReset?: () => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const [searches, setSearches] = useState<Record<string, string>>({})
  const isWeb = Platform.OS === 'web'
  const activeCount = filters.filter(filter => filter.active).length
  const reset =
    activeCount > 0 && onReset ? (
      <TouchableBox onPress={onReset} accessibilityRole="button" className="p-2">
        <Text className="text-primary text-[12px]">{t('Réinitialiser')}</Text>
      </TouchableBox>
    ) : undefined
  const screens: Record<string, PanelScreen> = {
    filters: {
      title: t('Filtres'),
      headerRight: reset,
      content: navigation => (
        <>
          {filters.map(filter => (
            <TouchableBox
              key={filter.key}
              accessibilityRole="button"
              className={
                isWeb
                  ? 'w-full flex-row items-center gap-3 p-3 rounded-lg'
                  : 'w-full flex-row items-center gap-3 p-[16px] border-b-[1px] border-border'
              }
              onPress={() => {
                if (filter.options || filter.content) navigation.open(filter.key)
                else {
                  navigation.close()
                  filter.onPress()
                }
              }}
            >
              <FeatherIcon
                name={filter.icon}
                size={isWeb ? 17 : 20}
                color={filter.active ? 'primary' : 'tertiary'}
              />
              <Text
                className={`flex-1 ${isWeb ? 'text-[14px]' : 'text-[16px]'} ${filter.active ? 'text-primary' : 'text-default'}`}
              >
                {filter.label}
              </Text>
              {!!filter.color && (
                <Box
                  className="w-5 h-5 rounded-md"
                  style={{ backgroundColor: resolveThemeColor(theme, filter.color) }}
                />
              )}
              <Text
                className={
                  isWeb
                    ? 'text-[12px] text-tertiary max-w-[130px]'
                    : 'text-[14px] text-tertiary max-w-[200px]'
                }
                numberOfLines={1}
              >
                {filter.value}
              </Text>
              <FeatherIcon name="chevron-right" size={isWeb ? 15 : 20} color="tertiary" />
            </TouchableBox>
          ))}
        </>
      ),
    },
  }
  for (const filter of filters) {
    if (filter.content) {
      screens[filter.key] = { title: filter.label, headerRight: reset, content: filter.content }
      continue
    }
    if (!filter.options) continue
    screens[filter.key] = {
      title: filter.label,
      headerRight: reset,
      headerContent: filter.searchable ? (
        <PanelSearch
          value={searches[filter.key] ?? ''}
          onChange={query => setSearches(current => ({ ...current, [filter.key]: query }))}
        />
      ) : undefined,
      content: () => (
        <FilterChoices
          options={filter.options!}
          query={searches[filter.key] ?? ''}
          showCheckbox={filter.showCheckbox}
        />
      ),
    }
  }
  const filterButton = (
    <ContextualPanel
      accessibilityLabel={
        activeCount
          ? t(activeCount === 1 ? 'filters.activeCount_one' : 'filters.activeCount_other', {
              count: activeCount,
            })
          : t('Filtrer')
      }
      initialScreen="filters"
      onClose={() => setSearches({})}
      screens={screens}
      trigger={
        <FilterHeaderButtonContent
          activeFilterCount={activeCount}
          activeFilterIcon={filters.find(filter => filter.active)?.icon}
        />
      }
    />
  )
  if (buttonOnly) return filterButton
  return (
    <Box className="bg-reverse border-b border-border" testID="workspace-page-header">
      <PageContent className="min-h-[54px] items-center flex-row">
        {hasBackButton ? (
          <Back padding>
            <FeatherIcon name="arrow-left" size={20} />
          </Back>
        ) : (
          <Box className="w-[15px]" />
        )}
        <Text className="flex-1 text-[14px] font-bold">{title}</Text>
        {filterButton}
      </PageContent>
      {children && <PageContent>{children}</PageContent>}
    </Box>
  )
}
