import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import React from 'react'
import { useTranslation } from 'react-i18next'
import * as NativeUI from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { Sheet, SheetHeader, type SheetRef } from '~common/sheet'
import Box, { HStack } from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import { Chip } from '~common/ui/NewChip'
import Text from '~common/ui/Text'
import { getBook } from '~helpers/bibleBookCatalog'
import { usePushRouteOnce } from '~navigation/usePushRouteOnce'
import type { CrossVersionAnnotation } from '~redux/selectors/bible'
import { VersionCode } from '~state/tabs'
import type { Theme as AppTheme } from '~themes'

const ItemRow = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge('flex-row items-center p-[15px] border-b-[1px] border-b-border', className)
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

const ItemButton = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.TouchableOpacity>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(twMerge('flex-[1] flex-row items-center', className))
  return (
    <NativeUI.TouchableOpacity
      {...props}
      style={
        [classStyles, {}, props.style] as UIComponentProps<
          typeof NativeUI.TouchableOpacity
        >['style']
      }
    />
  )
}

const IconContainer = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, 'theme'> & {
    theme?: AppTheme
    className?: string
  }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const classStyles = useResolveClassNames(
    twMerge(
      'w-[36px] h-[36px] rounded-[12px] bg-light-grey items-center justify-center mr-[12px]',
      className
    )
  )
  return (
    <NativeUI.View
      {...props}
      style={[classStyles, {}, props.style] as UIComponentProps<typeof NativeUI.View>['style']}
    />
  )
}

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
      backdrop={false}
      onDismiss={onClose}
      header={
        <SheetHeader title={t('bible.crossVersionAnnotations.subtitle')} subTitle={reference} />
      }
    >
      {versions.map(versionData => (
        <ItemRow key={versionData.version}>
          <ItemButton activeOpacity={0.7} onPress={() => handleOpenBibleView(versionData.version)}>
            <IconContainer>
              <FeatherIcon name="edit-3" size={18} color="secondary" />
            </IconContainer>
            <Box className="overflow-hidden border-continuous flex-[1]">
              <HStack className="overflow-hidden border-continuous gap-[10px] items-center">
                <Text className="text-[14px] font-semibold">
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
            <Box className="overflow-hidden border-continuous items-center justify-center w-[40px] h-[40px] ml-[8px]">
              <FeatherIcon name="more-vertical" size={18} color="tertiary" />
            </Box>
          </MenuView>
        </ItemRow>
      ))}
    </Sheet>
  )
}

export default CrossVersionAnnotationsModal
