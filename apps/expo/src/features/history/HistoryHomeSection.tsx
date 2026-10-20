import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { ListSectionTitle } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { historyAtom } from '~state/app'
import {
  HistoryEntryIcon,
  HistoryEntryLink,
  useHistoryEntryText,
  useIsHistoryEntryAvailable,
} from './HistoryEntry'
import type { HistoryItem } from './historyModel'

const PILL_ITEMS = 6

const SeeAll = () => {
  const { t } = useTranslation()
  return (
    <Link route="History" accessibilityLabel={`${t('history.seeAll')} · ${t('history.title')}`}>
      <Text className="text-[12px] font-bold text-primary">{t('history.seeAll')}</Text>
    </Link>
  )
}

/**
 * One entry as a small card on the home's canvas. `stretch`: grid cell of the wide home, filling
 * its column instead of capping its width.
 */
const Pill = ({ item, stretch = false }: { item: HistoryItem; stretch?: boolean }) => {
  const { title, subtitle } = useHistoryEntryText(item)
  return (
    <HistoryEntryLink item={item} accessibilityLabel={`${title}, ${subtitle}`}>
      <Card
        className={`flex-row h-[56px] px-[14px] items-center gap-[10px] ${stretch ? '' : 'max-w-[200px]'}`}
      >
        <HistoryEntryIcon item={item} size={18} bare />
        <VStack className="shrink min-w-0">
          <Text className="text-[14px] font-bold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[12px] text-grey" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
      </Card>
    </HistoryEntryLink>
  )
}

/** History entries the home can still open. */
export const useHomeHistory = () => {
  const isAvailable = useIsHistoryEntryAvailable()
  return useAtomValue(historyAtom).filter(isAvailable)
}

/**
 * Latest History entries on the home: a row of pills, or a grid of `columns` when the wide home
 * places them beside the plans. `headerless`: the home section title carries the History link.
 */
const HistoryHomeSection = ({
  headerless = false,
  columns,
}: {
  headerless?: boolean
  columns?: number
}) => {
  const { t } = useTranslation()
  const history = useHomeHistory()

  if (!history.length) return null

  if (columns) {
    const items = history.slice(0, PILL_ITEMS)
    const rows = Array.from({ length: Math.ceil(items.length / columns) }, (_, row) =>
      items.slice(row * columns, (row + 1) * columns)
    )
    return (
      <VStack className="gap-[8px]">
        {rows.map(row => (
          <HStack key={row[0].id} className="gap-[8px]">
            {Array.from({ length: columns }, (_, index) => (
              <Box key={row[index]?.id ?? index} className="flex-1 min-w-0">
                {row[index] && <Pill item={row[index]} stretch />}
              </Box>
            ))}
          </HStack>
        ))}
      </VStack>
    )
  }

  return (
    <Box>
      {!headerless && (
        <HStack className="px-[20px] items-center justify-between">
          <ListSectionTitle className="mb-0">{t('history.title')}</ListSectionTitle>
          <SeeAll />
        </HStack>
      )}
      <HorizontalControlScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: headerless ? 0 : 8, gap: 8 }}
      >
        {history.slice(0, PILL_ITEMS).map(item => (
          <Pill key={item.id} item={item} />
        ))}
      </HorizontalControlScrollView>
    </Box>
  )
}

export default HistoryHomeSection
