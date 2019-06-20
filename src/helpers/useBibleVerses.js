import React from 'react'
import loadBible from '~helpers/loadBible'

const useBibleVerses = (verseIds) => {
  const [verses, setVerses] = React.useState([])

  React.useEffect(() => {
    const loadVerses = async () => {
      const { Livre, Chapitre } = verseIds[0]
      const response = await loadBible('LSG')
      const versesByChapter = response[Livre][Chapitre]
      const versesWithText = Object.keys(versesByChapter)
        .map((v: string) => ({ Verset: Number(v), Texte: versesByChapter[v], Livre: Number(Livre), Chapitre: Number(Chapitre) }))
        .filter(v => verseIds.find(vI => vI.Verset === v.Verset))
      setVerses(versesWithText)
    }
    loadVerses()
  }, [])

  return verses
}

export default useBibleVerses
