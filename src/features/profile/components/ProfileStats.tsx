import styled from '@emotion/native'
import { useTheme } from '@emotion/react'
import * as Icon from '@expo/vector-icons'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { ActivityIndicator } from 'react-native'
import { useSelector } from 'react-redux'

import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import useLogin from '~helpers/useLogin'
import { RootState } from '~redux/modules/reducer'

const ProfileStats = () => {
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

  if (!isLogged) {
    return null
  }

  return (
    <Box bg="lightGrey" borderRadius={30} paddingVertical={20} marginHorizontal={20}>
      <VStack gap={10} paddingHorizontal={20}>
        {sync?.isLoading && (
          <HStack alignItems="center" gap={8}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text fontSize={12} color="grey">
              {t('profileStats.syncingData')}
            </Text>
          </HStack>
        )}
        <HStack gap={10}>
          <StatCard route="Highlights">
            <StatValue
              icon="edit-3"
              count={highlights}
              isLoading={isSyncing(['highlights', 'wordAnnotations'])}
            />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['highlights', 'wordAnnotations']) && highlights === 0
                ? t('profileStats.syncing')
                : t('surbrillance', { count: highlights })}
            </Text>
          </StatCard>

          <StatCard route="Bookmarks">
            <StatValue icon="bookmark" count={bookmarks} isLoading={isSyncing(['bookmarks'])} />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['bookmarks']) && bookmarks === 0
                ? t('profileStats.syncing')
                : t('marque-page', { count: bookmarks })}
            </Text>
          </StatCard>

          <StatCard route="BibleVerseNotes">
            <StatValue icon="file-text" count={notes} isLoading={isSyncing(['notes'])} />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['notes']) && notes === 0
                ? t('profileStats.syncing')
                : t('note', { count: notes })}
            </Text>
          </StatCard>
        </HStack>

        <HStack gap={10}>
          <StatCard route="Studies">
            <StatValue icon="feather" count={studies} isLoading={isSyncing(['studies'])} />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['studies']) && studies === 0
                ? t('profileStats.syncing')
                : t('étude', { count: studies })}
            </Text>
          </StatCard>

          <StatCard route="BibleVerseLinks">
            <StatValue icon="link" count={links} isLoading={isSyncing(['links'])} />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['links']) && links === 0
                ? t('profileStats.syncing')
                : t('lien', { count: links })}
            </Text>
          </StatCard>

          <StatCard route="Tags">
            <StatValue icon="tag" count={tags} isLoading={isSyncing(['tags'])} />
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {isSyncing(['tags']) && tags === 0
                ? t('profileStats.syncing')
                : t('étiquette', { count: tags })}
            </Text>
          </StatCard>
        </HStack>
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
    <HStack alignItems="center" gap={8}>
      <ChipIcon name={icon} size={18} />
      {showLoader ? (
        <ActivityIndicator size="small" color={theme.colors.primary} />
      ) : (
        <Text bold fontSize={18}>
          {count}
        </Text>
      )}
    </HStack>
  )
}

const StatCard = styled(Link)(({ theme }) => ({
  flex: 1,
  backgroundColor: theme.colors.reverse,
  borderRadius: 12,
  padding: 12,
  shadowColor: 'rgb(89,131,240)',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 1,
}))

const ChipIcon = styled(Icon.Feather)(({ theme }) => ({
  color: theme.colors.grey,
}))

export default ProfileStats
