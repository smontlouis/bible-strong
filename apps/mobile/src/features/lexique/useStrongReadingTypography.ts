import { useSelector } from 'react-redux'

import type { RootState } from '~redux/modules/reducer'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'

export const useStrongReadingTypography = (): StrongReadingTypography => {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const settings = useSelector((state: RootState) => state.user.bible.settings)

  return {
    fontFamily,
    fontSizeScale: settings.fontSizeScale,
    lineHeight: settings.lineHeight,
  }
}
