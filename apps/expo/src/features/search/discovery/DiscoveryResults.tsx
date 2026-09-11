import { useSelectCatalogResult } from './useSelectCatalogResult'
import { useTranslation } from 'react-i18next'
import { parseBibleReferenceInput } from '~helpers/bcvParser'
import { getReferenceSearchItemsFromSegments } from '../shared/searchItems'
import { createScopedPassageTab } from '~features/app-switcher/commandPalette/scopes'
import type { TabItem, VersionCode } from '~state/tabs'
import generateUUID from '~helpers/generateUUID'
import Box, { HStack, TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import PassageActionButton from './PassageActionButton'
import { useCatalogSearch } from './useCatalogSearch'
import type { CatalogScope } from './catalogSearch'

export function PassageResults({
  query,
  version,
  compareOnly,
  singleAction = false,
  onSelect,
}: {
  query: string
  version: VersionCode
  compareOnly?: boolean
  singleAction?: boolean
  onSelect: (tab: TabItem) => void
}) {
  const { t, i18n } = useTranslation()
  const parsed = parseBibleReferenceInput(query, i18n.language.startsWith('fr') ? 'fr' : 'en')
  const items = parsed.isExact ? getReferenceSearchItemsFromSegments(parsed.segments) : []
  return (
    <Box>
      {items.map(item => {
        const open = (compare: boolean) => {
          const tab = createScopedPassageTab(compare ? 'compare' : 'bible', item, version)
          if (tab) onSelect(tab)
        }
        return (
          <HStack key={item.id} className="items-center px-[12px] py-[8px] gap-[8px]">
            <TouchableBox
              className="flex-1 py-[12px]"
              accessibilityRole="button"
              onPress={() => open(!!compareOnly)}
            >
              <Text>{item.title}</Text>
            </TouchableBox>
            {(singleAction ? [!!compareOnly] : [false, true]).map(compare => (
              <PassageActionButton
                key={String(compare)}
                compare={compare}
                onPress={() => open(compare)}
              />
            ))}
          </HStack>
        )
      })}
      {!items.length && (
        <Text className="p-[16px] text-grey text-[14px]">
          {t('commandPalette.passagePlaceholder')}
        </Text>
      )}
    </Box>
  )
}

export function CatalogResults({
  query,
  scope,
  onSelect,
  limit,
}: {
  query: string
  scope?: CatalogScope
  onSelect: (tab: TabItem) => void
  limit?: number
}) {
  const { t } = useTranslation()
  const selection = useSelectCatalogResult(onSelect)
  const { items, loading, error, retry } = useCatalogSearch(query, scope)
  return (
    <Box>
      {items
        .filter(
          (item, index) =>
            limit === undefined ||
            items.slice(0, index).filter(previous => previous.type === item.type).length < limit
        )
        .map(item => (
          <TouchableBox
            key={item.id}
            accessibilityRole="button"
            disabled={selection.loading}
            onPress={() => void selection.select({ ...item.tab, id: generateUUID() } as TabItem)}
            className="p-[12px] rounded-lg hover:bg-light-grey gap-[4px]"
          >
            <Text className="text-[15px]">{item.title}</Text>
            <Text className="text-grey text-[12px]">
              {item.subtitle || t(item.type === 'plan' ? 'Plans' : `tabs.${item.type}`)}
            </Text>
          </TouchableBox>
        ))}
      {(loading || selection.loading) && (
        <Text className="p-[12px] text-grey">{t('Chargement...')}</Text>
      )}
      {error && (
        <TouchableBox onPress={retry} accessibilityRole="button" className="p-[12px]">
          <Text>{t('Réessayer')}</Text>
        </TouchableBox>
      )}
      {scope && !items.length && !loading && !error && (
        <Text className="p-[12px] text-grey">{t('commandPalette.noResults')}</Text>
      )}
    </Box>
  )
}
