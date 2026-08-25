export const getTimelineImageUri = (uri?: string, size: 'thumbnail' | 'original' = 'thumbnail') => {
  if (!uri) return undefined
  if (/^https?:\/\//.test(uri)) return uri

  const folder = size === 'original' ? 'original' : 't'
  return `http://timeline.biblehistory.com/media/images/${folder}/${uri}`
}
