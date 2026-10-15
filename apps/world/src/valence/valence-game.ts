import Phaser from 'phaser'
import { AnimatedReader, loadReader, type ReaderManifest } from '../animated-reader'
import { sepiaTone } from '../avatar-tone'
import { BushRustle } from '../bush-rustle'
import { LazySceneAssets, type LazySceneAsset } from '../lazy-scene-assets'
import type { MapTileManifest } from '../map-tiles'
import { VALENCE_ROOM } from '../multiplayer-protocol'
import { StandCrowd } from '../stand-crowd'
import type { Point } from '../world'
import { framedExtent, loadFrame, WorldFrame, type FrameLook } from '../world-frame'
import { RESOLUTION, startWorldGame, WorldScene, type SceneControls, type SceneFrame, type SceneState } from '../world-scene'
import tileManifest from './generated/map-tiles.json'
import { ValenceAmbience, type EffectsModel } from './valence-ambience'
import { isValenceShrub, ValenceOccluders, valenceOccluders } from './valence-occluders'
import { valenceScenes } from './valence-scenes'
import { chooseValenceSpawn, valenceSquareCandidates } from './valence-spawn'
import type { PioneerObjectId, StationId } from './valence-story'
import {
  AVATAR_SIZE,
  objectSpots,
  stationAnchors,
  stationLabels,
  threadOrder,
  valencePortal,
  VALENCE_HEIGHT,
  VALENCE_SPAWN,
  VALENCE_WIDTH,
} from './valence-world'
import type { WorkshopModel } from './workshop-model'
import { WorkshopOverlay } from './workshop-overlay'

export type ValenceState = SceneState

export type ValenceControls = SceneControls & {
  effects: EffectsModel
  visited: ReadonlySet<StationId>
  found: ReadonlySet<PioneerObjectId>
  /** DOM elements projected on the map, owned by React. */
  stationTags?: Partial<Record<StationId, HTMLElement | null>>
  portalTag?: HTMLElement | null
  /** Development workshop: panels in React, handles on the map. */
  workshop?: WorkshopModel
}

const SEPIA = 0x3b2414
/** Valence hangs as a painting: zooming out reveals its gilded frame, then the museum wall. */
const FRAME: FrameLook = {
  // Built by scripts/build-world-frame.py with the same border and lip (docs/valence-1876/frame.md).
  texture: { key: 'valence-frame', url: './valence-1876/frame/frame.webp' },
  border: 72,
  lip: 10,
  margin: 150,
  wall: '#381a17',
  plaque: { text: 'Valence, 1876', font: 'ValenceLiterata, Literata, Georgia, serif', color: '#2e1c0f', background: 0xcdb07a },
}
type SceneUpdate = (camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) => void

/** Valence in 1876: its engraved town, its animated scenes, the pioneers' objects and stations. */
class ValenceScene extends WorldScene<ValenceControls> {
  occluders!: ValenceOccluders
  scenes!: LazySceneAssets<SceneUpdate>
  /** The light of the engraving: dust, the Rhône's shimmer, bursts on found objects. */
  townAmbience!: ValenceAmbience
  overlay?: WorkshopOverlay
  objects = new Map<PioneerObjectId, Phaser.GameObjects.Image>()
  objectGlow = new Map<PioneerObjectId, Phaser.GameObjects.Image>()
  clock = 0
  /** Objects found in an earlier visit are already collected: no burst on load. */
  collected: Set<PioneerObjectId>

  constructor(
    parent: HTMLElement,
    controls: ValenceControls,
    private readonly publish: (state: ValenceState) => void,
    onReady: () => void,
    onError: () => void
  ) {
    super({
      key: 'valence-1876',
      parent,
      controls,
      onReady,
      onError,
      width: VALENCE_WIDTH,
      height: VALENCE_HEIGHT,
      scenery: framedExtent(VALENCE_WIDTH, VALENCE_HEIGHT, FRAME),
      cameraLift: 32,
      avatarSize: AVATAR_SIZE,
      look: {
        background: FRAME.wall,
        avatarShadow: SEPIA,
        avatarShadowAlpha: 0.22,
        name: '#2e1c0f',
        nameBackground: 0xf8ecd2,
        markerTint: 0x6b4423,
        // Cream foam along the quays, on the sepia water.
        foam: 0xfff1d6,
        // Explorers keep their colour, aged like the engraving.
        avatarTone: sepiaTone(0.65),
      },
      room: VALENCE_ROOM,
      preview: './valence-1876/map/preview.webp',
      tiles: { manifest: tileManifest as MapTileManifest, root: './valence-1876/map/tiles', key: 'valence-map' },
      hiddenBy: () => valenceOccluders,
    })
    this.collected = new Set(controls.found)
  }

