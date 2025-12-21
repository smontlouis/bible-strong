import styled from '@emotion/native'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import Color from 'color'
import React, { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, ScrollView } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import generateUUID from '~helpers/generateUUID'

import books from '~assets/bible_versions/books-desc'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import Snackbar from '~common/SnackBar'
import type { Bookmark } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { IonIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import TouchableCircle from '~features/bible/TouchableCircle'
import {
  addBookmark,
  MAX_BOOKMARKS,
  moveBookmark,
  removeBookmark,
  updateBookmark,
} from '~redux/modules/user'
import { selectBookmarksCount, selectSortedBookmarks } from '~redux/selectors/bookmarks'

// Color palette from StudyFooter
const BOOKMARK_COLORS = [
  '#cc0000',
  '#f1c232',
  '#6aa84f',
  '#45818e',
  '#3d85c6',
  '#674ea7',
  '#a64d79',
]
const LIGHTEN_LEVELS = ['0.3', '0.5', '0.7', '0.9']

const BookmarkListItem = styled.TouchableOpacity<{ isSelected?: boolean }>(
  ({ theme, isSelected }) => ({
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginBottom: 8,
    borderRadius: 8,
    backgroundColor: isSelected ? theme.colors.lightPrimary : theme.colors.lightGrey,
    borderWidth: isSelected ? 2 : 0,
    borderColor: theme.colors.primary,
  })
)

const StyledTextInput = styled(BottomSheetTextInput)(({ theme }) => ({
  color: theme.colors.default,
  height: 48,
  borderColor: theme.colors.border,
  borderWidth: 2,
  borderRadius: 10,
  paddingHorizontal: 15,
  fontSize: 16,
}))

interface BookmarkModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  onClose: () => void
  // For creating new bookmark
  book?: number
  chapter?: number
  verse?: number
  version?: string
  // For editing existing bookmark
  existingBookmark?: Bookmark
}

const getBookName = (bookNumber: number): string => {
  const bookData = books.find((b: any) => b.Numero === bookNumber)
  return bookData?.Nom || `Livre ${bookNumber}`
}

const formatReference = (book: number, chapter: number, verse: number): string => {
  const bookName = getBookName(book)
  if (verse === 1) {
    return `${bookName} ${chapter}`
  }
  return `${bookName} ${chapter}:${verse}`
}

