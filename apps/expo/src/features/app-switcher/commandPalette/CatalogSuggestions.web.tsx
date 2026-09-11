import { tabContentKey } from './priorities'
import { useSelectCatalogResult } from '~features/search/discovery/useSelectCatalogResult'
import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import { useState } from 'react'
import { useCatalogSearch } from '~features/search/discovery/useCatalogSearch'
import type { CatalogScope } from '~features/search/discovery/catalogSearch'
import type { TabItem } from '~state/tabs'
import generateUUID from '~helpers/generateUUID'
import TabIcon from '../utils/getIconByTabType'

export default function CatalogSuggestions({
  query,
  scope,
  onSelect,
  excludedKeys = [],
}: {
  query: string
  excludedKeys?: string[]
  scope?: CatalogScope
  onSelect: (tab: TabItem) => void
}) {
  const { t } = useTranslation()
  const selection = useSelectCatalogResult(onSelect)
  const { items, loading, error, retry } = useCatalogSearch(query, scope)
  const [limit, setLimit] = useState<Partial<Record<CatalogScope, number>>>({})
  return (
    <>
      {(['commentary', 'plan', 'timeline'] as const)
        .filter(type => !scope || type === scope)
        .map(type => {
          const matches = items.filter(
            item => item.type === type && !excludedKeys.includes(tabContentKey(item.tab) || '')
          )
          const visibleLimit = limit[type] ?? (scope ? 12 : 3)
          if (!matches.length) return null
          return (
            <Command.Group key={type} heading={t(type === 'plan' ? 'Plans' : `tabs.${type}`)}>
              {matches.slice(0, visibleLimit).map(item => (
                <Command.Item
                  key={item.id}
                  value={item.id}
                  disabled={selection.loading}
                  onSelect={() =>
                    void selection.select({ ...item.tab, id: generateUUID() } as TabItem)
                  }
                >
                  <span className="bs-command-item-label">
                    <span className="bs-command-item-icon">
                      <TabIcon type={type} size={16} />
                    </span>
                    <span className="bs-command-content-text">
                      <span className="bs-command-item-text">{item.title}</span>
                      <span className="bs-command-description">{item.subtitle}</span>
                    </span>
                  </span>
                </Command.Item>
              ))}
              {matches.length > visibleLimit && (
                <Command.Item
                  value={`more:${type}`}
                  onSelect={() => setLimit(value => ({ ...value, [type]: visibleLimit + 12 }))}
                >
                  {t('Voir plus')}
                </Command.Item>
              )}
            </Command.Group>
          )
        })}
      {(loading || selection.loading) && (
        <div className="bs-command-status">{t('Chargement...')}</div>
      )}
      {error && (
        <Command.Item value="catalog:retry" onSelect={retry}>
          {t('Réessayer')}
        </Command.Item>
      )}
      {scope && !loading && !items.length && (
        <div className="bs-command-status">{t('commandPalette.noResults')}</div>
      )}
    </>
  )
}
