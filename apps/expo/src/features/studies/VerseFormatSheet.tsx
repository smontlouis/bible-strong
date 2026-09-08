import React from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'
import { SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon, MaterialIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
interface VerseFormatSheetProps {
  sheetRef: React.RefObject<SheetRef | null>
  onSelectFormat: (format: 'inline' | 'block') => void
  reference?: string
  onClose?: () => void
}

const VerseFormatSheet = ({
  sheetRef,
  onSelectFormat,
  reference,
  onClose,
}: VerseFormatSheetProps) => {
  const { t } = useTranslation()

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      header={<SheetHeader title={t('study.formatChoice')} subTitle={reference} />}
    >
      <SheetView className="p-[20px]">
        {/* Inline format option */}
        <TouchableOpacity accessibilityRole="radio" onPress={() => onSelectFormat('inline')}>
          <HStack className="overflow-hidden border-continuous py-[16px] px-[16px] rounded-[12px] bg-light-grey mb-[12px] items-center">
            <FeatherIcon name="link-2" size={24} />
            <Box className="overflow-hidden border-continuous flex-[1] ml-[16px]">
              <Text className="text-[16px] font-bold">{t('study.asLink')}</Text>
              <Text className="text-[13px] text-tertiary mt-[4px]">
                {t('study.asLinkDescription')}
              </Text>
            </Box>
            <FeatherIcon name="arrow-right" size={20} color="grey" />
          </HStack>
        </TouchableOpacity>

        {/* Block format option */}
        <TouchableOpacity accessibilityRole="radio" onPress={() => onSelectFormat('block')}>
          <HStack className="overflow-hidden border-continuous py-[16px] px-[16px] rounded-[12px] bg-light-grey items-center">
            <MaterialIcon name="short-text" size={24} />
            <Box className="overflow-hidden border-continuous flex-[1] ml-[16px]">
              <Text className="text-[16px] font-bold">{t('study.asBlock')}</Text>
              <Text className="text-[13px] text-tertiary mt-[4px]">
                {t('study.asBlockDescription')}
              </Text>
            </Box>
            <FeatherIcon name="arrow-right" size={20} color="grey" />
          </HStack>
        </TouchableOpacity>
      </SheetView>
    </Sheet>
  )
}

export default VerseFormatSheet
