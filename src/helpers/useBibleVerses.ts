import React from 'react'
import { Verse } from '~common/types'
import { getMultipleVerses } from '~helpers/biblesDb'
import { useDefaultBibleVersion } from '../state/useDefaultBibleVersion'

export const verseStringToObject = (arrayString: string[]): Omit<Verse, 'Texte'>[] => {
  return arrayString.map(string => {
    const [Livre, Chapitre, Verset] = string.split('-')
    return { Livre, Chapitre, Verset }
  })
}

const useBibleVerses = (verseIds: Omit<Verse, 'Texte'>[]) => {
  const [verses, setVerses] = React.useState<Verse[]>([])

  const version = useDefaultBibleVersion()

  React.useEffect(() => {
    const loadVerses = async () => {
      if (!verseIds.length) {
        setVerses([])
        return
      }

      const verseKeys = verseIds.map(
        ({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`
      )
      const versesMap = await getMultipleVerses(version, verseKeys)

      const versesWithText = verseIds
        .map(verse => {
          const key = `${verse.Livre}-${verse.Chapitre}-${verse.Verset}`
          const text = versesMap[key]
          if (!text) return undefined
          return { ...verse, Texte: text } as Verse
        })
        .filter((verse): verse is Verse => Boolean(verse))

      setVerses(versesWithText)
    }
    loadVerses()
  }, [verseIds, version])

  return verses
}

export default useBibleVerses
