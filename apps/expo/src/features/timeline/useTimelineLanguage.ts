import { useTranslation } from 'react-i18next'
import { useResourcesLanguageValue } from '~state/resourcesLanguage'

/** Timeline metadata and articles share the resource language, not the app UI language. */
export default function useTimelineLanguage() {
  return useResourcesLanguageValue().TIMELINE
}

export function useTimelineTranslation() {
  const language = useTimelineLanguage()
  const { i18n } = useTranslation()
  return { language, t: i18n.getFixedT(language) }
}
