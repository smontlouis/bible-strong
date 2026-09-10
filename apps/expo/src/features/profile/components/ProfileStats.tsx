import * as Icon from '~common/ui/classNameIcons'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'
import { twMerge } from '~common/ui/classNames'

import type { Theme as AppTheme } from '~themes'
import { useTheme } from '~themes/ThemeProvider'

import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import useLogin from '~helpers/useLogin'
import { RootState } from '~redux/modules/reducer'

const ProfileStats = ({ desktop = false }: { desktop?: boolean }) => {
  const { t } = useTranslation()
  const theme = useTheme()
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

  return (
    <Box
      className={
        desktop
          ? ''
          : 'overflow-hidden border-continuous bg-light-grey rounded-[30px] py-[20px] mx-[20px]'
      }
    >
      <VStack
        className={
          desktop ? 'gap-[12px]' : 'overflow-hidden border-continuous gap-[10px] px-[20px]'
        }
      >
        {sync?.isLoading && (
          <HStack className="overflow-hidden border-continuous items-center gap-[8px]">
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text className="text-[12px] text-grey">{t('profileStats.syncingData')}</Text>
          </HStack>
        )}
        <Box
          dataSet={desktop ? { 'home-stats-grid': '' } : undefined}
          style={desktop ? { backgroundColor: theme.colors.border } : undefined}
          className={desktop ? 'flex-row gap-[12px]' : 'gap-[10px]'}
        >
          <HStack
            dataSet={desktop ? { 'home-stats-group': '' } : undefined}
            className={
              desktop ? 'flex-1 gap-[12px]' : 'overflow-hidden border-continuous gap-[10px]'
            }
          >
            <StatCard flat={desktop} route="Highlights">
              <StatValue
                icon="edit-3"
                count={highlights}
                isLoading={isSyncing(['highlights', 'wordAnnotations'])}
              />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
                {isSyncing(['highlights', 'wordAnnotations']) && highlights === 0
                  ? t('profileStats.syncing')
                  : t('surbrillance', { count: highlights })}
              </Text>
            </StatCard>

            <StatCard flat={desktop} route="Bookmarks">
              <StatValue icon="bookmark" count={bookmarks} isLoading={isSyncing(['bookmarks'])} />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
                {isSyncing(['bookmarks']) && bookmarks === 0
                  ? t('profileStats.syncing')
                  : t('marque-page', { count: bookmarks })}
              </Text>
            </StatCard>

            <StatCard flat={desktop} route="BibleVerseNotes">
              <StatValue icon="file-text" count={notes} isLoading={isSyncing(['notes'])} />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
                {isSyncing(['notes']) && notes === 0
                  ? t('profileStats.syncing')
                  : t('note', { count: notes })}
              </Text>
            </StatCard>
          </HStack>

          <HStack
            dataSet={desktop ? { 'home-stats-group': '' } : undefined}
            className={
              desktop ? 'flex-1 gap-[12px]' : 'overflow-hidden border-continuous gap-[10px]'
            }
          >
            <StatCard
              flat={desktop}
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
              <StatValue icon="feather" count={studies} isLoading={isSyncing(['studies'])} />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
                {isSyncing(['studies']) && studies === 0
                  ? t('profileStats.syncing')
                  : t('étude', { count: studies })}
              </Text>
            </StatCard>

            <StatCard flat={desktop} route="BibleVerseLinks">
              <StatValue icon="link" count={links} isLoading={isSyncing(['links'])} />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
                {isSyncing(['links']) && links === 0
                  ? t('profileStats.syncing')
                  : t('lien', { count: links })}
              </Text>
            </StatCard>

            <StatCard flat={desktop} route="Tags">
              <StatValue icon="tag" count={tags} isLoading={isSyncing(['tags'])} />
              <Text className="text-[11px] text-grey" numberOfLines={1}>
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
  icon,
  count,
  isLoading,
}: {
  icon: React.ComponentProps<typeof Icon.Feather>['name']
  count: number
  isLoading: boolean
}) => {
  const theme = useTheme()
  const showLoader = isLoading && count === 0

  return (
    <HStack className="overflow-hidden border-continuous items-center gap-[8px]">
      <ChipIcon name={icon} size={18} />
      {showLoader ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text className="font-bold text-[18px]">{count}</Text>
      )}
    </HStack>
  )
}

const StatCard = (
  componentProps: Omit<UIComponentProps<typeof Link>, 'theme'> & {
    flat?: boolean
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, flat = false, ...props } = componentProps

  const resolvedClassName = twMerge(
    flat
      ? 'flex-1 bg-reverse p-[12px]'
      : 'flex-[1] bg-reverse rounded-[12px] p-[12px] elevation-[1]',
    className
  )
  return (
    <Link
      {...props}
      className={resolvedClassName}
      style={
        [
          !flat && {
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
