import { contentPriority, resultContentKey } from './priorities'
import { getPassageSearchExcerpt } from '~features/search/shared/searchPassageExcerpt'
import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import type { SearchItemType } from '~state/searchFilters'
import { useSearchPreview } from '~features/search/useSearchPreview'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import SearchTypeIcon, { searchTypeIconConfig } from '~features/search/shared/SearchTypeIcon'
import { useTheme } from '~themes/ThemeProvider'
import { colorWithOpacity, resolveThemeColor } from '~themes/colorValues'

const sourceLabels: Record<SearchItemType, string> = {
  commentary: 'tabs.commentary',
  plan: 'Plans',
  timeline: 'tabs.timeline',
  notes: 'Notes',
  studies: 'Études',
  links: 'Liens',
  strong: 'Strong',
  dictionary: 'Dictionnaire',
  nave: 'Nave',
  passages: 'Passages',
}

export default function ContentSuggestions({
  query,
  version,
  source,
  onSelect,
  onSeeAll,
  excludedKeys = [],
}: {
  query: string
  version: string
  excludedKeys?: string[]
  source?: SearchItemType
  onSelect: (item: SearchEntityResult) => void
  onSeeAll: (source: SearchItemType) => void
}) {
  const { t } = useTranslation()
  const theme = useTheme()
  const { sections, waiting } = useSearchPreview(query, version, source, 12)
  const rankedSections = [...sections]
    .sort((a, b) => contentPriority.indexOf(a.source) - contentPriority.indexOf(b.source))
    .map(section => {
      const items = section.items.filter(
        item => !excludedKeys.includes(resultContentKey(item) || '')
      )
      return {
        ...section,
        items: items.slice(0, source ? 12 : 3),
        hasMore: section.hasMore || items.length > (source ? 12 : 3),
      }
    })
    .filter(section => section.items.length)
  return (
    <>
      {waiting && (
        <div className="bs-command-status" role="status">
          {t('commandPalette.loading')}
        </div>
      )}
      {source &&
        !waiting &&
        !sections.some(section => section.loading || section.enriching) &&
        !rankedSections.length && (
          <div className="bs-command-status" role="status">
            {t('commandPalette.noResults')}
          </div>
        )}
      {sections.some(section => section.error && !section.items.length) && (
        <div className="bs-command-status" role="status">
          {t('commandPalette.sourceUnavailable')}
        </div>
      )}
      {rankedSections.map(section => (
        <Command.Group key={section.source} heading={t(sourceLabels[section.source])}>
          {section.items.map(item => (
            <Command.Item
              key={item.id}
              value={`content:${item.id}`}
              onSelect={() => onSelect(item)}
            >
              <span className="bs-command-item-label">
                <span
                  className="bs-command-item-icon"
                  aria-hidden="true"
                  style={{
                    backgroundColor: colorWithOpacity(
                      resolveThemeColor(theme, searchTypeIconConfig[item.type].color),
                      0.12
                    ),
                  }}
                >
                  <SearchTypeIcon type={item.type} size={16} />
                </span>
                <span className="bs-command-content-text">
                  <span className="bs-command-item-text">{item.title}</span>
                  {item.description && (
                    <span className="bs-command-description">
                      {getPassageSearchExcerpt(item.description, 120)
                        .replace(/<[^>]*>/g, '')
                        .replace(/\{\{|\}\}/g, '')
                        .replace(/\s+/g, ' ')
                        .slice(0, 160)}
                    </span>
                  )}
                </span>
              </span>
              {item.chip && <small>{item.chip}</small>}
              {item.passage && <small>{item.passage.version}</small>}
            </Command.Item>
          ))}
          {section.loading && (
            <div className="bs-command-status" role="status">
              {t('commandPalette.loading')}
            </div>
          )}
          {section.error && (
            <div className="bs-command-status" role="status">
              {t('commandPalette.sourceUnavailable')}
            </div>
          )}
          {(section.hasMore || section.error) && (
            <Command.Item
              className="bs-command-see-all"
              value={`all:${section.source}`}
              onSelect={() => onSeeAll(section.source)}
            >
              <span>{t('commandPalette.seeAll', { source: t(sourceLabels[section.source]) })}</span>
              <small>↗</small>
            </Command.Item>
          )}
        </Command.Group>
      ))}
    </>
  )
}