  arrival() {
    const { navigation } = this.controls
    return chooseValenceSpawn(navigation, VALENCE_SPAWN) ?? this.safePosition(VALENCE_SPAWN) ?? { ...VALENCE_SPAWN }
  }
  createCrowd() {
    if (!this.controls.stand) return undefined
    return new StandCrowd(this.controls.navigation, Math.random, {
      candidates: valenceSquareCandidates,
      walking: navigation => navigation,
    })
  }
  createBushes() {
    // Sepia leaves, matching the engraved foliage of the map.
    return new BushRustle(this, [], {
      reactive: isValenceShrub,
      leaves: { colors: [0x8c7a45, 0xa8915a, 0xc4ad73], stroke: 0x3b2a14 },
    })
  }
  freeCamera() {
    // Every workshop mode but the full-screen zone editor works over the live map.
    const mode = this.controls.workshop?.mode ?? null
    return Boolean(mode && mode !== 'navigation')
  }

  preloadScenery() {
    loadFrame(this, FRAME)
    for (const id of Object.keys(objectSpots)) this.load.image(`valence-object-${id}`, `./valence-1876/objects/${id}.webp`)
  }

  createScenery() {
    const { controls } = this
    new WorldFrame(this, VALENCE_WIDTH, VALENCE_HEIGHT, FRAME)
    this.occluders = new ValenceOccluders(this, this.bushes)
    this.scenes = new LazySceneAssets(
      this,
      valenceScenes.map(
        ({ id, manifest }): LazySceneAsset<SceneUpdate> => ({
          bounds: manifest,
          keys: manifest.pages.map(page => `${id}-${page.key}`),
          load: () => loadReader(this, id, manifest as ReaderManifest, './valence-1876/scenes'),
          create: () => {
            const reader = new AnimatedReader(this, id, manifest as ReaderManifest)
            // SAM cut the townsfolk without the ground: give them back a soft shadow, under
            // every standing thing, revealed with the scene.
            const shadows = (manifest.shadows ?? []).map(s =>
              this.add.ellipse(s.x, s.y, s.rx * 2, s.ry * 2, SEPIA, 1).setDepth(-30).setAlpha(0)
            )
            return (camera, delta, paused) => {
              reader.update(camera, paused, 0, delta)
              for (const shadow of shadows) shadow.setAlpha(reader.alpha * 0.26)
            }
          },
        })
      )
    )
    this.townAmbience = new ValenceAmbience(this, controls.effects)
    if (import.meta.env.DEV && controls.workshop) this.overlay = new WorkshopOverlay(this, controls.workshop, RESOLUTION)
    this.makeGlowTexture()
    for (const id of Object.keys(objectSpots) as PioneerObjectId[]) {
      const spot = objectSpots[id]
      if (!this.textures.exists(`valence-object-${id}`)) continue
      this.objectGlow.set(
        id,
        this.add
          .image(spot.x, spot.y - 6, 'valence-object-glow')
          .setBlendMode(Phaser.BlendModes.ADD)
          .setDisplaySize(48, 30)
          .setAlpha(0)
      )
      this.objects.set(id, this.add.image(spot.x, spot.y, `valence-object-${id}`).setOrigin(0.5, 0.85).setDisplaySize(26, 26))
    }
    // Warm the lazy pathfinding grid while the introduction is read, one route at a time.
    const warm = threadOrder.map(id => stationAnchors[id])
    let next = 0
    const warmUp = () => {
      if (!this.alive || next >= warm.length) return
      this.pathfinder.find(this.position, warm[next++])
      setTimeout(warmUp, 60)
    }
    setTimeout(warmUp, 600)
  }

