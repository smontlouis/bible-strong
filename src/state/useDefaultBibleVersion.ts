import { useSelector } from 'react-redux'
import { RootState } from '~redux/modules/reducer'
import { getLangIsFr } from '~i18n'
import { VersionCode } from './tabs'

export const useDefaultBibleVersion = (): VersionCode => {
  return useSelector(
    (state: RootState) =>
      (state.user.bible.settings.defaultBibleVersion as VersionCode) ||
      (getLangIsFr() ? 'LSG' : 'KJV')
  )
}

export const getDefaultBibleVersionFromState = (state: RootState): VersionCode => {
  return (
    (state.user.bible.settings.defaultBibleVersion as VersionCode) ||
    (getLangIsFr() ? 'LSG' : 'KJV')
  )
}
