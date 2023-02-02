import React, { memo, useEffect, useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { withNavigation } from 'react-navigation'

import { useTheme } from '@emotion/react'
import { Modalize } from 'react-native-modalize'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import waitForStrongModal from '~common/waitForStrongModal'
import StrongCard from '~features/bible/StrongCard'
import { isStrongVersion } from '~helpers/bibleVersions'
import loadStrongReference from '~helpers/loadStrongReference'
import { usePrevious } from '~helpers/usePrevious'
import { hp } from '~helpers/utils'
import { useNavigation } from 'react-navigation-hooks'

const StrongCardWrapper = waitForStrongModal(
  ({ navigation, selectedCode, onClosed }) => {
    const theme = useTheme()
    const [isLoading, setIsLoading] = useState(true)
    const [strongReference, setStrongReference] = useState(null)
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
        <Empty
          source={require('~assets/images/empty.json')}
          message="Une erreur est survenue..."
        />
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
  }
)

interface StrongModalProps {
  onClosed: () => void
  selectedCode: {
    reference: string
    book: number
  } | null
  version: string
}

const StrongModal = ({ onClosed, selectedCode, version }: StrongModalProps) => {
  const modalRef = React.useRef<Modalize>(null)
  const navigation = useNavigation()
  const theme = useTheme()
  const hasSelectedCode = !!selectedCode
  const hasPrevSelectedCode = usePrevious(hasSelectedCode)

  useEffect(() => {
    if (hasSelectedCode && !hasPrevSelectedCode) {
      modalRef.current?.open()
    }

    if (!hasSelectedCode && hasPrevSelectedCode) {
      modalRef.current?.close()
    }
  }, [hasSelectedCode, hasPrevSelectedCode])

  useEffect(() => {
    if (isStrongVersion(version)) {
      onClosed()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [version])

  return (
    <Modalize
      ref={modalRef}
      onClosed={onClosed}
      modalHeight={hp(75)}
      handlePosition="inside"
      closeSnapPointStraightEnabled={false}
      modalStyle={{
        marginLeft: 'auto',
        marginRight: 'auto',
        maxWidth: 600,
        width: '100%',
        backgroundColor: theme.colors.lightGrey,
      }}
      snapPoint={200}
      withOverlay={false}
    >
      <StrongCardWrapper {...{ navigation, selectedCode, onClosed }} />
    </Modalize>
  )
}

export default memo(StrongModal)
