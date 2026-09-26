import { StandCrowd } from './stand-crowd'
import type { ReactionId } from './reactions'
import type { AvatarActivity } from './avatar-activity'
import { canAnimateWorld } from './world-activity'
import { AvatarReactions, loadReactions } from './avatar-reactions'
import { GAME_STATION } from './game-station'
import { APP_DOWNLOAD_STATION } from './app-download'
import { cameraZoomBounds, clampCameraZoom } from './camera-zoom'
import { arrivalZoom } from './world-arrival'
import { Pathfinder } from './pathfinding'
import { WalkingRoute } from './walking-route'
import { isPointerSteering, pointerDirection, type PointerPress } from './pointer-steering'
import { islandActions, nearIslandAction, type IslandActionId } from './island-actions'
import { chooseCentralSpawn } from './multiplayer-spawn'
import { WorldMultiplayer } from './multiplayer'
import { RemoteAvatars } from './remote-avatars'
import type { PresenceStatus } from './multiplayer-protocol'
import type { AvatarId } from './avatar-profile'
import { occlusionDepth } from './occlusion-depth'
import { LazyOccluders } from './lazy-occluders'
import { AmbientZoneEditor } from './ambient-zone-editor'
import type { AmbientEditorModel } from './ambient-zones'
import { ShoreWaves } from './shore-waves'
import type { ShoreEditorModel } from './shorelines'
import { BushRustle } from './bush-rustle'
import { WorldAmbience } from './world-ambience'
import { WorldClouds } from './world-clouds'
import { AmbientDiagnostics } from './ambient-diagnostics'
import { type DiagnosticFilters } from './diagnostic-filters'
import { LazyWorldAnimations } from './lazy-world-animations'
import Phaser from 'phaser'
import { MapTileStreamer } from './map-tile-streamer'
import { arrivalTileTarget } from './map-tiles'
import { SCENERY_HEIGHT, SCENERY_WIDTH, WorldBackground } from './world-background'
import { WATER_VARIANTS } from './water-decorations'
import { BlobAvatar, loadBlobAvatar } from './blob-avatar'
import {
  HEIGHT,
  WIDTH,
  SPAWN,
  move,
  occluders,
  stationAt,
  findSafePosition,
  type NavigationDocument,
  type Point,
  type Station,
} from './world'

export type WorldState = {
  x: number
  y: number
  cameraZoom: number
  station: Station | null
  behind: string[]
  moving: boolean
  fps: number
  multiplayer?: PresenceStatus
}
export type Controls = {
  stand?: boolean
  sendReaction?: (reaction: ReactionId) => boolean
  activity?: AvatarActivity | null
  network?: WorldMultiplayer
  pointerPress?: PointerPress
  cancelWalk?: boolean
  walkToScreen?: Point
  arrivalStartedAt?: number | null
  multiplayerEnabled?: boolean
  retryMultiplayer?: () => void
  discoveryActions?: Partial<Record<IslandActionId, HTMLButtonElement | null>>
  appDownloadLink?: HTMLAnchorElement | null
  actionStack?: HTMLDivElement | null
  /** Floating actions under the visitor's avatar while another visitor is within reach. */
  contactActions?: HTMLDivElement | null
  ambientEditor?: AmbientEditorModel
  shoreEditor?: ShoreEditorModel
  shoreZoom?: number
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
  travelTo?: Point
}

