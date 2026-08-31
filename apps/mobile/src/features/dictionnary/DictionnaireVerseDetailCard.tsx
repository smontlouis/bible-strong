import { useQuery } from '@tanstack/react-query'
import { useAtomValue } from 'jotai'
import React from 'react'
import { useTranslation } from 'react-i18next'

import Empty from '~common/Empty'
import Loading from '~common/Loading'
import type { Verse } from '~common/types'
import Box, { TouchableBox } from '~common/ui/Box'
import FlatList from '~common/ui/FlatList'
import Text from '~common/ui/Text'
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

  const concepts = groupDictionaryPassageEntries(anchorsQuery.data ?? [], resourceLang)
  const articleCountLabel = (count: number) =>
    t(count === 1 ? '{{count}} article' : '{{count}} articles', { count })

  return (
    <Box flex={1}>
      <Box px={20} pt={16} pb={10}>
        <Text title fontSize={18}>
          {t('Articles qui citent ce verset')}
        </Text>
        <Text fontSize={12} color="tertiary" mt={4}>
          {t(
            'Ces liens viennent des références présentes dans les articles, indépendamment de la traduction biblique affichée.'
          )}
        </Text>
        <BibleVerseDetailFooter
          verseNumber={Verset}
          versesInCurrentChapter={versesInCurrentChapter}
          goToNextVerse={() => updateVerse(+1)}
          goToPrevVerse={() => updateVerse(-1)}
        />
      </Box>
      <Box flex bg="lightGrey" pt={8}>
        {concepts.length > 0 ? (
          <FlatList
            data={concepts}
            keyExtractor={concept => concept.key}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            renderItem={({ item: concept }) => {
              const source = pickPreferredDictionarySource(concept.sources, resourceLang)
              if (!source) return null
              const variants = [
                ...new Set(concept.sources.flatMap(item => (item.word ? [item.word] : []))),
              ]
              return (
                <TouchableBox
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
                  bg="reverse"
                  borderRadius={12}
                  px={14}
                  py={12}
                  mb={8}
                  lightShadow
                >
                  <Text title fontSize={17}>
                    {concept.label}
                  </Text>
                  <Text fontSize={12} color="tertiary" mt={3}>
                    {articleCountLabel(concept.sources.length)} ·{' '}
                    {concept.sources.map(item => item.abbreviation).join(' · ')}
                  </Text>
                  {variants.length > 1 ? (
                    <Text fontSize={11} color="grey" mt={3}>
                      {variants.join(' · ')}
                    </Text>
                  ) : null}
                </TouchableBox>
              )
            }}
          />
        ) : (
          <Empty
            source={require('~assets/images/empty.json')}
            message={t('Aucun article ne cite précisément ce verset.')}
          />
        )}
      </Box>
    </Box>
  )
}

export default DictionnaireVerseDetailScreen
