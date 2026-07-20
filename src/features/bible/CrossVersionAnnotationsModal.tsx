import React from 'react'
import { useTranslation } from 'react-i18next'
import { SheetHeader, type SheetRef } from '~common/sheet'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import styled from '@emotion/native'
import { Sheet } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import { VersionCode } from '~state/tabs'
import { Chip } from '~common/ui/NewChip'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'

const ItemRow = styled.View(({ theme }) => ({
  flexDirection: 'row',
  alignItems: 'center',
  padding: 15,
  borderBottomWidth: 1,
  borderBottomColor: theme.colors.border,
}))

const ItemButton = styled.TouchableOpacity({
  flex: 1,
  flexDirection: 'row',
  alignItems: 'center',
})

const IconContainer = styled.View(({ theme }) => ({
  width: 36,
  height: 36,
  borderRadius: 12,
  backgroundColor: theme.colors.lightGrey,
  alignItems: 'center',
  justifyContent: 'center',
  marginRight: 12,
}))

interface CrossVersionAnnotationsModalProps {
  sheetRef: React.RefObject<SheetRef | null>
  verseKey: string | null
  versions: CrossVersionAnnotation[]
  onSwitchVersion: (version: VersionCode, verse: number) => void
  onOpenInNewTab: (version: VersionCode) => void
  onClose?: () => void
}

const getBookName = (bookNumber: number): string => {
  const book = getBook(bookNumber)
  if (book) return book.Nom
  return `Livre ${bookNumber}`
}

const formatVerseReference = (verseKey: string): string => {
  const parts = verseKey.split('-')
  if (parts.length < 3) return verseKey

  const bookNumber = parseInt(parts[0], 10)
  const chapter = parts[1]
  const verse = parts[2]
  const bookName = getBookName(bookNumber)

  return `${bookName} ${chapter}:${verse}`
}

const CrossVersionAnnotationsModal = ({
  sheetRef,
  verseKey,
  versions,
  onSwitchVersion,
  onOpenInNewTab,
  onClose,
}: CrossVersionAnnotationsModalProps) => {
  const { t } = useTranslation()
  const pushRouteOnce = usePushRouteOnce()

  const handleSwitchVersion = (version: VersionCode) => {
    // Extract verse number from verseKey (format: "book-chapter-verse")
    const verse = verseKey ? parseInt(verseKey.split('-')[2], 10) : 1
    onSwitchVersion(version, verse)
    sheetRef.current?.dismiss()
  }

  const handleOpenInNewTab = (version: VersionCode) => {
    onOpenInNewTab(version)
    sheetRef.current?.dismiss()
  }

  const handleOpenBibleView = (version: VersionCode) => {
    if (!verseKey) return

    const [bookNumber, chapter, verse] = verseKey.split('-').map(Number)
    if (!bookNumber || !chapter || !verse) return

    pushRouteOnce({
      pathname: '/bible-view',
      params: {
        contextDisplayMode: 'focused',
        book: JSON.stringify(getBook(bookNumber)),
        chapter: String(chapter),
        verse: String(verse),
        version,
        focusVerses: JSON.stringify([verse]),
      },
    })
    sheetRef.current?.dismiss()
  }

  const reference = verseKey ? formatVerseReference(verseKey) : ''
  const menuActions: MenuAction[] = [
    {
      id: 'switch-version',
      title: t('bible.crossVersionAnnotations.switchVersion'),
      image: 'arrow.triangle.2.circlepath',
    },
    {
      id: 'new-tab',
      title: t('bible.crossVersionAnnotations.newTab'),
      image: 'plus.square',
    },
  ]

  return (
    <Sheet
      ref={sheetRef}
      onDismiss={onClose}
      header={
        <SheetHeader title={t('bible.crossVersionAnnotations.subtitle')} subTitle={reference} />
      }
    >
      {versions.map((versionData, index) => (
        <ItemRow key={index}>
          <ItemButton activeOpacity={0.7} onPress={() => handleOpenBibleView(versionData.version)}>
            <IconContainer>
              <FeatherIcon name="edit-3" size={18} color="secondary" />
            </IconContainer>
            <Box flex>
              <HStack gap={10} alignItems="center">
                <Text fontSize={14} fontWeight="600">
                  {t('bible.crossVersionAnnotations.annotationCount', {
                    count: versionData.count,
                  })}
                </Text>
                <Chip>{versionData.version}</Chip>
              </HStack>
            </Box>
          </ItemButton>
          <MenuView
            actions={menuActions}
            onPressAction={({ nativeEvent }) => {
              switch (nativeEvent.event) {
                case 'switch-version':
                  handleSwitchVersion(versionData.version)
                  break
                case 'new-tab':
                  handleOpenInNewTab(versionData.version)
                  break
              }
            }}
          >
            <Box center width={40} height={40} marginLeft={8}>
              <FeatherIcon name="more-vertical" size={18} color="tertiary" />
            </Box>
          </MenuView>
        </ItemRow>
      ))}
    </Sheet>
  )
}

export default CrossVersionAnnotationsModal
