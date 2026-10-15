import Phaser from 'phaser'
import { AmbientDiagnostics } from './ambient-diagnostics'
import { APP_DOWNLOAD_STATION } from './app-download'
import { GAME_STATION } from './game-station'
import { islandActions, nearIslandAction, type IslandActionId } from './island-actions'
import { LazyOccluders } from './lazy-occluders'
import { LazyWorldAnimations } from './lazy-world-animations'
import { chooseCentralSpawn } from './multiplayer-spawn'
import { occlusionDepth } from './occlusion-depth'
import { PortalGlow } from './portal-glow'
import { StandCrowd } from './stand-crowd'
import { WATER_VARIANTS } from './water-decorations'
import { HEIGHT, occluders, SPAWN, stationAt, WIDTH, type Station } from './world'
import { SCENERY_HEIGHT, SCENERY_WIDTH, WorldBackground } from './world-background'
import { WorldClouds } from './world-clouds'
import { WORLD_PORTAL } from './world-portal'
import { startWorldGame, WorldScene, type SceneControls, type SceneFrame, type SceneState } from './world-scene'

export type WorldState = SceneState & {
  cameraZoom: number
  station: Station | null
  behind: string[]
}
export type Controls = SceneControls & {
  discoveryActions?: Partial<Record<IslandActionId, HTMLButtonElement | null>>
  appDownloadLink?: HTMLAnchorElement | null
  actionStack?: HTMLDivElement | null
}

/** The archipelago: its sky and clouds, the game terminal, the phone, the portal to Valence. */
class ArchipelagoScene extends WorldScene<Controls> {
  clouds!: WorldClouds
  ambientDiagnostics?: AmbientDiagnostics
  animations!: LazyWorldAnimations
  background!: WorldBackground
  lazyOccluders!: LazyOccluders
  portalGlow!: PortalGlow

  constructor(
    parent: HTMLElement,
    controls: Controls,
    private readonly publish: (state: WorldState) => void,
    onReady: () => void,
    onError: () => void
  ) {
    super({
      key: 'archipelago',
      parent,
      controls,
      onReady,
      onError,
      width: WIDTH,
      height: HEIGHT,
      scenery: { width: SCENERY_WIDTH, height: SCENERY_HEIGHT },
      cameraLift: 38,
      avatarSize: 52,
      look: { background: '#59bdd5', avatarShadow: 0x183c45, avatarShadowAlpha: 0.25, name: '#193d49', nameBackground: 0xfff9ea },
      preview: './assets/map/preview.webp',
    })
  }

  arrival() {
    const { navigation } = this.controls
    return chooseCentralSpawn(navigation) ?? this.safePosition(SPAWN) ?? { ...SPAWN }
  }
  resetPosition() {
    return this.safePosition(SPAWN) ?? this.position
  }
  tourStops() {
    return islandActions.map(({ x, y }) => ({ x, y }))
  }
  createCrowd() {
    return new StandCrowd(this.controls.navigation)
  }

  preloadScenery() {
    this.load.image('game-terminal', './assets/games/terminal.webp')
    this.load.image('app-download-phone', './assets/app-download/phone.webp')
    this.load.image('world-portal-arch', './assets/portals/arch-valence.webp')
    this.load.image('game-terminal-ground', './assets/games/terminal-ground.webp')
    this.load.image('world-water', './assets/map/water.webp')
    for (const variant of WATER_VARIANTS) this.load.image(`water-${variant}`, `./assets/map/water-${variant}.webp`)
    this.load.image('world-shore', './assets/map/shore.webp')
  }

  createScenery() {
    this.background = new WorldBackground(this)
    this.clouds = new WorldClouds(this)
    if (import.meta.env.DEV) this.ambientDiagnostics = new AmbientDiagnostics(this, () => this.ambience.diagnosticRegions)
    this.animations = new LazyWorldAnimations(this)
    this.add.image(726, 294, 'game-terminal-ground').setOrigin(0).setDisplaySize(68, 64).setDepth(-80)
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
    this.add
      .image(WORLD_PORTAL.x, WORLD_PORTAL.y, 'world-portal-arch')
      .setOrigin(0.5, 1)
      .setDisplaySize(WORLD_PORTAL.width, WORLD_PORTAL.height)
      .setDepth(WORLD_PORTAL.baseY)
    this.portalGlow = new PortalGlow(this, WORLD_PORTAL.opening, WORLD_PORTAL.baseY + 0.5)
    this.lazyOccluders = new LazyOccluders(this, this.bushes)
  }

  updateScenery({ time, delta, next, camera, zoom, screenWidth, screenHeight, reducedMotion, animating, arrivalTarget }: SceneFrame) {
    const { controls, parent } = this
    this.portalGlow.update(time, delta, reducedMotion)
    for (const anchor of islandActions) {
      const action = controls.discoveryActions?.[anchor.id]
      if (!action) continue
      // Project a fixed island anchor, independently of the avatar and its bounce.
      const point = this.project(anchor, zoom)
      action.style.translate = `${point.x - action.offsetWidth / 2}px ${point.y - action.offsetHeight / 2}px`
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
      const { x, y } = this.project(APP_DOWNLOAD_STATION, zoom)
      const width = APP_DOWNLOAD_STATION.width * scaleX
      const height = APP_DOWNLOAD_STATION.height * scaleY
      download.style.translate = `${x - width / 2}px ${y - height}px`
      download.style.width = `${width}px`
      download.style.height = `${height}px`
      const visible =
        !controls.paused && x + width / 2 > 0 && x - width / 2 < parent.clientWidth && y > 0 && y - height < parent.clientHeight
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
            (caption.left < hud.right && caption.right > hud.left && caption.top < hud.bottom && caption.bottom > hud.top)
        )
      }
    }
    this.background.update(camera)
    this.clouds.update(camera, delta, controls.paused || !animating)
    this.lazyOccluders.update(camera, delta, animating, next.x, arrivalTarget?.view)
    // Scene.create has already completed the essential preload. Download nearby artwork
    // immediately, independently of the intro/menu pause that controls animation playback.
    this.animations.update(camera, delta, !animating || controls.paused, next.x, {
      enabled: animating,
      view: arrivalTarget?.view,
    })
    this.ambientDiagnostics?.update(camera, controls.debug, document.documentElement.lang, controls.diagnosticFilters)
  }

  drawDebug(layer: Phaser.GameObjects.Graphics, { zoom }: SceneFrame) {
    if (this.controls.diagnosticFilters?.occluders === false) return
    for (const o of occluders) layer.lineStyle(1 / zoom, 0xffbe00, 0.9).strokeRect(o.x, o.y, o.width, o.height)
  }

  publishState({ next, zoom, moving }: SceneFrame) {
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
    this.publish({
      ...next,
      cameraZoom: zoom,
      station: stationAt(next, this.controls.navigation),
      behind,
      moving,
      fps: Math.round(this.game.loop.actualFps),
      multiplayer: this.network.status,
    })
  }
}

export function createWorld(
  parent: HTMLElement,
  controls: Controls,
  publish: (state: WorldState) => void,
  onReady: () => void,
  onError: () => void
) {
  return startWorldGame(new ArchipelagoScene(parent, controls, publish, onReady, onError))
}
