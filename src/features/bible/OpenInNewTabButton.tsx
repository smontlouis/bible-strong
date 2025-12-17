import { useTranslation } from 'react-i18next'
import { getDefaultBibleTab, VersionCode } from 'src/state/tabs'
import { Book } from '~assets/bible_versions/books-desc'
import Button from '~common/ui/Button'
import { useOpenInNewTab } from '~features/app-switcher/utils/useOpenInNewTab'

interface OpenInNewTabButtonProps {
  book: Book
  chapter: number
  verse: number
  version: VersionCode
}

export const OpenInNewTabButton = ({ book, chapter, verse, version }: OpenInNewTabButtonProps) => {
  const { t } = useTranslation()
  const openInNewTab = useOpenInNewTab()

  const openInBibleTab = () => {
    openInNewTab({
      id: `bible-${Date.now()}`,
      title: t('tabs.new'),
      isRemovable: true,
      type: 'bible',
      data: {
        ...getDefaultBibleTab().data,
        selectedBook: book,
        selectedChapter: chapter,
        selectedVerse: verse,
        selectedVersion: version,
      },
    })
  }
  return (
    <Button
      onPress={openInBibleTab}
      style={{
        marginTop: 5,
        marginBottom: 5,
        width: 270,
      }}
    >
      {t('tab.openInNewTab')}
    </Button>
  )
}
