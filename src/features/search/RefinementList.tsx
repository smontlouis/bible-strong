import React from 'react'
import { connectRefinementList } from 'react-instantsearch-native'

import DropdownMenu from '~common/DropdownMenu'
import Box from '~common/ui/Box'
import books from '~assets/bible_versions/books-desc'
import { useTranslation } from 'react-i18next'

const lookupTable = {
  section: {
    title: 'Section',
    NT: 'Nouveau Testament',
    AT: 'Ancien Testament',
  },
  book: {
    title: 'Livre',
    ...books.reduce(
      (acc, curr) => ({
        ...acc,
        [curr.Numero]: curr.Nom,
      }),
      {}
    ),
  },
}

const RefinementList = ({ items, refine, attribute, ...props }) => {
  const { t } = useTranslation()
  const currentValue = items.find(c => c.isRefined)?.label || ''

  const choices = [
    { label: t('Tout'), value: '' },
    ...items.map(item => {
      const value = item.label
      return {
        value,
        label: t(lookupTable[attribute][value]),
        subLabel: item.count,
      }
    }),
  ]

  choices.sort((a, b) => {
    if (Number(a.value) < Number(b.value)) {
      return -1
    }
    if (Number(a.value) > Number(b.value)) {
      return 1
    }
    return 0
  })

  return (
    <DropdownMenu
      title={t(lookupTable[attribute].title)}
      currentValue={currentValue}
      setValue={value => refine(value)}
      choices={choices}
    />
  )
}

export default connectRefinementList(RefinementList)