  makeGlowTexture() {
    if (this.textures.exists('valence-object-glow')) return
    const size = 64
    const canvas = this.textures.createCanvas('valence-object-glow', size, size)!
    const context = canvas.getContext()
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32)
    gradient.addColorStop(0, 'rgba(255, 228, 160, 0.9)')
    gradient.addColorStop(0.45, 'rgba(255, 210, 130, 0.35)')
    gradient.addColorStop(1, 'rgba(255, 200, 120, 0)')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    canvas.refresh()
  }

  updateScenery({ delta, camera, zoom, reducedMotion, animating, paused, freeCamera, arrivalTarget }: SceneFrame) {
    const { controls, parent } = this
    this.clock += delta

    // Objects and DOM tags.
    const breathing = reducedMotion ? 0 : Math.sin(this.clock / 520)
    for (const [id, image] of this.objects) {
      const found = controls.found.has(id)
      const spot = objectSpots[id]
      if (found && !this.collected.has(id)) {
        this.collected.add(id)
        if (image.visible) this.townAmbience.burst(spot, reducedMotion)
      } else if (!found) this.collected.delete(id)
      image
        .setVisible(!found || freeCamera)
        .setPosition(spot.x, spot.y - (reducedMotion ? 0 : 2 + breathing * 2))
        .setDepth(spot.y)
      this.objectGlow
        .get(id)
        ?.setVisible(!found)
        .setPosition(spot.x, spot.y - 6)
        .setDepth(spot.y - 0.5)
        .setAlpha(found ? 0 : 0.35 + 0.25 * (breathing + 1) * 0.5)
    }
    const tags: [HTMLElement | null | undefined, Point][] = [
      ...(Object.keys(stationLabels) as StationId[]).map(
        id => [controls.stationTags?.[id], stationLabels[id]] as [HTMLElement | null | undefined, Point]
      ),
      [controls.portalTag, valencePortal.label],
    ]
    // Once the painting is small on its wall, the labels would hide it: they wait for a closer look.
    const paintingWidth = (VALENCE_WIDTH * zoom * parent.clientWidth) / this.scale.width
    for (const [tag, label] of tags) {
      if (!tag) continue
      const point = this.project(label, zoom)
      // Off-screen tags hide; visible ones stay clear of the screen edges and the top bar.
      const offscreen =
        freeCamera ||
        paintingWidth < 760 ||
        point.x < -40 || point.x > parent.clientWidth + 40 || point.y < 40 || point.y > parent.clientHeight + 30
      if (tag.dataset.offscreen !== String(offscreen)) tag.dataset.offscreen = String(offscreen)
      const half = tag.offsetWidth / 2 + 8
      const x = Math.min(Math.max(point.x, half), parent.clientWidth - half)
      const y = Math.max(point.y, 140)
      tag.style.translate = `${x}px ${y}px`
    }

    // Streaming and life.
    this.occluders.update(camera, delta, animating, arrivalTarget?.view)
    this.scenes.update(camera, animating, update => update(camera, delta, paused), {
      view: arrivalTarget?.view,
      concurrent: true,
    })
    this.townAmbience.update(camera, delta, paused, reducedMotion, freeCamera)
    this.overlay?.update()
  }

  drawDebug(layer: Phaser.GameObjects.Graphics, { zoom }: SceneFrame) {
    for (const anchor of Object.values(stationAnchors)) layer.lineStyle(1 / zoom, 0x2040ff, 0.9).strokeCircle(anchor.x, anchor.y, 62)
  }

  publishState({ next, moving }: SceneFrame) {
    this.publish({ x: next.x, y: next.y, moving, fps: Math.round(this.game.loop.actualFps), multiplayer: this.network.status })
  }
}

export function createValence(
  parent: HTMLElement,
  controls: ValenceControls,
  publish: (state: ValenceState) => void,
  onReady: () => void,
  onError: () => void
) {
  return startWorldGame(new ValenceScene(parent, controls, publish, onReady, onError))
}
