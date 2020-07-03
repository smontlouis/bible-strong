import loadBible from '~helpers/loadBible'
import loadInterlineaireChapter from '~helpers/loadInterlineaireChapter'
import loadStrongChapter from '~helpers/loadStrongChapter'

const loadBibleChapter = async (bookNb, chapterNb, version = 'LSG') => {
  if (version === 'INT') {
    const res = await loadInterlineaireChapter(bookNb, chapterNb)
    return res
  }

  if (version === 'LSGS' || version === 'KJVS') {
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
