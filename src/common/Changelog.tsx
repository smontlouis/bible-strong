import React, { useRef, useEffect } from 'react'
import {
  BottomSheetBackdrop,
  BottomSheetFooter,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet'
import distanceInWords from 'date-fns/formatDistance'
import fr from 'date-fns/locale/fr'
import enGB from 'date-fns/locale/en-GB'

import { useSelector, useDispatch, shallowEqual } from 'react-redux'

import Button from '~common/ui/Button'
import Box from '~common/ui/Box'
import Border from '~common/ui/Border'
import Text from '~common/ui/Text'
import { logTypes } from '~helpers/changelog'
import { saveAllLogsAsSeen } from '~redux/modules/user'
import { useTranslation } from 'react-i18next'
import useLanguage from '~helpers/useLanguage'
import styled from '@emotion/native'
import { RootState } from '~redux/modules/reducer'
import { ChangelogItem, LogType } from './types'
import { renderBackdrop, useBottomSheetStyles } from '~helpers/bottomSheetHelpers'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { BottomSheetDefaultBackdropProps } from '@gorhom/bottom-sheet/lib/typescript/components/bottomSheetBackdrop/types'

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
  const isFR = useLanguage()
  const modalRef = useRef<BottomSheetModal>(null)
  const { key, ...bottomSheetStyles } = useBottomSheetStyles()
  const insets = useSafeAreaInsets()

  const seenLogs = useSelector(
    (state: RootState) => Object.keys(state.user.bible.changelog),
    shallowEqual
  )
  const changelog = useSelector((state: RootState) => state.user.changelog.data, shallowEqual)
  const changelogIsLoading = useSelector((state: RootState) => state.user.changelog.isLoading)

  const showModal = !changelogIsLoading && hasNewLogs(seenLogs, changelog)
  const newLogs = showModal ? findNewLogs(seenLogs, changelog) : []

  useEffect(() => {
    if (showModal) {
      modalRef.current?.present()
    }
  }, [showModal])

  const getAttribute = (log: ChangelogItem, attr: keyof ChangelogItem) => {
    if (isFR) {
      return log[attr]
    }

    return log[`${attr}_en` as keyof ChangelogItem] || log[attr]
  }

  const handleClose = () => {
    dispatch(saveAllLogsAsSeen(changelog))
    modalRef.current?.dismiss()
  }

  return (
    <BottomSheetModal
      ref={modalRef}
      topInset={insets.top}
      snapPoints={['40%']}
      enablePanDownToClose={true}
      backdropComponent={props => renderBackdrop({ ...props, pressBehavior: 'none' })}
      footerComponent={props => (
        <BottomSheetFooter {...props}>
          <Box px={20} pt={5} paddingBottom={insets.bottom + 5} alignItems="flex-end" bg="reverse">
            <Button onPress={handleClose} small>
              {t('Fermer')}
            </Button>
          </Box>
        </BottomSheetFooter>
      )}
      key={key}
      {...bottomSheetStyles}
      style={{
        ...(bottomSheetStyles.style as object),
        marginHorizontal: 20,
        borderRadius: 20,
      }}
      onDismiss={handleClose}
    >
      <BottomSheetScrollView>
        <Box padding={20}>
          <Text fontSize={30} bold>
            {t('Quoi de neuf ?')}
          </Text>
          <Text marginTop={5} fontSize={12} color="grey">
            {t('Les changements depuis votre dernière visite')}
          </Text>
          <Border marginTop={15} />
          <Box marginTop={10}>
            {newLogs.map(log => {
              const formattedDate = distanceInWords(Number(log.date), Date.now(), {
                locale: isFR ? fr : enGB,
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
        </Box>
      </BottomSheetScrollView>
    </BottomSheetModal>
  )
}

export default Changelog
