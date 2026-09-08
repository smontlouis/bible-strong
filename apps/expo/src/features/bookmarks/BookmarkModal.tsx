import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { Alert } from 'react-native'
import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import { useDispatch, useSelector } from 'react-redux'
import type { ColorFormatsObject } from 'reanimated-color-picker'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { SheetFooter, SheetHeader, SheetTextInput, SheetView, type SheetRef } from '~common/sheet'
import Sheet from '~common/ContextualPanel/ContextualSheet'
import generateUUID from '~helpers/generateUUID'
import type { Theme as AppTheme } from '~themes'
import { useTheme as useAppTheme } from '~themes/ThemeProvider'

import books from '~assets/bible_versions/books-desc'
import ColorPicker from '~common/ColorPicker'
import type { Bookmark } from '~common/types'
import Box from '~common/ui/Box'
import Button from '~common/ui/Button'
import { IonIcon } from '~common/ui/Icon'
import { HStack } from '~common/ui/Stack'
import Text from '~common/ui/Text'
import { toast } from '~helpers/toast'
import {
  addBookmark,
  MAX_BOOKMARKS,
  moveBookmark,
  removeBookmark,
  updateBookmark,
} from '~redux/modules/user'
import { selectBookmarksCount, selectSortedBookmarks } from '~redux/selectors/bookmarks'

const DEFAULT_BOOKMARK_COLOR = '#cc0000'

const BookmarkListItem = (
  componentProps: Omit<
    UIComponentProps<typeof NativeUI.TouchableOpacity>,
    keyof { isSelected?: boolean } | 'theme'
  > &
    Omit<{ isSelected?: boolean }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme
  const { isSelected } = props
  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[12px] mb-[8px] rounded-[8px] border-primary', className)
  )
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [
          classStyles,
          {
            backgroundColor: isSelected ? theme.colors.lightPrimary : theme.colors.lightGrey,
            borderWidth: isSelected ? 2 : 0,
          },
          props.style,
        ] as UIComponentProps<typeof NativeUI.TouchableOpacity>['style']
      }
    />
  )
}

const StyledTextInput = (
  componentProps: Omit<UIComponentProps<typeof SheetTextInput>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const contextTheme = useAppTheme()
  const { theme: themeOverride, className, ...props } = componentProps
  const theme = themeOverride ?? contextTheme

  const classStyles = useResolveClassNames(
    twMerge(
      'text-default h-[48px] border-border border-[2px] rounded-[10px] px-[15px] text-[16px]',
      className
    )
  )
  return (
    <SheetTextInput
      {...props}
      style={
        [
          classStyles,
          { placeholderTextColor: theme.colors.border },
          props.style,
        ] as UIComponentProps<typeof SheetTextInput>['style']
      }
    />
  )
}

interface BookmarkModalProps {
  sheetRef: React.RefObject<SheetRef | null>
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
  const bookData = books.find(b => b.Numero === bookNumber)
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
  sheetRef,
  onClose,
  book,
  chapter,
  verse,
  version,
  existingBookmark,
}: BookmarkModalProps) => {
  const dispatch = useDispatch()
  const confirm = useConfirmDialog()
  const { t } = useTranslation()

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

  const handlePresent = () => {
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

  const handleClose = () => {
    sheetRef.current?.dismiss()
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

  const handleDelete = async () => {
    if (!existingBookmark) return
    if (NativeUI.Platform.OS === 'web') handleClose()
    if (
      await confirm({
        title: t('Attention'),
        message: t('Voulez-vous vraiment supprimer ce marque-page?'),
        cancelLabel: t('Non'),
        confirmLabel: t('Oui'),
        destructive: true,
      })
    ) {
      dispatch(removeBookmark(existingBookmark.id))
      toast(t('Marque-page supprimé'))
      handleClose()
    }
  }

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      onPresent={handlePresent}
      header={<SheetHeader title={t('Marque-page')} subTitle={reference} />}
      footer={props =>
        mode === 'select' ? null : (
          <SheetFooter
            {...props}
            className={twMerge('justify-end gap-[10px] flex-row', props.className)}
          >
            {isEditing && (
              <Box className="overflow-hidden border-continuous">
                <Button reverse onPress={handleDelete}>
                  {t('Supprimer')}
                </Button>
              </Box>
            )}
            <Box className="overflow-hidden border-continuous">
              <Button onPress={handleSave}>{t('Sauvegarder')}</Button>
            </Box>
          </SheetFooter>
        )
      }
    >
      <SheetView className="pt-[20px] px-[20px]">
        {mode === 'select' ? (
          // Selection mode - show list of existing bookmarks
          <Box className="overflow-hidden border-continuous">
            <Text className="font-bold mb-[10px]">{t('Déplacer un marque-page existant')}</Text>
            {existingBookmarks.map(bm => (
              <BookmarkListItem key={bm.id} onPress={() => handleSelectExistingBookmark(bm)}>
                <IonIcon name="bookmark" size={18} color={bm.color} />
                <Box className="overflow-hidden border-continuous flex-[1] ml-[10px]">
                  <Text className="font-bold" numberOfLines={1}>
                    {bm.name}
                  </Text>
                  <Text className="text-[12px] text-grey">
                    {formatReference(bm.book, bm.chapter, bm.verse)}
                  </Text>
                </Box>
              </BookmarkListItem>
            ))}

            <Box className="overflow-hidden border-continuous mt-[10px]">
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

            <Box className="overflow-hidden border-continuous mt-[10px]">
              <Text className="text-[12px] text-grey text-center">
                {t('Marque-pages')}: {bookmarksCount}/{MAX_BOOKMARKS}
              </Text>
            </Box>
          </Box>
        ) : (
          // Create/Edit mode - show the form
          <Box className="overflow-hidden border-continuous gap-[10px]">
            <HStack className="items-center">
              <IonIcon name="bookmark" size={24} color={selectedColor} />
              <StyledTextInput
                placeholder={getDefaultBookmarkName()}
                onChangeText={setName}
                value={name}
                style={{ flex: 1 }}
              />
            </HStack>
            <Box className="overflow-hidden border-continuous h-[200px]">
              <ColorPicker
                value={selectedColor}
                onChangeJS={(color: ColorFormatsObject) => setSelectedColor(color.hex)}
              />
            </Box>

            {!isEditing && (
              <Box className="overflow-hidden border-continuous mt-[20px]">
                <Text className="text-[12px] text-grey">
                  {t('Marque-pages')}: {bookmarksCount}/{MAX_BOOKMARKS}
                </Text>
              </Box>
            )}
          </Box>
        )}
      </SheetView>
    </Sheet>
  )
}

export default BookmarkModal
