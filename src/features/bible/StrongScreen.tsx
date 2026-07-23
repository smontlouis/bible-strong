import React, { useMemo } from 'react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { StrongTab } from '../../state/tabs'
import StrongDetailScreen from '~features/lexique/StrongDetailScreen'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'

const StrongScreen = () => {
  const params = useLocalSearchParams<{
    book?: string
    reference?: string
    strongReference?: string
    strongBibleVersionId?: string
  }>()

  // Parse params from URL strings
  const book = params.book ? Number(params.book) : undefined
  const reference = params.reference || undefined
  const strongReference = params.strongReference ? JSON.parse(params.strongReference) : undefined
  const strongBibleVersionId = params.strongBibleVersionId as StrongBibleVersionId | undefined

  const onTheFlyAtom = useMemo(
    () =>
      atom<StrongTab>({
        id: `strong-${generateUUID()}`,
        title: 'Lexique',
        isRemovable: true,
        hasBackButton: true,
        type: 'strong',
        data: {
          book,
          reference,
          strongReference,
          strongBibleVersionId,
        },
      } as StrongTab),
    [book, reference, strongReference, strongBibleVersionId]
  )

  return <StrongDetailScreen strongAtom={onTheFlyAtom} isFormSheet={IS_FORM_SHEET} />
}

export default StrongScreen
