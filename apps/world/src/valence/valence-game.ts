import Phaser from 'phaser'
import { AmbientZoneEditor } from '../ambient-zone-editor'
import type { AmbientEditorModel } from '../ambient-zones'
import { AnimatedReader, loadReader, type ReaderManifest } from '../animated-reader'
import type { AvatarActivity } from '../avatar-activity'
import type { AvatarId } from '../avatar-profile'
import { AvatarReactions, loadReactions } from '../avatar-reactions'
import { BlobAvatar, loadBlobAvatar } from '../blob-avatar'
import { BushRustle } from '../bush-rustle'
import { cameraZoomBounds, clampCameraZoom } from '../camera-zoom'
import { LazySceneAssets, type LazySceneAsset } from '../lazy-scene-assets'
import { MapTileStreamer } from '../map-tile-streamer'
import { arrivalTileTarget, type MapTileManifest } from '../map-tiles'
import { WorldMultiplayer } from '../multiplayer'
import { VALENCE_ROOM, type PresenceStatus } from '../multiplayer-protocol'
import { Pathfinder } from '../pathfinding'
import { isPointerSteering, pointerDirection, type PointerPress } from '../pointer-steering'
import type { ReactionId } from '../reactions'
import { RemoteAvatars } from '../remote-avatars'
import { ShoreWaves } from '../shore-waves'
import type { ShoreEditorModel } from '../shorelines'
import { StandCrowd } from '../stand-crowd'
import { WalkingRoute } from '../walking-route'
import { findSafePosition, move, type NavigationDocument, type Point } from '../world'
import { canAnimateWorld } from '../world-activity'
import { arrivalZoom } from '../world-arrival'
import { WorldAmbience } from '../world-ambience'
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

export type ValenceState = {
  x: number
  y: number
  moving: boolean
  fps: number
  multiplayer?: PresenceStatus
}

export type ValenceControls = {
  /** Runtime navigation: walkable polygons tiled for the pathfinder. */
  navigation: NavigationDocument
  effects: EffectsModel
  direction: Point
  avatar: AvatarId
  avatarColor: string
  avatarName: string
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
  activity?: AvatarActivity | null
  multiplayerEnabled?: boolean
  network?: WorldMultiplayer
  sendReaction?: (reaction: ReactionId) => boolean
  /** DOM elements projected on the map, owned by React. */
  stationTags?: Partial<Record<StationId, HTMLElement | null>>
  portalTag?: HTMLElement | null
  /** Set when the visitor came through a portal: they appear there, not where the server suggests. */
  portalArrival?: Point
  /** Development workshop: panels in React, handles on the map. */
  workshop?: WorkshopModel
  shoreEditor?: ShoreEditorModel
  ambientEditor?: AmbientEditorModel
  /** Zoom requested by the workshop's zoom buttons; consumed once. */
  shoreZoom?: number
}

const RESOLUTION = Math.min(window.devicePixelRatio || 1, 2)
const PAPER = '#cdb48a'
const SEPIA_LOOK = { scale: AVATAR_SIZE / 52, shadow: 0x3b2414, text: '#2e1c0f', background: '#f8ecd2' }

