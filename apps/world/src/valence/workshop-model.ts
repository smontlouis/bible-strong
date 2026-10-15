// State shared by the Valence workshop panels (React, development only) and its map overlay
// (Phaser). Positions are edited in place in valence-world.ts and in the effects model, so the
// running scene shows every change at once. Saving lives in the development-only panels.
import type { AmbientKind } from '../ambient-zones'
import type { Point } from '../world'
import type { EffectsModel } from './valence-ambience'
import type { ValenceEffects } from './valence-documents'
import type { PioneerObjectId, StationId } from './valence-story'
import { applyLayout, currentLayout, stationAnchors, threadOrder, threadPaths } from './valence-world'

export type WorkshopMode = 'navigation' | 'landmarks' | 'water' | 'shorelines' | AmbientKind
export type Handle =
  | { kind: 'spawn' }
  | { kind: 'portal' }
  | { kind: 'portalLabel' }
  | { kind: 'station'; id: StationId }
  | { kind: 'label'; id: StationId }
  | { kind: 'object'; id: PioneerObjectId }
  | { kind: 'thread'; segment: number; index: number }
  | { kind: 'river'; index: number }
  | { kind: 'exclusion'; zone: number; index: number }
  | { kind: 'smoke'; index: number }
export type Drawing =
  | { kind: 'thread'; segment: number; points: Point[] }
  | { kind: 'exclusion'; points: Point[] }
  | { kind: 'smoke' }

export function createWorkshop(effects: EffectsModel) {
  const listeners = new Set<() => void>()
  const layoutHistory: string[] = []
  const effectsHistory: string[] = []
  let savedLayout = JSON.stringify(currentLayout())
  let savedEffects = JSON.stringify(effects.effects)
  const model = {
    mode: null as WorkshopMode | null,
    selected: null as Handle | null,
    drawing: null as Drawing | null,
    /** Incremented on every layout edit; the scene redraws the thread and tags. */
    layoutRevision: 0,
    effects,
    /** Selected thread segment, highlighted on the map. */
    segment: 0,
    /** A point the map should center on, consumed by the overlay. */
    focus: null as Point | null,
    get layoutDirty() {
      return JSON.stringify(currentLayout()) !== savedLayout
    },
    get effectsDirty() {
      return JSON.stringify(effects.effects) !== savedEffects
    },
    get canUndoLayout() {
      return layoutHistory.length > 0
    },
    get canUndoEffects() {
      return effectsHistory.length > 0
    },
    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    notify() {
      listeners.forEach(fn => fn())
    },
    checkpoint(document: 'layout' | 'effects') {
      const history = document === 'layout' ? layoutHistory : effectsHistory
      history.push(JSON.stringify(document === 'layout' ? currentLayout() : effects.effects))
      if (history.length > 80) history.shift()
    },
    commit(document: 'layout' | 'effects') {
      if (document === 'layout') model.layoutRevision++
      else effects.revision++
      model.notify()
    },
    undo(document: 'layout' | 'effects') {
      const history = document === 'layout' ? layoutHistory : effectsHistory
      const previous = history.pop()
      if (!previous) return
      if (document === 'layout') applyLayout(JSON.parse(previous))
      else effects.effects = JSON.parse(previous) as ValenceEffects
      model.selected = null
      model.commit(document)
    },
    markSaved(document: 'layout' | 'effects') {
      if (document === 'layout') savedLayout = JSON.stringify(currentLayout())
      else savedEffects = JSON.stringify(effects.effects)
      model.notify()
    },
    /** Moving a station drags the ends of the two thread segments that meet there. */
    moveStation(id: StationId, point: Point) {
      stationAnchors[id] = { ...point }
      const index = threadOrder.indexOf(id)
      if (index > 0) {
        const line = threadPaths[index - 1]
        line[line.length - 1] = { ...point }
      }
      if (index < threadPaths.length) threadPaths[index][0] = { ...point }
    },
    finishDrawing() {
      const drawing = model.drawing
      model.drawing = null
      if (drawing?.kind === 'thread') {
        const from = stationAnchors[threadOrder[drawing.segment]]
        const to = stationAnchors[threadOrder[drawing.segment + 1]]
        model.checkpoint('layout')
        threadPaths[drawing.segment] = [{ ...from }, ...drawing.points, { ...to }]
        model.commit('layout')
      } else if (drawing?.kind === 'exclusion' && drawing.points.length >= 3) {
        model.checkpoint('effects')
        effects.effects.exclusions.push(drawing.points.map(p => [Math.round(p.x), Math.round(p.y)]))
        model.commit('effects')
      } else model.notify()
    },
  }
  return model
}

export type WorkshopModel = ReturnType<typeof createWorkshop>
