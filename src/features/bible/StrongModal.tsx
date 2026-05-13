import React, { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { useTheme } from '@emotion/react'
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import waitForStrongModal from '~common/waitForStrongModal'
import StrongCard from '~features/bible/StrongCard'
import { isStrongVersion } from '~helpers/bibleVersions'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import loadStrongReference from '~helpers/loadStrongReference'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import type { SelectedCode, StrongReference } from '~common/types'

interface StrongCardWrapperProps {
  selectedCode: SelectedCode | null
  onClosed: () => void
}

const StrongCardWrapper = waitForStrongModal(
  ({ selectedCode, onClosed }: StrongCardWrapperProps) => {
    const theme = useTheme()
    const [isLoading, setIsLoading] = useState(true)
    const [strongReference, setStrongReference] = useState<StrongReference | null>(null)
    const [error, setError] = useState(false)

    useEffect(() => {
      const loadStrong = async () => {
        if (selectedCode?.reference) {
          setError(false)
          setIsLoading(true)
          const strongReference = await loadStrongReference(
            selectedCode.reference,
            selectedCode.book
          )
          if (!strongReference || 'error' in strongReference) {
            setError(true)
            setIsLoading(false)
            return
          }

          setStrongReference(strongReference)
          setIsLoading(false)
        }
        if (!selectedCode?.reference) {
          setError(true)
        }
      }

      loadStrong()
    }, [selectedCode])

    if (error) {
      return (
        <Empty source={require('~assets/images/empty.json')} message="Une erreur est survenue..." />
      )
    }

    if (isLoading) {
      return (
        <Box flex center height={200}>
          <ActivityIndicator color={theme.colors.grey} />
        </Box>
      )
    }
    return (
      <StrongCard
        theme={theme}
        book={String(selectedCode?.book)}
        strongReference={strongReference!}
        isModal
        onClosed={onClosed}
      />
    )
  }
)

interface StrongModalProps {
  ref?: React.RefObject<BottomSheet | null>
  onClosed: () => void
  selectedCode: {
    reference: string
    book: number
  } | null
  version: string
}

const StrongModal = ({ ref, onClosed, selectedCode, version }: StrongModalProps) => {
  const theme = useTheme()
  const insets = useSafeAreaInsets()

  useEffect(() => {
    if (isStrongVersion(version)) {
      onClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  return (
    <BottomSheet
      index={-1}
      ref={ref}
      onAnimate={onAnimateModalClose(onClosed)}
      snapPoints={[300, '75%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      key={key}
      style={bottomSheetStyles.style}
      backgroundStyle={{
        backgroundColor: theme.colors.lightGrey,
      }}
      containerStyle={{
        paddingBottom: insets.bottom,
      }}
    >
      <BottomSheetScrollView>
        <StrongCardWrapper selectedCode={selectedCode} onClosed={onClosed} />
      </BottomSheetScrollView>
    </BottomSheet>
  )
}

export default StrongModal
