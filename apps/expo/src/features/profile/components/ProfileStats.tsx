import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'
import { resolveFontFamily } from '~themes/styleValues'
import { resolveUniverseColors } from '~themes/universeColors'
import { type PersonalContent, personalContentIcons } from '~common/personalContent'

import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import useLogin from '~helpers/useLogin'
import { RootState } from '~redux/modules/reducer'
import { useHomeLayout } from '~features/home/homeLayout'

/** Home content width from which the six cards fit on a single row. */
const HOME_SINGLE_ROW_CONTENT = 680

/**
 * `home`: no outer inset (aligned with the home section titles) and colored cards, on two rows
 * of three or, when the home is wide enough, a single row of six.
 */
const ProfileStats = ({ home = false }: { home?: boolean }) => {
  const { t } = useTranslation()
  const theme = useTheme()
  const { isLogged } = useLogin()
  const singleRow = useHomeLayout().content >= HOME_SINGLE_ROW_CONTENT && home

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

  return (
    <Box
      className={
        home
          ? ''
          : 'overflow-hidden border-continuous bg-light-grey rounded-[30px] py-[20px] mx-[20px]'
      }
    >
      <VStack className="overflow-hidden border-continuous gap-[10px] px-[20px]">
        {sync?.isLoading && (
          <HStack className="overflow-hidden border-continuous items-center gap-[8px]">
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text className="text-[12px] text-grey">{t('profileStats.syncingData')}</Text>
          </HStack>
        )}
        <Box className={singleRow ? 'flex-row gap-[10px]' : 'gap-[10px]'}>
          <HStack
            className={twMerge(
              'overflow-hidden border-continuous gap-[10px]',
              singleRow && 'flex-1'
            )}
          >
            <StatCard tall={home} route="Highlights">
              <StatValue
                content="highlights"
                home={home}
                count={highlights}
                isLoading={isSyncing(['highlights', 'wordAnnotations'])}
              />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['highlights', 'wordAnnotations']) && highlights === 0
                  ? t('profileStats.syncing')
                  : t('surbrillance', { count: highlights })}
              </Text>
            </StatCard>

            <StatCard tall={home} route="Bookmarks">
              <StatValue
                content="bookmarks"
                home={home}
                count={bookmarks}
                isLoading={isSyncing(['bookmarks'])}
              />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['bookmarks']) && bookmarks === 0
                  ? t('profileStats.syncing')
                  : t('marque-page', { count: bookmarks })}
              </Text>
            </StatCard>

            <StatCard tall={home} route="BibleVerseNotes">
              <StatValue
                content="notes"
                home={home}
                count={notes}
                isLoading={isSyncing(['notes'])}
              />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['notes']) && notes === 0
                  ? t('profileStats.syncing')
                  : t('note', { count: notes })}
              </Text>
            </StatCard>
          </HStack>

          <HStack
            className={twMerge(
              'overflow-hidden border-continuous gap-[10px]',
              singleRow && 'flex-1'
            )}
          >
            <StatCard
              tall={home}
              {...(isLogged
                ? { route: 'Studies' as const }
                : { onPress: () => toast.info(t('study.loginRequired')) })}
            >
              {!isLogged && (
                <Box
                  className="overflow-hidden border-continuous absolute top-[8px] right-[8px]"
                  pointerEvents="none"
                >
                  <Icon.Feather name="lock" size={12} color={theme.colors.grey} />
                </Box>
              )}
              <StatValue
                content="study"
                home={home}
                count={studies}
                isLoading={isSyncing(['studies'])}
              />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['studies']) && studies === 0
                  ? t('profileStats.syncing')
                  : t('étude', { count: studies })}
              </Text>
            </StatCard>

            <StatCard tall={home} route="BibleVerseLinks">
              <StatValue
                content="links"
                home={home}
                count={links}
                isLoading={isSyncing(['links'])}
              />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['links']) && links === 0
                  ? t('profileStats.syncing')
                  : t('lien', { count: links })}
              </Text>
            </StatCard>

            <StatCard tall={home} route="Tags">
              <StatValue content="tags" home={home} count={tags} isLoading={isSyncing(['tags'])} />
              <Text
                className={home ? 'text-[12px] text-grey' : 'text-[11px] text-grey'}
                numberOfLines={1}
              >
                {isSyncing(['tags']) && tags === 0
                  ? t('profileStats.syncing')
                  : t('étiquette', { count: tags })}
              </Text>
            </StatCard>
          </HStack>
        </Box>
      </VStack>
    </Box>
  )
}

const StatValue = ({
  content,
  count,
  isLoading,
  home,
}: {
  content: PersonalContent
  count: number
  isLoading: boolean
  /** Home cards: the icon takes its color and sits above a larger count. */
  home: boolean
}) => {
  const theme = useTheme()
  const icon = personalContentIcons[content]
  const color = home ? resolveUniverseColors(theme.colors, content).foreground : undefined
  const showLoader = isLoading && count === 0
  const value = showLoader ? (
    <ActivityIndicator size="small" color={theme.colors.primary} />
  ) : (
    <Text
      className={color ? 'text-[22px] leading-[26px]' : 'font-bold text-[18px]'}
      style={color ? { fontFamily: resolveFontFamily(theme.fontFamily.title) } : undefined}
    >
      {count}
    </Text>
  )

  if (color)
    return (
      <VStack className="items-start gap-[8px]">
        <Icon.Feather name={icon} size={20} color={color} />
        {value}
      </VStack>
    )

  return (
    <HStack className="overflow-hidden border-continuous items-center gap-[8px]">
      <ChipIcon name={icon} size={18} />
      {value}
    </HStack>
  )
}

const StatCard = (
  componentProps: Omit<UIComponentProps<typeof Link>, 'theme'> & {
    tall?: boolean
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, tall = false, ...props } = componentProps

  const resolvedClassName = twMerge(
    tall
      ? 'flex-[1] bg-reverse rounded-[18px] px-[12px] py-[14px] gap-[8px] elevation-[1]'
      : 'flex-[1] bg-reverse rounded-[12px] p-[12px] elevation-[1]',
    className
  )
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={
        [
          {
            shadowColor: 'rgb(89,131,240)',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.08,
            shadowRadius: 6,
          },
          props.style,
        ] as UIComponentProps<typeof Link>['style']
      }
    />
  )
}

const ChipIcon = (
  componentProps: Omit<UIComponentProps<typeof Icon.Feather>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const resolvedClassName = twMerge('text-grey', className)
  return (
    <Icon.Feather
      {...props}
      className={resolvedClassName}
      style={[props.style] as UIComponentProps<typeof Icon.Feather>['style']}
    />
  )
}

export default ProfileStats
