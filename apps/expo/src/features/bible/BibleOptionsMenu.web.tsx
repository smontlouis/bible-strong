import { useBibleBookmarkScreens } from '~features/bookmarks/useBibleBookmarkScreens'
import ColorPickerModal from '~common/ColorPickerModal'
import BibleShareOptionsScreen from '~features/settings/BibleShareOptionsScreen'
import type { ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'
import { MenuView } from '~common/ui/MenuView'
import ContextualPanel from '~common/ContextualPanel'
import PanelAction from '~common/ContextualPanel/PanelAction'
import BibleParamsModal from './BibleParamsModal'
import BibleFontList from './BibleFontList'
import PassageExportSheet from './passageExport/PassageExportSheet'
import type { VersionCode } from '~state/tabs'
type Props = ComponentProps<typeof MenuView> & {
  bookNumber: number
  chapter: number
  version: string
}
export default function BibleOptionsMenu({
  bookNumber,
  chapter,
  version,
  actions,
  onPressAction,
  children,
  accessibilityLabel,
}: Props) {
  const { t } = useTranslation()
  const bookmarkPanel = useBibleBookmarkScreens(bookNumber, chapter, version)
  const icons = {
    params: 'type',
    parallel: 'columns',
    history: 'clock',
    bookmark: 'bookmark',
    export: 'share',
    'open-tab': 'external-link',
  } as const
  return (
    <ContextualPanel
      width={430}
      accessibilityLabel={accessibilityLabel || t('accessibility.bibleOptions')}
      trigger={children}
      initialScreen="actions"
      screens={{
        ...bookmarkPanel.screens,
        actions: {
          width: 340,
          title: t('accessibility.bibleOptions'),
          content: nav => (
            <>
              {actions
                ?.filter(action => !action.attributes?.hidden)
                .map(action => (
                  <PanelAction
                    key={action.id}
                    label={action.title}
                    icon={icons[action.id as keyof typeof icons]}
                    nested={
                      action.id === 'params' || action.id === 'export' || action.id === 'bookmark'
                    }
                    onPress={() => {
                      if (action.id === 'bookmark') {
                        bookmarkPanel.prepare()
                        nav.open('bookmark')
                      } else if (action.id === 'params' || action.id === 'export')
                        nav.open(action.id)
                      else {
                        nav.close()
                        onPressAction?.({ nativeEvent: { event: action.id } } as Parameters<
                          NonNullable<Props['onPressAction']>
                        >[0])
                      }
                    }}
                  />
                ))}
            </>
          ),
        },
        params: {
          title: t('Police et paramêtres'),
          content: nav => (
            <BibleParamsModal
              inline
              onClose={nav.close}
              onFonts={() => nav.open('fonts')}
              onPalette={() => nav.open('palette')}
              onShareOptions={() => nav.open('share-options')}
            />
          ),
        },
        fonts: {
          title: t('Polices'),
          content: nav => <BibleFontList onSelect={nav.back} />,
        },
        palette: { title: t('Palette de couleurs'), content: () => <ColorPickerModal inline /> },
        'share-options': {
          title: t('bible.settings.shareOptions'),
          content: () => <BibleShareOptionsScreen inline />,
        },
        export: {
          title: t('passageExport.title'),
          content: () => (
            <PassageExportSheet
              inline
              sourceType="chapter"
              bookNumber={bookNumber}
              chapterNumber={chapter}
              version={version as VersionCode}
            />
          ),
        },
      }}
    />
  )
}
