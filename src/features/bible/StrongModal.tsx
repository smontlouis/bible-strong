import React, { useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'

import { useTheme } from '@emotion/react'
import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet'
import { useNavigation } from '@react-navigation/native'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import waitForStrongModal from '~common/waitForStrongModal'
import StrongCard from '~features/bible/StrongCard'
import { isStrongVersion } from '~helpers/bibleVersions'
import { onAnimateModalClose, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import loadStrongReference from '~helpers/loadStrongReference'
import { usePrevious } from '~helpers/usePrevious'

const StrongCardWrapper = waitForStrongModal(({ navigation, selectedCode, onClosed }: any) => {
  const theme = useTheme()
  const [isLoading, setIsLoading] = useState(true)
  const [strongReference, setStrongReference] = useState<any>(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    const loadStrong = async () => {
      if (selectedCode?.reference) {
        setError(false)
        setIsLoading(true)
        const strongReference = await loadStrongReference(selectedCode.reference, selectedCode.book)
        setStrongReference(strongReference)

        if (strongReference?.error || !strongReference) {
          setError(true)
          setIsLoading(false)
          return
        }

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
      navigation={navigation}
      book={selectedCode?.book}
      strongReference={strongReference}
      isModal
      onClosed={onClosed}
    />
  )
})

interface StrongModalProps {
  onClosed: () => void
  selectedCode: {
    reference: string
    book: number
  } | null
  version: string
}

const StrongModal = ({ onClosed, selectedCode, version }: StrongModalProps) => {
  const modalRef = React.useRef<BottomSheetModal>(null)
  const navigation = useNavigation()
  const theme = useTheme()
  const hasSelectedCode = !!selectedCode
  const hasPrevSelectedCode = usePrevious(hasSelectedCode)

  useEffect(() => {
    if (hasSelectedCode && !hasPrevSelectedCode) {
      modalRef.current?.present()
    }

    if (!hasSelectedCode && hasPrevSelectedCode) {
      modalRef.current?.dismiss()
    }
  }, [hasSelectedCode, hasPrevSelectedCode])

  useEffect(() => {
    if (isStrongVersion(version)) {
      onClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  const { key, ...bottomSheetStyles } = useBottomSheetStyles()

  return (
    <BottomSheetModal
      ref={modalRef}
      onAnimate={onAnimateModalClose(onClosed)}
      snapPoints={[200, '75%']}
      enableDynamicSizing={false}
      enablePanDownToClose
      key={key}
      style={bottomSheetStyles.style}
      backgroundStyle={{
        backgroundColor: theme.colors.lightGrey,
      }}
    >
      <BottomSheetScrollView>
        <StrongCardWrapper {...{ navigation, selectedCode, onClosed }} />
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

export default StrongModal
