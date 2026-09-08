import { useTranslation } from 'react-i18next'
import type {
  CommentaryCatalogEntry,
  CommentaryLanguage,
} from '@bible-strong/resource-catalog/commentaries'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import CommentaryAvatar from './CommentaryAvatar'
export type CommentarySource = { entry: CommentaryCatalogEntry; language: CommentaryLanguage }
export default function CommentarySourceDetails({
  projection: { entry, language },
}: {
  projection: CommentarySource
}) {
  const { t } = useTranslation()
  return (
    <Box className="p-3 gap-3">
      <Box className="flex-row gap-3 items-center">
        <CommentaryAvatar
          resourceCode={entry.publicationId + ':' + language}
          author={entry.author}
          fallback={entry.shortName}
          size={48}
        />
        <Text className="flex-1 font-bold text-[14px]">{entry.author}</Text>
      </Box>
      <Text className="text-[12px] text-tertiary">
        {t('versionCatalog.language.' + language)} · {entry.tradition}
      </Text>
      <Text className="text-[14px]">{entry.description[language]}</Text>
      <Text className="text-[12px] text-tertiary">{entry.tags.join(' · ')}</Text>
      <Text className="text-[12px] text-tertiary">{entry.rights}</Text>
    </Box>
  )
}
