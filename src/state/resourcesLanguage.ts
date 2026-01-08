import { getDefaultStore, useAtom, useAtomValue, useSetAtom } from 'jotai'

import type { ResourceLanguage } from '~helpers/databaseTypes'
import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'
import { getLanguage } from '~i18n'

// Resources language state - each resource can have its own language
export type ResourcesLanguageState = {
  STRONG: ResourceLanguage
  DICTIONNAIRE: ResourceLanguage
  NAVE: ResourceLanguage
  MHY: ResourceLanguage
  INTERLINEAIRE: ResourceLanguage
  TIMELINE: ResourceLanguage
  SEARCH: ResourceLanguage
  COMMENTARIES: ResourceLanguage
}

// Helper to get default resources language based on current UI language
const getDefaultResourcesLanguage = (): ResourcesLanguageState => {
  const defaultLang: ResourceLanguage = getLanguage()
  return {
    STRONG: defaultLang,
    DICTIONNAIRE: defaultLang,
    NAVE: defaultLang,
    MHY: defaultLang,
    INTERLINEAIRE: defaultLang,
    TIMELINE: defaultLang,
    SEARCH: defaultLang,
    COMMENTARIES: defaultLang,
  }
}

// Jotai atom with MMKV persistence
export const resourcesLanguageAtom = atomWithAsyncStorage<ResourcesLanguageState>(
  'resourcesLanguage',
  getDefaultResourcesLanguage()
)

// React hooks
export const useResourceLanguage = (dbId: keyof ResourcesLanguageState) => {
  const [state, setState] = useAtom(resourcesLanguageAtom)
  const lang = state[dbId]
  const setLang = (newLang: ResourceLanguage) => {
    setState(prev => ({ ...prev, [dbId]: newLang }))
  }
  return [lang, setLang] as const
}

export const useResourcesLanguageValue = () => useAtomValue(resourcesLanguageAtom)
export const useSetResourcesLanguage = () => useSetAtom(resourcesLanguageAtom)

// For non-React contexts (memoize.ts, getSQLTransaction.ts)
// Synchronous access to the current value
export const getResourceLanguage = (dbId: keyof ResourcesLanguageState): ResourceLanguage => {
  const store = getDefaultStore()
  const state = store.get(resourcesLanguageAtom)
  return state[dbId]
}

// Reset all resources to a specific language
export const resetAllResourcesLanguage = (lang: ResourceLanguage) => {
  const store = getDefaultStore()
  store.set(resourcesLanguageAtom, {
    STRONG: lang,
    DICTIONNAIRE: lang,
    NAVE: lang,
    MHY: lang,
    INTERLINEAIRE: lang,
    TIMELINE: lang,
    SEARCH: lang,
    COMMENTARIES: lang,
  })
}
