import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import type { Verse } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { SheetScrollView } from '~common/sheet'
import ResourceVerseContext, {
  useResourceVerseContext,
} from '~features/bible/resources/ResourceVerseContext'
import { useResourceAccess } from '~features/resources/resourceAccess'
import {
  getDefaultDictionaryWork,
  KNOWN_DICTIONARY_WORKS,
} from '~features/resources/dictionaryAccess'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { localQueryOptions } from '~helpers/queryOptions'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import { resourcesLanguageAtom } from '~state/resourcesLanguage'

import {
  groupDictionaryPassageEntries,
  pickPreferredDictionarySource,
} from './dictionaryExperience'

const DictionnaireVerseDetailScreen = ({
  verse,
  updateVerse,
  selectedVersion,
}: {
  verse: Verse
  updateVerse: (value: number) => void
  selectedVersion: string
}) => {
  const resources = useResourceAccess()
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const { Livre, Chapitre, Verset } = verse
  const verseKey = `${Livre}-${Chapitre}-${Verset}`
  const resourceLang = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE
  const defaultDictionary = KNOWN_DICTIONARY_WORKS.find(
    dictionary =>
      dictionary.resource.language === resourceLang &&
      dictionary.resource.work === getDefaultDictionaryWork(resourceLang)
  )
  const recoveryIdentity = defaultDictionary
    ? {
        kind: 'dictionary' as const,
        work: defaultDictionary.resource.work,
        resourceId: defaultDictionary.resourceId,
        language: resourceLang,
      }
    : ({ kind: 'dictionary-directory' as const } as const)
  const verseContext = useResourceVerseContext(verseKey, selectedVersion)
  const [navigationDirection, setNavigationDirection] = React.useState<-1 | 1>(1)
  const navigateVerse = (direction: -1 | 1) => {
    setNavigationDirection(direction)
    updateVerse(direction)
  }

  const anchorsQuery = useQuery({
    queryKey: ['dictionary-passage-entries', verseKey, resourceLang],
    queryFn: () => resources.dictionary.discoverPassageEntries(verseKey, resourceLang),
    ...localQueryOptions,
  })
  const entries = anchorsQuery.data ?? []
  const presentConcepts = groupDictionaryPassageEntries(
    entries.filter(
      entry => entry.evidenceKind === 'verse-name' || entry.evidenceKind === 'verse-phrase'
    ),
    resourceLang
  )
  const citationConcepts = groupDictionaryPassageEntries(
    entries.filter(entry => entry.evidenceKind === 'source-citation'),
    resourceLang
  )
  const articleCountLabel = (count: number) =>
    t(count === 1 ? '{{count}} article' : '{{count}} articles', { count })

  return (
    <Box flex={1} bg="lightGrey">
      <ResourceVerseContext
        verse={verseKey}
        {...verseContext}
        navigationDirection={navigationDirection}
        updateVerse={navigateVerse}
      />
      {anchorsQuery.isPending ? (
        <Box height={120} center>
          <Loading />
        </Box>
      ) : anchorsQuery.isError ? (
        <ResourceUnavailableView
          identity={recoveryIdentity}
          title={t('Les dictionnaires sont temporairement indisponibles.')}
          fileSize={22}
          failure={resourceFailureFromAccessError(anchorsQuery.error)}
          size="small"
          mt={40}
          onRetry={() => void anchorsQuery.refetch()}
        />
      ) : presentConcepts.length > 0 || citationConcepts.length > 0 ? (
        <SheetScrollView>
          <Box px={20} pt={20} pb={32} gap={20}>
            {[
              {
                key: 'presence',
                title: t('Présents dans ce verset'),
                concepts: presentConcepts,
              },
              {
                key: 'citations',
                title: t('Articles qui citent ce verset'),
                concepts: citationConcepts,
              },
            ].map(section =>
              section.concepts.length > 0 ? (
                <Box key={section.key} px={14} py={13} rounded bg="reverse" lightShadow>
                  <Text title fontSize={14} color="grey">
                    {section.title}
                  </Text>
                  <Box row wrap gap={5} mt={5}>
                    {section.concepts.map(concept => {
                      const source = pickPreferredDictionarySource(concept.sources, resourceLang)
                      if (!source) return null
                      return (
                        <TouchableBox
                          key={concept.key}
                          accessibilityRole="button"
                          accessibilityLabel={`${concept.label}, ${articleCountLabel(
                            concept.sources.length
                          )}`}
                          onPress={() =>
                            pushRouteOnce({
                              pathname: '/dictionnary-detail',
                              params: {
                                word: source.word,
                                entryId: String(source.id),
                                work: source.resource.work,
                                resourceId: source.resourceId,
                                dictionaryTitle: source.title,
                                language: source.resource.language,
                                correspondenceId: concept.correspondenceId,
                              },
                            })
                          }
                          activeOpacity={0.55}
                          bg="secondary"
                          bgOpacity="010"
                          borderRadius={5}
                          px={12}
                          py={5}
                        >
                          <Text title fontSize={14} color="secondary">
                            {concept.label}
                          </Text>
                        </TouchableBox>
                      )
                    })}
                  </Box>
                </Box>
              ) : null
            )}
          </Box>
        </SheetScrollView>
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t('Aucun article ne cite précisément ce verset.')}
        />
      )}
    </Box>
  )
}

export default DictionnaireVerseDetailScreen
