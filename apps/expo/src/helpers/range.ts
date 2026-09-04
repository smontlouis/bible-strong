export const range = (start: number, end: number) => {
  return Array(end - start + 1)
    .fill('')
    .map((_, idx) => start + idx)
}
