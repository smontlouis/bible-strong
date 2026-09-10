import { useReferencePreview } from '~features/bibleReferencePreview/state'
import React from 'react'
import { useTranslation } from 'react-i18next'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
const CommentaryEntryNavigation = ({
  hasPrevious,
  hasNext,
  onPrevious,
  onNext,
  reference,
  referenceDisabled,
  onReferencePress,
}: {
  hasPrevious: boolean
  hasNext: boolean
  onPrevious: () => void
  onNext: () => void
  reference: string
  referenceDisabled?: boolean
  onReferencePress: () => void
}) => {
  const preview = useReferencePreview()
  const { t } = useTranslation()

  return (
    <Box className="overflow-hidden border-continuous flex-row items-center justify-between">
      <TouchableBox
        className="overflow-hidden border-continuous rounded-[18px] bg-light-grey items-center justify-center"
        disabled={!hasPrevious}
        activeOpacity={0.62}
        onPress={onPrevious}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.resource.previousCommentary')}
        accessibilityState={{ disabled: !hasPrevious }}
        style={[
          { opacity: !hasPrevious ? 0.6 : 1 },
          [{ opacity: !hasPrevious ? 0.6 : hasPrevious ? 1 : 0.35, width: 36, height: 36 }],
        ]}
      >
        <FeatherIcon name="chevron-left" size={20} color="primary" />
      </TouchableBox>

      <TouchableBox
        className="overflow-hidden border-continuous flex-[1] mx-[12px] px-[11px] py-[7px] rounded-[14px] bg-light-primary items-center justify-center"
        activeOpacity={0.62}
        disabled={referenceDisabled}
        accessibilityRole={referenceDisabled ? undefined : 'link'}
        onPress={() => {
          if (!preview({ href: reference, type: 'verse' }, onReferencePress)) onReferencePress()
        }}
        style={[
          { opacity: referenceDisabled ? 0.6 : 1 },
          [{ opacity: referenceDisabled ? 0.6 : 1 }],
        ]}
      >
        <Text className="text-primary font-bold" numberOfLines={1}>
          {reference}
        </Text>
      </TouchableBox>

      <TouchableBox
        className="overflow-hidden border-continuous rounded-[18px] bg-light-grey items-center justify-center"
        disabled={!hasNext}
        activeOpacity={0.62}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.resource.nextCommentary')}
        accessibilityState={{ disabled: !hasNext }}
        style={[
          { opacity: !hasNext ? 0.6 : 1 },
          [{ opacity: !hasNext ? 0.6 : hasNext ? 1 : 0.35, width: 36, height: 36 }],
        ]}
      >
        <FeatherIcon name="chevron-right" size={20} color="primary" />
      </TouchableBox>
    </Box>
  )
}

export default CommentaryEntryNavigation
