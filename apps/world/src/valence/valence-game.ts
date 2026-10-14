import Phaser from 'phaser'
import { AnimatedReader, loadReader, type ReaderManifest } from '../animated-reader'
import { BlobAvatar, loadBlobAvatar } from '../blob-avatar'
import { cameraZoomBounds, clampCameraZoom } from '../camera-zoom'
import { LazySceneAssets, type LazySceneAsset } from '../lazy-scene-assets'
import { MapTileStreamer } from '../map-tile-streamer'
import type { MapTileManifest } from '../map-tiles'
import { arrivalTileTarget } from '../map-tiles'
import { Pathfinder } from '../pathfinding'
import { isPointerSteering, pointerDirection, type PointerPress } from '../pointer-steering'
import { WalkingRoute } from '../walking-route'
import { arrivalZoom } from '../world-arrival'
import { canAnimateWorld } from '../world-activity'
import { findSafePosition, move, type NavigationDocument, type Point } from '../world'
import type { AvatarId } from '../avatar-profile'
import anchors from './generated/anchors.json'
import tileManifest from './generated/map-tiles.json'
import { ValenceAmbience } from './valence-ambience'
import { ValenceOccluders, valenceOccluders } from './valence-occluders'
import { valenceScenes } from './valence-scenes'
import type { PioneerObjectId, StationId } from './valence-story'
import {
  AVATAR_SIZE,
  objectSpots,
  stationAnchors,
  stationLabels,
  threadOrder,
  VALENCE_HEIGHT,
  VALENCE_SPAWN,
  VALENCE_WIDTH,
} from './valence-world'

export type ValenceState = {
  x: number
  y: number
  moving: boolean
  fps: number
}

export type ValenceControls = {
  navigation: NavigationDocument
  direction: Point
  avatar: AvatarId
  avatarColor: string
  paused: boolean
  overview: boolean
  debug: boolean
  zoom: number
  minimumZoom: number
  reset: number
  stand?: boolean
  pointerPress?: PointerPress
  walkToScreen?: Point
  cancelWalk?: boolean
  travelTo?: Point
  arrivalStartedAt?: number | null
  visited: ReadonlySet<StationId>
  found: ReadonlySet<PioneerObjectId>
  /** DOM elements projected on the map, owned by React. */
  stationTags?: Partial<Record<StationId, HTMLElement | null>>
  objectTags?: Partial<Record<PioneerObjectId, HTMLElement | null>>
}

const RESOLUTION = Math.min(window.devicePixelRatio || 1, 2)
const PAPER = '#cdb48a'

