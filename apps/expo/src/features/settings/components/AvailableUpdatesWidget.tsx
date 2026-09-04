import { useTheme } from '@emotion/react'
import React from 'react'
import { useTranslation } from 'react-i18next'

import { Sheet, SheetFlatList, SheetFooter, SheetHeader, type SheetRef } from '~common/sheet'
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
      mx={16}
      mb={16}
      px={12}
      minHeight={42}
      borderRadius={12}
      row
      alignItems="center"
      accessibilityRole="button"
      accessibilityLabel={t('downloads.updatesAvailable', { count })}
      onPress={onPress}
      style={{ backgroundColor: `${theme.colors.success}14` }}
    >
      <Text flex bold fontSize={13} color="success">
        {t('downloads.updatesAvailable', { count })}
      </Text>
      <Text bold fontSize={12} color="success">
        {t('downloads.viewUpdates')}
      </Text>
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
          <Box height={48}>
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
          <Box px={20} py={14} row alignItems="center" borderBottomWidth={1} borderColor="border">
            <Box size={36} borderRadius={10} bg="lightPrimary" center mr={12}>
              <FeatherIcon name="refresh-cw" size={17} color="primary" />
            </Box>
            <Box flex>
              <Text fontSize={15} bold numberOfLines={2}>
                {item.name}
              </Text>
              {!!item.subtitle && (
                <Text mt={3} fontSize={12} color="tertiary" numberOfLines={2}>
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