export function createWorld(
  parent: HTMLElement,
  controls: Controls,
  publish: (state: WorldState) => void,
  onReady: () => void,
  onError: () => void
) {
  const rendererResolution = Math.min(window.devicePixelRatio || 1, 2)
  class StudyScene extends Phaser.Scene {
    network!: WorldMultiplayer
    remoteAvatars!: RemoteAvatars
    standCrowd?: StandCrowd
    standAvatars?: RemoteAvatars
    standReactions?: AvatarReactions
    reactions!: AvatarReactions
    facing = { x: 0, y: 1 }
    position = { ...SPAWN }
    blob!: Phaser.GameObjects.Image
    shadow!: Phaser.GameObjects.Ellipse
    nameTag!: Phaser.GameObjects.Text
    nameTagBackground!: Phaser.GameObjects.Graphics
    debugLayer!: Phaser.GameObjects.Graphics
    ambientZoneEditor?: AmbientZoneEditor
    shoreWaves?: ShoreWaves
    mapTiles!: MapTileStreamer
    clouds!: WorldClouds
    bushes!: BushRustle
    ambience!: WorldAmbience
    ambientDiagnostics?: AmbientDiagnostics
    animations!: LazyWorldAnimations
    background!: WorldBackground
    lazyOccluders!: LazyOccluders
    keys!: Record<string, Phaser.Input.Keyboard.Key>
    lastReset = 0
    lastPublished = 0
    gait = 0
    blobAvatar = new BlobAvatar()
    pathfinder = new Pathfinder(controls.navigation)
    route = new WalkingRoute()
    destinationMarker!: Phaser.GameObjects.Image
    blockedMarker!: Phaser.GameObjects.Image
    destinationShadow!: Phaser.GameObjects.Ellipse
    destinationMotion = { shown: false, alpha: 0, size: 0.25 }
    blockedMotion = { shown: false, alpha: 0, size: 0.25 }
    rejectedTarget?: Point
    rejectedUntil = 0
    active = true
    previousNavigation = controls.navigation
    resetInput = () => {
      controls.pointerPress = undefined
      this.route.cancel()
      controls.walkToScreen = undefined
      this.rejectedTarget = undefined
      controls.direction = { x: 0, y: 0 }
      this.input.keyboard?.resetKeys()
    }
    blur = () => {
      this.active = false
      this.resetInput()
    }
    focusWindow = () => {
      this.active = true
    }
    animateMarker(
      motion: { shown: boolean; alpha: number; size: number },
      shown: boolean,
      reducedMotion: boolean
    ) {
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
      this.tweens.add({
        targets: motion,
        alpha: shown ? 1 : 0,
        size: shown ? 1 : 0.94,
        duration: shown ? 180 : 140,
        ease: 'Cubic.Out',
      })
    }
    cancelWalkOnKey = (event: KeyboardEvent) => {
      if (
        !controls.paused &&
        [
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'KeyZ',
          'KeyQ',
        ].includes(event.code)
      ) {
        this.route.cancel()
        controls.pointerPress = undefined
        this.rejectedTarget = undefined
        controls.walkToScreen = undefined
      }
    }

    preload() {
      loadReactions(this)
      this.load.image('game-terminal', './assets/games/terminal.webp')
      this.load.image('app-download-phone', './assets/app-download/phone.webp')
      this.load.image('game-terminal-ground', './assets/games/terminal-ground.webp')
      this.load.image('navigation-destination', './assets/navigation/destination-arrow.webp')
      this.load.image('navigation-blocked', './assets/navigation/blocked-cross.webp')
      loadBlobAvatar(this)
      this.load.image('world-water', './assets/map/water.webp')
      for (const variant of WATER_VARIANTS) {
        this.load.image(`water-${variant}`, `./assets/map/water-${variant}.webp`)
      }
      this.load.image('world-shore', './assets/map/shore.webp')
      this.load.image('map-preview', './assets/map/preview.webp')
      this.load.on('loaderror', onError)
    }

    create() {
      // Optional lazy assets must never turn a usable world into a loading error.
      this.load.off('loaderror', onError)
      // RESIZE replaces the backing buffer with CSS dimensions, losing Retina detail.
      // NONE lets us keep physical pixels while displaying the canvas at CSS size.
      let sceneAlive = true
      const resizeCanvas = () => {
        if (!sceneAlive) return
        this.scale.resize(
          Math.max(1, Math.round(parent.clientWidth * rendererResolution)),
          Math.max(1, Math.round(parent.clientHeight * rendererResolution))
        )
      }
      const resizeObserver = new ResizeObserver(resizeCanvas)
      resizeObserver.observe(parent)
      const stopResize = () => {
        sceneAlive = false
        resizeObserver.disconnect()
      }
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, stopResize)
      this.events.once(Phaser.Scenes.Events.DESTROY, stopResize)
      resizeCanvas()
      this.position = chooseCentralSpawn(controls.navigation) ??
        findSafePosition(SPAWN, controls.navigation) ?? { ...SPAWN }
      this.background = new WorldBackground(this)
      this.ambience = new WorldAmbience(this, controls.ambientEditor)
      this.clouds = new WorldClouds(this)
      if (import.meta.env.DEV && controls.ambientEditor)
        this.ambientZoneEditor = new AmbientZoneEditor(this, controls.ambientEditor)
      if (import.meta.env.DEV)
        this.ambientDiagnostics = new AmbientDiagnostics(
          this,
          () => this.ambience.diagnosticRegions
        )
      this.animations = new LazyWorldAnimations(this)
      this.add.image(0, 0, 'map-preview').setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(-110)
      this.mapTiles = new MapTileStreamer(this)
      this.add
        .image(726, 294, 'game-terminal-ground')
        .setOrigin(0)
        .setDisplaySize(68, 64)
        .setDepth(-80)
      this.add
        .image(GAME_STATION.x, GAME_STATION.y, 'game-terminal')
        .setOrigin(0.5, 1)
        .setFlipX(true)
        .setDisplaySize(GAME_STATION.width, GAME_STATION.height)
        .setDepth(GAME_STATION.y)

      this.add
        .image(APP_DOWNLOAD_STATION.x, APP_DOWNLOAD_STATION.y, 'app-download-phone')
        .setOrigin(0.5, 1)
        .setDisplaySize(APP_DOWNLOAD_STATION.width, APP_DOWNLOAD_STATION.height)
        .setDepth(APP_DOWNLOAD_STATION.y)

      if (controls.shoreEditor) this.shoreWaves = new ShoreWaves(this, controls.shoreEditor)
      this.bushes = new BushRustle(this, [])
      this.lazyOccluders = new LazyOccluders(this, this.bushes)
      this.network = new WorldMultiplayer()
      controls.network = this.network
      this.remoteAvatars = new RemoteAvatars(this, rendererResolution)
      this.reactions = new AvatarReactions(this)
      this.standCrowd = new StandCrowd(controls.navigation)
      this.standAvatars = new RemoteAvatars(this, rendererResolution)
      this.standReactions = new AvatarReactions(this)
      controls.sendReaction = reaction => {
        if (controls.paused || !this.active || document.hidden) return false
        const sent = this.network.sendReaction(reaction)
        const local =
          this.standCrowd?.react(reaction, this.position, performance.now(), !sent) ?? false
        return sent || local
      }
      controls.retryMultiplayer = () => this.network.retry()
      this.shadow = this.add.ellipse(SPAWN.x, SPAWN.y, 30, 10, 0x183c45, 0.25).setDepth(-1)
      this.blob = this.add
        .image(SPAWN.x, SPAWN.y, 'blob-idle-down')
        .setOrigin(0.5, 0.95)
        .setDisplaySize(52, 52)
      // Keep the label above scenery and clouds, independently of the avatar's depth.
      this.nameTagBackground = this.add.graphics().setDepth(4000)
      this.nameTag = this.add
        .text(SPAWN.x, SPAWN.y + 5, '', {
          fontFamily: 'Pulp, sans-serif',
          fontSize: '12px',
          color: '#193d49',
          padding: { x: 5, y: 3 },
        })
        .setOrigin(0.5, 0)
        .setResolution(rendererResolution)
        .setDepth(4001)
      this.debugLayer = this.add.graphics().setDepth(3000)
      this.destinationShadow = this.add
        .ellipse(0, 0, 14, 6, 0x183c45)
        .setDepth(3000)
        .setVisible(false)
      this.destinationMarker = this.add
        .image(0, 0, 'navigation-destination')
        .setOrigin(0.5, 0.9234)
        .setDepth(3001)
        .setVisible(false)
      this.blockedMarker = this.add
        .image(0, 0, 'navigation-blocked')
        .setDepth(3001)
        .setVisible(false)
      // Global key capture blocks typing in DOM inputs even when this scene is paused.
      this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q', false) as Record<
        string,
        Phaser.Input.Keyboard.Key
      >
      this.input.keyboard!.on('keydown', this.cancelWalkOnKey)
      this.cameras.main.setBackgroundColor('#59bdd5')
      window.addEventListener('blur', this.blur)
      window.addEventListener('focus', this.focusWindow)
      let disposed = false
      const disposeScene = () => {
        if (disposed) return
        disposed = true
        window.removeEventListener('blur', this.blur)
        window.removeEventListener('focus', this.focusWindow)
        this.input.keyboard?.off('keydown', this.cancelWalkOnKey)
        this.mapTiles.destroy()
        this.network.destroy()
        if (controls.network === this.network) {
          controls.network = undefined
          controls.retryMultiplayer = undefined
          controls.sendReaction = undefined
        }
      }
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, disposeScene)
      this.events.once(Phaser.Scenes.Events.DESTROY, disposeScene)
      this.cameras.main.centerOn(SPAWN.x, SPAWN.y)
      onReady()
    }

    update(time: number, delta: number) {
      if (!this.blob) return
      const animationActive = canAnimateWorld(controls.stand === true, this.active, document.hidden)
      if (this.input.keyboard) this.input.keyboard.enabled = !controls.paused
      if (this.previousNavigation !== controls.navigation) {
        this.pathfinder = new Pathfinder(controls.navigation)
        this.position = findSafePosition(this.position, controls.navigation) ?? this.position
        this.previousNavigation = controls.navigation
        this.resetInput()
      }
      if (this.lastReset !== controls.reset) {
        this.blobAvatar.reset()
        this.position = findSafePosition(SPAWN, controls.navigation) ?? this.position
        this.lastReset = controls.reset
        this.resetInput()
      }
      const arrival = this.network.takeSpawn()
      if (arrival) {
        this.position = { x: arrival.x, y: arrival.y }
        this.facing = { x: arrival.dx, y: arrival.dy }
        this.blobAvatar.reset()
        this.resetInput()
        this.cameras.main.centerOn(arrival.x, arrival.y)
      }
      const destination = controls.travelTo
      if (destination) {
        controls.travelTo = undefined
        this.position = findSafePosition(destination, controls.navigation) ?? this.position
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
        this.rejectedTarget = undefined
        controls.walkToScreen = undefined
        controls.pointerPress = undefined
      }
      const press = controls.pointerPress
      if (press && isPointerSteering(press, performance.now())) {
        this.route.cancel()
        this.rejectedTarget = undefined
        controls.walkToScreen = undefined
        const camera = this.cameras.main
        const target = camera.getWorldPoint(
          (press.screen.x * this.scale.width) / parent.clientWidth,
          (press.screen.y * this.scale.height) / parent.clientHeight
        )
        direction = pointerDirection(
          { x: target.x - this.position.x, y: target.y - (this.position.y - 16) },
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
        const target = this.cameras.main.getWorldPoint(
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
        direction =
          length > 0
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
      if (moving) this.gait += delta / 100
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const bounce = 0 // Hops are already drawn into the sprite frames.
      this.blobAvatar.update(
        this.blob,
        direction,
        moving,
        reducedMotion,
        delta,
        controls.avatar,
        !controls.paused && animationActive
      )
      this.blob
        .setTint(Number.parseInt(controls.avatarColor.slice(1), 16))
        .setPosition(next.x, next.y)
        .setDepth(next.y)
      if (this.nameTag.text !== controls.avatarName) {
        this.nameTag.setText(controls.avatarName)
        this.nameTagBackground
          .clear()
          .fillStyle(0xfff9ea, 1)
          .fillRoundedRect(-this.nameTag.width / 2, 0, this.nameTag.width, this.nameTag.height, 4)
      }
      this.shadow.setPosition(next.x, next.y)

      const station = stationAt(next, controls.navigation)

      const camera = this.cameras.main
      const screenWidth = this.scale.width,
        screenHeight = this.scale.height
      const shoreEditing = controls.shoreEditor?.editing || controls.ambientEditor?.editing
      if (shoreEditing && controls.shoreZoom) {
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * controls.shoreZoom, 0.4, 8))
        controls.shoreZoom = undefined
      }
      const bounds = cameraZoomBounds(
        screenWidth,
        screenHeight,
        SCENERY_WIDTH,
        SCENERY_HEIGHT,
        HEIGHT,
        rendererResolution
      )
      // Keep a fully zoomed-out view fitted when the viewport rotates or resizes.
      const wasAtMinimum = controls.zoom <= controls.minimumZoom
      controls.minimumZoom = bounds.minimum
      controls.zoom = wasAtMinimum ? bounds.minimum : clampCameraZoom(controls.zoom, bounds.minimum)
      if (
        !controls.paused &&
        (manual || controls.pointerPress || controls.walkToScreen || this.route.points.length)
      )
        controls.arrivalStartedAt = undefined
      const cameraArrival = arrivalZoom(
        controls.arrivalStartedAt,
        performance.now(),
        bounds.minimum,
        controls.zoom
      )
      const zoom =
        cameraArrival !== undefined
          ? bounds.base *
            (reducedMotion && controls.arrivalStartedAt !== null ? controls.zoom : cameraArrival)
          : shoreEditing
            ? camera.zoom
            : controls.overview
              ? bounds.overview
              : bounds.base * controls.zoom
      camera.setZoom(zoom)
      const markerScaleX = screenWidth / parent.clientWidth / zoom
      const markerScaleY = screenHeight / parent.clientHeight / zoom
      this.animateMarker(this.destinationMotion, this.route.points.length > 0, reducedMotion)
      const destinationSize = 36 * this.destinationMotion.size
      this.destinationMarker
        .setAlpha(this.destinationMotion.alpha)
        .setVisible(this.destinationMotion.alpha > 0)
        .setDisplaySize(destinationSize * markerScaleX, destinationSize * markerScaleY)
      this.destinationShadow
        .setAlpha(0.22 * this.destinationMotion.alpha)
        .setVisible(this.destinationMotion.alpha > 0)
        .setDisplaySize(
          14 * markerScaleX * this.destinationMotion.size,
          6 * markerScaleY * this.destinationMotion.size
        )
      if (this.route.points.length) {
        const target = this.route.points[this.route.points.length - 1]
        this.destinationMarker.setPosition(target.x, target.y - 2 * markerScaleY)
        this.destinationShadow.setPosition(target.x, target.y)
      }
      this.animateMarker(
        this.blockedMotion,
        Boolean(this.rejectedTarget && time < this.rejectedUntil),
        reducedMotion
      )
      const blockedSize = 30 * this.blockedMotion.size
      this.blockedMarker
        .setAlpha(this.blockedMotion.alpha)
        .setVisible(this.blockedMotion.alpha > 0)
        .setDisplaySize(blockedSize * markerScaleX, blockedSize * markerScaleY)
      if (this.rejectedTarget) {
        this.blockedMarker.setPosition(this.rejectedTarget.x, this.rejectedTarget.y)
      }
      // Keep label dimensions and spacing fixed in screen pixels as the world zooms.
      const labelScaleX = screenWidth / parent.clientWidth / zoom
      const labelScaleY = screenHeight / parent.clientHeight / zoom
      const relativeZoom = zoom / bounds.base
      const fade = Phaser.Math.Clamp((relativeZoom - 0.65) / 0.2, 0, 1)
      const targetAlpha = controls.avatarName ? fade * fade * (3 - 2 * fade) : 0
      const labelAlpha = Phaser.Math.Linear(
        this.nameTag.alpha,
        targetAlpha,
        1 - Math.exp(-Math.min(delta, 50) / 100)
      )
      for (const label of [this.nameTag, this.nameTagBackground]) {
        label
          .setPosition(next.x, next.y + 5 * labelScaleY)
          .setScale(labelScaleX, labelScaleY)
          .setAlpha(labelAlpha)
          .setVisible(Boolean(controls.avatarName) && labelAlpha > 0.01)
      }
      this.remoteAvatars.update(
        this.network,
        performance.now(),
        delta,
        reducedMotion,
        labelScaleX,
        labelScaleY,
        fade * fade * (3 - 2 * fade),
        !controls.paused && animationActive
      )
      if (this.standCrowd) {
        const now = performance.now()
        const active = !controls.paused && animationActive
        const view = camera.worldView
        this.standCrowd.update({
          navigation: controls.navigation,
          realCount: this.network.status.state === 'online' ? this.network.remotes.size : null,
          local: next,
          delta,
          now,
          active,
          visible: point => view.contains(point.x, point.y),
        })
        if (active)
          this.standCrowd.observeReactions(
            this.network.reactions,
            id => this.network.remotes.get(id)?.sample(now),
            now
          )
        this.standAvatars?.update(
          this.standCrowd,
          now,
          active ? delta : 0,
          reducedMotion,
          labelScaleX,
          labelScaleY,
          fade * fade * (3 - 2 * fade),
          active
        )
        this.standReactions?.update(
          this.standCrowd,
          { ...next, color: controls.avatarColor },
          now,
          labelScaleX,
          labelScaleY,
          reducedMotion
        )
      }
      this.reactions.update(
        this.network,
        { ...next, color: controls.avatarColor },
        performance.now(),
        labelScaleX,
        labelScaleY,
        reducedMotion
      )
      this.bushes.update(
        delta,
        [
          { ...next, moving },
          ...this.remoteAvatars.contacts,
          ...(this.standAvatars?.contacts ?? []),
        ],
        reducedMotion || controls.paused || !animationActive
      )
      const targetX = controls.overview ? WIDTH / 2 : next.x
      const targetY = controls.overview ? HEIGHT / 2 : next.y - (38 * rendererResolution) / zoom
      const halfWidth = screenWidth / zoom / 2,
        halfHeight = screenHeight / zoom / 2
      const centerX =
        halfWidth > WIDTH / 2 ? WIDTH / 2 : Phaser.Math.Clamp(targetX, halfWidth, WIDTH - halfWidth)
      const centerY =
        halfHeight > HEIGHT / 2
          ? HEIGHT / 2
          : Phaser.Math.Clamp(targetY, halfHeight, HEIGHT - halfHeight)
      const smoothing = cameraArrival !== undefined ? 1 : 1 - Math.exp(-Math.min(delta, 50) / 110)
      // Phaser zooms around the viewport center; scroll is relative to the unzoomed viewport.
      if (!shoreEditing) {
        camera.scrollX += (centerX - screenWidth / 2 - camera.scrollX) * smoothing
        camera.scrollY += (centerY - screenHeight / 2 - camera.scrollY) * smoothing
      }
      for (const anchor of islandActions) {
        const action = controls.discoveryActions?.[anchor.id]
        if (!action) continue
        // Project a fixed island anchor, independently of the avatar and its bounce.
        const x =
          (((anchor.x - camera.scrollX - screenWidth / 2) * zoom + screenWidth / 2) *
            parent.clientWidth) /
          screenWidth
        const y =
          (((anchor.y - camera.scrollY - screenHeight / 2) * zoom + screenHeight / 2) *
            parent.clientHeight) /
          screenHeight
        action.style.translate = `${x - action.offsetWidth / 2}px ${y - action.offsetHeight / 2}px`
        const visible = nearIslandAction(next, anchor.id, controls.navigation) && !controls.paused
        const value = String(visible)
        if (action.dataset.visible !== value) {
          action.dataset.visible = value
          action.disabled = !visible
          action.setAttribute('aria-hidden', String(!visible))
        }
      }
      const download = controls.appDownloadLink
      if (download) {
        // A real link over the full prop: no proximity gate and no click-to-walk.
        const scaleX = (zoom * parent.clientWidth) / screenWidth
        const scaleY = (zoom * parent.clientHeight) / screenHeight
        const x =
          (APP_DOWNLOAD_STATION.x - camera.scrollX - screenWidth / 2) * scaleX +
          parent.clientWidth / 2
        const y =
          (APP_DOWNLOAD_STATION.y - camera.scrollY - screenHeight / 2) * scaleY +
          parent.clientHeight / 2
        const width = APP_DOWNLOAD_STATION.width * scaleX
        const height = APP_DOWNLOAD_STATION.height * scaleY
        download.style.translate = `${x - width / 2}px ${y - height}px`
        download.style.width = `${width}px`
        download.style.height = `${height}px`
        const visible =
          !controls.paused &&
          x + width / 2 > 0 &&
          x - width / 2 < parent.clientWidth &&
          y > 0 &&
          y - height < parent.clientHeight
        if (download.dataset.visible !== String(visible)) {
          download.dataset.visible = String(visible)
          download.inert = !visible
          download.setAttribute('aria-hidden', String(!visible))
        }
        // The fixed shortcut remains readable when the camera puts the exhibit under the HUD.
        const caption = download.firstElementChild?.getBoundingClientRect()
        const hud = controls.actionStack?.getBoundingClientRect()
        if (visible && caption && hud) {
          download.dataset.captionHidden = String(
            caption.left < 8 ||
              caption.right > parent.clientWidth - 8 ||
              caption.bottom > parent.clientHeight - 8 ||
              (caption.left < hud.right &&
                caption.right > hud.left &&
                caption.top < hud.bottom &&
                caption.bottom > hud.top)
          )
        }
      }
      const contact = controls.contactActions
      if (contact) {
        // Track the closest visitor; a wider leave radius avoids flicker at the edge.
        let best: {
          id: string
          name: string
          x: number
          y: number
          d: number
          bot: boolean
        } | null = null
        const at = performance.now()
        for (const [id, track] of this.network.remotes) {
          const pose = track.sample(at)
          const d = Math.hypot(pose.x - next.x, pose.y - next.y)
          if (!best || d < best.d)
            best = { id, name: track.player.profile.name, x: pose.x, y: pose.y, d, bot: false }
        }
        for (const [id, bot] of this.standCrowd?.remotes ?? []) {
          if (bot.leaving || bot.opacity < 0.5) continue
          const pose = bot.sample(at)
          const d = Math.hypot(pose.x - next.x, pose.y - next.y)
          if (!best || d < best.d)
            best = { id, name: bot.player.profile.name, x: pose.x, y: pose.y, d, bot: true }
        }
        const invite = contact.querySelector<HTMLButtonElement>('[data-invite]')
        if (invite) invite.hidden = best?.bot === true
        const shown = contact.dataset.visible === 'true'
        // Close contact only (the invite list itself still reaches 180 units).
        const visible = !!best && best.d <= (shown ? 65 : 50) && !controls.paused
        if (visible && best) {
          // Shown under the visitor's own avatar, since it is their action to take.
          const x =
            (((next.x - camera.scrollX - screenWidth / 2) * zoom + screenWidth / 2) *
              parent.clientWidth) /
            screenWidth
          const y =
            (((next.y + 26 * labelScaleY - camera.scrollY - screenHeight / 2) * zoom +
              screenHeight / 2) *
              parent.clientHeight) /
            screenHeight
          contact.style.translate = `${x - contact.offsetWidth / 2}px ${y}px`
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
      }
      for (const button of contact?.querySelectorAll('button') ?? [])
        button.disabled = contact?.dataset.visible !== 'true' || Boolean(button.hidden)
      this.shoreWaves?.update(
        delta,
        !animationActive || (controls.paused && !shoreEditing),
        import.meta.env.DEV && controls.debug && controls.diagnosticFilters?.shorelines !== false
      )
      this.ambientZoneEditor?.update()
      this.background.update(camera)
      this.clouds.update(camera, delta, controls.paused || !animationActive)
      this.ambience.update(
        camera,
        delta,
        next,
        (controls.paused && !shoreEditing) || !animationActive
      )
      // Camera zoom already includes the physical-pixel density.
      const arrivalSettled = cameraArrival === undefined || reducedMotion
      const canStream = animationActive
      const arrivalTarget = !arrivalSettled
        ? arrivalTileTarget(camera, bounds.base * controls.zoom, next, rendererResolution)
        : undefined
      this.mapTiles.update(camera, time, 1, canStream, arrivalTarget)
      this.lazyOccluders.update(camera, delta, canStream, next.x, arrivalTarget?.view)
      // Scene.create has already completed the essential preload. Download nearby artwork
      // immediately, independently of the intro/menu pause that controls animation playback.
      this.animations.update(camera, delta, !canStream || controls.paused, next.x, {
        enabled: canStream,
        view: arrivalTarget?.view,
      })

      this.ambientDiagnostics?.update(
        camera,
        controls.debug,
        document.documentElement.lang,
        controls.diagnosticFilters
      )
      this.debugLayer.clear()
      if (import.meta.env.DEV && controls.debug) {
        for (const { points, kind } of controls.diagnosticFilters?.navigation !== false
          ? controls.navigation.zones
          : []) {
          this.debugLayer
            .fillStyle(kind === 'allowed' ? 0x44ffb0 : 0xff3355, kind === 'allowed' ? 0.15 : 0.35)
            .lineStyle(1, kind === 'allowed' ? 0x007348 : 0xcc2040, 0.8)
          this.debugLayer.fillPoints(
            points.map(([x, y]) => new Phaser.Geom.Point(x, y)),
            true
          )
          this.debugLayer.strokePoints(
            points.map(([x, y]) => new Phaser.Geom.Point(x, y)),
            true
          )
        }
        for (const o of controls.diagnosticFilters?.occluders !== false ? occluders : []) {
          this.debugLayer.lineStyle(1, 0xffbe00, 0.9).strokeRect(o.x, o.y, o.width, o.height)
        }
        this.debugLayer.fillStyle(0xffffff).fillCircle(next.x, next.y, 3)
      }
      if (time - this.lastPublished > 100) {
        this.lastPublished = time
        const behind = occluders
          .filter(
            o =>
              !o.always &&
              next.y < occlusionDepth(o.id, o.baseY, next.x) &&
              next.x > o.x - 18 &&
              next.x < o.x + o.width + 18 &&
              next.y > o.y &&
              next.y < o.y + o.height + 45
          )
          .map(o => o.name)
        publish({
          ...next,
          cameraZoom: zoom,
          station,
          behind,
          moving,
          fps: Math.round(this.game.loop.actualFps),
          multiplayer: this.network.status,
        })
      }
    }
  }

  return new Phaser.Game({
    type: Phaser.AUTO,
    width: Math.max(1, Math.round(parent.clientWidth * rendererResolution)),
    height: Math.max(1, Math.round(parent.clientHeight * rendererResolution)),
    zoom: 1 / rendererResolution,
    parent,
    backgroundColor: '#59bdd5',
    scene: StudyScene,
    scale: { mode: Phaser.Scale.NONE },
    // Phaser otherwise defaults pixelArt to true when the scale zoom is not 1.
    render: { pixelArt: false, antialias: true, antialiasGL: true, roundPixels: false },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
  })
}
