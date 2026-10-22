import { useTheme } from '~themes/ThemeProvider'
import React from 'react'
import { useTranslation } from 'react-i18next'
import { SheetFlatList, SheetFooter, SheetHeader, type SheetRef } from '~common/sheet'
import Sheet from '~common/ModalSheet'
import Box, { TouchableBox } from '~common/ui/Box'
import IconTile from '~common/ui/IconTile'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { StyleSheet } from 'react-native'
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
      className="overflow-hidden border-continuous mx-[20px] mb-[16px] px-[14px] min-h-[44px] rounded-[16px] flex-row items-center"
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
          <Box
            className="border-continuous overflow-hidden px-[20px] py-[14px] flex-row items-center gap-[12px] border-separator"
            style={{ borderBottomWidth: StyleSheet.hairlineWidth }}
          >
            <IconTile tint="primary">
              <FeatherIcon name="refresh-cw" size={16} color="primary" />
            </IconTile>
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
