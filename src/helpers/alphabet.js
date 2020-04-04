export const alphabet = [
  // '#', // TODO MAKE THIS AVAILABLE
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
]

export const getFirstLetterFrom = value =>
  alphabet.includes(value.slice(0, 1).toUpperCase())
    ? value.slice(0, 1).toUpperCase()
    : '#'
