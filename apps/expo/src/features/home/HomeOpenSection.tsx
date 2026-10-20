import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import Link from '~common/Link'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useLaunchSearch } from '~features/app-switcher/commandPalette/useLaunchSearch'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'
import type { TabItem } from '~state/tabs'
import { HomeGrid, useHomeLayout } from './homeLayout'

/** Every tab type of the new tab, the most used first so a phone shows them without scrolling. */
const SHORTCUTS: { type: TabItem['type']; label: string }[] = [
  { type: 'bible', label: 'Bible' },
  { type: 'strong', label: 'tabs.strong' },
  { type: 'nave', label: 'tabs.nave' },
  { type: 'dictionary', label: 'tabs.dictionary' },
  { type: 'commentary', label: 'tabs.commentary' },
  { type: 'compare', label: 'tabs.compare' },
  { type: 'plan', label: 'Plans' },
  { type: 'timeline', label: 'tabs.timeline' },
  { type: 'study', label: 'Études' },
  { type: 'notes', label: 'tabs.notes' },
]
const TILE_GAP = 10
/**
 * A single row drops the gaps: icons are centred in their cells, which only need room for the
 * longest label (« Commentaire », about 76 points).
 */
const SINGLE_ROW_CELL = 78
/** Content width from which every shortcut fits on a single row. */
const SINGLE_ROW_CONTENT = SHORTCUTS.length * SINGLE_ROW_CELL

/**
 * « Nouvel onglet », the action of the « Explorer » title: like the sidebar button, it adds an
 * empty tab to the current group and leaves the home for it.
 */
export const NewTabLink = () => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  return (
    <Link onPress={() => openInNewTab(undefined, { autoRedirect: true })} className="py-[12px]">
      <Text className="text-primary text-[13px] font-bold">{t('tabs.new')}</Text>
    </Link>
  )
}

/**
 * Shortcuts to every kind of tab, first row of « Explorer ». Each one opens the same scoped
 * search as the new tab (ADR-0045) and its result opens in a new tab. A phone scrolls them; a
 * wide home spreads them over one row, or two when the column is narrower.
 */
const HomeOpenSection = () => {
  const { t } = useTranslation()
  const { content, wide } = useHomeLayout()
  const launchSearch = useLaunchSearch()

  const shortcuts = SHORTCUTS.map(({ type, label }) => (
    <TouchableBox
      key={type}
      testID={`home-open-${type}`}
      accessibilityRole="button"
      accessibilityLabel={t(label)}
      activeOpacity={0.7}
      onPress={() => launchSearch(type)}
      className={`${wide ? 'w-full' : 'w-[72px]'} items-center gap-[7px]`}
    >
      <Box className="w-[60px] h-[60px] rounded-[19px] bg-reverse items-center justify-center shadow-[0_2px_7px_rgba(89,131,240,0.12)]">
        <TabIcon type={type} size={26} />
      </Box>
      <Text className="text-[12px] leading-[16px]" numberOfLines={1}>
        {t(label)}
      </Text>
    </TouchableBox>
  ))

  if (wide) {
    const singleRow = content >= SINGLE_ROW_CONTENT
    return (
      <HomeGrid
        columns={singleRow ? SHORTCUTS.length : Math.ceil(SHORTCUTS.length / 2)}
        columnGap={singleRow ? 0 : TILE_GAP}
        rowGap={16}
      >
        {shortcuts}
      </HomeGrid>
    )
  }

  return (
    <HorizontalControlScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ overflow: 'visible' }}
      contentContainerStyle={{ paddingHorizontal: 20, gap: TILE_GAP }}
    >
      {shortcuts}
    </HorizontalControlScrollView>
  )
}

export default HomeOpenSection
