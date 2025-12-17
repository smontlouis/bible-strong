export default function truncate(str: string, no_words: number) {
  return `${str.split(' ').splice(0, no_words).join(' ')}...`
}
