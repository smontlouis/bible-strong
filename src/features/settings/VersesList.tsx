import React from 'react'

import FlatList from '~common/ui/FlatList'
import { GroupedHighlights } from './HighlightsScreen'
import VerseComponent from './Verse'

interface Props {
  groupedHighlights: GroupedHighlights
  setSettings: (settings: any) => void
}

const VersesList = React.memo(({ groupedHighlights, setSettings }: Props) => {
  return (
    <FlatList
      data={groupedHighlights}
      keyExtractor={(item: any) => item.date.toString()}
      renderItem={({ item: { color, date, highlightsObj, tags, stringIds } }: any) => (
        <VerseComponent
          {...{
            color,
            date,
            verseIds: highlightsObj,
            tags,
            setSettings,
            stringIds,
          }}
        />
      )}
    />
  )
})

export default VersesList
