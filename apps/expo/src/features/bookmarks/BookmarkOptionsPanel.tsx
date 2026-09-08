import BookmarkForm from './BookmarkForm'
import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import { useState } from 'react'
import { useDispatch } from 'react-redux'
import { useTranslation } from 'react-i18next'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { FeatherIcon } from '~common/ui/Icon'
import type { Bookmark } from '~common/types'
import { updateBookmark, removeBookmark } from '~redux/modules/user'

export default function BookmarkOptionsPanel({
  bookmark,
  onNavigate,
}: {
  bookmark: Bookmark
  onNavigate: () => void
}) {
  const { t } = useTranslation()
  const confirmDelete = useConfirmDelete()
  const dispatch = useDispatch()
  const [name, setName] = useState(bookmark.name)
  const [color, setColor] = useState(bookmark.color)
  const reset = () => {
    setName(bookmark.name)
    setColor(bookmark.color)
  }
  return (
    <ContextualPanel
      accessibilityLabel={t('accessibility.options')}
      triggerSize={54}
      trigger={<FeatherIcon name="more-vertical" size={20} />}
      initialScreen="actions"
      width={340}
      onClose={reset}
      screens={{
        actions: {
          title: t('Marque-page'),
          content: nav => (
            <>
              <PanelAction
                icon="book-open"
                label={t('Voir dans la Bible')}
                onPress={() => {
                  nav.close()
                  onNavigate()
                }}
              />
              <PanelAction
                nested
                icon="edit-2"
                label={t('Modifier')}
                onPress={() => {
                  reset()
                  nav.open('edit')
                }}
              />
              <PanelAction
                icon="trash-2"
                destructive
                label={t('Supprimer')}
                onPress={() => {
                  nav.close()
                  void confirmDelete(t('Voulez-vous vraiment supprimer ce marque-page?'), () => {
                    dispatch(removeBookmark(bookmark.id))
                  })
                }}
              />
            </>
          ),
        },
        edit: {
          title: t('Modifier'),
          content: nav => (
            <BookmarkForm
              name={name}
              color={color}
              onNameChange={setName}
              onColorChange={setColor}
              onSave={() => {
                dispatch(updateBookmark(bookmark.id, { name: name.trim() || bookmark.name, color }))
                nav.close()
              }}
            />
          ),
        },
      }}
    />
  )
}
