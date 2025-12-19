import React, { useEffect, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import Empty from '~common/Empty'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Container from '~common/ui/Container'

import { useAtom } from 'jotai/react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import Modal from '~common/Modal'
import Box from '~common/ui/Box'
import TouchableCircle from '~features/bible/TouchableCircle'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'
import { RootState } from '~redux/modules/reducer'
import { selectHighlightsObj, makeColorsSelector } from '~redux/selectors/user'
import {
  changeHighlightColor,
  Highlight,
  HighlightsObj,
  removeHighlight,
} from '~redux/modules/user'
import { multipleTagsModalAtom } from '../../state/app'
import VersesList from './VersesList'
import { useBottomSheetModal } from '~helpers/useBottomSheet'
import { TagsObj, Verse, VerseIds } from '~common/types'

interface Chip {
  id: string
  name: string
}

export type GroupedHighlights = {
  date: number
  color: string
  highlightsObj: Verse[]
  stringIds: VerseIds
  tags: TagsObj
}[]

const filterByChip =
  (chipId: string, highlightsObj: HighlightsObj) =>
  ([vId]: [string, Highlight]) =>
    chipId ? Boolean(highlightsObj[vId].tags && highlightsObj[vId].tags[chipId]) : true

const groupHighlightsByDate = (arr: GroupedHighlights, highlightTuple: [string, Highlight]) => {
  const [highlightId, highlight] = highlightTuple
  const [Livre, Chapitre, Verset] = highlightId.split('-').map(Number)
  const formattedVerse = { Livre, Chapitre, Verset, Texte: '' } // 1-1-1 to { livre: 1, chapitre: 1, verset: 1}

  if (!arr.find(a => a.date === highlight.date)) {
    arr.push({
      date: highlight.date,
      color: highlight.color,
      highlightsObj: [],
      stringIds: {},
      tags: {},
    })
  }

  const dateInArray = arr.find(a => a.date === highlight.date)
  if (dateInArray) {
    dateInArray.stringIds[highlightId] = true
    dateInArray.highlightsObj.push(formattedVerse)
    dateInArray.highlightsObj.sort((a, b) => Number(a.Verset) - Number(b.Verset))
    dateInArray.tags = { ...dateInArray.tags, ...highlight.tags }
  }

  arr.sort((a, b) => Number(b.date) - Number(a.date))

  return arr
}

const HighlightsScreen = () => {
  const { t } = useTranslation()
  const highlightsObj = useSelector(selectHighlightsObj)
  const { theme: currentTheme } = useCurrentThemeSelector()
  const selectColors = useMemo(() => makeColorsSelector(), [])
  const colors = useSelector((state: RootState) => selectColors(state, currentTheme))

  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState<any>()
  const [isChangeColorOpen, setIsChangeColorOpen] = React.useState<any>()
  const [, setMultipleTagsItem] = useAtom(multipleTagsModalAtom)
  const [selectedChip, setSelectedChip] = React.useState<Chip>()
  const dispatch = useDispatch()
  const chipId = selectedChip?.id

  const { ref, open, close } = useBottomSheetModal()
  const { ref: ref2, open: open2, close: close2 } = useBottomSheetModal()

  useEffect(() => {
    if (isSettingsOpen) {
      open()
    }
  }, [isSettingsOpen, open])

  useEffect(() => {
    if (isChangeColorOpen) {
      open2()
    }
  }, [isChangeColorOpen, open2])

  const groupedHighlights = useMemo(() => {
    const highlights = Object.entries(highlightsObj)
    highlights.sort((a, b) => Number(b[1].date) - Number(a[1].date))
    return (chipId ? highlights.filter(filterByChip(chipId, highlightsObj)) : highlights)
      .splice(0, 100)
      .reduce(groupHighlightsByDate, [])
  }, [chipId, highlightsObj])

  const promptLogout = () => {
    Alert.alert(t('Attention'), t('Êtes-vous vraiment sur de supprimer cette surbrillance ?'), [
      { text: t('Non'), onPress: () => null, style: 'cancel' },
      {
        text: t('Oui'),
        onPress: () => {
          dispatch(removeHighlight({ selectedVerses: isSettingsOpen?.stringIds }))
          close()
        },
        style: 'destructive',
      },
    ])
  }

  const changeColor = (color: string) => {
    dispatch(changeHighlightColor(isChangeColorOpen, color))
    close2()
  }

  return (
    <Container>
      <TagsHeader
        title={t('Surbrillances')}
        setIsOpen={setTagsIsOpen}
        isOpen={isTagsOpen}
        selectedChip={selectedChip}
        hasBackButton
      />
      <TagsModal
        isVisible={isTagsOpen}
        onClosed={() => setTagsIsOpen(false)}
        onSelected={(chip: Chip) => setSelectedChip(chip)}
        selectedChip={selectedChip}
      />
      {groupedHighlights?.length ? (
        <VersesList setSettings={setIsSettingsOpen} groupedHighlights={groupedHighlights} />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore rien surligné...")}
        />
      )}
      <Modal.Body ref={ref} onModalClose={() => setIsSettingsOpen(undefined)} enableDynamicSizing>
        <Modal.Item
          bold
          onPress={() => {
            close()
            setIsChangeColorOpen(isSettingsOpen?.stringIds)
          }}
        >
          {t('Changer la couleur')}
        </Modal.Item>
        <Modal.Item
          bold
          onPress={() => {
            close()
            setMultipleTagsItem({
              entity: 'highlights',
              ids: isSettingsOpen?.stringIds,
            })
          }}
        >
          {t('Éditer les tags')}
        </Modal.Item>
        <Modal.Item bold color="quart" onPress={promptLogout}>
          {t('Supprimer')}
        </Modal.Item>
      </Modal.Body>
      <Modal.Body
        ref={ref2}
        onModalClose={() => setIsChangeColorOpen(undefined)}
        enableDynamicSizing
      >
        <Box row my={20} mx={20}>
          <TouchableCircle color={colors.color1} onPress={() => changeColor('color1')} />
          <TouchableCircle color={colors.color2} onPress={() => changeColor('color2')} />
          <TouchableCircle color={colors.color3} onPress={() => changeColor('color3')} />
          <TouchableCircle color={colors.color4} onPress={() => changeColor('color4')} />
          <TouchableCircle color={colors.color5} onPress={() => changeColor('color5')} />
        </Box>
      </Modal.Body>
    </Container>
  )
}

export default HighlightsScreen
