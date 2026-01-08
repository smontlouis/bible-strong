import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { getLanguage } from '~i18n'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
import { VersionCode } from './tabs'

export const useDefaultBibleVersion = (): VersionCode => {
  return useSelector(
    (state: RootState) =>
      (state.user.bible.settings.defaultBibleVersion as VersionCode) ||
      getDefaultBibleVersion(getLanguage())
  )
}

export const getDefaultBibleVersionFromState = (state: RootState): VersionCode => {
  return (
    (state.user.bible.settings.defaultBibleVersion as VersionCode) ||
    getDefaultBibleVersion(getLanguage())
  )
}
