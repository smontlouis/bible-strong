// The Phaser scene every world is built on (docs/adr/0085): the traveller's avatar and how it
// walks (keyboard, joystick, pointer, click-to-walk), the camera and its arrival zoom, the
// multiplayer room, other visitors, reactions and stand passers-by, the walking markers, the
// name label, bushes, map tiles, ambient zones, shorelines and the navigation diagnostics.
// A world subclasses it and adds what is its own through createScenery() and updateScenery().
import Phaser from 'phaser'
import { AmbientZoneEditor } from './ambient-zone-editor'
import type { AmbientEditorModel } from './ambient-zones'
import type { AvatarActivity } from './avatar-activity'
import type { AvatarId } from './avatar-profile'
import { AvatarReactions, loadReactions } from './avatar-reactions'
import { avatarTint, type AvatarTone } from './avatar-tone'
import { BlobAvatar, loadBlobAvatar } from './blob-avatar'
import { BushRustle } from './bush-rustle'
import { cameraZoomBounds, clampCameraZoom } from './camera-zoom'
import type { DiagnosticFilters } from './diagnostic-filters'
import { MapTileStreamer, type MapTileSource } from './map-tile-streamer'
import { arrivalTileTarget } from './map-tiles'
import { WorldMultiplayer } from './multiplayer'
import type { PresenceStatus } from './multiplayer-protocol'
import { Pathfinder } from './pathfinding'
import { isPointerSteering, pointerDirection, type PointerPress } from './pointer-steering'
import type { ReactionId } from './reactions'
import { RemoteAvatars } from './remote-avatars'
import { ShoreWaves } from './shore-waves'
import type { ShoreEditorModel } from './shorelines'
import type { StandCrowd } from './stand-crowd'
import { WalkingRoute } from './walking-route'
import { findSafePosition, move, type NavigationDocument, type Point } from './world'
import { canAnimateWorld } from './world-activity'
import { WorldAmbience } from './world-ambience'
import { arrivalZoom } from './world-arrival'

export const RESOLUTION = Math.min(window.devicePixelRatio || 1, 2)
/** The avatar sheets are drawn for this size, the archipelago's. */
const AVATAR_SHEET_SIZE = 52

/** What React and the scene share; each world adds its own fields. */
export type SceneControls = {
  navigation: NavigationDocument
  direction: Point
  avatar: AvatarId
  avatarColor: string
  avatarName: string
  paused: boolean
  overview: boolean
  debug: boolean
  diagnosticFilters?: DiagnosticFilters
  zoom: number
  minimumZoom: number
  reset: number
  stand?: boolean
  pointerPress?: PointerPress
  walkToScreen?: Point
  cancelWalk?: boolean
  travelTo?: Point
  arrivalStartedAt?: number | null
  activity?: AvatarActivity | null
  multiplayerEnabled?: boolean
  network?: WorldMultiplayer
  sendReaction?: (reaction: ReactionId) => boolean
  retryMultiplayer?: () => void
  /** Floating actions under the visitor's avatar while another visitor is within reach. */
  contactActions?: HTMLDivElement | null
  /** Set when the visitor came through a portal: they appear there, not where the server suggests. */
  portalArrival?: Point
  shoreEditor?: ShoreEditorModel
  ambientEditor?: AmbientEditorModel
  /** Zoom requested by the workshop's zoom buttons; consumed once. */
  shoreZoom?: number
  /** Stand screen: a drag to apply to the view, in page pixels; consumed once. */
  panBy?: Point
  /** Stand screen: when someone last touched it, so the tour can step aside. */
  touchedAt?: number
  /** Stand screen: the page point a wheel or a pinch zooms around, in page pixels; consumed once. */
  zoomAnchor?: Point
  /** Stand screen: where the tour flies, a place or a visitor, and how close it looks. */
  tour?: { point?: Point; visitor?: string; zoom: number } | null
}

export type SceneState = { x: number; y: number; moving: boolean; fps: number; multiplayer?: PresenceStatus }

/** How a world dresses what the base scene draws. */
export type WorldLook = {
  background: string
  avatarShadow: number
  avatarShadowAlpha: number
  name: string
  nameBackground: number
  /** Tint of the walking destination arrow, if any. */
  markerTint?: number
  /** Foam along the shorelines. */
  foam?: number
  /** Ages every avatar's colour to match the world's print. */
  avatarTone?: AvatarTone
}

export type WorldSceneOptions<Controls extends SceneControls> = {
  key: string
  parent: HTMLElement
  controls: Controls
  onReady: () => void
  onError: () => void
  /** The map, in source units: walking, spawning and the camera's follow stay inside it. */
  width: number
  height: number
  /** The drawn extent, centred on the map, that the farthest zoom-out frames, when the scenery
   * reaches past the map. */
  scenery?: { width: number; height: number }
  /** How far above the feet the camera looks, in screen pixels. */
  cameraLift: number
  avatarSize: number
  look: WorldLook
  /** The world's multiplayer room; the archipelago's by default. */
  room?: string
  /** The progressive map: a low-resolution preview and its tiles (the archipelago's by default). */
  preview: string
  tiles?: MapTileSource
}

