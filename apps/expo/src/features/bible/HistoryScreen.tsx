import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useEffect, useState } from 'react'
import * as NativeUI from 'react-native'
import { Alert } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import { useAtomValue, useSetAtom } from 'jotai/react'
import { Trans, useTranslation } from 'react-i18next'
import Empty from '~common/Empty'
import Header from '~common/Header'
import Link from '~common/Link'
import Border from '~common/ui/Border'
import Box from '~common/ui/Box'
import Container from '~common/ui/Container'
import FlatList from '~common/ui/FlatList'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import formatVerseContent from '~helpers/formatVerseContent'
import { getHistoryStrongReference } from '~helpers/historyStrongReference'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { VersionCode } from '~state/tabs'
import {
  deleteHistoryAtom,
  historyAtom,
  type HistoryItem as HistoryItemType,
} from '../../state/app'

const Chip = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { color: string } | 'theme'> &
    Omit<{ color: string }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { color } = props
  const classStyles = useResolveClassNames(
    twMerge(
      'h-[15px] self-end rounded-[7px] justify-center items-center px-[5px] mb-[5px]',
      className
    )
  )
  return (
    <NativeUI.View
      {...props}
      style={
        [
          classStyles,
          {
            backgroundColor:
              theme.colors[color as keyof typeof theme.colors] || color || theme.colors.border,
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.View>['style']
      }
    />
  )
}

const HistoryItem = ({ item, currentTime }: { item: HistoryItemType; currentTime: number }) => {
  const { t } = useTranslation()
  const lang = useLanguage()

  if (item.type === 'strong') {
    const { Hebreu, Grec, Mot, date, book } = item
    const persistedReference = getHistoryStrongReference(item)
    const ago = distanceInWords(Number(date), currentTime, {
      locale: getDateLocale(lang),
    })
    return (
      <Link route="Strong" params={{ book, reference: persistedReference ?? '' }}>
        <Box className="overflow-hidden border-continuous p-[20px] flex-row items-center">
          <Box className="overflow-hidden border-continuous">
            <Text className="font-bold">{Mot}</Text>
            <Text className="mt-[5px] text-grey text-[12px]">{Grec || Hebreu}</Text>
          </Box>
          <Box className="overflow-hidden border-continuous ml-auto">
            <Chip color="primary">
              <Text className="font-bold text-[8px] text-reverse">Strong</Text>
            </Chip>
            <Text className="text-[10px] text-grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border className="mx-[20px]" />
      </Link>
    )
  }
  if (item.type === 'verse') {
    const { book, chapter, verse, version, date } = item
    const ago = distanceInWords(Number(date), currentTime, {
      locale: getDateLocale(lang),
    })
    const bookNumber = Number(book)
    const chapterNumber = Number(chapter)
    const verseNumber = Number(verse)
    let { title } = formatVerseContent([
      { Livre: bookNumber, Chapitre: chapterNumber, Verset: verseNumber },
    ])
    if (title.endsWith(':1')) {
      title = title.substring(0, title.length - 2)
    }
    return (
      <Link
        route="BibleView"
        params={{
          contextDisplayMode: 'focused',
          book: getBook(bookNumber) || getBook(1)!,
          chapter: chapterNumber,
          verse: verseNumber,
          version: version as VersionCode,
        }}
      >
        <Box className="overflow-hidden border-continuous p-[20px] flex-row items-center">
          <Text className="font-bold">
            {title} {version}
          </Text>
          <Box className="overflow-hidden border-continuous ml-auto">
            <Chip color="border">
              <Text className="font-bold text-[8px]">{t('Verset')}</Text>
            </Chip>
            <Text className="text-[10px] text-grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border className="mx-[20px]" />
      </Link>
    )
  }
  if (item.type === 'word') {
    const { word, date } = item
    const ago = distanceInWords(Number(date), currentTime, {
      locale: getDateLocale(lang),
    })
    return (
      <Link
        route="DictionnaryDetail"
        params={{
          word,
          entryId: item.entryId,
          correspondenceId: item.correspondenceId,
          work: item.work,
          resourceId: item.resourceId,
          dictionaryTitle: item.dictionaryTitle,
          language: item.language,
        }}
      >
        <Box className="overflow-hidden border-continuous p-[20px] flex-row items-center">
          <Box className="overflow-hidden border-continuous flex-[1]">
            <Text className="font-bold">{word}</Text>
            {item.dictionaryTitle ? (
              <Text className="mt-[5px] text-grey text-[12px]" numberOfLines={1}>
                {item.dictionaryTitle}
              </Text>
            ) : null}
          </Box>
          <Box className="overflow-hidden border-continuous ml-auto">
            <Chip color="secondary">
              <Text className="font-bold text-[8px]">{t('Mot')}</Text>
            </Chip>
            <Text className="text-[10px] text-grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border className="mx-[20px]" />
      </Link>
    )
  }

  if (item.type === 'nave') {
    const { name, name_lower, date } = item
    const ago = distanceInWords(Number(date), currentTime, {
      locale: getDateLocale(lang),
    })
    return (
      <Link route="NaveDetail" params={{ name, name_lower }}>
        <Box className="overflow-hidden border-continuous p-[20px] flex-row items-center">
          <Text className="font-bold">{name}</Text>
          <Box className="overflow-hidden border-continuous ml-auto">
            <Chip color="quint">
              <Text className="font-bold text-[8px] text-[white]">{t('Nave')}</Text>
            </Chip>
            <Text className="text-[10px] text-grey">
              <Trans>Il y a {{ ago }}</Trans>
            </Text>
          </Box>
        </Box>
        <Border className="mx-[20px]" />
      </Link>
    )
  }
  return null
}

const History = () => {
  const history = useAtomValue(historyAtom)
  const deleteHistory = useSetAtom(deleteHistoryAtom)
  const { t } = useTranslation()
  const [currentTime, setCurrentTime] = useState(Date.now)

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(Date.now()), 60_000)
    return () => clearInterval(interval)
  }, [])

  const confirmDeleteHistory = () => {
    Alert.alert(t('history.clearTitle'), t('history.clearMessage', { count: history.length }), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('history.clearAction'), style: 'destructive', onPress: deleteHistory },
    ])
  }

  return (
    <Container>
      <Header
        hasBackButton
        title={t('history.title')}
        rightComponent={
          history.length ? (
            <Link
              accessibilityLabel={t('history.clearAction')}
              onPress={confirmDeleteHistory}
              padding
            >
              <FeatherIcon size={20} name="trash-2" color="quart" />
            </Link>
          ) : undefined
        }
      />
      <Box className="overflow-hidden border-continuous flex-[1]">
        {history.length ? (
          <FlatList
            removeClippedSubviews
            data={history}
            keyExtractor={(item: HistoryItemType) => item.id}
            renderItem={({ item }: { item: HistoryItemType }) => (
              <HistoryItem item={item} currentTime={currentTime} />
            )}
          />
        ) : (
          <Empty
            icon={require('~assets/images/empty-state-icons/history.svg')}
            message={t('history.empty')}
          />
        )}
      </Box>
    </Container>
  )
}

export default History
