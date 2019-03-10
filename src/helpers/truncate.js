export default (text: string, nbChars: number) => {
  if (!text) return ''
  const truncatedText = text
    .replace(/(\r\n|\n|\r)/gm, '')
    .replace(new RegExp(`^(.{${nbChars}}[^\\s]*).*`, 'gi'), '$1')
    .concat('...')
  if (truncatedText.length >= text.length) return text
  return truncatedText
}
