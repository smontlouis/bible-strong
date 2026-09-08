import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import type { CommentarySource } from './CommentarySourceDetails'
export type CommentaryDetailsTriggerProps = { projection: CommentarySource; onPress: () => void }
export default function CommentaryDetailsTrigger({
  projection,
  onPress,
}: CommentaryDetailsTriggerProps) {
  const { t } = useTranslation()
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={t('commentaries.details.manage', { commentary: projection.entry.title })}
    >
      <Box className="w-[46px] h-[48px] items-center justify-center">
        <FeatherIcon name="more-horizontal" size={20} />
      </Box>
    </TouchableOpacity>
  )
}
