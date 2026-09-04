import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getCommentaryTaxonomyLabelKey } from './commentaryCatalogFilters'
import CommentaryAvatar from './CommentaryAvatar'

const CommentaryTag = ({ label, emphasized = false }: { label: string; emphasized?: boolean }) => (
  <Box px={10} py={6} borderRadius={14} bg={emphasized ? 'lightPrimary' : 'lightGrey'}>
    <Text fontSize={12} color={emphasized ? 'primary' : 'default'}>
      {label}
    </Text>
  </Box>
)

const CommentaryIdentity = ({
  entry,
  language,
  showChevron = false,
}: {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
  showChevron?: boolean
}) => (
  <Box row alignItems="center" gap={14}>
    <CommentaryAvatar
      resourceCode={`${entry.publicationId}:${language}`}
      author={entry.author}
      fallback={entry.shortName}
      size={56}
    />
    <Box flex gap={3}>
      <Text fontSize={19} lineHeight={23} bold numberOfLines={2}>
        {entry.title}
      </Text>
      <Text color="tertiary" fontSize={13} numberOfLines={1}>
        {entry.author}
      </Text>
    </Box>
    {showChevron ? <FeatherIcon name="chevron-right" size={20} color="grey" /> : null}
  </Box>
)

const CommentaryRoomIntro = ({
  entry,
  language,
  compact = false,
  onPress,
}: {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
  compact?: boolean
  onPress?: () => void
}) => {
  const { t } = useTranslation()
  const description = entry.description[language]
  const rights =
    entry.rights === 'Domaine public' ? t('commentaries.details.publicDomain') : entry.rights

  if (compact) {
    return (
      <TouchableBox
        bg="reverse"
        borderRadius={22}
        borderWidth={1}
        borderColor="border"
        px={18}
        py={17}
        mb={16}
        activeOpacity={0.62}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.details.openRoom', { commentary: entry.title })}
      >
        <CommentaryIdentity entry={entry} language={language} showChevron />
      </TouchableBox>
    )
  }

  return (
    <Box
      bg="reverse"
      borderRadius={22}
      borderWidth={1}
      borderColor="border"
      px={18}
      py={17}
      mb={16}
    >
      <CommentaryIdentity entry={entry} language={language} />

      <Box mt={16} pt={16} borderTopWidth={1} borderColor="border">
        {description ? (
          <Text fontSize={15} lineHeight={22} color="default">
            {description}
          </Text>
        ) : null}

        <Box row wrap mt={15} gap={8}>
          {entry.tags.map(tag => (
            <CommentaryTag key={tag} label={t(getCommentaryTaxonomyLabelKey(tag))} />
          ))}
        </Box>

        <Box row wrap mt={9} gap={8}>
          <CommentaryTag emphasized label={t(`versionCatalog.language.${language}`)} />
          <CommentaryTag emphasized label={t(getCommentaryTaxonomyLabelKey(entry.tradition))} />
        </Box>
      </Box>

      <Box mt={16} pt={14} borderTopWidth={1} borderColor="border">
        <Text color="tertiary" fontSize={12} lineHeight={17}>
          {rights}
        </Text>
      </Box>
    </Box>
  )
}

export default CommentaryRoomIntro