export function createValence(
  parent: HTMLElement,
  controls: ValenceControls,
  publish: (state: ValenceState) => void,
  onReady: () => void,
  onError: () => void
) {
  class ValenceScene extends Phaser.Scene {
    position = { ...VALENCE_SPAWN }
    /** A portal arrival keeps its place over the room's first suggested spawn. */
    keepArrival = Boolean(controls.portalArrival)
    facing = { x: 0, y: 1 }
    avatar!: Phaser.GameObjects.Image
    /** A faint copy above the scenery while a roof or a canopy hides the avatar. */
    ghost!: Phaser.GameObjects.Image
    shadow!: Phaser.GameObjects.Ellipse
    nameTag!: Phaser.GameObjects.Text
    blobAvatar = new BlobAvatar()
    pathfinder = new Pathfinder(controls.navigation)
    route = new WalkingRoute()
    tiles!: MapTileStreamer
    occluders!: ValenceOccluders
    bushes!: BushRustle
    scenes!: LazySceneAssets<(camera: Phaser.Cameras.Scene2D.Camera, delta: number, paused: boolean) => void>
    ambience!: ValenceAmbience
    zoneAmbience?: WorldAmbience
    ambientZoneEditor?: AmbientZoneEditor
    shoreWaves?: ShoreWaves
    overlay?: WorkshopOverlay
    network!: WorldMultiplayer
    remoteAvatars!: RemoteAvatars
    reactions!: AvatarReactions
    standCrowd?: StandCrowd
    standAvatars?: RemoteAvatars
    standReactions?: AvatarReactions
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
    /** Objects found in an earlier visit are already collected: no burst on load. */
    collected = new Set<PioneerObjectId>(controls.found)

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
      loadReactions(this)
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
      this.position =
        (controls.portalArrival &&
          findSafePosition(controls.portalArrival, controls.navigation, {
            width: VALENCE_WIDTH,
            height: VALENCE_HEIGHT,
          })) ||
        this.arrival()
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
      // Sepia leaves, matching the engraved foliage of the map.
      this.bushes = new BushRustle(this, [], {
        reactive: isValenceShrub,
        leaves: { colors: [0x8c7a45, 0xa8915a, 0xc4ad73], stroke: 0x3b2a14 },
      })
      this.occluders = new ValenceOccluders(this, this.bushes)
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
      this.ambience = new ValenceAmbience(this, controls.effects)
      if (controls.ambientEditor) {
        this.zoneAmbience = new WorldAmbience(this, controls.ambientEditor)
        if (import.meta.env.DEV) this.ambientZoneEditor = new AmbientZoneEditor(this, controls.ambientEditor)
      }
      // Cream foam along Valence's quays, on the sepia water.
      if (controls.shoreEditor) this.shoreWaves = new ShoreWaves(this, controls.shoreEditor, 0xfff1d6)
      if (import.meta.env.DEV && controls.workshop)
        this.overlay = new WorkshopOverlay(this, controls.workshop, RESOLUTION)
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
        this.objects.set(
          id,
          this.add.image(spot.x, spot.y, `valence-object-${id}`).setOrigin(0.5, 0.85).setDisplaySize(26, 26)
        )
      }
      this.network = new WorldMultiplayer(VALENCE_ROOM)
      controls.network = this.network
      this.remoteAvatars = new RemoteAvatars(this, RESOLUTION, SEPIA_LOOK)
      this.reactions = new AvatarReactions(this)
      if (controls.stand) {
        this.standCrowd = new StandCrowd(controls.navigation, Math.random, {
          candidates: valenceSquareCandidates,
          walking: navigation => navigation,
        })
        this.standAvatars = new RemoteAvatars(this, RESOLUTION, SEPIA_LOOK)
        this.standReactions = new AvatarReactions(this)
      }
      controls.sendReaction = reaction => {
        if (controls.paused || !this.active || document.hidden) return false
        const sent = this.network.sendReaction(reaction)
        const local = this.standCrowd?.react(reaction, this.position, performance.now(), !sent) ?? false
        return sent || local
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
      this.nameTag = this.add
        .text(0, 0, '', {
          fontFamily: 'Pulp, sans-serif',
          fontSize: '12px',
          color: SEPIA_LOOK.text,
          backgroundColor: SEPIA_LOOK.background,
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setResolution(RESOLUTION)
        .setDepth(4001)
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
        this.network.destroy()
        if (controls.network === this.network) {
          controls.network = undefined
          controls.sendReaction = undefined
        }
      }
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, dispose)
      this.events.once(Phaser.Scenes.Events.DESTROY, dispose)
      this.cameras.main.centerOn(this.position.x, this.position.y)
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

    arrival() {
      return (
        chooseValenceSpawn(controls.navigation, VALENCE_SPAWN) ??
        findSafePosition(VALENCE_SPAWN, controls.navigation, { width: VALENCE_WIDTH, height: VALENCE_HEIGHT }) ?? {
          ...VALENCE_SPAWN,
        }
      )
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
      const workshopMode = controls.workshop?.mode ?? null
      // Every workshop mode but the full-screen zone editor works over the live map.
      const freeCamera = Boolean(workshopMode && workshopMode !== 'navigation')
      if (this.input.keyboard) this.input.keyboard.enabled = !controls.paused
      if (this.previousNavigation !== controls.navigation) {
        this.pathfinder = new Pathfinder(controls.navigation)
        this.previousNavigation = controls.navigation
        this.position = findSafePosition(this.position, controls.navigation, {
          width: VALENCE_WIDTH,
          height: VALENCE_HEIGHT,
        }) ?? this.position
        this.resetInput()
      }
      if (this.lastReset !== controls.reset) {
        this.lastReset = controls.reset
        this.blobAvatar.reset()
        this.position = this.arrival()
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
        direction = length
          ? { x: (next.x - this.position.x) / length, y: (next.y - this.position.y) / length }
          : { x: 0, y: 0 }
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
      const tint = Number.parseInt(controls.avatarColor.slice(1), 16)
      this.avatar
        .setDisplaySize(this.avatar.displayWidth * scale, this.avatar.displayHeight * scale)
        .setTint(tint)
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
      const ghostAlpha = Phaser.Math.Linear(this.ghost.alpha, hidden ? 0.42 : 0, 1 - Math.exp(-Math.min(delta, 50) / 90))
      this.ghost
        .setTexture(this.avatar.texture.key, this.avatar.frame.name)
        .setFlipX(this.avatar.flipX)
        .setOrigin(this.avatar.originX, this.avatar.originY)
        .setDisplaySize(this.avatar.displayWidth, this.avatar.displayHeight)
        .setTint(tint)
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
      if (freeCamera) {
        if (controls.shoreZoom) {
          camera.setZoom(Phaser.Math.Clamp(camera.zoom * controls.shoreZoom, 0.3, 10))
          controls.shoreZoom = undefined
        }
      } else {
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
      }
      const zoom = camera.zoom

      // Markers and labels keep a constant screen size.
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
      const relativeZoom = zoom / bounds.base
      const fade = Phaser.Math.Clamp((relativeZoom - 0.65) / 0.2, 0, 1)
      const labelAlpha = fade * fade * (3 - 2 * fade)
      if (this.nameTag.text !== controls.avatarName) this.nameTag.setText(controls.avatarName)
      this.nameTag
        .setPosition(next.x, next.y + 4 * markerScale)
        .setScale(markerScale)
        .setAlpha(labelAlpha)
        .setVisible(Boolean(controls.avatarName) && labelAlpha > 0.01 && !freeCamera)

      // Other visitors, stand bots and emoji reactions.
      const now = performance.now()
      const lively = !controls.paused && animating
      this.remoteAvatars.update(this.network, now, delta, reducedMotion, markerScale, markerScale, labelAlpha, lively)
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
        if (lively)
          this.standCrowd.observeReactions(this.network.reactions, id => this.network.remotes.get(id)?.sample(now), now)
        this.standAvatars?.update(this.standCrowd, now, lively ? delta : 0, reducedMotion, markerScale, markerScale, labelAlpha, lively)
        this.standReactions?.update(this.standCrowd, { ...next, color: controls.avatarColor }, now, markerScale, markerScale, reducedMotion)
      }
      this.reactions.update(this.network, { ...next, color: controls.avatarColor }, now, markerScale, markerScale, reducedMotion)

      // Objects and DOM tags.
      const breathing = reducedMotion ? 0 : Math.sin(this.clock / 520)
      for (const [id, image] of this.objects) {
        const found = controls.found.has(id)
        const spot = objectSpots[id]
        if (found && !this.collected.has(id)) {
          this.collected.add(id)
          if (image.visible) this.ambience.burst(spot, reducedMotion)
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
      for (const [tag, label] of tags) {
        if (!tag) continue
        const point = this.project(label, zoom)
        // Off-screen tags hide; visible ones stay clear of the screen edges and the top bar.
        const offscreen =
          freeCamera ||
          point.x < -40 ||
          point.x > parent.clientWidth + 40 ||
          point.y < 40 ||
          point.y > parent.clientHeight + 30
        if (tag.dataset.offscreen !== String(offscreen)) tag.dataset.offscreen = String(offscreen)
        const half = tag.offsetWidth / 2 + 8
        const x = Math.min(Math.max(point.x, half), parent.clientWidth - half)
        const y = Math.max(point.y, 140)
        tag.style.translate = `${x}px ${y}px`
      }

      // Streaming and life.
      const canStream = animating
      const arrivalTarget =
        arrival !== undefined && !reducedMotion && !freeCamera
          ? arrivalTileTarget(camera, bounds.base * controls.zoom, next, RESOLUTION, {
              worldWidth: VALENCE_WIDTH,
              worldHeight: VALENCE_HEIGHT,
            })
          : undefined
      this.tiles.update(camera, time, 1, canStream, arrivalTarget)
      this.occluders.update(camera, delta, canStream, arrivalTarget?.view)
      const paused = (controls.paused && !freeCamera) || !animating
      this.bushes.update(
        delta,
        [{ ...next, moving }, ...this.remoteAvatars.contacts, ...(this.standAvatars?.contacts ?? [])],
        reducedMotion || paused
      )
      this.scenes.update(camera, canStream, update => update(camera, delta, paused), {
        view: arrivalTarget?.view,
        concurrent: true,
      })
      this.ambience.update(camera, delta, paused, reducedMotion, freeCamera)
      this.zoneAmbience?.update(camera, delta, next, paused)
      this.ambientZoneEditor?.update()
      this.shoreWaves?.update(
        delta,
        paused,
        import.meta.env.DEV && (workshopMode === 'shorelines' || controls.debug)
      )
      this.overlay?.update()

      this.debugLayer.clear()
      if (import.meta.env.DEV && controls.debug) {
        for (const { points, kind } of controls.navigation.zones) {
          const shape = points.map(([x, y]) => new Phaser.Geom.Point(x, y))
          this.debugLayer
            .fillStyle(kind === 'allowed' ? 0x44ffb0 : 0xff3355, kind === 'allowed' ? 0.14 : 0.35)
            .lineStyle(1 / zoom, kind === 'allowed' ? 0x007348 : 0xcc2040, 0.8)
            .fillPoints(shape, true)
            .strokePoints(shape, true)
        }
        for (const anchor of Object.values(stationAnchors))
          this.debugLayer.lineStyle(1 / zoom, 0x2040ff, 0.9).strokeCircle(anchor.x, anchor.y, 62)
        this.debugLayer.fillStyle(0xffffff).fillCircle(next.x, next.y, 3)
      }
      if (time - this.lastPublished > 100) {
        this.lastPublished = time
        publish({
          x: next.x,
          y: next.y,
          moving,
          fps: Math.round(this.game.loop.actualFps),
          multiplayer: this.network.status,
        })
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
