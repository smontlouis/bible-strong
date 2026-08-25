export const STRONG_IDENTITY_KINDS = ['strong', 'estrong', 'dstrong', 'ustrong'] as const

export type StrongIdentityKind = (typeof STRONG_IDENTITY_KINDS)[number]

export type StrongIdentity = {
  kind: StrongIdentityKind
  code: string
}

export const createStrongIdentity = (
  reference: string | number,
  lexicalLanguage: 'greek' | 'hebrew'
): StrongIdentity => {
  const normalized = String(reference).trim().toUpperCase()
  const match = normalized.match(/^([HG])?0*(\d+)([A-Z]+)?$/u)
  const code = match
    ? `${match[1] ?? (lexicalLanguage === 'hebrew' ? 'H' : 'G')}${match[2].padStart(4, '0')}${
        match[3] ?? ''
      }`
    : normalized
  return {
    kind: /^[HG]\d+[A-Z]+$/u.test(code) ? 'dstrong' : 'strong',
    code,
  }
}

export const createStrongIdentityForBook = (
  reference: string | number,
  book: number
): StrongIdentity => createStrongIdentity(reference, book <= 39 ? 'hebrew' : 'greek')

export const areStrongIdentitiesEqual = (left: StrongIdentity, right: StrongIdentity): boolean =>
  left.kind === right.kind && left.code === right.code

const getClassicalStrongFamily = (code: string) => {
  const match = code.match(/^([HG])0*(\d+)/iu)
  return match ? `${match[1].toUpperCase()}${Number(match[2])}` : code
}

export const getDisplayedStrongIdentities = <Identity extends StrongIdentity>(
  identities: readonly Identity[]
): Identity[] => {
  const disambiguated = identities.filter(identity => identity.kind === 'dstrong')
  const disambiguatedFamilies = new Set(
    disambiguated.map(identity => getClassicalStrongFamily(identity.code))
  )
  const extended = identities.filter(
    identity =>
      identity.kind === 'estrong' &&
      !disambiguatedFamilies.has(getClassicalStrongFamily(identity.code))
  )
  const extendedFamilies = new Set(
    extended.map(identity => getClassicalStrongFamily(identity.code))
  )
  const classical = identities.filter(
    identity =>
      identity.kind === 'strong' &&
      !disambiguatedFamilies.has(getClassicalStrongFamily(identity.code)) &&
      !extendedFamilies.has(getClassicalStrongFamily(identity.code))
  )

  const seenFamilies = new Set<string>()
  return [...disambiguated, ...extended, ...classical].filter(identity => {
    const family = getClassicalStrongFamily(identity.code)
    if (seenFamilies.has(family)) return false
    seenFamilies.add(family)
    return true
  })
}

export const getStrongReferenceNumber = (code: string | number): string | undefined => {
  const numericCode = String(code).match(/\d+/u)?.[0]
  return numericCode ? String(Number(numericCode)) : undefined
}

export const resolveDisplayedStrongIdentities = (
  targetIdentities: readonly StrongIdentity[],
  alignedIdentities: readonly StrongIdentity[]
): StrongIdentity[] => {
  const targetFamilies = [
    ...new Set(targetIdentities.map(identity => getClassicalStrongFamily(identity.code))),
  ]
  const alignedFamilies = [
    ...new Set(alignedIdentities.map(identity => getClassicalStrongFamily(identity.code))),
  ]

  return [...targetFamilies, ...alignedFamilies.filter(family => !targetFamilies.includes(family))]
    .flatMap(family => {
      const targetFamily = targetIdentities.filter(
        identity => getClassicalStrongFamily(identity.code) === family
      )
      const alignedFamily = alignedIdentities.filter(
        identity => getClassicalStrongFamily(identity.code) === family
      )
      const disambiguated = getDisplayedStrongIdentities([...targetFamily, ...alignedFamily]).find(
        identity => identity.kind === 'dstrong'
      )
      if (disambiguated) return [disambiguated]

      const aligned = getDisplayedStrongIdentities(alignedFamily)[0]
      const target = getDisplayedStrongIdentities(targetFamily)[0]
      return aligned ? [aligned] : target ? [target] : []
    })
    .filter(
      (identity, index, identities) =>
        identities.findIndex(candidate => areStrongIdentitiesEqual(candidate, identity)) === index
    )
}
