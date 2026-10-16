// Valence 1876's workshop: the shared tabs of every world (access, shorelines, ambient zones)
// plus its own landmarks and water panels. Development only.
import { useEffect, useReducer, useState } from 'react'
import type { AmbientEditorModel } from '../ambient-zones'
import type { Language } from '../language'
import { Pathfinder } from '../pathfinding'
import type { ShoreEditorModel } from '../shorelines'
import type { NavigationDocument } from '../world'
import { valenceDocuments } from '../workshop/documents'
import { commonTabs, saveDocument, SaveBar, Slider, WorldWorkshop, type WorkshopTab } from '../workshop/WorldWorkshop'
import { tileNavigation } from './navigation-tiles'
import { parseEffects, parseLayout, VALENCE_NAVIGATION, type EffectToggle } from './valence-documents'
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

const copy = {
  fr: {
    title: 'Atelier de Valence',
    landmarks: 'Repères',
    water: 'Eau et effets',
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
  },
  en: {
    title: 'Valence workshop',
    landmarks: 'Landmarks',
    water: 'Water and effects',
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
  },
}
type Copy = (typeof copy)['fr']
function useModel(model: WorkshopModel) {
  const [, refresh] = useReducer(n => n + 1, 0)
  useEffect(() => model.subscribe(refresh), [model])
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
    <aside className="shore-editor workshop-panel" aria-label={t.landmarks}>
      <header>
        <h2>{t.landmarks}</h2>
      </header>
      <small>{t.landmarksHelp}</small>
      <ul className="workshop-legend">
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
            <div className="workshop-row">
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
          <div className="workshop-row">
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
        <div className="workshop-chips">
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
        language={language}
        dirty={model.layoutDirty}
        canUndo={model.canUndoLayout}
        onUndo={() => model.undo('layout')}
        onSave={async () => {
          await saveDocument(valenceDocuments.layout.endpoint, parseLayout(currentLayout()))
          model.markSaved('layout')
        }}
      />
    </aside>
  )
}

function WaterPanel({ model, t, language }: { model: WorkshopModel; t: Copy; language: Language }) {
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
      <label className="workshop-check">
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
    <aside className="shore-editor workshop-panel" aria-label={t.water}>
      <header>
        <h2>{t.water}</h2>
      </header>
      <small>{t.waterHelp}</small>
      {(['glints', 'currents', 'leaves', 'clouds'] as const).map(key => group(key, effects[key]))}
      <section>
        <h3>{t.exclusions}</h3>
        <ul className="workshop-list">
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
            <div className="workshop-row">
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
          <div className="workshop-smoke" key={index}>
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
        language={language}
        dirty={model.effectsDirty}
        canUndo={model.canUndoEffects}
        onUndo={() => model.undo('effects')}
        onSave={async () => {
          await saveDocument(valenceDocuments.effects.endpoint, parseEffects(effects))
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
  const common = commonTabs({
    language,
    map: {
      spec: VALENCE_NAVIGATION,
      image: './valence-1876/map/preview.webp',
      spawn: VALENCE_SPAWN,
      endpoint: valenceDocuments.navigation.endpoint,
      filename: 'valence-1876-navigation.json',
      prepare: tileNavigation,
      maxZones: 400,
    },
    navigation,
    onNavigation,
    onTest: next => {
      onNavigation(next)
      controls.debug = true
      onMode(null)
    },
    shoreEditor,
    ambientEditor,
    onZoom: zoom,
    onClose: () => onMode(null),
  })
  const own: WorkshopTab<WorkshopMode>[] = [
    { id: 'landmarks', label: { fr: copy.fr.landmarks, en: copy.en.landmarks }, panel: () => <LandmarksPanel model={model} controls={controls} t={t} language={language} /> },
    { id: 'water', label: { fr: copy.fr.water, en: copy.en.water }, panel: () => <WaterPanel model={model} t={t} language={language} /> },
  ]
  const tabs: WorkshopTab<WorkshopMode>[] = [common[0], ...own, ...common.slice(1)]
  return <WorldWorkshop title={{ fr: copy.fr.title, en: copy.en.title }} tabs={tabs} mode={mode} onMode={onMode} language={language} />
}
