import React, { useMemo } from 'react'
import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import Container from '~common/ui/Container'
import TagsHeader from '~common/TagsHeader'
import TagsModal from '~common/TagsModal'
import Empty from '~common/Empty'

import VersesList from './VersesList'
import { RootState } from '~redux/modules/reducer'
import Modal from '~common/Modal'
import { Alert } from 'react-native'
import { removeHighlight, changeHighlightColor } from '~redux/modules/user'
import MultipleTagsModal from '~common/MultipleTagsModal'
import TouchableCircle from '~features/bible/TouchableCircle'
import Box from '~common/ui/Box'
import { useTranslation } from 'react-i18next'
import useCurrentThemeSelector from '~helpers/useCurrentThemeSelector'

interface Chip {
  id: string
  name: string
}

const HighlightsScreen = () => {
  const { t } = useTranslation()
  const verseIds = useSelector(
    (state: RootState) => state.user.bible.highlights,
    shallowEqual
  )
  const { theme: currentTheme } = useCurrentThemeSelector()
  const colors = useSelector(
    (state: RootState) => state.user.bible.settings.colors[currentTheme],
    shallowEqual
  )

  const [isTagsOpen, setTagsIsOpen] = React.useState(false)
  const [isSettingsOpen, setIsSettingsOpen] = React.useState()
  const [isChangeColorOpen, setIsChangeColorOpen] = React.useState()
  const [multipleTagsItem, setMultipleTagsItem] = React.useState(false)
  const [selectedChip, setSelectedChip] = React.useState<Chip>()
  const dispatch = useDispatch()
  const chipId = selectedChip?.id
  const isMultipleTagsItem = !!multipleTagsItem

  // TODO - Performance issue here
  const filteredHighlights = useMemo(() => {
    return Object.keys(verseIds)
      .filter(vId =>
        selectedChip ? verseIds[vId].tags && verseIds[vId].tags[chipId] : true
      )
      .reduce((acc, curr) => ({ ...acc, [curr]: verseIds[curr] }), {})
  }, [
    chipId,
    isChangeColorOpen,
    isMultipleTagsItem,
    Object.keys(verseIds).length,
  ])

  const promptLogout = () => {
    Alert.alert(
      t('Attention'),
      t('Êtes-vous vraiment sur de supprimer cette surbrillance ?'),
      [
        { text: t('Non'), onPress: () => null, style: 'cancel' },
        {
          text: t('Oui'),
          onPress: () => {
            dispatch(
              removeHighlight({ selectedVerses: isSettingsOpen?.stringIds })
            )
            setIsSettingsOpen(undefined)
          },
          style: 'destructive',
        },
      ]
    )
  }

  const changeColor = (color: string) => {
    dispatch(changeHighlightColor(isChangeColorOpen, color))
    setIsChangeColorOpen(undefined)
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
      {Object.keys(filteredHighlights).length ? (
        <VersesList
          setSettings={setIsSettingsOpen}
          verseIds={filteredHighlights}
        />
      ) : (
        <Empty
          source={require('~assets/images/empty.json')}
          message={t("Vous n'avez pas encore rien surligné...")}
        />
      )}
      <Modal.Body
        isOpen={!!isSettingsOpen}
        onClose={() => setIsSettingsOpen(undefined)}
        adjustToContentHeight
      >
        <Modal.Item
          bold
          onPress={() => {
            setIsSettingsOpen(undefined)
            setIsChangeColorOpen(isSettingsOpen?.stringIds)
          }}
        >
          {t('Changer la couleur')}
        </Modal.Item>
        <Modal.Item
          bold
          onPress={() => {
            setIsSettingsOpen(undefined)
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
        isOpen={!!isChangeColorOpen}
        onClose={() => setIsChangeColorOpen(undefined)}
        adjustToContentHeight
      >
        <Box row my={20} mx={20}>
          <TouchableCircle
            color={colors.color1}
            onPress={() => changeColor('color1')}
          />
          <TouchableCircle
            color={colors.color2}
            onPress={() => changeColor('color2')}
          />
          <TouchableCircle
            color={colors.color3}
            onPress={() => changeColor('color3')}
          />
          <TouchableCircle
            color={colors.color4}
            onPress={() => changeColor('color4')}
          />
          <TouchableCircle
            color={colors.color5}
            onPress={() => changeColor('color5')}
          />
        </Box>
      </Modal.Body>
      <MultipleTagsModal
        item={multipleTagsItem}
        onClosed={() => setMultipleTagsItem(false)}
      />
    </Container>
  )
}

export default HighlightsScreen
