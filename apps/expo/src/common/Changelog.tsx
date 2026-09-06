import distanceInWords from 'date-fns/formatDistance'
import type { ComponentPropsWithRef as UIComponentProps } from 'react'
import { useEffect, useRef } from 'react'
import * as NativeUI from 'react-native'
import { Platform } from 'react-native'
import { twMerge } from '~common/ui/classNames'
import { useResolveClassNames } from 'uniwind'
import { Sheet, SheetHeader, SheetScrollView, type SheetRef } from '~common/sheet'
import type { Theme as AppTheme } from '~themes'

import { useAtom, useAtomValue } from 'jotai/react'
import { shallowEqual, useDispatch, useSelector } from 'react-redux'

import { useTranslation } from 'react-i18next'
import Box from '~common/ui/Box'
import Text from '~common/ui/Text'
import { isOnboardingCompletedAtom } from '~features/onboarding/atom'
import { logTypes } from '~helpers/changelog'
import { getDateLocale } from '~helpers/languageUtils'
import useLanguage from '~helpers/useLanguage'
import { useMountTime } from '~helpers/useMountTime'
import { RootState } from '~redux/modules/reducer'
import { saveAllLogsAsSeen } from '~redux/modules/user'
import { changelogModalAtom } from '~state/app'
import { ChangelogItem, LogType } from './types'

const getTagColor = (type: LogType) => {
  switch (type) {
    case logTypes.BUG: {
      return '#e74c3c'
    }
    case logTypes.FEATURE: {
      return '#3498db'
    }
    case logTypes.NEW: {
      return '#2ecc71'
    }
    case logTypes.INFO: {
      return '#2c3e50'
    }
    default:
      return '#2c3e50'
  }
}

export const ChangelogTag = (
  componentProps: Omit<UIComponentProps<typeof NativeUI.View>, keyof { type: LogType } | 'theme'> &
    Omit<{ type: LogType }, 'theme'> & { theme?: AppTheme; className?: string }
) => {
  const { theme: _themeOverride, className, ...props } = componentProps

  const { type } = props
  const classStyles = useResolveClassNames(twMerge('ml-[10px] p-[3px] rounded-[3px]', className))
  return (
    <NativeUI.View
      {...props}
      style={
        [classStyles, { backgroundColor: getTagColor(type) }, props.style] as UIComponentProps<
          typeof NativeUI.View
        >['style']
      }
    />
  )
}

const hasNewLogs = (seenLogs: string[], changelog: ChangelogItem[]) => {
  if (!changelog.length) {
    return false
  }

  if (!seenLogs.length) {
    return true
  }

  const newLogs = findNewLogs(seenLogs, changelog)
  return !!newLogs.length
}

const findNewLogs = (seenLogs: string[], changeLog: ChangelogItem[]) =>
  changeLog.filter(log => !seenLogs.find(c => c === log.date))

const Changelog = () => {
  const mountTime = useMountTime()
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()
  const modalRef = useRef<SheetRef>(null)
  const [manualOpen, setManualOpen] = useAtom(changelogModalAtom)
  const isOnboardingCompleted = useAtomValue(isOnboardingCompletedAtom)

  const seenLogs = useSelector(
    (state: RootState) => Object.keys(state.user.bible.changelog),
    shallowEqual
  )
  const changelog = useSelector((state: RootState) => state.user.changelog.data, shallowEqual)
  const changelogIsLoading = useSelector((state: RootState) => state.user.changelog.isLoading)

  const hasAutomaticLogs = !changelogIsLoading && hasNewLogs(seenLogs, changelog)
  const showModal =
    (Platform.OS === 'web' || isOnboardingCompleted) && (hasAutomaticLogs || manualOpen)
  const newLogs = hasAutomaticLogs ? findNewLogs(seenLogs, changelog) : []
  const visibleLogs = hasAutomaticLogs
    ? newLogs
    : [...changelog].sort((a, b) => Number(b.date) - Number(a.date))

  useEffect(() => {
    if (showModal) {
      modalRef.current?.present()
    }
  }, [showModal])

  const getAttribute = (log: ChangelogItem, attr: keyof ChangelogItem) => {
    if (lang === 'fr') {
      return log[attr]
    }

    return log[`${attr}_en` as keyof ChangelogItem] || log[attr]
  }

  const markLogsAsSeen = () => {
    dispatch(saveAllLogsAsSeen(changelog))
  }

  const handleDismiss = () => {
    markLogsAsSeen()
    setManualOpen(false)
  }

  return (
    <Sheet
      ref={modalRef}
      snapPoints={[0.4, 1]}
      header={
        <SheetHeader
          title={t('Quoi de neuf ?')}
          subTitle={t('Les changements depuis votre dernière visite')}
        />
      }
      onDismiss={handleDismiss}
    >
      <SheetScrollView>
        <Box className="overflow-hidden border-continuous px-[20px]">
          {visibleLogs.map(log => {
            const formattedDate = distanceInWords(Number(log.date), mountTime, {
              locale: getDateLocale(lang),
            })
            return (
              <Box className="overflow-hidden border-continuous mt-[10px] mb-[10px]" key={log.date}>
                <Box className="overflow-hidden border-continuous flex-row items-start">
                  <Text className="text-[16px] font-bold flex-[1]">
                    {getAttribute(log, 'title')}
                  </Text>
                  <ChangelogTag type={log.type}>
                    <Text className="text-[11px] font-bold text-reverse">{log.type}</Text>
                  </ChangelogTag>
                </Box>
                <Text className="text-[10px] text-grey">
                  {t('Il y a {{formattedDate}}', { formattedDate })}
                </Text>
                <Text className="mt-[10px]">{getAttribute(log, 'description')}</Text>
              </Box>
            )
          })}
        </Box>
      </SheetScrollView>
    </Sheet>
  )
}

export default Changelog
