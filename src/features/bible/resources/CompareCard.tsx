import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import { VerseIds } from '~common/types'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { versions } from '~helpers/bibleVersions'
import { getMaxChapterVerseCount } from '~helpers/bibleCoverage'
import { selectCompareVersions } from '~redux/selectors/user'
import { localQueryOptions } from '~helpers/queryOptions'
import { useSheet } from '~helpers/useSheet'
import type { StrongSelection } from '~helpers/strongSelection'
import StrongSelectionSheet from '../StrongSelectionSheet'

interface CompareCardProps {
  selectedVerses: VerseIds
  onChangeVerse: (verse: string) => void
  strongMode?: boolean
}

const CompareCard = ({ selectedVerses, onChangeVerse, strongMode = false }: CompareCardProps) => {
  const { t } = useTranslation()
  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)
  const strongSelectionSheet = useSheet()
  const [strongSelection, setStrongSelection] = React.useState<StrongSelection | null>(null)

  const selectedVerseKeys = Object.keys(selectedVerses)
  const { data: prevNextItems = null } = useQuery({
    queryKey: ['resource-compare-prev-next', selectedVerseKeys[0], versionsToCompare],
    queryFn: async () => {
      const [livre, chapitre, verse] = selectedVerseKeys[0].split('-')
      const versesInCurrentChapter =
        (await getMaxChapterVerseCount(versionsToCompare, Number(livre), Number(chapitre))) ||
        countLsgChapters[`${livre}-${chapitre}`]
      return { verseNumber: verse, versesInCurrentChapter }
    },
    enabled: selectedVerseKeys.length === 1,
    ...localQueryOptions,
  })

  const goToVerse = (value: number) => {
    const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)
    onChangeVerse(`${livre}-${chapitre}-${verse + value}`)
  }

  const filteredVersions = Object.entries(versions).filter(([versionId]) =>
    versionsToCompare.includes(versionId)
  )
  const openStrongSelection = (selection: StrongSelection) => {
    setStrongSelection(selection)
    strongSelectionSheet.open()
  }
  const closeStrongSelection = () => setStrongSelection(null)

  if (!filteredVersions.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('Aucune version à comparer...')}
      />
    )
  }

  return (
    <>
      <Box>
        {filteredVersions.map(([versionId, obj], position) => (
          <BibleCompareVerseItem
            key={`${versionId}-${Object.keys(selectedVerses).join('-')}`}
            versionId={versionId}
            name={obj.name}
            selectedVerses={selectedVerses}
            position={position}
            strongMode={strongMode}
            selectedStrongReference={strongSelection?.reference}
            onStrongSelect={openStrongSelection}
          />
        ))}
        {prevNextItems && (
          <BibleVerseDetailFooter
            verseNumber={prevNextItems.verseNumber}
            goToNextVerse={() => goToVerse(+1)}
            goToPrevVerse={() => goToVerse(-1)}
            versesInCurrentChapter={prevNextItems.versesInCurrentChapter}
          />
        )}
      </Box>
      <StrongSelectionSheet
        sheetRef={strongSelectionSheet.getRef()}
        version={strongSelection?.version}
        book={strongSelection?.book}
        chapter={strongSelection?.chapter}
        verse={strongSelection?.verse}
        word={strongSelection?.word}
        identities={strongSelection?.identities ?? []}
        morphologies={strongSelection?.morphologies ?? []}
        onDismissStart={closeStrongSelection}
        onClose={closeStrongSelection}
      />
    </>
  )
}

export default CompareCard
