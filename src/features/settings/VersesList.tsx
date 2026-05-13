import React from 'react'

import FlatList from '~common/ui/FlatList'
import { GroupedHighlightData, GroupedHighlights } from './HighlightsScreen'
import VerseComponent, { HighlightSettingsData } from './Verse'

interface Props {
  groupedHighlights: GroupedHighlights
  setSettings: (settings: HighlightSettingsData) => void
}

const VersesList = ({ groupedHighlights, setSettings }: Props) => {
  return (
    <FlatList
      data={groupedHighlights}
      keyExtractor={(item: GroupedHighlightData) => item.date.toString()}
      renderItem={({ item: { color, date, highlightsObj, tags, stringIds } }) => (
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
}

export default VersesList
