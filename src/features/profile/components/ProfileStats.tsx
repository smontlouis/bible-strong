import styled from '@emotion/native'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import * as Icon from '@expo/vector-icons'

import Link from '~common/Link'
import Box, { HStack, VStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { RootState } from '~redux/modules/reducer'

const ProfileStats = () => {
  const { t } = useTranslation()

  const highlights = useSelector(
    (state: RootState) => Object.keys(state.user.bible.highlights).length
  )
  const notes = useSelector((state: RootState) => Object.keys(state.user.bible.notes).length)
  const studies = useSelector((state: RootState) => Object.keys(state.user.bible.studies).length)
  const tags = useSelector((state: RootState) => Object.keys(state.user.bible.tags).length)
  const bookmarks = useSelector(
    (state: RootState) => Object.keys(state.user.bible.bookmarks || {}).length
  )
  const links = useSelector((state: RootState) => Object.keys(state.user.bible.links || {}).length)

  return (
    <Box bg="lightGrey" borderRadius={30} paddingVertical={20} marginHorizontal={20}>
      <Text bold fontSize={16} marginBottom={15} paddingHorizontal={20}>
        {t('profile.stats')}
      </Text>
      <VStack gap={10} paddingHorizontal={20}>
        <HStack gap={10}>
          <StatCard route="Highlights">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="edit-3" size={18} />
              <Text bold fontSize={18}>
                {highlights}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('surbrillance', { count: highlights })}
            </Text>
          </StatCard>

          <StatCard route="Bookmarks">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="bookmark" size={18} />
              <Text bold fontSize={18}>
                {bookmarks}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('marque-page', { count: bookmarks })}
            </Text>
          </StatCard>

          <StatCard route="BibleVerseNotes">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="file-text" size={18} />
              <Text bold fontSize={18}>
                {notes}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('note', { count: notes })}
            </Text>
          </StatCard>
        </HStack>

        <HStack gap={10}>
          <StatCard route="Studies">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="feather" size={18} />
              <Text bold fontSize={18}>
                {studies}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('étude', { count: studies })}
            </Text>
          </StatCard>

          <StatCard route="BibleVerseLinks">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="link" size={18} />
              <Text bold fontSize={18}>
                {links}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('lien', { count: links })}
            </Text>
          </StatCard>

          <StatCard route="Tags">
            <HStack alignItems="center" gap={8}>
              <ChipIcon name="tag" size={18} />
              <Text bold fontSize={18}>
                {tags}
              </Text>
            </HStack>
            <Text fontSize={11} color="grey" numberOfLines={1}>
              {t('étiquette', { count: tags })}
            </Text>
          </StatCard>
        </HStack>
      </VStack>
    </Box>
  )
}

const Container = styled(Box)(({ theme }) => ({
  backgroundColor: theme.colors.lightGrey,
  paddingVertical: 20,
  marginHorizontal: 20,
  borderRadius: 30,
}))

const StatCard = styled(Link)(({ theme }: { theme: any }) => ({
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
