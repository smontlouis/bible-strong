import format from 'date-fns/format'
import { useLocalSearchParams } from 'expo-router'
import { useAtomValue, useSetAtom } from 'jotai/react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Empty from '~common/Empty'
import Header from '~common/Header'
import FiltersHeader from '~common/FiltersHeader'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import { HStack, VStack } from '~common/ui/Box'
import Container from '~common/ui/Container'
import { FeatherIcon } from '~common/ui/Icon'
import { ListSectionTitle } from '~common/ui/ListSection'
import SectionList from '~common/ui/SectionList'
import Text from '~common/ui/Text'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { deleteHistoryAtom, historyAtom, removeHistoryItemAtom } from '~state/app'
import {
  HistoryEntryIcon,
  HistoryEntryLink,
  useHistoryEntryText,
  useIsHistoryEntryAvailable,
} from './HistoryEntry'
import {
  getHistoryDayLabel,
  groupHistoryByDay,
  HISTORY_FILTERS,
  isHistoryFilter,
  matchesHistoryFilter,
  type HistoryFilter,
  type HistoryItem,
} from './historyModel'

const REMOVE_ACTION = 'remove'

// Starts where the row's text starts: its padding, the icon tile and the gap after it.
const HistoryRowSeparator = () => <Border className="ml-[62px]" />

type HistoryRowData = { item: HistoryItem; time: string }

const HistoryRow = ({ item, time }: HistoryRowData) => {
  const { t } = useTranslation()
  const confirmRemoval = useConfirmDialog()
  const removeItem = useSetAtom(removeHistoryItemAtom)
  const { title, subtitle } = useHistoryEntryText(item)
  const remove = () => {
    void confirmRemoval({
      title: t('history.removeTitle'),
      message: [title, subtitle].filter(Boolean).join(' · '),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('history.removeEntry'),
      destructive: true,
    }).then(confirmed => {
      if (confirmed) removeItem(item.id)
    })
  }
  return (
    <HistoryEntryLink
      item={item}
      accessibilityLabel={`${title}, ${subtitle}`}
      accessibilityActions={[{ name: REMOVE_ACTION, label: t('history.removeEntry') }]}
      onAccessibilityAction={({ nativeEvent }) => {
        if (nativeEvent.actionName === REMOVE_ACTION) remove()
      }}
      onLongPress={remove}
    >
      <HStack className="overflow-hidden border-continuous px-[20px] py-[12px] items-center gap-[12px]">
        <HistoryEntryIcon item={item} />
        <VStack className="overflow-hidden border-continuous flex-[1] gap-[3px]">
          <Text className="text-[15px] font-bold" numberOfLines={1}>
            {title}
          </Text>
          {subtitle ? (
            <Text className="text-[12px] text-grey" numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </VStack>
        <Text className="text-[11px] text-grey">{time}</Text>
      </HStack>
    </HistoryEntryLink>
  )
}

const History = () => {
  const confirmDeletion = useConfirmDialog()
  const isAvailable = useIsHistoryEntryAvailable()
  const history = useAtomValue(historyAtom).filter(isAvailable)
  const deleteHistory = useSetAtom(deleteHistoryAtom)
  const { t } = useTranslation()
  const lang = useLanguage()
  const params = useLocalSearchParams<{ filter?: string }>()
  const [filter, setFilter] = useState<HistoryFilter>(
    isHistoryFilter(params.filter) ? params.filter : 'all'
  )

  const locale = getDateLocale(lang)
  const now = Date.now()
  const sections = groupHistoryByDay(
    history.filter(item => matchesHistoryFilter(item, filter))
  ).map(({ day, items }) => {
    const label = getHistoryDayLabel(day, now)
    return {
      key: String(day),
      title:
        label === 'today'
          ? t('history.today')
          : label === 'yesterday'
            ? t('history.yesterday')
            : format(day, label === 'thisYear' ? t('history.dayFormat') : 'PPP', { locale }),
      data: items.map(item => ({ item, time: format(item.date, 'p', { locale }) })),
    }
  })
  // Only the kinds present in the history are offered, plus the one already chosen.
  const filterOptions = HISTORY_FILTERS.filter(
    option =>
      option === 'all' ||
      option === filter ||
      history.some(item => matchesHistoryFilter(item, option))
  )

  const confirmDeleteHistory = () => {
    void confirmDeletion({
      title: t('history.clearTitle'),
      message: t('history.clearMessage', { count: history.length }),
      cancelLabel: t('common.cancel'),
      confirmLabel: t('history.clearAction'),
      destructive: true,
    }).then(confirmed => {
      if (confirmed) return deleteHistory()
    })
  }

  return (
    <Container>
      <Header
        hasBackButton
        title={t('history.title')}
        rightComponent={
          history.length ? (
            <HStack className="items-center">
              <FiltersHeader
                buttonOnly
                title={t('history.title')}
                onReset={() => setFilter('all')}
                filters={[
                  {
                    key: 'type',
                    icon: 'layers',
                    label: t('Type'),
                    value: t(`history.filters.${filter}`),
                    active: filter !== 'all',
                    onPress: () => setFilter('all'),
                    options: filterOptions.map(option => ({
                      key: option,
                      label: t(`history.filters.${option}`),
                      selected: option === filter,
                      onSelect: () => setFilter(option),
                    })),
                  },
                ]}
              />
              <Link
                accessibilityLabel={t('history.clearAction')}
                onPress={confirmDeleteHistory}
                padding
              >
                <FeatherIcon size={20} name="trash-2" color="quart" />
              </Link>
            </HStack>
          ) : undefined
        }
      />
      {history.length ? (
        sections.length ? (
          <SectionList
            sections={sections}
            keyExtractor={({ item }: HistoryRowData) => item.id}
            stickySectionHeadersEnabled={false}
            renderSectionHeader={({ section }) => (
              <ListSectionTitle className="ml-[20px] mt-[16px] mb-[6px]">
                {section.title}
              </ListSectionTitle>
            )}
            ItemSeparatorComponent={HistoryRowSeparator}
            renderItem={({ item }: { item: HistoryRowData }) => (
              <HistoryRow item={item.item} time={item.time} />
            )}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/history.svg')}
            message={t('history.emptyFilter')}
          />
        )
      ) : (
        <Empty
          icon={require('~assets/images/empty-state-icons/history.svg')}
          message={t('history.empty')}
        />
      )}
    </Container>
  )
}

export default History
