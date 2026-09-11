export function matchesQuery(query: string, ...values: string[]) {
  const normalize = (value: string) =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
  const text = normalize(values.join(' '))
  return normalize(query)
    .trim()
    .split(/\s+/)
    .every(word => text.includes(word))
}
