import React from 'react'
import { connectRefinementList } from 'react-instantsearch-native'

import DropdownMenu from '~common/DropdownMenu'
import Box from '~common/ui/Box'
import books from '~assets/bible_versions/books-desc'

const lookupTable = {
  section: {
    title: 'Section',
    NT: 'Nouveau Testament',
    AT: 'Ancien Testament'
  },
  book: {
    title: 'Livre',
    ...books.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.Numero]: curr.Nom
      }),
      {}
    )
  }
}

const RefinementList = ({ items, refine, attribute }) => {
  const currentValue = items.find(c => c.isRefined)?.label || ''

  const choices = [
    { label: 'Tout', value: '' },
    ...items.map(item => {
      const value = item.label
      return {
        value,
        label: lookupTable[attribute][value],
        count: item.count
      }
    })
  ]

  choices.sort((a, b) => {
    if (a.value < b.value) {
      return -1
    }
    if (a.value > b.value) {
      return 1
    }
    return 0
  })

  return (
    <DropdownMenu
      title={lookupTable[attribute].title}
      currentValue={currentValue}
      setValue={value => refine(value)}
      choices={choices}
    />
  )
}

export default connectRefinementList(RefinementList)
