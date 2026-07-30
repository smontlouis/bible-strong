import type { ReactNode } from 'react'
import { Alert } from 'react-native'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Header from '~common/Header'
import Loading from '~common/Loading'
import { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import StrongEntryMenu from './StrongEntryMenu'
import type { StrongDetailRouteContext } from './strongDetailRoutes'
import { useStrongEntryRoute } from './useStrongEntryRoute'

type StrongEntryLoadState = Pick<
  ReturnType<typeof useStrongEntryRoute>,
  'identity' | 'coreAvailability' | 'entryQuery' | 'entry'
>

type Props = {
  children: ReactNode
  context: StrongDetailRouteContext
  entryState: StrongEntryLoadState
  fontSize?: number
  isFormSheet?: boolean
  onBack?: () => void
  showEntryMenu?: boolean
  subTitle?: string
  title: string
}

const StrongEntryRouteScaffold = ({
  children,
  context,
  entryState,
  fontSize,
  isFormSheet = false,
  onBack,
  showEntryMenu = false,
  subTitle,
  title,
}: Props) => {
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const coreDownload = useDownloadItemStatus(
    createOfflineCopyId({ kind: 'strong-lexicon-module', moduleId: 'core' })
  )
  const coreDownloading =
    coreDownload?.status === 'queued' ||
    coreDownload?.status === 'downloading' ||
    coreDownload?.status === 'inserting'
  const header = (
    <Header
      hasBackButton={onBack ? true : isFormSheet ? canGoBackInStack : true}
      onCustomBackPress={onBack}
      fontSize={fontSize}
      subTitle={subTitle}
      title={title}
      rightComponent={
        showEntryMenu && entryState.entry ? (
          <StrongEntryMenu context={context} entry={entryState.entry} />
        ) : undefined
      }
    />
  )

  if (
    entryState.coreAvailability.isPending ||
    (Boolean(entryState.identity) &&
      entryState.coreAvailability.data?.status === 'available' &&
      entryState.entryQuery.isPending)
  ) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        {entryState.entryQuery.isError ? (
          <Empty
            source={require('~assets/images/empty.json')}
            message={t("Cette entrée Strong n'a pas pu être chargée.")}
          />
        ) : (
          <Loading message={t('Chargement...')} />
        )}
      </FormSheetScreen>
    )
  }

  if (entryState.coreAvailability.data?.status !== 'available') {
    const requestCoreDownload = () => {
      Alert.alert(
        t('Télécharger le lexique Strong ?'),
        t(
          'Le lexique principal est nécessaire pour afficher les définitions, la morphologie et les mots liés.'
        ),
        [
          { text: t('Annuler'), style: 'cancel' },
          {
            text: t('Télécharger'),
            onPress: () => downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')]),
          },
        ]
      )
    }

    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <VStack flex px={20} center gap={16}>
          <FeatherIcon name="book-open" size={34} color="default" />
          <Text bold fontSize={20} textAlign="center">
            {t('Le nouveau lexique Strong est requis')}
          </Text>
          <Text color="tertiary" textAlign="center">
            {t(
              'Téléchargez le module principal pour accéder aux définitions, à la morphologie et aux relations lexicales.'
            )}
          </Text>
          <Button onPress={requestCoreDownload} disabled={coreDownloading}>
            {coreDownloading ? t('Téléchargement...') : t('Télécharger')}
          </Button>
        </VStack>
      </FormSheetScreen>
    )
  }

  if (!entryState.entry) {
    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucune entrée lexicale trouvée pour {{code}}.', {
            code: entryState.identity?.code ?? '',
          })}
        />
      </FormSheetScreen>
    )
  }

  return (
    <FormSheetScreen isFormSheet={isFormSheet}>
      {header}
      {children}
    </FormSheetScreen>
  )
}

export default StrongEntryRouteScaffold
