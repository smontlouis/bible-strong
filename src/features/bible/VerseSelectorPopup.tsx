import { MenuView, type MenuAction } from '@expo/ui/community/menu'
import { useAtomValue } from 'jotai/react'
import { PrimitiveAtom } from 'jotai/vanilla'
import { useTranslation } from 'react-i18next'
import { BibleTab, useBibleTabActions } from 'src/state/tabs'
import loadBibleChapter from '~helpers/loadBibleChapter'
import { useQuery } from '~helpers/react-query-lite'

type VerseSelectorPopupProps = {
  bibleAtom: PrimitiveAtom<BibleTab>
  children: React.ReactNode
}

export const VerseSelectorPopup = ({ bibleAtom, children }: VerseSelectorPopupProps) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const actions = useBibleTabActions(bibleAtom)

  const {
    data: { selectedVersion: version, selectedBook: book, selectedChapter: chapter },
  } = bible

  const { data: verses } = useQuery({
    queryKey: ['bible', version, book.Numero.toString(), chapter.toString()],
    queryFn: () => loadBibleChapter(book.Numero, chapter, version),
  })

  const menuActions: MenuAction[] =
    verses?.data && verses.data.length
      ? verses.data.map(verse => ({
          id: String(verse.Verset),
          title: String(verse.Verset),
        }))
      : [
          {
            id: 'loading',
            title: t('Chargement...'),
            attributes: { disabled: true },
          },
        ]

  return (
    <MenuView
      title={t('goToVerse')}
      actions={menuActions}
      onPressAction={({ nativeEvent }) => {
        if (nativeEvent.event !== 'loading') {
          actions.setSelectedVerse(Number(nativeEvent.event))
        }
      }}
    >
      {children}
    </MenuView>
  )
}
