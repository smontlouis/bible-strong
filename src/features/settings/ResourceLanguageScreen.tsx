import React from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch } from 'react-redux'
import { useAtom } from 'jotai'
import Header from '~common/Header'
import Container from '~common/ui/Container'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import ScrollView from '~common/ui/ScrollView'
import Border from '~common/ui/Border'
import { resetCompareVersion, setDefaultBibleVersion } from '~redux/modules/user'
import {
  resourcesLanguageAtom,
  resetAllResourcesLanguage,
  type ResourcesLanguageState,
} from 'src/state/resourcesLanguage'
import type { ResourceLanguage } from '~helpers/databaseTypes'
import { TouchableOpacity, StyleSheet } from 'react-native'
import { useTheme } from '@emotion/react'
import { StackScreenProps } from '@react-navigation/stack'
import { MainStackProps } from '~navigation/type'

// Resource configuration for display
// Note: MHY is excluded because it only exists in French
const RESOURCES_CONFIG: {
  id: keyof ResourcesLanguageState
  labelKey: string
  descriptionKey: string
}[] = [
  {
    id: 'STRONG',
    labelKey: 'Lexique Strong',
    descriptionKey: 'resourceLanguage.strongDesc',
  },
  {
    id: 'DICTIONNAIRE',
    labelKey: 'Dictionnaire',
    descriptionKey: 'resourceLanguage.dictDesc',
  },
  {
    id: 'NAVE',
    labelKey: 'Bible Thématique Nave',
    descriptionKey: 'resourceLanguage.naveDesc',
  },
  {
    id: 'INTERLINEAIRE',
    labelKey: 'Interlinéaire',
    descriptionKey: 'resourceLanguage.interlineaireDesc',
  },
  {
    id: 'TIMELINE',
    labelKey: 'Chronologie',
    descriptionKey: 'resourceLanguage.timelineDesc',
  },
  {
    id: 'SEARCH',
    labelKey: 'Index de recherche',
    descriptionKey: 'resourceLanguage.searchDesc',
  },
  {
    id: 'COMMENTARIES',
    labelKey: 'Commentaires',
    descriptionKey: 'resourceLanguage.commentariesDesc',
  },
]

interface LanguageButtonProps {
  lang: ResourceLanguage
  isSelected: boolean
  onPress: () => void
}

const LanguageButton = ({ lang, isSelected, onPress }: LanguageButtonProps) => {
  const theme = useTheme()

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Box
        width={50}
        height={32}
        borderRadius={16}
        center
        style={{
          backgroundColor: isSelected ? theme.colors.primary : theme.colors.lightGrey,
          borderWidth: 1,
          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
        }}
      >
        <Text
          bold
          fontSize={13}
          color={isSelected ? 'reverse' : 'grey'}
          style={{ textTransform: 'uppercase' }}
        >
          {lang}
        </Text>
      </Box>
    </TouchableOpacity>
  )
}

interface ResourceRowProps {
  label: string
  description: string
  currentLang: ResourceLanguage
  onLanguageChange: (lang: ResourceLanguage) => void
}

const ResourceRow = ({ label, description, currentLang, onLanguageChange }: ResourceRowProps) => {
  const { t } = useTranslation()

  return (
    <Box paddingHorizontal={20} paddingVertical={15}>
      <Box row justifyContent="space-between" alignItems="center">
        <Box flex={1} marginRight={10}>
          <Text bold fontSize={15}>
            {t(label)}
          </Text>
          <Text fontSize={12} color="grey" marginTop={4}>
            {t(description)}
          </Text>
        </Box>
        <Box row>
          <LanguageButton
            lang="fr"
            isSelected={currentLang === 'fr'}
            onPress={() => onLanguageChange('fr')}
          />
          <Box width={8} />
          <LanguageButton
            lang="en"
            isSelected={currentLang === 'en'}
            onPress={() => onLanguageChange('en')}
          />
        </Box>
      </Box>
    </Box>
  )
}

