import { useAtomValue } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import HorizontalControlScrollView from '~common/HorizontalControlScrollView'
import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
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
const CARD_ITEMS = 4

const SeeAll = () => {
  const { t } = useTranslation()
  return (
    <Link route="History" accessibilityLabel={`${t('history.seeAll')} · ${t('history.title')}`}>
      <Text className="text-[12px] font-bold text-primary">{t('history.seeAll')}</Text>
    </Link>
  )
}

const Pill = ({ item }: { item: HistoryItem }) => {
  const { title, subtitle } = useHistoryEntryText(item)
  return (
    <HistoryEntryLink item={item} accessibilityLabel={`${title}, ${subtitle}`}>
      <HStack className="overflow-hidden border-continuous h-[36px] pl-[5px] pr-[12px] rounded-full bg-reverse items-center gap-[8px]">
        <HistoryEntryIcon item={item} size={26} />
        <Text className="text-[13px] font-bold max-w-[150px]" numberOfLines={1}>
          {title}
        </Text>
      </HStack>
    </HistoryEntryLink>
  )
}

const CardRow = ({ item }: { item: HistoryItem }) => {
  const { title, subtitle } = useHistoryEntryText(item)
  return (
    <HistoryEntryLink item={item} accessibilityLabel={`${title}, ${subtitle}`}>
      <HStack className="items-center gap-[10px]">
        <HistoryEntryIcon item={item} size={28} />
        <VStack className="flex-1 min-w-0">
          <Text className="text-[13px] font-bold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[11px] text-grey" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
      </HStack>
    </HistoryEntryLink>
  )
}

/** Latest History entries on the home: a row of pills, or a small card in the desktop aside. */
const HistoryHomeSection = ({ card = false }: { card?: boolean }) => {
  const { t } = useTranslation()
  const isAvailable = useIsHistoryEntryAvailable()
  const history = useAtomValue(historyAtom).filter(isAvailable)

  if (!history.length) return null

  if (card) {
    return (
      <Box className="bg-reverse rounded-[20px] p-[16px] gap-[12px] shadow-[0_2px_7px_rgba(89,131,240,0.1)]">
        <HStack className="items-center justify-between">
          <Text className="font-bold text-[14px]">{t('history.title')}</Text>
          <SeeAll />
        </HStack>
        <VStack className="gap-[10px]">
          {history.slice(0, CARD_ITEMS).map(item => (
            <CardRow key={item.id} item={item} />
          ))}
        </VStack>
      </Box>
    )
  }

  return (
    <Box className="overflow-hidden border-continuous bg-light-grey pt-[16px]">
      <HStack className="px-[40px] items-center justify-between">
        <Text className="text-[12px] font-bold text-grey">{t('history.title')}</Text>
        <SeeAll />
      </HStack>
      <HorizontalControlScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 40, paddingTop: 8, gap: 8 }}
      >
        {history.slice(0, PILL_ITEMS).map(item => (
          <Pill key={item.id} item={item} />
        ))}
      </HorizontalControlScrollView>
    </Box>
  )
}

export default HistoryHomeSection
