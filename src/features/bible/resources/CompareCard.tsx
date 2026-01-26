import React, { useEffect, useState } from 'react'
import { shallowEqual, useSelector } from 'react-redux'
import { useTranslation } from 'react-i18next'

import countLsgChapters from '~assets/bible_versions/countLsgChapters'
import Empty from '~common/Empty'
import Box from '~common/ui/Box'
import { VerseIds } from '~common/types'
import BibleCompareVerseItem from '~features/bible/BibleCompareVerseItem'
import BibleVerseDetailFooter from '~features/bible/BibleVerseDetailFooter'
import { versions } from '~helpers/bibleVersions'
import { selectCompareVersions } from '~redux/selectors/user'

interface CompareCardProps {
  selectedVerses: VerseIds
  onChangeVerse: (verse: string) => void
}

const CompareCard = ({ selectedVerses, onChangeVerse }: CompareCardProps) => {
  const { t } = useTranslation()
  const versionsToCompare = useSelector(selectCompareVersions, shallowEqual)

  const [prevNextItems, setPrevNextItems] = useState<{
    verseNumber: string
    versesInCurrentChapter: number
  } | null>(null)

  const hasPrevNextButtons = Object.keys(selectedVerses).length === 1

  useEffect(() => {
    const loadPrevNextData = async () => {
      const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-')
      const versesInCurrentChapter = countLsgChapters[`${livre}-${chapitre}`]
      setPrevNextItems({
        verseNumber: verse,
        versesInCurrentChapter,
      })
    }

    if (hasPrevNextButtons) {
      loadPrevNextData()
    } else {
      setPrevNextItems(null)
    }
  }, [selectedVerses, hasPrevNextButtons])

  const goToVerse = (value: number) => {
    const [livre, chapitre, verse] = Object.keys(selectedVerses)[0].split('-').map(Number)
    onChangeVerse(`${livre}-${chapitre}-${verse + value}`)
  }

  const filteredVersions = Object.entries(versions).filter(([versionId]) =>
    versionsToCompare.includes(versionId)
  )

  if (!filteredVersions.length) {
    return (
      <Empty
        source={require('~assets/images/empty.json')}
        message={t('Aucune version à comparer...')}
      />
    )
  }

  return (
    <Box>
      {filteredVersions.map(([versionId, obj], position) => (
        <BibleCompareVerseItem
          key={`${versionId}-${Object.keys(selectedVerses).join('-')}`}
          versionId={versionId}
          name={obj.name}
          selectedVerses={selectedVerses}
          position={position}
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
  )
}

export default CompareCard
