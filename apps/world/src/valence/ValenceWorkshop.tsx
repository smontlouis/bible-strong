// Development-only workshop of Valence 1876: access zones, landmarks and thread, water and
// effects, shorelines and ambient zones. Saves go to the project through the Vite dev server.
import { lazy, Suspense, useEffect, useReducer, useState } from 'react'
import type { AmbientEditorModel } from '../ambient-zones'
import type { Language } from '../language'
import { Pathfinder } from '../pathfinding'
import { ShoreEditor } from '../ShoreEditor'
import type { ShoreEditorModel } from '../shorelines'
import type { NavigationDocument } from '../world'
import { AmbientEditorPanel } from '../WorldEditor'
import '../shore-editor.css'
import '../world-editor.css'
import { tileNavigation } from './navigation-tiles'
import { parseEffects, parseLayout, serializeDocument, VALENCE_NAVIGATION, type EffectToggle } from './valence-documents'
import type { ValenceControls } from './valence-game'
import { pioneerObjects, stations } from './valence-story'
import {
  currentLayout,
  objectSpots,
  stationAnchors,
  stationLabels,
  threadOrder,
  threadPaths,
  VALENCE_SPAWN,
  valencePortal,
} from './valence-world'
import type { WorkshopMode, WorkshopModel } from './workshop-model'

const ZoneEditor = lazy(() => import('../ZoneEditor'))

