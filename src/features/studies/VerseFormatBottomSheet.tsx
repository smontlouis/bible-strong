import type BottomSheet from '@gorhom/bottom-sheet'
import React, { useCallback } from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import Modal from '~common/Modal'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'

interface VerseFormatBottomSheetProps {
  verseFormatModalRef: React.RefObject<BottomSheet>
  addToStudyModalRef: React.RefObject<BottomSheet>
  onSelectFormat: (format: 'inline' | 'block') => void
  onClose?: () => void
}

const VerseFormatBottomSheet = ({
  verseFormatModalRef,
  addToStudyModalRef,
  onSelectFormat,
  onClose,
}: VerseFormatBottomSheetProps) => {
  const { t } = useTranslation()

  const handleSelectFormat = useCallback(
    (format: 'inline' | 'block') => {
      onSelectFormat(format)
      setTimeout(() => {
        verseFormatModalRef.current?.close()
        addToStudyModalRef.current?.close()
      }, 250)
    },
    [onSelectFormat, verseFormatModalRef]
  )

  return (
    <Modal.Body
      ref={verseFormatModalRef}
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
        <TouchableOpacity onPress={() => handleSelectFormat('inline')}>
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
        <TouchableOpacity onPress={() => handleSelectFormat('block')}>
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

export default VerseFormatBottomSheet
