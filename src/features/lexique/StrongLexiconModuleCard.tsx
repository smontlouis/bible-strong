import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useAtom } from 'jotai'

import Box, { HStack, TouchableBox, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { createStrongLexiconModuleDownloadPlan } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import {
  dismissStrongLexiconModulePrompt,
  strongLexiconModulePromptPreferencesAtom,
} from '~state/strongLexiconModulePrompts'
import { StrongEditorialSection } from './StrongDetailUI'

type Props = {
  moduleId: Exclude<StrongLexiconModuleId, 'core'>
  availability: StrongLexiconModuleAvailability
  sectionTitle?: string
  title: string
  description: string
  dismissible?: boolean
  separated?: boolean
}

const StrongLexiconModuleCard = ({
  moduleId,
  availability,
  sectionTitle,
  title,
  description,
  dismissible = false,
  separated = false,
}: Props) => {
  const { t } = useTranslation()
  const [promptPreferences, setPromptPreferences] = useAtom(
    strongLexiconModulePromptPreferencesAtom
  )
  const itemId = createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId })
  const download = useDownloadItemStatus(itemId)
  const downloading =
    download?.status === 'queued' ||
    download?.status === 'downloading' ||
    download?.status === 'inserting'
  const progress = download
    ? download.status === 'inserting'
      ? 0.8 + download.insertProgress * 0.2
      : download.downloadProgress * 0.8
    : 0

  const requestDownload = () => {
    downloadManager.enqueue(
      createStrongLexiconModuleDownloadPlan(moduleId, availability.status !== 'core-missing')
    )
  }

  const requestDismiss = () => {
    Alert.alert(
      t('strongLexicon.dismissDownloadPromptTitle', { name: title }),
      t('strongLexicon.dismissDownloadPromptMessage'),
      [
        { text: t('Annuler'), style: 'cancel' },
        {
          text: t('strongLexicon.dismissDownloadPromptConfirm'),
          onPress: () =>
            setPromptPreferences(current => dismissStrongLexiconModulePrompt(current, moduleId)),
        },
      ]
    )
  }

  if (availability.status === 'available' || (dismissible && promptPreferences[moduleId]))
    return null

  const content = (
    <VStack
      bg="reverse"
      borderRadius={14}
      px={14}
      py={14}
      gap={10}
      opacity={0.5}
      borderWidth={1}
      borderColor="default"
      style={{ borderStyle: 'dashed' }}
    >
      <HStack gap={12} alignItems="center">
        <TouchableBox
          flex
          onPress={downloading ? undefined : requestDownload}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={title}
        >
          <HStack gap={12} alignItems="center">
            <FeatherIcon
              name={downloading ? 'loader' : 'download-cloud'}
              size={19}
              color="default"
            />
            <VStack flex gap={2}>
              <Text bold fontSize={14}>
                {title}
              </Text>
              <Text color="default" fontSize={12}>
                {description}
              </Text>
            </VStack>
          </HStack>
        </TouchableBox>
        {downloading && (
          <Text color="default" fontSize={12}>
            {Math.round(progress * 100)}%
          </Text>
        )}
        {dismissible && !downloading && (
          <TouchableBox
            onPress={requestDismiss}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={t('strongLexicon.dismissDownloadPromptAccessibility', {
              name: title,
            })}
            hitSlop={12}
          >
            <FeatherIcon name="x" size={18} color="default" />
          </TouchableBox>
        )}
      </HStack>
      {downloading && (
        <Box height={4} borderRadius={2} bg="border" overflow="hidden">
          <Box height={4} borderRadius={2} bg="primary" width={`${progress * 100}%`} />
        </Box>
      )}
    </VStack>
  )

  if (!sectionTitle) return content

  return (
    <StrongEditorialSection title={sectionTitle} separated={separated}>
      {content}
    </StrongEditorialSection>
  )
}

export default StrongLexiconModuleCard
