// The browser loads its stored state from IndexedDB before any module of the app reads it
// (`src/helpers/storage.web.ts`); the desktop app's is served with the page.
import { prepareStorage } from './src/helpers/storage'

void prepareStorage().then(() => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('expo-router/entry')
})
