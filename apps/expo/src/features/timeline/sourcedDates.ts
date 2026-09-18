/** Parse explicit editorial dates only; never infer a year from prose. */
export function parseSourcedTimelineDates(
  value: string
): { start: number; end: number; approx: boolean } | undefined {
  const text = value.trim().toUpperCase().replace(/\./g, '')
  const match =
    /^(?:(C|CA|VERS)\s*)?(\d{1,4})(?:\s*[-–]\s*(\d{1,4}))?\s*(BC|BCE|AD|CE|AV\s*J-?C|AP\s*J-?C)$/u.exec(
      text
    )
  if (!match) return
  const sign = /^(BC|BCE|AV)/.test(match[4]) ? -1 : 1
  const start = Number(match[2]) * sign,
    end = Number(match[3] || match[2]) * sign
  if (!start || !end || end < start) return
  return { start, end, approx: Boolean(match[1]) }
}
