import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import type { PanelScreen } from '~common/ContextualPanel/types'
import PanelAction from '~common/ContextualPanel/PanelAction'
import { useConfirmDelete } from '~common/ContextualPanel/useConfirmDelete'
import Text from '~common/ui/Text'
import {
  addBookmark,
  updateBookmark,
  moveBookmark,
  removeBookmark,
  MAX_BOOKMARKS,
} from '~redux/modules/user'
import { selectSortedBookmarks } from '~redux/selectors/bookmarks'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import BookmarkForm from './BookmarkForm'
import books from '~assets/bible_versions/books-desc'
import Box, { TouchableBox } from '~common/ui/Box'
import { FeatherIcon, IonIcon } from '~common/ui/Icon'
import { getBookmarkVerse } from './bookmarkVerse'

export function useBibleBookmarkScreens(book: number, chapter: number, version: string) {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const confirmDelete = useConfirmDelete()
  const bookmarks = useSelector(selectSortedBookmarks)
  const existing = bookmarks.find(
    item => item.book === book && item.chapter === chapter && item.verse === undefined
  )
  const [name, setName] = useState('')
  const [color, setColor] = useState('#cc0000')
  const destination = `${books.find(item => item.Numero === book)?.Nom ?? book} ${chapter}`
  const passageHeader = (
    <Box className="flex-row items-center gap-2 px-3 pt-1 pb-3">
      <IonIcon name="bookmark-outline" size={16} color="primary" />
      <Text className="text-[13px] font-bold text-primary">{destination}</Text>
      <Text className="text-[12px] text-tertiary">{version}</Text>
    </Box>
  )
  const prepare = () => {
    setName(existing?.name ?? '')
    setColor(existing?.color ?? '#cc0000')
  }
  const screens: Record<string, PanelScreen> = {
    bookmark: {
      title: t('Marque-page'),
      headerContent: passageHeader,
      content: nav =>
        existing ? (
          <>
            <BookmarkForm
              name={name}
              color={color}
              onNameChange={setName}
              onColorChange={setColor}
              onSave={() => {
                dispatch(updateBookmark(existing.id, { name: name.trim() || existing.name, color }))
                toast(t('Marque-page modifié'))
                nav.close()
              }}
            />
            <PanelAction
              icon="trash-2"
              destructive
              label={t('Supprimer')}
              onPress={() => {
                nav.close()
                void confirmDelete(t('Voulez-vous vraiment supprimer ce marque-page?'), () =>
                  dispatch(removeBookmark(existing.id))
                )
              }}
            />
          </>
        ) : (
          <>
            <Box className="px-1 pb-3">
              {bookmarks.length < MAX_BOOKMARKS ? (
                <TouchableBox
                  className="w-full flex-row items-center gap-3 p-3 rounded-xl bg-light-primary"
                  accessibilityRole="button"
                  onPress={() => nav.open('bookmark-create')}
                >
                  <Box className="w-8 h-8 rounded-lg bg-reverse items-center justify-center">
                    <FeatherIcon name="plus" size={18} color="primary" />
                  </Box>
                  <Text className="flex-1 font-bold text-[14px] text-primary">
                    {t('Créer un nouveau marque-page')}
                  </Text>
                  <FeatherIcon name="chevron-right" size={16} color="primary" />
                </TouchableBox>
              ) : (
                <Text className="p-3 text-[13px] text-tertiary">{t('bookmark.maxReached')}</Text>
              )}
            </Box>
            {bookmarks.length > 0 && (
              <Box className="flex-row items-center gap-3 px-3 pt-3 pb-2 border-t border-border">
                <Text className="flex-1 text-[12px] text-tertiary">
                  {t('Déplacer un marque-page existant')}
                </Text>
                <Text
                  className="text-[12px] text-tertiary"
                  style={{ fontVariant: ['tabular-nums'] }}
                >
                  {bookmarks.length}/{MAX_BOOKMARKS}
                </Text>
              </Box>
            )}
            {bookmarks.map(item => {
              const verse = getBookmarkVerse(item.verse)
              return (
                <TouchableBox
                  key={item.id}
                  className="w-full flex-row items-center px-3 py-[10px] rounded-lg"
                  accessibilityRole="button"
                  accessibilityHint={`${t('Déplacer un marque-page existant')} · ${destination}`}
                  onPress={() => {
                    dispatch(moveBookmark(item.id, { book, chapter, version }))
                    toast(t('Marque-page déplacé'))
                    nav.close()
                  }}
                >
                  <Box className="w-8 items-center justify-center">
                    <IonIcon name="bookmark" size={22} color={item.color} />
                  </Box>
                  <Box className="flex-1 min-w-0 ml-[10px] gap-[2px]">
                    <Text className="font-bold text-[14px]" numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text className="text-[12px] text-grey">
                      {`${books.find(book => book.Numero === item.book)?.Nom ?? item.book} ${item.chapter}${verse !== undefined ? ':' + verse : ''}${item.version ? ' · ' + item.version : ''}`}
                    </Text>
                  </Box>
                  <FeatherIcon name="arrow-right" size={15} color="tertiary" />
                </TouchableBox>
              )
            })}
          </>
        ),
    },
    'bookmark-create': {
      title: t('Créer un nouveau marque-page'),
      headerContent: passageHeader,
      content: nav => (
        <BookmarkForm
          name={name}
          color={color}
          onNameChange={setName}
          onColorChange={setColor}
          disabled={bookmarks.length >= MAX_BOOKMARKS}
          onSave={() => {
            if (bookmarks.length >= MAX_BOOKMARKS) return
            dispatch(
              addBookmark({
                id: generateUUID(),
                name: name.trim() || `${t('Marque-page')} ${bookmarks.length + 1}`,
                color,
                book,
                chapter,
                version,
                date: Date.now(),
              })
            )
            toast(t('Marque-page créé'))
            nav.close()
          }}
        />
      ),
    },
  }
  return { screens, prepare }
}
