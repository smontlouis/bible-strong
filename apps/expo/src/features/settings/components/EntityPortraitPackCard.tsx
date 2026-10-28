import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { TouchableOpacity } from 'react-native'

import { useConfirmDialog } from '~common/ConfirmDialog/useConfirmDialog'
import Box from '~common/ui/Box'
import Card from '~common/ui/Card'
import { FeatherIcon } from '~common/ui/Icon'
import IconTile from '~common/ui/IconTile'
import { ProgressBar } from '~common/ui/ProgressBar'
import Text from '~common/ui/Text'
import { useEntityPortraitCatalog } from '~features/lexique/entityPortraitManifest'
import {
  ENTITY_PORTRAIT_PACK_BYTES_PER_PICTURE,
  removeEntityPortraitPack,
  requestEntityPortraitPack,
  syncEntityPortraitPack,
  useEntityPortraitPack,
  useEntityPortraitPackProgress,
} from '~features/lexique/entityPortraitPack'
import { getEntityPortraitPictures } from '~features/lexique/entityPortraits'

/**
 * The offline pack of the entities' portraits (ADR-0089): every portrait and stage in two sizes,
 * kept in line with the catalog once the reader has asked for it.
 */
const EntityPortraitPackCard = ({ downloadsDisabled }: { downloadsDisabled: boolean }) => {
  const { t } = useTranslation()
  const confirm = useConfirmDialog()
  const catalog = useEntityPortraitCatalog()
  const pack = useEntityPortraitPack()
  const progress = useEntityPortraitPackProgress()
  const total = useMemo(() => (catalog ? getEntityPortraitPictures(catalog).length : 0), [catalog])

  // Opening the screen resumes a pack left incomplete.
  useEffect(() => {
    if (pack.requested && !downloadsDisabled) void syncEntityPortraitPack()
  }, [pack.requested, downloadsDisabled])

  if (!total) return null

  const done = Math.min(pack.hashes.length, total)
  const size = t('downloads.size.mb', {
    value: Math.round((total * ENTITY_PORTRAIT_PACK_BYTES_PER_PICTURE) / 1_000_000),
  })
  const isSyncing = progress.status === 'syncing'
  const title = t('downloads.portraitPack.title')
  const subtitle = !pack.requested
    ? t('downloads.portraitPack.offer', { size })
    : isSyncing
      ? t('downloads.portraitPack.progress', { done, total })
      : done < total
        ? t('downloads.portraitPack.incomplete', { done, total })
        : t('downloads.portraitPack.done', { size })

  const remove = async () => {
    const confirmed = await confirm({
      title: t('Attention'),
      message: t('downloads.deleteConfirm'),
      cancelLabel: t('Non'),
      confirmLabel: t('Oui'),
      destructive: true,
    })
    if (confirmed) await removeEntityPortraitPack()
  }

  return (
    <Card className="mx-[20px] mb-[16px] p-[16px] flex-row items-center gap-[14px]">
      <IconTile tint="primary" size={40}>
        <FeatherIcon name="image" size={20} color="primary" />
      </IconTile>
      <Box className="overflow-hidden border-continuous flex-[1]">
        <Text className="text-[15px] font-bold text-default">{title}</Text>
        <Text className="text-[12px] text-tertiary mt-[2px]">{subtitle}</Text>
        {isSyncing && (
          <Box className="overflow-hidden border-continuous mt-[10px]">
            <ProgressBar progress={total ? done / total : 0} />
          </Box>
        )}
      </Box>
      {!pack.requested ? (
        <TouchableOpacity
          accessibilityLabel={t('accessibility.downloadItem', { item: title })}
          accessibilityRole="button"
          accessibilityState={{ disabled: downloadsDisabled }}
          disabled={downloadsDisabled}
          onPress={() => void requestEntityPortraitPack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <FeatherIcon
            name={downloadsDisabled ? 'wifi-off' : 'download-cloud'}
            size={18}
            color={downloadsDisabled ? 'tertiary' : 'primary'}
          />
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          accessibilityLabel={t('accessibility.deleteDownload', { item: title })}
          accessibilityRole="button"
          onPress={() => void remove()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ padding: 4 }}
        >
          <FeatherIcon name="trash-2" size={16} color="quart" />
        </TouchableOpacity>
      )}
    </Card>
  )
}

export default EntityPortraitPackCard
