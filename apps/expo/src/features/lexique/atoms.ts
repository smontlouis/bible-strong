import atomWithAsyncStorage from '~helpers/atomWithAsyncStorage'

export type StrongDefinitionLevel = 'essential' | 'deep'

/** The reader's preferred depth for the definition, remembered across entries. */
export const strongDefinitionLevelAtom = atomWithAsyncStorage<StrongDefinitionLevel>(
  'strongDefinitionLevel',
  'essential'
)