/** What a world receives every frame once the avatar and the camera have moved. */
export type SceneFrame = {
  time: number
  delta: number
  next: Point
  moving: boolean
  camera: Phaser.Cameras.Scene2D.Camera
  zoom: number
  screenWidth: number
  screenHeight: number
  /** World units per screen pixel, to keep markers and labels a constant screen size. */
  scaleX: number
  scaleY: number
  /** Label visibility from the zoom level, 0 to 1. */
  labelFade: number
  reducedMotion: boolean
  /** The world may animate: visible, focused, or a stand. */
  animating: boolean
  /** Scenery stops: a dialog is open (outside the workshop), or the world cannot animate. */
  paused: boolean
  /** The workshop moves the camera itself. */
  freeCamera: boolean
  /** The tiles and cut-outs to load first during the arrival zoom. */
  arrivalTarget?: ReturnType<typeof arrivalTileTarget>
}

type Marker = { shown: boolean; alpha: number; size: number }

export abstract class WorldScene<Controls extends SceneControls = SceneControls> extends Phaser.Scene {
  readonly controls: Controls
  readonly parent: HTMLElement
  position: Point = { x: 0, y: 0 }
  facing = { x: 0, y: 1 }
  /** A portal arrival keeps its place over the room's first suggested spawn. */
  keepArrival: boolean
  avatar!: Phaser.GameObjects.Image
  shadow!: Phaser.GameObjects.Ellipse
  nameTag!: Phaser.GameObjects.Text
  nameTagBackground!: Phaser.GameObjects.Graphics
  debugLayer!: Phaser.GameObjects.Graphics
  blobAvatar = new BlobAvatar()
  pathfinder: Pathfinder
  route = new WalkingRoute()
  network!: WorldMultiplayer
  remoteAvatars!: RemoteAvatars
  reactions!: AvatarReactions
  standCrowd?: StandCrowd
  standAvatars?: RemoteAvatars
  standReactions?: AvatarReactions
  bushes!: BushRustle
  tiles!: MapTileStreamer
  /** The ambient zones: particles, butterflies, glows… edited in the workshop. */
  ambience!: WorldAmbience
  ambientZoneEditor?: AmbientZoneEditor
  shoreWaves?: ShoreWaves
  alive = true
  /** A stand screen: no avatar, a free view, the room watched instead of joined. */
  get spectator() {
    return this.controls.stand === true
  }
  private follow = 0
  /** The view the camera was heading to last frame, to keep a zoom's anchor under the pointer. */
  private lastView?: { x: number; y: number; zoom: number }
  active = true
  private keys!: Record<string, Phaser.Input.Keyboard.Key>
  private lastReset = 0
  private lastPublished = 0
  private previousNavigation: NavigationDocument
  private destinationMarker!: Phaser.GameObjects.Image
  private destinationShadow!: Phaser.GameObjects.Ellipse
  private blockedMarker!: Phaser.GameObjects.Image
  private destinationMotion: Marker = { shown: false, alpha: 0, size: 0.25 }
  private blockedMotion: Marker = { shown: false, alpha: 0, size: 0.25 }
  private rejectedTarget?: Point
  private rejectedUntil = 0

  constructor(readonly options: WorldSceneOptions<Controls>) {
    super({ key: options.key })
    this.controls = options.controls
    this.parent = options.parent
    this.keepArrival = Boolean(options.controls.portalArrival)
    this.pathfinder = new Pathfinder(options.controls.navigation)
    this.previousNavigation = options.controls.navigation
  }

  // ---- What a world provides -------------------------------------------------------------

  /** Where a visitor first appears. */
  abstract arrival(): Point
  /** Where "start again" puts the visitor; the arrival by default. */
  resetPosition(): Point {
    return this.arrival()
  }
  /** The world's own images, loaded before the scene starts. */
  preloadScenery(): void {}
  /** The world's own scenery, created after the map, before the avatars. */
  abstract createScenery(): void
  /** The world's own life, every frame, once the avatar and the camera have moved. */
  updateScenery(_frame: SceneFrame): void {}
  /** Passers-by for the stand screen or a quiet room; none by default. */
  createCrowd(): StandCrowd | undefined {
    return undefined
  }
  createBushes(): BushRustle {
    return new BushRustle(this, [])
  }
  /** Whether the workshop moves the camera itself. */
  freeCamera(): boolean {
    return Boolean(this.controls.shoreEditor?.editing || this.controls.ambientEditor?.editing)
  }
  /** Extra diagnostics drawn with the walkable zones. */
  drawDebug(_layer: Phaser.GameObjects.Graphics, _frame: SceneFrame): void {}
  /** The state React reads, ten times a second. */
  abstract publishState(frame: SceneFrame): void

