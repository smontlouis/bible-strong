import { cameraZoomBounds, clampCameraZoom } from './camera-zoom'
import { arrivalZoom } from './world-arrival'
import { Pathfinder } from './pathfinding'
import { WalkingRoute } from './walking-route'
import { isPointerSteering, pointerDirection, type PointerPress } from './pointer-steering'
import { islandActions, type IslandActionId } from './island-actions'
import { nearGuestbook } from './guestbook'
import { chooseCentralSpawn } from './multiplayer-spawn'
import { WorldMultiplayer } from './multiplayer'
import { RemoteAvatars } from './remote-avatars'
import type { PresenceStatus } from './multiplayer-protocol'
import type { AvatarId } from './avatar-profile'
import { occlusionDepth } from './occlusion-depth'
import { maskSignGround } from './occluder-masks'
import { AmbientZoneEditor } from './ambient-zone-editor'
import type { AmbientEditorModel } from './ambient-zones'
import { ShoreWaves } from './shore-waves'
import type { ShoreEditorModel } from './shorelines'
import { BushRustle } from './bush-rustle'
import { WorldAmbience } from './world-ambience'
import { WorldClouds } from './world-clouds'
import { AmbientDiagnostics } from './ambient-diagnostics'
import { type DiagnosticFilters } from './diagnostic-filters'
import { AmbientTiles, loadAmbientTiles } from './ambient-tiles'
import { CentralBook, loadCentralBook } from './central-book'
import Phaser from 'phaser'
import { MapTileStreamer } from './map-tile-streamer'
import { SCENERY_HEIGHT, SCENERY_WIDTH, WorldBackground } from './world-background'
import { WATER_VARIANTS } from './water-decorations'
import { createWorldReaders, loadWorldReaders } from './world-readers'
import type { AnimatedReader } from './animated-reader'
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
  pointerPress?: PointerPress
  cancelWalk?: boolean
  walkToScreen?: Point
  arrivalStartedAt?: number | null
  multiplayerEnabled?: boolean
  retryMultiplayer?: () => void
  discoveryActions?: Partial<Record<IslandActionId, HTMLButtonElement | null>>
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
    ambientTiles!: AmbientTiles
    centralBook!: CentralBook
    background!: WorldBackground
    readers!: AnimatedReader[]
    foreground: { object: (typeof occluders)[number]; image: Phaser.GameObjects.Image }[] = []
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
      if (!controls.paused && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ'].includes(event.code)) {
        this.route.cancel()
        controls.pointerPress = undefined
        this.rejectedTarget = undefined
        controls.walkToScreen = undefined
      }
    }

    preload() {
      this.load.image('navigation-destination', './assets/navigation/destination-arrow.png')
      this.load.image('navigation-blocked', './assets/navigation/blocked-cross.png')
      loadBlobAvatar(this)
      loadAmbientTiles(this)
      loadCentralBook(this)
      loadWorldReaders(this)
      this.load.image('world-water', './assets/map/water.webp')
      for (const variant of WATER_VARIANTS) {
        this.load.image(`water-${variant}`, `./assets/map/water-${variant}.webp`)
      }
      this.load.image('world-shore', './assets/map/shore.webp')
      this.load.image('map-preview', './assets/map/preview.webp')
      for (const object of occluders) this.load.image(`occlusion-${object.id}`, object.url)
      this.load.on('loaderror', onError)
    }

    create() {
      // RESIZE replaces the backing buffer with CSS dimensions, losing Retina detail.
      // NONE lets us keep physical pixels while displaying the canvas at CSS size.
      const resizeCanvas = () => {
        this.scale.resize(
          Math.max(1, Math.round(parent.clientWidth * rendererResolution)),
          Math.max(1, Math.round(parent.clientHeight * rendererResolution))
        )
      }
      const resizeObserver = new ResizeObserver(resizeCanvas)
      resizeObserver.observe(parent)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => resizeObserver.disconnect())
      resizeCanvas()
      this.position = chooseCentralSpawn(controls.navigation, []) ??
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
      this.ambientTiles = new AmbientTiles(this)
      this.centralBook = new CentralBook(this)
      this.add.image(0, 0, 'map-preview').setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(-110)
      this.mapTiles = new MapTileStreamer(this)
      if (controls.shoreEditor) this.shoreWaves = new ShoreWaves(this, controls.shoreEditor)
      occluders.forEach(object => {
        const image = this.add
          .image(object.x, object.y, `occlusion-${object.id}`)
          .setOrigin(0)
          .setDisplaySize(object.width, object.height)
          .setDepth(object.always ? 2000 : object.baseY)
        maskSignGround(this, object, image)
        this.foreground.push({ object, image })
      })
      this.bushes = new BushRustle(this, this.foreground)
      this.network = new WorldMultiplayer()
      this.remoteAvatars = new RemoteAvatars(this, rendererResolution)
      controls.retryMultiplayer = () => this.network.retry()
      this.readers = createWorldReaders(this)
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
      this.destinationShadow = this.add.ellipse(0, 0, 14, 6, 0x183c45)
        .setDepth(3000).setVisible(false)
      this.destinationMarker = this.add.image(0, 0, 'navigation-destination')
        .setOrigin(0.5, 0.9234).setDepth(3001).setVisible(false)
      this.blockedMarker = this.add.image(0, 0, 'navigation-blocked')
        .setDepth(3001).setVisible(false)
      // Global key capture blocks typing in DOM inputs even when this scene is paused.
      this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q', false) as Record<
        string,
        Phaser.Input.Keyboard.Key
      >
      this.input.keyboard!.on('keydown', this.cancelWalkOnKey)
      this.cameras.main.setBackgroundColor('#59bdd5')
      window.addEventListener('blur', this.blur)
      window.addEventListener('focus', this.focusWindow)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('blur', this.blur)
        window.removeEventListener('focus', this.focusWindow)
        this.input.keyboard?.off('keydown', this.cancelWalkOnKey)
        this.mapTiles.destroy()
        this.network.destroy()
        controls.retryMultiplayer = undefined
      })
      this.cameras.main.centerOn(SPAWN.x, SPAWN.y)
      onReady()
    }

    update(time: number, delta: number) {
      if (!this.blob) return
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
          press.screen.x * this.scale.width / parent.clientWidth,
          press.screen.y * this.scale.height / parent.clientHeight
        )
        direction = pointerDirection(
          { x: target.x - this.position.x, y: target.y - (this.position.y - 16) },
          { x: camera.zoom * parent.clientWidth / this.scale.width, y: camera.zoom * parent.clientHeight / this.scale.height }
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
          screen.x * this.scale.width / parent.clientWidth,
          screen.y * this.scale.height / parent.clientHeight
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
      this.network.update(
        { ...next, dx: this.facing.x, dy: this.facing.y, moving },
        { avatar: controls.avatar, name: controls.avatarName, color: controls.avatarColor },
        controls.multiplayerEnabled !== false,
        performance.now()
      )
      if (moving) this.gait += delta / 100
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      const bounce = 0 // Hops are already drawn into the sprite frames.
      this.blobAvatar.update(this.blob, direction, moving, reducedMotion, delta, controls.avatar)
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
      this.destinationMarker.setAlpha(this.destinationMotion.alpha)
        .setVisible(this.destinationMotion.alpha > 0)
        .setDisplaySize(destinationSize * markerScaleX, destinationSize * markerScaleY)
      this.destinationShadow.setAlpha(0.22 * this.destinationMotion.alpha)
        .setVisible(this.destinationMotion.alpha > 0)
        .setDisplaySize(14 * markerScaleX * this.destinationMotion.size, 6 * markerScaleY * this.destinationMotion.size)
      if (this.route.points.length) {
        const target = this.route.points[this.route.points.length - 1]
        this.destinationMarker.setPosition(target.x, target.y - 2 * markerScaleY)
        this.destinationShadow.setPosition(target.x, target.y)
      }
      this.animateMarker(this.blockedMotion, Boolean(this.rejectedTarget && time < this.rejectedUntil), reducedMotion)
      const blockedSize = 30 * this.blockedMotion.size
      this.blockedMarker.setAlpha(this.blockedMotion.alpha)
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
        fade * fade * (3 - 2 * fade)
      )
      this.bushes.update(
        delta,
        [{ ...next, moving }, ...this.remoteAvatars.contacts],
        reducedMotion || controls.paused || !this.active || document.hidden
      )
      const targetX = controls.overview ? WIDTH / 2 : next.x
      const targetY = controls.overview ? HEIGHT / 2 : next.y - 38 * rendererResolution / zoom
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
      const activeAction = nearGuestbook(next, controls.navigation) ? 'guestbook' : station?.id
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
        const visible = anchor.id === activeAction && !controls.paused
        const value = String(visible)
        if (action.dataset.visible !== value) {
          action.dataset.visible = value
          action.disabled = !visible
          action.setAttribute('aria-hidden', String(!visible))
        }
      }
      this.shoreWaves?.update(
        delta,
        !this.active || document.hidden || (controls.paused && !shoreEditing),
        import.meta.env.DEV && controls.debug && controls.diagnosticFilters?.shorelines !== false
      )
      this.ambientZoneEditor?.update()
      this.background.update(camera)
      this.clouds.update(camera, delta, controls.paused || !this.active || document.hidden)
      this.ambience.update(
        camera,
        delta,
        next,
        (controls.paused && !shoreEditing) || !this.active || document.hidden
      )
      this.ambientTiles.update(camera, controls.paused || !this.active || document.hidden)
      this.centralBook.update(camera, delta, controls.paused || !this.active || document.hidden)
      for (const reader of this.readers)
        reader.update(camera, controls.paused || !this.active || document.hidden, next.x)
      // Camera zoom already includes the physical-pixel density.
      this.mapTiles.update(camera, time, 1)

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