const copy = {
  fr: {
    title: 'Atelier de Valence',
    navigation: 'Accès',
    landmarks: 'Repères',
    water: 'Eau et effets',
    shorelines: 'Rivages',
    particles: 'Particules',
    light: 'Lueurs',
    butterfly: 'Papillons',
    dragonfly: 'Libellules',
    done: 'Terminer',
    save: 'Sauvegarder',
    saved: 'Sauvegardé dans le projet',
    dirty: 'Modifications à sauvegarder',
    error: 'Sauvegarde impossible. Vérifie le serveur local et les valeurs.',
    undo: 'Annuler',
    landmarksHelp:
      'Fais glisser les points sur la carte. Double-clic sur le fil pour ajouter un point, Suppr pour retirer le point choisi. Glisse le fond pour déplacer la vue, molette pour zoomer.',
    legend: ['Arrivée', 'Stations (cercle : portée d’écoute)', 'Étiquettes', 'Objets', 'Fil'],
    selected: 'Point choisi',
    none: 'Aucun',
    thread: 'Fil pointillé',
    segment: 'Tronçon',
    redraw: 'Redessiner',
    redrawHelp: 'Clique les points du trajet sur la carte, de la première station vers la suivante. Entrée termine, Échap annule.',
    finish: 'Terminer le tracé',
    cancel: 'Annuler le tracé',
    auto: 'Tracé automatique',
    autoFailed: 'Pas de chemin praticable entre ces deux stations.',
    places: 'Aller à',
    spawn: 'Arrivée',
    portal: 'Train vers l’archipel',
    waterHelp:
      'Le contour bleu est le Rhône : les reflets et le courant n’apparaissent que dedans. Les zones rouges en sont exclues. Fais glisser les sommets, double-clic sur un bord pour en ajouter, Suppr pour retirer.',
    exclusions: 'Zones sans effet',
    addExclusion: 'Nouvelle zone sans effet',
    exclusionHelp: 'Clique les sommets sur la carte. Entrée termine, Échap annule.',
    remove: 'Supprimer',
    zone: 'Zone',
    smoke: 'Fumées',
    addSmoke: 'Ajouter une fumée',
    smokeHelp: 'Clique sur la carte à l’endroit de la cheminée.',
    rate: 'Intervalle (ms)',
    groups: {
      glints: 'Reflets du soleil',
      currents: 'Traits de courant',
      leaves: 'Feuilles qui tombent',
      clouds: 'Ombres de nuages',
    },
    enabled: 'Actif',
    density: 'Densité (par seconde)',
    cloudCount: 'Nombre',
    size: 'Taille',
    speed: 'Vitesse',
    opacity: 'Opacité',
    loading: 'Chargement…',
  },
  en: {
    title: 'Valence workshop',
    navigation: 'Access',
    landmarks: 'Landmarks',
    water: 'Water and effects',
    shorelines: 'Shorelines',
    particles: 'Particles',
    light: 'Glows',
    butterfly: 'Butterflies',
    dragonfly: 'Dragonflies',
    done: 'Done',
    save: 'Save',
    saved: 'Saved to the project',
    dirty: 'Unsaved changes',
    error: 'Cannot save. Check the local server and the values.',
    undo: 'Undo',
    landmarksHelp:
      'Drag the points on the map. Double-click the thread to add a point, Delete removes the selected point. Drag the background to pan, scroll to zoom.',
    legend: ['Arrival', 'Stations (circle: listening range)', 'Tags', 'Objects', 'Thread'],
    selected: 'Selected point',
    none: 'None',
    thread: 'Dotted thread',
    segment: 'Segment',
    redraw: 'Redraw',
    redrawHelp: 'Click the route on the map, from the first station toward the next. Enter finishes, Escape cancels.',
    finish: 'Finish the route',
    cancel: 'Cancel the route',
    auto: 'Automatic route',
    autoFailed: 'No walkable route between these two stations.',
    places: 'Go to',
    spawn: 'Arrival',
    portal: 'Train to the archipelago',
    waterHelp:
      'The blue outline is the Rhône: glints and currents only appear inside it. Red zones are excluded. Drag vertices, double-click an edge to add one, Delete removes one.',
    exclusions: 'Zones without effects',
    addExclusion: 'New zone without effects',
    exclusionHelp: 'Click the vertices on the map. Enter finishes, Escape cancels.',
    remove: 'Delete',
    zone: 'Zone',
    smoke: 'Smoke',
    addSmoke: 'Add smoke',
    smokeHelp: 'Click the map where the chimney is.',
    rate: 'Interval (ms)',
    groups: {
      glints: 'Sun glints',
      currents: 'Current lines',
      leaves: 'Falling leaves',
      clouds: 'Cloud shadows',
    },
    enabled: 'Enabled',
    density: 'Density (per second)',
    cloudCount: 'Count',
    size: 'Size',
    speed: 'Speed',
    opacity: 'Opacity',
    loading: 'Loading…',
  },
}
type Copy = (typeof copy)['fr']
const MODES: WorkshopMode[] = ['navigation', 'landmarks', 'water', 'shorelines', 'particles', 'light', 'butterfly', 'dragonfly']

