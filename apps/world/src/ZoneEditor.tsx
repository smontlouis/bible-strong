import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import '@geoman-io/leaflet-geoman-free'
import 'leaflet/dist/leaflet.css'
import '@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css'
import { WIDTH, HEIGHT, SPAWN, findSafePosition, type NavigationDocument, type Zone } from './world'
import {
  parseNavigation,
  upgradeNavigation,
  polygonIsValid,
  saveNavigation,
  serializeNavigation,
  navigationFingerprint,
} from './navigation-document'
import './editor.css'

const messages = {
  fr: {
    title: 'Éditer les zones',
    allowed: 'Autorisée',
    blocked: 'Interdite',
    addAllowed: '+ Zone verte',
    addBlocked: '+ Obstacle rouge',
    test: 'Tester au joystick',
    save: 'Sauvegarder',
    export: 'Exporter JSON',
    import: 'Importer JSON',
    undo: 'Annuler',
    redo: 'Rétablir',
    fit: 'Toute la carte',
    cancel: 'Arrêter le dessin',
    select: 'Sélectionne une zone sur la carte ou dans la liste.',
    vertices:
      'Déplace les poignées. Les petites poignées ajoutent un sommet. Clic droit sur un sommet pour le retirer.',
    draw: 'Place les sommets, puis touche le premier point pour fermer. Entrée termine aussi le dessin.',
    name: 'Nom de la zone',
    kind: 'Type',
    remove: 'Supprimer la zone',
    drag: 'Déplacer la zone entière',
    edit: 'Modifier les sommets',
    invalid: 'Zone invalide : évite les croisements et reste dans la carte.',
    invalidFile: 'Fichier incompatible ou zones invalides. Le brouillon actuel est conservé.',
    saveFailed: 'Sauvegarde du projet impossible. Vérifie que le serveur local est lancé.',
    saved: 'Sauvegardé dans le projet.',
    changed: 'Modifications non sauvegardées',
    restored: 'Fichier du projet chargé',
    unsaved: 'Brouillon de travail',
    precedence: 'Le rouge bloque le passage, même sur du vert.',
    noSpace:
      'Aucun emplacement assez large pour le blob. Ajuste les zones avant de tester ou sauvegarder.',
    zones: 'Zones',
    local: 'Sauvegarde directe dans le projet · export JSON optionnel',
    importLabel: 'Choisir un fichier de zones',
    tooMany: 'Limite de 150 zones atteinte.',
    nameHint: '100 caractères maximum',
  },
  en: {
    title: 'Edit zones',
    allowed: 'Allowed',
    blocked: 'Blocked',
    addAllowed: '+ Green zone',
    addBlocked: '+ Red obstacle',
    test: 'Test with joystick',
    save: 'Save',
    export: 'Export JSON',
    import: 'Import JSON',
    undo: 'Undo',
    redo: 'Redo',
    fit: 'Whole map',
    cancel: 'Stop drawing',
    select: 'Select a zone on the map or in the list.',
    vertices: 'Drag handles. Small handles add a vertex. Right-click a vertex to remove it.',
    draw: 'Place vertices, then tap the first point to close. Enter also finishes drawing.',
    name: 'Zone name',
    kind: 'Type',
    remove: 'Delete zone',
    drag: 'Move whole zone',
    edit: 'Edit vertices',
    invalid: 'Invalid zone: avoid crossings and stay inside the map.',
    invalidFile: 'Incompatible file or invalid zones. Your current draft was kept.',
    saveFailed: 'Cannot save the project. Check that the local server is running.',
    saved: 'Saved to the project.',
    changed: 'Unsaved changes',
    restored: 'Project file loaded',
    unsaved: 'Working draft',
    precedence: 'Red blocks movement, even over green.',
    noSpace: 'No space is wide enough for the blob. Adjust zones before testing or saving.',
    zones: 'Zones',
    local: 'Saved directly to the project · JSON export is optional',
    importLabel: 'Choose a zones file',
    tooMany: 'Maximum of 150 zones reached.',
    nameHint: '100 characters maximum',
  },
}

