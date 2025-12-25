import styled from '@emotion/native'
import { BottomSheetFooter, BottomSheetModal, BottomSheetTextInput } from '@gorhom/bottom-sheet/'
import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useDispatch, useSelector } from 'react-redux'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import generateUUID from '~helpers/generateUUID'

import books from '~assets/bible_versions/books-desc'
import ColorPicker from '~common/ColorPicker'
import Modal from '~common/Modal'
import ModalHeader from '~common/ModalHeader'
import { toast } from 'sonner-native'
import type { Bookmark } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { IonIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import {
  addBookmark,
  MAX_BOOKMARKS,
  moveBookmark,
  removeBookmark,
  updateBookmark,
} from '~redux/modules/user'
import { selectBookmarksCount, selectSortedBookmarks } from '~redux/selectors/bookmarks'

const DEFAULT_BOOKMARK_COLOR = '#cc0000'

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
  placeholderTextColor: theme.colors.border,
}))

interface BookmarkModalProps {
  bottomSheetRef: React.RefObject<BottomSheetModal | null>
  onClose?: () => void
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

const formatReference = (book: number, chapter: number, verse?: number): string => {
  const bookName = getBookName(book)
  if (verse === undefined) {
    return `${bookName} ${chapter}`
  }
  return `${bookName} ${chapter}:${verse}`
}

const BookmarkModal = ({
  bottomSheetRef,
  onClose,
  book,
  chapter,
  verse,
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
  const [selectedColor, setSelectedColor] = useState(DEFAULT_BOOKMARK_COLOR)

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
      setSelectedColor(DEFAULT_BOOKMARK_COLOR)
    } else {
      setMode('create')
      setName('')
      setSelectedColor(DEFAULT_BOOKMARK_COLOR)
    }
  }, [existingBookmark, existingBookmarks.length])

  // Handle sheet index change - reset state when modal opens
  const handleSheetChange = useCallback(
    (index: number) => {
      // index = -1 means closed, >= 0 means open
      if (index >= 0) {
        // Modal is opening - reset state based on existingBookmark
        if (existingBookmark) {
          setMode('edit')
          setName(existingBookmark.name)
          setSelectedColor(existingBookmark.color)
        } else if (existingBookmarks.length > 0) {
          setMode('select')
          setName('')
          setSelectedColor(DEFAULT_BOOKMARK_COLOR)
        } else {
          setMode('create')
          setName('')
          setSelectedColor(DEFAULT_BOOKMARK_COLOR)
        }
      }
    },
    [existingBookmark, existingBookmarks.length]
  )

  const handleClose = () => {
    bottomSheetRef.current?.dismiss()
    onClose?.()
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
      toast(t('Marque-page modifié'))
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
        ...(verse !== undefined && { verse }),
        date: Date.now(),
        version,
      }

      dispatch(addBookmark(newBookmark))
      toast(t('Marque-page créé'))
    }

    handleClose()
  }

  const handleSelectExistingBookmark = (bookmark: Bookmark) => {
    // Move the bookmark immediately to the new location
    dispatch(
      moveBookmark(bookmark.id, {
        book: book!,
        chapter: chapter!,
        ...(verse !== undefined && { verse }),
        version,
      })
    )
    toast(t('Marque-page déplacé'))
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
          toast(t('Marque-page supprimé'))
          handleClose()
        },
      },
    ])
  }

  return (
    <Modal.Body
      ref={bottomSheetRef}
      onModalClose={handleClose}
      onChange={handleSheetChange}
      topInset={insets.top}
      enableDynamicSizing
      headerComponent={<ModalHeader title={`${t('Marque-page')} ${reference}`} />}
      footerComponent={props =>
        mode === 'select' ? null : (
          <BottomSheetFooter {...props}>
            <HStack
              py={5}
              px={20}
              justifyContent="flex-end"
              paddingBottom={insets.bottom + 5}
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
                  setSelectedColor(DEFAULT_BOOKMARK_COLOR)
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
            <HStack alignItems="center">
              <IonIcon name="bookmark" size={24} color={selectedColor} />
              <StyledTextInput
                placeholder={getDefaultBookmarkName()}
                onChangeText={setName}
                value={name}
                style={{ flex: 1 }}
              />
            </HStack>

            <ColorPicker
              value={selectedColor}
              onChangeJS={(color: ColorFormatsObject) => setSelectedColor(color.hex)}
            />

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