  // ---- Helpers ---------------------------------------------------------------------------

  /** A map point in page pixels, for DOM elements laid over the map. */
  project(point: Point, zoom = this.cameras.main.zoom) {
    const camera = this.cameras.main
    const width = this.scale.width
    const height = this.scale.height
    return {
      x: (((point.x - camera.scrollX - width / 2) * zoom + width / 2) * this.parent.clientWidth) / width,
      y: (((point.y - camera.scrollY - height / 2) * zoom + height / 2) * this.parent.clientHeight) / height,
    }
  }

  safePosition(point: Point) {
    return findSafePosition(point, this.controls.navigation, { width: this.options.width, height: this.options.height })
  }

  resetInput = () => {
    this.controls.pointerPress = undefined
    this.controls.walkToScreen = undefined
    this.controls.direction = { x: 0, y: 0 }
    this.route.cancel()
    this.rejectedTarget = undefined
    this.input.keyboard?.resetKeys()
  }
  private blur = () => {
    this.active = false
    this.resetInput()
  }
  private focusWindow = () => {
    this.active = true
  }
  private cancelWalkOnKey = (event: KeyboardEvent) => {
    if (
      !this.controls.paused &&
      ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ'].includes(event.code)
    ) {
      this.route.cancel()
      this.controls.pointerPress = undefined
      this.rejectedTarget = undefined
      this.controls.walkToScreen = undefined
    }
  }
  private animateMarker(motion: Marker, shown: boolean, reducedMotion: boolean) {
    if (reducedMotion) {
      this.tweens.killTweensOf(motion)
      motion.shown = shown
      motion.alpha = shown ? 1 : 0
      motion.size = 1
      return
    }
    if (motion.shown === shown) return
    this.tweens.killTweensOf(motion)
    if (shown && motion.alpha === 0) motion.size = 0.25
    motion.shown = shown
    this.tweens.add({ targets: motion, alpha: shown ? 1 : 0, size: shown ? 1 : 0.94, duration: shown ? 180 : 140, ease: 'Cubic.Out' })
  }

  // ---- Phaser lifecycle ------------------------------------------------------------------

  preload() {
    loadBlobAvatar(this)
    loadReactions(this)
    this.load.image(`${this.options.key}-preview`, this.options.preview)
    this.load.image('navigation-destination', './assets/navigation/destination-arrow.webp')
    this.load.image('navigation-blocked', './assets/navigation/blocked-cross.webp')
    this.preloadScenery()
    this.load.on('loaderror', this.options.onError)
  }

