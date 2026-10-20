import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import PanelAction from '~common/ContextualPanel/PanelAction'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { selectStudyListRows } from '~redux/selectors/studies'
import { selectIsLogged } from '~redux/selectors/user'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import type { PanelScreen } from '~common/ContextualPanel/types'
import type { AddToStudyActionProps } from './AddToStudyAction'
import distanceInWords from 'date-fns/formatDistance'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'

/**
 * The screens that add the selected verses to a study: pick a study (or a new one), then the
 * format. Shared by the action's own panel and the desktop selection menu.
 */
export function useAddToStudyScreens({
  onSelect,
  reference,
}: Pick<AddToStudyActionProps, 'onSelect' | 'reference'>) {
  const { t } = useTranslation()
  const logged = useSelector(selectIsLogged)
  const studies = useSelector(selectStudyListRows)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ id: string; title: string }>()
  const [busy, setBusy] = useState(false)
  const language = useLanguage()
  const now = useMountTime()
  const matches = studies
    .filter(study =>
      (study.title ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
    .sort((a, b) => Number(b.modified_at) - Number(a.modified_at))
  const screens: Record<string, PanelScreen> = {
    study: {
      title: t('study.selectStudy'),
      headerContent: (
        <>
          <Text className="px-3 text-[12px] text-tertiary">{reference}</Text>
          <PanelSearch value={query} onChange={setQuery} />
        </>
      ),
      content: nav => (
        <>
          <PanelAction
            icon="plus-circle"
            nested
            label={t('study.newStudy')}
            onPress={() => {
              setSelected({ id: generateUUID(), title: t('study.newStudy') })
              nav.open('study-format')
            }}
          />
          {matches.map(study => (
            <TouchableBox
              key={study.id}
              className="w-full p-3 border-b border-border"
              accessibilityRole="button"
              onPress={() => {
                setSelected({ id: study.id, title: study.title })
                nav.open('study-format')
              }}
            >
              <Box className="flex-row items-center gap-3">
                <Text className="flex-1 font-bold text-[14px]" numberOfLines={1}>
                  {study.title || t('Études')}
                </Text>
                <FeatherIcon name="chevron-right" size={15} color="tertiary" />
              </Box>
              {!!study.searchDescription && (
                <Text className="text-[12px] text-grey mt-1" numberOfLines={2}>
                  {study.searchDescription}
                </Text>
              )}
              {Number.isFinite(Number(study.modified_at)) && (
                <Text className="text-[12px] text-tertiary mt-1">
                  {t('Il y a {{formattedDate}}', {
                    formattedDate: distanceInWords(Number(study.modified_at), now, {
                      locale: getDateLocale(language),
                    }),
                  })}
                </Text>
              )}
            </TouchableBox>
          ))}
          {!matches.length && <Text className="p-4 text-grey">{t('study.noStudies')}</Text>}
        </>
      ),
    },
    'study-format': {
      title: t('study.formatChoice'),
      headerContent: (
        <Text className="px-3 pb-2 text-[12px] text-tertiary">
          {selected?.title} · {reference}
        </Text>
      ),
      content: nav => (
        <>
          {(['inline', 'block'] as const).map(format => (
            <TouchableBox
              key={format}
              disabled={busy}
              accessibilityRole="button"
              className="w-full flex-row gap-3 items-center p-3 rounded-lg"
              onPress={async () => {
                if (!selected || busy || !onSelect) return
                setBusy(true)
                try {
                  await onSelect(selected.id, format)
                  nav.close()
                } catch {
                  toast.error(t('Une erreur est survenue'))
                } finally {
                  setBusy(false)
                }
              }}
            >
              <FeatherIcon name={format === 'inline' ? 'link-2' : 'align-left'} size={20} />
              <Box className="flex-1">
                <Text className="font-bold text-[14px]">
                  {t(format === 'inline' ? 'study.asLink' : 'study.asBlock')}
                </Text>
                <Text className="text-[12px] text-tertiary mt-1">
                  {t(format === 'inline' ? 'study.asLinkDescription' : 'study.asBlockDescription')}
                </Text>
              </Box>
            </TouchableBox>
          ))}
        </>
      ),
    },
  }
  return {
    screens,
    /** Without an account or a destination, the action opens the app's own flow. */
    available: logged && !!onSelect,
    reset: () => {
      setQuery('')
      setSelected(undefined)
    },
  }
}
