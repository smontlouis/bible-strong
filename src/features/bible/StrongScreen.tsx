import React from 'react'
import { atom } from 'jotai/vanilla'
import { useMemo } from 'react'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { StrongTab } from '../../state/tabs'
import StrongDetailScreen from '~features/lexique/StrongDetailScreen'

const StrongScreen = () => {
  const router = useRouter()
  const params = useLocalSearchParams<{
    book?: string
    reference?: string
    strongReference?: string
  }>()

  // Parse params from URL strings
  const book = params.book ? Number(params.book) : undefined
  const reference = params.reference || undefined
  const strongReference = params.strongReference ? JSON.parse(params.strongReference) : undefined

  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongTab>({
        id: `strong-${Date.now()}`,
        title: 'Lexique',
        isRemovable: true,
        hasBackButton: true,
        type: 'strong',
        data: {
          book,
          reference,
          strongReference,
        },
      } as StrongTab),
    [book, reference, strongReference]
  )

  return <StrongDetailScreen navigation={router} strongAtom={onTheFlyAtom} />
}

export default StrongScreen
