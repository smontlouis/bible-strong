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
  const { t } = useTranslation()

  return (
    <Box row alignItems="center" justifyContent="space-between">
      <TouchableBox
        size={36}
        borderRadius={18}
        bg="lightGrey"
        center
        disabled={!hasPrevious}
        opacity={hasPrevious ? 1 : 0.35}
        activeOpacity={0.62}
        onPress={onPrevious}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.resource.previousCommentary')}
        accessibilityState={{ disabled: !hasPrevious }}
      >
        <FeatherIcon name="chevron-left" size={20} color="primary" />
      </TouchableBox>

      <TouchableBox
        flex
        mx={12}
        px={11}
        py={7}
        borderRadius={14}
        bg="lightPrimary"
        center
        activeOpacity={0.62}
        disabled={referenceDisabled}
        accessibilityRole={referenceDisabled ? undefined : 'link'}
        onPress={onReferencePress}
      >
        <Text color="primary" bold numberOfLines={1}>
          {reference}
        </Text>
      </TouchableBox>

      <TouchableBox
        size={36}
        borderRadius={18}
        bg="lightGrey"
        center
        disabled={!hasNext}
        opacity={hasNext ? 1 : 0.35}
        activeOpacity={0.62}
        onPress={onNext}
        accessibilityRole="button"
        accessibilityLabel={t('commentaries.resource.nextCommentary')}
        accessibilityState={{ disabled: !hasNext }}
      >
        <FeatherIcon name="chevron-right" size={20} color="primary" />
      </TouchableBox>
    </Box>
  )
}

export default CommentaryEntryNavigation
