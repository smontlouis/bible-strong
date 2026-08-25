export function zeroFill(number: number | string, width: number = 2): string {
  width -= number.toString().length
  if (width > 0) {
    return new Array(width + (/\./.test(String(number)) ? 2 : 1)).join('0') + number
  }
  return `${number}` // always return a string
}
