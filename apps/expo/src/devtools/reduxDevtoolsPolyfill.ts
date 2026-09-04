import { getDevToolsPluginClientAsync } from 'expo/devtools'

// Interface attendue par jotai-devtools
interface ReduxDevToolsConnection {
  init: (state: unknown) => void
  send: (action: unknown, state: unknown) => void
  subscribe: (listener: (message: unknown) => void) => () => void
  shouldInit?: boolean
}

interface ReduxDevToolsExtension {
  connect: (options?: { name?: string }) => ReduxDevToolsConnection
  disconnect: () => void
}

type DevToolsWindow = {
  __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension
}

type GlobalWithDevTools = typeof globalThis & {
  window?: DevToolsWindow
  __REDUX_DEVTOOLS_EXTENSION__?: ReduxDevToolsExtension
}

type DevToolsClient = Awaited<ReturnType<typeof getDevToolsPluginClientAsync>>

let client: DevToolsClient | null = null
let connectionPromise: Promise<DevToolsClient | null> | null = null

async function getClient(): Promise<DevToolsClient | null> {
  if (client) return client
  if (connectionPromise) return connectionPromise

  connectionPromise = (async () => {
    try {
      client = await getDevToolsPluginClientAsync('redux-devtools-expo-dev-plugin')
      return client
    } catch (e) {
      console.warn('[Jotai DevTools] Failed to connect to Redux DevTools:', e)
      return null
    }
  })()

  return connectionPromise
}

const createConnection = (name: string): ReduxDevToolsConnection => {
  const listeners: ((message: unknown) => void)[] = []

  // Initialiser la connexion et écouter les messages
  getClient().then(c => {
    c?.addMessageListener('respond', data => {
      listeners.forEach(l => l(data))
    })
  })

  const connection: ReduxDevToolsConnection = {
    shouldInit: true,
    init: state => {
      getClient().then(c =>
        c?.sendMessage('log', {
          type: 'STATE',
          name,
          payload: JSON.stringify(state),
        })
      )
    },
    send: (action, state) => {
      getClient().then(c =>
        c?.sendMessage('log', {
          type: 'ACTION',
          name,
          action: JSON.stringify(action),
          payload: JSON.stringify(state),
        })
      )
    },
    subscribe: listener => {
      listeners.push(listener)
      return () => {
        const idx = listeners.indexOf(listener)
        if (idx >= 0) listeners.splice(idx, 1)
      }
    },
  }

  return connection
}

// Créer le polyfill
export const reduxDevToolsExtension: ReduxDevToolsExtension = {
  connect: options => createConnection(options?.name || 'jotai'),
  disconnect: () => {
    client = null
    connectionPromise = null
  },
}

// Installer le polyfill sur global et window (pour React Native)
export function installReduxDevToolsPolyfill() {
  if (!__DEV__) return

  // En React Native, global existe mais window peut ne pas exister
  // jotai-devtools cherche window.__REDUX_DEVTOOLS_EXTENSION__
  // Donc on doit créer window si nécessaire ou l'assigner sur global

  if (typeof global !== 'undefined') {
    const globalWithDevTools = global as GlobalWithDevTools

    // Créer window sur global si n'existe pas (React Native)
    if (typeof globalWithDevTools.window === 'undefined') {
      Reflect.set(globalWithDevTools, 'window', globalWithDevTools)
    }

    globalWithDevTools.__REDUX_DEVTOOLS_EXTENSION__ = reduxDevToolsExtension
    ;(globalWithDevTools.window as DevToolsWindow).__REDUX_DEVTOOLS_EXTENSION__ =
      reduxDevToolsExtension

    console.log('[Jotai DevTools Polyfill] Installed successfully')
  }
}
