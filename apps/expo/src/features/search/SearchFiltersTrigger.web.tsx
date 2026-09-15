import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import type { PanelScreen } from '~common/ContextualPanel/types'
import FilterChoices from '~common/FilterChoices'
import { FilterHeaderButtonContent } from '~common/FilterHeaderButton'
import { HStack, TouchableBox } from '~common/ui/Box'
import Checkbox from '~common/ui/Checkbox'
import Text from '~common/ui/Text'
import type { SearchFiltersTriggerProps } from './SearchFiltersTrigger'
import { searchItemFilterConfig, searchItemFilterOrder } from './shared/SearchItemFilterBar'
import SearchTypeIcon from './shared/SearchTypeIcon'

export default function SearchFiltersTrigger({
  initialScreen,
  activeCount,
  passages: p,
  sources: s,
}: SearchFiltersTriggerProps) {
  const { t } = useTranslation()
  const [query, setQuery] = useState('')
  const enabledTypes = s.enabledTypes ?? searchItemFilterOrder
  const choice = <T extends string | number>(
    key: string,
    label: string,
    icon: 'book-open' | 'layers' | 'columns' | 'bookmark' | 'list',
    value: T,
    choices: { value: T; label: string }[],
    onSelect: (value: T) => void
  ) => ({
    key,
    label,
    icon,
    value: choices.find(option => option.value === value)?.label,
    options: choices.map(option => ({
      key: String(option.value),
      label: option.label,
      selected: option.value === value,
      onSelect: () => onSelect(option.value),
    })),
  })
  const filters = [
    ...(p.versionChoices.length > 1
      ? [
          choice(
            'version',
            t('Version'),
            'book-open',
            p.selectedVersion,
            p.versionChoices,
            p.onVersionChange
          ),
        ]
      : []),
    choice('canon', t('Canon'), 'layers', p.canon, p.canonChoices, p.onCanonChange),
    choice('section', t('Section'), 'columns', p.section, p.sectionChoices, p.onSectionChange),
    choice('book', t('Livre'), 'bookmark', p.book, p.bookChoices, p.onBookChange),
    choice('order', t('Ordre'), 'list', p.sortOrder, p.sortOrderChoices, p.onSortOrderChange),
  ]
  const reset = (onPress: () => void) => (
    <TouchableBox className="p-2" onPress={onPress} accessibilityRole="button">
      <Text className="text-primary text-[12px]">{t('Réinitialiser')}</Text>
    </TouchableBox>
  )
  const screens: Record<string, PanelScreen> = {
    sources: {
      title: t('search.sourceFilters.title'),
      headerRight: enabledTypes.every(type => s.itemFilters[type]) ? undefined : reset(s.onReset),
      content: navigation => (
        <>
          {enabledTypes.map(type => {
            const config = searchItemFilterConfig[type]
            const checked = !!s.itemFilters[type]
            return (
              <HStack key={type} className="items-center">
                <TouchableBox
                  className="flex-1 flex-row items-center gap-3 p-3 rounded-lg"
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked }}
                  onPress={() => s.onToggle(type)}
                >
                  <Checkbox checked={checked} size={22} />
                  <SearchTypeIcon type={type} color={checked ? config.color : 'tertiary'} />
                  <Text className="flex-1 text-[14px]">{t(config.labelKey)}</Text>
                </TouchableBox>
              </HStack>
            )
          })}
          {s.showPassageFilters !== false && (
            <PanelAction
              label={t('search.passageFilters.title')}
              icon="sliders"
              nested
              onPress={() => navigation.open('passages')}
            />
          )}
        </>
      ),
    },
    passages: {
      title: t('search.passageFilters.title'),
      headerRight: s.passageFilterCount ? reset(p.onReset) : undefined,
      content: navigation => (
        <>
          {filters.map(filter => (
            <PanelAction
              key={filter.key}
              label={`${filter.label} · ${filter.value ?? ''}`}
              icon={filter.icon}
              nested
              onPress={() => {
                setQuery('')
                navigation.open(filter.key)
              }}
            />
          ))}
        </>
      ),
    },
  }
  for (const filter of filters) {
    screens[filter.key] = {
      title: filter.label,
      headerContent:
        filter.key === 'book' || filter.key === 'version' ? (
          <PanelSearch value={query} onChange={setQuery} />
        ) : undefined,
      content: navigation => (
        <FilterChoices
          query={query}
          options={filter.options.map(option => ({
            ...option,
            onSelect: () => {
              option.onSelect()
              setQuery('')
              navigation.back()
            },
          }))}
        />
      ),
    }
  }
  return (
    <ContextualPanel
      accessibilityLabel={t('Filtrer')}
      initialScreen={initialScreen}
      screens={screens}
      onClose={() => setQuery('')}
      trigger={<FilterHeaderButtonContent activeFilterCount={activeCount} />}
    />
  )
}
