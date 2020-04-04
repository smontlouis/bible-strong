export const deltaToPlainText = delta =>
  delta.reduce((text, op) => {
    if (!op.insert) {
      return `${text} `
    }
    if (typeof op.insert !== 'string') {
      return `${text} `
    }
    return text + op.insert
  }, '')
