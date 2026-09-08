import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import PanelSearch from './ContextualPanel/PanelSearch'
import { useState } from 'react'
import { Platform } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { RootState } from '~redux/modules/reducer'
import { useColorItems } from '~helpers/useHighlightColors'
import ColorCircleGrid from './ColorCircleGrid'
import { useSetAtom } from 'jotai'
import { colorPickerModalAtom } from '~state/app'
import { FeatherIcon } from '~common/ui/Icon'
import { addTag, changeHighlightColor, removeHighlight, toggleTagEntity } from '~redux/modules/user'
import {
  changeWordAnnotationColor,
  removeWordAnnotationAction,
} from '~redux/modules/user/wordAnnotations'
import type { VerseIds } from './types'
import ContextualPanel from './ContextualPanel'
import PanelAction from './ContextualPanel/PanelAction'
import Box, { TouchableBox } from './ui/Box'
import Text from './ui/Text'
import Checkbox from './ui/Checkbox'

export type HighlightOptionsProps = { verseIds?: VerseIds; annotationId?: string; color?: string }
export default function HighlightOptions({ verseIds, annotationId, color }: HighlightOptionsProps) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const colors = useColorItems({ includeTypes: true })
  const setColorPicker = useSetAtom(colorPickerModalAtom)
  const selectColor = (colorId: string) => {
    if (annotationId) dispatch(changeWordAnnotationColor(annotationId, colorId))
    else if (verseIds) dispatch(changeHighlightColor(verseIds, colorId))
  }
  const tags = useSelector((state: RootState) => state.user.bible.tags)
  const entities = useSelector((state: RootState) =>
    annotationId ? state.user.bible.wordAnnotations : state.user.bible.highlights
  )
  const entityIds = annotationId ? [annotationId] : Object.keys(verseIds ?? {})
  const item = annotationId
    ? { entity: 'wordAnnotations' as const, id: annotationId }
    : { entity: 'highlights' as const, ids: verseIds }
  const [query, setQuery] = useState('')
  const validTags = Object.values(tags ?? {}).filter(
    tag => tag && typeof tag.name === 'string' && typeof tag.id === 'string'
  )
  const matchingTags = validTags
    .filter(tag => tag.name.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name))
  const web = Platform.OS === 'web'
  return (
    <Box className="absolute top-0 right-0">
      <ContextualPanel
        accessibilityLabel={t('accessibility.options')}
        trigger={<FeatherIcon name="more-vertical" size={20} />}
        triggerSize={28}
        initialScreen="actions"
        width={300}
        onClose={() => setQuery('')}
        screens={{
          actions: {
            title: t('Surbrillances'),
            content: nav => (
              <>
                <PanelAction
                  nested
                  icon="droplet"
                  label={t('Changer la couleur')}
                  onPress={() => nav.open('colors')}
                />
                <PanelAction
                  nested
                  icon="tag"
                  label={t('Éditer les tags')}
                  onPress={() => nav.open('tags')}
                />
                <PanelAction
                  icon="trash-2"
                  label={t('Supprimer')}
                  destructive
                  onPress={() => {
                    nav.close()
                    void confirmDelete(
                      t(
                        annotationId
                          ? 'Êtes-vous vraiment sur de supprimer cette annotation ?'
                          : 'Êtes-vous vraiment sur de supprimer cette surbrillance ?'
                      ),
                      () => {
                        if (annotationId) dispatch(removeWordAnnotationAction(annotationId))
                        else if (verseIds) dispatch(removeHighlight({ selectedVerses: verseIds }))
                      }
                    )
                  }}
                />
              </>
            ),
          },
          colors: {
            title: t('Changer la couleur'),
            content: nav => (
              <Box className={web ? 'p-3' : ''}>
                <ColorCircleGrid
                  colors={colors}
                  selectedColor={color}
                  layout={web ? 'grid' : 'scroll'}
                  scrollPadding={{ vertical: 10 }}
                  itemHeight={60}
                  showAddButton
                  onSelect={colorId => {
                    selectColor(colorId)
                    nav.back()
                  }}
                  onAddPress={() => {
                    nav.close()
                    setColorPicker({ selectedColor: color, onSelectColor: selectColor })
                  }}
                />
              </Box>
            ),
          },
          tags: {
            title: t('Éditer les tags'),
            headerContent: <PanelSearch value={query} onChange={setQuery} />,
            content: () => (
              <>
                {matchingTags.map(tag => {
                  const checked = entityIds.some(id => Boolean(entities?.[id]?.tags?.[tag.id]))
                  return (
                    <TouchableBox
                      key={tag.id}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      className={
                        web
                          ? 'w-full flex-row items-center gap-3 p-3 rounded-lg'
                          : 'w-full flex-row items-center gap-3 p-[16px] border-b border-border'
                      }
                      onPress={() => dispatch(toggleTagEntity({ item, tagId: tag.id }))}
                    >
                      <Checkbox checked={checked} size={web ? 22 : 24} />
                      <Text className={web ? 'flex-1 text-[14px]' : 'flex-1 text-[16px]'}>
                        {tag.name}
                      </Text>
                    </TouchableBox>
                  )
                })}
                {query.trim() &&
                  !validTags.some(
                    tag => tag.name.toLocaleLowerCase() === query.trim().toLocaleLowerCase()
                  ) && (
                    <PanelAction
                      icon="plus"
                      label={t('Créer') + ' « ' + query.trim() + ' »'}
                      onPress={() => {
                        const action = addTag(query.trim())
                        dispatch(action)
                        dispatch(toggleTagEntity({ item, tagId: action.payload.id }))
                        setQuery('')
                      }}
                    />
                  )}
              </>
            ),
          },
        }}
      />
    </Box>
  )
}
