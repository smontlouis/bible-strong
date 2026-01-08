import { getDevToolsPluginClientAsync } from 'expo/devtools'

// Interface attendue par jotai-devtools
interface ReduxDevToolsConnection {
  init: (state: any) => void
  send: (action: any, state: any) => void
  subscribe: (listener: (message: any) => void) => () => void
  shouldInit?: boolean
}

interface ReduxDevToolsExtension {
  connect: (options?: { name?: string }) => ReduxDevToolsConnection
  disconnect: () => void
}

type DevToolsClient = Awaited<ReturnType<typeof getDevToolsPluginClientAsync>>

let client: DevToolsClient | null = null
let isConnecting = false
let connectionPromise: Promise<DevToolsClient | null> | null = null

async function getClient(): Promise<DevToolsClient | null> {
  if (client) return client
  if (connectionPromise) return connectionPromise

  isConnecting = true
  connectionPromise = (async () => {
    try {
      client = await getDevToolsPluginClientAsync('redux-devtools-expo-dev-plugin')
      return client
    } catch (e) {
      console.warn('[Jotai DevTools] Failed to connect to Redux DevTools:', e)
      return null
    } finally {
      isConnecting = false
    }
  })()

  return connectionPromise
}

const createConnection = (name: string): ReduxDevToolsConnection => {
  const listeners: ((message: any) => void)[] = []

  // Initialiser la connexion et écouter les messages
  getClient().then(c => {
    c?.addMessageListener('respond', (data: any) => {
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
    // Créer window sur global si n'existe pas (React Native)
    if (typeof (global as any).window === 'undefined') {
      ;(global as any).window = global
    }

    ;(global as any).__REDUX_DEVTOOLS_EXTENSION__ = reduxDevToolsExtension
    ;(global as any).window.__REDUX_DEVTOOLS_EXTENSION__ = reduxDevToolsExtension

    console.log('[Jotai DevTools Polyfill] Installed successfully')
  }
}
