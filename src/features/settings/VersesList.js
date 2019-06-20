// @flow

import React from 'react'
import { FlatList } from 'react-native'

import Container from '~common/ui/Container'
import VerseComponent from './Verse'

const sortVersesByDate = (p) => (
  Object.keys(p)
    .reduce((arr, verse, i) => {
      const [Livre, Chapitre, Verset] = verse.split('-').map(Number)
      const formattedVerse = { Livre, Chapitre, Verset, Texte: '' } // 1-1-1 to { livre: 1, chapitre: 1, verset: 1}

      if (!arr.find(a => a.date === p[verse].date)) {
        arr.push({ date: p[verse].date, color: p[verse].color, verseIds: [] })
      }

      const dateInArray = arr.find(a => a.date === p[verse].date)
      if (dateInArray) {
        dateInArray.verseIds.push(formattedVerse)
        dateInArray.verseIds.sort((a, b) => Number(a.Verset) - Number(b.Verset))
      }

      arr.sort((a, b) => Number(b.date) - Number(a.date))
      return arr
    }, [])
)

const VersesList = ({ verseIds, isHighlight, isFavorite }) => {
  const sortedVersesByDate = sortVersesByDate(verseIds)

  return (
    <Container grey>
      <FlatList
        data={sortedVersesByDate}
        keyExtractor={(item, index) => item.date.toString()}
        renderItem={({ item: { date, verseIds } }) => (
          <VerseComponent {...{ date, verseIds }} />
        )}
      />
    </Container>
  )
}

export default VersesList
