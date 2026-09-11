import { Command } from 'cmdk'
import { useTranslation } from 'react-i18next'
import type { SearchEntityResult } from '~features/search/shared/searchResultTypes'
import type { TabItem, VersionCode } from '~state/tabs'
import { createScopedPassageTab } from './scopes'

export default function PassageSuggestions({
  items,
  version,
  compare = false,
  onSelect,
}: {
  items: SearchEntityResult[]
  version: VersionCode
  compare?: boolean
  onSelect: (tab: TabItem) => void
}) {
  const { t } = useTranslation()
  const open = (item: SearchEntityResult, comparison: boolean) => {
    const tab = createScopedPassageTab(comparison ? 'compare' : 'bible', item, version)
    if (tab) onSelect(tab)
  }
  return (
    <Command.Group heading={t(compare ? 'tabs.compare' : 'Passage')}>
      {items.map(item => (
        <Command.Item
          key={item.id}
          value={`passage:${item.id}`}
          onSelect={() => open(item, compare)}
        >
          <span className="bs-command-item-text">{item.title}</span>
        </Command.Item>
      ))}
    </Command.Group>
  )
}
