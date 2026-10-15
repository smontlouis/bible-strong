// Kept apart from WorldWorkshop.tsx so a world can switch its editors without pulling the
// workshop's panels into the production bundle.
import { ambientKinds, type AmbientEditorModel } from '../ambient-zones'
import type { ShoreEditorModel } from '../shorelines'

/**
 * Switching tabs tells the shared editors whether they are live, so the scene shows their
 * handles and the ambient editor selects and frames the first zone of the chosen kind.
 */
export function selectEditors(mode: string | null, shoreEditor: ShoreEditorModel, ambientEditor: AmbientEditorModel) {
  shoreEditor.editing = mode === 'shorelines'
  shoreEditor.paused = false
  const kind = ambientKinds.find(k => k === mode)
  ambientEditor.editing = Boolean(kind)
  if (kind) {
    ambientEditor.kind = kind
    if (!ambientEditor.zones.some(z => z.id === ambientEditor.selected && z.kind === kind))
      ambientEditor.selected = ambientEditor.zones.find(z => z.kind === kind)?.id ?? ''
    ambientEditor.focus++
    ambientEditor.mode = 'select'
  }
  ambientEditor.notify()
}
