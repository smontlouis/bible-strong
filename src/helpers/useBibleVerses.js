import React from 'react'
import loadBible from '~helpers/loadBible'
import { useSelector } from 'react-redux'

export const verseStringToObject = arrayString => {
  return arrayString.map(string => {
    const [Livre, Chapitre, Verset] = string.split('-')
    return { Livre, Chapitre, Verset }
  })
}

const useBibleVerses = verseIds => {
  const [verses, setVerses] = React.useState([])
  const version = useSelector((state: RootState) => state.bible.selectedVersion)

  React.useEffect(() => {
    const loadVerses = async () => {
      const { Livre, Chapitre } = verseIds[0]
      const response = await loadBible(version)
      const versesByChapter = response[Livre][Chapitre]
      const versesWithText = Object.keys(versesByChapter)
        .map((v: string) => ({
          Verset: Number(v),
          Texte: versesByChapter[v],
          Livre: Number(Livre),
          Chapitre: Number(Chapitre),
        }))
        .filter(v =>
          verseIds.find(vI => Number(vI.Verset) === Number(v.Verset))
        )
      setVerses(versesWithText)
    }
    loadVerses()
  }, [verseIds, version])

  return verses
}

export default useBibleVerses
