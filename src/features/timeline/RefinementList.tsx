import React from 'react'
import { connectRefinementList } from 'react-instantsearch-native'
import DropdownMenu from '~common/DropdownMenu'
import useLanguage from '~helpers/useLanguage'
import { useTranslation } from 'react-i18next'

const lookupTable = {
  period: {
    title: 'Période',
    1: 'Première génération',
    2: 'Noé et le déluge',
    3: 'Les patriarches',
    4: 'Israël en Égypte',
    5: 'Les Juges',
    6: 'Le Royaume Uni',
    7: 'Le royaume divisé',
    8: "L'Exode",
    9: 'La vie de Christ',
    10: "L'Église primitive",
    11: 'Le Moyen Âge',
    12: 'Réformation',
    13: "Prophéties de l'Apocalypse",
  },
}

const RefinementList = ({ items, refine, attribute, ...props }: any) => {
  const { t } = useTranslation()
  const currentValue = items.find((c: any) => c.isRefined)?.label || ''
  items.sort((a: any, b: any) => Number(a.label) < Number(b.label))
  const choices = [
    { label: t('Tout'), value: '' },
    ...items.map((item: any) => {
      const value = item.label
      return {
        value,
        // @ts-ignore
        label: t(lookupTable[attribute][value]),
        subLabel: item.count,
      }
    }),
  ]

  choices.sort((a: any, b: any) => {
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
      // @ts-ignore
      title={t(lookupTable[attribute].title)}
      currentValue={currentValue}
      setValue={(value: any) => refine(value)}
      choices={choices}
    />
  )
}

export default connectRefinementList(RefinementList)
