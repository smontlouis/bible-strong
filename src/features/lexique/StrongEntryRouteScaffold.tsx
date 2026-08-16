import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'

import Empty from '~common/Empty'
import EntityChipList from '~common/EntityChipList'
import Header from '~common/Header'
import Loading from '~common/Loading'
import Box, { VStack } from '~common/ui/Box'
import Button from '~common/ui/Button'
import FormSheetScreen from '~common/ui/FormSheetScreen'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { createStrongEndpoint } from '~features/studyRelations/endpoints'
import { useOpenEntityRelations } from '~features/studyRelations/useOpenEntityRelations'
import { useRelationCount } from '~features/studyRelations/useRelationCount'
import { createStrongLexiconModuleDownloadItem } from '~helpers/downloadItemFactory'
import { downloadManager } from '~helpers/downloadManager'
import { createOfflineCopyId } from '~helpers/offlineCopyId'
import { useDownloadItemStatus } from '~helpers/useDownloadQueue'
import { useCanGoBackInStack } from '~navigation/useCanGoBackInStack'
import type { RootState } from '~redux/modules/reducer'
import { makeStrongTagsSelector } from '~redux/selectors/bible'
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
  requireEntry?: boolean
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
  requireEntry = true,
  showEntryMenu = false,
  subTitle,
  title,
}: Props) => {
  const { t } = useTranslation()
  const canGoBackInStack = useCanGoBackInStack()
  const selectStrongTags = makeStrongTagsSelector()
  const tags = useSelector((state: RootState) =>
    entryState.entry
      ? selectStrongTags(state, entryState.entry.stepCode, entryState.entry.language === 'greek')
      : undefined
  )
  const strongEndpoint = entryState.entry
    ? createStrongEndpoint({
        language: entryState.entry.language,
        code: entryState.entry.stepCode,
        labelFallback: entryState.entry.gloss,
        originalWord: entryState.entry.original,
      })
    : null
  const relationCount = useRelationCount(strongEndpoint)
  const openEntityRelations = useOpenEntityRelations()
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
    >
      {entryState.entry && (tags || relationCount > 0) && (
        <Box px={20} mt={-8} pb={10}>
          <EntityChipList
            tags={tags}
            relationCount={relationCount}
            onRelationPress={() => strongEndpoint && openEntityRelations(strongEndpoint)}
          />
        </Box>
      )}
    </Header>
  )

  if (
    requireEntry &&
    (entryState.coreAvailability.isPending ||
      (Boolean(entryState.identity) &&
        entryState.coreAvailability.data?.status === 'available' &&
        entryState.entryQuery.isPending))
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

  if (requireEntry && entryState.coreAvailability.data?.status !== 'available') {
    const requestCoreDownload = () => {
      downloadManager.enqueue([createStrongLexiconModuleDownloadItem('core')])
    }

    return (
      <FormSheetScreen isFormSheet={isFormSheet}>
        {header}
        <VStack flex px={20} center gap={16}>
          <FeatherIcon name="book-open" size={34} color="default" />
          <Text bold fontSize={20} textAlign="center">
            {t('resource.strong.coreUnavailable')}
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

  if (requireEntry && !entryState.entry) {
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
