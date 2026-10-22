import type { TFunction } from 'i18next'
import { TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

/** The verses a section covers, as the reader names them: « Verset 3 », « Versets 1–5 ». */
export const formatCommentarySectionRange = (
  t: TFunction,
  start: number,
  end: number,
  introductionLabel?: string
) => {
  if (introductionLabel && start === 0 && end === 0) return introductionLabel
  return start === end
    ? t('commentaries.resource.verse', { range: `${start}` })
    : t('commentaries.resource.verses', { range: `${start}–${end}` })
}

/** A section of a commentary's chapter, as a row of its card: the verses it covers, then its first lines. */
const CommentarySectionRow = ({
  rangeLabel,
  preview,
  onPress,
}: {
  rangeLabel: string
  preview: string
  onPress: () => void
}) => (
  <TouchableBox
    className="overflow-hidden border-continuous flex-row items-center gap-[12px] px-[16px] py-[12px]"
    activeOpacity={0.62}
    onPress={onPress}
    accessibilityRole="button"
  >
    <VStack className="flex-[1] gap-[2px]">
      <Text className="text-[15px] font-semibold">{rangeLabel}</Text>
      <Text className="text-grey text-[14px] leading-[20px]" numberOfLines={2}>
        {preview}
      </Text>
    </VStack>
    <FeatherIcon name="chevron-right" size={18} color="grey" />
  </TouchableBox>
)

export default CommentarySectionRow
