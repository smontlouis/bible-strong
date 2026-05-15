import BottomSheet from '@gorhom/bottom-sheet'
import React from 'react'
import { SectionList } from 'react-native'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import Border from '~common/ui/Border'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import VersionSelectorItem from '~features/bible/VersionSelectorItem'
import { getVersionsBySections } from '~helpers/bibleVersions'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { toggleCompareVersion } from '~redux/modules/user'
import type { RootState } from '~redux/modules/reducer'
import type { AppDispatch } from '~redux/store'
import type { Version } from '~helpers/bibleVersions'
import type { VersionCode } from 'src/state/tabs'

type CompareVersionSelectorBottomSheetProps = {
  bottomSheetRef: React.RefObject<BottomSheet | null>
}

const CompareVersionSelectorBottomSheet = ({
  bottomSheetRef,
}: CompareVersionSelectorBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()
  const dispatch = useDispatch<AppDispatch>()
  const versionsToCompare = useSelector(
    (state: RootState) => Object.keys(state.user.bible.settings.compare),
    shallowEqual
  )

  const toggleVersion = (versionId: VersionCode) => {
    dispatch(toggleCompareVersion(versionId))
  }

  const addCompletedDownload = (versionId: VersionCode) => {
    if (!versionsToCompare.includes(versionId)) {
      dispatch(toggleCompareVersion(versionId))
    }
  }

  return (
    <BottomSheet
      ref={bottomSheetRef}
      snapPoints={['100%']}
      index={-1}
      topInset={insets.top + 64}
      enablePanDownToClose
      enableDynamicSizing={false}
      enableContentPanningGesture={false}
      backdropComponent={renderBackdrop}
      key={key}
      {...bottomSheetStyles}
    >
      <HStack
        height={54}
        justifyContent="center"
        alignItems="center"
        borderBottomWidth={1}
        borderColor="lightGrey"
      >
        <Text flex textAlign="center" fontSize={16} bold>
          {t('Sélectionner les versions')}
        </Text>
      </HStack>
      <SectionList<Version, { title: string; data: Version[] }>
        contentContainerStyle={{
          paddingTop: 0,
          paddingBottom: insets.bottom,
        }}
        stickySectionHeadersEnabled={false}
        sections={getVersionsBySections()}
        keyExtractor={item => item.id}
        renderSectionHeader={({ section: { title } }) => (
          <Box paddingHorizontal={20} marginTop={30}>
            <Text fontSize={16} color="tertiary">
              {title}
            </Text>
            <Border marginTop={10} />
          </Box>
        )}
        renderItem={({ item }) => (
          <VersionSelectorItem
            version={item}
            isSelected={versionsToCompare.includes(item.id)}
            onChange={toggleVersion}
            onDownloadComplete={addCompletedDownload}
          />
        )}
      />
    </BottomSheet>
  )
}

export default CompareVersionSelectorBottomSheet
