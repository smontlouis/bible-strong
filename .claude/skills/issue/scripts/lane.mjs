#!/usr/bin/env node
// Prépare et range un « couloir » de travail /issue : worktree, simulateur cloné
// (ou émulateur Android du PC), Metro sur un port dédié, app ouverte dessus.
//
//   node lane.mjs template [--from <udid>]       crée le simulateur modèle bs-template
//   node lane.mjs start <slug> [--android]       worktree + install + appareil + Metro + ouverture
//   node lane.mjs worktree <slug>                étape 1 : worktree et .env (quelques secondes)
//   node lane.mjs install <slug>                 étape 2 : yarn install complet (plusieurs minutes)
//   node lane.mjs device <slug> [--android]      étape 3 : clone, boot, installation du .app
//   node lane.mjs metro <slug>                   étape 4 : Metro sur le port du couloir
//   node lane.mjs open <slug>                    ouvre l'app du couloir sur son Metro
//   node lane.mjs status [slug]                  état des couloirs
//   node lane.mjs stop <slug>                    arrête Metro et le tunnel Android
//   node lane.mjs cleanup <slug> [--force]       stop + supprime simulateur et worktree
//
// L'état de chaque couloir vit hors du repo, dans ~/.cache/bible-strong-issues/<slug>.json.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import net from 'node:net'
import { execFileSync, spawn } from 'node:child_process'

const TEMPLATE_NAME = 'bs-template'
const BUILDS_DIR = path.join(os.homedir(), 'Builds/bible-strong')
const STATE_DIR = path.join(os.homedir(), '.cache/bible-strong-issues')
const FIRST_PORT = 8082
const MIN_FREE_GB = 15
const ANDROID_SERIAL = process.env.ANDROID_PC_SERIAL ?? 'emulator-5554'
const ANDROID_PACKAGE = process.env.ANDROID_PC_PACKAGE ?? 'com.smontlouis.biblestrong'
const IOS_DEV_BUNDLE_ID = 'com.smontlouis.biblestrong.dev'
// Fichiers dont un changement depuis le build du .app peut demander un nouveau dev client.
const NATIVE_PATHS = [
  'apps/expo/package.json',
  'apps/expo/app.config.ts',
  'apps/expo/modules',
  'apps/expo/plugins',
  '.yarn/patches',
]

const [command, ...rest] = process.argv.slice(2)
const flags = new Set(rest.filter(arg => arg.startsWith('--')))
const positional = rest.filter(
  (arg, i) => !arg.startsWith('--') && !rest[i - 1]?.startsWith('--from')
)
const flagValue = name => {
  const i = rest.indexOf(name)
  return i === -1 ? undefined : rest[i + 1]
}

// Avec stdio 'inherit', execFileSync renvoie null : on rend alors une chaîne vide.
const run = (cmd, args, options = {}) =>
  (
    execFileSync(cmd, args, {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
      cwd: options.cwd,
      env: options.env ?? process.env,
    }) ?? ''
  ).trim()

const tryRun = (cmd, args, options) => {
  try {
    return run(cmd, args, options)
  } catch {
    return null
  }
}

const log = message => console.log(`[lane] ${message}`)
const fail = message => {
  console.error(`[lane] ERREUR : ${message}`)
  process.exit(1)
}

const mainCheckout = (() => {
  const common = tryRun('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'])
  if (!common) fail('à lancer depuis le repo bible-strong-app (ou un de ses worktrees)')
  return path.dirname(common)
})()

const slugify = value =>
  value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
    .replace(/-+$/g, '')

const statePath = slug => path.join(STATE_DIR, `${slug}.json`)
const readState = slug => {
  try {
    return JSON.parse(fs.readFileSync(statePath(slug), 'utf8'))
  } catch {
    return null
  }
}
const writeState = state => {
  fs.mkdirSync(STATE_DIR, { recursive: true })
  fs.writeFileSync(statePath(state.slug), `${JSON.stringify(state, null, 2)}\n`)
}
const allStates = () => {
  if (!fs.existsSync(STATE_DIR)) return []
  return fs
    .readdirSync(STATE_DIR)
    .filter(file => file.endsWith('.json'))
    .map(file => readState(file.slice(0, -5)))
    .filter(Boolean)
}

