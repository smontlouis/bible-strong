import type { Note } from '~redux/modules/user'

type NoteTitleSource = Pick<Note, 'title' | 'description'> | null | undefined

export const getNoteTitle = (note: NoteTitleSource, fallback: string): string => {
  const title = note?.title?.trim()
  if (title) return title

  const description = note?.description?.trim()
  if (description) return description

  return fallback
}
