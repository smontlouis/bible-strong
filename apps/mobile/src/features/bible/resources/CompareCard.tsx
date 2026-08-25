import { useQuery } from '@tanstack/react-query'
import React from 'react'
import { useWindowDimensions } from 'react-native'
import { shallowEqual, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { FeatherIcon } from '~common/ui/Icon'
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
  onChooseVersions?: () => void
}

const CompareCard = ({
  selectedVerses,
  onChangeVerse,
  strongMode = false,
  onChooseVersions,
}: CompareCardProps) => {
  const { t } = useTranslation()
  const { height: viewportHeight } = useWindowDimensions()
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
    enabled: selectedVerseKeys.length === 1 && versionsToCompare.length > 0,
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
        iconElement={
          <Box size={64} borderRadius={32} bg="lightGrey" center>
            <FeatherIcon name="columns" size={28} color="primary" />
          </Box>
        }
        message={t('Aucune version à comparer...')}
      >
        {onChooseVersions && (
          <Box mt={20} minWidth={260}>
            <Button
              onPress={onChooseVersions}
              testID="compare-empty-choose-versions"
              rightIcon={
                <Box ml={10}>
                  <FeatherIcon name="arrow-right" size={18} color="white" />
                </Box>
              }
            >
              {t('common.chooseCompareVersions')}
            </Button>
          </Box>
        )}
      </Empty>
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
        <Box height={viewportHeight * 0.55} />
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