type EditorApi = {
  select: (id: string, focus?: boolean) => void
  rebuild: (doc: NavigationDocument) => void
  draw: (kind: Zone['kind']) => void
  stop: () => void
  drag: (enabled: boolean) => void
  fit: () => void
}
type Props = {
  initialSavedFingerprint?: string
  onDraft?: (doc: NavigationDocument) => void
  initial: NavigationDocument
  language: keyof typeof messages
  onTest: (doc: NavigationDocument) => void
  onSave: (doc: NavigationDocument) => void
}
const toLatLngs = (zone: Zone) => zone.points.map(([x, y]) => L.latLng(-y, x))
const paneFor = (kind: Zone['kind']) => (kind === 'blocked' ? 'blocked-zones' : 'allowed-zones')
const style = (kind: Zone['kind'], selected: boolean): L.PathOptions => ({
  pane: paneFor(kind),
  color: kind === 'allowed' ? '#087b54' : '#d82a48',
  fillColor: kind === 'allowed' ? '#4ce8aa' : '#fb4c65',
  fillOpacity: selected ? 0.38 : 0.18,
  weight: selected ? 3 : 1.5,
})

export default function ZoneEditor({ initial, initialSavedFingerprint, onDraft, language, onTest, onSave }: Props) {
  const element = useRef<HTMLDivElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const api = useRef<EditorApi | null>(null)
  const [editorState] = useState(() => ({
    draft: structuredClone(initial),
    history: [] as NavigationDocument[],
    future: [] as NavigationDocument[],
    saved: initialSavedFingerprint ?? navigationFingerprint(initial),
    mapLanguage: language,
  }))
  const draft = useRef(editorState.draft)
  const history = useRef(editorState.history)
  const future = useRef(editorState.future)
  const saved = useRef(editorState.saved)
  const [doc, setDoc] = useState(editorState.draft)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drawing, setDrawing] = useState<Zone['kind'] | null>(null)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<keyof typeof messages.fr>('unsaved')
  const [error, setError] = useState(false)
  const t = messages[language]
  const text = useRef(t)
  const selected = doc.zones.find(z => z.id === selectedId)
  const changed = navigationFingerprint(doc) !== saved.current
  useEffect(() => { onDraft?.(doc) }, [doc, onDraft])

  const [commit] = useState(
    () => (next: NavigationDocument) => {
      if (navigationFingerprint(next) === navigationFingerprint(draft.current)) return
      history.current.push(structuredClone(draft.current))
      if (history.current.length > 80) history.current.shift()
      future.current = []
      draft.current = next
      setDoc(next)
      setStatus('changed')
      setError(false)
    }
  )

  useEffect(() => {
    text.current = t
  }, [t])

  useEffect(() => {
    const map = L.map(element.current!, {
      crs: L.CRS.Simple,
      minZoom: -3,
      maxZoom: 3,
      zoomSnap: 0.25,
      doubleClickZoom: false,
      attributionControl: false,
    })
    const bounds: L.LatLngBoundsExpression = [
      [-HEIGHT, 0],
      [0, WIDTH],
    ]
    L.imageOverlay('./assets/map/preview.webp', bounds, {
      interactive: false,
      pmIgnore: true,
    }).addTo(map)
    // Keep red obstacles in their own pane so they remain above green areas
    // even when the zones overlap or the green zone was edited later.
    const allowedPane = map.createPane('allowed-zones')
    allowedPane.style.zIndex = '410'
    const blockedPane = map.createPane('blocked-zones')
    blockedPane.style.zIndex = '420'
    map.fitBounds(bounds, { padding: [18, 18] })
    map.setMaxBounds(L.latLngBounds(bounds).pad(0.3))
    map.pm.setLang(editorState.mapLanguage)
    const layers = new Map<string, L.Polygon>()
    let current: string | null = null
    let drawKind: Zone['kind'] = 'allowed'
    let rebuilding = false

    function select(id: string, focus = false) {
      map.pm.disableDraw()
      current = id
      setSelectedId(id)
      setDrawing(null)
      setDragging(false)
      layers.forEach((layer, key) => {
        layer.pm.disable()
        layer.pm.disableLayerDrag()
        const zone = draft.current.zones.find(z => z.id === key)!
        layer.setStyle(style(zone.kind, key === id))
      })
      const layer = layers.get(id)
      if (focus && layer) map.fitBounds(layer.getBounds(), { padding: [45, 45], maxZoom: 1.5 })
      layer?.bringToFront()
      layer?.pm.enable({
        allowSelfIntersection: false,
        snappable: false,
        removeLayerBelowMinVertexCount: false,
      })
    }
    function readPoints(layer: L.Polygon) {
      const ring = layer.getLatLngs()[0] as L.LatLng[]
      return ring.map(p => [Number(p.lng.toFixed(2)), Number((-p.lat).toFixed(2))] as const)
    }
    function readEdit(id: string, layer: L.Polygon) {
      if (rebuilding) return
      const old = draft.current.zones.find(z => z.id === id)
      if (!old) return
      const points = readPoints(layer)
      if (!polygonIsValid(points)) {
        layer.setLatLngs(toLatLngs(old))
        if (current === id) select(id)
        setStatus('invalid')
        setError(true)
        return
      }
      commit({
        ...draft.current,
        zones: draft.current.zones.map(z => (z.id === id ? { ...z, points } : z)),
      })
    }
    function attach(zone: Zone, layer?: L.Polygon) {
      const polygon =
        layer ??
        L.polygon(toLatLngs(zone), { ...style(zone.kind, false), pmIgnore: false }).addTo(map)
      polygon.setStyle(style(zone.kind, false))
      // A DOM tooltip avoids interpreting imported zone names as HTML.
      const label = document.createElement('span')
      label.textContent = zone.name
      polygon.bindTooltip(label, { sticky: true })
      polygon.on('click', () => {
        if (!map.pm.globalDrawModeEnabled()) select(zone.id)
      })
      polygon.on('pm:edit', () => readEdit(zone.id, polygon))
      polygon.on('pm:dragend', () => readEdit(zone.id, polygon))
      layers.set(zone.id, polygon)
    }
    function rebuild(next: NavigationDocument) {
      rebuilding = true
      map.pm.disableDraw()
      layers.forEach(layer => {
        layer.pm.disable()
        layer.pm.disableLayerDrag()
        map.removeLayer(layer)
      })
      layers.clear()
      for (const zone of next.zones) attach(zone)
      rebuilding = false
      setDrawing(null)
      setDragging(false)
      if (current && layers.has(current)) select(current)
      else {
        current = null
        setSelectedId(null)
      }
    }
    for (const zone of draft.current.zones) attach(zone)
    const createZone = (event: L.LeafletEvent & { layer: L.Layer }) => {
      const layer = event.layer
      if (!(layer instanceof L.Polygon)) {
        map.removeLayer(layer)
        return
      }
      const points = readPoints(layer)
      if (!polygonIsValid(points) || draft.current.zones.length >= 150) {
        map.removeLayer(layer)
        setStatus('invalid')
        setError(true)
        return
      }
      const zone: Zone = {
        id: crypto.randomUUID(),
        name: `${drawKind === 'allowed' ? text.current.allowed : text.current.blocked} ${draft.current.zones.length + 1}`,
        kind: drawKind,
        points,
      }
      commit({ ...draft.current, zones: [...draft.current.zones, zone] })
      attach(zone, layer)
      select(zone.id)
    }
    map.on('pm:create', createZone)
    api.current = {
      select,
      rebuild,
      draw(kind) {
        layers.forEach(layer => {
          layer.pm.disable()
          layer.pm.disableLayerDrag()
        })
        map.pm.disableDraw()
        drawKind = kind
        current = null
        setSelectedId(null)
        setDrawing(kind)
        setDragging(false)
        map.pm.enableDraw('Polygon', {
          allowSelfIntersection: false,
          snappable: false,
          finishOn: 'dblclick',
          finishOnEnter: true,
          pathOptions: style(kind, true),
          templineStyle: { color: kind === 'allowed' ? '#087b54' : '#d82a48' },
          hintlineStyle: { color: '#fefefe', dashArray: [6, 6] },
        })
      },
      stop() {
        map.pm.disableDraw()
        setDrawing(null)
      },
      drag(enabled) {
        const layer = current ? layers.get(current) : null
        if (!layer) return
        layer.pm.disable()
        layer.pm.disableLayerDrag()
        if (enabled) layer.pm.enableLayerDrag()
        else select(current!)
        setDragging(enabled)
      },
      fit() {
        map.fitBounds(bounds, { padding: [18, 18] })
      },
    }
    const resize = new ResizeObserver(() => map.invalidateSize())
    resize.observe(element.current!)
    return () => {
      rebuilding = true
      api.current = null
      resize.disconnect()
      map.off('pm:create', createZone)
      map.remove()
    }
  }, [commit, editorState.mapLanguage])

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (navigationFingerprint(draft.current) !== saved.current) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])

  function undo(redo = false) {
    const from = redo ? future : history,
      to = redo ? history : future
    const next = from.current.pop()
    if (!next) return
    to.current.push(structuredClone(draft.current))
    draft.current = next
    setDoc(next)
    api.current?.rebuild(next)
    setStatus('changed')
    setError(false)
  }
  function updateSelected(patch: Partial<Pick<Zone, 'name' | 'kind'>>) {
    if (!selected) return
    const next = {
      ...draft.current,
      zones: draft.current.zones.map(z => (z.id === selected.id ? { ...z, ...patch } : z)),
    }
    commit(next)
    api.current?.rebuild(next)
  }
  function removeZone(id: string) {
    const next = {
      ...draft.current,
      zones: draft.current.zones.filter(z => z.id !== id),
    }
    commit(next)
    api.current?.rebuild(next)
  }
  useEffect(() => {
    const removeWithKeyboard = (event: KeyboardEvent) => {
      // macOS exposes its physical Delete key as Backspace in the DOM.
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      )
        return
      if (!selectedId || drawing) return
      event.preventDefault()
      const next = {
        ...draft.current,
        zones: draft.current.zones.filter(zone => zone.id !== selectedId),
      }
      commit(next)
      api.current?.rebuild(next)
    }
    document.addEventListener('keydown', removeWithKeyboard)
    return () => document.removeEventListener('keydown', removeWithKeyboard)
  }, [selectedId, drawing, commit])
  function checked(): NavigationDocument | null {
    try {
      return parseNavigation(draft.current)
    } catch {
      setStatus('invalid')
      setError(true)
      return null
    }
  }
  function test() {
    const next = checked()
    if (!next) return
    if (!findSafePosition(SPAWN, next)) {
      setStatus('noSpace')
      setError(true)
      return
    }
    onTest(next)
  }
  async function save() {
    const next = checked()
    if (!next) return
    try {
      await saveNavigation(next)
      saved.current = navigationFingerprint(next)
      onSave(next)
      setStatus('saved')
      setError(false)
    } catch {
      setStatus('saveFailed')
      setError(true)
    }
  }
  function exportJson() {
    const next = checked()
    if (!next) return
    const url = URL.createObjectURL(
      new Blob([serializeNavigation(next)], { type: 'application/json' })
    )
    const a = document.createElement('a')
    a.href = url
    a.download = 'bible-strong-archipelago-zones.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  async function importJson(file?: File) {
    if (!file) return
    try {
      if (file.size > 1024 * 1024) throw new Error('Too large')
      const next = upgradeNavigation(parseNavigation(JSON.parse(await file.text())))
      commit(next)
      api.current?.rebuild(next)
    } catch {
      setStatus('invalidFile')
      setError(true)
    }
    if (input.current) input.current.value = ''
  }

  return (
    <section className="zone-editor" aria-label={t.title}>
      <header className="editor-header">
        <div>
          <strong>{t.title}</strong>
          <small>{t.local}</small>
        </div>
        <button className="editor-test" onClick={test}>
          {t.test} →
        </button>
      </header>
      <div className="editor-toolbar">
        <button
          className="allowed-tool"
          aria-pressed={drawing === 'allowed'}
          onClick={() =>
            doc.zones.length < 150 ? api.current?.draw('allowed') : setStatus('tooMany')
          }
        >
          {t.addAllowed}
        </button>
        <button
          className="blocked-tool"
          aria-pressed={drawing === 'blocked'}
          onClick={() =>
            doc.zones.length < 150 ? api.current?.draw('blocked') : setStatus('tooMany')
          }
        >
          {t.addBlocked}
        </button>
        {drawing && <button onClick={() => api.current?.stop()}>{t.cancel}</button>}
        <button disabled={!history.current.length} onClick={() => undo()}>
          {t.undo}
        </button>
        <button disabled={!future.current.length} onClick={() => undo(true)}>
          {t.redo}
        </button>
        <button onClick={() => api.current?.fit()}>{t.fit}</button>
        <span className="toolbar-spacer" />
        <button onClick={() => input.current?.click()}>{t.import}</button>
        <button onClick={exportJson}>{t.export}</button>
        <button className="editor-save" onClick={save}>
          {t.save}
        </button>
        <input
          type="file"
          accept=".json,application/json"
          ref={input}
          hidden
          aria-label={t.importLabel}
          onChange={e => void importJson(e.target.files?.[0])}
        />
      </div>
      <div className="editor-layout">
        <div className="editor-map-wrap">
          <div ref={element} className="editor-map" data-testid="zone-map" />
          <p className="editor-help">{drawing ? t.draw : selected ? t.vertices : t.select}</p>
        </div>
        <aside className="editor-sidebar">
          <p className="editor-legend">
            <span>● {t.allowed}</span>
            <span>● {t.blocked}</span>
          </p>
          <small>{t.precedence}</small>
          {selected && (
            <div className="zone-inspector" key={`${selected.id}-${selected.name}`}>
              <label>
                {t.name}
                <input
                  aria-label={t.name}
                  defaultValue={selected.name}
                  maxLength={100}
                  onBlur={e => {
                    if (e.target.value.trim()) updateSelected({ name: e.target.value.trim() })
                    else e.target.value = selected.name
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') e.currentTarget.blur()
                  }}
                />
              </label>
              <label>
                {t.kind}
                <select
                  aria-label={t.kind}
                  value={selected.kind}
                  onChange={e => updateSelected({ kind: e.target.value as Zone['kind'] })}
                >
                  <option value="allowed">{t.allowed}</option>
                  <option value="blocked">{t.blocked}</option>
                </select>
              </label>
              <button aria-pressed={dragging} onClick={() => api.current?.drag(!dragging)}>
                {dragging ? t.edit : t.drag}
              </button>
              <button className="delete-zone" onClick={() => removeZone(selected.id)}>
                {t.remove}
              </button>
            </div>
          )}
          <h2>
            {t.zones} <span>{doc.zones.length}</span>
          </h2>
          <div className="zone-list">
            {doc.zones.map(z => (
              <button
                key={z.id}
                aria-pressed={selectedId === z.id}
                onClick={() => api.current?.select(z.id, true)}
              >
                <i className={z.kind} />
                <span>{z.name}</span>
                <small>{z.points.length}</small>
              </button>
            ))}
          </div>
        </aside>
      </div>
      <footer className={`editor-status ${error ? 'error' : ''}`} role="status">
        {t[status]}
        {changed && status === 'unsaved' ? ` · ${t.changed}` : ''}
      </footer>
    </section>
  )
}
