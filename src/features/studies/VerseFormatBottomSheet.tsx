import type { BottomSheetModal } from '@gorhom/bottom-sheet'
import React, { memo, useCallback } from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

interface VerseFormatBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  onSelectFormat: (format: 'inline' | 'block') => void
  onClose?: () => void
}

const VerseFormatBottomSheet = ({
  bottomSheetRef,
  onSelectFormat,
  onClose,
}: VerseFormatBottomSheetProps) => {
  const { t } = useTranslation()

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={onClose}
      withPortal
      snapPoints={[280]}
      headerComponent={
        <Box paddingTop={20} paddingBottom={10} paddingHorizontal={20}>
          <Text flex textAlign="center" fontSize={16} bold>
            {t('study.formatChoice')}
          </Text>
        </Box>
      }
    >
      <Box paddingHorizontal={20} paddingBottom={20}>
        {/* Inline format option */}
        <TouchableOpacity onPress={() => onSelectFormat('inline')}>
          <HStack
            paddingVertical={16}
            paddingHorizontal={16}
            borderRadius={12}
            bg="lightGrey"
            marginBottom={12}
            alignItems="center"
          >
            <FeatherIcon name="link-2" size={24} />
            <Box flex marginLeft={16}>
              <Text fontSize={16} bold>
                {t('study.asLink')}
              </Text>
              <Text fontSize={13} color="tertiary" marginTop={4}>
                {t('study.asLinkDescription')}
              </Text>
            </Box>
            <FeatherIcon name="arrow-right" size={20} color="grey" />
          </HStack>
        </TouchableOpacity>

        {/* Block format option */}
        <TouchableOpacity onPress={() => onSelectFormat('block')}>
          <HStack
            paddingVertical={16}
            paddingHorizontal={16}
            borderRadius={12}
            bg="lightGrey"
            alignItems="center"
          >
            <MaterialIcon name="short-text" size={24} />
            <Box flex marginLeft={16}>
              <Text fontSize={16} bold>
                {t('study.asBlock')}
              </Text>
              <Text fontSize={13} color="tertiary" marginTop={4}>
                {t('study.asBlockDescription')}
              </Text>
            </Box>
            <FeatherIcon name="arrow-right" size={20} color="grey" />
          </HStack>
        </TouchableOpacity>
      </Box>
    </Modal.Body>
  )
}

export default memo(VerseFormatBottomSheet)
