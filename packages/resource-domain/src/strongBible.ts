import type { StrongIdentity } from './strongIdentities'

export type StrongBibleIdentityKind = StrongIdentity['kind']

export type StrongBibleMorphology = {
  identity: StrongIdentity
  codes: string[]
}

export interface StrongBibleSpan {
  ordinal: number
  startOffset: number
  length: number
  stepTokenIds?: number[]
  identities: StrongIdentity[]
  morphologies?: StrongBibleMorphology[]
}
