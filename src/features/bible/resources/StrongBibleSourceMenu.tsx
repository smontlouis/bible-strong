import { produce } from 'immer'
import { useAtomValue, useSetAtom } from 'jotai/react'
import type { PrimitiveAtom } from 'jotai/vanilla'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import Box from '~common/ui/Box'
import { FeatherIcon } from '~common/ui/Icon'
import { MenuView, type MenuAction } from '~common/ui/MenuView'
import Text from '~common/ui/Text'
import type { StrongBibleProvenance } from '~features/resources/strongBibleResourceAccess'
import {
  STRONG_BIBLE_FALLBACK_PRIORITY,
  type StrongBibleVersionId,
} from '~helpers/strongBiblePublications'
import { getStrongBibleSidecarAvailability } from '~helpers/strongBibleSidecar'
import { downloadCompletionSignalAtom } from '~state/downloadQueue'
import type { BibleTab } from '~state/tabs'

type Props = {
  bibleAtom: PrimitiveAtom<BibleTab>
  isOpen: boolean
  resolvedProvenance: StrongBibleProvenance | null
}

const updateStrongBibleSourceVersion = (versionId?: StrongBibleVersionId) =>
  produce((draft: BibleTab) => {
    draft.data.strongBibleSourceVersionId = versionId
  })

const StrongBibleSourceMenu = ({ bibleAtom, isOpen, resolvedProvenance }: Props) => {
  const { t } = useTranslation()
  const bible = useAtomValue(bibleAtom)
  const setBible = useSetAtom(bibleAtom)
  const downloadCompletionSignal = useAtomValue(downloadCompletionSignalAtom)
  const strongBibleSourceVersionId = bible.data.strongBibleSourceVersionId
  const [availableStrongVersions, setAvailableStrongVersions] =
    useState<Set<StrongBibleVersionId> | null>(null)

  const setStrongBibleSourceVersion = (versionId?: StrongBibleVersionId) => {
    setBible(updateStrongBibleSourceVersion(versionId))
  }

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    Promise.all(
      STRONG_BIBLE_FALLBACK_PRIORITY.map(async versionId => ({
        versionId,
        availability: await getStrongBibleSidecarAvailability(versionId),
      }))
    )
      .then(results => {
        if (cancelled) return

        const installedVersions = new Set<StrongBibleVersionId>()
        for (const { versionId, availability } of results) {
          if (availability.status === 'available') installedVersions.add(versionId)
        }
        setAvailableStrongVersions(installedVersions)

        if (strongBibleSourceVersionId && !installedVersions.has(strongBibleSourceVersionId)) {
          setBible(updateStrongBibleSourceVersion())
        }
      })
      .catch(() => {
        if (!cancelled) setAvailableStrongVersions(null)
      })

    return () => {
      cancelled = true
    }
  }, [downloadCompletionSignal, isOpen, setBible, strongBibleSourceVersionId])

  const actions: MenuAction[] = [
    {
      id: 'strong-source-auto',
      title: t('Automatique'),
      image: 'arrow.triangle.2.circlepath',
      state: strongBibleSourceVersionId ? 'off' : 'on',
    },
    ...STRONG_BIBLE_FALLBACK_PRIORITY.map(versionId => {
      const needsDownload =
        availableStrongVersions !== null && !availableStrongVersions.has(versionId)
      const isUnavailable = availableStrongVersions === null || needsDownload

      return {
        id: `strong-source-${versionId}`,
        title: needsDownload ? t('{{version}} · à télécharger', { version: versionId }) : versionId,
        image: 'book' as const,
        state: strongBibleSourceVersionId === versionId ? ('on' as const) : ('off' as const),
        attributes: isUnavailable ? { disabled: true } : undefined,
      }
    }),
  ]

  const handleAction = (actionId: string) => {
    if (actionId === 'strong-source-auto') {
      setStrongBibleSourceVersion()
      return
    }

    const versionId = actionId.replace('strong-source-', '')
    if (STRONG_BIBLE_FALLBACK_PRIORITY.includes(versionId as StrongBibleVersionId)) {
      setStrongBibleSourceVersion(versionId as StrongBibleVersionId)
    }
  }

  const label = strongBibleSourceVersionId
    ? strongBibleSourceVersionId
    : resolvedProvenance
      ? t('Automatique · {{version}}', { version: resolvedProvenance.versionId })
      : t('Automatique')

  return (
    <MenuView
      testID="strong-bible-source-menu"
      actions={actions}
      onPressAction={({ nativeEvent }) => handleAction(nativeEvent.event)}
    >
      <Box row center height={32} width={100} px={10} borderRadius={16} bg="lightGrey">
        <Text numberOfLines={1} fontSize={12} bold>
          {label}
        </Text>
        <Box ml={4}>
          <FeatherIcon name="chevron-down" size={13} />
        </Box>
      </Box>
    </MenuView>
  )
}

export default StrongBibleSourceMenu
