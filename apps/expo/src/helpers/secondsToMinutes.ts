export function secondsToMinutes(s: number) {
  s = Math.round(s)
  const minutes = Math.floor(s / 60)
  const seconds = s % 60

  return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
