import { useTheme } from '~themes/ThemeProvider'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { SheetFlatList, SheetFooter, SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import Box, { TouchableBox } from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
export type AvailableUpdateItem = {
  id: string
  name: string
  subtitle?: string
}

export const AvailableUpdatesWidget = ({
  count,
  onPress,
}: {
  count: number
  onPress: () => void
}) => {
  const { t } = useTranslation()
  const theme = useTheme()

  if (count === 0) return null

  return (
    <TouchableBox
      className="overflow-hidden border-continuous mx-[16px] mb-[16px] px-[12px] min-h-[42px] rounded-[12px] flex-row items-center"
      accessibilityRole="button"
      accessibilityLabel={t('downloads.updatesAvailable', { count })}
      onPress={onPress}
      style={{ backgroundColor: `${theme.colors.success}14` }}
    >
      <Text className="flex-[1] font-bold text-[13px] text-success">
        {t('downloads.updatesAvailable', { count })}
      </Text>
      <Text className="font-bold text-[12px] text-success">{t('downloads.viewUpdates')}</Text>
      <FeatherIcon name="chevron-right" size={14} color="success" />
    </TouchableBox>
  )
}

export const AvailableUpdatesSheet = ({
  sheetRef,
  items,
  disabled,
  onDownload,
}: {
  sheetRef: React.RefObject<SheetRef | null>
  items: readonly AvailableUpdateItem[]
  disabled: boolean
  onDownload: () => void
}) => {
  const { t } = useTranslation()

  const download = () => {
    onDownload()
    sheetRef.current?.dismiss()
  }

  return (
    <Sheet
      ref={sheetRef}
      header={<SheetHeader title={t('downloads.updatesTitle')} />}
      footer={props => (
        <SheetFooter {...props}>
          <Box className="overflow-hidden border-continuous h-[48px]">
            <Button onPress={download} disabled={disabled || items.length === 0}>
              {disabled ? t('resource.action.connectionRequired') : t('downloads.download')}
            </Button>
          </Box>
        </SheetFooter>
      )}
    >
      <SheetFlatList
        data={[...items]}
        keyExtractor={item => item.id}
        contentContainerStyle={{ paddingBottom: 16 }}
        renderItem={({ item }) => (
          <Box className="border-continuous overflow-hidden px-[20px] py-[14px] flex-row items-center border-b-[1px] border-border">
            <Box
              className="overflow-hidden border-continuous rounded-[10px] bg-light-primary items-center justify-center mr-[12px]"
              style={{ width: 36, height: 36 }}
            >
              <FeatherIcon name="refresh-cw" size={17} color="primary" />
            </Box>
            <Box className="overflow-hidden border-continuous flex-[1]">
              <Text className="text-[15px] font-bold" numberOfLines={2}>
                {item.name}
              </Text>
              {!!item.subtitle && (
                <Text className="mt-[3px] text-[12px] text-tertiary" numberOfLines={2}>
                  {item.subtitle}
                </Text>
              )}
            </Box>
          </Box>
        )}
      />
    </Sheet>
  )
}
