export function zeroFill(number, width = 2) {
  width -= number.toString().length
  if (width > 0) {
    return new Array(width + (/\./.test(number) ? 2 : 1)).join('0') + number
  }
  return `${number}` // always return a string
}
