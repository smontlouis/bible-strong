import BottomSheet from '@gorhom/bottom-sheet'
import { Portal } from '@gorhom/portal'
import React, { useCallback, useMemo } from 'react'
import { SectionList } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai/react'
import { atom, PrimitiveAtom } from 'jotai/vanilla'

import { getVersionsBySections } from '~helpers/bibleVersions'
import {
  BibleTab,
  BibleTabActions,
  useBibleTabActions,
  VersionCode,
} from '../../../state/tabs'
import VersionSelectorItem from '../VersionSelectorItem'
import {
  renderBackdrop,
  useBottomSheetStyles,
} from '~helpers/bottomSheetHelpers'
import Box, { HStack } from '~common/ui/Box'
import Text from '~common/ui/Text'
import Border from '~common/ui/Border'

interface VersionSelectorBottomSheetProps {
  bottomSheetRef: React.RefObject<BottomSheet>
}

export const versionSelectorDataAtom = atom<{
  actions?: Pick<BibleTabActions, 'setSelectedVersion' | 'setParallelVersion'>
  data?: BibleTab['data']
  parallelVersionIndex?: number
}>({})

const VersionSelectorBottomSheet = ({
  bottomSheetRef,
}: VersionSelectorBottomSheetProps) => {
  const insets = useSafeAreaInsets()
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const { t } = useTranslation()

  const { actions, data, parallelVersionIndex } = useAtomValue(
    versionSelectorDataAtom
  )

  const handleVersionSelect = (vers: VersionCode) => {
    if (!actions) return

    if (parallelVersionIndex === undefined) {
      actions.setSelectedVersion(vers)
    } else {
      actions.setParallelVersion(vers, parallelVersionIndex)
    }
    bottomSheetRef.current?.close()
  }

  return (
    <Portal>
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
            {t('Version')}
          </Text>
        </HStack>
        <SectionList
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
              onChange={handleVersionSelect}
              version={item}
              isSelected={
                item.id ===
                (parallelVersionIndex === undefined
                  ? data?.selectedVersion
                  : data?.parallelVersions[parallelVersionIndex])
              }
            />
          )}
        />
      </BottomSheet>
    </Portal>
  )
}

export default VersionSelectorBottomSheet