async function put(key: string, document: unknown) {
  const response = await fetch(`/__study-world/valence-1876/${key}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: serializeDocument(document),
  })
  if (!response.ok) throw new Error(`Save ${key}: ${response.status}`)
}

function useModel(model: WorkshopModel) {
  const [, refresh] = useReducer(n => n + 1, 0)
  useEffect(() => model.subscribe(refresh), [model])
}

function SaveBar({
  t,
  dirty,
  canUndo,
  onUndo,
  onSave,
}: {
  t: Copy
  dirty: boolean
  canUndo: boolean
  onUndo: () => void
  onSave: () => Promise<void>
}) {
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  return (
    <div className="editor-save-bar">
      <small role="status">
        {status === 'error' ? t.error : status === 'saving' ? '…' : dirty ? t.dirty : status === 'saved' ? t.saved : ''}
      </small>
      <div className="v-workshop-row">
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

function LandmarksPanel({ model, controls, t, language }: { model: WorkshopModel; controls: ValenceControls; t: Copy; language: Language }) {
  useModel(model)
  const [autoFailed, setAutoFailed] = useState(false)
  const selected = model.selected
  const drawing = model.drawing
  const segment = model.segment
  const label = (index: number) =>
    `${index + 1}. ${stations[index].place[language]} → ${stations[index + 1].place[language]}`
  const position = (() => {
    if (!selected) return null
    if (selected.kind === 'spawn') return { name: t.spawn, point: VALENCE_SPAWN }
    if (selected.kind === 'portal') return { name: t.portal, point: valencePortal.ground }
    if (selected.kind === 'portalLabel') return { name: `${t.portal} · ${t.legend[2]}`, point: valencePortal.label }
    if (selected.kind === 'station')
      return { name: stations.find(s => s.id === selected.id)!.place[language], point: stationAnchors[selected.id] }
    if (selected.kind === 'label')
      return { name: `${stations.find(s => s.id === selected.id)!.place[language]} · ${t.legend[2]}`, point: stationLabels[selected.id] }
    if (selected.kind === 'object')
      return { name: pioneerObjects.find(o => o.id === selected.id)!.name[language], point: objectSpots[selected.id] }
    if (selected.kind === 'thread')
      return { name: `${t.thread} ${selected.segment + 1} · ${selected.index}`, point: threadPaths[selected.segment][selected.index] }
    return null
  })()
  return (
    <aside className="shore-editor v-workshop-panel" aria-label={t.landmarks}>
      <header>
        <h2>{t.landmarks}</h2>
      </header>
      <small>{t.landmarksHelp}</small>
      <ul className="v-workshop-legend">
        {t.legend.map((text, index) => (
          <li key={text} data-index={index}>
            {text}
          </li>
        ))}
      </ul>
      <section>
        <h3>{t.selected}</h3>
        {position ? (
          <p>
            <strong>{position.name}</strong>
            <br />
            {Math.round(position.point.x)}, {Math.round(position.point.y)}
          </p>
        ) : (
          <p>{t.none}</p>
        )}
      </section>
      <section>
        <h3>{t.thread}</h3>
        <label>
          {t.segment}
          <select
            value={segment}
            onChange={e => {
              model.segment = Number(e.target.value)
              const line = threadPaths[model.segment]
              model.focus = line[Math.floor(line.length / 2)]
              model.notify()
            }}
          >
            {threadPaths.map((_, index) => (
              <option key={index} value={index}>
                {label(index)}
              </option>
            ))}
          </select>
        </label>
        {drawing?.kind === 'thread' ? (
          <>
            <small>{t.redrawHelp}</small>
            <div className="v-workshop-row">
              <button type="button" onClick={() => model.finishDrawing()}>
                {t.finish}
              </button>
              <button
                type="button"
                onClick={() => {
                  model.drawing = null
                  model.notify()
                }}
              >
                {t.cancel}
              </button>
            </div>
          </>
        ) : (
          <div className="v-workshop-row">
            <button
              type="button"
              onClick={() => {
                model.drawing = { kind: 'thread', segment, points: [] }
                model.focus = stationAnchors[threadOrder[segment]]
                model.notify()
              }}
            >
              {t.redraw}
            </button>
            <button
              type="button"
              onClick={() => {
                const from = stationAnchors[threadOrder[segment]]
                const to = stationAnchors[threadOrder[segment + 1]]
                const path = new Pathfinder(controls.navigation, 4).find(from, to)
                setAutoFailed(!path)
                if (!path) return
                model.checkpoint('layout')
                threadPaths[segment] = [{ ...from }, ...path.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }))]
                model.commit('layout')
              }}
            >
              {t.auto}
            </button>
          </div>
        )}
        {autoFailed && <small>{t.autoFailed}</small>}
      </section>
      <section>
        <h3>{t.places}</h3>
        <div className="v-workshop-chips">
          <button type="button" onClick={() => ((model.focus = VALENCE_SPAWN), model.notify())}>
            {t.spawn}
          </button>
          <button type="button" onClick={() => ((model.focus = valencePortal.ground), model.notify())}>
            {t.portal}
          </button>
          {stations.map(station => (
            <button
              type="button"
              key={station.id}
              onClick={() => {
                model.focus = stationAnchors[station.id]
                model.selected = { kind: 'station', id: station.id }
                model.notify()
              }}
            >
              {station.order}. {station.place[language]}
            </button>
          ))}
          {pioneerObjects.map(object => (
            <button
              type="button"
              key={object.id}
              onClick={() => {
                model.focus = objectSpots[object.id]
                model.selected = { kind: 'object', id: object.id }
                model.notify()
              }}
            >
              {object.name[language]}
            </button>
          ))}
        </div>
      </section>
      <SaveBar
        t={t}
        dirty={model.layoutDirty}
        canUndo={model.canUndoLayout}
        onUndo={() => model.undo('layout')}
        onSave={async () => {
          const layout = parseLayout(currentLayout())
          await put('layout', layout)
          model.markSaved('layout')
        }}
      />
    </aside>
  )
}

function Slider({
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
    <label className="v-workshop-slider">
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

function WaterPanel({ model, t }: { model: WorkshopModel; t: Copy }) {
  useModel(model)
  const effects = model.effects.effects
  const drawing = model.drawing
  const edit = (change: () => void) => {
    change()
    model.effects.revision++
    model.notify()
  }
  const group = (key: keyof Copy['groups'], setting: EffectToggle) => (
    <details key={key} open={key === 'glints' || key === 'currents'}>
      <summary>{t.groups[key]}</summary>
      <label className="v-workshop-check">
        <input
          type="checkbox"
          checked={setting.enabled}
          onChange={e => {
            model.checkpoint('effects')
            edit(() => (setting.enabled = e.target.checked))
          }}
        />
        {t.enabled}
      </label>
      <Slider
        label={key === 'clouds' ? t.cloudCount : t.density}
        value={setting.density}
        min={0}
        max={key === 'clouds' ? 12 : key === 'leaves' ? 20 : 30}
        step={key === 'clouds' ? 1 : 0.1}
        onStart={() => model.checkpoint('effects')}
        onChange={value => edit(() => (setting.density = value))}
      />
      <Slider label={t.size} value={setting.size} min={0.1} max={4} step={0.05} onStart={() => model.checkpoint('effects')} onChange={value => edit(() => (setting.size = value))} />
      <Slider label={t.speed} value={setting.speed} min={0} max={4} step={0.05} onStart={() => model.checkpoint('effects')} onChange={value => edit(() => (setting.speed = value))} />
      <Slider label={t.opacity} value={setting.opacity} min={0} max={1} step={0.01} onStart={() => model.checkpoint('effects')} onChange={value => edit(() => (setting.opacity = value))} />
    </details>
  )
  return (
    <aside className="shore-editor v-workshop-panel" aria-label={t.water}>
      <header>
        <h2>{t.water}</h2>
      </header>
      <small>{t.waterHelp}</small>
      {(['glints', 'currents', 'leaves', 'clouds'] as const).map(key => group(key, effects[key]))}
      <section>
        <h3>{t.exclusions}</h3>
        <ul className="v-workshop-list">
          {effects.exclusions.map((zone, index) => (
            <li key={index}>
              <button type="button" onClick={() => ((model.focus = { x: zone[0][0], y: zone[0][1] }), model.notify())}>
                {t.zone} {index + 1}
              </button>
              <button
                type="button"
                onClick={() => {
                  model.checkpoint('effects')
                  effects.exclusions.splice(index, 1)
                  model.commit('effects')
                }}
              >
                {t.remove}
              </button>
            </li>
          ))}
        </ul>
        {drawing?.kind === 'exclusion' ? (
          <>
            <small>{t.exclusionHelp}</small>
            <div className="v-workshop-row">
              <button type="button" onClick={() => model.finishDrawing()}>
                {t.finish}
              </button>
              <button type="button" onClick={() => ((model.drawing = null), model.notify())}>
                {t.cancel}
              </button>
            </div>
          </>
        ) : (
          <button type="button" onClick={() => ((model.drawing = { kind: 'exclusion', points: [] }), model.notify())}>
            {t.addExclusion}
          </button>
        )}
      </section>
      <section>
        <h3>{t.smoke}</h3>
        {effects.smoke.map((source, index) => (
          <div className="v-workshop-smoke" key={index}>
            <button type="button" onClick={() => ((model.focus = source), (model.selected = { kind: 'smoke', index }), model.notify())}>
              {t.smoke} {index + 1}
            </button>
            <Slider label={t.rate} value={source.rate} min={80} max={4000} step={20} onStart={() => model.checkpoint('effects')} onChange={value => edit(() => (source.rate = value))} />
            <Slider label={t.size} value={source.size} min={0.2} max={4} step={0.05} onStart={() => model.checkpoint('effects')} onChange={value => edit(() => (source.size = value))} />
            <button
              type="button"
              onClick={() => {
                model.checkpoint('effects')
                effects.smoke.splice(index, 1)
                model.commit('effects')
              }}
            >
              {t.remove}
            </button>
          </div>
        ))}
        {drawing?.kind === 'smoke' ? (
          <small>{t.smokeHelp}</small>
        ) : (
          <button type="button" onClick={() => ((model.drawing = { kind: 'smoke' }), model.notify())}>
            {t.addSmoke}
          </button>
        )}
      </section>
      <SaveBar
        t={t}
        dirty={model.effectsDirty}
        canUndo={model.canUndoEffects}
        onUndo={() => model.undo('effects')}
        onSave={async () => {
          const document = parseEffects(effects)
          await put('effects', document)
          model.markSaved('effects')
        }}
      />
    </aside>
  )
}

export default function ValenceWorkshop({
  mode,
  onMode,
  model,
  controls,
  shoreEditor,
  ambientEditor,
  navigation,
  onNavigation,
  language,
}: {
  mode: WorkshopMode
  onMode: (mode: WorkshopMode | null) => void
  model: WorkshopModel
  controls: ValenceControls
  shoreEditor: ShoreEditorModel
  ambientEditor: AmbientEditorModel
  navigation: NavigationDocument
  onNavigation: (document: NavigationDocument) => void
  language: Language
}) {
  const t = copy[language]
  useEffect(() => {
    model.mode = mode
    model.notify()
  }, [model, mode])
  const zoom = (factor: number) => {
    controls.shoreZoom = factor
  }
  return (
    <>
      <nav className="world-editor-navigation v-workshop-navigation" aria-label={t.title}>
        <strong>{t.title}</strong>
        <div className="world-editor-tabs">
          {MODES.map(key => (
            <button key={key} type="button" aria-pressed={mode === key} onClick={() => onMode(key)}>
              {t[key]}
            </button>
          ))}
        </div>
        <button type="button" className="editor-done" onClick={() => onMode(null)}>
          {t.done} ↗
        </button>
      </nav>
      {mode === 'navigation' && (
        <Suspense fallback={<div className="zone-editor">{t.loading}</div>}>
          <ZoneEditor
            map={{
              spec: VALENCE_NAVIGATION,
              image: './valence-1876/map/preview.webp',
              spawn: VALENCE_SPAWN,
              endpoint: '/__study-world/valence-1876/navigation',
              filename: 'valence-1876-navigation.json',
              prepare: tileNavigation,
              maxZones: 400,
            }}
            initial={navigation}
            language={language}
            onSave={onNavigation}
            onTest={next => {
              onNavigation(next)
              controls.debug = true
              onMode(null)
            }}
          />
        </Suspense>
      )}
      {mode === 'landmarks' && <LandmarksPanel model={model} controls={controls} t={t} language={language} />}
      {mode === 'water' && <WaterPanel model={model} t={t} />}
      {mode === 'shorelines' && (
        <ShoreEditor model={shoreEditor} language={language} onZoom={zoom} onClose={() => onMode(null)} />
      )}
      {(mode === 'particles' || mode === 'light' || mode === 'butterfly' || mode === 'dragonfly') && (
        <AmbientEditorPanel model={ambientEditor} language={language} onZoom={zoom} />
      )}
    </>
  )
}
