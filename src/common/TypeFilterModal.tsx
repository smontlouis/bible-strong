import styled from '@emotion/native'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import React, { forwardRef } from 'react'
import { TouchableOpacity } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { useBottomBarHeightInTab } from '~features/app-switcher/context/TabContext'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'

const TypeRow = styled(TouchableOpacity)(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 16,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const Header = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  justifyContent: 'space-between',
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

const TypeFilterModal = forwardRef<BottomSheetModal, Props>(
  ({ selectedType, availableVersions, onSelect }, ref) => {
    const { t } = useTranslation()
    const insets = useSafeAreaInsets()
    const { key, ...bottomSheetStyles } = useBottomSheetStyles()
    const { bottomBarHeight } = useBottomBarHeightInTab()

    const isAllSelected = !selectedType || selectedType === 'all'
    const isAnnotationsSelected = selectedType === 'annotations'

    return (
      <BottomSheetModal
        ref={ref}
        topInset={insets.top}
        enablePanDownToClose
        snapPoints={['50%']}
        backdropComponent={renderBackdrop}
        activeOffsetY={[-20, 20]}
        key={key}
        {...bottomSheetStyles}
      >
        <Header>
          <Text bold fontSize={18}>
            {t('Filtrer par type')}
          </Text>
        </Header>
        <BottomSheetScrollView
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

          {/* Section versions if any */}
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
        </BottomSheetScrollView>
      </BottomSheetModal>
    )
  }
)

TypeFilterModal.displayName = 'TypeFilterModal'

export default TypeFilterModal
