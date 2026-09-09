import { useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { getReadingTypography } from './readingHtml'

export function useReadingTypography() {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const fontSizeScale = useSelector((state: RootState) => state.user.bible.settings.fontSizeScale)
  const lineHeight = useSelector((state: RootState) => state.user.bible.settings.lineHeight)
  return getReadingTypography(fontFamily, fontSizeScale, lineHeight)
}