  create() {
    const { controls, parent, options } = this
    // Optional lazy assets must never turn a usable world into a loading error.
    this.load.off('loaderror', options.onError)
    // RESIZE replaces the backing buffer with CSS dimensions, losing Retina detail.
    // NONE keeps physical pixels while displaying the canvas at CSS size.
    const resize = () => {
      if (!this.alive) return
      this.scale.resize(
        Math.max(1, Math.round(parent.clientWidth * RESOLUTION)),
        Math.max(1, Math.round(parent.clientHeight * RESOLUTION))
      )
    }
    const observer = new ResizeObserver(resize)
    observer.observe(parent)
    resize()
    this.position = this.spectator
      ? { x: options.width / 2, y: options.height / 2 }
      : (controls.portalArrival && this.safePosition(controls.portalArrival)) || this.arrival()
    // A stand screen opens on the whole world.
    if (this.spectator) controls.zoom = 0
    this.cameras.main.setBackgroundColor(options.look.background)
    this.add.image(0, 0, `${options.key}-preview`).setOrigin(0).setDisplaySize(options.width, options.height).setDepth(-110)
    this.tiles = new MapTileStreamer(this, options.tiles)
    this.bushes = this.createBushes()
    this.createScenery()
    this.ambience = new WorldAmbience(this, controls.ambientEditor)
    if (import.meta.env.DEV && controls.ambientEditor)
      this.ambientZoneEditor = new AmbientZoneEditor(this, controls.ambientEditor)
    if (controls.shoreEditor) this.shoreWaves = new ShoreWaves(this, controls.shoreEditor, options.look.foam)

    // The room, other visitors and reactions.
    const scale = options.avatarSize / AVATAR_SHEET_SIZE
    const tone = options.look.avatarTone
    const remoteLook = { scale, shadow: options.look.avatarShadow, text: options.look.name, background: hex(options.look.nameBackground), tone }
    this.network = new WorldMultiplayer(options.room)
    controls.network = this.network
    this.remoteAvatars = new RemoteAvatars(this, RESOLUTION, remoteLook)
    this.reactions = new AvatarReactions(this, tone)
    this.standCrowd = this.createCrowd()
    if (this.standCrowd) {
      this.standAvatars = new RemoteAvatars(this, RESOLUTION, remoteLook)
      this.standReactions = new AvatarReactions(this, tone)
    }
    controls.sendReaction = reaction => {
      if (controls.paused || !this.active || document.hidden) return false
      const sent = this.network.sendReaction(reaction)
      const local = this.standCrowd?.react(reaction, this.position, performance.now(), !sent) ?? false
      return sent || local
    }
    controls.retryMultiplayer = () => this.network.retry()

    // The visitor.
    this.shadow = this.add
      .ellipse(this.position.x, this.position.y, 30 * scale, 10 * scale, options.look.avatarShadow, options.look.avatarShadowAlpha)
      .setDepth(-1)
    this.avatar = this.add
      .image(this.position.x, this.position.y, 'blob-idle-down')
      .setOrigin(0.5, 0.95)
      .setDisplaySize(options.avatarSize, options.avatarSize)
    // Keep the label above scenery and clouds, independently of the avatar's depth.
    this.nameTagBackground = this.add.graphics().setDepth(4000)
    this.nameTag = this.add
      .text(this.position.x, this.position.y + 5, '', {
        fontFamily: 'Pulp, sans-serif',
        fontSize: '12px',
        color: options.look.name,
        padding: { x: 5, y: 3 },
      })
      .setOrigin(0.5, 0)
      .setResolution(RESOLUTION)
      .setDepth(4001)
    this.debugLayer = this.add.graphics().setDepth(3000)
    this.destinationShadow = this.add.ellipse(0, 0, 14, 6, options.look.avatarShadow).setDepth(3000).setVisible(false)
    this.destinationMarker = this.add.image(0, 0, 'navigation-destination').setOrigin(0.5, 0.9234).setDepth(3001).setVisible(false)
    if (options.look.markerTint !== undefined) this.destinationMarker.setTint(options.look.markerTint)
    this.blockedMarker = this.add.image(0, 0, 'navigation-blocked').setDepth(3001).setVisible(false)

    // Global key capture would block typing in DOM inputs even when this scene is paused.
    this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q', false) as Record<string, Phaser.Input.Keyboard.Key>
    this.input.keyboard!.on('keydown', this.cancelWalkOnKey)
    window.addEventListener('blur', this.blur)
    window.addEventListener('focus', this.focusWindow)
    let disposed = false
    const dispose = () => {
      if (disposed) return
      disposed = true
      this.alive = false
      observer.disconnect()
      window.removeEventListener('blur', this.blur)
      window.removeEventListener('focus', this.focusWindow)
      this.input.keyboard?.off('keydown', this.cancelWalkOnKey)
      this.tiles.destroy()
      this.network.destroy()
      if (controls.network === this.network) {
        controls.network = undefined
        controls.retryMultiplayer = undefined
        controls.sendReaction = undefined
      }
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
    this.events.once(Phaser.Scenes.Events.DESTROY, dispose)
    if (this.spectator) for (const own of [this.avatar, this.shadow, this.nameTag, this.nameTagBackground]) own.setVisible(false)
    this.cameras.main.centerOn(this.position.x, this.position.y)
    options.onReady()
  }

  update(time: number, delta: number) {
    if (!this.avatar) return
    const { controls, parent, options } = this
    const animating = canAnimateWorld(controls.stand === true, this.active, document.hidden)
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const freeCamera = this.freeCamera()
    if (this.input.keyboard) this.input.keyboard.enabled = !controls.paused

    // Jumps: a new navigation document, a reset, the room's spawn, a travel from the journal.
    if (this.previousNavigation !== controls.navigation) {
      this.pathfinder = new Pathfinder(controls.navigation)
      this.previousNavigation = controls.navigation
      this.position = this.safePosition(this.position) ?? this.position
      this.resetInput()
    }
    if (this.lastReset !== controls.reset) {
      this.lastReset = controls.reset
      this.blobAvatar.reset()
      this.position = this.resetPosition()
      this.resetInput()
      this.cameras.main.centerOn(this.position.x, this.position.y)
    }
    const welcome = this.network.takeSpawn()
    if (welcome && this.keepArrival) this.keepArrival = false
    else if (welcome) {
      this.position = { x: welcome.x, y: welcome.y }
      this.facing = { x: welcome.dx, y: welcome.dy }
      this.blobAvatar.reset()
      this.resetInput()
      this.cameras.main.centerOn(welcome.x, welcome.y)
    }
    if (controls.travelTo) {
      const target = controls.travelTo
      controls.travelTo = undefined
      this.position = this.safePosition(target) ?? this.position
      this.blobAvatar.reset()
      this.resetInput()
      this.cameras.main.centerOn(this.position.x, this.position.y)
    }

    // A stand screen moves a view; a visitor walks.
    const { next, moving, manual } = this.spectator ? this.spectate(delta) : this.walk(time, delta, animating, reducedMotion)
    const camera = this.cameras.main

    // The camera: follows the avatar, zooms in on arrival, or leaves the workshop in charge.
    const screenWidth = this.scale.width
    const screenHeight = this.scale.height
    const scenery = options.scenery ?? { width: options.width, height: options.height }
    const bounds = cameraZoomBounds(screenWidth, screenHeight, scenery.width, scenery.height, options.height, RESOLUTION)
    // Keep a fully zoomed-out view fitted when the viewport rotates or resizes.
    const atMinimum = controls.zoom <= controls.minimumZoom
    controls.minimumZoom = bounds.minimum
    controls.zoom = atMinimum ? bounds.minimum : clampCameraZoom(controls.zoom, bounds.minimum)
    if (!controls.paused && (manual || controls.pointerPress || controls.walkToScreen || this.route.points.length))
      controls.arrivalStartedAt = undefined
    const cameraArrival = arrivalZoom(controls.arrivalStartedAt, performance.now(), bounds.minimum, controls.zoom)
    if (freeCamera) {
      if (controls.shoreZoom) {
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * controls.shoreZoom, 0.3, 10))
        controls.shoreZoom = undefined
      }
    } else {
      const zoom =
        cameraArrival !== undefined
          ? bounds.base * (reducedMotion && controls.arrivalStartedAt !== null ? controls.zoom : cameraArrival)
          : controls.overview
            ? bounds.overview
            : bounds.base * controls.zoom
      const { width, height } = options
      const targetX = controls.overview ? width / 2 : next.x
      const lift = this.spectator ? 0 : options.cameraLift
      const targetY = controls.overview ? height / 2 : next.y - (lift * RESOLUTION) / zoom
      // The farthest zoom-out shows the whole scenery, centred; zooming in glides the camera onto
      // the avatar, which is centred once the view covers less than 55% of the scenery. Every
      // world draws past its map (the archipelago's sea, Valence's wall), so nothing bounds it.
      const cover = Math.max(screenWidth / zoom / scenery.width, screenHeight / zoom / scenery.height)
      const follow = Phaser.Math.SmoothStep(Phaser.Math.Clamp((1 - cover) / 0.45, 0, 1), 0, 1)
      this.follow = follow
      let centerX = width / 2 + (targetX - width / 2) * follow
      let centerY = height / 2 + (targetY - height / 2) * follow
      // A stand screen zooms around the pointer, like a map: the point under it stays put.
      const anchor = controls.zoomAnchor
      controls.zoomAnchor = undefined
      if (this.spectator && anchor && this.lastView && this.lastView.zoom !== zoom && follow > 0.02) {
        const k = screenWidth / parent.clientWidth
        const ax = anchor.x * k - screenWidth / 2
        const ay = anchor.y * k - screenHeight / 2
        const pointerX = this.lastView.x + ax / this.lastView.zoom
        const pointerY = this.lastView.y + ay / this.lastView.zoom
        this.position = {
          x: Phaser.Math.Clamp(width / 2 + (pointerX - ax / zoom - width / 2) / follow, 0, width),
          y: Phaser.Math.Clamp(height / 2 + (pointerY - ay / zoom - height / 2) / follow, 0, height),
        }
        centerX = width / 2 + (this.position.x - width / 2) * follow
        centerY = height / 2 + (this.position.y - height / 2) * follow
      }
      this.lastView = { x: centerX, y: centerY, zoom }
      const smoothing = cameraArrival !== undefined ? 1 : 1 - Math.exp(-Math.min(delta, 50) / 110)
      // Zoom and travel ease together, with the same curve: a quick zoom no longer lands first
      // around the screen's centre and then slides onto the avatar. The zoom eases in log space,
      // so zooming in and out feel alike.
      camera.setZoom(Math.exp(Phaser.Math.Linear(Math.log(camera.zoom), Math.log(zoom), smoothing)))
      // Phaser zooms around the viewport centre; scroll is relative to the unzoomed viewport.
      camera.scrollX += (centerX - screenWidth / 2 - camera.scrollX) * smoothing
      camera.scrollY += (centerY - screenHeight / 2 - camera.scrollY) * smoothing
    }
    const zoom = camera.zoom

