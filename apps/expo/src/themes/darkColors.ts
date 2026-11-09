import type defaultColors from './colors'

// « Sombre »: the public site's dark palette. App cards carry no outline, so a card takes the
// site's raised surface to stand off the canvas, and the text is a notch softer for long reading.
const colors: typeof defaultColors = {
  default: '#d6deeb',
  opacity5: 'rgba(214,222,235,0.05)',
  reverse: '#0e1521',
  border: '#273041',
  lightGrey: '#172235',
  canvas: '#0e1521',
  surface: '#172235',
  surfaceRaised: '#1e2b42',
  separator: 'rgba(170,192,232,0.16)',
  grey: '#abb7c9',
  darkGrey: 'rgba(214,222,235,0.5)',
  primary: 'rgb(89,131,240)',
  lightPrimary: '#17294c',
  link: '#7e9cf2',
  secondary: 'rgb(255,188,0)',
  lightSecondary: 'rgba(255,188,0, 0.15)',
  tertiary: 'rgb(166,190,204)',
  quart: 'rgb(194,40,57)',
  quint: 'rgb(253, 121, 168)',
  success: '#2ecc71',

  color1: '#81ecec',
  color2: '#ff7675',
  color3: '#fdcb6e',
  color4: '#74b9ff',
  color5: '#9b59b6',
}

export default colors
