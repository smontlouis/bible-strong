const formatResourceSize = (bytes: number, lang: string): string => {
  const value = bytes / 1_000_000
  return `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value)} ${
    lang === 'fr' ? 'Mo' : 'MB'
  }`
}

export default formatResourceSize