export function createValence(
  parent: HTMLElement,
  controls: ValenceControls,
  publish: (state: ValenceState) => void,
  onReady: () => void,
  onError: () => void
) {
  class ValenceScene extends Phaser.Scene {
    position = { ...VALENCE_SPAWN }
    facing = { x: 0, y: 1 }
    avatar!: Phaser.GameObjects.Image
    /** A faint copy above the scenery while a roof or a canopy hides the avatar. */
    ghost!: Phaser.GameObjects.Image
    shadow!: Phaser.GameObjects.Ellipse
    blobAvatar = new BlobAvatar()
    pathfinder = new Pathfinder(controls.navigation)
    route = new WalkingRoute()
    tiles!: MapTileStreamer
    occluders!: ValenceOccluders
    scenes!: LazySceneAssets<(camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) => void>
    ambience!: ValenceAmbience
    thread!: Phaser.GameObjects.Graphics
    threadPaths: Point[][] = []
    threadSignature = ''
    threadPhase = 0
    objects = new Map<PioneerObjectId, Phaser.GameObjects.Image>()
    objectGlow = new Map<PioneerObjectId, Phaser.GameObjects.Image>()
    destination!: Phaser.GameObjects.Image
    blocked!: Phaser.GameObjects.Image
    blockedUntil = 0
    rejected?: Point
    debugLayer!: Phaser.GameObjects.Graphics
    keys!: Record<string, Phaser.Input.Keyboard.Key>
    lastReset = 0
    lastPublished = 0
    active = true
    previousNavigation = controls.navigation
    clock = 0

    resetInput = () => {
      controls.pointerPress = undefined
      controls.walkToScreen = undefined
      controls.direction = { x: 0, y: 0 }
      this.route.cancel()
      this.rejected = undefined
      this.input.keyboard?.resetKeys()
    }
    blur = () => {
      this.active = false
      this.resetInput()
    }
    focusWindow = () => {
      this.active = true
    }

    preload() {
      loadBlobAvatar(this)
      this.load.image('valence-preview', './valence-1876/map/preview.webp')
      this.load.image('navigation-destination', './assets/navigation/destination-arrow.webp')
      this.load.image('navigation-blocked', './assets/navigation/blocked-cross.webp')
      for (const id of Object.keys(objectSpots))
        this.load.image(`valence-object-${id}`, `./valence-1876/objects/${id}.webp`)
      this.load.on('loaderror', onError)
    }

    create() {
      this.load.off('loaderror', onError)
      let alive = true
      const resize = () => {
        if (!alive) return
        this.scale.resize(
          Math.max(1, Math.round(parent.clientWidth * RESOLUTION)),
          Math.max(1, Math.round(parent.clientHeight * RESOLUTION))
        )
      }
      const observer = new ResizeObserver(resize)
      observer.observe(parent)
      resize()
      this.position = findSafePosition(VALENCE_SPAWN, controls.navigation, {
        width: VALENCE_WIDTH,
        height: VALENCE_HEIGHT,
      }) ?? { ...VALENCE_SPAWN }
      this.cameras.main.setBackgroundColor(PAPER)
      this.add
        .image(0, 0, 'valence-preview')
        .setOrigin(0)
        .setDisplaySize(VALENCE_WIDTH, VALENCE_HEIGHT)
        .setDepth(-110)
      this.tiles = new MapTileStreamer(this, {
        manifest: tileManifest as MapTileManifest,
        root: './valence-1876/map/tiles',
        key: 'valence-map',
      })
      this.occluders = new ValenceOccluders(this)
      this.scenes = new LazySceneAssets(
        this,
        valenceScenes.map(
          ({ id, manifest }): LazySceneAsset<
            (camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) => void
          > => ({
            bounds: manifest,
            keys: manifest.pages.map(page => `${id}-${page.key}`),
            load: () => loadReader(this, id, manifest as ReaderManifest, './valence-1876/scenes'),
            create: () => {
              const reader = new AnimatedReader(this, id, manifest as ReaderManifest)
              return (camera, delta, paused) => reader.update(camera, paused, 0, delta)
            },
          })
        )
      )
      this.ambience = new ValenceAmbience(this)
      this.thread = this.add.graphics().setDepth(-40)
      this.makeGlowTexture()
      for (const id of Object.keys(objectSpots) as PioneerObjectId[]) {
        const spot = objectSpots[id]
        if (!this.textures.exists(`valence-object-${id}`)) continue
        this.objectGlow.set(
          id,
          this.add
            .image(spot.x, spot.y - 6, 'valence-object-glow')
            .setDepth(spot.y - 0.5)
            .setBlendMode(Phaser.BlendModes.ADD)
            .setDisplaySize(48, 30)
            .setAlpha(0)
        )
        this.objects.set(
          id,
          this.add
            .image(spot.x, spot.y, `valence-object-${id}`)
            .setOrigin(0.5, 0.85)
            .setDisplaySize(26, 26)
            .setDepth(spot.y)
        )
      }
      this.shadow = this.add.ellipse(0, 0, 24, 8, 0x3b2414, 0.22).setDepth(-1)
      this.avatar = this.add
        .image(this.position.x, this.position.y, 'blob-idle-down')
        .setOrigin(0.5, 0.95)
        .setDisplaySize(AVATAR_SIZE, AVATAR_SIZE)
      this.ghost = this.add
        .image(this.position.x, this.position.y, 'blob-idle-down')
        .setOrigin(0.5, 0.95)
        .setDepth(2200)
        .setAlpha(0)
      this.destination = this.add
        .image(0, 0, 'navigation-destination')
        .setOrigin(0.5, 0.92)
        .setDepth(3001)
        .setVisible(false)
        .setTint(0x6b4423)
      this.blocked = this.add.image(0, 0, 'navigation-blocked').setDepth(3001).setVisible(false)
      this.debugLayer = this.add.graphics().setDepth(3000)
      this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q', false) as Record<
        string,
        Phaser.Input.Keyboard.Key
      >
      window.addEventListener('blur', this.blur)
      window.addEventListener('focus', this.focusWindow)
      const dispose = () => {
        alive = false
        observer.disconnect()
        window.removeEventListener('blur', this.blur)
        window.removeEventListener('focus', this.focusWindow)
        this.tiles.destroy()
      }
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
      this.events.once(Phaser.Scenes.Events.DESTROY, dispose)
      this.cameras.main.centerOn(this.position.x, this.position.y)
      this.buildThread()
      // Warm the lazy pathfinding grid while the introduction is read, one route at a time.
      const warm = threadOrder.map(id => stationAnchors[id])
      let next = 0
      const warmUp = () => {
        if (!alive || next >= warm.length) return
        this.pathfinder.find(this.position, warm[next++])
        setTimeout(warmUp, 60)
      }
      setTimeout(warmUp, 600)
      onReady()
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

    /** One walkable route per pair of consecutive stations, in the order of the dates,
     * precomputed by scripts/valence/build_navigation.py along the middle of the streets. */
    buildThread() {
      this.threadPaths = anchors.thread.map(path => path.map(([x, y]) => ({ x, y })))
      this.threadSignature = ''
    }

    drawThread(delta: number, reducedMotion: boolean) {
      const visited = controls.visited
      const next = threadOrder.findIndex(id => !visited.has(id))
      if (!reducedMotion) this.threadPhase = (this.threadPhase + delta * 0.006) % 12
      const signature = `${[...visited].join(',')}:${reducedMotion ? 0 : Math.round(this.threadPhase * 4)}`
      if (signature === this.threadSignature) return
      this.threadSignature = signature
      const graphics = this.thread.clear()
      this.threadPaths.forEach((path, index) => {
        const done = visited.has(threadOrder[index]) && visited.has(threadOrder[index + 1])
        const current = index === next - 1 || (next === 0 && index === 0)
        const alpha = done ? 0.62 : current ? 0.72 : 0.32
        const width = done || current ? 2.2 : 1.6
        const offset = current ? this.threadPhase : 0
        graphics.lineStyle(width, 0x4a2e17, alpha)
        let carry = -offset
        for (let i = 0; i < path.length - 1; i++) {
          const a = path[i],
            b = path[i + 1]
          const length = Math.hypot(b.x - a.x, b.y - a.y)
          if (!length) continue
          for (let t = carry; t < length; t += 12) {
            const start = Math.max(0, t)
            const end = Math.min(length, t + 6)
            if (end <= start) continue
            graphics.lineBetween(
              a.x + ((b.x - a.x) * start) / length,
              a.y + ((b.y - a.y) * start) / length,
              a.x + ((b.x - a.x) * end) / length,
              a.y + ((b.y - a.y) * end) / length
            )
          }
          carry = ((carry - length) % 12 + 12) % 12 - 12
        }
      })
    }

    project(point: Point, zoom: number) {
      const camera = this.cameras.main
      const width = this.scale.width
      const height = this.scale.height
      return {
        x: (((point.x - camera.scrollX - width / 2) * zoom + width / 2) * parent.clientWidth) / width,
        y: (((point.y - camera.scrollY - height / 2) * zoom + height / 2) * parent.clientHeight) / height,
      }
    }

    update(time: number, delta: number) {
      if (!this.avatar) return
      this.clock += delta
      const animating = canAnimateWorld(controls.stand === true, this.active, document.hidden)
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (this.input.keyboard) this.input.keyboard.enabled = !controls.paused
      if (this.previousNavigation !== controls.navigation) {
        this.pathfinder = new Pathfinder(controls.navigation)
        this.previousNavigation = controls.navigation
        this.buildThread()
      }
      if (this.lastReset !== controls.reset) {
        this.lastReset = controls.reset
        this.blobAvatar.reset()
        this.position = findSafePosition(VALENCE_SPAWN, controls.navigation, {
          width: VALENCE_WIDTH,
          height: VALENCE_HEIGHT,
        }) ?? { ...VALENCE_SPAWN }
        this.resetInput()
        this.cameras.main.centerOn(this.position.x, this.position.y)
      }
      if (controls.travelTo) {
        const target = controls.travelTo
        controls.travelTo = undefined
        this.position =
          findSafePosition(target, controls.navigation, { width: VALENCE_WIDTH, height: VALENCE_HEIGHT }) ??
          this.position
        this.blobAvatar.reset()
        this.resetInput()
        this.cameras.main.centerOn(this.position.x, this.position.y)
      }
      let direction = controls.direction
      const horizontal =
        Number(this.keys.RIGHT.isDown || this.keys.D.isDown) -
        Number(this.keys.LEFT.isDown || this.keys.A.isDown || this.keys.Q.isDown)
      const vertical =
        Number(this.keys.DOWN.isDown || this.keys.S.isDown) -
        Number(this.keys.UP.isDown || this.keys.W.isDown || this.keys.Z.isDown)
      if (horizontal || vertical) direction = { x: horizontal, y: vertical }
      const manual = Math.hypot(direction.x, direction.y) >= 0.12
      if (manual || controls.cancelWalk) {
        controls.cancelWalk = false
        this.route.cancel()
        controls.walkToScreen = undefined
        controls.pointerPress = undefined
      }
      const camera = this.cameras.main
      const press = controls.pointerPress
      if (press && isPointerSteering(press, performance.now())) {
        this.route.cancel()
        controls.walkToScreen = undefined
        const target = camera.getWorldPoint(
          (press.screen.x * this.scale.width) / parent.clientWidth,
          (press.screen.y * this.scale.height) / parent.clientHeight
        )
        direction = pointerDirection(
          { x: target.x - this.position.x, y: target.y - (this.position.y - 14) },
          {
            x: (camera.zoom * parent.clientWidth) / this.scale.width,
            y: (camera.zoom * parent.clientHeight) / this.scale.height,
          }
        )
      }
      if (controls.paused || !this.active || document.hidden) {
        direction = { x: 0, y: 0 }
        this.resetInput()
      }
      if (controls.walkToScreen) {
        const screen = controls.walkToScreen
        controls.walkToScreen = undefined
        const target = camera.getWorldPoint(
          (screen.x * this.scale.width) / parent.clientWidth,
          (screen.y * this.scale.height) / parent.clientHeight
        )
        const path = this.pathfinder.find(this.position, target)
        this.route.points = path ?? []
        this.rejected = path ? undefined : target
        this.blockedUntil = time + 600
      }
      const following = this.route.points.length > 0
      const next = following
        ? this.route.advance(this.position, delta / 1000, controls.navigation)
        : move(this.position, direction, delta / 1000, controls.navigation)
      if (following) {
        const length = Math.hypot(next.x - this.position.x, next.y - this.position.y)
        direction = length ? { x: (next.x - this.position.x) / length, y: (next.y - this.position.y) / length } : { x: 0, y: 0 }
      }
      const moving = Math.hypot(next.x - this.position.x, next.y - this.position.y) > 0.01
      this.position = next
      if (moving) {
        const length = Math.max(1, Math.hypot(direction.x, direction.y))
        this.facing = { x: direction.x / length, y: direction.y / length }
      }
      this.blobAvatar.update(
        this.avatar,
        direction,
        moving,
        reducedMotion,
        delta,
        controls.avatar,
        !controls.paused && animating
      )
      // Avatar sheets are drawn for World's 52-unit scale; Valence's townsfolk are smaller.
      const scale = AVATAR_SIZE / 52
      this.avatar
        .setDisplaySize(this.avatar.displayWidth * scale, this.avatar.displayHeight * scale)
        .setTint(Number.parseInt(controls.avatarColor.slice(1), 16))
        .setPosition(next.x, next.y)
        .setDepth(next.y)
      this.shadow.setPosition(next.x, next.y)
      const hidden = valenceOccluders.some(
        o =>
          o.baseY > next.y + 2 &&
          next.x > o.x + 4 &&
          next.x < o.x + o.width - 4 &&
          next.y - 18 > o.y &&
          next.y - 18 < o.y + o.height
      )
      const ghostAlpha = Phaser.Math.Linear(
        this.ghost.alpha,
        hidden ? 0.42 : 0,
        1 - Math.exp(-Math.min(delta, 50) / 90)
      )
      this.ghost
        .setTexture(this.avatar.texture.key, this.avatar.frame.name)
        .setFlipX(this.avatar.flipX)
        .setOrigin(this.avatar.originX, this.avatar.originY)
        .setDisplaySize(this.avatar.displayWidth, this.avatar.displayHeight)
        .setTint(Number.parseInt(controls.avatarColor.slice(1), 16))
        .setPosition(next.x, next.y)
        .setAlpha(ghostAlpha)
        .setVisible(ghostAlpha > 0.01)

      // Camera.
      const screenWidth = this.scale.width
      const screenHeight = this.scale.height
      const bounds = cameraZoomBounds(screenWidth, screenHeight, VALENCE_WIDTH, VALENCE_HEIGHT, VALENCE_HEIGHT, RESOLUTION)
      const atMinimum = controls.zoom <= controls.minimumZoom
      controls.minimumZoom = bounds.minimum
      controls.zoom = atMinimum ? bounds.minimum : clampCameraZoom(controls.zoom, bounds.minimum)
      if (!controls.paused && (manual || controls.pointerPress || this.route.points.length))
        controls.arrivalStartedAt = undefined
      const arrival = arrivalZoom(controls.arrivalStartedAt, performance.now(), bounds.minimum, controls.zoom)
      const zoom =
        arrival !== undefined
          ? bounds.base * (reducedMotion && controls.arrivalStartedAt !== null ? controls.zoom : arrival)
          : controls.overview
            ? bounds.overview
            : bounds.base * controls.zoom
      camera.setZoom(zoom)
      const targetX = controls.overview ? VALENCE_WIDTH / 2 : next.x
      const targetY = controls.overview ? VALENCE_HEIGHT / 2 : next.y - (32 * RESOLUTION) / zoom
      const halfWidth = screenWidth / zoom / 2
      const halfHeight = screenHeight / zoom / 2
      const centerX =
        halfWidth > VALENCE_WIDTH / 2 ? VALENCE_WIDTH / 2 : Phaser.Math.Clamp(targetX, halfWidth, VALENCE_WIDTH - halfWidth)
      const centerY =
        halfHeight > VALENCE_HEIGHT / 2
          ? VALENCE_HEIGHT / 2
          : Phaser.Math.Clamp(targetY, halfHeight, VALENCE_HEIGHT - halfHeight)
      const smoothing = arrival !== undefined ? 1 : 1 - Math.exp(-Math.min(delta, 50) / 110)
      camera.scrollX += (centerX - screenWidth / 2 - camera.scrollX) * smoothing
      camera.scrollY += (centerY - screenHeight / 2 - camera.scrollY) * smoothing

      // Markers keep a constant screen size.
      const markerScale = screenWidth / parent.clientWidth / zoom
      const walking = this.route.points.length > 0
      this.destination.setVisible(walking).setDisplaySize(30 * markerScale, 30 * markerScale)
      if (walking) {
        const target = this.route.points[this.route.points.length - 1]
        this.destination.setPosition(target.x, target.y)
      }
      const showBlocked = Boolean(this.rejected && time < this.blockedUntil)
      this.blocked.setVisible(showBlocked).setDisplaySize(26 * markerScale, 26 * markerScale)
      if (this.rejected) this.blocked.setPosition(this.rejected.x, this.rejected.y)

      // Thread, objects and DOM tags.
      this.drawThread(delta, reducedMotion)
      const breathing = reducedMotion ? 0 : Math.sin(this.clock / 520)
      for (const [id, image] of this.objects) {
        const found = controls.found.has(id)
        const spot = objectSpots[id]
        image.setVisible(!found).setY(spot.y - (reducedMotion ? 0 : 2 + breathing * 2))
        this.objectGlow
          .get(id)
          ?.setVisible(!found)
          .setAlpha(found ? 0 : 0.35 + 0.25 * (breathing + 1) * 0.5)
      }
      for (const id of Object.keys(stationLabels) as StationId[]) {
        const tag = controls.stationTags?.[id]
        if (!tag) continue
        const point = this.project(stationLabels[id], zoom)
        // Off-screen tags hide; visible ones stay clear of the screen edges and the top bar.
        const offscreen =
          point.x < -40 || point.x > parent.clientWidth + 40 || point.y < 40 || point.y > parent.clientHeight + 30
        if (tag.dataset.offscreen !== String(offscreen)) tag.dataset.offscreen = String(offscreen)
        const half = tag.offsetWidth / 2 + 8
        const x = Math.min(Math.max(point.x, half), parent.clientWidth - half)
        const y = Math.max(point.y, 140)
        tag.style.translate = `${x}px ${y}px`
      }
      for (const id of Object.keys(objectSpots) as PioneerObjectId[]) {
        const tag = controls.objectTags?.[id]
        if (!tag) continue
        const point = this.project({ x: objectSpots[id].x, y: objectSpots[id].y - 26 }, zoom)
        tag.style.translate = `${point.x}px ${point.y}px`
      }

      // Streaming and life.
      const canStream = animating
      const arrivalTarget =
        arrival !== undefined && !reducedMotion
          ? arrivalTileTarget(camera, bounds.base * controls.zoom, next, RESOLUTION, {
              worldWidth: VALENCE_WIDTH,
              worldHeight: VALENCE_HEIGHT,
            })
          : undefined
      this.tiles.update(camera, time, 1, canStream, arrivalTarget)
      this.occluders.update(camera, delta, canStream, arrivalTarget?.view)
      const paused = controls.paused || !animating
      this.scenes.update(camera, canStream, update => update(camera, delta, paused), {
        view: arrivalTarget?.view,
        concurrent: true,
      })
      this.ambience.update(camera, delta, paused, reducedMotion, next)

      this.debugLayer.clear()
      if (import.meta.env.DEV && controls.debug) {
        for (const { points, kind } of controls.navigation.zones) {
          const shape = points.map(([x, y]) => new Phaser.Geom.Point(x, y))
          this.debugLayer
            .fillStyle(kind === 'allowed' ? 0x44ffb0 : 0xff3355, kind === 'allowed' ? 0.14 : 0.35)
            .lineStyle(1, kind === 'allowed' ? 0x007348 : 0xcc2040, 0.8)
            .fillPoints(shape, true)
            .strokePoints(shape, true)
        }
        for (const anchor of Object.values(stationAnchors))
          this.debugLayer.lineStyle(1, 0x2040ff, 0.9).strokeCircle(anchor.x, anchor.y, 62)
        this.debugLayer.fillStyle(0xffffff).fillCircle(next.x, next.y, 3)
      }
      if (time - this.lastPublished > 100) {
        this.lastPublished = time
        publish({ x: next.x, y: next.y, moving, fps: Math.round(this.game.loop.actualFps) })
      }
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: Math.max(1, Math.round(parent.clientWidth * RESOLUTION)),
    height: Math.max(1, Math.round(parent.clientHeight * RESOLUTION)),
    zoom: 1 / RESOLUTION,
    parent,
    backgroundColor: PAPER,
    scene: ValenceScene,
    scale: { mode: Phaser.Scale.NONE },
    render: { pixelArt: false, antialias: true, antialiasGL: true, roundPixels: false },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
  })
}
