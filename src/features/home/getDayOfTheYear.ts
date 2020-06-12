export const getDayOfTheYear = (addDay?: number) => {
  const now = new Date()
  if (addDay) {
    now.setDate(now.getDate() + addDay)
  }
  const start = new Date(now.getFullYear(), 0, 0)
  const diff =
    now -
    start +
    (start.getTimezoneOffset() - now.getTimezoneOffset()) * 60 * 1000
  const oneDay = 1000 * 60 * 60 * 24
  const day = Math.floor(diff / oneDay)
  return day
}
