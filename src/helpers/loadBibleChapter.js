import loadBible from '~helpers/loadBible'
import loadInterlineaireChapter from '~helpers/loadInterlineaireChapter'
import loadStrongChapter from '~helpers/loadStrongChapter'
import { strongDB } from '~helpers/sqlite'

const loadBibleChapter = async (bookNb, chapterNb, version = 'LSG') => {
  if (version === 'INT') {
    const res = await loadInterlineaireChapter(bookNb, chapterNb, 'fr')
    return res
  }

  if (version === 'INT_EN') {
    const res = await loadInterlineaireChapter(bookNb, chapterNb, 'en')
    return res
  }

  if (version === 'LSGS' || version === 'KJVS') {
    if (!strongDB.get()) await strongDB.init()
    const res = await loadStrongChapter(bookNb, chapterNb)
    return res
  }

  const res = await loadBible(version)

  return Object.keys(res[bookNb][chapterNb]).map(v => ({
    Verset: v,
    Texte: res[bookNb][chapterNb][v],
    Livre: bookNb,
    Chapitre: chapterNb,
  }))
}

export default loadBibleChapter
