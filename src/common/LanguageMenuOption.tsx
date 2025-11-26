import { useTranslation } from 'react-i18next'
import {
  ResourcesLanguageState,
  useResourceLanguage,
} from 'src/state/resourcesLanguage'

import Snackbar from '~common/SnackBar'
import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import MenuOption from '~common/ui/MenuOption'
import Text from '~common/ui/Text'
import type { ResourceLanguage } from '~helpers/databaseTypes'

interface LanguageMenuOptionProps {
  resourceId: keyof ResourcesLanguageState
}

/**
 * A menu option component for changing resource language
 * Displays current language and toggles between FR/EN on press
 */
const LanguageMenuOption = ({ resourceId }: LanguageMenuOptionProps) => {
  const { t } = useTranslation()
  const [currentLang, setLang] = useResourceLanguage(resourceId)

  const handleToggle = () => {
    const newLang: ResourceLanguage = currentLang === 'fr' ? 'en' : 'fr'
    setLang(newLang)
    const newLangLabel = newLang === 'fr' ? 'Français' : 'English'
    Snackbar.show(t('menu.languageChanged', { language: newLangLabel }))
  }

  const languageLabel = currentLang === 'fr' ? 'Français' : 'English'

  return (
    <MenuOption onSelect={handleToggle}>
      <Box row alignItems="center">
        <FeatherIcon name="globe" size={15} />
        <Text marginLeft={10}>
          {t('menu.language')}: {languageLabel}
        </Text>
      </Box>
    </MenuOption>
  )
}

export default LanguageMenuOption
