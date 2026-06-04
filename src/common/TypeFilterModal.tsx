import styled from '@emotion/native'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'

const TypeRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const SectionHeader = styled.View(({ theme }) => ({
  padding: 16,
  paddingBottom: 8,
  backgroundColor: theme.colors.lightGrey,
}))

type Props = {
  selectedType?: string // 'all' | 'annotations' | VersionCode
  availableVersions: string[] // List of versions with annotations
  onSelect: (type: string | undefined) => void
}

const TypeFilterModal = forwardRef<SheetRef, Props>(
  ({ selectedType, availableVersions, onSelect }, ref) => {
    const { t } = useTranslation()
    const { bottomBarHeight } = useBottomBarHeightInTab()

    const isAllSelected = !selectedType || selectedType === 'all'
    const isAnnotationsSelected = selectedType === 'annotations'

    return (
      <Sheet ref={ref} snapPoints={[0.5]} header={<SheetHeader title={t('Filtrer par type')} />}>
        <SheetScrollView
          contentContainerStyle={{
            paddingBottom: bottomBarHeight,
          }}
        >
          {/* Option "Tout" */}
          <TypeRow onPress={() => onSelect(undefined)}>
            <Box
              width={24}
              height={24}
              borderRadius={6}
              marginRight={12}
              borderWidth={2}
              borderColor="border"
              center
            >
              {isAllSelected && <FeatherIcon name="check" size={14} color="primary" />}
            </Box>
            <Text flex={1} fontSize={16}>
              {t('Tout')}
            </Text>
            {isAllSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </TypeRow>

          {/* Option "Annotations" (toutes) */}
          <TypeRow onPress={() => onSelect('annotations')}>
            <Box
              width={24}
              height={24}
              borderRadius={6}
              marginRight={12}
              borderWidth={2}
              borderColor="border"
              center
            >
              {isAnnotationsSelected && <FeatherIcon name="check" size={14} color="primary" />}
            </Box>
            <Text flex={1} fontSize={16}>
              {t('Annotations')}
            </Text>
            {isAnnotationsSelected && <FeatherIcon name="check" size={20} color="primary" />}
          </TypeRow>

          {/* Section versions when present */}
          {availableVersions.length > 0 && (
            <>
              <SectionHeader>
                <Text color="tertiary" fontSize={13} bold>
                  {t('Par version')}
                </Text>
              </SectionHeader>

              {availableVersions.map(version => {
                const isSelected = selectedType === version
                return (
                  <TypeRow key={version} onPress={() => onSelect(version)}>
                    <Box
                      width={24}
                      height={24}
                      borderRadius={6}
                      marginRight={12}
                      borderWidth={2}
                      borderColor="border"
                      center
                    >
                      {isSelected && <FeatherIcon name="check" size={14} color="primary" />}
                    </Box>
                    <Text flex={1} fontSize={16}>
                      {version}
                    </Text>
                    {isSelected && <FeatherIcon name="check" size={20} color="primary" />}
                  </TypeRow>
                )
              })}
            </>
          )}
        </SheetScrollView>
      </Sheet>
    )
  }
)

TypeFilterModal.displayName = 'TypeFilterModal'

export default TypeFilterModal