const BookmarkModal = ({
  bottomSheetRef,
  onClose,
  book,
  chapter,
  verse = 1,
  version,
  existingBookmark,
}: BookmarkModalProps) => {
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()

  const bookmarksCount = useSelector(selectBookmarksCount)
  const existingBookmarks = useSelector(selectSortedBookmarks)

  // Mode: 'select' (choose existing to move), 'create' (new bookmark), 'edit' (modify existing)
  const [mode, setMode] = useState<'select' | 'create' | 'edit'>('select')
  const [name, setName] = useState('')
  const [selectedColor, setSelectedColor] = useState(BOOKMARK_COLORS[0])

  const isEditing = !!existingBookmark
  const reference = useMemo(() => {
    if (existingBookmark) {
      return formatReference(
        existingBookmark.book,
        existingBookmark.chapter,
        existingBookmark.verse
      )
    }
    if (book && chapter) {
      return formatReference(book, chapter, verse)
    }
    return ''
  }, [existingBookmark, book, chapter, verse])

  // Reset state when modal data changes
  useEffect(() => {
    if (existingBookmark) {
      setMode('edit')
      setName(existingBookmark.name)
      setSelectedColor(existingBookmark.color)
    } else if (existingBookmarks.length > 0) {
      setMode('select')
      setName('')
      setSelectedColor(BOOKMARK_COLORS[0])
    } else {
      setMode('create')
      setName('')
      setSelectedColor(BOOKMARK_COLORS[0])
    }
  }, [existingBookmark, existingBookmarks.length])

  const handleClose = () => {
    bottomSheetRef.current?.dismiss()
    onClose()
  }

  const getDefaultBookmarkName = () => {
    return `${t('Marque-page')} ${bookmarksCount + 1}`
  }

  const handleSave = () => {
    const bookmarkName = name.trim() || getDefaultBookmarkName()

    if (isEditing && existingBookmark) {
      // Editing existing bookmark
      dispatch(
        updateBookmark(existingBookmark.id, {
          name: bookmarkName,
          color: selectedColor,
        })
      )
      Snackbar.show(t('Marque-page modifié'))
    } else {
      // Creating new bookmark
      if (bookmarksCount >= MAX_BOOKMARKS) {
        Alert.alert(t('Limite atteinte'), t('bookmark.maxReached'), [
          { text: t('OK'), style: 'default' },
        ])
        return
      }

      const newBookmark: Bookmark = {
        id: generateUUID(),
        name: bookmarkName,
        color: selectedColor,
        book: book!,
        chapter: chapter!,
        verse: verse,
        date: Date.now(),
        version,
      }

      dispatch(addBookmark(newBookmark))
      Snackbar.show(t('Marque-page créé'))
    }

    handleClose()
  }

  const handleSelectExistingBookmark = (bookmark: Bookmark) => {
    // Move the bookmark immediately to the new location
    dispatch(
      moveBookmark(bookmark.id, {
        book: book!,
        chapter: chapter!,
        verse: verse,
        version,
      })
    )
    Snackbar.show(t('Marque-page déplacé'))
    handleClose()
  }

  const handleDelete = () => {
    if (!existingBookmark) return

    Alert.alert(t('Attention'), t('Voulez-vous vraiment supprimer ce marque-page?'), [
      { text: t('Non'), style: 'cancel' },
      {
        text: t('Oui'),
        style: 'destructive',
        onPress: () => {
          dispatch(removeBookmark(existingBookmark.id))
          Snackbar.show(t('Marque-page supprimé'))
          handleClose()
        },
      },
    ])
  }

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={handleClose}
      topInset={insets.top}
      enableDynamicSizing
      headerComponent={<ModalHeader onClose={handleClose} title={reference} />}
      footerComponent={props =>
        mode === 'select' ? null : (
          <BottomSheetFooter {...props}>
            <HStack
              py={10}
              px={20}
              justifyContent="flex-end"
              paddingBottom={insets.bottom}
              gap={10}
              bg="reverse"
            >
              {isEditing && (
                <Box>
                  <Button reverse onPress={handleDelete}>
                    {t('Supprimer')}
                  </Button>
                </Box>
              )}
              <Box>
                <Button onPress={handleSave}>{t('Sauvegarder')}</Button>
              </Box>
            </HStack>
          </BottomSheetFooter>
        )
      }
    >
      <Box paddingHorizontal={20} paddingTop={20}>
        {mode === 'select' ? (
          // Selection mode - show list of existing bookmarks
          <Box>
            <Text bold marginBottom={10}>
              {t('Déplacer un marque-page existant')}
            </Text>
            {existingBookmarks.map(bm => (
              <BookmarkListItem key={bm.id} onPress={() => handleSelectExistingBookmark(bm)}>
                <IonIcon name="bookmark" size={18} color={bm.color} />
                <Box flex ml={10}>
                  <Text bold numberOfLines={1}>
                    {bm.name}
                  </Text>
                  <Text fontSize={12} color="grey">
                    {formatReference(bm.book, bm.chapter, bm.verse)}
                  </Text>
                </Box>
              </BookmarkListItem>
            ))}

            <Box marginTop={10}>
              <Button
                onPress={() => {
                  setMode('create')
                  setName('')
                  setSelectedColor(BOOKMARK_COLORS[0])
                }}
              >
                {t('Créer un nouveau marque-page')}
              </Button>
            </Box>

            <Box marginTop={10}>
              <Text fontSize={12} color="grey" textAlign="center">
                {t('Marque-pages')}: {bookmarksCount}/{MAX_BOOKMARKS}
              </Text>
            </Box>
          </Box>
        ) : (
          // Create/Edit mode - show the form
          <Box gap={10}>
            <StyledTextInput
              placeholder={getDefaultBookmarkName()}
              onChangeText={setName}
              value={name}
            />

            <Box py={10}>
              {LIGHTEN_LEVELS.map(level => (
                <Box key={level} row marginBottom={10} py={2} gap={10}>
                  {BOOKMARK_COLORS.map(baseColor => {
                    const color = Color(baseColor).lighten(Number(level)).string()
                    const isSelected = selectedColor === color
                    return (
                      <Box
                        key={color}
                        style={{
                          boxShadow: isSelected ? '0 0 0 2px #333' : 'none',
                          borderRadius: 8,
                        }}
                      >
                        <TouchableCircle
                          color={color}
                          size={20}
                          onPress={() => setSelectedColor(color)}
                        />
                      </Box>
                    )
                  })}
                </Box>
              ))}
            </Box>

            {!isEditing && (
              <Box marginTop={20}>
                <Text fontSize={12} color="grey">
                  {t('Marque-pages')}: {bookmarksCount}/{MAX_BOOKMARKS}
                </Text>
              </Box>
            )}
          </Box>
        )}
      </Box>
    </Modal.Body>
  )
}

export default BookmarkModal
