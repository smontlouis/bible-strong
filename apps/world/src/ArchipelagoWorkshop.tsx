// The archipelago's workshop: the shared tabs of every world. Development only.
import type { AmbientEditorModel } from './ambient-zones'
import type { Language } from './language'
import type { ShoreEditorModel } from './shorelines'
import type { NavigationDocument } from './world'
import { editorCopy, type EditorMode } from './WorldEditor'
import { commonTabs, WorldWorkshop } from './workshop/WorldWorkshop'

export default function ArchipelagoWorkshop({
  mode,
  onMode,
  language,
  navigation,
  savedFingerprint,
  onDraft,
  onNavigation,
  onTest,
  shoreEditor,
  ambientEditor,
  onZoom,
}: {
  mode: EditorMode
  onMode: (mode: EditorMode | null) => void
  language: Language
  navigation: NavigationDocument
  savedFingerprint: string
  onDraft: (document: NavigationDocument) => void
  onNavigation: (document: NavigationDocument) => void
  onTest: (document: NavigationDocument) => void
  shoreEditor: ShoreEditorModel
  ambientEditor: AmbientEditorModel
  onZoom: (factor: number) => void
}) {
  const tabs = commonTabs({
    language,
    navigation,
    savedFingerprint,
    onDraft,
    onNavigation,
    onTest,
    shoreEditor,
    ambientEditor,
    onZoom,
    onClose: () => onMode(null),
  })
  return (
    <WorldWorkshop
      title={{ fr: editorCopy.fr.title, en: editorCopy.en.title }}
      tabs={tabs}
      mode={mode}
      onMode={onMode}
      language={language}
    />
  )
}
