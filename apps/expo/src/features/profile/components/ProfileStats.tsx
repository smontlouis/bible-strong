import * as Icon from '~common/ui/classNameIcons'
import { titleFontStyle } from '~themes/styleValues'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import { resolveUniverseColors } from '~themes/universeColors'
import { type PersonalContent, personalContentIcons } from '~common/personalContent'

import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Card from '~common/ui/Card'
import { ListSectionTitle, ListSeparator } from '~common/ui/ListSection'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import useLogin from '~helpers/useLogin'
import { RootState } from '~redux/modules/reducer'
import { useHomeLayout } from '~features/home/homeLayout'

/** Home content width from which the six counts share a single row. */
const HOME_SINGLE_ROW_CONTENT = 680

type StatLink = Pick<UIComponentProps<typeof Link>, 'route' | 'onPress'>

type Stat = {
  content: PersonalContent
  link: StatLink
  count: number
  label: string
  isLoading: boolean
  /** Studies need an account: the count stays visible, with a lock. */
  locked?: boolean
}

/** The reader's six counts, with their sync state, in the order both layouts show them. */
const useStats = (): Stat[] => {
  const { t } = useTranslation()
  const { isLogged } = useLogin()

  const highlights = useSelector(
    (state: RootState) =>
      Object.keys(state.user.bible.highlights).length +
      Object.keys(state.user.bible.wordAnnotations || {}).length
  )
  const notes = useSelector((state: RootState) => Object.keys(state.user.bible.notes).length)
  const studies = useSelector((state: RootState) => Object.keys(state.user.bible.studies).length)
  const tags = useSelector((state: RootState) => Object.keys(state.user.bible.tags).length)
  const bookmarks = useSelector(
    (state: RootState) => Object.keys(state.user.bible.bookmarks || {}).length
  )
  const links = useSelector((state: RootState) => Object.keys(state.user.bible.links || {}).length)
  const sync = useSelector((state: RootState) => state.user.sync)
  const isSyncing = (collections: (keyof RootState['user']['sync']['loaded'])[]) =>
    Boolean(sync?.isLoading) && collections.some(collection => !sync?.loaded?.[collection])

  const stat = (
    content: PersonalContent,
    link: StatLink,
    count: number,
    labelKey: string,
    collections: (keyof RootState['user']['sync']['loaded'])[]
  ): Stat => {
    const isLoading = isSyncing(collections)
    return {
      content,
      link,
      count,
      isLoading,
      label: isLoading && count === 0 ? t('profileStats.syncing') : t(labelKey, { count }),
    }
  }

  return [
    stat('highlights', { route: 'Highlights' }, highlights, 'surbrillance', [
      'highlights',
      'wordAnnotations',
    ]),
    stat('bookmarks', { route: 'Bookmarks' }, bookmarks, 'marque-page', ['bookmarks']),
    stat('notes', { route: 'BibleVerseNotes' }, notes, 'note', ['notes']),
    {
      ...stat(
        'study',
        isLogged ? { route: 'Studies' } : { onPress: () => toast.info(t('study.loginRequired')) },
        studies,
        'étude',
        ['studies']
      ),
      locked: !isLogged,
    },
    stat('links', { route: 'BibleVerseLinks' }, links, 'lien', ['links']),
    stat('tags', { route: 'Tags' }, tags, 'étiquette', ['tags']),
  ]
}

const SyncingNotice = () => {
  const { t } = useTranslation()
  const theme = useTheme()
  return (
    <HStack className="overflow-hidden border-continuous items-center gap-[8px]">
      <ActivityIndicator size="small" color={theme.colors.primary} />
      <Text className="text-[12px] text-grey">{t('profileStats.syncingData')}</Text>
    </HStack>
  )
}

const useStatColor = (content: PersonalContent) =>
  resolveUniverseColors(useTheme().colors, content).foreground

