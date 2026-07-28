import React from 'react'
import { atom } from 'jotai/vanilla'
import { useLocalSearchParams } from 'expo-router'
import generateUUID from '~helpers/generateUUID'
import { StrongTab } from '../../state/tabs'
import StrongDetailScreen from '~features/lexique/StrongDetailScreen'
import { IS_FORM_SHEET } from '~helpers/constants'
import type { StrongBibleVersionId } from '~helpers/strongBiblePublications'
import type { StrongIdentityKind } from '~helpers/strongIdentities'

const StrongScreen = () => {
  const params = useLocalSearchParams<{
    book?: string
    reference?: string
    strongReference?: string
    strongBibleVersionId?: string
    identityKind?: string
    identityCode?: string
    bibleVersion?: string
    clickedWord?: string
    bibleChapter?: string
    bibleVerse?: string
  }>()

  // Parse params from URL strings
  const book = params.book ? Number(params.book) : undefined
  const reference = params.reference || undefined
  const strongReference = params.strongReference ? JSON.parse(params.strongReference) : undefined
  const strongBibleVersionId = params.strongBibleVersionId as StrongBibleVersionId | undefined
  const identityKind = params.identityKind as StrongIdentityKind | undefined
  const identityCode = params.identityCode || undefined
  const bibleVersion = params.bibleVersion || undefined
  const clickedWord = params.clickedWord || undefined
  const bibleChapter = params.bibleChapter ? Number(params.bibleChapter) : undefined
  const bibleVerse = params.bibleVerse ? Number(params.bibleVerse) : undefined

  const [onTheFlyAtom] = React.useState(() =>
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
        identityKind,
        identityCode,
        bibleVersion,
        clickedWord,
        bibleChapter,
        bibleVerse,
      },
    } as StrongTab)
  )

  return <StrongDetailScreen strongAtom={onTheFlyAtom} isFormSheet={IS_FORM_SHEET} />
}

export default StrongScreen
