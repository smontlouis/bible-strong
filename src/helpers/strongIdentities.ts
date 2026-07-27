export type StrongIdentity = {
  kind: 'strong' | 'estrong' | 'dstrong' | 'ustrong'
  code: string
}

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
  const classical = identities.filter(
    identity =>
      identity.kind === 'strong' &&
      !disambiguatedFamilies.has(getClassicalStrongFamily(identity.code))
  )

  return [...disambiguated, ...classical].filter(
    (identity, index, selected) =>
      selected.findIndex(
        candidate => candidate.kind === identity.kind && candidate.code === identity.code
      ) === index
  )
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
        identities.findIndex(
          candidate => candidate.kind === identity.kind && candidate.code === identity.code
        ) === index
    )
}
