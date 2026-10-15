// The development-only workshop every world shares: a tab bar, the access, shoreline and ambient
// editors, and the small controls world-specific panels are built from. A world passes the tabs
// it adds (Valence: landmarks, water) and the editors it owns; saving goes through the Vite dev
// server (src/workshop/documents.ts). Nothing here ships in production.
import { lazy, Suspense, useState, type ReactNode } from 'react'
import { ambientKinds, type AmbientEditorModel, type AmbientKind } from '../ambient-zones'
import type { Language } from '../language'
import { ShoreEditor } from '../ShoreEditor'
import type { ShoreEditorModel } from '../shorelines'
import type { NavigationDocument } from '../world'
import { AmbientEditorPanel, editorCopy } from '../WorldEditor'
import type { ZoneEditorMap } from '../ZoneEditor'
import '../shore-editor.css'
import '../world-editor.css'
import './workshop.css'

const ZoneEditor = lazy(() => import('../ZoneEditor'))

/** The tabs every world has; a world may add its own before or after them. */
export type CommonMode = 'navigation' | 'shorelines' | AmbientKind
export type WorkshopTab<Mode extends string> = {
  id: Mode
  label: Record<Language, string>
  panel: () => ReactNode
}

const copy = {
  fr: { done: 'Terminer', save: 'Sauvegarder', saved: 'Sauvegardé dans le projet', dirty: 'Modifications à sauvegarder', error: 'Sauvegarde impossible. Vérifie le serveur local et les valeurs.', undo: 'Annuler', loading: 'Chargement…' },
  en: { done: 'Done', save: 'Save', saved: 'Saved to the project', dirty: 'Unsaved changes', error: 'Cannot save. Check the local server and the values.', undo: 'Undo', loading: 'Loading…' },
}

/** Sends a validated project document to the dev server, which writes it under public/. */
export async function saveDocument(endpoint: string, document: unknown) {
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: `${JSON.stringify(document, null, 2)}\n`,
  })
  if (!response.ok) throw new Error(`Save ${endpoint}: ${response.status}`)
}

/** The access, shoreline and ambient tabs, built for one world. */
export function commonTabs({
  language,
  map,
  navigation,
  savedFingerprint,
  onDraft,
  onNavigation,
  onTest,
  shoreEditor,
  ambientEditor,
  onZoom,
  onClose,
}: {
  language: Language
  /** Omitted for the archipelago, the zone editor's default map. */
  map?: ZoneEditorMap
  navigation: NavigationDocument
  savedFingerprint?: string
  onDraft?: (document: NavigationDocument) => void
  onNavigation: (document: NavigationDocument) => void
  onTest: (document: NavigationDocument) => void
  shoreEditor: ShoreEditorModel
  ambientEditor: AmbientEditorModel
  onZoom: (factor: number) => void
  onClose: () => void
}): WorkshopTab<CommonMode>[] {
  const label = (key: CommonMode) => ({ fr: editorCopy.fr[key], en: editorCopy.en[key] })
  return [
    {
      id: 'navigation',
      label: label('navigation'),
      panel: () => (
        <Suspense fallback={<div className="zone-editor">{copy[language].loading}</div>}>
          <ZoneEditor
            map={map}
            initial={navigation}
            initialSavedFingerprint={savedFingerprint}
            onDraft={onDraft}
            language={language}
            onSave={onNavigation}
            onTest={onTest}
          />
        </Suspense>
      ),
    },
    {
      id: 'shorelines',
      label: label('shorelines'),
      panel: () => <ShoreEditor model={shoreEditor} language={language} onZoom={onZoom} onClose={onClose} />,
    },
    ...ambientKinds.map(
      (kind): WorkshopTab<CommonMode> => ({
        id: kind,
        label: label(kind),
        panel: () => <AmbientEditorPanel model={ambientEditor} language={language} onZoom={onZoom} />,
      })
    ),
  ]
}

/** The tab bar and the active tab's panel. */
export function WorldWorkshop<Mode extends string>({
  title,
  tabs,
  mode,
  onMode,
  language,
}: {
  title: Record<Language, string>
  tabs: WorkshopTab<Mode>[]
  mode: Mode
  onMode: (mode: Mode | null) => void
  language: Language
}) {
  const active = tabs.find(tab => tab.id === mode)
  return (
    <>
      <nav className="world-editor-navigation" aria-label={title[language]}>
        <strong>{title[language]}</strong>
        <div className="world-editor-tabs">
          {tabs.map(tab => (
            <button key={tab.id} type="button" aria-pressed={mode === tab.id} onClick={() => onMode(tab.id)}>
              {tab.label[language]}
            </button>
          ))}
        </div>
        <button type="button" className="editor-done" onClick={() => onMode(null)}>
          {copy[language].done} ↗
        </button>
      </nav>
      {active?.panel()}
    </>
  )
}

/** Status, undo and save for a panel that edits one project document. */
export function SaveBar({
  language,
  dirty,
  canUndo,
  onUndo,
  onSave,
}: {
  language: Language
  dirty: boolean
  canUndo: boolean
  onUndo: () => void
  onSave: () => Promise<void>
}) {
  const t = copy[language]
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  return (
    <div className="editor-save-bar">
      <small role="status">
        {status === 'error' ? t.error : status === 'saving' ? '…' : dirty ? t.dirty : status === 'saved' ? t.saved : ''}
      </small>
      <div className="workshop-row">
        <button type="button" disabled={!canUndo} onClick={onUndo}>
          {t.undo}
        </button>
        <button
          type="button"
          disabled={status === 'saving'}
          onClick={async () => {
            setStatus('saving')
            try {
              await onSave()
              setStatus('saved')
            } catch {
              setStatus('error')
            }
          }}
        >
          {t.save}
        </button>
      </div>
    </div>
  )
}

/** A labelled range input that checkpoints history when a drag starts. */
export function Slider({
  label,
  value,
  min,
  max,
  step,
  onStart,
  onChange,
}: {
  label: string
  value: number
  min: number
  max: number
  step: number
  onStart: () => void
  onChange: (value: number) => void
}) {
  return (
    <label className="workshop-slider">
      <span>
        {label} <output>{Math.round(value * 100) / 100}</output>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onPointerDown={onStart}
        onKeyDown={onStart}
        onChange={e => onChange(e.target.valueAsNumber)}
      />
    </label>
  )
}