const ResourceLanguageScreen = ({}: StackScreenProps<MainStackProps, 'ResourceLanguage'>) => {
  const { t, i18n } = useTranslation()
  const dispatch = useDispatch()
  const theme = useTheme()

  const [resourcesLanguages, setResourcesLanguages] = useAtom(resourcesLanguageAtom)
  const currentAppLang = i18n.language as ResourceLanguage

  const handleLanguageChange = (
    resourceId: keyof ResourcesLanguageState,
    lang: ResourceLanguage
  ) => {
    setResourcesLanguages(prev => ({ ...prev, [resourceId]: lang }))
  }

  // Change app language + all resources
  const handleAppLanguageChange = (lang: ResourceLanguage) => {
    if (lang === currentAppLang) return

    // Change i18n language
    i18n.changeLanguage(lang)

    // Reset all resources to new language
    resetAllResourcesLanguage(lang)

    // Change default Bible version
    const defaultVersion = lang === 'fr' ? 'LSG' : 'KJV'
    dispatch(setDefaultBibleVersion(defaultVersion))
    dispatch(resetCompareVersion(defaultVersion))
  }

  return (
    <Container>
      <Header hasBackButton title={t('Changer la langue')} />
      <ScrollView style={{ flex: 1 }}>
        {/* Section 1: App Language */}
        <Box paddingHorizontal={20} paddingVertical={15}>
          <Text bold fontSize={16} marginBottom={5}>
            {t('language.appLanguage')}
          </Text>
          <Text fontSize={14} color="grey">
            {t('language.appLanguageDesc')}
          </Text>
        </Box>

        <Box paddingHorizontal={20} paddingBottom={15}>
          <Box row>
            <TouchableOpacity
              onPress={() => handleAppLanguageChange('fr')}
              activeOpacity={0.7}
              style={styles.resetButton}
            >
              <Box
                paddingHorizontal={20}
                paddingVertical={12}
                borderRadius={50}
                center
                style={{
                  backgroundColor:
                    currentAppLang === 'fr' ? theme.colors.primary : theme.colors.lightGrey,
                  borderWidth: 2,
                  borderColor: currentAppLang === 'fr' ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text bold fontSize={16} color={currentAppLang === 'fr' ? 'reverse' : 'default'}>
                  Français
                </Text>
              </Box>
            </TouchableOpacity>
            <Box width={10} />
            <TouchableOpacity
              onPress={() => handleAppLanguageChange('en')}
              activeOpacity={0.7}
              style={styles.resetButton}
            >
              <Box
                paddingHorizontal={20}
                paddingVertical={12}
                borderRadius={50}
                center
                style={{
                  backgroundColor:
                    currentAppLang === 'en' ? theme.colors.primary : theme.colors.lightGrey,
                  borderWidth: 2,
                  borderColor: currentAppLang === 'en' ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text bold fontSize={16} color={currentAppLang === 'en' ? 'reverse' : 'default'}>
                  English
                </Text>
              </Box>
            </TouchableOpacity>
          </Box>
        </Box>

        <Border marginHorizontal={20} />

        {/* Section 2: Per-resource language */}
        <Box paddingVertical={10}>
          <Box paddingHorizontal={20} paddingVertical={10}>
            <Text bold fontSize={16}>
              {t('resourceLanguage.perResource')}
            </Text>
            <Text fontSize={12} color="grey" marginTop={4}>
              {t('resourceLanguage.description')}
            </Text>
          </Box>

          {RESOURCES_CONFIG.map(resource => (
            <React.Fragment key={resource.id}>
              <ResourceRow
                label={resource.labelKey}
                description={resource.descriptionKey}
                currentLang={resourcesLanguages[resource.id]}
                onLanguageChange={lang => handleLanguageChange(resource.id, lang)}
              />
              <Border marginHorizontal={20} />
            </React.Fragment>
          ))}
        </Box>

        <Box paddingHorizontal={20} paddingVertical={15}>
          <Text fontSize={12} color="grey">
            {t('resourceLanguage.note')}
          </Text>
        </Box>
      </ScrollView>
    </Container>
  )
}

const styles = StyleSheet.create({
  resetButton: {
    flex: 1,
  },
})

export default ResourceLanguageScreen