    // Walking markers and the name label keep a constant screen size.
    const scaleX = screenWidth / parent.clientWidth / zoom
    const scaleY = screenHeight / parent.clientHeight / zoom
    this.animateMarker(this.destinationMotion, this.route.points.length > 0, reducedMotion)
    const destinationSize = 36 * this.destinationMotion.size
    this.destinationMarker
      .setAlpha(this.destinationMotion.alpha)
      .setVisible(this.destinationMotion.alpha > 0)
      .setDisplaySize(destinationSize * scaleX, destinationSize * scaleY)
    this.destinationShadow
      .setAlpha(0.22 * this.destinationMotion.alpha)
      .setVisible(this.destinationMotion.alpha > 0)
      .setDisplaySize(14 * scaleX * this.destinationMotion.size, 6 * scaleY * this.destinationMotion.size)
    if (this.route.points.length) {
      const target = this.route.points[this.route.points.length - 1]
      this.destinationMarker.setPosition(target.x, target.y - 2 * scaleY)
      this.destinationShadow.setPosition(target.x, target.y)
    }
    this.animateMarker(this.blockedMotion, Boolean(this.rejectedTarget && time < this.rejectedUntil), reducedMotion)
    const blockedSize = 30 * this.blockedMotion.size
    this.blockedMarker
      .setAlpha(this.blockedMotion.alpha)
      .setVisible(this.blockedMotion.alpha > 0)
      .setDisplaySize(blockedSize * scaleX, blockedSize * scaleY)
    if (this.rejectedTarget) this.blockedMarker.setPosition(this.rejectedTarget.x, this.rejectedTarget.y)
    const fade = Phaser.Math.Clamp((zoom / bounds.base - 0.65) / 0.2, 0, 1)
    const labelFade = fade * fade * (3 - 2 * fade)
    if (this.nameTag.text !== controls.avatarName) {
      this.nameTag.setText(controls.avatarName)
      this.nameTagBackground
        .clear()
        .fillStyle(options.look.nameBackground, 1)
        .fillRoundedRect(-this.nameTag.width / 2, 0, this.nameTag.width, this.nameTag.height, 4)
    }
    const labelAlpha = Phaser.Math.Linear(this.nameTag.alpha, controls.avatarName ? labelFade : 0, 1 - Math.exp(-Math.min(delta, 50) / 100))
    for (const label of [this.nameTag, this.nameTagBackground])
      label
        .setPosition(next.x, next.y + 5 * scaleY)
        .setScale(scaleX, scaleY)
        .setAlpha(labelAlpha)
        .setVisible(Boolean(controls.avatarName) && labelAlpha > 0.01 && !freeCamera && !this.spectator)

