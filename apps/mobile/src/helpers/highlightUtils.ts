// Opacité du background pour les highlights (en pourcentage, 0-100)
export const HIGHLIGHT_BACKGROUND_OPACITY = 90

// Calcule la luminosité relative d'une couleur hex (0 = noir, 1 = blanc)
export const getRelativeLuminance = (hex: string): number => {
  const rgb = hex.replace('#', '')
  const r = parseInt(rgb.substring(0, 2), 16) / 255
  const g = parseInt(rgb.substring(2, 4), 16) / 255
  const b = parseInt(rgb.substring(4, 6), 16) / 255

  // Formule standard de luminosité relative (ITU-R BT.709)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

// Détermine si le texte doit être inversé (blanc sur fond sombre, noir sur fond clair)
export const getContrastTextColor = (hex: string, isDarkTheme: boolean): string | undefined => {
  const luminance = getRelativeLuminance(hex)

  if (isDarkTheme) {
    // Dark mode: texte blanc par défaut, noir si background trop clair
    if (luminance > 0.5) return '#000000'
  } else {
    // Light mode: texte noir par défaut, blanc si background trop foncé
    if (luminance < 0.6) return '#FFFFFF'
  }

  return undefined
}

// Convertit l'opacité en valeur hex (0-100 -> 00-FF)
export const opacityToHex = (opacity: number): string => {
  const value = Math.round((opacity / 100) * 255)
  return value.toString(16).padStart(2, '0')
}

// Opacité du background en hex pour React Native styles
export const HIGHLIGHT_BACKGROUND_OPACITY_HEX = opacityToHex(HIGHLIGHT_BACKGROUND_OPACITY)
