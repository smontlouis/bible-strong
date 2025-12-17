import { ChapterSlice, VerseSlice, VideoSlice } from '~common/types'
import { getChaptersForPlan, getVersesForPlan } from '../plan.hooks'
import to from 'await-to-js'
import i18n from '~i18n'
export const chapterSliceToText = async (slice: ChapterSlice, version: string) => {
  const [err, result] = await to(getChaptersForPlan(slice.chapters, version))

  if (err) {
    return i18n.t("Il semblerait que ce chapitre n'existe pas dans cette version.")
  }
  if (!result) return ''

  return `${result.bookName}\n${result.chapters.map(chapter =>
    chapter.verses.map(c => {
      const { h1, h2, h3, h4 } = c.Pericope
      return `${h1 ? `${h1}\n\n` : ''}${h2 ? `${h2}\n\n` : ''}${
        h3 ? `${h3}\n\n` : ''
      }${h4 ? `${h4}\n\n` : ''}${c.Texte}`
    })
  )}`
}

export const verseSliceToText = async (slice: VerseSlice, version: string) => {
  const [err, result] = await to(getVersesForPlan(slice.verses, version))

  if (err) {
    return i18n.t("Il semblerait que ce chapitre n'existe pas dans cette version.")
  }
  if (!result) return ''

  return `${result.bookName}\n${result.verses.map(c => {
    const { h1, h2, h3, h4 } = c.Pericope
    return `${h1 ? `${h1}\n\n` : ''}${h2 ? `${h2}\n\n` : ''}${
      h3 ? `${h3}\n\n` : ''
    }${h4 ? `${h4}\n\n` : ''}${c.Texte}`
  })}`
}

export const videoSliceToText = (slice: VideoSlice) => {
  return `${slice.description}\n${slice.url}`
}
