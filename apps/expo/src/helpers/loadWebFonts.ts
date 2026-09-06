import { loadAsync } from 'expo-font'
import { appFonts } from './appFonts'

export const loadWebFonts = async () => {
  await loadAsync(appFonts)
  // Some browser runtimes register @font-face without requesting an unused face.
  // Load reading/title faces explicitly before measuring and painting the UI.
  if (typeof document !== 'undefined' && document.fonts) {
    await Promise.all(
      ['Literata Book', 'eina-03-bold', 'FiraCode'].map(family =>
        document.fonts.load(`16px "${family}"`)
      )
    )
  }
}