    // Other visitors, passers-by and reactions.
    const now = performance.now()
    const lively = !controls.paused && animating
    this.remoteAvatars.update(this.network, now, delta, reducedMotion, scaleX, scaleY, labelFade, lively)
    if (this.standCrowd) {
      const view = camera.worldView
      this.standCrowd.update({
        navigation: controls.navigation,
        realCount: this.network.status.state === 'online' ? this.network.remotes.size : null,
        local: next,
        delta,
        now,
        active: lively,
        visible: point => view.contains(point.x, point.y),
      })
      if (lively) this.standCrowd.observeReactions(this.network.reactions, id => this.network.remotes.get(id)?.sample(now), now)
      this.standAvatars?.update(this.standCrowd, now, lively ? delta : 0, reducedMotion, scaleX, scaleY, labelFade, lively)
      this.standReactions?.update(this.standCrowd, { ...next, color: controls.avatarColor }, now, scaleX, scaleY, reducedMotion)
    }
    this.reactions.update(this.network, { ...next, color: controls.avatarColor }, now, scaleX, scaleY, reducedMotion)
    this.updateContactActions(next, scaleY)

    // The world's own life, then what every world streams and animates.
    const paused = (controls.paused && !freeCamera) || !animating
    const arrivalTarget =
      cameraArrival !== undefined && !reducedMotion && !freeCamera
        ? arrivalTileTarget(camera, bounds.base * controls.zoom, next, RESOLUTION, {
            worldWidth: options.width,
            worldHeight: options.height,
          })
        : undefined
    const frame: SceneFrame = {
      time,
      delta,
      next,
      moving,
      camera,
      zoom,
      screenWidth,
      screenHeight,
      scaleX,
      scaleY,
      labelFade,
      reducedMotion,
      animating,
      paused,
      freeCamera,
      arrivalTarget,
    }
    this.updateScenery(frame)
    this.tiles.update(camera, time, 1, animating, arrivalTarget)
    this.bushes.update(
      delta,
      [{ ...next, moving }, ...this.remoteAvatars.contacts, ...(this.standAvatars?.contacts ?? [])],
      reducedMotion || paused
    )
    this.ambience.update(camera, delta, next, paused)
    this.ambientZoneEditor?.update()
    this.shoreWaves?.update(
      delta,
      paused,
      import.meta.env.DEV &&
        Boolean(controls.shoreEditor?.editing || (controls.debug && controls.diagnosticFilters?.shorelines !== false))
    )