const StatLock = () => {
  const theme = useTheme()
  return (
    <Box
      className="overflow-hidden border-continuous absolute top-[8px] right-[8px]"
      pointerEvents="none"
    >
      <Icon.Feather name="lock" size={12} color={theme.colors.grey} />
    </Box>
  )
}

/**
 * The six counts. Profile: a titled group of six cards, each with its colored icon above the
 * count, on two rows of three. Home (`home`): one card of six cells, two rows of three, or a single
 * row when the home is wide enough, aligned with the home section titles.
 */
const ProfileStats = ({ home = false }: { home?: boolean }) => {
  const { t } = useTranslation()
  const stats = useStats()
  const isSyncing = useSelector((state: RootState) => Boolean(state.user.sync?.isLoading))
  const singleRow = useHomeLayout().content >= HOME_SINGLE_ROW_CONTENT

  if (home) {
    const rows = singleRow ? [stats] : [stats.slice(0, 3), stats.slice(3)]
    return (
      <VStack className="px-[20px] gap-[10px]">
        {isSyncing && <SyncingNotice />}
        <Card>
          {rows.map((row, index) => (
            <Box key={row[0].content}>
              {index > 0 && <ListSeparator />}
              <HStack>
                {row.map(item => (
                  <HomeStatCell key={item.content} stat={item} />
                ))}
              </HStack>
            </Box>
          ))}
        </Card>
      </VStack>
    )
  }

  return (
    <Box className="mx-[20px] mb-[22px]">
      <ListSectionTitle>{t('profile.stats')}</ListSectionTitle>
      <VStack className="overflow-hidden border-continuous gap-[10px]">
        {isSyncing && <SyncingNotice />}
        {[stats.slice(0, 3), stats.slice(3)].map(row => (
          <HStack key={row[0].content} className="overflow-hidden border-continuous gap-[10px]">
            {row.map(item => (
              <StatCard key={item.content} {...item.link}>
                {item.locked && <StatLock />}
                <StatValue stat={item} />
                <Text className="text-[12px] text-grey" numberOfLines={1}>
                  {item.label}
                </Text>
              </StatCard>
            ))}
          </HStack>
        ))}
      </VStack>
    </Box>
  )
}

/** One count of the home card: the icon beside the number, the label below at full width. */
const HomeStatCell = ({ stat }: { stat: Stat }) => {
  const theme = useTheme()
  const color = useStatColor(stat.content)
  return (
    <Link
      {...stat.link}
      accessibilityLabel={`${stat.count} ${stat.label}`}
      className="flex-1 min-w-0 px-[12px] py-[12px] gap-[2px]"
    >
      {stat.locked && <StatLock />}
      <HStack className="items-center gap-[8px] h-[22px]">
        <Icon.Feather name={personalContentIcons[stat.content]} size={16} color={color} />
        {stat.isLoading && stat.count === 0 ? (
          <ActivityIndicator size="small" color={theme.colors.primary} />
        ) : (
          <Text
            className="text-[17px] leading-[22px]"
            style={[titleFontStyle(theme), { fontVariant: ['tabular-nums'] }]}
          >
            {stat.count}
          </Text>
        )}
      </HStack>
      <Text className="text-[12px] text-grey" numberOfLines={1}>
        {stat.label}
      </Text>
    </Link>
  )
}

const StatValue = ({ stat }: { stat: Stat }) => {
  const theme = useTheme()
  const color = useStatColor(stat.content)

  return (
    <VStack className="items-start gap-[8px]">
      <Icon.Feather name={personalContentIcons[stat.content]} size={20} color={color} />
      {stat.isLoading && stat.count === 0 ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text className="text-[22px] leading-[26px]" style={titleFontStyle(theme)}>
          {stat.count}
        </Text>
      )}
    </VStack>
  )
}

const StatCard = (
  componentProps: Omit<UIComponentProps<typeof Link>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  return (
    <Card className="flex-[1]">
      <Link {...props} className={twMerge('flex-[1] px-[12px] py-[14px] gap-[8px]', className)} />
    </Card>
  )
}

export default ProfileStats
