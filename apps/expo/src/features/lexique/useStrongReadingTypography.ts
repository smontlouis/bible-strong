import { Platform } from 'react-native'
import { webFontFamily } from '~helpers/webFontFamily'
import { useSelector } from 'react-redux'

import type { RootState } from '~redux/modules/reducer'
import type { StrongReadingTypography } from './strongEditorialHtmlStyles'

export const useStrongReadingTypography = (): StrongReadingTypography => {
  const fontFamily = useSelector((state: RootState) => state.user.fontFamily)
  const settings = useSelector((state: RootState) => state.user.bible.settings)

  return {
    fontFamily: Platform.OS === 'web' ? webFontFamily(fontFamily) : fontFamily,
    fontSizeScale: settings.fontSizeScale,
    lineHeight: settings.lineHeight,
  }
}