const requireSlug = () => {
  const raw = positional[0]
  if (!raw) fail(`usage : node lane.mjs ${command} <slug>`)
  const slug = slugify(raw)
  if (!slug) fail(`slug invalide : ${raw}`)
  return slug
}

const loadOrInitState = slug =>
  readState(slug) ?? {
    slug,
    branch: `issue/${slug}`,
    worktree: path.join(mainCheckout, '.claude/worktrees', slug),
    platform: 'ios',
    createdAt: new Date().toISOString(),
  }

// ---------- simulateurs ----------

const simDevices = () => {
  const json = JSON.parse(run('xcrun', ['simctl', 'list', 'devices', '-j']))
  return Object.entries(json.devices).flatMap(([runtime, devices]) =>
    devices.map(device => ({ ...device, runtime }))
  )
}
const simByName = name => simDevices().find(device => device.name === name && device.isAvailable)
const simByUdid = udid => simDevices().find(device => device.udid === udid)

// ---------- ports et Metro ----------

const portFree = port =>
  new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.once('listening', () => server.close(() => resolve(true)))
    server.listen(port, '127.0.0.1')
  })

const pickPort = async slug => {
  const claimed = new Set(
    allStates()
      .filter(s => s.slug !== slug)
      .map(s => s.port)
  )
  for (let port = FIRST_PORT; port < FIRST_PORT + 50; port += 1) {
    if (!claimed.has(port) && (await portFree(port))) return port
  }
  fail('aucun port libre entre 8082 et 8131')
}

