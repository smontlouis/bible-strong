import React from 'react'
import { Verse } from '~common/types'
import { getChapterVerses } from '~helpers/biblesDb'
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
      const { Livre, Chapitre } = verseIds[0]
      const bookNum = Number(Livre)
      const chapterNum = Number(Chapitre)

      const allVerses = await getChapterVerses(version, bookNum, chapterNum)
      const versesWithText = allVerses.filter(v =>
        verseIds.find(vI => Number(vI.Verset) === Number(v.Verset))
      )

      setVerses(versesWithText)
    }
    loadVerses()
  }, [verseIds, version])

  return verses
}

export default useBibleVerses
