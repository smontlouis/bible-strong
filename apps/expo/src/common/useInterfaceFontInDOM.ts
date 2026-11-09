import { IS_DOM } from 'expo/dom'
import { useFonts } from 'expo-font'
import type { FontFamilyDefinition } from 'expo-font'

/**
 * The interface face for a DOM component. In the web view of the native apps the document has
 * not loaded Pulp Display, so this declares its faces there; on the web the app's stylesheet
 * already serves them (`global.web.css`), and this loads nothing.
 */
const PULP_DISPLAY: FontFamilyDefinition[] = [
  {
    fontFamily: 'Pulp Display',
    fontDefinitions: [
      { path: require('~assets/fonts/PulpDisplay-Regular.ttf'), weight: 400 },
      {
        path: require('~assets/fonts/PulpDisplay-RegularItalic.ttf'),
        weight: 400,
        style: 'italic',
      },
      { path: require('~assets/fonts/PulpDisplay-Medium.ttf'), weight: 500 },
      { path: require('~assets/fonts/PulpDisplay-MediumItalic.ttf'), weight: 500, style: 'italic' },
      { path: require('~assets/fonts/PulpDisplay-SemiBold.ttf'), weight: 600 },
      {
        path: require('~assets/fonts/PulpDisplay-SemiBoldItalic.ttf'),
        weight: 600,
        style: 'italic',
      },
      { path: require('~assets/fonts/PulpDisplay-Bold.ttf'), weight: 700 },
      { path: require('~assets/fonts/PulpDisplay-BoldItalic.ttf'), weight: 700, style: 'italic' },
      { path: require('~assets/fonts/PulpDisplay-ExtraBold.ttf'), weight: 800 },
      {
        path: require('~assets/fonts/PulpDisplay-ExtraBoldItalic.ttf'),
        weight: 800,
        style: 'italic',
      },
    ],
  },
]

export const useInterfaceFontInDOM = () => {
  useFonts(IS_DOM ? PULP_DISPLAY : [])
}
