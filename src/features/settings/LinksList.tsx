import React from 'react'
import { TouchableOpacity } from 'react-native'
import distanceInWords from 'date-fns/formatDistance'
import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'

import styled from '@emotion/native'
import { useNavigation } from '@react-navigation/native'

import TagList from '~common/TagList'
import { FeatherIcon } from '~common/ui/Icon'
import { LinkBox } from '~common/Link'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import Paragraph from '~common/ui/Paragraph'
import truncate from '~helpers/truncate'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import FlatList from '~common/ui/FlatList'
import { GroupedLink } from './LinksScreen'
import books from '~assets/bible_versions/books-desc'

const DateText = styled.Text(({ theme }) => ({
  color: theme.colors.tertiary,
}))

const LinkTypeIcon = styled(Box)<{ bgColor: string }>(({ bgColor }) => ({
  width: 20,
  height: 20,
  borderRadius: 3,
  backgroundColor: bgColor,
  marginRight: 8,
  alignItems: 'center',
  justifyContent: 'center',
}))

const linkTypeConfig: Record<string, { icon: string; color: string; label: string }> = {
  youtube: { icon: 'youtube', color: '#FF0000', label: 'YT' },
  twitter: { icon: 'twitter', color: '#1DA1F2', label: 'X' },
  instagram: { icon: 'instagram', color: '#E4405F', label: 'IG' },
  tiktok: { icon: 'music', color: '#000000', label: 'TT' },
  spotify: { icon: 'music', color: '#1DB954', label: '♫' },
  facebook: { icon: 'facebook', color: '#1877F2', label: 'FB' },
  vimeo: { icon: 'video', color: '#1AB7EA', label: 'V' },
  website: { icon: 'link', color: '#888888', label: '🔗' },
}

const Container = styled(Box)(({ theme }) => ({
  margin: 20,
  paddingBottom: 20,
  marginBottom: 0,
  borderBottomColor: theme.colors.border,
  borderBottomWidth: 1,
}))

interface LinkItemProps {
  link: GroupedLink
  onPress: (link: GroupedLink) => void
}

const LinkItem = ({ link, onPress }: LinkItemProps) => {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const isFR = useLanguage()

  const formattedDate = distanceInWords(Number(link.date), Date.now(), {
    locale: isFR ? fr : enGB,
  })

  // Parse the verse key to get book, chapter, verse
  const firstVerseRef = link.key.split('/')[0]
  const [livre, chapitre, verset] = firstVerseRef.split('-').map(Number)

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={() =>
        // @ts-ignore
        navigation.navigate('BibleView', {
          isReadOnly: true,
          // @ts-ignore
          book: books[livre - 1],
          chapter: chapitre,
          verse: verset,
        })
      }
    >
      <Container>
        <Box row style={{ marginBottom: 10 }} alignItems="center">
          <Box flex row alignItems="center">
            <LinkTypeIcon bgColor={linkTypeConfig[link.linkType]?.color || linkTypeConfig.website.color}>
              {link.linkType === 'website' ? (
                <FeatherIcon name="link" size={12} color="white" />
              ) : (
                <Text color="white" fontSize={10} bold>
                  {linkTypeConfig[link.linkType]?.label || '🔗'}
                </Text>
              )}
            </LinkTypeIcon>
            <Text fontSize={14} marginLeft={5} title numberOfLines={1} flex>
              {truncate(link.title, 40)}
            </Text>
          </Box>
          <DateText style={{ fontSize: 10 }}>
            {t('Il y a {{formattedDate}}', { formattedDate })}
          </DateText>
          <LinkBox p={4} ml={10} onPress={() => onPress(link)}>
            <FeatherIcon name="more-vertical" size={20} />
          </LinkBox>
        </Box>
        <Box row alignItems="center" mb={10}>
          <Text fontSize={12} color="grey">
            {/* @ts-ignore */}
            {books[livre - 1]?.Nom} {chapitre}:{link.versesFormatted}
          </Text>
        </Box>
        <Paragraph scale={-3} color="tertiary" numberOfLines={1}>
          {link.url}
        </Paragraph>
        {Object.keys(link.tags).length > 0 && (
          <Box mt={10}>
            {/* @ts-ignore */}
            <TagList tags={link.tags} />
          </Box>
        )}
      </Container>
    </TouchableOpacity>
  )
}

interface Props {
  links: GroupedLink[]
  onLinkPress: (link: GroupedLink) => void
}

const LinksList = React.memo(({ links, onLinkPress }: Props) => {
  return (
    <FlatList
      data={links}
      keyExtractor={(item: GroupedLink) => item.key}
      renderItem={({ item }: { item: GroupedLink }) => (
        <LinkItem link={item} onPress={onLinkPress} />
      )}
    />
  )
})

export default LinksList
