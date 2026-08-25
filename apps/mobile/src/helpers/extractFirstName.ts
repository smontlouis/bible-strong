const extractFirstName = (str: string) => {
  if (str) {
    return str.split(' ')[0]
  }

  return ''
}

export default extractFirstName
