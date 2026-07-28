import { Alert, TouchableOpacity } from 'react-native'
import { useTranslation } from 'react-i18next'

import Box, { HStack, VStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { createStrongLexiconModuleDownloadPlan } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import type { StrongLexiconModuleAvailability } from '~helpers/strongLexiconModules'
import type { StrongLexiconModuleId } from '~helpers/strongLexiconPublications'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { createOfflineCopyId } from '~helpers/offlineCopyId'

type Props = {
  moduleId: Exclude<StrongLexiconModuleId, 'core'>
  availability: StrongLexiconModuleAvailability
  title: string
  description: string
}

const StrongLexiconModuleCard = ({ moduleId, availability, title, description }: Props) => {
  const { t } = useTranslation()
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
    Alert.alert(t('Télécharger {{name}} ?', { name: title }), description, [
      { text: t('Annuler'), style: 'cancel' },
      {
        text: t('Télécharger'),
        onPress: () =>
          downloadManager.enqueue(
            createStrongLexiconModuleDownloadPlan(moduleId, availability.status !== 'core-missing')
          ),
      },
    ])
  }

  if (availability.status === 'available') return null

  return (
    <TouchableOpacity onPress={downloading ? undefined : requestDownload} activeOpacity={0.7}>
      <VStack bg="lightGrey" borderRadius={14} px={14} py={14} gap={10} opacity={0.75}>
        <HStack gap={12} alignItems="center">
          <FeatherIcon name={downloading ? 'loader' : 'download-cloud'} size={19} color="default" />
          <VStack flex gap={2}>
            <Text bold>{title}</Text>
            <Text color="tertiary" fontSize={12}>
              {description}
            </Text>
          </VStack>
          {downloading && (
            <Text color="tertiary" fontSize={12}>
              {Math.round(progress * 100)}%
            </Text>
          )}
        </HStack>
        {downloading && (
          <Box height={4} borderRadius={2} bg="border" overflow="hidden">
            <Box height={4} borderRadius={2} bg="primary" width={`${progress * 100}%`} />
          </Box>
        )}
      </VStack>
    </TouchableOpacity>
  )
}

export default StrongLexiconModuleCard
