import BottomSheet from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useCallback } from 'react'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'
import {
  onAnimateModalClose,
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'

interface VerseFormatBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet>
  onSelectFormat: (format: 'inline' | 'block') => void
  onClose?: () => void
}

const VerseFormatBottomSheet = ({
  bottomSheetRef,
  onSelectFormat,
  onClose,
}: VerseFormatBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()

  const handleSelectFormat = useCallback(
    (format: 'inline' | 'block') => {
      onSelectFormat(format)
      setTimeout(() => {
        bottomSheetRef.current?.close()
      }, 250)
    },
    [onSelectFormat, bottomSheetRef]
  )

  return (
    <Portal>
      <BottomSheet
        ref={bottomSheetRef}
        snapPoints={[280]}
        index={-1}
        enablePanDownToClose
        enableDynamicSizing={false}
        backdropComponent={renderBackdrop}
        onAnimate={onAnimateModalClose(onClose)}
        key={key}
        {...bottomSheetStyles}
      >
        <Box paddingHorizontal={20} paddingVertical={10}>
          <HStack
            height={54}
            justifyContent="center"
            alignItems="center"
            marginBottom={10}
          >
            <Text flex textAlign="center" fontSize={16} bold>
              {t('study.formatChoice')}
            </Text>
          </HStack>

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
              <FeatherIcon name="link" size={24} />
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
              <FeatherIcon name="file-text" size={24} />
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
      </BottomSheet>
    </Portal>
  )
}

export default VerseFormatBottomSheet
