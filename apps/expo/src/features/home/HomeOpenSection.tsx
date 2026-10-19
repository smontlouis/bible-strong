import { useSetAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import Link from '~common/Link'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { useLaunchSearch } from '~features/app-switcher/commandPalette/useLaunchSearch'
import TabIcon from '~features/app-switcher/utils/getIconByTabType'
import { useSlideNewTab } from '~features/app-switcher/utils/useSlideNewTab'
import { tabsAtomsAtom, type TabItem } from '~state/tabs'
import HomeSectionTitle from './HomeSectionTitle'

const SHORTCUTS: { type: TabItem['type']; label: string }[] = [
  { type: 'bible', label: 'Bible' },
  { type: 'strong', label: 'tabs.strong' },
  { type: 'nave', label: 'tabs.nave' },
  { type: 'dictionary', label: 'tabs.dictionary' },
  { type: 'commentary', label: 'tabs.commentary' },
  { type: 'compare', label: 'tabs.compare' },
  { type: 'plan', label: 'Plans' },
]

/**
 * Shortcuts to the most common resources. Each one opens the same scoped search as the
 * new tab (ADR-0045) and its result opens in a new tab; « Tout voir » creates a new tab.
 */
const HomeOpenSection = () => {
  const { t } = useTranslation()
  const launchSearch = useLaunchSearch()
  const dispatchTabs = useSetAtom(tabsAtomsAtom)
  const { triggerSlideNewTab } = useSlideNewTab()

  const openNewTab = () => {
    const id = `new-${Date.now()}`
    dispatchTabs({
      type: 'insert',
      value: { id, title: t('tabs.new'), isRemovable: true, type: 'new', data: {} },
    })
    triggerSlideNewTab(id)
  }

  return (
    <Box>
      <HomeSectionTitle
        title={t('home.open')}
        action={
          <Link onPress={openNewTab} accessibilityLabel={t('tabs.new')} className="py-[12px]">
            <Text className="text-primary text-[13px] font-bold">{t('history.seeAll')}</Text>
          </Link>
        }
      />
      <HorizontalControlScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ overflow: 'visible' }}
        contentContainerStyle={{ paddingHorizontal: 20, gap: 10 }}
      >
        {SHORTCUTS.map(({ type, label }) => (
          <TouchableBox
            key={type}
            testID={`home-open-${type}`}
            accessibilityRole="button"
            accessibilityLabel={t(label)}
            activeOpacity={0.7}
            onPress={() => launchSearch(type)}
            className="w-[72px] items-center gap-[7px]"
          >
            <Box className="w-[60px] h-[60px] rounded-[19px] bg-reverse items-center justify-center shadow-[0_2px_7px_rgba(89,131,240,0.12)]">
              <TabIcon type={type} size={26} />
            </Box>
            <Text className="text-[12px] leading-[16px]" numberOfLines={1}>
              {t(label)}
            </Text>
          </TouchableBox>
        ))}
      </HorizontalControlScrollView>
    </Box>
  )
}

export default HomeOpenSection
