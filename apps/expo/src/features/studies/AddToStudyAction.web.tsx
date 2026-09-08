import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import ContextualPanel from '~common/ContextualPanel'
import PanelSearch from '~common/ContextualPanel/PanelSearch'
import PanelAction from '~common/ContextualPanel/PanelAction'
import Box, { TouchableBox } from '~common/ui/Box'
import Text from '~common/ui/Text'
import { FeatherIcon } from '~common/ui/Icon'
import { selectStudyListRows } from '~redux/selectors/studies'
import { selectIsLogged } from '~redux/selectors/user'
import generateUUID from '~helpers/generateUUID'
import { toast } from '~helpers/toast'
import ActionItem from '~features/bible/SelectedVersesModal/components/ActionItem'
import type { AddToStudyActionProps } from './AddToStudyAction'
import distanceInWords from 'date-fns/formatDistance'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'

export default function AddToStudyAction({ onPress, onSelect, reference }: AddToStudyActionProps) {
  const { t } = useTranslation()
  const logged = useSelector(selectIsLogged)
  const studies = useSelector(selectStudyListRows)
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState<{ id: string; title: string }>()
  const [busy, setBusy] = useState(false)
  const language = useLanguage()
  const now = useMountTime()
  if (!logged || !onSelect)
    return <ActionItem name="feather" label={t('study.addToStudy')} onPress={onPress} />
  const matches = studies
    .filter(study =>
      (study.title ?? '').toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
    )
    .sort((a, b) => Number(b.modified_at) - Number(a.modified_at))
  return (
    <ContextualPanel
      width={400}
      initialScreen="studies"
      accessibilityLabel={t('study.addToStudy')}
      onClose={() => {
        setQuery('')
        setSelected(undefined)
      }}
      trigger={
        <Box className="items-center py-2 gap-2 w-[70px]">
          <Box className="items-center justify-center bg-light-grey rounded-[16px] w-[48px] h-[48px]">
            <FeatherIcon name="feather" size={20} color="primary" />
          </Box>
          <Text className="text-[10px]">{t('study.addToStudy')}</Text>
        </Box>
      }
      screens={{
        studies: {
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
                  nav.open('format')
                }}
              />
              {matches.map(study => (
                <TouchableBox
                  key={study.id}
                  className="w-full p-3 border-b border-border"
                  accessibilityRole="button"
                  onPress={() => {
                    setSelected({ id: study.id, title: study.title })
                    nav.open('format')
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
        format: {
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
                    if (!selected || busy) return
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
                      {t(
                        format === 'inline' ? 'study.asLinkDescription' : 'study.asBlockDescription'
                      )}
                    </Text>
                  </Box>
                </TouchableBox>
              ))}
            </>
          ),
        },
      }}
    />
  )
}
