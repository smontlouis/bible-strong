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
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { useResourceAccess } from '~features/resources/resourceAccess'
import { bibleChapterQueryOptions } from '~features/resources/resourceQueries'
import ResourceUnavailableView from '~features/resources/ResourceUnavailableView'
import { resourceFailureFromAccessError } from '~features/resources/resourceFailure'
import { getDefaultBibleVersion } from '~helpers/languageUtils'
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
}: {
  verse: Verse
  updateVerse: (value: number) => void
}) => {
  const resources = useResourceAccess()
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()
  const { Livre, Chapitre, Verset } = verse
  const verseKey = `${Livre}-${Chapitre}-${Verset}`
  const resourceLang = useAtomValue(resourcesLanguageAtom).DICTIONNAIRE

  const anchorsQuery = useQuery({
    queryKey: ['dictionary-passage-entries', verseKey, resourceLang],
    queryFn: () => resources.dictionary.discoverPassageEntries(verseKey, resourceLang),
    ...localQueryOptions,
  })
  const chapterQuery = useQuery({
    ...bibleChapterQueryOptions(
      {
        version: getDefaultBibleVersion(resourceLang),
        book: Number(Livre),
        chapter: Number(Chapitre),
      },
      resources
    ),
  })
  const chapterResult = chapterQuery.data
  const versesInCurrentChapter = chapterResult?.success ? chapterResult.data.verses.length : null

  if (anchorsQuery.isPending) return <Loading />

  if (anchorsQuery.isError) {
    return (
      <ResourceUnavailableView
        identity={{ kind: 'database', databaseId: 'DICTIONNAIRE', language: resourceLang }}
        title={t('Les dictionnaires sont temporairement indisponibles.')}
        fileSize={22}
        failure={resourceFailureFromAccessError(anchorsQuery.error)}
        size="small"
        mt={100}
        onRetry={() => void anchorsQuery.refetch()}
      />
    )
  }

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
    <Box flex={1}>
      <Box px={20} pt={16} pb={10}>
        <BibleVerseDetailFooter
          verseNumber={Verset}
          versesInCurrentChapter={versesInCurrentChapter}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
        />
      </Box>
      {presentConcepts.length > 0 || citationConcepts.length > 0 ? (
        <SheetScrollView>
          <Box px={20} pt={8} pb={32}>
            {[
              {
                key: 'presence',
                title: t('Présents dans ce verset'),
                description: t(
                  'Noms propres et expressions retrouvés exactement dans la Bible de référence.'
                ),
                concepts: presentConcepts,
              },
              {
                key: 'citations',
                title: t('Articles qui citent ce verset'),
                description: t(
                  'Ces liens viennent des références présentes dans les articles, indépendamment de la traduction biblique affichée.'
                ),
                concepts: citationConcepts,
              },
            ].map((section, sectionIndex) =>
              section.concepts.length > 0 ? (
                <Box key={section.key} mt={sectionIndex > 0 ? 22 : 0}>
                  <Text title fontSize={14} color="grey">
                    {section.title}
                  </Text>
                  <Text fontSize={12} color="tertiary" mt={4}>
                    {section.description}
                  </Text>
                  <Box row wrap gap={6} mt={10}>
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
                          borderRadius={6}
                          px={12}
                          py={7}
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
