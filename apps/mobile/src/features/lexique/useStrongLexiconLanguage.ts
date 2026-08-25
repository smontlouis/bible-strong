import { useTranslation } from 'react-i18next'

import { toast } from '~helpers/toast'
import { useResourceLanguage } from '~state/resourcesLanguage'

const getLanguageLabelKey = (language: 'fr' | 'en') =>
  language === 'fr' ? 'versionCatalog.language.fr' : 'versionCatalog.language.en'

export const useStrongLexiconLanguage = () => {
  const { t } = useTranslation()
  const [language, setLanguage] = useResourceLanguage('STRONG')
  const languageLabel = t(getLanguageLabelKey(language))

  const toggleLanguage = () => {
    const nextLanguage = language === 'fr' ? 'en' : 'fr'
    const nextLanguageLabel = t(getLanguageLabelKey(nextLanguage))
    setLanguage(nextLanguage)
    toast(t('menu.languageChanged', { language: nextLanguageLabel }))
  }

  return {
    language,
    languageLabel,
    menuTitle: `${t('menu.language')}: ${languageLabel}`,
    toggleLanguage,
  }
}