    this.debugLayer.clear()
    if (import.meta.env.DEV && controls.debug) {
      if (controls.diagnosticFilters?.navigation !== false)
        for (const { points, kind } of controls.navigation.zones) {
          const shape = points.map(([x, y]) => new Phaser.Geom.Point(x, y))
          this.debugLayer
            .fillStyle(kind === 'allowed' ? 0x44ffb0 : 0xff3355, kind === 'allowed' ? 0.15 : 0.35)
            .lineStyle(1 / zoom, kind === 'allowed' ? 0x007348 : 0xcc2040, 0.8)
            .fillPoints(shape, true)
            .strokePoints(shape, true)
        }
      this.drawDebug(this.debugLayer, frame)
      this.debugLayer.fillStyle(0xffffff).fillCircle(next.x, next.y, 3)
    }
    if (time - this.lastPublished > 100) {
      this.lastPublished = time
      this.publishState(frame)
    }
  }

  /**
   * A stand screen's view: a point the camera looks at, moved by a drag or the arrow keys, or by
   * the tour React drives (useStandTour). The room is watched, never joined.
   */
  private spectate(delta: number) {
    const { controls, parent, options } = this
    const camera = this.cameras.main
    const now = performance.now()
    this.network.watch()
    controls.walkToScreen = undefined
    controls.pointerPress = undefined
    // Near the farthest zoom the view stays on the painting: a drag moves it by `follow`, so
    // the point moves faster to keep the picture under the finger.
    const perPixel = this.scale.width / parent.clientWidth / camera.zoom / Math.max(this.follow, 0.2)
    let { x, y } = this.position
    const horizontal = Number(this.keys.RIGHT.isDown || this.keys.D.isDown) - Number(this.keys.LEFT.isDown || this.keys.A.isDown || this.keys.Q.isDown)
    const vertical = Number(this.keys.DOWN.isDown || this.keys.S.isDown) - Number(this.keys.UP.isDown || this.keys.W.isDown || this.keys.Z.isDown)
    const manual = Boolean(horizontal || vertical || controls.panBy)
    if (horizontal || vertical) {
      controls.touchedAt = now
      x += horizontal * 0.6 * delta * perPixel
      y += vertical * 0.6 * delta * perPixel
    }
    if (controls.panBy) {
      x += controls.panBy.x * perPixel
      y += controls.panBy.y * perPixel
      controls.panBy = undefined
    }
    // The tour flies to a place or follows a visitor: it backs away over a long way and
    // comes close on arrival, like a camera crossing the town.
    const tour = controls.tour
    const visitor = tour?.visitor ? this.network.remotes.get(tour.visitor)?.sample(now) : undefined
    const target = visitor ?? tour?.point
    if (tour && target) {
      const distance = Math.hypot(target.x - x, target.y - y)
      const ease = 1 - Math.exp(-Math.min(delta, 50) / 1400)
      x += (target.x - x) * ease
      y += (target.y - y) * ease
      const zoom = tour.zoom / (1 + distance / 320)
      controls.zoom += (zoom - controls.zoom) * (1 - Math.exp(-Math.min(delta, 50) / 900))
      controls.overview = false
    }
    this.position = {
      x: Phaser.Math.Clamp(x, 0, options.width),
      y: Phaser.Math.Clamp(y, 0, options.height),
    }
    return { next: this.position, moving: false, manual }
  }

  /** Walking: keyboard, joystick, held pointer, or a route to a clicked point; then the avatar. */
  private walk(time: number, delta: number, animating: boolean, reducedMotion: boolean) {
    const { controls, parent, options } = this
    const camera = this.cameras.main
    let direction = controls.direction
    const horizontal =
      Number(this.keys.RIGHT.isDown || this.keys.D.isDown) - Number(this.keys.LEFT.isDown || this.keys.A.isDown || this.keys.Q.isDown)
    const vertical =
      Number(this.keys.DOWN.isDown || this.keys.S.isDown) - Number(this.keys.UP.isDown || this.keys.W.isDown || this.keys.Z.isDown)
    if (horizontal || vertical) direction = { x: horizontal, y: vertical }
    const manual = Math.hypot(direction.x, direction.y) >= 0.12
    if (manual || controls.cancelWalk) {
      controls.cancelWalk = false
      this.route.cancel()
      this.rejectedTarget = undefined
      controls.walkToScreen = undefined
      controls.pointerPress = undefined
    }
    const press = controls.pointerPress
    if (press && isPointerSteering(press, performance.now())) {
      this.route.cancel()
      this.rejectedTarget = undefined
      controls.walkToScreen = undefined
      const target = camera.getWorldPoint(
        (press.screen.x * this.scale.width) / parent.clientWidth,
        (press.screen.y * this.scale.height) / parent.clientHeight
      )
      direction = pointerDirection(
        { x: target.x - this.position.x, y: target.y - (this.position.y - options.avatarSize * 0.3) },
        { x: (camera.zoom * parent.clientWidth) / this.scale.width, y: (camera.zoom * parent.clientHeight) / this.scale.height }
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
      this.rejectedTarget = path ? undefined : target
      this.rejectedUntil = time + 500
    }
    const following = this.route.points.length > 0
    const next = following
      ? this.route.advance(this.position, delta / 1000, controls.navigation)
      : move(this.position, direction, delta / 1000, controls.navigation)
    if (following) {
      const length = Math.hypot(next.x - this.position.x, next.y - this.position.y)
      direction = length > 0 ? { x: (next.x - this.position.x) / length, y: (next.y - this.position.y) / length } : { x: 0, y: 0 }
    }
    const moving = Math.hypot(next.x - this.position.x, next.y - this.position.y) > 0.01
    this.position = next
    if (moving) {
      const length = Math.max(1, Math.hypot(direction.x, direction.y))
      this.facing = { x: direction.x / length, y: direction.y / length }
    }
    this.network.setActivity(controls.activity ?? null)
    this.network.update(
      { ...next, dx: this.facing.x, dy: this.facing.y, moving },
      { avatar: controls.avatar, name: controls.avatarName, color: controls.avatarColor },
      controls.multiplayerEnabled !== false,
      performance.now()
    )

    // The avatar and its shadow.
    this.blobAvatar.update(this.avatar, direction, moving, reducedMotion, delta, controls.avatar, !controls.paused && animating)
    const scale = options.avatarSize / AVATAR_SHEET_SIZE
    if (scale !== 1) this.avatar.setDisplaySize(this.avatar.displayWidth * scale, this.avatar.displayHeight * scale)
    const tint = avatarTint(controls.avatarColor, options.look.avatarTone)
    this.avatar.setTint(tint).setPosition(next.x, next.y).setDepth(next.y)
    this.shadow.setPosition(next.x, next.y)

    return { next, moving, manual }
  }

  /** Invite and react to the nearest visitor, under the visitor's own avatar. */
  private updateContactActions(next: Point, scaleY: number) {
    const { controls } = this
    const contact = controls.contactActions
    if (!contact) return
    // Track the closest visitor; a wider leave radius avoids flicker at the edge.
    let best: { id: string; name: string; d: number; bot: boolean } | null = null
    const at = performance.now()
    for (const [id, track] of this.network.remotes) {
      const pose = track.sample(at)
      const d = Math.hypot(pose.x - next.x, pose.y - next.y)
      if (!best || d < best.d) best = { id, name: track.player.profile.name, d, bot: false }
    }
    for (const [id, bot] of this.standCrowd?.remotes ?? []) {
      if (bot.leaving || bot.opacity < 0.5) continue
      const pose = bot.sample(at)
      const d = Math.hypot(pose.x - next.x, pose.y - next.y)
      if (!best || d < best.d) best = { id, name: bot.player.profile.name, d, bot: true }
    }
    const invite = contact.querySelector<HTMLButtonElement>('[data-invite]')
    if (invite) invite.hidden = best?.bot === true
    const shown = contact.dataset.visible === 'true'
    // Close contact only (the invite list itself still reaches 180 units).
    const visible = !!best && best.d <= (shown ? 65 : 50) && !controls.paused
    if (visible && best) {
      const point = this.project({ x: next.x, y: next.y + 26 * scaleY * (this.options.avatarSize / AVATAR_SHEET_SIZE) })
      contact.style.translate = `${point.x - contact.offsetWidth / 2}px ${point.y}px`
      if (contact.dataset.contact !== best.id) {
        contact.dataset.contact = best.id
        contact.dataset.name = best.name
      }
    }
    const value = String(visible)
    if (contact.dataset.visible !== value) {
      contact.dataset.visible = value
      contact.setAttribute('aria-hidden', String(!visible))
    }
    for (const button of contact.querySelectorAll('button')) button.disabled = !visible || Boolean(button.hidden)
  }
}

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`

/** A Phaser game around one world scene, sized in physical pixels and shown at CSS size. */
export function startWorldGame<Controls extends SceneControls>(scene: WorldScene<Controls>) {
  const { parent, look } = scene.options
  return new Phaser.Game({
    type: Phaser.AUTO,
    width: Math.max(1, Math.round(parent.clientWidth * RESOLUTION)),
    height: Math.max(1, Math.round(parent.clientHeight * RESOLUTION)),
    zoom: 1 / RESOLUTION,
    parent,
    backgroundColor: look.background,
    scene,
    scale: { mode: Phaser.Scale.NONE },
    // Phaser otherwise defaults pixelArt to true when the scale zoom is not 1.
    render: { pixelArt: false, antialias: true, antialiasGL: true, roundPixels: false },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
  })
}
