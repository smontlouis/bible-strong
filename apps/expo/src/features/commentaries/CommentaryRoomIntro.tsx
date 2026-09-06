import { twMerge } from '~common/ui/classNames'

import type { CommentaryCatalogEntry } from '@bible-strong/resource-catalog/commentaries'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { getCommentaryTaxonomyLabelKey } from './commentaryCatalogFilters'
import CommentaryAvatar from './CommentaryAvatar'
const CommentaryTag = ({ label, emphasized = false }: { label: string; emphasized?: boolean }) => {
  return (
    <Box
      className={twMerge(
        'overflow-hidden border-continuous',
        twMerge(
          emphasized ? 'bg-light-primary' : 'bg-light-grey',
          'overflow-hidden border-continuous px-[10px] py-[6px] rounded-[14px]'
        )
      )}
    >
      <Text className={twMerge(emphasized ? 'text-primary' : 'text-default', 'text-[12px]')}>
        {label}
      </Text>
    </Box>
  )
}

const CommentaryIdentity = ({
  entry,
  language,
  showChevron = false,
}: {
  entry: CommentaryCatalogEntry
  language: ResourceLanguage
  showChevron?: boolean
}) => (
  <Box className="overflow-hidden border-continuous flex-row items-center gap-[14px]">
    <CommentaryAvatar
      resourceCode={`${entry.publicationId}:${language}`}
      author={entry.author}
      fallback={entry.shortName}
      size={56}
    />
    <Box className="overflow-hidden border-continuous flex-[1] gap-[3px]">
      <Text className="text-[19px] leading-[23px] font-bold" numberOfLines={2}>
        {entry.title}
      </Text>
      <Text className="text-tertiary text-[13px]" numberOfLines={1}>
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
        className="border-continuous overflow-hidden bg-reverse rounded-[22px] border-[1px] border-border px-[18px] py-[17px] mb-[16px]"
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
    <Box className="border-continuous overflow-hidden bg-reverse rounded-[22px] border-[1px] border-border px-[18px] py-[17px] mb-[16px]">
      <CommentaryIdentity entry={entry} language={language} />

      <Box className="border-continuous overflow-hidden mt-[16px] pt-[16px] border-t-[1px] border-border">
        {description ? (
          <Text className="text-[15px] leading-[22px] text-default">{description}</Text>
        ) : null}

        <Box className="overflow-hidden border-continuous flex-row flex-wrap mt-[15px] gap-[8px]">
          {entry.tags.map(tag => (
            <CommentaryTag key={tag} label={t(getCommentaryTaxonomyLabelKey(tag))} />
          ))}
        </Box>

        <Box className="overflow-hidden border-continuous flex-row flex-wrap mt-[9px] gap-[8px]">
          <CommentaryTag emphasized label={t(`versionCatalog.language.${language}`)} />
          <CommentaryTag emphasized label={t(getCommentaryTaxonomyLabelKey(entry.tradition))} />
        </Box>
      </Box>

      <Box className="border-continuous overflow-hidden mt-[16px] pt-[14px] border-t-[1px] border-border">
        <Text className="text-tertiary text-[12px] leading-[17px]">{rights}</Text>
      </Box>
    </Box>
  )
}

export default CommentaryRoomIntro
