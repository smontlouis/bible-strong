import React from 'react'
import { useAtomValue } from 'jotai/react'
import { Verse } from '~common/types'
import { useDefaultBibleVersion } from '../state/useDefaultBibleVersion'
import { bibleDataRefreshSignalAtom } from '~state/app'
import { BibleVerseResolutionStatus, resolveBibleVerses } from './bibleVerseResolver'

export const verseStringToObject = (arrayString: string[]): Omit<Verse, 'Texte'>[] => {
  return arrayString.map(string => {
    const [Livre, Chapitre, Verset] = string.split('-')
    return { Livre, Chapitre, Verset }
  })
}

type ResolvedBibleVerses = {
  verses: Verse[]
  version?: string
  status: BibleVerseResolutionStatus
  missingVerseKeys: string[]
  isLoading: boolean
}

export const useResolvedBibleVerses = (
  verseIds: Omit<Verse, 'Texte'>[],
  preferredVersion?: string
): ResolvedBibleVerses => {
  const verseKeys = verseIds.map(({ Livre, Chapitre, Verset }) => `${Livre}-${Chapitre}-${Verset}`)
  const verseKeysSignature = verseKeys.join('|')
  const [verses, setVerses] = React.useState<Verse[]>([])
  const [resolvedVersion, setResolvedVersion] = React.useState<string>()
  const [status, setStatus] = React.useState<BibleVerseResolutionStatus>('reference-only')
  const [missingVerseKeys, setMissingVerseKeys] = React.useState<string[]>([])
  const [isLoading, setIsLoading] = React.useState(Boolean(verseIds.length))

  const defaultVersion = useDefaultBibleVersion()
  const bibleDataRefreshSignal = useAtomValue(bibleDataRefreshSignalAtom)

  React.useEffect(() => {
    let cancelled = false

    const loadVerses = async () => {
      const requestedVerseKeys = verseKeysSignature ? verseKeysSignature.split('|') : []
      if (!requestedVerseKeys.length) {
        setVerses([])
        setResolvedVersion(preferredVersion || defaultVersion)
        setStatus('resolved')
        setMissingVerseKeys([])
        setIsLoading(false)
        return
      }

      setIsLoading(true)
      try {
        const resolution = await resolveBibleVerses({
          verseKeys: requestedVerseKeys,
          preferredVersion,
          defaultVersion,
        })
        if (cancelled) return

        setVerses(
          requestedVerseKeys
            .filter(key => resolution.texts[key])
            .map(key => {
              const [Livre, Chapitre, Verset] = key.split('-')
              return {
                Livre,
                Chapitre,
                Verset,
                Texte: resolution.texts[key],
              }
            }) as Verse[]
        )
        setResolvedVersion(resolution.version)
        setStatus(resolution.status)
        setMissingVerseKeys(resolution.missingVerseKeys)
      } catch (error) {
        if (cancelled) return
        console.error('[useBibleVerses] Failed to resolve verses:', error)
        setVerses([])
        setResolvedVersion(undefined)
        setStatus('reference-only')
        setMissingVerseKeys(requestedVerseKeys)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    loadVerses()
    return () => {
      cancelled = true
    }
  }, [verseKeysSignature, preferredVersion, defaultVersion, bibleDataRefreshSignal])

  return {
    verses,
    version: resolvedVersion,
    status,
    missingVerseKeys,
    isLoading,
  }
}

const useBibleVerses = (verseIds: Omit<Verse, 'Texte'>[], preferredVersion?: string) => {
  return useResolvedBibleVerses(verseIds, preferredVersion).verses
}

export default useBibleVerses
