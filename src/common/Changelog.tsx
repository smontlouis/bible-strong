import React, { useRef, useEffect } from 'react'
import {
  SheetFooter,
  Sheet,
  SheetScrollView,
  type SheetRef,
  SheetProvider,
  SheetHeader,
} from '~common/sheet'
import distanceInWords from 'date-fns/formatDistance'

import { useSelector, useDispatch, shallowEqual } from 'react-redux'
import { useAtom } from 'jotai/react'

import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { logTypes } from '~helpers/changelog'
import { saveAllLogsAsSeen } from '~redux/modules/user'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import { getDateLocale } from '~helpers/languageUtils'
import styled from '@emotion/native'
import { RootState } from '~redux/modules/reducer'
import { ChangelogItem, LogType } from './types'
import { changelogModalAtom } from '~state/app'

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

export const ChangelogTag = styled.View(({ type }: { type: LogType }) => ({
  marginLeft: 10,
  padding: 3,
  backgroundColor: getTagColor(type),
  borderRadius: 3,
}))

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
  const dispatch = useDispatch()
  const { t } = useTranslation()
  const lang = useLanguage()
  const modalRef = useRef<SheetRef>(null)
  const [manualOpen, setManualOpen] = useAtom(changelogModalAtom)

  const seenLogs = useSelector(
    (state: RootState) => Object.keys(state.user.bible.changelog),
    shallowEqual
  )
  const changelog = useSelector((state: RootState) => state.user.changelog.data, shallowEqual)
  const changelogIsLoading = useSelector((state: RootState) => state.user.changelog.isLoading)

  const hasAutomaticLogs = !changelogIsLoading && hasNewLogs(seenLogs, changelog)
  const showModal = hasAutomaticLogs || manualOpen
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

  const handleClose = () => {
    markLogsAsSeen()
    setManualOpen(false)
    modalRef.current?.dismiss()
  }

  const handleDismiss = () => {
    markLogsAsSeen()
    setManualOpen(false)
  }

  return (
    <Sheet
      ref={modalRef}
      snapPoints={[0.4, 1]}
      dismissible={false}
      header={
        <SheetHeader
          title={t('Quoi de neuf ?')}
          subTitle={t('Les changements depuis votre dernière visite')}
        />
      }
      footer={props => (
        <SheetFooter alignItems="center" {...props}>
          <Button onPress={handleClose}>{t('Fermer')}</Button>
        </SheetFooter>
      )}
      onDismiss={handleDismiss}
    >
      <SheetScrollView>
        <Box px={20}>
          {visibleLogs.map(log => {
            const formattedDate = distanceInWords(Number(log.date), Date.now(), {
              locale: getDateLocale(lang),
            })
            return (
              <Box key={log.date} marginTop={10} marginBottom={10}>
                <Box row alignItems="flex-start">
                  <Text fontSize={16} bold flex>
                    {getAttribute(log, 'title')}
                  </Text>
                  <ChangelogTag type={log.type}>
                    <Text fontSize={11} bold color="reverse">
                      {log.type}
                    </Text>
                  </ChangelogTag>
                </Box>
                <Text fontSize={10} color="grey">
                  {t('Il y a {{formattedDate}}', { formattedDate })}
                </Text>
                <Text marginTop={10}>{getAttribute(log, 'description')}</Text>
              </Box>
            )
          })}
        </Box>
      </SheetScrollView>
    </Sheet>
  )
}

export default Changelog
