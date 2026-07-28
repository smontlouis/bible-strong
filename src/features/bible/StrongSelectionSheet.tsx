import { useTranslation } from 'react-i18next'
import { Sheet, SheetHeader, SheetView, type SheetRef } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import type { StrongIdentity } from '~helpers/strongIdentities'

type StrongSelectionSheetProps = {
  sheetRef: React.RefObject<SheetRef | null>
  version?: string
  identities: StrongIdentity[]
  onClose: () => void
}

const StrongSelectionSheet = ({
  sheetRef,
  version,
  identities,
  onClose,
}: StrongSelectionSheetProps) => {
  const { t } = useTranslation()

  return (
    <Sheet ref={sheetRef} header={<SheetHeader title={t('Strong')} />} onDismiss={onClose}>
      <SheetView px={20} pt={18} pb={24} gap={18}>
        <Box gap={7}>
          <Text color="grey" fontSize={13}>
            {t('Version')}
          </Text>
          <Box bg="lightGrey" borderRadius={12} px={14} py={12}>
            <Text bold fontSize={17} selectable>
              {version}
            </Text>
          </Box>
        </Box>
        <Box gap={7}>
          <Text color="grey" fontSize={13}>
            {t('Strong')}
          </Text>
          <HStack bg="lightGrey" borderRadius={12} px={14} py={12} gap={8} wrap>
            {identities.map(identity => (
              <Text key={`${identity.kind}:${identity.code}`} bold fontSize={17} selectable>
                {identity.code}
              </Text>
            ))}
          </HStack>
        </Box>
      </SheetView>
    </Sheet>
  )
}

export default StrongSelectionSheet
