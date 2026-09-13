const AVATAR_COLORS = ['#2F6FDB', '#147D82', '#7652A7', '#A45D79', '#A56532'] as const

const hash = (value: string) =>
  [...value].reduce((result, character) => result + character.charCodeAt(0), 0)

export const getCommentaryInitials = (author: string, fallback: string) => {
  if (/ellen g\. white/iu.test(author)) return 'EGW'

  const compactFallback = fallback.replace(/[^\p{L}\p{N}]/gu, '')
  if (/^[\p{Lu}\p{N}]{2,4}$/u.test(compactFallback)) return compactFallback

  const words = author
    .replace(/\([^)]*\)/gu, '')
    .split(/[\s,&–—-]+/u)
    .map(word => word.replace(/[^\p{L}\p{N}]/gu, ''))
    .filter(Boolean)

  if (words.length >= 2) return `${words[0][0]}${words.at(-1)?.[0]}`.toLocaleUpperCase()
  if (words.length === 1) return words[0].slice(0, 2).toLocaleUpperCase()
  return fallback.slice(0, 2).toLocaleUpperCase()
}

export const getCommentaryAvatarColor = (resourceCode: string) =>
  AVATAR_COLORS[hash(resourceCode) % AVATAR_COLORS.length]
