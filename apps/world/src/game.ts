import { AmbientZoneEditor } from './ambient-zone-editor'
import type { AmbientEditorModel } from './ambient-zones'
import { ShoreWaves } from './shore-waves'
import type { ShoreEditorModel } from './shorelines'
import { WorldAmbience } from './world-ambience'
import { WorldClouds } from './world-clouds'
import { AmbientDiagnostics } from './ambient-diagnostics'
import { type DiagnosticFilters } from './diagnostic-filters'
import { AmbientTiles, loadAmbientTiles } from './ambient-tiles'
import Phaser from 'phaser'
import { MapTileStreamer } from './map-tile-streamer'
import { SCENERY_HEIGHT, SCENERY_WIDTH, WorldBackground } from './world-background'
import { WATER_VARIANTS } from './water-decorations'
import { createWorldReaders, loadWorldReaders } from './world-readers'
import type { AnimatedReader } from './animated-reader'
import {
  HEIGHT,
  WIDTH,
  SPAWN,
  move,
  occluders,
  stations,
  findSafePosition,
  type NavigationDocument,
  type Point,
  type Station,
} from './world'

export type Avatar = 'nova' | 'citrus' | 'strobi'
export type WorldState = {
  x: number
  y: number
  cameraZoom: number
  station: Station | null
  behind: string[]
  moving: boolean
  fps: number
}
export type Controls = {
  ambientEditor?: AmbientEditorModel
  shoreEditor?: ShoreEditorModel
  shoreZoom?: number
  navigation: NavigationDocument
  direction: Point
  avatar: Avatar
  paused: boolean
  overview: boolean
  debug: boolean
  diagnosticFilters?: DiagnosticFilters
  zoom: number
  reset: number
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
    position = { ...SPAWN }
    blob!: Phaser.GameObjects.Image
    shadow!: Phaser.GameObjects.Ellipse
    focus!: Phaser.GameObjects.Ellipse
    debugLayer!: Phaser.GameObjects.Graphics
    ambientZoneEditor?: AmbientZoneEditor
    shoreWaves?: ShoreWaves
    mapTiles!: MapTileStreamer
    clouds!: WorldClouds
    ambience!: WorldAmbience
    ambientDiagnostics!: AmbientDiagnostics
    ambientTiles!: AmbientTiles
    background!: WorldBackground
    readers!: AnimatedReader[]
    keys!: Record<string, Phaser.Input.Keyboard.Key>
    lastReset = 0
    lastPublished = 0
    gait = 0
    active = true
    previousNavigation = controls.navigation
    resetInput = () => {
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

    preload() {
      loadAmbientTiles(this)
      loadWorldReaders(this)
      this.load.image('world-water', './assets/map/water.webp')
      for (const variant of WATER_VARIANTS) {
        this.load.image(`water-${variant}`, `./assets/map/water-${variant}.webp`)
      }
      this.load.image('world-shore', './assets/map/shore.webp')
      this.load.image('map-preview', './assets/map/preview.webp')
      for (const object of occluders) this.load.image(`occlusion-${object.id}`, object.url)
      for (const name of ['nova', 'citrus', 'strobi']) this.load.image(name, `./assets/${name}.png`)
      this.load.on('loaderror', onError)
    }

    create() {
      this.position = findSafePosition(SPAWN, controls.navigation) ?? { ...SPAWN }
      this.background = new WorldBackground(this)
      this.ambience = new WorldAmbience(this, controls.ambientEditor)
      this.clouds = new WorldClouds(this)
      if (controls.ambientEditor)
        this.ambientZoneEditor = new AmbientZoneEditor(this, controls.ambientEditor)
      this.ambientDiagnostics = new AmbientDiagnostics(this, () => this.ambience.diagnosticRegions)
      this.ambientTiles = new AmbientTiles(this)
      this.add.image(0, 0, 'map-preview').setOrigin(0).setDisplaySize(WIDTH, HEIGHT).setDepth(-110)
      this.mapTiles = new MapTileStreamer(this)
      if (controls.shoreEditor) this.shoreWaves = new ShoreWaves(this, controls.shoreEditor)
      occluders.forEach(object => {
        this.add
          .image(object.x, object.y, `occlusion-${object.id}`)
          .setOrigin(0)
          .setDisplaySize(object.width, object.height)
          .setDepth(object.always ? 2000 : object.baseY)
      })
      this.readers = createWorldReaders(this)
      this.shadow = this.add.ellipse(SPAWN.x, SPAWN.y, 30, 10, 0x183c45, 0.25).setDepth(-1)
      this.focus = this.add
        .ellipse(0, 0, 44, 18)
        .setStrokeStyle(2, 0xfff7cd, 0.9)
        .setDepth(-1)
        .setVisible(false)
      this.blob = this.add
        .image(SPAWN.x, SPAWN.y, controls.avatar)
        .setOrigin(0.5, 0.95)
        .setDisplaySize(52, 52)
      this.debugLayer = this.add.graphics().setDepth(3000)
      this.keys = this.input.keyboard!.addKeys('UP,DOWN,LEFT,RIGHT,W,A,S,D,Z,Q') as Record<
        string,
        Phaser.Input.Keyboard.Key
      >
      this.cameras.main.setBackgroundColor('#59bdd5')
      window.addEventListener('blur', this.blur)
      window.addEventListener('focus', this.focusWindow)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        window.removeEventListener('blur', this.blur)
        window.removeEventListener('focus', this.focusWindow)
        this.mapTiles.destroy()
      })
      this.cameras.main.centerOn(SPAWN.x, SPAWN.y)
      onReady()
    }

    update(time: number, delta: number) {
      if (!this.blob) return
      if (this.input.keyboard) this.input.keyboard.enabled = !controls.paused
      if (this.previousNavigation !== controls.navigation) {
        this.position = findSafePosition(this.position, controls.navigation) ?? this.position
        this.previousNavigation = controls.navigation
        this.resetInput()
      }
      if (this.lastReset !== controls.reset) {
        this.position = findSafePosition(SPAWN, controls.navigation) ?? this.position
        this.lastReset = controls.reset
        this.resetInput()
      }
      let direction = controls.direction
      const horizontal =
        Number(this.keys.RIGHT.isDown || this.keys.D.isDown) -
        Number(this.keys.LEFT.isDown || this.keys.A.isDown || this.keys.Q.isDown)
      const vertical =
        Number(this.keys.DOWN.isDown || this.keys.S.isDown) -
        Number(this.keys.UP.isDown || this.keys.W.isDown || this.keys.Z.isDown)
      if (horizontal || vertical) direction = { x: horizontal, y: vertical }
      if (controls.paused || !this.active || document.hidden) {
        direction = { x: 0, y: 0 }
        this.resetInput()
      }
      const next = move(this.position, direction, delta / 1000, controls.navigation)
      const moving = Math.hypot(next.x - this.position.x, next.y - this.position.y) > 0.01
      this.position = next
      if (moving) this.gait += delta / 100
      const bounce =
        moving && !window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? Math.abs(Math.sin(this.gait)) * 3
          : 0
      this.blob
        .setTexture(controls.avatar)
        .setPosition(next.x, next.y - bounce)
        .setDepth(next.y)
        .setDisplaySize(52, 52)
      if (direction.x) this.blob.setFlipX(direction.x < 0)
      this.shadow.setPosition(next.x, next.y).setScale(1 - bounce / 18)
      const station = stations.find(s => Math.hypot(s.x - next.x, s.y - next.y) < 54) ?? null
      this.focus.setVisible(Boolean(station))
      if (station) this.focus.setPosition(station.x, station.y)

      const camera = this.cameras.main
      const screenWidth = this.scale.width,
        screenHeight = this.scale.height
      const shoreEditing = controls.shoreEditor?.editing || controls.ambientEditor?.editing
      if (shoreEditing && controls.shoreZoom) {
        camera.setZoom(Phaser.Math.Clamp(camera.zoom * controls.shoreZoom, 0.4, 8))
        controls.shoreZoom = undefined
      }
      const zoom = shoreEditing
        ? camera.zoom
        : controls.overview
          ? Math.min(screenWidth / SCENERY_WIDTH, screenHeight / SCENERY_HEIGHT) * 0.98
          : Math.max(1.2, screenHeight / HEIGHT) * controls.zoom
      camera.setZoom(zoom)
      const targetX = controls.overview ? WIDTH / 2 : next.x
      const targetY = controls.overview ? HEIGHT / 2 : next.y - 38 / zoom
      const halfWidth = screenWidth / zoom / 2,
        halfHeight = screenHeight / zoom / 2
      const centerX =
        halfWidth > WIDTH / 2 ? WIDTH / 2 : Phaser.Math.Clamp(targetX, halfWidth, WIDTH - halfWidth)
      const centerY =
        halfHeight > HEIGHT / 2
          ? HEIGHT / 2
          : Phaser.Math.Clamp(targetY, halfHeight, HEIGHT - halfHeight)
      const smoothing = 1 - Math.exp(-Math.min(delta, 50) / 110)
      // Phaser zooms around the viewport center; scroll is relative to the unzoomed viewport.
      if (!shoreEditing) {
        camera.scrollX += (centerX - screenWidth / 2 - camera.scrollX) * smoothing
        camera.scrollY += (centerY - screenHeight / 2 - camera.scrollY) * smoothing
      }
      this.shoreWaves?.update(
        delta,
        !this.active || document.hidden || (controls.paused && !shoreEditing),
        controls.debug && controls.diagnosticFilters?.shorelines !== false
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
      for (const reader of this.readers)
        reader.update(camera, controls.paused || !this.active || document.hidden)
      this.mapTiles.update(camera, time, controls.overview ? 1 : rendererResolution)

      this.ambientDiagnostics.update(
        camera,
        controls.debug,
        document.documentElement.lang,
        controls.diagnosticFilters
      )
      this.debugLayer.clear()
      if (controls.debug) {
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
              next.y < o.baseY &&
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
    scale: { mode: Phaser.Scale.RESIZE },
    render: { antialias: true, roundPixels: false },
    fps: { target: 60 },
    banner: false,
    audio: { noAudio: true },
  })
}
