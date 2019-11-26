export default function truncate(str, no_words) {
  return `${str
    .split(' ')
    .splice(0, no_words)
    .join(' ')}...`
}
