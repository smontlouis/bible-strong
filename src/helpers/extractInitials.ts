const extractInitials = (str: string) => {
  if (str) {
    return str
      .split(' ')
      .map(n => n.substring(0, 1))
      .slice(0, 2)
  }

  return ''
}

export default extractInitials