const metroRunning = async port => {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/status`)
    return (await response.text()).includes('packager-status:running')
  } catch {
    return false
  }
}

const pidAlive = pid => {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// Le schéma exp+bible-strong est aussi déclaré par l'app staging : sur iOS, on vise le dev
// client par son schéma propre (son bundle id) ; sur Android, par son package.
const devClientUrl = (port, scheme = 'exp+bible-strong') =>
  `${scheme}://expo-development-client/?url=${encodeURIComponent(`http://localhost:${port}`)}`

// ---------- build du dev client ----------

const newestApp = () => {
  if (!fs.existsSync(BUILDS_DIR)) return null
  const apps = fs
    .readdirSync(BUILDS_DIR)
    .filter(name => name.endsWith('.app') && name.includes('simulator'))
    .map(name => ({ name, file: path.join(BUILDS_DIR, name) }))
    .map(app => ({ ...app, mtime: fs.statSync(app.file).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
  return apps[0] ?? null
}

// Avertit si le .app ne correspond plus au code natif du worktree.
const nativeWarnings = (app, worktree) => {
  const warnings = []
  const match = app.name.match(/-(\d+)\.(\d+)\.\d+-simulator-([0-9a-f]{7,40})\.app$/)
  if (!match) return ['nom du .app inattendu : impossible de vérifier sa version']
  const [, major, minor, sha] = match
  const config = fs.readFileSync(path.join(worktree, 'apps/expo/app.config.ts'), 'utf8')
  const version = config.match(/APP_VERSION\s*=\s*'(\d+)\.(\d+)\.\d+'/)
  if (version && (version[1] !== major || version[2] !== minor)) {
    warnings.push(
      `runtime du .app ${major}.${minor} ≠ runtime du worktree ${version[1]}.${version[2]} : il faut un nouveau build`
    )
  }
  if (tryRun('git', ['cat-file', '-e', `${sha}^{commit}`], { cwd: worktree }) === null) {
    warnings.push(`commit ${sha} du build inconnu localement : changements natifs non vérifiés`)
    return warnings
  }
  const changed = tryRun('git', ['diff', '--name-only', sha, 'HEAD', '--', ...NATIVE_PATHS], {
    cwd: worktree,
  })
  if (changed) {
    warnings.push(
      `fichiers natifs modifiés depuis le build ${sha} (à vérifier, un nouveau dev client peut être nécessaire) :\n    ${changed.split('\n').join('\n    ')}`
    )
  }
  return warnings
}

// ---------- étapes ----------

const cmdTemplate = () => {
  if (simByName(TEMPLATE_NAME))
    fail(`${TEMPLATE_NAME} existe déjà ; supprime-le d'abord pour le recréer`)
  const from =
    flagValue('--from') ??
    simDevices().find(device => device.state === 'Booted' && device.name.startsWith('iPhone'))?.udid
  if (!from) fail('aucun iPhone démarré à cloner ; passe --from <udid>')
  const source = simByUdid(from)
  log(`clone de ${source?.name ?? from} vers ${TEMPLATE_NAME} (la source s'arrête puis redémarre)`)
  run('simslim', ['clone', from, TEMPLATE_NAME], { stdio: 'inherit' })
  const template = simByName(TEMPLATE_NAME)
  if (!template) fail('clone introuvable après simslim clone')
  if (template.state === 'Booted') run('simslim', ['shutdown', template.udid], { stdio: 'inherit' })
  log(`${TEMPLATE_NAME} prêt : ${template.udid}`)
}

const cmdWorktree = slug => {
  const state = loadOrInitState(slug)
  const freeGb =
    Number(run('df', ['-k', mainCheckout]).split('\n')[1].split(/\s+/)[3]) / 1024 / 1024
  if (!fs.existsSync(state.worktree) && freeGb < MIN_FREE_GB) {
    fail(
      `${freeGb.toFixed(1)} Go libres, il en faut au moins ${MIN_FREE_GB} pour un worktree installé`
    )
  }

  if (fs.existsSync(state.worktree)) {
    log(`worktree déjà présent : ${state.worktree}`)
  } else {
    log('git fetch origin master')
    run('git', ['fetch', 'origin', 'master'], { cwd: mainCheckout, stdio: 'inherit' })
    const branchExists = tryRun('git', ['rev-parse', '--verify', '--quiet', state.branch], {
      cwd: mainCheckout,
    })
    const args = branchExists
      ? ['worktree', 'add', state.worktree, state.branch]
      : ['worktree', 'add', '-b', state.branch, state.worktree, 'origin/master']
    run('git', args, { cwd: mainCheckout, stdio: 'inherit' })
    // La branche ne suit pas origin/master : le premier push la créera sur origin.
    tryRun('git', ['branch', '--unset-upstream', state.branch], { cwd: mainCheckout })
  }

  // Les .env sont ignorés par git : on reprend ceux du checkout principal.
  const envFiles = run(
    'git',
    ['ls-files', '--others', '--ignored', '--exclude-standard', '--directory'],
    {
      cwd: mainCheckout,
    }
  )
    .split('\n')
    .filter(file => /(^|\/)\.env[^/]*$/.test(file))
    .filter(file => !file.includes('node_modules/') && !file.startsWith('.claude/'))
  for (const file of envFiles) {
    const target = path.join(state.worktree, file)
    if (fs.existsSync(target)) continue
    fs.mkdirSync(path.dirname(target), { recursive: true })
    fs.copyFileSync(path.join(mainCheckout, file), target)
  }
  log(`${envFiles.length} fichier(s) .env recopiés`)

  writeState(state)
  log(`worktree prêt sur ${state.branch} : ${state.worktree}`)
  return state
}

const cmdInstall = slug => {
  const state = readState(slug)
  if (!state || !fs.existsSync(state.worktree)) fail("pas de worktree : lance d'abord `worktree`")
  if (fs.existsSync(path.join(state.worktree, 'node_modules/.yarn-state.yml'))) {
    log('node_modules déjà installé')
  } else {
    log('yarn install (complet, plusieurs minutes)')
    run('yarn', ['install'], {
      cwd: state.worktree,
      stdio: 'inherit',
      env: { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
    })
  }
  // yarn réécrit ce fichier suivi : on le remet pour qu'il ne pollue pas la PR.
  tryRun('git', ['checkout', '--', '.yarn/install-state.gz'], { cwd: state.worktree })
  log('dépendances installées')
  return state
}

const cmdDevice = slug => {
  const state = loadOrInitState(slug)
  if (!fs.existsSync(state.worktree)) fail("pas de worktree : lance d'abord `worktree` ou `start`")
  state.platform = flags.has('--android') ? 'android' : 'ios'

  if (state.platform === 'android') {
    log(`Android : émulateur partagé ${ANDROID_SERIAL} sur le PC (dev client déjà installé)`)
    log(
      'si le code natif change : ANDROID_PC_REPO=<worktree> android-pc build && android-pc install'
    )
    writeState(state)
    return state
  }

  const template = simByName(TEMPLATE_NAME)
  if (!template)
    fail(`simulateur ${TEMPLATE_NAME} absent : lance une fois \`node lane.mjs template\``)
  if (template.state !== 'Shutdown') fail(`${TEMPLATE_NAME} doit être éteint pour être cloné`)

  const simName = `bs-${slug}`
  let sim = simByName(simName)
  if (sim) {
    log(`simulateur déjà présent : ${simName} (${sim.udid})`)
  } else {
    log(`clone de ${TEMPLATE_NAME} vers ${simName}`)
    run('simslim', ['clone', template.udid, simName], { stdio: 'inherit' })
    sim = simByName(simName)
    if (!sim) fail('clone introuvable après simslim clone')
  }
  if (simByUdid(sim.udid).state !== 'Booted') {
    run('simslim', ['boot', sim.udid], { stdio: 'inherit' })
  }
  state.simUdid = sim.udid
  state.simName = simName

  const app = newestApp()
  if (!app) {
    log(`aucun .app dans ${BUILDS_DIR} : on garde le dev client hérité du modèle`)
  } else {
    log(`installation de ${app.name} (les données de l'app sont gardées)`)
    run('xcrun', ['simctl', 'install', sim.udid, app.file], { stdio: 'inherit' })
    state.app = app.name
    state.bundleId =
      tryRun('plutil', [
        '-extract',
        'CFBundleIdentifier',
        'raw',
        path.join(app.file, 'Info.plist'),
      ]) || IOS_DEV_BUNDLE_ID
    for (const warning of nativeWarnings(app, state.worktree)) log(`ATTENTION : ${warning}`)
  }
  tryRun('open', ['-a', 'Simulator', '--args', '-CurrentDeviceUDID', sim.udid])

  writeState(state)
  log(`simulateur prêt : ${simName} (${sim.udid})`)
  return state
}

const cmdMetro = async slug => {
  const state = loadOrInitState(slug)
  if (!fs.existsSync(state.worktree)) fail("pas de worktree : lance d'abord `worktree` ou `start`")
  if (state.port && pidAlive(state.metroPid) && (await metroRunning(state.port))) {
    log(`Metro tourne déjà sur ${state.port} (pid ${state.metroPid})`)
    return state
  }
  state.port = await pickPort(slug)
  const logFile = path.join(STATE_DIR, `${slug}.metro.log`)
  fs.mkdirSync(STATE_DIR, { recursive: true })
  const out = fs.openSync(logFile, 'w')
  const child = spawn(
    'yarn',
    ['workspace', '@bible-strong/expo', 'start', '--port', String(state.port), '--clear'],
    { cwd: state.worktree, detached: true, stdio: ['ignore', out, out] }
  )
  child.unref()
  state.metroPid = child.pid
  state.metroLog = logFile
  writeState(state)
  log(`Metro démarre sur ${state.port} (pid ${child.pid}, log ${logFile})`)

  for (let i = 0; i < 90; i += 1) {
    if (await metroRunning(state.port)) {
      log('Metro prêt')
      break
    }
    if (!pidAlive(child.pid)) fail(`Metro s'est arrêté, voir ${logFile}`)
    await new Promise(resolve => setTimeout(resolve, 2000))
  }
  if (!(await metroRunning(state.port))) fail(`Metro ne répond pas après 3 min, voir ${logFile}`)

  if (state.platform === 'android') {
    const forward = `${state.port}:127.0.0.1:${state.port}`
    if (!tryRun('pgrep', ['-f', `-R ${forward}`])) {
      run('ssh', ['-f', '-N', '-o', 'ExitOnForwardFailure=yes', '-R', forward, 'pc-android'])
    }
    run('ssh', [
      'pc-android',
      `adb -s ${ANDROID_SERIAL} reverse tcp:${state.port} tcp:${state.port}`,
    ])
    log(`tunnel Android ouvert : émulateur:${state.port} → PC → Mac:${state.port}`)
  }
  return state
}

const cmdOpen = slug => {
  const state = readState(slug)
  if (!state?.port) fail('couloir sans Metro : lance `metro` ou `start`')
  if (state.platform === 'android') {
    run('ssh', [
      'pc-android',
      `adb -s ${ANDROID_SERIAL} shell am start -a android.intent.action.VIEW -d '${devClientUrl(state.port)}' ${ANDROID_PACKAGE}`,
    ])
  } else {
    if (!state.simUdid) fail('couloir sans simulateur : lance `device`')
    const bundleId = state.bundleId ?? IOS_DEV_BUNDLE_ID
    // L'app au premier plan reçoit le lien sans le dialogue « Ouvrir dans … ? » d'iOS.
    run('xcrun', ['simctl', 'launch', '--terminate-running-process', state.simUdid, bundleId])
    run('xcrun', ['simctl', 'openurl', state.simUdid, devClientUrl(state.port, bundleId)])
  }
  log(`app ouverte sur Metro ${state.port}`)
}

const cmdStop = slug => {
  const state = readState(slug)
  if (!state) fail(`couloir inconnu : ${slug}`)
  if (pidAlive(state.metroPid)) {
    // Le groupe de processus entier : yarn, node et les workers de Metro.
    try {
      process.kill(-state.metroPid, 'SIGTERM')
    } catch {
      process.kill(state.metroPid, 'SIGTERM')
    }
    log(`Metro arrêté (pid ${state.metroPid})`)
  }
  if (state.platform === 'android' && state.port) {
    tryRun('pkill', ['-f', `-R ${state.port}:127.0.0.1:${state.port}`])
    tryRun('ssh', ['pc-android', `adb -s ${ANDROID_SERIAL} reverse --remove tcp:${state.port}`])
  }
  delete state.metroPid
  writeState(state)
  return state
}

const cmdCleanup = slug => {
  const state = cmdStop(slug)
  if (state.simUdid && simByUdid(state.simUdid)) {
    run('simslim', ['delete', state.simUdid], { stdio: 'inherit' })
    log(`simulateur ${state.simName} supprimé`)
  }
  if (fs.existsSync(state.worktree)) {
    const dirty = run('git', ['status', '--porcelain'], { cwd: state.worktree })
    if (dirty && !flags.has('--force')) {
      fail(
        `le worktree a des changements non commités ; relance avec --force pour les jeter :\n${dirty}`
      )
    }
    run(
      'git',
      ['worktree', 'remove', ...(flags.has('--force') ? ['--force'] : []), state.worktree],
      {
        cwd: mainCheckout,
        stdio: 'inherit',
      }
    )
    log(`worktree supprimé (branche ${state.branch} gardée)`)
  }
  fs.rmSync(statePath(slug), { force: true })
  fs.rmSync(path.join(STATE_DIR, `${slug}.metro.log`), { force: true })
  log('couloir nettoyé')
}

const cmdStatus = async () => {
  const states = positional[0] ? [readState(slugify(positional[0]))].filter(Boolean) : allStates()
  if (!states.length) return log('aucun couloir')
  for (const state of states) {
    const metro =
      state.port && (await metroRunning(state.port)) ? `Metro ${state.port} ✓` : 'Metro arrêté'
    const device =
      state.platform === 'android'
        ? `Android ${ANDROID_SERIAL}`
        : state.simUdid
          ? `${state.simName} (${simByUdid(state.simUdid)?.state ?? 'supprimé'})`
          : 'pas de simulateur'
    console.log(
      `${state.slug}\n  branche  ${state.branch}\n  worktree ${state.worktree}\n  appareil ${device}\n  ${metro}`
    )
  }
}

const main = async () => {
  switch (command) {
    case 'template':
      return cmdTemplate()
    case 'worktree':
      return cmdWorktree(requireSlug())
    case 'install':
      return cmdInstall(requireSlug())
    case 'device':
      return cmdDevice(requireSlug())
    case 'metro':
      return cmdMetro(requireSlug())
    case 'open':
      return cmdOpen(requireSlug())
    case 'start': {
      const slug = requireSlug()
      cmdWorktree(slug)
      cmdInstall(slug)
      cmdDevice(slug)
      await cmdMetro(slug)
      cmdOpen(slug)
      const state = readState(slug)
      console.log(`\n[lane] PRÊT\n${JSON.stringify(state, null, 2)}`)
      return
    }
    case 'stop':
      return cmdStop(requireSlug())
    case 'cleanup':
      return cmdCleanup(requireSlug())
    case 'status':
      return cmdStatus()
    default:
      console.log(
        fs
          .readFileSync(new URL(import.meta.url), 'utf8')
          .split('\n')
          .slice(1, 16)
          .join('\n')
      )
      process.exit(command ? 1 : 0)
  }
}

await main()
